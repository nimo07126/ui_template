"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { AtSign, CircleAlert, CircleCheck, CreditCard, Phone, RotateCcw, ScanText, SendHorizontal, ShieldCheck, Square, UserRound } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { Switch } from "../../switch/switch";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import { avatar } from "../lib/media";
import { ClaudeMark } from "./pii-redaction-marks";
import { detectPii, piiLabels, piiSampleMessage, piiSampleNames, piiSampleReply, piiTypes, placeholderPattern, redactPii, restorePii, simulatedReply } from "./pii-redaction-data";
import type { PiiEntity, PiiEntityType, PiiMatch, PiiRedactionResult } from "./pii-redaction-data";
import styles from "./pii-redaction.module.css";

export type { PiiEntity, PiiEntityType, PiiMatch, PiiRedactionResult } from "./pii-redaction-data";
export { detectPii, piiSampleMessage, piiSampleReply, redactPii, restorePii } from "./pii-redaction-data";

export type PiiRedactionPhase = "idle" | "scanning" | "redacted" | "sending" | "thinking" | "streaming" | "restoring" | "done" | "error";

export interface PiiRedactionModel {
  /** Shown on the flow and above the reply, like "Claude Sonnet 5.5". */
  name: string;
  /** A 16px mark. Defaults to the Claude mark. */
  mark?: ReactNode;
}

