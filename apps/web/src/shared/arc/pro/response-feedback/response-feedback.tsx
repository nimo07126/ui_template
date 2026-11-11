"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent, MouseEvent, ReactNode, RefObject } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls, Transition } from "motion/react";
import { CircleAlert, RotateCcw, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { Tooltip } from "../../tooltip/tooltip";
import { motionTokens } from "../../lib/motion-tokens";
import { ClaudeMark } from "./response-feedback-marks";
import styles from "./response-feedback.module.css";

export type FeedbackRating = "up" | "down";

/** What `onFeedback` receives. `stage: "rating"` fires on every thumb press; `stage: "details"` when reasons or a note are submitted. */
export interface FeedbackEvent {
  stage: "rating" | "details";
  /** The rating after this change. `null` means the person cleared it. */
  rating: FeedbackRating | null;
  /** Chip labels the person picked, in the order they are shown. */
  reasons: string[];
  /** The trimmed note, or an empty string. */
  comment: string;
  messageId?: string;
}

/** Persist feedback. Reject to show the inline error and Try again; the signal aborts when the panel closes or the rating changes. */
export type FeedbackHandler = (event: FeedbackEvent, context: { signal: AbortSignal }) => void | Promise<void>;

export interface FeedbackActionsProps {
  /** Passed back on every event so you can attach feedback to a message. */
  messageId?: string;
  /** Controlled rating. Leave undefined to let the control own it. */
  rating?: FeedbackRating | null;
  defaultRating?: FeedbackRating | null;
  onRatingChange?: (rating: FeedbackRating | null) => void;
  /** Without it, sends are simulated and the thank-you note says so. */
  onFeedback?: FeedbackHandler;
  /** Reasons offered after a thumbs down. */
  negativeReasons?: string[];
  /** Chips offered after a thumbs up. Pass `[]` to skip the follow-up. */
  positiveReasons?: string[];
  /** Show the optional note field after a thumbs down. */
  allowComment?: boolean;
  commentPlaceholder?: string;
  commentMaxLength?: number;
  /** Quiet line next to Submit, for what gets shared. Hidden below 400px. */
  privacyNote?: ReactNode;
  /** Second line of the thank-you state. */
  thanksMessage?: ReactNode;
  /** How long the thank-you state holds before the panel folds away, in ms. */
  thanksDuration?: number;
  /** Actions before the thumbs, such as copy or regenerate. */
  leading?: ReactNode;
  /** Content pinned to the end of the row, such as a timestamp. */
  trailing?: ReactNode;
  disabled?: boolean;
  className?: string;
}

type Phase = "idle" | "sending" | "error" | "thanks";

export const defaultNegativeReasons = ["Inaccurate", "Not helpful", "Too long", "Unsafe", "Other"];
export const defaultPositiveReasons = ["Accurate", "Easy to follow", "Good examples", "Saved me time"];

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const SIMULATED_DELAY = 700;
const SPRING = { type: "spring", visualDuration: .24, bounce: 0 } as const;
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

/**
 * Springs a wrapper to the height of its content whenever the content changes (the form folding into the thank-you
 * line, chips wrapping), so the page below glides instead of jumping. A width change cuts straight to the new height.
 */
function useAutoHeight(reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = outer.current, content = inner.current;
    if (!box || !content || typeof ResizeObserver === "undefined") return;
    let height = content.offsetHeight, width = content.offsetWidth;
    let controls: AnimationPlaybackControls | undefined;
    const release = () => { box.style.height = ""; controls = undefined; };
    const observer = new ResizeObserver(() => {
      const nextHeight = content.offsetHeight, nextWidth = content.offsetWidth;
      const resized = nextWidth !== width;
      width = nextWidth;
      if (nextHeight === height) return;
      const from = controls ? box.getBoundingClientRect().height : height;
      height = nextHeight;
      controls?.stop();
      if (reduced || resized) { release(); return; }
      controls = animate(box, { height: [from, nextHeight] }, { ...SPRING, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

/** The success tick draws itself once, quick to start and easing into place. */
function DrawnCheck({ reduced }: { reduced: boolean }) {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M3.25 8.5 6.5 11.75 12.75 4.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .28, ease: EASE, delay: .06 }} />
  </svg>;
}

interface ThumbProps {
  kind: FeedbackRating;
  active: boolean;
  expanded?: boolean;
  controls?: string;
  disabled: boolean;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onPress: (event: MouseEvent<HTMLButtonElement>) => void;
}

/** Outline and filled icons share one cell; the fill fades in, so the press reads instantly with nothing moving. */
function Thumb({ kind, active, expanded, controls, disabled, buttonRef, onPress }: ThumbProps) {
  const Icon = kind === "up" ? ThumbsUp : ThumbsDown;
  const label = kind === "up" ? "Good response" : "Bad response";
  return <Tooltip content={label}>
    <button ref={buttonRef} type="button" className={styles.iconButton} data-active={active || undefined} aria-pressed={active} aria-label={label}
      aria-expanded={expanded} aria-controls={expanded ? controls : undefined} disabled={disabled} onClick={onPress}>
      <span className={styles.thumb} aria-hidden="true">
        <Icon className={styles.thumbOutline} size={16} strokeWidth={1.75} />
        <Icon className={styles.thumbFill} size={16} strokeWidth={1.75} fill="currentColor" />
      </span>
    </button>
  </Tooltip>;
}

/** Text that swaps with a single crossfade in a cell that never changes height. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <div className={cx(styles.swap, className)}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.div key={id} className={styles.swapItem} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: .1 } }} transition={{ duration: .16, ease: EASE }}>{children}</motion.div>
    </AnimatePresence>
  </div>;
}

/**
 * Thumbs up and down for an AI reply. Thumbs down opens an inline panel with reason chips and an optional note; thumbs
 * up fills and offers a light "What was good?" row. Submitting shows a thank-you line that folds back into the row.
 */
export function FeedbackActions({
  messageId,
  rating: ratingProp,
  defaultRating = null,
  onRatingChange,
  onFeedback,
  negativeReasons = defaultNegativeReasons,
  positiveReasons = defaultPositiveReasons,
  allowComment = true,
  commentPlaceholder = "Add details (optional)",
  commentMaxLength = 1000,
  privacyNote = "Shares this reply for review",
  thanksMessage,
  thanksDuration = 1600,
  leading,
  trailing,
  disabled = false,
  className,
}: FeedbackActionsProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const panelId = `${id}-panel`, headingId = `${id}-heading`;
  const [ratingState, setRatingState] = useState<FeedbackRating | null>(defaultRating);
  const rating = ratingProp !== undefined ? ratingProp : ratingState;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackRating>("down");
  const [phase, setPhase] = useState<Phase>("idle");
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const firstChipRef = useRef<HTMLButtonElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ratingCall = useRef<AbortController | null>(null);
  const detailsCall = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const focusOnOpen = useRef(false);
  const focusThanks = useRef(false);
  const { outer, inner } = useAutoHeight(reduced);

  const simulated = !onFeedback;
  const thanksNote = thanksMessage ?? (simulated ? "Simulated, nothing was sent." : "It helps improve future replies.");
  const offered = kind === "down" ? negativeReasons : positiveReasons;

  useEffect(() => () => { ratingCall.current?.abort(); detailsCall.current?.abort(); window.clearTimeout(timer.current); }, []);

  useEffect(() => {
    if (open && focusOnOpen.current) { focusOnOpen.current = false; (firstChipRef.current ?? commentRef.current)?.focus({ preventScroll: true }); }
  }, [open, kind]);

  useEffect(() => {
    if (phase === "thanks" && focusThanks.current) { focusThanks.current = false; thanksRef.current?.focus({ preventScroll: true }); }
  }, [phase]);

  const thumbRef = (which: FeedbackRating) => which === "up" ? upRef : downRef;

  const commitRating = (next: FeedbackRating | null) => {
    const previous = rating;
    setRatingState(next);
    onRatingChange?.(next);
    ratingCall.current?.abort();
    if (!onFeedback) return;
    const call = new AbortController();
    ratingCall.current = call;
    Promise.resolve()
      .then(() => onFeedback({ stage: "rating", rating: next, reasons: [], comment: "", messageId }, { signal: call.signal }))
      .catch(() => {
        if (call.signal.aborted) return;
        setRatingState(previous);
        onRatingChange?.(previous);
        setAnnouncement("Couldn't save your rating. Try again.");
      });
  };

  const close = (returnFocus: boolean) => {
    detailsCall.current?.abort();
    window.clearTimeout(timer.current);
    setOpen(false);
    if (returnFocus) thumbRef(kind).current?.focus({ preventScroll: true });
  };

  const press = (which: FeedbackRating, event: MouseEvent<HTMLButtonElement>) => {
    detailsCall.current?.abort();
    window.clearTimeout(timer.current);
    if (rating === which) {
      commitRating(null);
      setOpen(false);
      setAnnouncement(simulated ? "Rating removed. Simulated, nothing was sent." : "Rating removed.");
      return;
    }
    commitRating(which);
    const follow = which === "down" ? negativeReasons.length > 0 || allowComment : positiveReasons.length > 0;
    setKind(which);
    setReasons([]);
    setComment("");
    setPhase("idle");
    setOpen(follow);
    // Keyboard presses move focus into the reasons; a pointer press leaves focus on the thumb.
    focusOnOpen.current = follow && which === "down" && event.detail === 0;
    const label = which === "up" ? "Marked as a good response." : "Marked as a bad response.";
    setAnnouncement(`${label}${follow ? which === "down" ? " Tell us what went wrong." : " Tell us what was good, or skip." : ""}${simulated ? " Simulated, nothing was sent." : ""}`);
  };

  const toggleReason = (reason: string) => {
    if (phase === "sending") return;
    if (phase === "error") setPhase("idle");
    setReasons(current => current.includes(reason) ? current.filter(item => item !== reason) : offered.filter(item => item === reason || current.includes(item)));
  };

  const canSubmit = reasons.length > 0 || comment.trim().length > 0;

  const submit = (viaKeyboard: boolean) => {
    if (phase === "sending" || !canSubmit) return;
    window.clearTimeout(timer.current);
    detailsCall.current?.abort();
    const call = new AbortController();
    detailsCall.current = call;
    const event: FeedbackEvent = { stage: "details", rating: kind, reasons, comment: comment.trim(), messageId };
    setPhase("sending");
    setAnnouncement("Sending feedback.");
    const run = onFeedback ? Promise.resolve().then(() => onFeedback(event, { signal: call.signal })) : wait(SIMULATED_DELAY, call.signal);
    run.then(() => {
      if (call.signal.aborted) return;
      focusThanks.current = viaKeyboard || !!panelRef.current?.contains(document.activeElement);
      setPhase("thanks");
      setAnnouncement(`Thanks for the feedback. ${typeof thanksNote === "string" ? thanksNote : ""}`.trim());
      timer.current = window.setTimeout(() => {
        const focused = !!panelRef.current?.contains(document.activeElement);
        setOpen(false);
        if (focused) thumbRef(kind).current?.focus({ preventScroll: true });
      }, thanksDuration);
    }, () => {
      if (call.signal.aborted) return;
      setPhase("error");
      setAnnouncement("Couldn't send your feedback. Try again.");
    });
  };

  const onPanelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.stopPropagation(); close(true); }
  };

  const chips = offered.length ? <div className={styles.chips} role="group" aria-label={kind === "down" ? "Reasons" : "What was good"}>
    {offered.map((reason, index) => <button key={reason} ref={index === 0 ? firstChipRef : undefined} type="button" className={styles.chip}
      aria-pressed={reasons.includes(reason)} disabled={phase === "sending"}
      onClick={event => {
        const picking = !reasons.includes(reason);
        toggleReason(reason);
        if (picking && reason === "Other" && event.detail > 0) commentRef.current?.focus({ preventScroll: true });
      }}>{reason}</button>)}
  </div> : null;

  const errorLine = <span className={styles.error}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.errorText}>Couldn&apos;t send</span></span>;

  const negative = <div className={styles.form} role="group" aria-labelledby={headingId}>
    <div className={styles.head}>
      <span id={headingId} className={styles.heading}>What went wrong?</span>
      <button type="button" className={styles.close} aria-label="Close feedback" onClick={event => close(event.detail === 0)}><X size={16} strokeWidth={1.75} aria-hidden="true" /></button>
    </div>
    {chips}
    {allowComment ? <textarea ref={commentRef} className={styles.comment} value={comment} maxLength={commentMaxLength} rows={2}
      aria-label="Feedback details" placeholder={reasons.includes("Other") ? "Tell us what went wrong" : commentPlaceholder}
      onChange={event => { setComment(event.target.value); if (phase === "error") setPhase("idle"); }}
      onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(true); } }} /> : null}
    <div className={styles.footer}>
      <Swap id={phase === "error" ? "error" : "note"} reduced={reduced} className={phase === "error" ? undefined : styles.noteCell}>
        {phase === "error" ? errorLine : <span className={styles.note}>{privacyNote}</span>}
      </Swap>
      <div className={styles.footActions}>
        <Button variant="ghost" size="sm" className={cx(styles.action, styles.cancel)} onClick={event => close(event.detail === 0)}>Cancel</Button>
        <Button variant="primary" size="sm" className={cx(styles.action, styles.submit)} loading={phase === "sending"} disabled={!canSubmit && phase !== "sending"}
          onClick={event => submit(event.detail === 0)}>{phase === "error" ? "Try again" : "Submit"}</Button>
      </div>
    </div>
  </div>;

  const positive = <div className={styles.form} role="group" aria-label="What was good?">
    <div className={styles.head}>
      <Swap id={phase === "error" ? "error" : "label"} reduced={reduced}>
        {phase === "error" ? errorLine : <span className={styles.heading} aria-hidden="true">What was good?</span>}
      </Swap>
      <Button variant={reasons.length ? "primary" : "ghost"} size="sm" className={cx(styles.action, styles.headAction, reasons.length > 0 && styles.submit)} loading={phase === "sending"}
        onClick={event => reasons.length ? submit(event.detail === 0) : close(event.detail === 0)}>{phase === "error" ? "Try again" : reasons.length ? "Send" : "Skip"}</Button>
    </div>
    {chips}
  </div>;

  const thanks = <div ref={thanksRef} className={styles.thanks} tabIndex={-1}>
    <span className={styles.thanksIcon}><DrawnCheck reduced={reduced} /></span>
    <span className={styles.thanksTitle}>Thanks for the feedback</span>
    <span className={styles.muted}>{thanksNote}</span>
  </div>;

  const contentKey = phase === "thanks" ? "thanks" : kind;

  return <div className={cx(styles.feedback, className)} data-rating={rating ?? undefined}>
    <div className={styles.row}>
      <div className={styles.actions}>
        {leading}
        <Thumb kind="up" active={rating === "up"} expanded={open && kind === "up"} controls={panelId} disabled={disabled} buttonRef={upRef} onPress={event => press("up", event)} />
        <Thumb kind="down" active={rating === "down"} expanded={open && kind === "down"} controls={panelId} disabled={disabled} buttonRef={downRef} onPress={event => press("down", event)} />
      </div>
      {trailing ? <div className={styles.trailing}>{trailing}</div> : null}
    </div>
    <AnimatePresence initial={false}>
      {open ? <motion.div key="panel" id={panelId} ref={panelRef} className={styles.panelClip} onKeyDown={onPanelKey}
        initial={{ height: reduced ? "auto" : 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: reduced ? "auto" : 0, opacity: 0 }}
        transition={reduced ? { duration: .12 } as Transition : { height: SPRING, opacity: { duration: .16, ease: EASE } }}>
        <div className={styles.panelPad}>
          <div ref={outer} className={styles.panel}>
            <div ref={inner} className={styles.panelInner}>
              <AnimatePresence initial={false} mode="popLayout">
                <motion.div key={contentKey} className={styles.panelContent} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: .1 } }} transition={{ duration: .16, ease: EASE, delay: .04 }}>
                  {phase === "thanks" ? thanks : kind === "down" ? negative : positive}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div> : null}
    </AnimatePresence>
    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </div>;
}

