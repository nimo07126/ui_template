"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { Check, CircleAlert, RotateCcw, Sparkles } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import {
  replyDraftLengths, replyDraftSampleMessage, replyDraftSampleModel, replyDraftSampleSuggestions, replyDraftTones,
  simulateReplyDraft, streamText,
} from "./reply-draft-data";
import type {
  ReplyDraftGenerate, ReplyDraftLength, ReplyDraftMessage, ReplyDraftModel, ReplyDraftSuggestion, ReplyDraftTone,
} from "./reply-draft-data";
import { ClaudeMark, GmailMark } from "./reply-draft-marks";
import styles from "./reply-draft.module.css";

export type {
  ReplyDraftGenerate, ReplyDraftLength, ReplyDraftMessage, ReplyDraftModel, ReplyDraftRequest, ReplyDraftSuggestion, ReplyDraftTone,
} from "./reply-draft-data";
export {
  chunkText, composeSampleReply, replyDraftSampleMessage, replyDraftSampleModel, replyDraftSampleSuggestions, simulateReplyDraft, streamText,
} from "./reply-draft-data";

export type ReplyDraftPhase = "empty" | "thinking" | "streaming" | "rewriting" | "ready" | "inserting" | "inserted" | "error";

export interface ReplyDraftInsertMeta {
  tone: ReplyDraftTone;
  length: ReplyDraftLength;
  suggestion?: ReplyDraftSuggestion;
}

export interface ReplyDraftProps {
  /** The received email the reply answers. Defaults to a sample renewal email. */
  message?: ReplyDraftMessage;
  /** Quick replies shown as chips above the draft. Each one steers a fresh draft. Pass [] to hide the row. */
  suggestions?: ReplyDraftSuggestion[];
  /** Id of the quick reply that steers the first draft. Defaults to the first suggestion. */
  defaultSuggestion?: string;
  onSuggestionSelect?: (suggestion: ReplyDraftSuggestion) => void;
  /** Name and mark shown on the draft. Defaults to Claude Sonnet 5.5. */
  model?: ReplyDraftModel;
  tone?: ReplyDraftTone;
  defaultTone?: ReplyDraftTone;
  onToneChange?: (tone: ReplyDraftTone) => void;
  length?: ReplyDraftLength;
  defaultLength?: ReplyDraftLength;
  onLengthChange?: (length: ReplyDraftLength) => void;
  /** Writes the draft. Return the whole text or an async iterable of chunks; honor the AbortSignal. Defaults to a local simulation. */
  generate?: ReplyDraftGenerate;
  /** Called with the draft, including the reader's edits. Without it, Insert is simulated and nothing is sent. */
  onInsert?: (draft: string, meta: ReplyDraftInsertMeta) => void | Promise<void>;
  /** Called whenever a draft or rewrite finishes. */
  onDraft?: (draft: string, meta: ReplyDraftInsertMeta) => void;
  /** Start drafting as soon as the card scrolls into view. Default true. */
  autoStart?: boolean;
  /** Tour tones, lengths and quick replies on a loop until someone interacts. Defaults to true only for the built-in simulation. */
  autoPlay?: boolean;
  className?: string;
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const toneLabel = (tone: ReplyDraftTone) => replyDraftTones.find(item => item.value === tone)?.label ?? tone;
const lengthLabel = (length: ReplyDraftLength) => replyDraftLengths.find(item => item.value === length)?.label ?? length;
const isAsyncIterable = (value: unknown): value is AsyncIterable<string> => typeof value === "object" && value !== null && Symbol.asyncIterator in value;
const pause = (ms: number, signal: AbortSignal) => new Promise<void>(resolve => {
  const timer = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(timer); resolve(); }, { once: true });
});

async function collect(result: Promise<string> | AsyncIterable<string>, signal: AbortSignal) {
  if (!isAsyncIterable(result)) return result;
  let text = "";
  for await (const chunk of result) { if (signal.aborted) break; text += chunk; }
  return text;
}

/** Springs the body to its content height as lines stream in or a rewrite swaps length. A width change cuts straight to the new height. */
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

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: .2 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [ref, inView] as const;
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  reduced: boolean;
}

