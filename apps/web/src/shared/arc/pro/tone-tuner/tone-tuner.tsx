"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { Check, CircleAlert, HeartHandshake, PenLine, RotateCcw, Smile, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { CopyButton } from "../../copy-button/copy-button";
import { Slider } from "../../slider/slider";
import { Switch } from "../../switch/switch";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import { avatar } from "../lib/media";
import { ClaudeMark } from "./tone-tuner-marks";
import {
  describeSettings, detailLabels, diffDoc, docText, formalityLabels, instructionsFor, parseDoc, sameSettings, sampleDoc,
  sampleTallest, toneOriginal, tonePresets, wordCount,
} from "./tone-tuner-data";
import type { ToneDoc, ToneLevel, TonePreset, ToneRewriteRequest, ToneSettings } from "./tone-tuner-data";
import styles from "./tone-tuner.module.css";

export type { ToneDoc, ToneLevel, TonePreset, ToneRewriteRequest, ToneSettings, ToneVoice } from "./tone-tuner-data";
export { instructionsFor, toneOriginal, tonePresets } from "./tone-tuner-data";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const enterEase = [...motionTokens.ease.enter] as [number, number, number, number];
const exitEase = [...motionTokens.ease.standard] as [number, number, number, number];
/** Simulated model latency after the debounce, so the sample feels like a real round trip without dragging. */
const SIMULATED_LATENCY = 340;
/** The self playing tour: each preset, one slider move, then back to the original draft. */
const TOUR: ToneSettings[] = [
  { voice: "friendly", formality: 0, detail: 1 },
  { voice: "confident", formality: 1, detail: 0 },
  { voice: "empathetic", formality: 1, detail: 2 },
  { voice: "empathetic", formality: 2, detail: 2 },
  toneOriginal,
];
const presetIcons: Record<TonePreset["voice"], LucideIcon> = { friendly: Smile, confident: Zap, empathetic: HeartHandshake };

export interface ToneTunerRecipient {
  name: string;
  /** Portrait URL. Falls back to initials. */
  avatar?: string;
  /** The line under the name, such as the subject of the thread. */
  subject?: string;
}

export interface ToneTunerProps {
  /** Controlled tone. Pair with onValueChange. */
  value?: ToneSettings;
  /** Starting tone when uncontrolled. Defaults to the original draft: neutral voice, neutral formality, balanced detail. */
  defaultValue?: ToneSettings;
  onValueChange?: (value: ToneSettings) => void;
  /** The original draft. Used with `rewrite`; without it the sample billing reply is shown and rewrites are simulated. */
  text?: string;
  /**
   * Calls your model. Receives the original text, the settings and a ready made instruction, and resolves to the
   * rewritten plain text. Superseded requests are aborted through the signal. Without it the rewrites are simulated.
   */
  rewrite?: (request: ToneRewriteRequest, signal: AbortSignal) => Promise<string>;
  /** Runs after each rewrite lands, with the new text. */
  onRewrite?: (text: string, value: ToneSettings) => void;
  /** Runs after Copy succeeds. */
  onCopy?: (text: string) => void;
  /** Who the message is for, shown in the header. */
  recipient?: ToneTunerRecipient;
  /** The model named while a rewrite runs. */
  model?: string;
  /** Voice chips. Choosing one sets the voice and moves both sliders to its starting point. */
  presets?: TonePreset[];
  /** Quiet time after the last change before a rewrite starts. Defaults to 220ms. */
  debounceMs?: number;
  /** Controlled change highlighting. Pair with onShowChangesChange. */
  showChanges?: boolean;
  /** Highlights words that differ from the original draft. Defaults to true. */
  defaultShowChanges?: boolean;
  onShowChangesChange?: (show: boolean) => void;
  /** Tours the presets while on screen until someone interacts. Defaults to true for the uncontrolled sample. */
  autoPlay?: boolean;
  className?: string;
}

type Phase = "idle" | "rewriting" | "done" | "error";
type Seg = { text: string; added: boolean[] };

const sampleRecipient: ToneTunerRecipient = { name: "Sofia Ramirez", avatar: avatar("sofia-ramirez"), subject: "Re: Duplicate charge on INV-20481" };
const words = (text: string) => text.split(/\s+/).filter(Boolean);

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

/** Groups a sentence into plain and added runs, so consecutive new words share one highlight (spaces included). */
function runsOf(text: string, added: boolean[]) {
  const parts: { text: string; added: boolean }[] = [];
  words(text).forEach((word, index) => {
    const isNew = added[index] ?? false;
    if (index > 0) {
      const last = parts[parts.length - 1];
      if (!last.added || isNew) last.text += " ";
      else parts.push({ text: " ", added: false });
    }
    const last = parts[parts.length - 1];
    if (last && last.added === isNew) last.text += word;
    else parts.push({ text: word, added: isNew });
  });
  return parts;
}

