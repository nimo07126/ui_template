"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { ArrowUp, Check, CircleAlert, Mic, MicOff, RotateCcw, X } from "lucide-react";
import { Kbd } from "../kbd/kbd";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { ClaudeMark } from "./dictation-button-marks";
import { isSimulatedRecognizer } from "./dictation-button-recognizer";
import type { DictationErrorCode, DictationRecognizer, DictationTranscript } from "./dictation-button-recognizer";
import { useDictation } from "./use-dictation";
import type { Dictation, DictationStatus, UseDictationOptions } from "./use-dictation";
import styles from "./dictation-button.module.css";

export { DictationError, createSimulatedRecognizer, dictationScripts, isSimulatedRecognizer } from "./dictation-button-recognizer";
export type { DictationErrorCode, DictationHandlers, DictationPhrase, DictationRecognizer, DictationSession, DictationTranscript, SimulatedRecognizerOptions } from "./dictation-button-recognizer";
export { createWebSpeechRecognizer } from "./dictation-button-web-speech";
export type { WebSpeechRecognizerOptions } from "./dictation-button-web-speech";
export { useDictation } from "./use-dictation";
export type { Dictation, DictationStatus, UseDictationOptions } from "./use-dictation";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
/** Every size change: critically damped, a quarter second, no overshoot. */
const SPRING = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const EASE_ENTER = [0.16, 1, 0.3, 1] as const;
const WIDTH = { idle: 36, active: 216, retry: 116 } as const;
/** Waveform geometry in px: bar width, gap, and the height range (a round dot at rest, the track height at full level). */
const BAR_WIDTH = 3, BAR_GAP = 2, BAR_MIN = 3, BAR_MAX = 20;
/** One new level sample every 60ms. */
const TICK = 60;
/** A fixed bar profile for reduced motion: levels still answer the voice, but nothing travels. */
const envelope = (i: number) => 0.35 + 0.65 * Math.abs(Math.sin(i * 1.7 + 0.6));

const split = (text: string) => text.split(/\s+/).filter(Boolean);
const joinText = (base: string, text: string) => !base ? text : /\s$/.test(base) ? base + text : `${base} ${text}`;
/**
 * Keys each word by its text and how many times that text came before it. When the recognizer corrects a guess
 * ("cue for" becomes "Q4"), only the changed words remount and fade in; every word after the correction keeps its
 * element, so nothing blinks. An interim word that settles keeps its key and only changes color.
 */
function keyWords(list: { word: string; final: boolean }[]) {
  const seen = new Map<string, number>();
  return list.map(item => {
    const n = seen.get(item.word) ?? 0;
    seen.set(item.word, n + 1);
    return { ...item, key: `${item.word}#${n}` };
  });
}
const clock = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

const errorCopy: Record<DictationErrorCode, { wide: string; narrow: string; live: string }> = {
  "not-allowed": { wide: "Microphone blocked in site settings", narrow: "Blocked", live: "Microphone access is blocked. Allow it in your browser's site settings, then try again." },
  "no-speech": { wide: "Didn't catch that", narrow: "No speech", live: "No speech was detected. Try again." },
  "audio-capture": { wide: "No microphone found", narrow: "No mic", live: "No microphone was found." },
  network: { wide: "Recognition is offline", narrow: "Offline", live: "Speech recognition could not reach its service." },
  unsupported: { wide: "Dictation isn't supported here", narrow: "Unsupported", live: "This browser does not support dictation." },
  aborted: { wide: "Dictation stopped", narrow: "Stopped", live: "Dictation stopped." },
};

function statusLine(status: DictationStatus, error: DictationErrorCode | null, simulated: boolean) {
  if (status === "starting" || status === "listening") return simulated ? "Listening. Simulated microphone, nothing is recorded." : "Listening";
  if (status === "processing") return "Transcribing";
  if (status === "denied" || status === "error") return errorCopy[error ?? "aborted"].live;
  return "";
}