/** A compact radio group: arrow keys move the selection, one pill highlight glides to the chosen option. */
function ChipGroup<T extends string>({ label, options, value, onChange, reduced }: ChipGroupProps<T>) {
  const highlight = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = options.length - 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    refs.current[next]?.focus();
  };
  return <div className={styles.chipGroup} role="radiogroup" aria-label={label}>
    {options.map((option, index) => {
      const selected = option.value === value;
      return <button key={option.value} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={selected}
        tabIndex={selected ? 0 : -1} className={styles.option} data-selected={selected || undefined}
        onClick={() => { if (!selected) onChange(option.value); }} onKeyDown={event => onKeyDown(event, index)}>
        {selected ? <motion.span layoutId={highlight} className={styles.optionHighlight} aria-hidden="true"
          transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: .24, bounce: 0 }} /> : null}
        <span className={styles.optionLabel}>{option.label}</span>
      </button>;
    })}
  </div>;
}

function StatusLabel({ phase, reduced, hadDraft }: { phase: ReplyDraftPhase; reduced: boolean; hadDraft: boolean }) {
  let key: string = phase;
  let content: ReactNode = null;
  if (phase === "thinking") { key = hadDraft ? "drafting" : "reading"; content = <TextShimmer>{hadDraft ? "Drafting" : "Reading email"}</TextShimmer>; }
  else if (phase === "streaming") content = <TextShimmer>Writing</TextShimmer>;
  else if (phase === "rewriting") content = <TextShimmer>Rewriting</TextShimmer>;
  else if (phase === "ready" || phase === "inserting") { key = "ready"; content = <><Check size={14} strokeWidth={2} aria-hidden="true" />Draft ready</>; }
  else if (phase === "inserted") content = <><Check size={14} strokeWidth={2} aria-hidden="true" />Inserted</>;
  else if (phase === "error") content = <><CircleAlert size={14} strokeWidth={2} aria-hidden="true" />Failed</>;
  return <span className={styles.status} aria-hidden="true">
    <AnimatePresence initial={false}>
      {content ? <motion.span key={key} className={styles.statusItem} data-phase={phase}
        initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : .16, ease: [...motionTokens.ease.standard] } }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}>{content}</motion.span> : null}
    </AnimatePresence>
  </span>;
}

/**
 * An AI reply drafter under a received email. Claude streams a reply fast; quick replies steer a fresh draft, tone and
 * length rewrite it with a single crossfade, and the finished draft is editable before Insert.
 */
