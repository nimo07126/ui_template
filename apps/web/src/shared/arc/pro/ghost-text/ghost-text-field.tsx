"use client";

import { useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, FocusEvent, KeyboardEvent, ReactNode, Ref } from "react";
import { AnimatePresence, animate, motion, useIsPresent, useMotionValue, useReducedMotion } from "motion/react";
import { Check, CircleAlert } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Kbd } from "../kbd/kbd";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import styles from "./ghost-text.module.css";

/** What suggest may return: a whole suggestion, or null to skip. Return it synchronously to skip without a loading state. */
export type GhostTextSuggestion = string | null | undefined;

/**
 * Asks your model for a continuation of text. Return a string (or a promise of one) for a whole suggestion, or an async
 * iterable of chunks to stream it in. Abort your request when signal fires: the person kept typing.
 */
export type GhostTextSuggest = (text: string, signal: AbortSignal) => GhostTextSuggestion | Promise<GhostTextSuggestion> | AsyncIterable<string>;

export type GhostTextStatus = "idle" | "loading" | "ready" | "error";
export type GhostTextAcceptMode = "all" | "word";

export interface GhostTextModel {
  /** Shown in the hint chip while idle, for example "Claude Haiku 5.5". */
  name: string;
  /** The model's mark, drawn at 12px. Give a mono mark its brand color. */
  mark?: ReactNode;
}

export interface GhostTextState {
  status: GhostTextStatus;
  /** The visible ghost text, empty when there is none. */
  suggestion: string;
  /** True while chunks are still arriving. */
  streaming: boolean;
}

export interface GhostTextHandle {
  focus: () => void;
  /** Accepts the whole suggestion, like Tab. Returns false when there was nothing to accept. */
  acceptAll: () => boolean;
  /** Accepts the next word, like Cmd+Right. */
  acceptWord: () => boolean;
  /** Dismisses the suggestion, like Escape. */
  dismiss: () => boolean;
  /** Asks for a suggestion now instead of waiting for a pause. */
  request: () => void;
  getState: () => GhostTextState;
}

export interface GhostTextProps {
  /** The text. Pair with onValueChange for a controlled field. */
  value?: string;
  /** The starting text for an uncontrolled field. */
  defaultValue?: string;
  /** Called with the new text on every edit and every accepted suggestion. */
  onValueChange?: (value: string) => void;
  /** Fetches a continuation for the text before the caret. */
  suggest?: GhostTextSuggest;
  /** Milliseconds of pause before asking for a suggestion. Defaults to 450. */
  delay?: number;
  /** Trimmed characters needed before suggestions start. Defaults to 3. */
  minLength?: number;
  /** A multi-line textarea (default) or a single-line input. */
  multiline?: boolean;
  /**
   * "field" (default) draws its own border and focus ring. "plain" drops the border, background and ring so the field can
   * sit flush inside a card you already have, such as a compose panel with a header.
   */
  variant?: "field" | "plain";
  /** Minimum visible lines for a multi-line field. Defaults to 3. */
  rows?: number;
  /** Lines before a multi-line field scrolls instead of growing. Defaults to 10. */
  maxRows?: number;
  placeholder?: string;
  /** A quiet row above the text, such as a field name. It also labels the field unless aria-label is set. */
  label?: ReactNode;
  /** Content at the start of the footer row, such as a character count or a send button. */
  footer?: ReactNode;
  /** The model behind the suggestions, shown in the hint chip. */
  model?: GhostTextModel;
  /** Shows the hint chip and key hints. Defaults to true. */
  hint?: boolean;
  /** Called with the accepted text: the whole suggestion (all) or the next word (word). */
  onAccept?: (accepted: string, mode: GhostTextAcceptMode) => void;
  /** Called with the dismissed suggestion after Escape. */
  onDismiss?: (suggestion: string) => void;
  onStatusChange?: (status: GhostTextStatus) => void;
  disabled?: boolean;
  name?: string;
  id?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  /** A one-off message for screen readers, joined to the field's own announcements. */
  notice?: string;
  className?: string;
  ref?: Ref<GhostTextHandle>;
}

/** Internal props used by the built in demo. Not part of the public API. */
export interface GhostTextFieldProps extends GhostTextProps {
  demoCaret?: "typing" | "idle" | false;
  demoFading?: boolean;
  onUserIntent?: () => void;
}