/** Pauses loops while the element is off screen. */
function useOnScreen(ref: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") { setVisible(true); return; }
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "48px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return visible;
}

/** Springs the field to the height of its content as lines arrive, so the toolbar glides down instead of jumping. Width changes cut straight to the new height. */
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
      controls = animate(box, { height: [from, nextHeight] }, { ...SPRING, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

/**
 * Scrolling level meter. As many 3px bars as fit the track with an even 2px gap, so no bar is ever clipped. A new
 * sample enters on the right every 60ms; every frame, each bar eases exponentially toward its sample, so heights glide
 * instead of stepping and the wave never jitters. Written straight to the DOM, no React renders while it runs. When
 * listening stops, the bars settle in place to dots rather than scrolling away.
 */
function Waveform({ levelRef, active, reduced }: { levelRef: RefObject<number>; active: boolean; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [count, setCount] = useState(16);
  const samples = useRef<number[]>([]);
  const shown = useRef<number[]>([]);
  const smooth = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setCount(Math.max(4, Math.floor((width + BAR_GAP) / (BAR_WIDTH + BAR_GAP))));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const bars = Array.from(root.children) as HTMLElement[];
    const n = bars.length;
    // Resize the buffers to the bar count, keeping the newest samples on the right.
    for (const buffer of [samples.current, shown.current]) {
      while (buffer.length < n) buffer.unshift(0);
      if (buffer.length > n) buffer.splice(0, buffer.length - n);
    }
    const s = samples.current, d = shown.current;
    // A gentle power curve keeps loud syllables from pinning every bar at full height, so the wave keeps its shape.
    const paint = (i: number) => { bars[i].style.height = `${(BAR_MIN + Math.pow(d[i], 1.35) * (BAR_MAX - BAR_MIN)).toFixed(2)}px`; };
    for (let i = 0; i < n; i++) paint(i);

    let visible = true, raf = 0, last = 0, acc = 0;
    const observer = typeof IntersectionObserver === "undefined" ? undefined : new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) { last = 0; raf = requestAnimationFrame(frame); }
    });
    const frame = (now: number) => {
      raf = 0;
      if (!visible) { last = 0; return; }
      if (document.hidden) { last = 0; raf = requestAnimationFrame(frame); return; }
      const dt = last ? Math.min(64, now - last) : 16;
      last = now;
      acc += dt;
      while (acc >= TICK) {
        acc -= TICK;
        const target = active ? levelRef.current ?? 0 : 0;
        smooth.current += (target - smooth.current) * (target > smooth.current ? 0.55 : 0.3);
        if (!active) for (let i = 0; i < n; i++) s[i] *= 0.6;
        else if (reduced) for (let i = 0; i < n; i++) s[i] = smooth.current * envelope(i);
        else { s.shift(); s.push(smooth.current); }
      }
      const k = 1 - Math.exp(-dt / 55);
      let moving = false;
      for (let i = 0; i < n; i++) {
        const next = d[i] + (s[i] - d[i]) * k;
        if (Math.abs(next - d[i]) > 0.0005) { d[i] = next; paint(i); }
        if (s[i] > 0.002 || d[i] > 0.002) moving = true;
      }
      if (!active && !moving) return;
      raf = requestAnimationFrame(frame);
    };
    observer?.observe(root);
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); observer?.disconnect(); };
  }, [active, reduced, levelRef, count]);

  return <span ref={ref} className={styles.wave} aria-hidden="true">
    {Array.from({ length: count }, (_, i) => <span key={i} />)}
  </span>;
}

/** Elapsed time, written to the DOM four times a second; tabular numerals in a reserved width, so nothing shifts. */
function Elapsed({ startedAt, running }: { startedAt: number | null; running: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || startedAt === null) return;
    const paint = () => { node.textContent = clock(performance.now() - startedAt); };
    paint();
    if (!running) return;
    const id = setInterval(paint, 250);
    return () => clearInterval(id);
  }, [startedAt, running]);
  return <span ref={ref} className={styles.time} role="timer" aria-label="Elapsed">0:00</span>;
}

