"use client";

import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { Check, CircleAlert, Pause, Play, Plus, RotateCcw, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { Slider } from "../../slider/slider";
import { Switch } from "../../switch/switch";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { planRounds, sampleTokens, simulateRounds, statsAt, viewAt } from "./speculative-decoding-data";
import type { DecodePlan, DecodeRound, DecodeStats, DecodeToken, DecodeView } from "./speculative-decoding-data";
import { RollingNumber } from "./speculative-decoding-number";
import styles from "./speculative-decoding.module.css";

export type { DecodePlan, DecodeRound, DecodeStats, DecodeToken } from "./speculative-decoding-data";
export { planRounds, sampleTokens, simulateRounds } from "./speculative-decoding-data";

export type SpeculativeDecodingStatus = "ready" | "loading" | "error";

/**
 * Speculative decoding, drawn as two lanes. A small draft model guesses a few tokens ahead; the large target model checks
 * them all in one pass, keeps the ones that match, replaces the first miss with its own token and drops the rest. A
 * compare switch races the same answer written one token per target pass.
 */
export interface SpeculativeDecodingProps {
  /** The target model's answer, one entry per token. Ease and miss shape the simulated draft guesses. */
  tokens?: DecodeToken[];
  /** A recorded run to replay instead of the simulation. The draft length slider is hidden while it is set. */
  rounds?: DecodeRound[];
  /** Tokens the draft model guesses per round, 2 to 8 (controlled). */
  draftLength?: number;
  defaultDraftLength?: number;
  onDraftLengthChange?: (length: number) => void;
  /** Race a second line where the target writes one token per pass (controlled). */
  compare?: boolean;
  defaultCompare?: boolean;
  onCompareChange?: (compare: boolean) => void;
  /** Starts the run once the card scrolls into view. Never starts on its own with reduced motion. */
  autoplay?: boolean;
  /** Seed for the simulated guesses. The same seed always gives the same run. */
  seed?: number;
  /** Cost of one draft token as a share of one target pass. Counts toward the speedup. */
  draftCost?: number;
  /** Milliseconds one target pass takes on screen. */
  passDuration?: number;
  title?: string;
  draftLabel?: string;
  draftDetail?: string;
  targetLabel?: string;
  targetDetail?: string;
  /** Loading dims the lanes and shows a working label; error shows the message with a retry. */
  status?: SpeculativeDecodingStatus;
  /** Message shown when status is "error". */
  error?: string;
  /** Called by the retry button in the error state. The button is hidden without it. */
  onRetry?: () => void;
  /** Called once each time the speculative line finishes, with the stats of the run. */
  onComplete?: (stats: DecodeStats) => void;
  className?: string;
  style?: CSSProperties;
}

const enter = [...motionTokens.ease.enter] as [number, number, number, number];
/** Small fast moves: critically damped, so a landing token never overshoots its slot. */
const travel = { type: "spring" as const, visualDuration: 0.32, bounce: 0 };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const ordinal = (value: number) => ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth"][value - 1] ?? `${value}th`;
const display = (text: string) => text.trim() || "␣";
const sameView = (a: DecodeView, b: DecodeView) => a.phase === b.phase && a.round === b.round && a.shown === b.shown && a.verdicts === b.verdicts && a.targetShown === b.targetShown
  && a.emitted === b.emitted && a.baseline === b.baseline && a.settled === b.settled && a.specDone === b.specDone && a.baseDone === b.baseDone && a.basePass === b.basePass;

function useControllable<T>(value: T | undefined, initial: T, onChange?: (next: T) => void) {
  const [inner, setInner] = useState(initial);
  const controlled = value !== undefined;
  const current = controlled ? value : inner;
  const set = useCallback((next: T) => {
    if (!controlled) setInner(next);
    onChange?.(next);
  }, [controlled, onChange]);
  return [current, set] as const;
}

/** Height follows the content on the smooth spring, so wrapping chips or a summary never resize the card in one frame. */
function AutoHeight({ children, reduced, className }: { children: ReactNode; reduced: boolean; className?: string }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <motion.div className={className} initial={false} animate={{ height }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
    <div ref={inner}>{children}</div>
  </motion.div>;
}

/** One line of text that crossfades when it changes: the old line fades out fast, the new one fades in from 2px below. */
function Swap({ id, children, reduced, className }: { id: string; children: ReactNode; reduced: boolean; className?: string }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence initial={false}>
      <motion.span
        key={id}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease: enter } }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
      >{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/** Splits the answer into words, so punctuation and word pieces wrap with the word they belong to. */
function wordsOf(output: DecodePlan["output"]) {
  const words: { space: boolean; items: { index: number; text: string }[] }[] = [];
  output.forEach((token, index) => {
    const space = /^\s/.test(token.text);
    if (!words.length || space) words.push({ space, items: [] });
    words[words.length - 1].items.push({ index, text: token.text.replace(/^\s+/, "") });
  });
  return words;
}

export function SpeculativeDecoding({
  tokens = sampleTokens,
  rounds,
  draftLength: draftLengthProp,
  defaultDraftLength = 4,
  onDraftLengthChange,
  compare: compareProp,
  defaultCompare = false,
  onCompareChange,
  autoplay = true,
  seed = 12,
  draftCost = 0.1,
  passDuration = 640,
  title = "Speculative decoding",
  draftLabel = "Draft model",
  draftDetail = "Small, fast",
  targetLabel = "Target model",
  targetDetail = "Large",
  status = "ready",
  error,
  onRetry,
  onComplete,
  className,
  style,
}: SpeculativeDecodingProps) {
  const reduced = useReducedMotion() ?? false;
  const [rawLength, setDraftLength] = useControllable(draftLengthProp, defaultDraftLength, onDraftLengthChange);
  const [compare, setCompare] = useControllable(compareProp, defaultCompare, onCompareChange);
  const draftLength = clamp(Math.round(rawLength), 2, 8);

  // The plan is keyed by its inputs, not their identity, so an inline tokens array does not restart the run each render.
  const signature = JSON.stringify([rounds ?? tokens, rounds ? 0 : draftLength, seed, draftCost]);
  const plan = useMemo(() => {
    const [input, length, seedValue, cost] = JSON.parse(signature) as [DecodeRound[] | DecodeToken[], number, number, number];
    return planRounds(rounds ? (input as DecodeRound[]) : simulateRounds(input as DecodeToken[], length, seedValue), cost);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
  const total = plan.output.length;
  const end = compare ? Math.max(plan.end, total) : plan.end;
  const ready = status === "ready" && total > 0;
  const words = useMemo(() => wordsOf(plan.output), [plan]);

  // The clock lives in a ref and advances on animation frames. Only the derived view goes through state, and only when
  // something on screen changes; the sweep is written straight to a CSS variable.
  const clock = useRef({ signature: "", time: 0 });
  const live = useRef({ plan, signature, end, reduced, passDuration, onComplete });
  useLayoutEffect(() => { live.current = { plan, signature, end, reduced, passDuration, onComplete }; });
  const [frame, setFrame] = useState<{ signature: string; view: DecodeView }>(() => ({ signature, view: viewAt(plan, 0) }));
  const view = frame.signature === signature ? frame.view : viewAt(plan, 0);
  const [playing, setPlaying] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const columnsRef = useRef<HTMLDivElement>(null);

  const apply = useCallback(() => {
    const { plan: current, signature: key, reduced: still } = live.current;
    if (clock.current.signature !== key) clock.current = { signature: key, time: 0 };
    const next = viewAt(current, clock.current.time);
    columnsRef.current?.style.setProperty("--sweep", String(still ? next.verdicts : Math.round(next.sweep * 1000) / 1000));
    setFrame(previous => (previous.signature === key && sameView(previous.view, next) ? previous : { signature: key, view: next }));
    return next;
  }, []);

  useEffect(() => {
    if (!playing) return;
    let handle = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const { end: stop, passDuration: pass, plan: current } = live.current;
      const step = Math.min(64, now - last) / Math.max(120, pass);
      last = now;
      const before = clock.current.time;
      if (clock.current.signature === live.current.signature) clock.current.time = Math.min(stop, before + step);
      const next = apply();
      if (before < current.end && clock.current.time >= current.end && clock.current.signature === live.current.signature) {
        live.current.onComplete?.(current.stats);
        const { passes, tokens: count, speedup } = current.stats;
        setAnnouncement(`Done. ${plural(count, "token")} in ${plural(passes, "target pass", "target passes")}, ${speedup.toFixed(1)} times faster than the target alone.`);
      }
      if (clock.current.time >= stop && clock.current.signature === live.current.signature) {
        if (next.baseDone && stop > current.end) setAnnouncement(`Target alone finished after ${plural(current.output.length, "pass", "passes")}.`);
        setPlaying(false);
        return;
      }
      handle = requestAnimationFrame(tick);
    };
    handle = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(handle);
  }, [playing, apply]);

  // Autoplay starts once, the first time the card is mostly in view.
  const cardRef = useRef<HTMLDivElement>(null);
  const autoStarted = useRef(false);
  useEffect(() => {
    const node = cardRef.current;
    if (!node || !autoplay || reduced || !ready || autoStarted.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || autoStarted.current) return;
      autoStarted.current = true;
      setPlaying(true);
      observer.disconnect();
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoplay, reduced, ready]);

  // Landing: accepted drafts and the target's token travel from their chips into their place in the answer.
  const outRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const sources = useRef(new Map<string, HTMLElement>());
  const flights = useRef<AnimationPlaybackControls[]>([]);
  const landed = useRef(0);
  const stopFlights = useCallback(() => {
    flights.current.forEach(controls => controls.stop());
    flights.current = [];
    outRefs.current.forEach(node => { if (node) node.style.transform = ""; });
  }, []);
  useLayoutEffect(() => {
    const from = landed.current;
    const to = view.emitted;
    landed.current = to;
    if (to <= from) { if (to < from) stopFlights(); return; }
    if (reduced) return;
    for (let index = from; index < to; index += 1) {
      const token = plan.output[index];
      const round = plan.rounds[token?.round ?? -1];
      const node = outRefs.current[index];
      if (!token || !round || !node) continue;
      const offset = index - round.outStart;
      const source = sources.current.get(offset < round.accepted ? `${round.index}:${offset}` : `${round.index}:t`);
      if (!source) continue;
      const a = source.getBoundingClientRect();
      const b = node.getBoundingClientRect();
      const x = Math.round(a.left - b.left);
      const y = Math.round(a.top + a.height / 2 - (b.top + b.height / 2));
      if (Math.abs(x) + Math.abs(y) < 1) continue;
      node.style.transform = `translate(${x}px, ${y}px)`;
      flights.current.push(animate(node, { x: [x, 0], y: [y, 0] }, { ...travel, delay: Math.min(0.12, (index - from) * 0.02) }));
    }
  }, [view.emitted, plan, reduced, stopFlights]);
  useEffect(() => () => flights.current.forEach(controls => controls.stop()), []);

  const restart = useCallback((play: boolean) => {
    stopFlights();
    clock.current = { signature: live.current.signature, time: 0 };
    apply();
    setPlaying(play);
  }, [apply, stopFlights]);

  const togglePlay = () => {
    if (!ready) return;
    if (playing) { setPlaying(false); setAnnouncement("Paused"); return; }
    if (clock.current.signature === signature && clock.current.time >= end) { restart(true); setAnnouncement("Playing from the start"); return; }
    setPlaying(true);
    setAnnouncement("Playing");
  };

  const changeLength = (next: number) => {
    const length = clamp(Math.round(next), 2, 8);
    if (length === draftLength) return;
    setDraftLength(length);
    stopFlights();
    // A new length is a new plan; the clock resets on the next frame and the run plays from the start.
    clock.current = { signature: "", time: 0 };
    setPlaying(ready);
  };
  const commitLength = (next: number) => {
    const preview = planRounds(simulateRounds(tokens, clamp(Math.round(next), 2, 8), seed), draftCost).stats;
    setAnnouncement(`Draft length ${next}. ${Math.round(preview.acceptance * 100)} percent of drafts accepted, ${preview.speedup.toFixed(1)} times faster.`);
  };

  const changeCompare = (on: boolean) => {
    setCompare(on);
    const time = clock.current.signature === signature ? clock.current.time : 0;
    const nextEnd = on ? Math.max(plan.end, total) : plan.end;
    if (on && time >= plan.end && time < nextEnd) setPlaying(true);
    if (!on && time >= plan.end) setPlaying(false);
    setAnnouncement(on ? "Comparing against the target alone, one token per pass." : "Comparison hidden.");
  };

  const stats = view.specDone ? plan.stats : statsAt(plan, view.settled);
  const current = view.round >= 0 && !view.specDone ? plan.rounds[view.round] : null;
  const size = current?.draft.length ?? 0;
  const bonus = current ? current.accepted === size : false;
  const leaving = view.phase === "settle";

  let statusText: string;
  let statusKey: string;
  let statusIcon: ReactNode = null;
  if (status === "loading") { statusText = "Loading the decoding run"; statusKey = "loading"; }
  else if (status === "error") { statusText = "The run could not load"; statusKey = "error"; }
  else if (!total) { statusText = "Nothing to decode yet"; statusKey = "empty"; }
  else if (view.specDone) {
    statusIcon = <Check className={styles.statusCheck} size={15} strokeWidth={2} aria-hidden="true" />;
    if (compare && !view.baseDone) { statusText = `Speculation done in ${plural(plan.stats.passes, "pass", "passes")}, target alone still writing`; statusKey = "done-racing"; }
    else if (compare) { statusText = `${plural(plan.stats.passes, "pass", "passes")} with speculation, ${total} without`; statusKey = "done-both"; }
    else { statusText = `Done in ${plural(plan.stats.passes, "target pass", "target passes")}`; statusKey = "done"; }
  } else if (!current) { statusText = `Draft guesses ${draftLength} tokens ahead, target checks them in one pass`; statusKey = `idle-${draftLength}`; }
  else if (view.phase === "draft") { statusText = size ? `Draft model proposes ${plural(size, "token")}` : "Target writes the last token"; statusKey = `${view.round}-draft`; }
  else if (view.phase === "verify") { statusText = size ? `Target checks ${size === 1 ? "it" : `all ${size}`} in one pass` : "Target writes the last token"; statusKey = `${view.round}-verify`; }
  else if (!size) { statusText = "Target wrote the last token"; statusKey = `${view.round}-settle`; }
  else if (bonus) { statusText = `All ${size} accepted, plus a bonus token`; statusKey = `${view.round}-settle`; }
  else if (current.accepted === 0) { statusText = "First guess rejected, target writes its own"; statusKey = `${view.round}-settle`; }
  else { statusText = `${current.accepted} of ${size} accepted, target fixes the ${ordinal(current.accepted + 1)}`; statusKey = `${view.round}-settle`; }

  const roundSummary = current && view.verdicts >= size && view.phase !== "draft"
    ? `Round ${current.index + 1}. Draft proposed ${current.draft.map(display).join(", ") || "nothing"}. Target accepted ${current.accepted}${bonus ? ` and added ${display(current.target)}` : ` and wrote ${display(current.target)} instead of ${display(current.draft[current.accepted])}`}.`
    : "";

  const columns = current ? Array.from({ length: Math.min(view.shown, size) }, (_, index) => {
    const verdict = index < view.verdicts ? (index < current.accepted ? "accepted" : index === current.accepted ? "rejected" : "discarded") : "ghost";
    const correction = index === current.accepted;
    return <div key={`${current.index}:${index}`} className={styles.column} data-state={verdict} data-leaving={leaving || undefined} style={{ "--j": index } as CSSProperties}>
      <span className={styles.chip}>
        <span ref={node => { const key = `${current.index}:${index}`; if (node) sources.current.set(key, node); else sources.current.delete(key); }} className={styles.chipText}>
          <TextShimmer active={verdict === "ghost" && !reduced} duration={0.9}>{display(current.draft[index])}</TextShimmer>
          <span className={styles.strike} aria-hidden="true" />
        </span>
      </span>
      <span className={styles.cell}>
        <span className={styles.fill} />
        {correction
          ? <span className={styles.cellContent} data-on={(verdict === "rejected" && view.targetShown) || undefined}>
            <X className={styles.missIcon} size={13} strokeWidth={2} aria-hidden="true" />
            <span ref={node => { const key = `${current.index}:t`; if (node) sources.current.set(key, node); else sources.current.delete(key); }} className={styles.targetText}>{display(current.target)}</span>
          </span>
          : <span className={styles.cellContent} data-on={verdict === "accepted" || undefined}>
            <Check className={styles.hitIcon} size={14} strokeWidth={2} aria-hidden="true" />
          </span>}
      </span>
    </div>;
  }) : [];
  if (current && bonus && view.targetShown) columns.push(<div key={`${current.index}:bonus`} className={styles.column} data-state="bonus" data-leaving={leaving || undefined}>
    <span className={styles.chip} data-empty="" />
    <span className={styles.cell}>
      <span className={styles.cellContent} data-on="">
        {size > 0 && <Plus className={styles.bonusIcon} size={13} strokeWidth={2} aria-hidden="true" />}
        <span ref={node => { const key = `${current.index}:t`; if (node) sources.current.set(key, node); else sources.current.delete(key); }} className={styles.targetText}>{display(current.target)}</span>
      </span>
    </span>
  </div>);

  const specMeta = view.specDone ? plural(plan.stats.passes, "pass", "passes") : plural(view.settled, "pass", "passes");
  const baseMeta = plural(view.baseline, "pass", "passes");
  const disabled = !ready;

  return <div className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
    <div ref={cardRef} className={styles.card} role="group" aria-label={title} data-status={ready ? "ready" : total ? status : "empty"} data-reduced={reduced || undefined}>
      <div className={styles.header}>
        <div className={styles.heading}>
          <p className={styles.title}>{title}</p>
          <p className={styles.status}>
            {status === "loading"
              ? <TextShimmer>{statusText}</TextShimmer>
              : <Swap id={statusKey} reduced={reduced} className={styles.statusLine}>{statusIcon}{statusText}</Swap>}
          </p>
        </div>
        <div className={styles.actions}>
          <Tooltip content={playing ? "Pause" : view.specDone && (!compare || view.baseDone) ? "Play again" : "Play"}>
            <button type="button" className={styles.iconButton} onClick={togglePlay} disabled={disabled} aria-label={playing ? "Pause" : "Play"}>
              <span className={styles.iconStack} aria-hidden="true">
                <Pause data-on={playing || undefined} size={15} strokeWidth={1.75} />
                <Play data-on={!playing || undefined} size={15} strokeWidth={1.75} />
              </span>
            </button>
          </Tooltip>
          <Tooltip content="Restart">
            <button type="button" className={styles.iconButton} onClick={() => { restart(true); setAnnouncement("Restarted"); }} disabled={disabled} aria-label="Restart">
              <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      {total === 0 ? <div className={styles.empty}>
        <p className={styles.emptyTitle}>No tokens to decode</p>
        <p className={styles.emptyText}>Pass the target model&apos;s answer as tokens, or a recorded run as rounds.</p>
      </div> : <>
        <div className={styles.lanes}>
          <div className={styles.laneLabels} aria-hidden="true">
            <div className={styles.laneLabel} data-lane="draft"><span className={styles.laneDot} /><span className={styles.laneText}><span className={styles.laneName}>{draftLabel}</span><span className={styles.laneDetail}>{draftDetail}</span></span></div>
            <div className={styles.laneLabel} data-lane="target"><span className={styles.laneDot} /><span className={styles.laneText}><span className={styles.laneName}>{targetLabel}</span><span className={styles.laneDetail}>{targetDetail}</span></span></div>
          </div>
          <AutoHeight reduced={reduced} className={styles.track}>
            <div ref={columnsRef} className={styles.columns} data-phase={view.phase} aria-hidden="true">
              {view.specDone ? <div className={styles.summary}>
                <span className={styles.summaryRow}>{`${plural(plan.stats.drafted, "token")} drafted, ${plan.stats.accepted} accepted`}</span>
                <span className={styles.summaryRow}>{`${plural(plan.stats.passes, "pass", "passes")} for ${plural(total, "token")}`}</span>
              </div> : current ? columns : Array.from({ length: rounds ? 0 : draftLength }, (_, index) => <div key={`slot${index}`} className={styles.column} data-state="slot">
                <span className={styles.chip} />
                <span className={styles.cell} />
              </div>)}
            </div>
          </AutoHeight>
          <p className={styles.srOnly}>{roundSummary}</p>
        </div>

        {status === "error" && <div className={styles.alert} role="alert">
          <CircleAlert className={styles.alertIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
          <span className={styles.alertText}>{error ?? "Could not load the decoding run."}</span>
          {onRetry && <Button variant="secondary" size="sm" onClick={onRetry}>Retry</Button>}
        </div>}

        <div className={styles.outputs}>
          <div className={styles.line} data-line="spec">
            <div className={styles.lineLabel}>
              <Swap id={compare ? "spec" : "out"} reduced={reduced} className={styles.lineName}>{compare ? "Speculative" : "Output"}</Swap>
              <span className={styles.lineMeta}>{view.specDone && <Check className={styles.metaCheck} size={13} strokeWidth={2} aria-hidden="true" />}{specMeta}</span>
            </div>
            <p className={styles.lineText} aria-label={`Output: ${plan.output.slice(0, view.emitted).map(token => token.text).join("").trim() || "empty"}`}>
              {words.map((word, wordIndex) => <Fragment key={wordIndex}>
                {wordIndex > 0 && word.space ? " " : null}
                <span className={styles.word}>
                  {word.items.map(item => <span
                    key={item.index}
                    ref={node => { outRefs.current[item.index] = node; }}
                    className={styles.tok}
                    data-on={item.index < view.emitted || undefined}
                    data-origin={plan.output[item.index].origin}
                    aria-hidden="true"
                  >{item.text}</span>)}
                </span>
              </Fragment>)}
            </p>
          </div>
          <AnimatePresence initial={false}>
            {compare && <motion.div
              key="baseline"
              className={styles.baselineWrap}
              initial={reduced ? { opacity: 0 } : { height: 0, opacity: 0 }}
              animate={reduced ? { opacity: 1 } : { height: "auto", opacity: 1 }}
              exit={reduced ? { opacity: 0, transition: { duration: 0.1 } } : { height: 0, opacity: 0, transition: { height: motionTokens.spring.smooth, opacity: { duration: 0.12 } } }}
              transition={{ height: motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: enter } }}
            >
              <div className={styles.line} data-line="base">
                <div className={styles.lineLabel}>
                  <span className={styles.lineName}>Target only</span>
                  <span className={styles.lineMeta}>{view.baseDone && <Check className={styles.metaCheck} size={13} strokeWidth={2} aria-hidden="true" />}{baseMeta}</span>
                </div>
                <p className={styles.lineText} aria-label={`Target only: ${plan.output.slice(0, view.baseline).map(token => token.text).join("").trim() || "empty"}`}>
                  {words.map((word, wordIndex) => <Fragment key={wordIndex}>
                    {wordIndex > 0 && word.space ? " " : null}
                    <span className={styles.word}>
                      {word.items.map(item => <span key={item.index} className={styles.tok} data-on={item.index < view.baseline || undefined} data-origin="target" aria-hidden="true">{item.text}</span>)}
                    </span>
                  </Fragment>)}
                </p>
              </div>
            </motion.div>}
          </AnimatePresence>
        </div>

        <div className={styles.footer}>
          <dl className={styles.stats}>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>Faster</dt>
              <dd className={styles.statValue}><RollingNumber value={stats ? stats.speedup : null} decimals={1} suffix="×" /><span className={styles.srOnly}>{stats ? `${stats.speedup.toFixed(1)} times` : "not yet"}</span></dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>Drafts accepted</dt>
              <dd className={styles.statValue}><RollingNumber value={stats ? Math.round(stats.acceptance * 100) : null} places={3} suffix="%" /><span className={styles.srOnly}>{stats ? `${Math.round(stats.acceptance * 100)} percent` : "not yet"}</span></dd>
            </div>
            <div className={styles.stat}>
              <dt className={styles.statLabel}>Tokens per pass</dt>
              <dd className={styles.statValue}><RollingNumber value={stats ? stats.tokensPerPass : null} decimals={1} /><span className={styles.srOnly}>{stats ? stats.tokensPerPass.toFixed(1) : "not yet"}</span></dd>
            </div>
          </dl>
          <div className={styles.controls}>
            {!rounds && <div className={styles.sliderSlot}>
              <Slider label="Draft length" min={2} max={8} step={1} value={draftLength} onValueChange={changeLength} onValueCommit={commitLength} format={value => plural(value, "token")} disabled={disabled} />
            </div>}
            <Switch label="Compare without speculation" checked={compare} onCheckedChange={changeCompare} disabled={disabled} className={styles.switch} />
          </div>
        </div>
      </>}
      <p className={styles.srOnly} aria-live="polite">{announcement}</p>
    </div>
  </div>;
}

export default SpeculativeDecoding;