type Chunk = { id: number; text: string };
type Merge = { key: number; start: number; text: string };
type ChipState = "idle" | "loading" | "ready" | "accepted" | "error";
type Pressed = "tab" | "word" | "esc" | null;

const ease = [...motionTokens.ease.standard] as [number, number, number, number];
/** How long accepted text takes to settle from ghost ink to text ink. Matches the .merge keyframes. */
const MERGE_MS = 200;
/** How long a dismissed ghost takes to fade out. Matches the .ghostOut keyframes. */
const FADE_OUT_MS = 110;
const defaultModel: GhostTextModel = { name: "Autocomplete" };
const join = (chunks: Chunk[]) => chunks.map((chunk) => chunk.text).join("");
const nextWord = (text: string) => text.match(/^\s*\S+/)?.[0] ?? text;
const isAsyncIterable = (value: unknown): value is AsyncIterable<string> =>
  value != null && typeof value === "object" && typeof (value as AsyncIterable<string>)[Symbol.asyncIterator] === "function";

/** Drops n characters from the front, keeping chunk ids so the remaining ghost never fades in again. */
function trimFront(chunks: Chunk[], n: number): Chunk[] {
  const out: Chunk[] = [];
  let left = n;
  for (const chunk of chunks) {
    if (left >= chunk.text.length) { left -= chunk.text.length; continue; }
    out.push(left ? { ...chunk, text: chunk.text.slice(left) } : chunk);
    left = 0;
  }
  return out;
}

/**
 * Inline AI autocomplete for a textarea or input. When the person pauses, muted ghost text continues their sentence from
 * suggest(text, signal); Tab accepts it, Cmd+Right (Ctrl+Right) accepts one word, Escape dismisses it, and typing the
 * same characters keeps it in place.
 */