export interface PiiRedactionProps {
  /** The message to check. Defaults to a sample support message with a name, card, email and phone number. */
  defaultMessage?: string;
  /** Lets people edit the message before a scan. Defaults to true. */
  editable?: boolean;
  /** Names the built-in detector should always flag, on top of "I'm" and "this is" introductions. */
  names?: string[];
  /** Replaces the built-in detector, for example with a call to your DLP service. Return spans of the text. */
  detect?: (text: string, signal: AbortSignal) => PiiMatch[] | Promise<PiiMatch[]>;
  /** Sends the redacted prompt to your model and resolves with its reply, placeholders included. Without it the reply is simulated. */
  send?: (prompt: string, signal: AbortSignal) => Promise<string>;
  /** The model the safe prompt goes to. Defaults to Claude Sonnet 5.5. */
  model?: PiiRedactionModel;
  /** Plays scan, send and restore on a loop while on screen, until someone interacts. Defaults to true; off with reduced motion. */
  autoPlay?: boolean;
  /** Shows the original message instead of the safe prompt once it is redacted. Pair with onShowOriginalChange. */
  showOriginal?: boolean;
  defaultShowOriginal?: boolean;
  onShowOriginalChange?: (show: boolean) => void;
  /** Called once the message is redacted, with the safe prompt and every entity. */
  onRedact?: (result: PiiRedactionResult) => void;
  /** Called with the model's raw reply and the restored reply the person sees. */
  onReply?: (reply: { raw: string; restored: string }) => void;
  /** Called on every phase change, for analytics or to sync outside UI. */
  onPhaseChange?: (phase: PiiRedactionPhase) => void;
  className?: string;
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const defaultModel: PiiRedactionModel = { name: "Claude Sonnet 5.5" };
const typeIcons: Record<PiiEntityType, typeof AtSign> = { name: UserRound, email: AtSign, phone: Phone, card: CreditCard };
const after: PiiRedactionPhase[] = ["redacted", "sending", "thinking", "streaming", "restoring", "done"];
const running: PiiRedactionPhase[] = ["scanning", "sending", "thinking", "streaming", "restoring"];

/** Resolves after `ms`, or rejects at once when the signal aborts. */
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    if (ms <= 0) return resolve();
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
    function stop() { window.clearTimeout(timer); reject(signal.reason); }
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** Three to six words per tick, so a reply streams in quick, even chunks. Whitespace stays with the word before it. */
function chunkWords(text: string) {
  const words = text.match(/\s*\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let i = 0, n = 0; i < words.length; n++) {
    const size = 3 + (n % 4);
    chunks.push(words.slice(i, i + size).join(""));
    i += size;
  }
  return chunks;
}

/** Springs the box to its content height when the content grows or shrinks; a width change cuts straight to the new height. */
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
      controls = animate(box, { height: [from, nextHeight] }, { type: "spring", visualDuration: .24, bounce: 0, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

/** A single crossfade for text and icon swaps: old out in 100ms, new in over 160ms. popLayout keeps the slot from resizing. */
function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={id} className={styles.swapItem}
        initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease: "easeOut" } }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/** Text with each `[TOKEN]` drawn as a typed placeholder chip. */
function Tokens({ text, entities }: { text: string; entities: PiiEntity[] }) {
  const types = new Map(entities.map(entity => [entity.token, entity.type]));
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(placeholderPattern)) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    const type = types.get(match[1]);
    parts.push(<span key={match.index} className={styles.token} data-type={type}>{match[0]}</span>);
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** The original text with each entity marked. Marks pad outward with matching negative margins, so lines wrap exactly like plain text. */
function Marked({ text, entities, hits, label }: { text: string; entities: PiiEntity[]; hits: number; label?: (entity: PiiEntity) => string }) {
  const parts: ReactNode[] = [];
  let cursor = 0;
  entities.forEach((entity, index) => {
    if (entity.start > cursor) parts.push(text.slice(cursor, entity.start));
    parts.push(<mark key={entity.start} className={styles.mark} data-type={entity.type} data-hit={index < hits || undefined} aria-label={label?.(entity)}>{text.slice(entity.start, entity.end)}</mark>);
    cursor = entity.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** The reply as the person sees it: placeholders swapped back for their values, each one softly marked. */
function Restored({ raw, entities }: { raw: string; entities: PiiEntity[] }) {
  const byToken = new Map(entities.map(entity => [entity.token, entity]));
  const parts: ReactNode[] = [];
  let cursor = 0;
  for (const match of raw.matchAll(placeholderPattern)) {
    const entity = byToken.get(match[1]);
    if (match.index > cursor) parts.push(raw.slice(cursor, match.index));
    parts.push(entity ? <mark key={match.index} className={styles.mark} data-type={entity.type} data-hit="">{entity.value}</mark> : match[0]);
    cursor = match.index + match[0].length;
  }
  if (cursor < raw.length) parts.push(raw.slice(cursor));
  return <>{parts}</>;
}

/** One leg of the flow. A dot travels it once per pulse, forward or back. */
function Leg({ pulse, active, reduced }: { pulse: { dir: 1 | -1; key: number } | null; active: boolean; reduced: boolean }) {
  return <span className={styles.leg} data-active={active || undefined} aria-hidden="true">
    <span className={styles.legLine} />
    {pulse && !reduced ? <motion.span key={pulse.key} className={styles.legTrack}
      initial={{ x: pulse.dir > 0 ? "0%" : "100%" }} animate={{ x: pulse.dir > 0 ? "100%" : "0%" }} transition={{ duration: .46, ease: [...motionTokens.ease.inOut] }}>
      <motion.span className={styles.dot} initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: .46, times: [0, .12, .86, 1], ease: "linear" }} />
    </motion.span> : null}
  </span>;
}

/**
 * A guardrail that redacts personal data before a prompt reaches the model. Scan marks each name, email, phone number
 * and card with its type, swaps it for a placeholder like [EMAIL_1], sends the safe prompt, and restores the values in
 * the reply. With no props it plays a simulated support conversation on a loop.
 */
export function PiiRedaction({
  defaultMessage = piiSampleMessage, editable = true, names = piiSampleNames, detect, send, model = defaultModel, autoPlay = true,
  showOriginal: showOriginalProp, defaultShowOriginal = false, onShowOriginalChange, onRedact, onReply, onPhaseChange, className,
}: PiiRedactionProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const controller = useRef<AbortController | null>(null);
  const pulseKey = useRef(0);

  const [text, setText] = useState(defaultMessage);
  const [phase, setPhaseState] = useState<PiiRedactionPhase>("idle");
  const [result, setResult] = useState<(PiiRedactionResult & { source: string }) | null>(null);
  const [hits, setHits] = useState(0);
  const [reply, setReply] = useState<{ raw: string; restored: string } | null>(null);
  const [streamed, setStreamed] = useState(0);
  const [pulse, setPulse] = useState<{ leg: 0 | 1; dir: 1 | -1; key: number } | null>(null);
  const [error, setError] = useState<{ at: "scan" | "send"; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [auto, setAuto] = useState(autoPlay);
  const [inView, setInView] = useState(false);
  const [showOriginalState, setShowOriginalState] = useState(defaultShowOriginal);
  const showOriginal = showOriginalProp ?? showOriginalState;

  const live = result && result.source === text ? result : null;
  const redacted = !!live && (after.includes(phase) || (phase === "error" && error?.at === "send"));
  const busy = running.includes(phase);
  const modelShort = model.name.split(" ")[0] || "the model";
  const markNode = model.mark ?? <ClaudeMark width={16} height={16} title="" aria-hidden="true" className={styles.claude} />;
  const count = live?.entities.length ?? 0;

  const setPhase = (next: PiiRedactionPhase) => { setPhaseState(next); onPhaseChange?.(next); };
  const pulseOn = (leg: 0 | 1, dir: 1 | -1) => setPulse({ leg, dir, key: ++pulseKey.current });
  const begin = () => { controller.current?.abort(); const next = new AbortController(); controller.current = next; return next.signal; };
  const failed = (at: "scan" | "send", cause: unknown, signal: AbortSignal) => {
    if (signal.aborted) return;
    setError({ at, message: cause instanceof Error && cause.message ? cause.message : at === "scan" ? "The scan failed" : "The model did not answer" });
    setPhase("error");
    setAuto(false);
  };

  // The reply area reserves the sample reply's height up front, so the card never grows while the demo plays.
  const sampleSizer = useMemo(() => {
    if (send || defaultMessage !== piiSampleMessage) return null;
    const sample = redactPii(piiSampleMessage, detectPii(piiSampleMessage, { names: piiSampleNames }));
    return { raw: piiSampleReply, entities: sample.entities };
  }, [send, defaultMessage]);
  const chunks = useMemo(() => chunkWords(reply?.raw ?? ""), [reply]);

  async function scan() {
    const signal = begin();
    const source = text;
    setNotice(""); setError(null); setHits(0); setStreamed(0); setReply(null);
    setPhase("scanning");
    pulseOn(0, 1);
    try {
      const [matches] = await Promise.all([
        Promise.resolve(detect ? detect(source, signal) : detectPii(source, { names })),
        wait(reduced ? 0 : 380, signal),
      ]);
      const next = { ...redactPii(source, matches), source };
      setResult(next);
      for (let index = 1; index <= next.entities.length; index++) {
        setHits(index);
        await wait(reduced ? 0 : 120, signal);
      }
      await wait(reduced ? 0 : 200, signal);
      setPhase("redacted");
      onRedact?.({ prompt: next.prompt, entities: next.entities });
    } catch (cause) { failed("scan", cause, signal); }
  }

  async function deliver() {
    if (!live) return;
    const signal = begin();
    setNotice(""); setError(null); setStreamed(0); setReply(null);
    setPhase("sending");
    pulseOn(1, 1);
    try {
      await wait(reduced ? 0 : 460, signal);
      setPhase("thinking");
      const raw = send ? await send(live.prompt, signal) : (await wait(reduced ? 0 : 700, signal), simulatedReply(live.prompt, live.entities));
      if (signal.aborted) return;
      const restored = restorePii(raw, live.entities);
      const parts = chunkWords(raw);
      setReply({ raw, restored });
      setPhase("streaming");
      pulseOn(1, -1);
      if (reduced) setStreamed(parts.length);
      else for (let index = 1; index <= parts.length; index++) { setStreamed(index); await wait(34, signal); }
      await wait(reduced ? 0 : 240, signal);
      setPhase("restoring");
      pulseOn(0, -1);
      await wait(reduced ? 0 : 460, signal);
      setPhase("done");
      onReply?.({ raw, restored });
    } catch (cause) { failed("send", cause, signal); }
  }

  function reset(focus: boolean) {
    controller.current?.abort();
    setHits(0); setError(null); setNotice(""); setPulse(null);
    setPhase("idle");
    if (focus && editable) requestAnimationFrame(() => field.current?.focus());
  }

  function stop() {
    controller.current?.abort();
    setPulse(null);
    if (phase === "scanning") { setHits(0); setPhase("idle"); setNotice("Scan stopped"); }
    else { setPhase("redacted"); setNotice("Stopped. No reply was shown"); }
  }

  // Autoplay reads the latest handlers through a ref, so its timers never restart on unrelated renders.
  const actions = useRef({ scan, deliver, reset });
  useLayoutEffect(() => { actions.current = { scan, deliver, reset }; });

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!auto || !inView || reduced) return;
    const delay = phase === "idle" ? 900 : phase === "redacted" ? 620 : phase === "done" ? 2800 : 0;
    if (!delay) return;
    const timer = window.setTimeout(() => {
      if (phase === "idle") void actions.current.scan();
      else if (phase === "redacted") void actions.current.deliver();
      else actions.current.reset(false);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [auto, inView, reduced, phase]);

  useEffect(() => () => controller.current?.abort(), []);

  const takeOver = () => setAuto(false);
  const setShowOriginal = (next: boolean) => { takeOver(); if (showOriginalProp === undefined) setShowOriginalState(next); onShowOriginalChange?.(next); };

  const primaryAction = phase === "idle" ? { key: "scan", label: "Scan", icon: <ScanText size={16} strokeWidth={1.75} aria-hidden="true" />, accent: true, disabled: !text.trim() }
    : busy ? { key: "stop", label: "Stop", icon: <Square size={12} strokeWidth={2} fill="currentColor" aria-hidden="true" />, accent: false, disabled: false }
    : phase === "redacted" ? { key: "send", label: "Send", icon: <SendHorizontal size={16} strokeWidth={1.75} aria-hidden="true" />, accent: true, disabled: false }
    : phase === "error" ? { key: "retry", label: "Retry", icon: <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />, accent: true, disabled: false }
    : { key: "again", label: "Run again", icon: <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />, accent: false, disabled: false };
  const runPrimary = () => {
    takeOver();
    if (phase === "idle" || phase === "done") void scan();
    else if (busy) stop();
    else if (phase === "redacted") void deliver();
    else if (phase === "error") void (error?.at === "send" && live ? deliver() : scan());
  };
  const showReset = phase === "redacted" || phase === "done" || phase === "error";

  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const status: { key: string; icon: ReactNode; label: string; tone?: "success" | "danger"; shimmer?: boolean } =
    phase === "scanning" ? { key: "scanning", icon: <Spinner />, label: "Scanning for personal data", shimmer: true }
    : phase === "redacted" ? notice ? { key: "stopped", icon: <CircleAlert size={16} strokeWidth={1.75} />, label: notice } : { key: "redacted", icon: <CircleCheck size={16} strokeWidth={1.75} />, label: count ? `${plural(count, "item")} redacted` : "No personal data found", tone: "success" }
    : phase === "sending" ? { key: "sending", icon: <Spinner />, label: "Sending the safe prompt", shimmer: true }
    : phase === "thinking" ? { key: "thinking", icon: <Spinner />, label: `Waiting for ${modelShort}`, shimmer: true }
    : phase === "streaming" ? { key: "streaming", icon: <Spinner />, label: "Receiving the reply", shimmer: true }
    : phase === "restoring" ? { key: "restoring", icon: <Spinner />, label: "Restoring your details", shimmer: true }
    : phase === "done" ? { key: "done", icon: <CircleCheck size={16} strokeWidth={1.75} />, label: count ? "Reply restored" : "Reply received", tone: "success" }
    : phase === "error" ? { key: "error", icon: <CircleAlert size={16} strokeWidth={1.75} />, label: error?.message || "Something went wrong", tone: "danger" }
    : notice ? { key: "notice", icon: <CircleAlert size={16} strokeWidth={1.75} />, label: notice }
    : { key: "idle", icon: <ShieldCheck size={16} strokeWidth={1.75} />, label: text.trim() ? "Ready to scan" : "Add a message to scan" };
  const simulated = !send && (phase === "done" || phase === "streaming" || phase === "restoring");
  const announcement = `${status.label}.${simulated ? " Simulated, nothing was sent." : ""}`;

  const messageLabel = redacted ? showOriginal ? "Original message" : "Safe prompt" : "Message";
  const originalVisible = !redacted || showOriginal;
  const describeEntity = (entity: PiiEntity) => `${piiLabels[entity.type]}, redacted as ${entity.token}`;

  const replyState = phase === "streaming" ? "stream" : phase === "restoring" || phase === "done" ? "restored" : "empty";
  const sizer = reply ? { raw: reply.raw, entities: live?.entities ?? [] } : sampleSizer;
  const { outer, inner } = useAutoHeight(reduced);

  const guardActive = phase === "scanning" || phase === "restoring";
  const modelActive = phase === "thinking" || phase === "streaming";

  return <div ref={root} className={cx(styles.root, className)} data-phase={phase}>
    <section className={styles.section} aria-label={messageLabel}>
      <div className={styles.head}>
        <Swap id={messageLabel} reduced={reduced} className={styles.label}><span aria-hidden="true">{messageLabel}</span></Swap>
        <span className={styles.toggle}>
          <label htmlFor={`${id}-original`} className={styles.toggleLabel} data-disabled={!redacted || undefined}>Show original</label>
          <Switch id={`${id}-original`} className={styles.switch} checked={showOriginal} disabled={!redacted} onCheckedChange={setShowOriginal} />
        </span>
      </div>
      <div className={styles.well}>
        <div className={styles.stack}>
          <p className={styles.layer} data-on={originalVisible || undefined} data-editing={phase === "idle" && editable || undefined} aria-hidden={!originalVisible || (phase === "idle" && editable) || undefined}>
            {live ? <Marked text={text} entities={live.entities} hits={phase === "idle" ? 0 : redacted ? count : hits} label={describeEntity} /> : text}
            {"​"}
          </p>
          {live ? <p className={styles.layer} data-on={!originalVisible || undefined} aria-hidden={originalVisible || undefined}>
            <Tokens text={live.prompt} entities={live.entities} />
          </p> : null}
          {phase === "idle" && editable ? <textarea ref={field} className={styles.field} value={text} spellCheck={false} rows={1}
            aria-label="Message to check for personal data" placeholder="Paste a message with a name, email, phone number or card"
            onChange={event => { takeOver(); setText(event.target.value); setNotice(""); }}
            onFocus={takeOver}
            onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && text.trim()) { event.preventDefault(); void scan(); requestAnimationFrame(() => primary.current?.focus()); } }} /> : null}
        </div>
      </div>
      <ul className={styles.types} aria-label="Detected entities">
        {piiTypes.map(type => {
          const Icon = typeIcons[type];
          const found = live ? live.entities.filter((entity, index) => entity.type === type && (redacted || index < hits)) : [];
          const tokens = [...new Set(found.map(entity => entity.token))];
          const scanned = redacted || (phase === "scanning" && !!live && hits >= live.entities.length);
          const state = phase === "idle" || (!live && phase !== "scanning") ? "idle" : tokens.length ? "found" : scanned ? "none" : phase === "scanning" ? "checking" : "idle";
          const detail = state === "found" ? `[${tokens[0]}]${tokens.length > 1 ? ` +${tokens.length - 1}` : ""}` : state === "none" ? "None found" : state === "checking" ? "Checking" : "Not scanned";
          return <li key={type} className={styles.type} data-type={type} data-state={state}>
            <Icon size={14} strokeWidth={1.75} className={styles.typeIcon} aria-hidden="true" />
            <span className={styles.typeLabel}>{piiLabels[type]}</span>
            <Swap id={`${state}:${detail}`} reduced={reduced} className={styles.typeDetail}>
              {state === "checking" ? <TextShimmer>{detail}</TextShimmer> : <span className={state === "found" ? styles.typeToken : undefined}>{detail}</span>}
            </Swap>
          </li>;
        })}
      </ul>
    </section>