export function ReplyDraft({
  message = replyDraftSampleMessage,
  suggestions = replyDraftSampleSuggestions,
  defaultSuggestion,
  onSuggestionSelect,
  model = replyDraftSampleModel,
  tone: toneProp,
  defaultTone = "friendly",
  onToneChange,
  length: lengthProp,
  defaultLength = "medium",
  onLengthChange,
  generate,
  onInsert,
  onDraft,
  autoStart = true,
  autoPlay,
  className,
}: ReplyDraftProps) {
  const reduced = useReducedMotion() ?? false;
  const [rootRef, inView] = useInView<HTMLDivElement>();
  const { outer, inner } = useAutoHeight(reduced);

  const [toneState, setToneState] = useState<ReplyDraftTone>(defaultTone);
  const [lengthState, setLengthState] = useState<ReplyDraftLength>(defaultLength);
  const tone = toneProp ?? toneState;
  const length = lengthProp ?? lengthState;
  const [suggestionId, setSuggestionId] = useState<string | undefined>(defaultSuggestion ?? suggestions[0]?.id);

  const [phase, setPhase] = useState<ReplyDraftPhase>("empty");
  const [version, setVersion] = useState(0);
  const [chunks, setChunks] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [lockHeight, setLockHeight] = useState<number>();
  const [errorMessage, setErrorMessage] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const [tookOver, setTookOver] = useState(false);

  const controller = useRef<AbortController | null>(null);
  const currentText = useRef("");
  const latest = useRef({ message, suggestions, generate, onDraft, model });
  useEffect(() => { latest.current = { message, suggestions, generate, onDraft, model }; });
  useEffect(() => () => controller.current?.abort(), []);

  const hasText = text.length > 0 || chunks.length > 0;
  const busy = phase === "thinking" || phase === "streaming" || phase === "rewriting";
  const simulated = !generate;
  const playing = (autoPlay ?? simulated) && !tookOver;

  const run = useCallback(async (mode: "draft" | "rewrite", style: { tone: ReplyDraftTone; length: ReplyDraftLength; suggestionId?: string }) => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    const { signal } = ctrl;
    const { message, suggestions, generate, onDraft, model } = latest.current;
    const suggestion = suggestions.find(item => item.id === style.suggestionId);
    const previous = currentText.current;
    const meta: ReplyDraftInsertMeta = { tone: style.tone, length: style.length, suggestion };
    const finish = (final: string) => {
      currentText.current = final;
      setText(final);
      setChunks([]);
      setPhase("ready");
      setLockHeight(undefined);
      setAnnouncement(`Draft ready: ${toneLabel(style.tone).toLowerCase()}, ${lengthLabel(style.length).toLowerCase()}.`);
      onDraft?.(final, meta);
    };

    if (mode === "draft" && previous) setLockHeight(inner.current?.offsetHeight);
    setErrorMessage("");
    setPhase(mode === "draft" ? "thinking" : "rewriting");
    setAnnouncement(mode === "draft" ? `Drafting a reply with ${model.name}${simulated ? ", simulated" : ""}.` : `Rewriting as ${toneLabel(style.tone).toLowerCase()}, ${lengthLabel(style.length).toLowerCase()}.`);

    let full = "";
    try {
      const result = (generate ?? simulateReplyDraft)({ message, tone: style.tone, length: style.length, suggestion, mode, previous: previous || undefined, signal });
      if (mode === "rewrite" || reduced) {
        const final = (await collect(result, signal)).trim();
        if (signal.aborted) return;
        if (!final) throw new Error("The model returned an empty draft.");
        setVersion(value => value + 1);
        finish(final);
        return;
      }
      const stream = isAsyncIterable(result) ? result : streamText(await result, signal);
      for await (const chunk of stream) {
        if (signal.aborted) return;
        if (!full) {
          const lead = chunk.trimStart();
          if (!lead) continue;
          full = lead;
          setVersion(value => value + 1);
          setText("");
          setChunks([lead]);
          setPhase("streaming");
        } else {
          full += chunk;
          setChunks(list => [...list, chunk]);
        }
      }
      if (signal.aborted) return;
      if (!full.trim()) throw new Error("The model returned an empty draft.");
      await pause(150, signal); // let the last chunk finish its fade before the text becomes editable
      if (signal.aborted) return;
      finish(full.trimEnd());
    } catch (error) {
      if (signal.aborted) return;
      const reason = error instanceof Error && error.message ? error.message : "Something went wrong.";
      setErrorMessage(reason);
      if (full) { currentText.current = full.trimEnd(); setText(full.trimEnd()); }
      setChunks([]);
      setPhase("error");
      setLockHeight(undefined);
      setAnnouncement(`Couldn't draft a reply. ${reason}`);
    }
  }, [inner, reduced, simulated]);

  /* Tone and length: a finished draft rewrites with a crossfade; a draft still streaming restarts in the new style. */
  const styleKey = `${tone}|${length}`;
  const lastStyle = useRef(styleKey);
  const phaseRef = useRef(phase);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => {
    if (lastStyle.current === styleKey) return;
    lastStyle.current = styleKey;
    const current = phaseRef.current;
    if (current === "empty") return;
    const restart = current === "thinking" || current === "streaming" || (current === "error" && !currentText.current);
    void run(restart ? "draft" : "rewrite", { tone, length, suggestionId });
  }, [styleKey, tone, length, suggestionId, run]);

  const changeTone = useCallback((next: ReplyDraftTone) => { if (toneProp === undefined) setToneState(next); onToneChange?.(next); }, [toneProp, onToneChange]);
  const changeLength = useCallback((next: ReplyDraftLength) => { if (lengthProp === undefined) setLengthState(next); onLengthChange?.(next); }, [lengthProp, onLengthChange]);

  const selectSuggestion = useCallback((suggestion: ReplyDraftSuggestion) => {
    setSuggestionId(suggestion.id);
    onSuggestionSelect?.(suggestion);
    void run("draft", { tone, length, suggestionId: suggestion.id });
  }, [onSuggestionSelect, run, tone, length]);

  const regenerate = useCallback(() => { void run("draft", { tone, length, suggestionId }); }, [run, tone, length, suggestionId]);

  const insert = useCallback(async () => {
    if (phase !== "ready") return;
    const draft = currentText.current.trim();
    if (!draft) return;
    const suggestion = suggestions.find(item => item.id === suggestionId);
    setPhase("inserting");
    try {
      if (onInsert) await onInsert(draft, { tone, length, suggestion });
      else await new Promise(resolve => setTimeout(resolve, 420));
      setPhase("inserted");
      setAnnouncement(onInsert ? "Draft inserted into your reply." : "Draft inserted into your reply. Simulated, nothing was sent.");
    } catch (error) {
      setPhase("ready");
      setAnnouncement(`Couldn't insert the draft. ${error instanceof Error ? error.message : ""}`.trim());
    }
  }, [phase, suggestions, suggestionId, onInsert, tone, length]);

  /* Start drafting the first time the card is on screen. */
  const started = useRef(false);
  useEffect(() => {
    if (!autoStart || !inView || started.current) return;
    started.current = true;
    void run("draft", { tone, length, suggestionId });
  }, [autoStart, inView, run, tone, length, suggestionId]);

  /* The self-playing tour: tones, length, a second quick reply, insert, then back to the opening draft. Pauses off screen. */
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!playing || !inView || (phase !== "ready" && phase !== "inserted")) return;
    const timer = setTimeout(() => {
      const second = suggestions[1] ?? suggestions[0], first = suggestions[0];
      const actions = [
        () => changeTone("concise"),
        () => changeTone("formal"),
        () => changeLength("long"),
        () => { if (second) selectSuggestion(second); else regenerate(); },
        () => { changeTone("friendly"); changeLength("short"); },
        () => { void insert(); },
        () => changeLength("medium"),
        () => { if (first) selectSuggestion(first); else regenerate(); },
      ];
      actions[step % actions.length]?.();
      setStep(value => value + 1);
    }, phase === "inserted" ? 1300 : 1900);
    return () => clearTimeout(timer);
  }, [playing, inView, phase, step, suggestions, changeTone, changeLength, selectSuggestion, regenerate, insert]);

  const takeOver = () => { if (!tookOver) setTookOver(true); };
  const onRootKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    takeOver();
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && phase === "ready") { event.preventDefault(); void insert(); }
  };

  const editable = phase === "ready" || phase === "inserted" || (phase === "error" && text.length > 0);
  const showSkeleton = phase === "thinking" && !hasText;
  const showEmpty = phase === "empty";
  const showErrorBlock = phase === "error" && !hasText;
  const dim = (phase === "thinking" || phase === "rewriting") && hasText;
  const fade = { duration: reduced ? 0 : .16, ease: [...motionTokens.ease.standard] as [number, number, number, number] };
  const exitFade = { opacity: 0, transition: { duration: reduced ? 0 : .1 } };
  const paragraphs = message.body.split(/\n{2,}/);

  return <div ref={rootRef} className={cx(styles.root, className)} onPointerDownCapture={takeOver} onKeyDownCapture={onRootKeyDown}>
    <article className={styles.card} aria-label={`Reply to ${message.from.name}`}>
      <header className={styles.mailHead}>
        <h3 className={styles.subject}>{message.subject}</h3>
        <GmailMark className={styles.source} width={16} height={16} title="Gmail" />
      </header>
      <div className={styles.sender}>
        <Avatar name={message.from.name} src={message.from.avatar} size="md" className={styles.avatar} />
        <div className={styles.senderText}>
          <div className={styles.senderLine}>
            <span className={styles.senderName}>{message.from.name}</span>
            <span className={styles.senderEmail}>{message.from.email}</span>
          </div>
          {message.to ? <span className={styles.meta}>to {message.to}</span> : null}
        </div>
        <span className={styles.time}>{message.receivedAt}</span>
      </div>
      <div className={styles.mailBody}>{paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>

      <section className={styles.reply} aria-label="AI reply">
        {suggestions.length ? <div className={styles.suggestions} role="group" aria-label="Quick replies">
          {suggestions.map(suggestion => <button key={suggestion.id} type="button" className={styles.suggestion}
            aria-pressed={suggestion.id === suggestionId} onClick={() => selectSuggestion(suggestion)}>{suggestion.label}</button>)}
        </div> : null}

        <div className={styles.draft} data-phase={phase}>
          <div className={styles.draftHead}>
            <span className={styles.model}>
              <span className={styles.modelMark}>{model.mark ?? <ClaudeMark width={16} height={16} title="" aria-hidden="true" />}</span>
              <span className={styles.modelName}>{model.name}</span>
            </span>
            <StatusLabel phase={phase} reduced={reduced} hadDraft={hasText} />
          </div>

          <div ref={outer} className={styles.bodyClip}>
            <div ref={inner} className={styles.body} style={lockHeight ? { minHeight: lockHeight } : undefined} aria-busy={busy || undefined}>
              <AnimatePresence initial={false}>
                {showEmpty ? <motion.p key="empty" className={styles.placeholder} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fade }} exit={exitFade}>
                  Pick a quick reply, or let {model.name.split(" ")[0]} draft one from the email.
                </motion.p> : null}
                {showSkeleton ? <motion.div key="skeleton" className={styles.skeleton} aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fade }} exit={exitFade}>
                  <span style={{ width: "34%" }} /><span style={{ width: "92%" }} /><span style={{ width: "78%" }} />
                </motion.div> : null}
                {showErrorBlock ? <motion.div key="error" className={styles.errorBlock} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fade }} exit={exitFade}>
                  <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
                  <span><span className={styles.errorTitle}>Couldn&apos;t draft a reply.</span> <span className={styles.errorCopy}>{errorMessage}</span></span>
                </motion.div> : null}
                {hasText ? <motion.div key={`v${version}`} className={styles.textLayer}
                  initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: dim ? .4 : 1, y: 0, transition: { ...fade, delay: reduced || dim ? 0 : .04 } }} exit={exitFade}>
                  {chunks.length ? <div className={styles.text}>{chunks.map((chunk, index) => <span key={index} className={styles.chunk}>{chunk}</span>)}</div>
                    : <div className={styles.text} data-editable={editable || undefined} contentEditable={editable ? "plaintext-only" : false} suppressContentEditableWarning
                      role={editable ? "textbox" : undefined} aria-multiline={editable || undefined} aria-label={editable ? "Reply draft, editable" : undefined}
                      onInput={event => { currentText.current = event.currentTarget.innerText; if (phase === "inserted") setPhase("ready"); }}>{text}</div>}
                </motion.div> : null}
              </AnimatePresence>
            </div>
          </div>

          <div className={styles.controls}>
            <ChipGroup label="Tone" options={replyDraftTones} value={tone} onChange={changeTone} reduced={reduced} />
            <span className={styles.divider} aria-hidden="true" />
            <ChipGroup label="Length" options={replyDraftLengths} value={length} onChange={changeLength} reduced={reduced} />
          </div>
        </div>

        <div className={styles.footer}>
          {phase === "empty"
            ? <Button variant="secondary" size="sm" className={styles.draftButton} onClick={regenerate}><Sparkles size={16} strokeWidth={1.75} aria-hidden="true" />Draft reply</Button>
            : <Button variant="ghost" size="sm" className={styles.footerButton} onClick={regenerate}>
              <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />{phase === "error" ? "Try again" : "Regenerate"}
            </Button>}
          <Button variant="primary" size="sm" className={styles.insert} onClick={() => void insert()} loading={phase === "inserting"}
            disabled={phase !== "ready" && phase !== "inserting" && phase !== "inserted"} aria-disabled={phase === "inserted" || undefined}>
            <span className={styles.swap}>
              <span data-on={phase !== "inserted" || undefined}>Insert</span>
              <span data-on={phase === "inserted" || undefined}><Check size={16} strokeWidth={2} aria-hidden="true" />Inserted</span>
            </span>
          </Button>
        </div>
      </section>
      <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
    </article>
  </div>;
}

export default ReplyDraft;