export function GhostTextField(props: GhostTextFieldProps) {
  const {
    value: valueProp, defaultValue = "", multiline = true, variant = "field", rows = 3, maxRows = 10, placeholder, label, footer,
    model = defaultModel, hint = true, disabled = false, name, id, autoFocus, notice, className, ref,
    demoCaret = false, demoFading = false,
  } = props;
  const ariaLabel = props["aria-label"];
  const reduced = useReducedMotion() ?? false;
  const controlled = valueProp !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const value = controlled ? valueProp : inner;

  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ghostOut, setGhostOut] = useState<{ key: number; text: string } | null>(null);
  const [merges, setMerges] = useState<Merge[]>([]);
  const [accepted, setAccepted] = useState(false);
  const [pressed, setPressed] = useState<Pressed>(null);
  const [message, setMessage] = useState("");

  const latest = useRef(props);
  const reducedRef = useRef(reduced);
  const valueRef = useRef(value);
  const prevValue = useRef(value);
  const chunksRef = useRef<Chunk[]>([]);
  const chunkId = useRef(0);
  const flashId = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const controller = useRef<AbortController | null>(null);
  const accepting = useRef<{ value: string; rest: boolean } | null>(null);
  const caretTo = useRef<number | null>(null);
  const pressTimer = useRef<number | undefined>(undefined);
  const acceptedTimer = useRef<number | undefined>(undefined);
  const fadeTimer = useRef<number | undefined>(undefined);
  const mergeTimers = useRef(new Set<number>());
  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const height = useMotionValue(0);
  const [measured, setMeasured] = useState(false);

  const baseId = useId();
  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;

  useLayoutEffect(() => {
    latest.current = props;
    reducedRef.current = reduced;
    valueRef.current = value;
  });

  const writeChunks = useCallback((next: Chunk[]) => { chunksRef.current = next; setChunks(next); }, []);

  const announce = useCallback((text: string) => {
    // A trailing space forces a repeat announcement to be read again.
    setMessage((current) => (current === text ? `${text} ` : text));
  }, []);

  const caretAtEnd = useCallback(() => {
    const el = fieldRef.current;
    if (!el || document.activeElement !== el) return true;
    return el.selectionStart === el.selectionEnd && el.selectionEnd === el.value.length;
  }, []);

  const stop = useCallback(() => {
    window.clearTimeout(timer.current);
    controller.current?.abort();
    controller.current = null;
    setLoading(false);
  }, []);

  const request = useCallback(async () => {
    window.clearTimeout(timer.current);
    const p = latest.current;
    const text = valueRef.current;
    if (!p.suggest || p.disabled || !caretAtEnd() || text.trim().length < (p.minLength ?? 3)) return;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    writeChunks([]);
    setError(null);

    let got = "";
    const push = (piece: string) => {
      let next = piece;
      if (!got && /\s$/.test(text)) next = next.replace(/^[ \t]+/, "");
      if (!next) return;
      got += next;
      chunkId.current += 1;
      writeChunks([...chunksRef.current, { id: chunkId.current, text: next }]);
    };
    const finish = () => {
      controller.current = null;
      setLoading(false);
      const full = join(chunksRef.current);
      if (full) announce(`Suggestion: ${full.length > 160 ? `${full.slice(0, 157)}...` : full}. Press Tab to accept.`);
    };

    try {
      const result = p.suggest(text, ctrl.signal);
      if (result == null || typeof result === "string") {
        if (result) push(result);
        finish();
        return;
      }
      setLoading(true);
      if (isAsyncIterable(result)) {
        for await (const piece of result) {
          if (ctrl.signal.aborted) return;
          if (piece) push(piece);
        }
      } else {
        const whole = await result;
        if (ctrl.signal.aborted) return;
        if (whole) push(whole);
      }
      if (ctrl.signal.aborted) return;
      finish();
    } catch (err) {
      if (ctrl.signal.aborted) return;
      controller.current = null;
      setLoading(false);
      writeChunks([]);
      setError(err instanceof Error && err.message ? err.message : "The model did not respond");
      announce("Couldn't get a suggestion.");
    }
  }, [announce, caretAtEnd, writeChunks]);

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current);
    const p = latest.current;
    if (!p.suggest || p.disabled || valueRef.current.trim().length < (p.minLength ?? 3)) return;
    timer.current = window.setTimeout(() => { void request(); }, p.delay ?? 450);
  }, [request]);

  const press = useCallback((key: Pressed) => {
    setPressed(key);
    window.clearTimeout(pressTimer.current);
    pressTimer.current = window.setTimeout(() => setPressed(null), 160);
  }, []);

  const commit = useCallback((next: string) => {
    if (latest.current.value === undefined) setInner(next);
    latest.current.onValueChange?.(next);
  }, []);

  const accept = useCallback((mode: GhostTextAcceptMode) => {
    const suggestion = join(chunksRef.current);
    if (!suggestion || latest.current.disabled || !caretAtEnd()) return false;
    const part = mode === "all" ? suggestion : nextWord(suggestion);
    const rest = suggestion.length > part.length;
    const base = valueRef.current;
    const next = base + part;
    if (!rest) stop();
    writeChunks(rest ? trimFront(chunksRef.current, part.length) : []);
    accepting.current = { value: next, rest };
    caretTo.current = next.length;
    setGhostOut(null);
    if (!reducedRef.current) {
      // The accepted range keeps ghost ink for a moment and settles into text ink, so Tab reads as the ghost turning solid.
      flashId.current += 1;
      const merge: Merge = { key: flashId.current, start: base.length, text: part };
      setMerges((list) => [...list, merge]);
      const timerId = window.setTimeout(() => {
        mergeTimers.current.delete(timerId);
        setMerges((list) => list.filter((item) => item.key !== merge.key));
      }, MERGE_MS + 40);
      mergeTimers.current.add(timerId);
    }
    press(mode === "all" ? "tab" : "word");
    if (!rest) {
      setAccepted(true);
      window.clearTimeout(acceptedTimer.current);
      acceptedTimer.current = window.setTimeout(() => setAccepted(false), 1000);
    }
    announce(mode === "all" || !rest ? "Suggestion accepted." : `Accepted ${part.trim()}.`);
    commit(next);
    latest.current.onAccept?.(part, mode);
    return true;
  }, [announce, caretAtEnd, commit, press, stop, writeChunks]);

  /** Swaps the live ghost for a copy that fades out in place, then drops it so it stops taking up lines. */
  const fadeOut = useCallback((text: string) => {
    writeChunks([]);
    window.clearTimeout(fadeTimer.current);
    if (reducedRef.current) { setGhostOut(null); return; }
    flashId.current += 1;
    setGhostOut({ key: flashId.current, text });
    fadeTimer.current = window.setTimeout(() => setGhostOut(null), FADE_OUT_MS + 30);
  }, [writeChunks]);

  const dismiss = useCallback(() => {
    const suggestion = join(chunksRef.current);
    stop();
    if (!suggestion) return false;
    fadeOut(suggestion);
    press("esc");
    announce("Suggestion dismissed.");
    latest.current.onDismiss?.(suggestion);
    return true;
  }, [announce, fadeOut, press, stop]);

  const keepCaretInView = useCallback(() => {
    const viewport = viewportRef.current;
    const marker = markerRef.current;
    if (!viewport || !marker || !caretAtEnd()) return;
    if (latest.current.multiline === false) {
      const x = marker.offsetLeft;
      if (x + 24 > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = x + 24 - viewport.clientWidth;
      else if (x - 24 < viewport.scrollLeft) viewport.scrollLeft = Math.max(0, x - 24);
      return;
    }
    if (viewport.dataset.scroll !== "true") return;
    const top = marker.offsetTop;
    const bottom = top + marker.offsetHeight + 12;
    if (bottom > viewport.scrollTop + viewport.clientHeight) viewport.scrollTop = bottom - viewport.clientHeight;
    else if (top - 8 < viewport.scrollTop) viewport.scrollTop = Math.max(0, top - 8);
  }, [caretAtEnd]);

  // Every change of text, typed, accepted or set by the parent, runs through here before paint, so the ghost never lags a frame.
  useLayoutEffect(() => {
    const prev = prevValue.current;
    prevValue.current = value;
    if (prev === value) return;
    setError(null);
    setGhostOut(null);
    const acc = accepting.current;
    accepting.current = null;
    const el = fieldRef.current;
    if (caretTo.current !== null && el && document.activeElement === el) el.setSelectionRange(caretTo.current, caretTo.current);
    caretTo.current = null;
    keepCaretInView();
    if (acc && acc.value === value) {
      if (!acc.rest) schedule();
      return;
    }
    const suggestion = join(chunksRef.current);
    if (suggestion && value.startsWith(prev)) {
      const typed = value.slice(prev.length);
      if (typed.length < suggestion.length && suggestion.startsWith(typed)) {
        writeChunks(trimFront(chunksRef.current, typed.length));
        return;
      }
    }
    if (chunksRef.current.length) writeChunks([]);
    stop();
    schedule();
  }, [value, keepCaretInView, schedule, stop, writeChunks]);

  // The viewport follows the text's measured height on a short tween; it only scrolls past maxRows.
  useLayoutEffect(() => {
    if (!multiline) return;
    const stack = stackRef.current;
    const viewport = viewportRef.current;
    if (!stack || !viewport) return;
    let first = true;
    const measure = () => {
      const max = parseFloat(getComputedStyle(viewport).maxHeight);
      const natural = stack.offsetHeight;
      const target = Number.isFinite(max) ? Math.min(natural, max) : natural;
      viewport.dataset.scroll = Number.isFinite(max) && natural > max + 0.5 ? "true" : "false";
      if (first || reducedRef.current) {
        first = false;
        height.jump(target);
        setMeasured(true);
        return;
      }
      if (Math.abs(height.get() - target) < 0.5) return;
      animate(height, target, { duration: 0.18, ease });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stack);
    return () => observer.disconnect();
  }, [multiline, height]);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    window.clearTimeout(pressTimer.current);
    window.clearTimeout(acceptedTimer.current);
    window.clearTimeout(fadeTimer.current);
    const merging = mergeTimers.current;
    merging.forEach((timerId) => window.clearTimeout(timerId));
    merging.clear();
    controller.current?.abort();
  }, []);

  // A disabled field keeps any late chunks out of sight; request() refuses to start while disabled.
  const shown = disabled ? [] : chunks;
  const hasSuggestion = shown.length > 0;
  const status: GhostTextStatus = error ? "error" : hasSuggestion ? "ready" : loading ? "loading" : "idle";
  const streaming = loading && hasSuggestion;

  const stateRef = useRef<GhostTextState>({ status, suggestion: "", streaming });
  useLayoutEffect(() => { stateRef.current = { status, suggestion: "", streaming }; }, [status, streaming]);
  useEffect(() => { latest.current.onStatusChange?.(status); }, [status]);

  useImperativeHandle(ref, () => ({
    focus: () => fieldRef.current?.focus(),
    acceptAll: () => accept("all"),
    acceptWord: () => accept("word"),
    dismiss,
    request: () => { void request(); },
    getState: () => ({ ...stateRef.current, suggestion: join(chunksRef.current) }),
  }), [accept, dismiss, request]);

  const onChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    const next = multiline ? event.target.value : event.target.value.replace(/[\r\n]+/g, " ");
    commit(next);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    props.onUserIntent?.();
    if (event.nativeEvent.isComposing || !chunksRef.current.length || latest.current.disabled) return;
    const plain = !event.shiftKey && !event.altKey && !event.metaKey && !event.ctrlKey;
    if (event.key === "Tab" && plain) {
      if (accept("all")) event.preventDefault();
    } else if (event.key === "ArrowRight" && !event.shiftKey && (event.metaKey || event.ctrlKey || event.altKey)) {
      if (accept("word")) event.preventDefault();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      dismiss();
    }
  };

  const onSelect = () => {
    if ((chunksRef.current.length || controller.current) && !caretAtEnd()) {
      stop();
      writeChunks([]);
    }
  };

  const onBlur = (event: FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return;
    stop();
    const suggestion = join(chunksRef.current);
    if (suggestion) fadeOut(suggestion);
  };

  // Ranges still settling from ghost ink to text ink. While any is live, the mirror draws the typed text and the field's
  // own glyphs go transparent; the mirror shares the field's metrics, so the hand-off back is pixel identical.
  const liveMerges = reduced ? [] : merges
    .filter((merge) => value.slice(merge.start, merge.start + merge.text.length) === merge.text)
    .sort((a, b) => a.start - b.start);
  const typed: ReactNode[] = [];
  let typedAt = 0;
  for (const merge of liveMerges) {
    if (merge.start < typedAt) continue;
    typed.push(value.slice(typedAt, merge.start));
    typed.push(<span key={merge.key} className={styles.merge}>{merge.text}</span>);
    typedAt = merge.start + merge.text.length;
  }
  typed.push(value.slice(typedAt));
  const chipState: ChipState = error ? "error" : hasSuggestion ? "ready" : loading ? "loading" : accepted ? "accepted" : "idle";
  const live = [message, notice].filter(Boolean).join(" ");

  const fieldProps = {
    ref: fieldRef,
    className: styles.input,
    value,
    name,
    id,
    placeholder,
    disabled,
    autoFocus,
    spellCheck: true,
    autoComplete: "off",
    "aria-label": ariaLabel,
    "aria-labelledby": !ariaLabel && label ? labelId : undefined,
    "aria-describedby": hint ? hintId : undefined,
    onChange,
    onKeyDown,
    onSelect,
    onBlur,
    onPointerDown: () => props.onUserIntent?.(),
    onFocus: () => props.onUserIntent?.(),
  };

  return (
    <div
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-multiline={multiline ? "true" : "false"}
      data-variant={variant}
      data-merging={liveMerges.length ? "" : undefined}
      data-labelled={label ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      data-fading={demoFading ? "" : undefined}
      style={{ "--gt-rows": Math.max(1, rows), "--gt-max-rows": Math.max(rows, maxRows) } as CSSProperties}
    >
      {label && multiline ? <div id={labelId} className={styles.label}>{label}</div> : null}
      <motion.div ref={viewportRef} className={styles.viewport} style={multiline && measured ? { height } : undefined}>
        <div ref={stackRef} className={styles.stack}>
          <div className={styles.mirror} aria-hidden="true">
            {liveMerges.length ? typed : value}
            <span ref={markerRef} className={styles.marker} data-caret={demoCaret || undefined}>{"​"}</span>
            {shown.map((chunk) => <span key={chunk.id} className={styles.ghost}>{chunk.text}</span>)}
            {ghostOut && !hasSuggestion ? <span key={ghostOut.key} className={styles.ghostOut}>{ghostOut.text}</span> : null}
          </div>
          {multiline ? <textarea {...fieldProps} rows={1} /> : <input {...fieldProps} type="text" />}
        </div>
      </motion.div>
      {hint || footer ? (
        <div className={styles.footer}>
          {multiline ? <div className={styles.footerStart}>{footer}</div> : null}
          {hint ? (
            <>
              <AnimatePresence initial={false}>
                {chipState === "ready" && multiline ? (
                  <motion.span
                    key="keys"
                    className={styles.keys}
                    aria-hidden="true"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16, delay: reduced ? 0 : 0.04, ease } }}
                    exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease } }}
                  >
                    <span><Kbd keys="mod+right" size="sm" pressed={pressed === "word"} />word</span>
                    <span><Kbd keys="esc" size="sm" pressed={pressed === "esc"} />dismiss</span>
                  </motion.span>
                ) : null}
              </AnimatePresence>
              <HintChip
                state={chipState}
                model={model}
                pressed={pressed}
                error={error}
                reduced={reduced}
                onActivate={() => {
                  if (chipState === "ready") accept("all");
                  else if (chipState === "error") void request();
                }}
              />
            </>
          ) : null}
        </div>
      ) : null}
      {hint ? (
        <span id={hintId} className={styles.srOnly}>
          Suggestions appear when you pause. Tab accepts, Command or Control Right Arrow accepts one word, Escape dismisses.
        </span>
      ) : null}
      <span role="status" aria-live="polite" aria-atomic="true" className={styles.srOnly}>{live}</span>
    </div>
  );
}

