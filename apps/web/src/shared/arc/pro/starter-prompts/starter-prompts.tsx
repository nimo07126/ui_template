"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowUp, ChartNoAxesColumn, Check, CircleAlert, CodeXml, ListTodo, PenLine, RotateCcw, Shuffle } from "lucide-react";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import { starterPromptSamples } from "./starter-prompts-data";
import type { StarterPrompt } from "./starter-prompts-data";
import { AppMark, ClaudeMark, appNames } from "./starter-prompts-marks";
import styles from "./starter-prompts.module.css";

export type { StarterPrompt, StarterPromptCategoryId } from "./starter-prompts-data";
export type { StarterPromptApp } from "./starter-prompts-marks";
export { starterPromptSamples } from "./starter-prompts-data";

export interface StarterPromptCategory {
  id: string;
  label: string;
  /** A 14px icon shown on each card in this category. */
  icon?: ReactNode;
}

export interface StarterPromptModel {
  name: string;
  /** A 14px mark. Defaults to the Claude mark. */
  mark?: ReactNode;
}

export type StarterPromptsStatus = "idle" | "sending" | "sent" | "error";

export interface StarterPromptsSubmitContext {
  /** The starter the message came from, if the person picked one. */
  prompt: StarterPrompt | null;
  /** Aborted when the person presses Stop or the component unmounts. */
  signal: AbortSignal;
}

export interface StarterPromptsProps {
  /** The heading. */
  greeting?: ReactNode;
  /** One quiet line under the heading. Pass null to hide it. */
  description?: ReactNode;
  /** The starters. Defaults to 24 samples across Write, Code, Analyze and Plan. */
  prompts?: StarterPrompt[];
  /** The filter tabs, in order. "All" is added in front. */
  categories?: StarterPromptCategory[];
  /** The category shown first. Defaults to "all". */
  defaultCategory?: string;
  /** Cards on screen at once. Defaults to 4. */
  count?: number;
  /** Shows placeholder cards while starters load. */
  loading?: boolean;
  /** The composer text, controlled. Pair with onValueChange. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called when a card is picked, after its prompt fills the composer. */
  onSelect?: (prompt: StarterPrompt) => void;
  /** Sends the message. Throw to show the error state. Without it the send is simulated and nothing leaves the page. */
  onSubmit?: (message: string, context: StarterPromptsSubmitContext) => Promise<void> | void;
  /** The model named in the composer. */
  model?: StarterPromptModel;
  placeholder?: string;
  className?: string;
}

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const SIMULATED_DELAY = 1100;
const SENT_HOLD = 2600;

const iconProps = { size: 14, strokeWidth: 1.75, "aria-hidden": true } as const;

export const defaultStarterCategories: StarterPromptCategory[] = [
  { id: "write", label: "Write", icon: <PenLine {...iconProps} /> },
  { id: "code", label: "Code", icon: <CodeXml {...iconProps} /> },
  { id: "analyze", label: "Analyze", icon: <ChartNoAxesColumn {...iconProps} /> },
  { id: "plan", label: "Plan", icon: <ListTodo {...iconProps} /> },
];

const defaultModel: StarterPromptModel = { name: "Claude Sonnet 5.5" };

/** All: one starter from each category in turn, so the first page shows the range. */
function interleave(prompts: StarterPrompt[], order: string[]) {
  const buckets = order.map(id => prompts.filter(prompt => prompt.category === id));
  const rest = prompts.filter(prompt => !order.includes(prompt.category));
  const out: StarterPrompt[] = [];
  for (let round = 0; buckets.some(bucket => bucket[round]); round++) for (const bucket of buckets) if (bucket[round]) out.push(bucket[round]);
  return [...out, ...rest];
}