    <div className={styles.flow} aria-hidden="true">
      <span className={styles.node} data-active={phase === "done" || undefined}>
        <Avatar name="Sofia Ramirez" src={avatar("sofia-ramirez")} size="sm" className={styles.avatar} />
        <span className={styles.nodeLabel}>You</span>
      </span>
      <Leg pulse={pulse?.leg === 0 ? pulse : null} active={phase === "scanning" || phase === "restoring"} reduced={reduced} />
      <span className={styles.node} data-active={guardActive || undefined}>
        <ShieldCheck size={16} strokeWidth={1.75} className={styles.guardIcon} data-on={redacted || undefined} />
        <TextShimmer active={guardActive} className={styles.nodeLabel}>PII guard</TextShimmer>
      </span>
      <Leg pulse={pulse?.leg === 1 ? pulse : null} active={phase === "sending" || phase === "streaming"} reduced={reduced} />
      <span className={styles.node} data-active={modelActive || undefined}>
        <span className={styles.nodeMark}>{markNode}</span>
        <TextShimmer active={modelActive} className={cx(styles.nodeLabel, styles.modelName)}>{model.name}</TextShimmer>
      </span>
    </div>

    <section className={styles.section} aria-labelledby={`${id}-reply`}>
      <div className={styles.head}>
        <span className={styles.label}><span className={styles.replyMark} aria-hidden="true">{markNode}</span><span id={`${id}-reply`}>Reply from {model.name}</span></span>
        <Swap id={replyState} reduced={reduced} className={styles.replyMeta}>
          {replyState === "restored" ? <span className={styles.replyRestored}><CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />Restored</span>
            : replyState === "stream" ? <span>With placeholders</span> : <span />}
        </Swap>
      </div>
      <div ref={outer} className={styles.wellClip}>
        <div ref={inner} className={cx(styles.well, styles.replyWell)}>
          <div className={styles.stack}>
            <p className={cx(styles.layer, styles.placeholder)} data-on={replyState === "empty" || undefined} aria-hidden={replyState !== "empty" || undefined}>
              <Swap id={phase === "thinking" ? "thinking" : phase === "error" && error?.at === "send" ? "error" : "empty"} reduced={reduced}>
                {phase === "thinking" ? <TextShimmer className={styles.thinking}>Thinking</TextShimmer>
                  : phase === "error" && error?.at === "send" ? <span>No reply. Nothing was shown to the person.</span>
                  : <span>The reply shows here, with your details put back.</span>}
              </Swap>
            </p>
            {reply ? <p className={styles.layer} data-on={replyState === "stream" || undefined} aria-hidden={replyState !== "stream" || undefined}>
              {chunks.slice(0, streamed).map((chunk, index) => <motion.span key={index} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .14, ease: "easeOut" }}>
                <Tokens text={chunk} entities={live?.entities ?? []} />
              </motion.span>)}
            </p> : null}
            {sizer ? <p className={styles.layer} data-on={(replyState === "restored" && !!reply) || undefined} aria-hidden={replyState !== "restored" || !reply || undefined}>
              <Restored raw={sizer.raw} entities={sizer.entities} />
            </p> : null}
          </div>
        </div>
      </div>
    </section>

    <div className={styles.footer}>
      <span className={styles.status} data-tone={status.tone}>
        <Swap id={status.key + status.label} reduced={reduced} className={styles.statusSwap}>
          <span className={styles.statusIcon} aria-hidden="true">{status.icon}</span>
          <TextShimmer active={!!status.shimmer} className={styles.statusLabel}>{status.label}</TextShimmer>
          {simulated && phase === "done" ? <span className={styles.simulated}>Simulated</span> : null}
        </Swap>
      </span>
      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
      <span className={styles.actions}>
        <AnimatePresence initial={false} mode="popLayout">
          {showReset ? <motion.span key="reset" className={styles.resetSlot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : motionTokens.duration.instant }}>
            <Button variant="ghost" size="sm" className={styles.action} onClick={() => { takeOver(); reset(true); }}>Reset</Button>
          </motion.span> : null}
        </AnimatePresence>
        <Button ref={primary} variant={primaryAction.accent ? "primary" : "secondary"} size="sm" className={cx(styles.action, primaryAction.accent && styles.accent)}
          disabled={primaryAction.disabled} onClick={runPrimary}>
          {primaryAction.icon}{primaryAction.label}
        </Button>
      </span>
    </div>
  </div>;
}

export default PiiRedaction;