/**
 * One sentence. When its text changes it fades out (100ms), swaps while invisible and fades back in (160ms). Every
 * changed sentence swaps on the same frame, so the paragraph reflows once, out of sight.
 */
function Segment({ seg, lead, block, reduced }: { seg: Seg; lead: boolean; block?: boolean; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(seg);
  const latest = useRef(seg);
  const anim = useRef<AnimationPlaybackControls | undefined>(undefined);
  /** "out" while the old words fade, "in" from the swap until they are back. */
  const stage = useRef<"out" | "in" | null>(null);
  // Same words, new highlight flags: take them at once. The highlight itself eases in CSS.
  if (seg.text === shown.text && seg !== shown) setShown(seg);

  useEffect(() => { latest.current = seg; });

  useEffect(() => {
    const node = ref.current;
    if (!node || reduced) return;
    if (seg.text === shown.text) {
      // Changed back before the swap: bring the same words straight back instead of leaving them faded.
      if (stage.current === "out") {
        anim.current?.stop();
        stage.current = null;
        anim.current = animate(node, { opacity: 1 }, { duration: .16, ease: enterEase });
      }
      return;
    }
    let cancelled = false;
    anim.current?.stop();
    stage.current = "out";
    const out = animate(node, { opacity: 0 }, { duration: .1, ease: exitEase });
    anim.current = out;
    out.then(() => { if (!cancelled && stage.current === "out") { stage.current = "in"; setShown(latest.current); } });
    return () => { cancelled = true; };
  }, [seg.text, shown.text, reduced]);

  useLayoutEffect(() => {
    const node = ref.current;
    if (stage.current !== "in" || !node) return;
    stage.current = null;
    anim.current?.stop();
    anim.current = animate(node, { opacity: [0, 1] }, { duration: .16, ease: enterEase });
  }, [shown.text]);

  useEffect(() => () => anim.current?.stop(), []);

  const visible = reduced ? seg : shown;
  return <span ref={ref} className={cx(styles.segment, block && styles.line)}>
    {lead && visible.text ? " " : null}
    {runsOf(visible.text, visible.added).map((run, index) => run.added
      ? <mark key={index} className={styles.ins}>{run.text}</mark>
      : <span key={index}>{run.text}</span>)}
  </span>;
}

function Paragraphs({ doc, flags, reduced }: { doc: ToneDoc; flags?: boolean[][][]; reduced: boolean }) {
  return <>{doc.map((paragraph, p) => <p key={p} className={styles.paragraph}>
    {paragraph.segments.map((text, s) => flags
      ? <SegmentSlot key={s} text={text} added={flags[p]?.[s]} lead={!paragraph.lines && s > 0} block={paragraph.lines} reduced={reduced} />
      : <span key={s} className={paragraph.lines ? styles.line : undefined}>{!paragraph.lines && s > 0 && text ? " " : null}{text}</span>)}
  </p>)}</>;
}

/** Keeps the segment object stable while its text and flags are unchanged, so a parent render never restarts a fade. */
function SegmentSlot({ text, added = [], lead, block, reduced }: { text: string; added?: boolean[]; lead: boolean; block?: boolean; reduced: boolean }) {
  const key = added.map(flag => flag ? 1 : 0).join("");
  const seg = useMemo(() => ({ text, added: key.split("").map(flag => flag === "1") }), [text, key]);
  return <Segment seg={seg} lead={lead} block={block} reduced={reduced} />;
}

/** Eases the text area to its new height when the reserved space changes (a slider move). Width changes cut. */
function useAutoHeight(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = outer.current, content = inner.current;
    if (!box || !content || typeof ResizeObserver === "undefined") return;
    let height = content.offsetHeight, width = content.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const release = () => { box.style.height = ""; box.style.overflow = ""; controls = undefined; };
    const observer = new ResizeObserver(() => {
      const nextHeight = content.offsetHeight, nextWidth = content.offsetWidth;
      const resized = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? box.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || resized) { release(); return; }
      box.style.overflow = "hidden";
      controls = animate(box, { height: [from, nextHeight] }, { ...motionTokens.spring.smooth, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

function Crossfade({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.fadeStack, className)}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.fadeItem} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : .16, ease: enterEase } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease: exitEase } }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/**
 * Rewrites a message in a brand voice. Two sliders (formality and detail) and voice chips drive a debounced rewrite;
 * each changed sentence crossfades in place, words that differ from the original can be highlighted, and Copy takes
 * the current version. With no props it tunes a sample billing reply and the rewrites are simulated.
 */
export function ToneTuner({
  value, defaultValue = toneOriginal, onValueChange, text, rewrite, onRewrite, onCopy, recipient = sampleRecipient, model = "Claude Sonnet 5.5",
  presets = tonePresets, debounceMs = 220, showChanges: showChangesProp, defaultShowChanges = true, onShowChangesChange, autoPlay, className,
}: ToneTunerProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const custom = Boolean(rewrite);
  const [settingsState, setSettingsState] = useState(defaultValue);
  const settings = value ?? settingsState;
  const { formality, detail, voice } = settings;
  const key = `${formality}${detail}${voice}`;

  const original = useMemo(() => custom ? parseDoc(text ?? "") : sampleDoc(toneOriginal), [custom, text]);
  const empty = original.length === 0;
  const [doc, setDoc] = useState<ToneDoc>(() => custom ? original : sampleDoc(settings));
  const [applied, setApplied] = useState(settings);
  const [phase, setPhase] = useState<Phase>(() => custom || sameSettings(settings, toneOriginal) ? "idle" : "done");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [seenKey, setSeenKey] = useState(key);
  // A new tone reads as "Rewriting" on the same frame, before the debounce runs out.
  if (key !== seenKey) { setSeenKey(key); if (!empty) setPhase("rewriting"); }

  const [showState, setShowState] = useState(defaultShowChanges);
  const showChanges = showChangesProp ?? showState;
  const setShowChanges = (next: boolean) => { if (showChangesProp === undefined) setShowState(next); onShowChangesChange?.(next); };

  const live = useRef({ rewrite, onRewrite, original, settings, custom });
  useEffect(() => { live.current = { rewrite, onRewrite, original, settings, custom }; });

  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    if (empty) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const { rewrite: run, onRewrite: landed, original: source, settings: next } = live.current;
      try {
        let result: ToneDoc;
        if (run) {
          const sourceText = docText(source);
          result = parseDoc(await run({ ...next, text: sourceText, instructions: instructionsFor(next) }, controller.signal));
        } else {
          await wait(SIMULATED_LATENCY, controller.signal);
          result = sampleDoc(next);
        }
        if (controller.signal.aborted) return;
        setDoc(result);
        setApplied(next);
        setPhase(run ? (docText(result) === docText(source) ? "idle" : "done") : sameSettings(next, toneOriginal) ? "idle" : "done");
        landed?.(docText(result), next);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error && reason.message ? reason.message : "The model did not respond.");
        setPhase("error");
      }
    }, debounceMs);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [key, attempt, debounceMs, empty]);

  const update = (next: ToneSettings) => { if (value === undefined) setSettingsState(next); onValueChange?.(next); };

  /* The tour runs only while the card is on screen, and stops for good at the first pointer press or focus inside it. */
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(autoPlay ?? (!custom && value === undefined));
  const [onScreen, setOnScreen] = useState(false);
  const step = useRef(0);
  useEffect(() => {
    const node = rootRef.current;
    if (!playing || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), { threshold: .4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [playing]);
  const updateRef = useRef(update);
  useEffect(() => { updateRef.current = update; });
  useEffect(() => {
    if (!playing || !onScreen || reduced || empty) return;
    let timer = 0;
    const tick = () => {
      updateRef.current(TOUR[step.current % TOUR.length]);
      step.current += 1;
      timer = window.setTimeout(tick, 2600);
    };
    timer = window.setTimeout(tick, step.current === 0 ? 1400 : 2600);
    return () => window.clearTimeout(timer);
  }, [playing, onScreen, reduced, empty]);
  const stopTour = () => { if (playing) setPlaying(false); };

  const flags = useMemo(() => diffDoc(original, doc), [original, doc]);
  const changed = flags.flat(2).filter(Boolean).length;
  const plain = docText(doc);
  const count = wordCount(doc);
  const sizer = custom ? (docText(doc).length > docText(original).length ? doc : original) : sampleTallest[applied.formality][applied.detail];
  const { outer, inner } = useAutoHeight(reduced);

  const status = phase === "rewriting" ? { icon: "claude", label: `Rewriting with ${model}` }
    : phase === "error" ? { icon: "error", label: "Couldn't rewrite" }
    : phase === "done" ? { icon: "done", label: "Rewritten", meta: describeSettings(applied) }
    : { icon: "idle", label: empty ? "No draft yet" : "Original draft" };
  const announcement = phase === "done" ? `Rewritten: ${describeSettings(applied)}.${custom ? "" : " Simulated, nothing was sent."}`
    : phase === "error" ? `Couldn't rewrite. ${error}` : phase === "idle" && !empty ? "Showing the original draft." : "";

  return <div ref={rootRef} className={cx(styles.root, className)} data-changes={showChanges || undefined} data-phase={phase}
    onPointerDownCapture={stopTour} onFocusCapture={stopTour}>
    <div className={styles.head}>
      <Avatar name={recipient.name} src={recipient.avatar} size="md" className={styles.avatar} />
      <div className={styles.who}>
        <span className={styles.name}>{recipient.name}</span>
        {recipient.subject ? <span className={styles.subject}>{recipient.subject}</span> : null}
      </div>
      <div className={styles.counts} aria-hidden="true">
        <span className={styles.changed} data-on={showChanges && changed > 0 ? "" : undefined}>
          <i className={styles.swatch} /><span className={styles.num}>{changed}</span> changed
        </span>
        <span><span className={styles.num}>{count}</span> words</span>
      </div>
    </div>

    <div ref={outer} className={styles.bodyClip}>
      <div ref={inner} className={styles.body}>
        {empty ? <p className={styles.empty}>Add a draft to tune its tone.</p> : <div className={styles.stack}>
          <div className={styles.sizer} aria-hidden="true"><Paragraphs doc={sizer} reduced={reduced} /></div>
          <div className={styles.text} id={`${id}-text`} aria-label="Message"><Paragraphs doc={doc} flags={flags} reduced={reduced} /></div>
        </div>}
      </div>
    </div>

    <div className={styles.controls}>
      <div className={styles.presets} role="group" aria-label="Voice">
        {presets.map(preset => {
          const Icon = presetIcons[preset.voice];
          const active = voice === preset.voice;
          return <button key={preset.voice} type="button" className={styles.chip} aria-pressed={active} disabled={empty}
            onClick={() => update(active ? { ...settings, voice: "neutral" } : { voice: preset.voice, formality: preset.formality, detail: preset.detail })}>
            <Icon size={14} strokeWidth={1.75} className={styles.chipIcon} aria-hidden="true" />
            <span className={styles.chipLabel}>{preset.label}</span>
          </button>;
        })}
      </div>
      <div className={styles.sliders}>
        <Slider label="Formality" value={formality} min={0} max={2} step={1} showValue={false} disabled={empty}
          marks={formalityLabels.map((label, index) => ({ value: index, label }))} format={index => formalityLabels[index] ?? ""}
          onValueChange={next => update({ ...settings, formality: next as ToneLevel })} />
        <Slider label="Detail" value={detail} min={0} max={2} step={1} showValue={false} disabled={empty}
          marks={detailLabels.map((label, index) => ({ value: index, label }))} format={index => detailLabels[index] ?? ""}
          onValueChange={next => update({ ...settings, detail: next as ToneLevel })} />
      </div>
    </div>

    <div className={styles.foot}>
      <div className={styles.status} data-icon={status.icon}>
        <Crossfade id={status.icon} className={styles.statusIcon} reduced={reduced}>
          {status.icon === "claude" ? <ClaudeMark width={14} height={14} className={styles.claude} title="" aria-hidden="true" />
            : status.icon === "done" ? <Check size={14} strokeWidth={2} />
            : status.icon === "error" ? <CircleAlert size={14} strokeWidth={1.75} />
            : <PenLine size={14} strokeWidth={1.75} />}
        </Crossfade>
        <Crossfade id={`${status.label}${status.meta ?? ""}`} className={styles.statusText} reduced={reduced}>
          {status.icon === "claude" ? <TextShimmer className={styles.statusLabel}>{status.label}</TextShimmer>
            : <span className={styles.statusLabel}>{status.label}{status.meta ? <span className={styles.statusMeta}>{status.meta}</span> : null}</span>}
        </Crossfade>
        {phase === "error" ? <button type="button" className={styles.retry} onClick={() => { setPhase("rewriting"); setAttempt(n => n + 1); }}>
          <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry
        </button> : null}
      </div>
      <div className={styles.actions}>
        <Switch label="Changes" aria-label="Highlight changes" checked={showChanges} onCheckedChange={setShowChanges} disabled={empty} className={styles.switch} />
        <CopyButton value={plain} label="Copy" disabled={empty} onCopied={() => onCopy?.(plain)} />
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </div>;
}

export default ToneTuner;