export interface ResponseFeedbackModel {
  name: string;
  /** A 16px mark. Defaults to the Claude mark. */
  mark?: ReactNode;
}

export interface ResponseFeedbackProps extends Omit<FeedbackActionsProps, "leading"> {
  /** The model that wrote the reply. */
  model?: ResponseFeedbackModel;
  /** The person's message shown above the reply. Pass `null` to hide it. */
  prompt?: ReactNode | null;
  /** The reply body. Defaults to a sample Postgres answer. */
  children?: ReactNode;
  /** Plain text for the copy action. Pass `null` to hide it. Defaults to the sample reply when no children are given. */
  copyText?: string | null;
  /** Shows a regenerate action in the row. */
  onRegenerate?: () => void;
}

const samplePrompt = "Why did our orders query get slower after we added an index on created_at?";

const sampleCopy = `Most likely the planner now prefers the new index for ORDER BY created_at, then filters status = 'paid' row by row. With 4.2M orders and only 3% paid, that walks most of the table.

- Run EXPLAIN (ANALYZE, BUFFERS) and look for an Index Scan on orders_created_at_idx with a large Rows Removed by Filter.
- Replace it with a composite index on (status, created_at), so the filter and the sort use one index.
- Run ANALYZE orders afterwards, so the planner sees fresh statistics.`;