/** Picks `count` starters, preferring ones not on screen. */
function draw(pool: StarterPrompt[], current: string[], count: number) {
  const fresh = pool.filter(prompt => !current.includes(prompt.id));
  const seen = pool.filter(prompt => current.includes(prompt.id));
  const mix = (list: StarterPrompt[]) => list.map(item => [Math.random(), item] as const).sort((a, b) => a[0] - b[0]).map(([, item]) => item);
  return [...mix(fresh), ...mix(seen)].slice(0, count).map(prompt => prompt.id);
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); }, { once: true });
});

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".25" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

/**
 * The empty state of an AI app: a greeting, starter cards filtered by category, a shuffle that swaps them with a short
 * staggered crossfade, and a composer the cards fill. With no props it runs a simulated send.
 */
export function StarterPrompts({
  greeting = "What are we working on, Maya?",
  description = "Pick a starter or write your own. Cards with an app mark use your connected tools.",
  prompts = starterPromptSamples,
  categories = defaultStarterCategories,
  defaultCategory = "all",
  count = 4,
  loading = false,
  value,
  defaultValue = "",
  onValueChange,
  onSelect,
  onSubmit,
  model = defaultModel,
  placeholder = "Ask anything, or pick a starter above",
  className,
}: StarterPromptsProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const [category, setCategory] = useState(defaultCategory);
  const [shown, setShown] = useState<{ category: string; ids: string[] } | null>(null);
  const [textState, setTextState] = useState(defaultValue);
  const text = value ?? textState;
  const [picked, setPicked] = useState<StarterPrompt | null>(null);
  const [status, setStatus] = useState<StarterPromptsStatus>("idle");
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const controller = useRef<AbortController | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => { controller.current?.abort(); window.clearTimeout(timer.current); }, []);

  const meta = useMemo(() => new Map(categories.map((item, index) => [item.id, { ...item, series: (index % 4) + 1 }])), [categories]);
  const pool = useMemo(() => category === "all" ? interleave(prompts, categories.map(item => item.id)) : prompts.filter(prompt => prompt.category === category), [prompts, categories, category]);

  // The cards on screen: the drawn set for this category, topped up from the pool if starters were removed.
  const visible = useMemo(() => {
    const byId = new Map(pool.map(prompt => [prompt.id, prompt]));
    const kept = shown && shown.category === category ? shown.ids.map(key => byId.get(key)).filter((prompt): prompt is StarterPrompt => !!prompt) : [];
    const fill = pool.filter(prompt => !kept.includes(prompt));
    return [...kept, ...fill].slice(0, count);
  }, [pool, shown, category, count]);

  const options = [{ value: "all", label: "All" }, ...categories.filter(item => prompts.some(prompt => prompt.category === item.id) || item.id === category).map(item => ({ value: item.id, label: item.label }))];
  const categoryLabel = meta.get(category)?.label ?? "All";
  const canShuffle = !loading && pool.length > count;
  const busy = status === "sending";

  const setText = (next: string) => {
    if (value === undefined) setTextState(next);
    onValueChange?.(next);
  };

  const changeCategory = (next: string) => {
    setCategory(next);
    setShown(null);
  };

  const shuffle = () => {
    if (!canShuffle) return;
    const ids = draw(pool, visible.map(prompt => prompt.id), count);
    setShown({ category, ids });
    setAnnouncement(`Showing ${ids.length} new ${category === "all" ? "" : `${categoryLabel.toLowerCase()} `}starters.`);
  };

  const flash = () => {
    const node = input.current;
    if (!node) return;
    node.focus({ preventScroll: true });
    const end = node.value.length;
    node.setSelectionRange(end, end);
    node.scrollTop = 0;
    if (!reduced) animate(node, { opacity: [.35, 1] }, { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] });
  };

  const pick = (prompt: StarterPrompt) => {
    if (busy) return;
    window.clearTimeout(timer.current);
    setText(prompt.prompt);
    setPicked(prompt);
    setStatus("idle");
    setError("");
    onSelect?.(prompt);
    setAnnouncement(`Added "${prompt.title}" to the message. Edit it or press Enter to send.`);
    requestAnimationFrame(flash);
  };

  const submit = async () => {
    const message = text.trim();
    if (!message || busy) return;
    window.clearTimeout(timer.current);
    const control = new AbortController();
    controller.current = control;
    setStatus("sending");
    setError("");
    setAnnouncement(`Sending to ${model.name}.`);
    try {
      if (onSubmit) await onSubmit(message, { prompt: picked, signal: control.signal });
      else await wait(SIMULATED_DELAY, control.signal);
      if (control.signal.aborted) return;
      setStatus("sent");
      setText("");
      setPicked(null);
      setAnnouncement(onSubmit ? "Sent." : "Sent. Simulated, nothing was sent.");
      timer.current = window.setTimeout(() => setStatus(current => current === "sent" ? "idle" : current), SENT_HOLD);
    } catch (reason) {
      if (control.signal.aborted) return;
      const message = reason instanceof Error && reason.message ? reason.message : "Couldn't send. Check your connection and try again.";
      setStatus("error");
      setError(message);
      setAnnouncement(`Not sent. ${message}`);
    } finally {
      if (controller.current === control) controller.current = null;
    }
  };

  const stop = () => {
    controller.current?.abort();
    controller.current = null;
    setStatus("idle");
    setAnnouncement("Stopped. Your message is still in the composer.");
    input.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape" && busy) { event.preventDefault(); stop(); return; }
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    void submit();
  };

  const fade: Transition = reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
  const swapIn = (index: number): Transition => reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter], delay: .06 + index * .035 };
  const swapOut = (index: number): Transition => reduced ? { duration: 0 } : { duration: .1, ease: [...motionTokens.ease.standard], delay: index * .035 };
  const empty = !loading && pool.length === 0;
  const canSend = text.trim().length > 0;
  const app = picked?.app;

  return <section className={cx(styles.root, className)} aria-labelledby={`${id}-title`}>
    <header className={styles.header}>
      <h2 id={`${id}-title`} className={styles.greeting}>{greeting}</h2>
      {description ? <p className={styles.description}>{description}</p> : null}
    </header>

    <div className={styles.toolbar}>
      <SegmentedControl className={styles.tabs} label="Filter starters" options={options} value={category} onValueChange={changeCategory} />
      <Button variant="ghost" size="sm" className={styles.shuffle} onClick={shuffle} disabled={!canShuffle} aria-label="Shuffle starters">
        <Shuffle size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.shuffleLabel}>Shuffle</span>
      </Button>
    </div>

    <div className={styles.gridWrap}>
      <ul className={styles.grid} aria-label={`${categoryLabel} starters`} aria-busy={loading || undefined}>
        {Array.from({ length: count }, (_, index) => {
          const prompt = loading ? undefined : visible[index];
          if (loading) return <li key={index} className={styles.slot} aria-hidden="true">
            <span className={cx(styles.card, styles.skeleton)}>
              <span className={styles.content}>
                <span className={styles.meta}><span className={styles.bone} style={{ width: 64 }} /></span>
                <span className={cx(styles.bone, styles.boneTitle)} style={{ width: `${68 - index * 7}%` }} />
                <span className={cx(styles.bone, styles.boneLine)} style={{ width: `${82 - index * 5}%` }} />
              </span>
            </span>
          </li>;
          if (!prompt) return <li key={index} className={styles.slot} aria-hidden="true" data-empty="" />;
          const info = meta.get(prompt.category);
          return <li key={index} className={styles.slot}>
            <button type="button" className={styles.card} onClick={() => pick(prompt)} disabled={busy} aria-label={`${prompt.title}${prompt.app ? `, uses ${appNames[prompt.app]}` : ""}. ${info?.label ?? ""}`} data-picked={picked?.id === prompt.id || undefined}>
              <AnimatePresence initial={false}>
                <motion.span key={prompt.id} className={styles.content}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0, transition: swapIn(index) }}
                  exit={{ opacity: 0, transition: swapOut(index) }}
                  aria-hidden="true">
                  <span className={styles.meta}>
                    {info?.icon ? <span className={styles.categoryIcon} data-series={info.series}>{info.icon}</span> : null}
                    <span className={styles.categoryLabel}>{info?.label ?? prompt.category}</span>
                    {prompt.app ? <span className={styles.app}><AppMark app={prompt.app} className={styles.appMark} /><span className={styles.appName}>{appNames[prompt.app]}</span></span> : null}
                  </span>
                  <span className={styles.title}>{prompt.title}</span>
                  {prompt.description ? <span className={styles.cardDescription}>{prompt.description}</span> : null}
                </motion.span>
              </AnimatePresence>
            </button>
          </li>;
        })}
      </ul>
      <AnimatePresence initial={false}>
        {empty ? <motion.div key="empty" className={styles.empty} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
          <p className={styles.emptyTitle}>No {category === "all" ? "" : `${categoryLabel.toLowerCase()} `}starters yet</p>
          <p className={styles.emptyCopy}>Write your own below{category === "all" ? "." : ", or look through every category."}</p>
          {category !== "all" ? <Button variant="secondary" size="sm" onClick={() => changeCategory("all")}>Show all</Button> : null}
        </motion.div> : null}
      </AnimatePresence>
    </div>

    <form className={styles.composer} data-status={status} onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label htmlFor={`${id}-input`} className={styles.srOnly}>Message {model.name}</label>
      <textarea ref={input} id={`${id}-input`} className={styles.input} value={text} placeholder={placeholder} rows={3} readOnly={busy}
        onChange={event => { setText(event.target.value); if (!event.target.value) setPicked(null); if (status === "error" || status === "sent") setStatus("idle"); }}
        onKeyDown={onKeyDown} aria-describedby={`${id}-status`} />
      <div className={styles.footer}>
        <div className={styles.footerStatus} id={`${id}-status`}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={status} className={styles.statusInner} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, delay: .04 } }} exit={{ opacity: 0, transition: reduced ? { duration: 0 } : { duration: .1 } }}>
              {status === "idle" ? <>
                <span className={styles.model}><span className={styles.modelMark}>{model.mark ?? <ClaudeMark width={14} height={14} />}</span><span className={styles.ellipsis}>{model.name}</span></span>
                <AnimatePresence initial={false} mode="popLayout">
                  {app ? <motion.span key={app} className={styles.chip} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.fast } }}>
                    <AppMark app={app} className={styles.appMark} /><span className={styles.ellipsis}>Uses {appNames[app]}</span>
                  </motion.span> : null}
                </AnimatePresence>
              </>
                : status === "sending" ? <TextShimmer className={styles.ellipsis}>{`Sending to ${model.name}`}</TextShimmer>
                  : status === "sent" ? <span className={styles.done}><Check size={14} strokeWidth={2} aria-hidden="true" className={styles.doneIcon} /><span className={styles.ellipsis}>{onSubmit ? "Sent" : "Sent. Simulated, nothing was sent."}</span></span>
                    : <span className={styles.failed}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" className={styles.failedIcon} /><span className={styles.ellipsis}>{error}</span></span>}
            </motion.span>
          </AnimatePresence>
        </div>
        <AnimatePresence initial={false}>
          {status === "error" ? <motion.span key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={fade}>
            <Button type="submit" variant="ghost" size="sm" className={styles.retry}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry</Button>
          </motion.span> : null}
        </AnimatePresence>
        <button type={busy ? "button" : "submit"} className={styles.send} onClick={busy ? stop : undefined} disabled={!busy && !canSend} aria-label={busy ? "Stop sending" : "Send message"} data-busy={busy || undefined}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span key={busy ? "stop" : "send"} className={styles.sendIcon} initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .7 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0 } : { opacity: 0, scale: .7 }} transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}>
              {busy ? <span className={styles.stopWrap}><Spinner /><span className={styles.stopSquare} /></span> : <ArrowUp size={16} strokeWidth={2} aria-hidden="true" />}
            </motion.span>
          </AnimatePresence>
        </button>
      </div>
    </form>

    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </section>;
}

export default StarterPrompts;
