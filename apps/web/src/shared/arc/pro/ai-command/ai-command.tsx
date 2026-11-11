"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CornerDownLeft, MessageSquare, RotateCcw, Search } from "lucide-react";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { Kbd } from "../kbd/kbd";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import { aiCommandSampleAsk, aiCommandSampleItems, aiCommandSampleQuestions, wait } from "./ai-command-data";
import { ClaudeMark } from "./ai-command-marks";
import type { AiCommandAction, AiCommandAsk, AiCommandItem, AiCommandMode, AiCommandSource } from "./ai-command-types";
import styles from "./ai-command.module.css";

export type { AiCommandAction, AiCommandAnswer, AiCommandAsk, AiCommandAskHelpers, AiCommandItem, AiCommandMode, AiCommandSource } from "./ai-command-types";
export { aiCommandSampleAsk, aiCommandSampleItems, aiCommandSampleQuestions, createSampleAsk } from "./ai-command-data";

export interface AiCommandProps {
  /** Pages and actions to search. Defaults to a sample billing workspace. */
  items?: readonly AiCommandItem[];
  /** Runs when a page or action is chosen. Without it (and without item.onSelect) the sample says the run was simulated. */
  onSelect?: (item: AiCommandItem) => void;
  /** Answers a question. Defaults to a simulated engine with sample answers. */
  onAsk?: AiCommandAsk;
  /** Runs after a suggested action finishes, with the label it ended on. */
  onAction?: (action: AiCommandAction, result: string) => void;
  /** Runs when a source chip is chosen. Sources with an href open in a new tab instead. */
  onSourceSelect?: (source: AiCommandSource) => void;
  /** Questions offered while Ask AI is open and empty. */
  suggestedQuestions?: readonly string[];
  /** The model that answers, shown in the footer and beside answers. */
  model?: { name: string; mark?: ReactNode };
  defaultMode?: AiCommandMode;
  defaultQuery?: string;
  onModeChange?: (mode: AiCommandMode) => void;
  /** Escape on an empty search. Use it to close the dialog that holds the palette. */
  onClose?: () => void;
  placeholder?: { search?: string; ask?: string };
  /** Status while the model searches, before any text arrives. */
  thinkingLabel?: string;
  /** Plays a looping walkthrough until someone interacts. Defaults to true only for the sample (no items or onAsk). */
  autoPlay?: boolean;
  /** Listens for Cmd+K or Ctrl+K anywhere on the page and focuses the input. */
  hotkey?: boolean;
  /** Height of the results area in px. The palette never changes size while you type or an answer streams. */
  height?: number;
  /** Adds a floating shadow, for use inside a dialog or popover. */
  elevated?: boolean;
  className?: string;
  style?: CSSProperties;
  "aria-label"?: string;
}

type AskStatus = "idle" | "thinking" | "streaming" | "done" | "error";
type AnswerState = { status: AskStatus; question: string; sources: readonly AiCommandSource[]; actions: readonly AiCommandAction[]; text?: string; error?: string; elapsed?: number };
type ActionState = { status: "running" | "done" | "error"; label: string };
type Entry =
  | { kind: "item"; key: string; item: AiCommandItem }
  | { kind: "ask"; key: string; question: string }
  | { kind: "question"; key: string; question: string }
  | { kind: "action"; key: string; action: AiCommandAction };