function SampleReply() {
  return <>
    <p>Most likely the planner now prefers the new index for <code>ORDER BY created_at</code>, then filters <code>status = &apos;paid&apos;</code> row by row. With 4.2M orders and only 3% paid, that walks most of the table.</p>
    <ul>
      <li>Run <code>EXPLAIN (ANALYZE, BUFFERS)</code> and look for an Index Scan on <code>orders_created_at_idx</code> with a large Rows Removed by Filter.</li>
      <li>Replace it with a composite index on <code>(status, created_at)</code>, so the filter and the sort use one index.</li>
      <li>Run <code>ANALYZE orders</code> afterwards, so the planner sees fresh statistics.</li>
    </ul>
  </>;
}

/**
 * An AI reply with its action row: copy, optional regenerate, and the thumbs feedback control. With no props it renders
 * a sample Claude Sonnet 5.5 answer whose feedback runs a local simulation.
 */
export function ResponseFeedback({ model = { name: "Claude Sonnet 5.5" }, prompt, children, copyText, onRegenerate, className, ...feedback }: ResponseFeedbackProps) {
  const copyValue = copyText === undefined ? children === undefined ? sampleCopy : undefined : copyText ?? undefined;
  const leading = <>
    {copyValue ? <CopyButton value={copyValue} label="Copy reply" iconOnly variant="plain" className={styles.copy} /> : null}
    {onRegenerate ? <Tooltip content="Regenerate">
      <button type="button" className={styles.iconButton} aria-label="Regenerate reply" onClick={onRegenerate} disabled={feedback.disabled}><RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" /></button>
    </Tooltip> : null}
  </>;
  return <article className={cx(styles.card, className)} aria-label={`Reply from ${model.name}`}>
    {prompt !== null ? <div className={styles.prompt}><p className={styles.bubble}>{prompt ?? samplePrompt}</p></div> : null}
    <div className={styles.reply}>
      <div className={styles.author}>
        <span className={styles.mark} aria-hidden="true">{model.mark ?? <ClaudeMark width={16} height={16} />}</span>
        <span className={styles.modelName}>{model.name}</span>
      </div>
      <div className={styles.body}>{children ?? <SampleReply />}</div>
      <FeedbackActions {...feedback} leading={leading} />
    </div>
  </article>;
}

export default ResponseFeedback;