function HintChip({ state, model, pressed, error, reduced, onActivate }: {
  state: ChipState;
  model: GhostTextModel;
  pressed: Pressed;
  error: string | null;
  reduced: boolean;
  onActivate: () => void;
}) {
  const width = useMotionValue(0);
  const [measured, setMeasured] = useState(false);
  const first = useRef(true);
  const reducedRef = useRef(reduced);
  useLayoutEffect(() => { reducedRef.current = reduced; });

  const onSize = useCallback((next: number) => {
    if (first.current || reducedRef.current) {
      first.current = false;
      width.jump(next);
      setMeasured(true);
      return;
    }
    if (Math.abs(width.get() - next) < 0.5) return;
    animate(width, next, { duration: 0.2, ease });
  }, [width]);

  const interactive = state === "ready" || state === "error";
  const mark = model.mark ? <span className={styles.mark} aria-hidden="true">{model.mark}</span> : null;
  const label = state === "ready" ? "Accept suggestion" : state === "error" ? `Retry suggestion. ${error ?? ""}`.trim() : state === "loading" ? `${model.name} is thinking` : `Autocomplete by ${model.name}`;

  return (
    <motion.button
      type="button"
      className={styles.chip}
      data-state={state}
      style={measured ? { width } : undefined}
      tabIndex={state === "error" ? 0 : -1}
      aria-disabled={interactive ? undefined : true}
      aria-label={label}
      title={state === "error" && error ? error : undefined}
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => { if (interactive) onActivate(); }}
    >
      <span className={styles.chipStack}>
        <AnimatePresence initial={false}>
          <ChipLayer key={state} onSize={onSize} reduced={reduced}>
            {state === "idle" ? <>{mark}<span className={styles.chipName}>{model.name}</span></> : null}
            {state === "loading" ? <>{mark}<TextShimmer className={styles.chipName}>Thinking</TextShimmer></> : null}
            {state === "ready" ? (
              <>
                {mark}
                <span className={styles.desk}><Kbd keys="tab" size="sm" pressed={pressed === "tab"} /><span>to accept</span></span>
                <span className={styles.touch}>Tap to accept</span>
              </>
            ) : null}
            {state === "accepted" ? <><Check className={styles.okIcon} aria-hidden="true" /><span>Accepted</span></> : null}
            {state === "error" ? <><CircleAlert className={styles.alertIcon} aria-hidden="true" /><span>No suggestion</span><span className={styles.retry}>Retry</span></> : null}
          </ChipLayer>
        </AnimatePresence>
      </span>
    </motion.button>
  );
}

/** One state of the chip. Layers share a grid cell, right aligned, so the old one fades out where it stood while the chip's width follows the new one. */
function ChipLayer({ children, onSize, reduced }: { children: ReactNode; onSize: (width: number) => void; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const present = useIsPresent();
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !present) return;
    const report = () => onSize(el.getBoundingClientRect().width);
    report();
    const observer = new ResizeObserver(report);
    observer.observe(el);
    return () => observer.disconnect();
  }, [present, onSize]);
  return (
    <motion.span
      ref={ref}
      className={styles.chipLayer}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16, delay: reduced ? 0 : 0.04, ease } }}
      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease } }}
    >
      {children}
    </motion.span>
  );
}