type Group = { heading?: string; entries: Entry[] };
type View = "search" | "prompt" | "answer";
type HintKey = "up" | "down" | "enter" | "tab" | "esc";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const idle: AnswerState = { status: "idle", question: "", sources: [], actions: [] };
const QUESTION = /^(why|how|what|whats|what's|who|when|where|which|can|could|does|do|did|is|are|was|were|should|will|summari[sz]e|explain|compare|draft|write|list|show me|find)\b/i;
/** Questions read as questions: a question mark, or a question word followed by at least two more words. */
export const isQuestion = (query: string) => { const q = query.trim(); return q.endsWith("?") || (QUESTION.test(q) && q.split(/\s+/).length >= 3); };
/** Word counts per streaming tick, cycled so chunks feel natural without randomness. */
const CHUNK_WORDS = [4, 6, 3, 5, 7, 4, 5, 3, 6];
const TICK = 34;
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const formatSeconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

function score(item: AiCommandItem, words: string[]) {
  const label = item.label.toLowerCase();
  const extra = `${item.meta ?? ""} ${item.group ?? ""} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (label.startsWith(word)) total += 4;
    else if (label.split(/[\s/#-]+/).some(part => part.startsWith(word))) total += 3;
    else if (label.includes(word)) total += 2;
    else if (extra.includes(word)) total += 1;
    else return 0;
  }
  return total;
}

function groupBy(items: readonly AiCommandItem[]) {
  const groups: Group[] = [];
  for (const item of items) {
    const heading = item.group ?? "Results";
    const group = groups.find(g => g.heading === heading) ?? groups[groups.push({ heading, entries: [] }) - 1]!;
    group.entries.push({ kind: "item", key: `item:${item.id}`, item });
  }
  return groups;
}

/** Takes the next few whole words. While the stream is open, a trailing word may still grow, so it waits for it. */
function nextChunk(rest: string, words: number, final: boolean) {
  const pattern = /\s*\S+/g;
  let end = 0;
  for (let count = 0; count < words; count++) {
    const match = pattern.exec(rest);
    if (!match) break;
    const stop = match.index + match[0].length;
    if (!final && stop === rest.length) break;
    end = stop;
  }
  // A citation always travels with the word it backs up, so the two can render unbroken.
  for (let peek = /^\s*\[\d+\]\S*/.exec(rest.slice(end)); peek; peek = /^\s*\[\d+\]\S*/.exec(rest.slice(end))) {
    if (!final && end + peek[0].length === rest.length) break;
    end += peek[0].length;
  }
  if (final && end === 0) return rest;
  return rest.slice(0, end);
}

const plainAnswer = (text: string, sources: readonly AiCommandSource[]) => {
  if (!sources.length) return text;
  return `${text}\n\nSources\n${sources.map((s, i) => `[${i + 1}] ${s.description ?? s.title}${s.href ? ` ${s.href}` : ""}`).join("\n")}`;
};

/* ------------------------------------------------------------------------------------------------------------------ */

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

function DrawnCheck({ reduced, size = 16 }: { reduced: boolean; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M3.25 8.5 6.5 11.75 12.75 4.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .26, ease, delay: .03 }} />
  </svg>;
}

/** A single crossfade for any label or icon swap: old out in 100ms, new in over 160ms with a 2px rise. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={id} className={styles.swapItem}
        initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: { duration: .16, ease } }}
        exit={{ opacity: 0, y: reduced ? 0 : -2, transition: { duration: .1, ease } }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/**
 * One highlight per list that glides between rows. It is positioned straight from the DOM after each render, so it
 * never waits on React state, and it jumps without travel whenever the list itself changes (typing, switching views).
 */
function useHighlight(activeKey: string | undefined, layoutKey: string) {
  const list = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLDivElement>(null);
  const last = useRef("");
  useLayoutEffect(() => {
    const box = list.current, bar = highlight.current;
    if (!box || !bar) return;
    const row = activeKey ? box.querySelector<HTMLElement>(`[data-key="${CSS.escape(activeKey)}"]`) : null;
    if (!row) { bar.style.opacity = "0"; last.current = ""; return; }
    const jump = last.current !== layoutKey || bar.style.opacity !== "1";
    last.current = layoutKey;
    if (jump) bar.style.transition = "none";
    bar.style.transform = `translateY(${row.offsetTop}px)`;
    bar.style.height = `${row.offsetHeight}px`;
    bar.style.opacity = "1";
    if (jump) { void bar.offsetHeight; bar.style.transition = ""; }
  });
  return { list, highlight };
}

/** Keeps a row inside its scrolling view without ever scrolling the page around the palette. */
function revealRow(root: HTMLElement | null, key: string | undefined) {
  if (!root || !key) return;
  const row = root.querySelector<HTMLElement>(`[data-key="${CSS.escape(key)}"]`);
  const view = row?.closest<HTMLElement>("[data-view]");
  if (!row || !view) return;
  const r = row.getBoundingClientRect(), v = view.getBoundingClientRect(), pad = 8, head = 32;
  if (r.top < v.top + pad + head) view.scrollTop -= v.top + pad + head - r.top;
  else if (r.bottom > v.bottom - pad) view.scrollTop += r.bottom - v.bottom + pad;
}

interface RowProps {
  id: string;
  entryKey: string;
  active: boolean;
  icon: ReactNode;
  label: ReactNode;
  meta?: ReactNode;
  end?: ReactNode;
  status?: string;
  onHover: () => void;
  onChoose: () => void;
}

function Row({ id, entryKey, active, icon, label, meta, end, status, onHover, onChoose }: RowProps) {
  return <div id={id} role="option" aria-selected={active} data-key={entryKey} data-active={active ? "" : undefined} data-status={status} className={styles.row}
    onPointerMove={active ? undefined : onHover} onPointerDown={event => event.preventDefault()} onClick={onChoose}>
    <span className={styles.icon} aria-hidden="true">{icon}</span>
    <span className={styles.label}>{label}</span>
    {meta ? <span className={styles.meta}>{meta}</span> : null}
    {end ? <span className={styles.end}>{end}</span> : null}
  </div>;
}

/* ------------------------------------------------------------------------------------------------------------------ */

/**
 * A command palette with an AI mode. Search pages and actions, or press Tab to ask a question: the answer streams in
 * place with numbered sources, and the actions it suggests run right from the list. Keyboard first, fixed size.
 */
export function AiCommand({
  items: itemsProp,
  onSelect,
  onAsk,
  onAction,
  onSourceSelect,
  suggestedQuestions = aiCommandSampleQuestions,
  model = { name: "Claude Sonnet 5.5", mark: <ClaudeMark width={16} height={16} /> },
  defaultMode = "search",
  defaultQuery = "",
  onModeChange,
  onClose,
  placeholder,
  thinkingLabel = "Searching your workspace",
  autoPlay: autoPlayProp,
  hotkey = false,
  height = 392,
  elevated = false,
  className,
  style,
  "aria-label": ariaLabel = "Command palette",
}: AiCommandProps) {
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const items = itemsProp ?? aiCommandSampleItems;
  const asker = onAsk ?? aiCommandSampleAsk;
  const sample = !itemsProp && !onAsk;
  const autoPlay = autoPlayProp ?? sample;

  const [mode, setModeState] = useState<AiCommandMode>(defaultMode);
  const [query, setQuery] = useState(defaultQuery);
  const [active, setActive] = useState(0);
  const [answer, setAnswer] = useState<AnswerState>(idle);
  const [chunks, setChunks] = useState<string[]>([]);
  const [actionStates, setActionStates] = useState<Record<string, ActionState>>({});
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [pressed, setPressed] = useState<HintKey | null>(null);
  const [focusedSource, setFocusedSource] = useState<number | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const askAbort = useRef<AbortController | null>(null);
  const actionAborts = useRef(new Map<string, AbortController>());
  const target = useRef("");
  const revealed = useRef(0);
  const resolved = useRef(false);
  const pendingActions = useRef<readonly AiCommandAction[]>([]);
  const startedAt = useRef(0);
  const tick = useRef(0);
  const scrollIntent = useRef(false);
  const answerRef = useRef(answer);
  const actionStatesRef = useRef(actionStates);
  useLayoutEffect(() => { answerRef.current = answer; actionStatesRef.current = actionStates; });

  const setMode = useCallback((next: AiCommandMode) => {
    setModeState(prev => { if (prev !== next) onModeChange?.(next); return next; });
  }, [onModeChange]);

  const announce = useCallback((text: string) => setAnnouncement(prev => prev === text ? `${text} ` : text), []);

  /* ---------- What the list shows ---------- */

  const view: View = mode === "search" ? "search" : answer.status !== "idle" && query.trim() === answer.question ? "answer" : "prompt";
  const trimmed = query.trim();
  /* A question word is enough to put Ask AI first while someone is still typing the rest. */
  const questionLike = isQuestion(trimmed) || QUESTION.test(trimmed);

  const groups = useMemo<Group[]>(() => {
    if (view === "search") {
      if (!trimmed) {
        const anySuggested = items.some(item => item.suggested !== undefined);
        return groupBy(items.filter(item => anySuggested ? item.suggested : true));
      }
      const words = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
      const matches = items.map((item, index) => ({ item, index, score: score(item, words) })).filter(m => m.score > 0);
      const best = new Map<string, number>();
      matches.forEach(m => { const g = m.item.group ?? "Results"; best.set(g, Math.max(best.get(g) ?? 0, m.score)); });
      matches.sort((a, b) => (best.get(b.item.group ?? "Results")! - best.get(a.item.group ?? "Results")!) || b.score - a.score || a.index - b.index);
      const found = groupBy(matches.map(m => m.item));
      const askGroup: Group = { heading: "Ask AI", entries: [{ kind: "ask", key: "ask", question: trimmed }] };
      return questionLike || !found.length ? [askGroup, ...found] : [...found, askGroup];
    }
    if (view === "prompt") {
      const rest = suggestedQuestions.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const ask: Group[] = trimmed ? [{ entries: [{ kind: "ask", key: "ask", question: trimmed }] }] : [];
      return [...ask, { heading: "Try asking", entries: rest.map(q => ({ kind: "question" as const, key: `q:${q}`, question: q })) }];
    }
    if (answer.status !== "done" || !answer.actions.length) return [];
    return [{ heading: "Suggested actions", entries: answer.actions.map(action => ({ kind: "action" as const, key: `action:${action.id}`, action })) }];
  }, [view, trimmed, questionLike, items, suggestedQuestions, answer.status, answer.actions]);

  const entries = useMemo(() => groups.flatMap(g => g.entries), [groups]);
  const activeIndex = entries.length ? Math.min(active, entries.length - 1) : -1;
  const activeEntry = activeIndex >= 0 ? entries[activeIndex] : undefined;
  const optionId = (key: string) => `${uid}-${key.replace(/[^a-z0-9-]/gi, "_")}`;
  const listId = `${uid}-list`;
  const noResults = view === "search" && !!trimmed && !questionLike && entries.length === 1;

  /* ---------- Feedback ---------- */

  const flashTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const showFlash = useCallback((text: string) => {
    clearTimeout(flashTimer.current);
    setFlash({ id: Date.now(), text });
    flashTimer.current = setTimeout(() => setFlash(null), 2200);
  }, []);

  const pressTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const press = useCallback((key: HintKey) => {
    clearTimeout(pressTimer.current);
    setPressed(key);
    pressTimer.current = setTimeout(() => setPressed(null), 160);
  }, []);

  /* ---------- Asking ---------- */

  const abortActions = useCallback(() => {
    actionAborts.current.forEach(controller => controller.abort());
    actionAborts.current.clear();
  }, []);

  const ask = useCallback((raw: string) => {
    const question = raw.trim();
    if (!question) return;
    askAbort.current?.abort();
    abortActions();
    const controller = new AbortController();
    askAbort.current = controller;
    target.current = "";
    revealed.current = 0;
    resolved.current = false;
    pendingActions.current = [];
    startedAt.current = performance.now();
    tick.current = 0;
    setChunks([]);
    setActionStates({});
    setFocusedSource(null);
    setAnswer({ status: "thinking", question, sources: [], actions: [] });
    setQuery(question);
    setMode("ask");
    setActive(0);
    announce(`Asking: ${question}`);
    const helpers = {
      signal: controller.signal,
      append: (delta: string) => { if (!controller.signal.aborted) target.current += delta; },
      setSources: (sources: readonly AiCommandSource[]) => { if (!controller.signal.aborted) setAnswer(prev => ({ ...prev, sources })); },
    };
    Promise.resolve().then(() => asker(question, helpers)).then(result => {
      if (controller.signal.aborted) return;
      if (result?.text && result.text.length > target.current.length) target.current = result.text;
      if (result?.sources) setAnswer(prev => ({ ...prev, sources: result.sources! }));
      pendingActions.current = result?.actions ?? [];
      resolved.current = true;
    }, (error: unknown) => {
      if (controller.signal.aborted) return;
      const message = error instanceof Error && error.message ? error.message : "Something went wrong. Try again.";
      setAnswer(prev => ({ ...prev, status: "error", error: message }));
      announce(`Couldn't get an answer. ${message}`);
    });
  }, [asker, abortActions, announce, setMode]);

  /* Reveals the answer a few words at a time, the way streamed model output lands. */
  const streaming = answer.status === "thinking" || answer.status === "streaming";
  useEffect(() => {
    if (!streaming) return;
    const timer = setInterval(() => {
      const rest = target.current.slice(revealed.current);
      if (rest) {
        const words = reduced ? 40 : CHUNK_WORDS[tick.current++ % CHUNK_WORDS.length]!;
        const chunk = nextChunk(rest, words, resolved.current);
        if (chunk) {
          revealed.current += chunk.length;
          setChunks(prev => [...prev, chunk]);
          setAnswer(prev => prev.status === "thinking" ? { ...prev, status: "streaming" } : prev);
          return;
        }
      }
      if (resolved.current && revealed.current >= target.current.length) {
        const elapsed = performance.now() - startedAt.current;
        const actions = pendingActions.current;
        const text = target.current;
        setAnswer(prev => ({ ...prev, status: "done", actions, elapsed, text }));
        setActive(0);
        announce(`Answer ready${actions.length ? `, ${actions.length} suggested action${actions.length === 1 ? "" : "s"}` : ""}. ${target.current}`);
      }
    }, TICK);
    return () => clearInterval(timer);
  }, [streaming, reduced, announce]);

  /* Follows the answer down while it streams, unless the person scrolled up to read. */
  const answerView = useRef<HTMLDivElement>(null);
  const follow = useRef(true);
  useEffect(() => { if (answer.status === "thinking") follow.current = true; }, [answer.status]);
  useEffect(() => {
    const el = answerView.current;
    if (!el || !follow.current || answer.status !== "streaming") return;
    if (el.scrollHeight - el.clientHeight - el.scrollTop > 1) el.scrollTo({ top: el.scrollHeight, behavior: reduced ? "auto" : "smooth" });
  }, [chunks, answer.status, reduced]);

  const runAction = useCallback((action: AiCommandAction) => {
    const current = actionStatesRef.current[action.id];
    if (current && current.status !== "error") return;
    const controller = new AbortController();
    actionAborts.current.set(action.id, controller);
    setActionStates(prev => ({ ...prev, [action.id]: { status: "running", label: action.runningLabel ?? action.label } }));
    Promise.resolve().then(() => action.run?.(controller.signal)).then(result => {
      if (controller.signal.aborted) return;
      const label = (typeof result === "string" && result) || action.doneLabel || "Done";
      setActionStates(prev => ({ ...prev, [action.id]: { status: "done", label } }));
      announce(`${label}.${action.doneMeta ? ` ${action.doneMeta}.` : ""}`);
      onAction?.(action, label);
    }, () => {
      if (controller.signal.aborted) return;
      const label = action.errorLabel ?? `Couldn't finish: ${action.label}`;
      setActionStates(prev => ({ ...prev, [action.id]: { status: "error", label } }));
      announce(`${label}. Press Enter to try again.`);
    }).finally(() => { if (actionAborts.current.get(action.id) === controller) actionAborts.current.delete(action.id); });
  }, [announce, onAction]);

  /* ---------- Choosing ---------- */

  const toAsk = useCallback(() => { setMode("ask"); setActive(0); }, [setMode]);
  const toSearch = useCallback(() => {
    askAbort.current?.abort();
    abortActions();
    setAnswer(prev => prev.status === "thinking" || prev.status === "streaming" ? idle : prev);
    setMode("search");
    setActive(0);
  }, [abortActions, setMode]);

  const choose = useCallback((entry: Entry | undefined) => {
    if (!entry) return;
    if (entry.kind === "item") {
      onSelect?.(entry.item);
      entry.item.onSelect?.();
      if (!onSelect && !entry.item.onSelect) {
        showFlash(`${entry.item.label}, simulated`);
        announce(`${entry.item.label}. Simulated, nothing was opened.`);
      }
      return;
    }
    if (entry.kind === "ask" || entry.kind === "question") { ask(entry.question); return; }
    runAction(entry.action);
  }, [onSelect, showFlash, announce, ask, runAction]);

  const move = useCallback((delta: number) => {
    if (!entries.length) return;
    scrollIntent.current = true;
    setActive((activeIndex + delta + entries.length) % entries.length);
  }, [entries.length, activeIndex]);

  useLayoutEffect(() => {
    if (!scrollIntent.current) return;
    scrollIntent.current = false;
    revealRow(rootRef.current, activeEntry?.key);
  });

  const enter = useCallback(() => {
    if (view === "answer" && answer.status === "error") { ask(answer.question); return; }
    if (view === "answer" && answer.status !== "done") return;
    choose(activeEntry);
  }, [view, answer.status, answer.question, ask, choose, activeEntry]);

  const tab = useCallback(() => {
    if (mode === "search") { if (trimmed) ask(trimmed); else toAsk(); return true; }
    if (view === "prompt") { toSearch(); return true; }
    return false;
  }, [mode, trimmed, view, ask, toAsk, toSearch]);

  const escape = useCallback(() => {
    if (mode === "ask") { toSearch(); return; }
    if (query) { setQuery(""); setActive(0); return; }
    onClose?.();
  }, [mode, query, toSearch, onClose]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); move(event.key === "ArrowDown" ? 1 : -1); return; }
    if (event.key === "Enter") { event.preventDefault(); enter(); return; }
    if (event.key === "Escape") { event.preventDefault(); escape(); return; }
    if (event.key === "Tab" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) { if (tab()) event.preventDefault(); }
  };

  /* ---------- Hotkey, cleanup ---------- */

  useEffect(() => {
    if (!hotkey) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hotkey]);

  useEffect(() => () => {
    askAbort.current?.abort();
    actionAborts.current.forEach(controller => controller.abort());
    clearTimeout(flashTimer.current);
    clearTimeout(pressTimer.current);
  }, []);

  /* ---------- Walkthrough ---------- */

  const api = useRef({ ask, move, enter, escape, press, toSearch });
  useLayoutEffect(() => { api.current = { ask, move, enter, escape, press, toSearch }; });
  const [touched, setTouched] = useState(false);
  const playing = autoPlay && !touched && !reduced;

  useEffect(() => {
    if (!playing) return;
    const root = rootRef.current;
    if (!root) return;
    let controller: AbortController | null = null;
    const reset = () => {
      askAbort.current?.abort();
      abortActions();
      setAnswer(idle); setChunks([]); setActionStates({}); setQuery(""); setActive(0); setModeState("search");
    };
    const until = async (check: () => boolean, signal: AbortSignal, limit = 8000) => {
      const end = performance.now() + limit;
      while (!check() && performance.now() < end) await wait(60, signal);
    };
    const play = async (signal: AbortSignal) => {
      const a = () => api.current;
      const type = async (text: string) => {
        for (let i = 1; i <= text.length; i++) { setQuery(text.slice(0, i)); setActive(0); await wait(34 + ((i * 17) % 29), signal); }
      };
      const key = async (name: HintKey, run: () => void, after: number) => { a().press(name); run(); await wait(after, signal); };
      while (!signal.aborted) {
        reset();
        await wait(1100, signal);
        await type("inv");
        await wait(520, signal);
        await key("down", () => a().move(1), 300);
        await key("down", () => a().move(1), 640);
        setQuery(""); setActive(0);
        await wait(420, signal);
        await type("Why did EU invoices fail last night?");
        await wait(560, signal);
        await key("tab", () => a().ask("Why did EU invoices fail last night?"), 200);
        await until(() => answerRef.current.status === "done" || answerRef.current.status === "error", signal);
        await wait(1100, signal);
        const first = answerRef.current.actions[0], second = answerRef.current.actions[1];
        if (first) {
          await key("enter", () => a().enter(), 120);
          await until(() => actionStatesRef.current[first.id]?.status !== "running", signal);
          await wait(900, signal);
        }
        if (second) {
          await key("down", () => a().move(1), 420);
          await key("enter", () => a().enter(), 120);
          await until(() => actionStatesRef.current[second.id]?.status !== "running", signal);
        }
        await wait(2000, signal);
        await key("esc", () => a().toSearch(), 360);
      }
    };
    const start = () => {
      if (controller) return;
      controller = new AbortController();
      play(controller.signal).catch(() => {});
    };
    const stop = () => { controller?.abort(); controller = null; };
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) start(); else { stop(); reset(); }
    }, { threshold: .35 });
    if (observer) observer.observe(root); else start();
    return () => { observer?.disconnect(); stop(); };
  }, [playing, abortActions]);

  /* Any real pointer or key inside the palette hands it over to the person for good. */
  const takeOver = (event: { nativeEvent: Event }) => {
    if (!playing || !event.nativeEvent.isTrusted) return;
    setTouched(true);
    setPressed(null);
  };

  /* ---------- Render ---------- */

  const layoutKey = `${view}|${entries.map(e => e.key).join(",")}`;
  const { list: listRef, highlight: highlightRef } = useHighlight(activeEntry?.key, layoutKey);

  const placeholderText = mode === "search" ? placeholder?.search ?? "Search or ask a question" : placeholder?.ask ?? "Ask anything about your workspace";
  const modelMark = model.mark ?? <ClaudeMark width={16} height={16} />;

  const entryRow = (entry: Entry) => {
    const isActive = entry.key === activeEntry?.key;
    const common = { id: optionId(entry.key), entryKey: entry.key, active: isActive, onHover: () => setActive(entries.indexOf(entry)), onChoose: () => { setActive(entries.indexOf(entry)); choose(entry); inputRef.current?.focus({ preventScroll: true }); } };
    if (entry.kind === "item") {
      const { item } = entry;
      return <Row key={entry.key} {...common} icon={item.icon ?? <CornerDownLeft size={16} strokeWidth={1.75} />} label={item.label} meta={item.meta}
        end={item.shortcut ? <Kbd keys={item.shortcut} size="sm" className={styles.kbd} /> : undefined} />;
    }
    if (entry.kind === "ask") {
      return <Row key={entry.key} {...common} icon={modelMark} label={<>Ask <span className={styles.quoted}>“{entry.question}”</span></>}
        end={<Kbd keys={mode === "search" ? "tab" : "enter"} size="sm" className={styles.kbd} />} />;
    }
    if (entry.kind === "question") {
      return <Row key={entry.key} {...common} icon={<MessageSquare size={16} strokeWidth={1.75} />} label={entry.question} />;
    }
    const { action } = entry;
    const state = actionStates[action.id];
    const status = state?.status ?? "idle";
    const label = state ? state.label : action.label;
    const meta = status === "done" ? action.doneMeta ?? action.meta : status === "error" ? "Press Enter to try again" : action.meta;
    const end = status === "running" ? <Spinner /> : status === "done" ? <span className={styles.done}><DrawnCheck reduced={reduced} /></span>
      : status === "error" ? <span className={styles.failed}><CircleAlert size={16} strokeWidth={1.75} /></span> : null;
    return <Row key={entry.key} {...common} status={status} icon={action.mark}
      label={<Swap id={`${status}:${label}`} reduced={reduced}>{label}</Swap>}
      meta={meta ? <Swap id={`${status}:${meta}`} reduced={reduced}>{meta}</Swap> : undefined}
      end={<span className={styles.statusSlot}><AnimatePresence initial={false} mode="popLayout">
        {end ? <motion.span key={status} className={styles.statusIcon} initial={{ opacity: 0, scale: reduced ? 1 : .7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: reduced ? 1 : .7 }} transition={{ duration: .14, ease }}>{end}</motion.span> : null}
      </AnimatePresence></span>} />;
  };

  const list = (
    <div ref={listRef} className={styles.list} role="listbox" id={listId} aria-label={view === "answer" ? "Suggested actions" : view === "prompt" ? "Questions" : "Results"}>
      <div ref={highlightRef} className={styles.highlight} aria-hidden="true" />
      {noResults ? <div className={styles.empty}>No pages or actions match “{trimmed}”</div> : null}
      {groups.map((group, index) => <div key={group.heading ?? index} role="group" aria-label={group.heading} className={styles.group}>
        {group.heading ? <div className={styles.groupHead} aria-hidden="true">{group.heading}</div> : null}
        {group.entries.map(entryRow)}
      </div>)}
    </div>
  );

  const sourceCount = answer.sources.length;
  const phase = answer.status === "error" ? "error" : answer.status === "done" ? "done" : answer.status === "streaming" ? "streaming" : "thinking";
  const phaseLabel = phase === "error" ? "Couldn't get an answer"
    : phase === "done" ? (sourceCount ? `Answered from ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : "Answered")
    : phase === "streaming" ? (sourceCount ? `Reading ${sourceCount} source${sourceCount === 1 ? "" : "s"}` : "Writing") : thinkingLabel;

  const openSource = (source: AiCommandSource) => {
    if (source.href) { window.open(source.href, "_blank", "noopener,noreferrer"); return; }
    if (onSourceSelect) { onSourceSelect(source); return; }
    showFlash(`${source.title}, preview simulated`);
    announce(`${source.description ?? source.title}. Simulated, nothing was opened.`);
  };

  const cite = (n: number, key: number) => {
    const source = answer.sources[n - 1]!;
    return <button key={key} type="button" className={styles.cite} data-focused={focusedSource === n ? "" : undefined}
      aria-label={`Source ${n}: ${source.description ?? source.title}`}
      onPointerEnter={() => setFocusedSource(n)} onPointerLeave={() => setFocusedSource(null)} onFocus={() => setFocusedSource(n)} onBlur={() => setFocusedSource(null)}
      onClick={() => openSource(source)}>{n}</button>;
  };

  /* Text and citations. The word before a citation and the citation share one unbreakable span, so a marker never wraps alone. */
  const renderChunk = (chunk: string, index: number) => {
    const out: ReactNode[] = [];
    const parts = chunk.split(/(\[\d+\])/);
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const marker = /^\[(\d+)\]$/.exec(part);
      if (marker) { out.push(answer.sources[Number(marker[1]) - 1] ? cite(Number(marker[1]), i) : part); continue; }
      const next = /^\[(\d+)\]$/.exec(parts[i + 1] ?? "");
      if (!next || !answer.sources[Number(next[1]) - 1]) { if (part) out.push(part); continue; }
      const word = /^([\s\S]*?)(\S*)\s*$/.exec(part)!;
      if (word[1]) out.push(word[1]);
      // Punctuation right after the marker joins the span too, so a lone period never starts a line.
      const tail = /^[.,;:!?)]+/.exec(parts[i + 2] ?? "")?.[0] ?? "";
      if (tail) parts[i + 2] = parts[i + 2]!.slice(tail.length);
      out.push(<span key={`w${i}`} className={styles.nowrap}>{word[2]}{cite(Number(next[1]), i + 1)}{tail}</span>);
      i++;
    }
    return <span key={index} className={styles.chunk}>{out}</span>;
  };


  const answerBody = (
    <div className={styles.answer}>
      <div className={styles.status}>
        <span className={cx(styles.icon, phase === "error" && styles.failed)} aria-hidden="true">
          <Swap id={phase === "error" ? "error" : "model"} reduced={reduced}>{phase === "error" ? <CircleAlert size={16} strokeWidth={1.75} /> : modelMark}</Swap>
        </span>
        <Swap id={phaseLabel} reduced={reduced} className={styles.statusLabel}>
          {phase === "thinking" || phase === "streaming" ? <TextShimmer duration={1.4}>{phaseLabel}</TextShimmer> : phaseLabel}
        </Swap>
        <span className={styles.statusEnd}>
          {phase === "done" && answer.elapsed !== undefined ? <motion.span className={styles.elapsed} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .16 }}>{formatSeconds(answer.elapsed)}</motion.span> : null}
          {phase === "done" ? <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: .16 }} className={styles.copyWrap}>
            <CopyButton value={plainAnswer(answer.text ?? "", answer.sources)} label="Copy answer" iconOnly variant="plain" onCopied={() => announce("Answer copied")} />
          </motion.span> : null}
          {phase === "error" ? <Button size="sm" variant="secondary" onPointerDown={event => event.preventDefault()} onClick={() => { ask(answer.question); inputRef.current?.focus({ preventScroll: true }); }}>
            <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry
          </Button> : null}
        </span>
      </div>
      {sourceCount ? <div className={styles.sources} role="list" aria-label="Sources">
        {answer.sources.map((source, index) => <motion.button key={source.id} type="button" role="listitem" className={styles.source}
          data-focused={focusedSource === index + 1 ? "" : undefined} title={source.description ?? source.title}
          aria-label={`Source ${index + 1}: ${source.description ?? source.title}`}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .16, ease, delay: reduced ? 0 : index * .03 }}
          onPointerEnter={() => setFocusedSource(index + 1)} onPointerLeave={() => setFocusedSource(null)} onFocus={() => setFocusedSource(index + 1)} onBlur={() => setFocusedSource(null)}
          onClick={() => openSource(source)}>
          <span className={styles.sourceNum}>{index + 1}</span>
          {source.mark ? <span className={styles.sourceMark} aria-hidden="true">{source.mark}</span> : null}
          <span className={styles.sourceTitle}>{source.title}</span>
        </motion.button>)}
      </div> : null}
      {phase === "error" ? <p className={styles.errorText}>{answer.error}</p> : chunks.length ? <p className={styles.text}>{chunks.map(renderChunk)}</p> : null}
    </div>
  );

  const hints: { key: HintKey | "nav"; label: string }[] = view === "search" ? [{ key: "nav", label: "Navigate" }, { key: "enter", label: "Open" }, { key: "tab", label: "Ask AI" }]
    : view === "prompt" ? [{ key: "nav", label: "Navigate" }, { key: "enter", label: "Ask" }, { key: "esc", label: "Back" }]
    : [{ key: "nav", label: "Navigate" }, { key: "enter", label: answer.status === "error" ? "Retry" : "Run" }, { key: "esc", label: "Back" }];

  const rootStyle = { ...style, "--aic-height": `${height}px` } as CSSProperties;
  const viewMotion = {
    initial: { opacity: 0, y: reduced ? 0 : 2 },
    animate: { opacity: 1, y: 0, transition: { duration: .16, ease } },
    exit: { opacity: 0, transition: { duration: .1, ease } },
  };

  return <div ref={rootRef} className={cx(styles.root, elevated && styles.elevated, className)} style={rootStyle} data-mode={mode}
    role="search" aria-label={ariaLabel} onPointerDownCapture={takeOver} onKeyDownCapture={takeOver}>
    <div className={styles.bar}>
      <span className={styles.barIcon} aria-hidden="true">
        <Swap id={mode} reduced={reduced}>{mode === "search" ? <Search size={16} strokeWidth={1.75} /> : modelMark}</Swap>
      </span>
      <input ref={inputRef} className={styles.input} value={query} placeholder={placeholderText} spellCheck={false} autoComplete="off" autoCorrect="off"
        role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-label={mode === "search" ? "Search or ask" : "Ask AI"}
        aria-activedescendant={activeEntry ? optionId(activeEntry.key) : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} />
      <div className={styles.modes} role="group" aria-label="Mode" data-mode={mode}>
        <span className={styles.modePill} aria-hidden="true" />
        <button type="button" className={styles.modeButton} aria-pressed={mode === "search"} onPointerDown={event => event.preventDefault()}
          onClick={() => { if (mode !== "search") toSearch(); inputRef.current?.focus({ preventScroll: true }); }}>Search</button>
        <button type="button" className={styles.modeButton} aria-pressed={mode === "ask"} onPointerDown={event => event.preventDefault()}
          onClick={() => { if (mode !== "ask") toAsk(); inputRef.current?.focus({ preventScroll: true }); }}>Ask AI</button>
      </div>
    </div>

    <div className={styles.body}>
      <AnimatePresence initial={false}>
        {view === "answer"
          ? <motion.div key="answer" ref={answerView} data-view="answer" className={styles.view} {...viewMotion}
            onWheel={event => { if (event.deltaY < 0) follow.current = false; }} onTouchMove={() => { follow.current = false; }}>
            {answerBody}
            {groups.length ? <motion.div initial={{ opacity: 0, y: reduced ? 0 : 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18, ease }} className={styles.actions}>{list}</motion.div> : null}
          </motion.div>
          : <motion.div key={view} data-view={view} className={styles.view} {...viewMotion}>{list}</motion.div>}
      </AnimatePresence>
    </div>

    <div className={styles.footer}>
      <Swap id={flash ? `flash:${flash.id}` : "model"} reduced={reduced} className={styles.footerStart}>
        {flash
          ? <span className={styles.footerItem}><span className={cx(styles.footerIcon, styles.done)}><Check size={14} strokeWidth={2} aria-hidden="true" /></span><span className={styles.footerText}>{flash.text}</span></span>
          : <span className={styles.footerItem}><span className={styles.footerIcon} aria-hidden="true">{modelMark}</span><span className={styles.footerText}>{model.name}</span></span>}
      </Swap>
      <Swap id={hints.map(h => h.label).join("|")} reduced={reduced} className={styles.hints}>
        <span className={styles.hintRow} aria-hidden="true">
          {hints.map(hint => hint.key === "nav"
            ? <span key="nav" className={cx(styles.hint, styles.hintNav)}><Kbd keys="up" size="sm" pressed={pressed === "up"} /><Kbd keys="down" size="sm" pressed={pressed === "down"} />{hint.label}</span>
            : <span key={hint.key} className={styles.hint}><Kbd keys={hint.key} size="sm" pressed={pressed === hint.key} />{hint.label}</span>)}
        </span>
      </Swap>
    </div>
    <div className={styles.srOnly} role="status" aria-live="polite">{announcement}</div>
  </div>;
}

export default AiCommand;