function Spinner() {
  return <svg className={styles.spin} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

type PillView = keyof typeof WIDTH;

interface PillProps {
  dictation: Dictation;
  onStart: () => void;
  disabled?: boolean;
  reduced: boolean;
  label: string;
  /** Return focus to the mic after inserting. The composer sends it to the field instead. */
  refocusOnCommit: boolean;
  /** Width of the recording face. Narrow toolbars pass less; the waveform gives up bars, never the controls. */
  activeWidth?: number;
  /** Narrow toolbars: the retry face reads "Retry" so the error copy beside it keeps its room. */
  compact?: boolean;
}

/**
 * The control itself. A 36px mic that springs leftward into the recording pill: the mic's spot becomes Insert, so the
 * next action is exactly where the pointer already is. All three faces stay mounted and crossfade; only the active one
 * is focusable.
 */
function DictationPill({ dictation, onStart, disabled = false, reduced, label, refocusOnCommit, activeWidth = WIDTH.active, compact = false }: PillProps) {
  const { status, startedAt, levelRef, confirm, cancel, dismiss } = dictation;
  const view: PillView = status === "idle" ? "idle" : status === "denied" || status === "error" ? "retry" : "active";
  const processing = status === "processing";
  const [retryKind, setRetryKind] = useState<"denied" | "error">("error");
  if ((status === "denied" || status === "error") && status !== retryKind) setRetryKind(status);
  const micRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const focusNext = useRef<"follow" | "skip-idle" | null>(null);
  // The retry face is as wide as its label, measured, so the pill springs to the exact width in any font or locale.
  const [retryWidth, setRetryWidth] = useState<number>(WIDTH.retry);
  useEffect(() => {
    const node = retryRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => { if (node.offsetWidth) setRetryWidth(Math.ceil(node.offsetWidth)); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const intent = focusNext.current;
    if (!intent) return;
    if (view === "active" && intent === "skip-idle") return;
    focusNext.current = null;
    if (view === "idle" && intent === "skip-idle") return;
    (view === "idle" ? micRef : view === "active" ? confirmRef : retryRef).current?.focus({ preventScroll: true });
  }, [view]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    if (view === "active") { event.preventDefault(); focusNext.current = "follow"; cancel(); }
    else if (view === "retry") { event.preventDefault(); focusNext.current = "follow"; dismiss(); }
  };

  return <motion.div className={styles.pill} data-view={view} data-status={status} initial={false} animate={{ width: view === "active" ? activeWidth : view === "retry" ? retryWidth : WIDTH.idle }} transition={reduced ? { duration: 0 } : SPRING} onKeyDown={onKeyDown}>
    <div className={styles.layer} data-on={view === "idle" || undefined} inert={view !== "idle"} style={{ width: WIDTH.idle }}>
      <Tooltip content={label}>
        <button ref={micRef} type="button" className={styles.mic} aria-label={label} disabled={disabled} onClick={() => { focusNext.current = "follow"; onStart(); }}>
          <Mic size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </Tooltip>
    </div>

    <div className={styles.layer} data-on={view === "active" || undefined} inert={view !== "active"} style={{ width: activeWidth }}>
      <div className={styles.active}>
        <Tooltip content="Cancel">
          <button type="button" className={styles.cancel} aria-label="Cancel dictation" aria-disabled={processing || undefined} onClick={() => { if (processing) return; focusNext.current = "follow"; cancel(); }}>
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
        <Waveform levelRef={levelRef} active={status === "listening"} reduced={reduced} />
        <Elapsed startedAt={startedAt} running={status === "starting" || status === "listening"} />
        <Tooltip content={processing ? "Transcribing" : "Insert"}>
          <button ref={confirmRef} type="button" className={styles.confirm} aria-label={processing ? "Transcribing" : "Insert transcript"} aria-disabled={processing || undefined} onClick={() => { if (processing) return; focusNext.current = refocusOnCommit ? "follow" : "skip-idle"; confirm(); }}>
            <span className={styles.swap} data-on={!processing || undefined}><Check size={16} strokeWidth={2} aria-hidden="true" /></span>
            <span className={styles.swap} data-on={processing || undefined}><Spinner /></span>
          </button>
        </Tooltip>
      </div>
    </div>

    <div className={styles.layer} data-on={view === "retry" || undefined} inert={view !== "retry"}>
      <button ref={retryRef} type="button" className={styles.retry} disabled={disabled} onClick={() => { focusNext.current = "follow"; onStart(); }}>
        {retryKind === "denied" ? <MicOff size={16} strokeWidth={1.75} aria-hidden="true" /> : <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />}
        <span>{compact ? "Retry" : "Try again"}</span>
      </button>
    </div>
  </motion.div>;
}

/* ------------------------------------------------------------------------------------------------------------------ */

export interface DictationControlProps extends UseDictationOptions {
  /** Accessible name and tooltip of the mic. */
  label?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Just the mic and recording pill, for a composer you already have. Read live text from onTranscript and append the
 * final text in onCommit.
 */
export function DictationControl({ label = "Dictate", disabled, className, ...options }: DictationControlProps) {
  const reduced = useReducedMotion() ?? false;
  const dictation = useDictation(options);
  return <div className={cx(styles.control, className)}>
    <DictationPill dictation={dictation} onStart={dictation.start} disabled={disabled} reduced={reduced} label={label} refocusOnCommit />
    <span className={styles.srOnly} role="status" aria-live="polite">{statusLine(dictation.status, dictation.error, options.recognizer === undefined || isSimulatedRecognizer(options.recognizer))}</span>
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------ */

export interface DictationModel {
  name: string;
  mark?: ReactNode;
}

export interface DictationButtonProps {
  /** Field text, controlled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  /** Speech source. Defaults to a simulated recognizer; pass createWebSpeechRecognizer() or your own adapter. */
  recognizer?: DictationRecognizer;
  /** Live, cumulative transcript of the current session (final plus interim). */
  onTranscript?: (transcript: DictationTranscript) => void;
  /** Final text of a session, already appended to the field. */
  onCommit?: (text: string) => void;
  /** Send the message. Without it, sending is simulated and the field clears. */
  onSend?: (text: string) => void | Promise<void>;
  onStatusChange?: (status: DictationStatus, error?: DictationErrorCode) => void;
  /** Loop a scripted dictation until the first interaction. Defaults to true only with the simulated recognizer. */
  autoPlay?: boolean;
  /** Seconds before listening stops and inserts on its own. Defaults to 120. */
  maxDuration?: number;
  /** The model label at the start of the toolbar. Pass null to hide it. */
  model?: DictationModel | null;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
}

const defaultModel: DictationModel = { name: "Claude Sonnet 5.5", mark: <ClaudeMark className={styles.claude} aria-hidden="true" /> };

type Slot = "model" | "listening" | "processing" | "denied" | "error" | "sent";

/**
 * A composer with voice input. The mic expands into a recording pill with a live waveform, elapsed time, cancel and
 * insert; words stream into the field as they are recognized, with the recognizer's interim guesses muted until they settle.
 */
export function DictationButton({
  value: valueProp, defaultValue = "", onValueChange, placeholder = "Message Claude", recognizer, onTranscript, onCommit, onSend, onStatusChange,
  autoPlay, maxDuration = 120, model = defaultModel, disabled = false, className, "aria-label": ariaLabel = "Message",
}: DictationButtonProps) {
  const reduced = useReducedMotion() ?? false;
  const simulated = recognizer === undefined || isSimulatedRecognizer(recognizer);
  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [inner, setInner] = useState(defaultValue);
  const value = valueProp ?? inner;
  const [auto, setAuto] = useState(autoPlay ?? simulated);
  const [base, setBase] = useState("");
  const [spoken, setSpoken] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [flash, setFlash] = useState(false);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState("");
  const byUser = useRef(false);
  const focusField = useRef(false);
  const visible = useOnScreen(rootRef);
  const { outer, inner: scrollRef } = useAutoHeight(reduced);
  const barRef = useRef<HTMLDivElement>(null);
  const [barWidth, setBarWidth] = useState<number | null>(null);
  useEffect(() => {
    const bar = barRef.current;
    if (!bar || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setBarWidth(Math.round(entry.contentRect.width)));
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);
  // The toolbar keeps 8px of label inset, the send button and two gaps; the pill takes the rest, up to 216px.
  const activeWidth = barWidth === null ? WIDTH.active : Math.max(150, Math.min(WIDTH.active, barWidth - 52));

  const setValue = (next: string) => { if (valueProp === undefined) setInner(next); onValueChange?.(next); };

  const dictation = useDictation({
    recognizer, maxDuration, onTranscript, onStatusChange,
    onSpeechEnd: () => setSpoken(true),
    onCommit: text => {
      setValue(joinText(base, text));
      onCommit?.(text);
      const count = split(text).length;
      setNote(`Inserted ${count} ${count === 1 ? "word" : "words"}`);
      if (byUser.current) focusField.current = true;
      else setAutoFilled(true);
    },
    onCancel: () => setNote("Dictation cancelled, nothing was inserted"),
  });
  const { status, transcript, error } = dictation;
  const dictating = status === "starting" || status === "listening" || status === "processing";
  const canSend = Boolean(value.trim()) && !dictating && !sending && !disabled;

  const begin = (user: boolean) => {
    if (disabled) return;
    byUser.current = user;
    if (user) setAuto(false);
    setBase(value);
    setSpoken(false);
    setFlash(false);
    setNote("");
    dictation.start();
  };

  const send = async () => {
    const text = value.trim();
    if (!text || dictating || sending || disabled) return;
    setAutoFilled(false);
    if (onSend) {
      setSending(true);
      try { await onSend(text); setValue(""); setNote("Sent"); } finally { setSending(false); }
      return;
    }
    setValue("");
    setFlash(true);
    setNote("Sent. Simulated, nothing was sent.");
  };

  // After a dictation the person started, the caret lands at the end of the field, ready to edit or send.
  useEffect(() => {
    if (status !== "idle" || !focusField.current) return;
    focusField.current = false;
    const field = textareaRef.current;
    if (!field) return;
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
  }, [status, value]);

  useEffect(() => {
    const scroller = scrollRef.current;
    if (dictating && scroller) scroller.scrollTop = scroller.scrollHeight;
  }, [dictating, transcript, scrollRef]);

  useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(false), 1400);
    return () => clearTimeout(id);
  }, [flash]);

  // The self-playing demo: listen, insert, send, repeat. It stops for good at the first pointer, key or focus inside.
  const actions = useRef({ begin, send, confirm: dictation.confirm });
  useEffect(() => { actions.current = { begin, send, confirm: dictation.confirm }; });
  useEffect(() => {
    if (!auto || !visible || disabled) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    if (status === "idle" && autoFilled) id = setTimeout(() => void actions.current.send(), 1500);
    else if (status === "idle" && !value && !flash) id = setTimeout(() => actions.current.begin(false), 900);
    else if (status === "listening" && spoken) id = setTimeout(() => actions.current.confirm(), 450);
    return () => clearTimeout(id);
  }, [auto, visible, disabled, status, value, flash, spoken, autoFilled]);

  // The demo never moves focus itself, so any focus inside means a person arrived.
  const stopAuto = () => { if (auto) setAuto(false); };

  const onRootKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    stopAuto();
    if (event.defaultPrevented || (status !== "listening" && status !== "starting")) return;
    if (event.key === "Escape") { event.preventDefault(); dictation.cancel(); }
    else if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) { event.preventDefault(); byUser.current = true; dictation.confirm(); }
  };

  const onFieldKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); }
  };

  const slot: Slot = flash ? "sent" : status === "processing" ? "processing" : dictating ? "listening" : status === "denied" ? "denied" : status === "error" ? "error" : "model";
  const copy = errorCopy[error ?? "aborted"];
  const words = dictating ? keyWords([...split(transcript.final).map(word => ({ word, final: true })), ...split(transcript.interim).map(word => ({ word, final: false }))]) : [];
  const live = status === "idle" && note ? note : statusLine(status, error, simulated) || note;

  const slotContent = (which: Slot) => {
    if (which === "model") return model ? <>{model.mark}<span className={styles.slotText}>{model.name}</span></> : null;
    if (which === "listening") return <span className={styles.hints}><Kbd keys="enter" size="sm" /><span>Insert</span><Kbd keys="esc" size="sm" className={styles.gap} /><span>Cancel</span></span>;
    if (which === "processing") return <TextShimmer className={styles.slotText}>Transcribing</TextShimmer>;
    if (which === "sent") return <><Check size={16} strokeWidth={2} className={styles.ok} aria-hidden="true" /><span className={styles.slotText}>{onSend ? "Sent" : "Sent, simulated"}</span></>;
    return <>
      {which === "denied" ? <MicOff size={16} strokeWidth={1.75} className={styles.warn} aria-hidden="true" /> : <CircleAlert size={16} strokeWidth={1.75} className={styles.warn} aria-hidden="true" />}
      <span className={styles.slotText}><span className={styles.wide}>{copy.wide}</span><span className={styles.narrow}>{copy.narrow}</span></span>
    </>;
  };

  return <div ref={rootRef} className={cx(styles.root, className)} onPointerDown={stopAuto} onKeyDown={onRootKeyDown} onFocus={stopAuto}>
    <div className={styles.card} data-dictating={dictating || undefined} data-disabled={disabled || undefined}>
      <div ref={outer} className={styles.field}>
        <div ref={scrollRef} className={styles.scroll}>
          <div className={styles.stack} data-dictating={dictating || undefined}>
            <div className={styles.mirror} aria-hidden="true">
              {dictating ? <>
                {base}
                {base && words.length && !/\s$/.test(base) ? " " : null}
                {words.map((item, i) => <Fragment key={item.key}>{i ? " " : null}<span className={styles.word} data-interim={item.final ? undefined : ""}>{item.word}</span></Fragment>)}
                {!words.length && !base ? <span className={styles.hint}>Speak now</span> : null}
              </> : value}
              {"​"}
            </div>
            <textarea ref={textareaRef} className={styles.input} value={value} placeholder={placeholder} aria-label={ariaLabel} rows={2} disabled={disabled} readOnly={dictating} tabIndex={dictating ? -1 : undefined}
              onChange={event => { setValue(event.target.value); setAutoFilled(false); if (status === "denied" || status === "error") dictation.dismiss(); }}
              onKeyDown={onFieldKeyDown} />
          </div>
        </div>
      </div>

      <div ref={barRef} className={styles.bar}>
        <div className={styles.slot}>
          <AnimatePresence initial={false}>
            <motion.div key={slot} className={styles.slotItem}
              initial={{ opacity: 0, y: reduced ? 0 : 2 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.16, ease: EASE_ENTER, delay: 0.04 } }}
              exit={{ opacity: 0, transition: { duration: 0.1 } }}>
              {slotContent(slot)}
            </motion.div>
          </AnimatePresence>
        </div>
        <DictationPill dictation={dictation} onStart={() => begin(true)} disabled={disabled} reduced={reduced} label="Dictate" refocusOnCommit={false} activeWidth={activeWidth} compact={barWidth !== null && barWidth < 300} />
        <button type="button" className={styles.send} aria-label="Send message" disabled={!canSend} onClick={() => void send()}>
          {sending ? <Spinner /> : <ArrowUp size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{live}</span>
  </div>;
}

export default DictationButton;
