"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, CircleAlert, CircleDot, RotateCcw, Square, X } from "lucide-react";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { useKbdPlatform } from "../kbd/kbd";
import { motionTokens } from "../../lib/motion-tokens";
import { codeSuggestionSample } from "./code-suggestion-data";
import { highlightLine } from "./code-suggestion-highlight";
import { ClaudeMark, TypeScriptColorMark } from "./code-suggestion-marks";
import type { CodeSuggestionDecision, CodeSuggestionHunk, CodeSuggestionProps, CodeSuggestionStatus } from "./code-suggestion-types";
import styles from "./code-suggestion.module.css";

export type { CodeSuggestionDecision, CodeSuggestionHunk, CodeSuggestionModel, CodeSuggestionProps, CodeSuggestionResult, CodeSuggestionStatus } from "./code-suggestion-types";
export { codeSuggestionSample } from "./code-suggestion-data";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

/* Geometry: every code row is 20px and every review bar 40px, so heights animate between known numbers and never
   measure text. */
const ROW = 20;
const BAR = 40;

/* Simulation timing (ms): a short think, then each change opens (its removed lines tint red) and its new lines stream in. */
const THINK_MS = 820;
const OPEN_MS = 150;
const FIRST_LINE_MS = 190;
const LINE_MS = 38;
const SETTLE_MS = 140;

type Decision = CodeSuggestionDecision;
type Hunk = { id: string; start: number; remove: number; insert: string[]; summary?: string; source: CodeSuggestionHunk };
type Row =
  | { key: string; kind: "ctx"; text: string; num?: number }
  | { key: string; kind: "del" | "add"; text: string; num?: number; hunk: Hunk; decision: Decision }
  | { key: string; kind: "bar"; hunk: Hunk; index: number };

const defaultModel = { name: "Claude Sonnet 5.5", mark: <ClaudeMark aria-hidden="true" style={{ color: "#D97757" }} /> };

/** Sorts changes, clamps them to the file and drops any that overlap an earlier one. */
function normalize(hunks: CodeSuggestionHunk[], lineCount: number): Hunk[] {
  const sorted = [...hunks].sort((a, b) => a.start - b.start);
  const out: Hunk[] = [];
  let end = 0;
  for (const hunk of sorted) {
    const start = Math.min(Math.max(0, Math.floor(hunk.start)), lineCount);
    if (start < end) continue;
    const remove = Math.min(Math.max(0, hunk.remove ?? 0), lineCount - start);
    out.push({ id: hunk.id, start, remove, insert: hunk.insert ?? [], summary: hunk.summary, source: hunk });
    end = start + remove;
  }
  return out;
}

/** The file with accepted changes applied; pending and rejected changes keep the original lines. */
function applyHunks(lines: string[], hunks: Hunk[], decisions: Record<string, Decision>) {
  const out: string[] = [];
  let at = 0;
  for (const hunk of hunks) {
    out.push(...lines.slice(at, hunk.start));
    out.push(...(decisions[hunk.id] === "accepted" ? hunk.insert : lines.slice(hunk.start, hunk.start + hunk.remove)));
    at = hunk.start + hunk.remove;
  }
  out.push(...lines.slice(at));
  return out.join("\n");
}

/** The streaming schedule: one step opens a change, then one step per new line. */
function stepsFor(hunks: Hunk[]) {
  const steps: { hunk: number; lines: number }[] = [];
  hunks.forEach((hunk, index) => {
    steps.push({ hunk: index, lines: 0 });
    hunk.insert.forEach((_, line) => steps.push({ hunk: index, lines: line + 1 }));
  });
  return steps;
}

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

const CodeText = memo(function CodeText({ text }: { text: string }) {
  const nodes = useMemo(() => highlightLine(text), [text]);
  return <span className={styles.text}>{text ? nodes : "​"}</span>;
});

type Tone = "busy" | "review" | "done" | "muted" | "error";

export function CodeSuggestion({
  code: codeProp,
  hunks: hunksProp,
  status: statusProp,
  instruction = codeSuggestionSample.instruction,
  model = defaultModel,
  fileName = codeSuggestionSample.fileName,
  filePath = hunksProp === undefined ? codeSuggestionSample.filePath : undefined,
  fileMark,
  error,
  autoPlay = true,
  shortcuts = true,
  maxCodeHeight,
  onDecision,
  onResolve,
  onStop,
  onRegenerate,
  className,
  style,
}: CodeSuggestionProps) {
  const reduced = useReducedMotion() ?? false;
  const platform = useKbdPlatform();
  const simulated = hunksProp === undefined;
  const code = codeProp ?? (simulated ? codeSuggestionSample.code : "");
  const lines = useMemo(() => code.split("\n"), [code]);
  const source = useMemo(() => normalize(hunksProp ?? codeSuggestionSample.hunks, lines.length), [hunksProp, lines.length]);
  const steps = useMemo(() => stepsFor(source), [source]);

  const rootRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLDivElement>(null);

  /* ---- Simulation ---- */
  type Sim = { phase: "idle" | "thinking" | "streaming" | "ready"; step: number; stopped: boolean; run: number };
  const [sim, setSim] = useState<Sim>({ phase: "idle", step: 0, stopped: false, run: 0 });
  const [interacted, setInteracted] = useState(false);
  const [pressing, setPressing] = useState<string | null>(null);
  const visibleRef = useRef(false);
  const restartDueRef = useRef(false);

  const restart = useCallback((manual: boolean) => {
    restartDueRef.current = false;
    if (manual) setInteracted(true);
    setSim(previous => ({ phase: reduced ? "ready" : "thinking", step: 0, stopped: false, run: previous.run + 1 }));
  }, [reduced]);

  // Start when the card is mostly in view; under reduced motion open on the finished suggestion.
  useEffect(() => {
    if (!simulated) return;
    const begin = (phase: "thinking" | "ready") => setSim(previous => previous.phase === "idle" ? { ...previous, phase } : previous);
    const node = rootRef.current;
    if (reduced || !node || typeof IntersectionObserver === "undefined") {
      visibleRef.current = true;
      const frame = requestAnimationFrame(() => begin(reduced ? "ready" : "thinking"));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (!entry.isIntersecting) return;
      begin("thinking");
      if (restartDueRef.current) restart(false);
    }, { threshold: .35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [simulated, reduced, restart]);

  // Thinking, then one streaming step at a time.
  useEffect(() => {
    if (!simulated) return;
    let timer: number | undefined;
    if (sim.phase === "thinking") timer = window.setTimeout(() => setSim(previous => ({ ...previous, phase: "streaming", step: 0 })), THINK_MS);
    else if (sim.phase === "streaming") {
      if (sim.step >= steps.length) timer = window.setTimeout(() => setSim(previous => ({ ...previous, phase: "ready" })), SETTLE_MS);
      else {
        const next = steps[sim.step];
        const delay = next.lines === 0 ? (sim.step === 0 ? 0 : OPEN_MS) : next.lines === 1 ? (source[next.hunk].remove ? FIRST_LINE_MS : OPEN_MS / 2) : LINE_MS;
        timer = window.setTimeout(() => setSim(previous => ({ ...previous, step: previous.step + 1 })), delay);
      }
    }
    return () => window.clearTimeout(timer);
  }, [simulated, sim.phase, sim.step, steps, source]);

  const status: CodeSuggestionStatus = simulated ? (sim.phase === "idle" ? "thinking" : sim.phase) : statusProp ?? "ready";

  /* The changes on screen: the simulation reveals them step by step; a stop keeps only finished changes. */
  const hunks = useMemo<Hunk[]>(() => {
    if (!simulated) return source;
    if (sim.phase === "idle" || sim.phase === "thinking") return [];
    if (sim.phase === "ready" && !sim.stopped) return source;
    const last = steps[sim.step - 1];
    if (!last) return [];
    if (sim.phase === "ready") return source.slice(0, last.lines === source[last.hunk].insert.length ? last.hunk + 1 : last.hunk);
    return source.slice(0, last.hunk + 1).map((hunk, index) => index === last.hunk ? { ...hunk, insert: hunk.insert.slice(0, last.lines) } : hunk);
  }, [simulated, source, steps, sim.phase, sim.step, sim.stopped]);

  /* ---- Decisions ---- */
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const decisionsRef = useRef(decisions);
  const [lastAction, setLastAction] = useState("");
  // A new run (or a controlled suggestion going back to thinking) starts with every change pending again.
  const [runSeen, setRunSeen] = useState(sim.run);
  if (runSeen !== sim.run || (!simulated && status === "thinking" && Object.keys(decisions).length)) {
    setRunSeen(sim.run);
    setDecisions({});
    setLastAction("");
  }
  useEffect(() => { decisionsRef.current = decisions; }, [decisions]);
  const callbacks = useRef({ onDecision, onResolve });
  useEffect(() => { callbacks.current = { onDecision, onResolve }; });

  const decisionOf = (id: string): Decision => decisions[id] ?? "pending";
  const pendingIds = status === "ready" ? hunks.filter(hunk => decisionOf(hunk.id) === "pending").map(hunk => hunk.id) : [];
  const acceptedCount = hunks.filter(hunk => decisionOf(hunk.id) === "accepted").length;
  const rejectedCount = hunks.filter(hunk => decisionOf(hunk.id) === "rejected").length;
  const resolved = status === "ready" && hunks.length > 0 && pendingIds.length === 0;

  const decide = useCallback((ids: string[], decision: Exclude<Decision, "pending">, moveFocus = false) => {
    const next = { ...decisionsRef.current };
    const changed = ids.filter(id => (next[id] ?? "pending") === "pending");
    if (!changed.length) return;
    changed.forEach(id => { next[id] = decision; });
    decisionsRef.current = next;
    setDecisions(next);
    const verb = decision === "accepted" ? "Accepted" : "Rejected";
    const one = hunks.find(hunk => hunk.id === changed[0]);
    setLastAction(changed.length > 1 ? `${verb} ${changed.length} changes` : `${verb}: ${one?.summary ?? `change ${hunks.indexOf(one!) + 1}`}`);
    const merged = applyHunks(lines, hunks, next);
    changed.forEach(id => { const hunk = hunks.find(item => item.id === id); if (hunk) callbacks.current.onDecision?.(hunk.source, decision, merged); });
    if (hunks.every(hunk => next[hunk.id] && next[hunk.id] !== "pending")) {
      callbacks.current.onResolve?.({ code: merged, accepted: hunks.filter(hunk => next[hunk.id] === "accepted").map(hunk => hunk.id), rejected: hunks.filter(hunk => next[hunk.id] === "rejected").map(hunk => hunk.id) });
    }
    if (!moveFocus) return;
    // The control that was pressed leaves with its change: hand focus to the next change, or to the code.
    requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root || !root.contains(document.activeElement) && document.activeElement !== document.body) return;
      const nextId = hunks.find(hunk => (next[hunk.id] ?? "pending") === "pending")?.id;
      const target = nextId ? root.querySelector<HTMLElement>(`[data-accept="${CSS.escape(nextId)}"]`) : null;
      (target ?? codeRef.current)?.focus({ preventScroll: true });
    });
  }, [hunks, lines]);

  const acceptAll = useCallback((moveFocus = false) => decide(hunks.map(hunk => hunk.id), "accepted", moveFocus), [decide, hunks]);
  const rejectAll = useCallback((moveFocus = false) => decide(hunks.map(hunk => hunk.id), "rejected", moveFocus), [decide, hunks]);

  /* ---- Autoplay: review the sample on its own, alternating one by one and Accept all, until someone touches it ---- */
  const autoplaying = simulated && autoPlay && !reduced && !interacted;
  useEffect(() => {
    if (!autoplaying || sim.phase !== "ready" || sim.stopped) return;
    const timers: number[] = [];
    const at = (ms: number, run: () => void) => timers.push(window.setTimeout(run, ms));
    const press = (ms: number, key: string, run: () => void) => { at(ms, () => setPressing(key)); at(ms + 170, () => { setPressing(null); run(); }); };
    if (sim.run % 2 === 0) {
      const [first, second, third] = source;
      if (first) press(1300, `accept:${first.id}`, () => decide([first.id], "accepted"));
      if (second) press(2150, `accept:${second.id}`, () => decide([second.id], "accepted"));
      if (third) press(3000, `reject:${third.id}`, () => decide([third.id], "rejected"));
      source.slice(3).forEach((hunk, index) => press(3850 + index * 850, `accept:${hunk.id}`, () => decide([hunk.id], "accepted")));
    } else press(1500, "accept-all", () => decide(source.map(hunk => hunk.id), "accepted"));
    return () => { timers.forEach(timer => window.clearTimeout(timer)); setPressing(null); };
  }, [autoplaying, sim.phase, sim.stopped, sim.run, source, decide]);

  useEffect(() => {
    if (!autoplaying || !resolved) return;
    const timer = window.setTimeout(() => { if (visibleRef.current) restart(false); else restartDueRef.current = true; }, 2600);
    return () => window.clearTimeout(timer);
  }, [autoplaying, resolved, restart]);

  const stopAutoplay = () => { if (autoplaying) setInteracted(true); };

  /* ---- Rows ---- */
  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    let at = 0;
    const context = (until: number) => { for (; at < until; at++) out.push({ key: `c${at}`, kind: "ctx", text: lines[at] }); };
    hunks.forEach((hunk, index) => {
      context(hunk.start);
      const decision = decisions[hunk.id] ?? "pending";
      if (decision !== "accepted") for (let line = 0; line < hunk.remove; line++) out.push({ key: `c${hunk.start + line}`, kind: "del", text: lines[hunk.start + line], hunk, decision });
      if (decision !== "rejected") hunk.insert.forEach((text, line) => out.push({ key: `${hunk.id}+${line}`, kind: "add", text, hunk, decision }));
      if (status === "ready" && decision === "pending") out.push({ key: `${hunk.id}-bar`, kind: "bar", hunk, index });
      at = hunk.start + hunk.remove;
    });
    context(lines.length);
    // Numbers follow the file as it would read: context, new lines, and removed lines only once their change is rejected.
    let num = 0;
    for (const row of out) {
      if (row.kind === "ctx" || (row.kind === "add" && row.decision !== "rejected") || (row.kind === "del" && row.decision === "rejected")) row.num = ++num;
    }
    return out;
  }, [hunks, lines, decisions, status]);

  const added = hunks.reduce((sum, hunk) => sum + (decisionOf(hunk.id) === "rejected" ? 0 : hunk.insert.length), 0);
  const removed = hunks.reduce((sum, hunk) => sum + (decisionOf(hunk.id) === "rejected" ? 0 : hunk.remove), 0);

  /* ---- Status line ---- */
  const stopped = simulated && sim.stopped;
  let tone: Tone = "busy";
  let label: string;
  if (status === "thinking") label = `Reading ${fileName}`;
  else if (status === "streaming") label = "Writing changes";
  else if (status === "error") { tone = "error"; label = error ?? "The model stopped responding. Nothing was changed."; }
  else if (!hunks.length) { tone = "muted"; label = stopped ? "Stopped before any changes" : "No changes needed"; }
  else if (pendingIds.length) { tone = "review"; label = `${plural(pendingIds.length, "change")} to review`; }
  else if (acceptedCount === hunks.length) { tone = "done"; label = hunks.length === 1 ? "Change applied" : "All changes applied"; }
  else if (rejectedCount === hunks.length) { tone = "muted"; label = "Suggestion rejected"; }
  else { tone = "done"; label = `${acceptedCount} applied, ${rejectedCount} rejected`; }
  if (stopped && pendingIds.length) label = `Stopped early, ${plural(pendingIds.length, "change")} to review`;

  // The icon is keyed by its kind, not the label, so the spinner keeps turning from Reading to Writing and a count change
  // ("3 changes" to "2 changes") swaps only the text.
  const allRejected = status === "ready" && hunks.length > 0 && rejectedCount === hunks.length;
  const iconKind = tone === "muted" && allRejected ? "rejected" : tone;
  const icon = iconKind === "busy" ? <Spinner />
    : iconKind === "review" ? <CircleDot size={16} strokeWidth={1.75} />
    : iconKind === "done" ? <Check size={16} strokeWidth={2} />
    : iconKind === "error" ? <CircleAlert size={16} strokeWidth={1.75} />
    : iconKind === "rejected" ? <X size={16} strokeWidth={1.75} />
    : <Check size={16} strokeWidth={1.75} />;

  const announcement = status === "streaming" ? "Writing changes"
    : [lastAction, label, resolved && simulated ? "Simulated, nothing was written to disk" : ""].filter(Boolean).join(". ");

  /* ---- Footer actions ---- */
  const canStop = (status === "thinking" || status === "streaming") && (simulated || !!onStop);
  const canRegenerate = simulated || !!onRegenerate;
  const mode = canStop ? "busy"
    : status === "error" ? (canRegenerate ? "error" : "none")
    : pendingIds.length ? "review"
    : status === "ready" && canRegenerate ? "done"
    : "none";
  // The footer control that was pressed fades out with its state, so focus moves to the code instead of the page.
  const focusCode = () => requestAnimationFrame(() => codeRef.current?.focus({ preventScroll: true }));
  const stop = () => { if (simulated) setSim(previous => ({ ...previous, phase: "ready", stopped: true })); onStop?.(); focusCode(); };
  const regenerate = () => { if (simulated) restart(true); onRegenerate?.(); focusCode(); };
  const mod = platform === "mac" ? "⌘" : "Ctrl";

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    stopAutoplay();
    if (!shortcuts || !(event.metaKey || event.ctrlKey) || status !== "ready" || !pendingIds.length) return;
    if (event.key === "Enter") { event.preventDefault(); acceptAll(true); }
    else if (event.key === "Backspace") { event.preventDefault(); rejectAll(true); }
  };

  // Keep the review bar pinned to the visible width when long lines scroll sideways.
  useEffect(() => {
    const node = codeRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => node.style.setProperty("--cs-viewport", `${node.clientWidth}px`));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* ---- Motion ---- */
  const enter: Transition = reduced ? { duration: 0 } : { height: { duration: .12, ease: [...motionTokens.ease.enter] }, opacity: { duration: .15, ease: "easeOut" } };
  const leave: Transition = reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .26, bounce: 0 }, opacity: { duration: .12, ease: "easeOut" } };
  const swap: Transition = reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
  const fadeOut: Transition = reduced ? { duration: 0 } : { duration: .1, ease: "easeOut" };

  const markNode = fileMark === undefined ? <TypeScriptColorMark aria-hidden="true" /> : fileMark;

  const renderRow = (row: Row): ReactNode => {
    if (row.kind === "bar") {
      const { hunk, index } = row;
      const what = hunk.summary ?? `change ${index + 1}`;
      return <motion.div key={row.key} className={styles.barRow} data-hunk-bar=""
        initial={{ height: 0, opacity: 0 }} animate={{ height: BAR, opacity: 1 }} exit={{ height: 0, opacity: 0, transition: leave }}
        transition={reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .24, bounce: 0 }, opacity: { duration: .16, ease: "easeOut" } }}>
        <div className={styles.bar}>
          <span className={styles.barSummary}>{hunk.summary ?? `Change ${index + 1} of ${hunks.length}`}</span>
          <div className={styles.barActions}>
            <Button size="sm" variant="ghost" className={cx(styles.hunkButton, styles.reject)} data-pressing={pressing === `reject:${hunk.id}` || undefined}
              aria-label={`Reject ${what}`} onClick={() => decide([hunk.id], "rejected", true)}>Reject</Button>
            <Button size="sm" variant="primary" className={cx(styles.hunkButton, styles.accept)} data-pressing={pressing === `accept:${hunk.id}` || undefined}
              data-accept={hunk.id} aria-label={`Accept ${what}`} onClick={() => decide([hunk.id], "accepted", true)}>Accept</Button>
          </div>
        </div>
      </motion.div>;
    }
    const decision = row.kind === "ctx" ? undefined : row.decision;
    return <motion.div key={row.key} className={styles.row} data-kind={row.kind} data-decision={decision}
      initial={{ height: 0, opacity: 0 }} animate={{ height: ROW, opacity: 1 }} exit={{ height: 0, opacity: 0, transition: leave }} transition={enter}>
      <span className={styles.gutter} aria-hidden="true">
        <span className={styles.num}>{row.num ?? ""}</span>
        <span className={styles.sign}>{row.kind === "add" ? "+" : row.kind === "del" ? "−" : ""}</span>
      </span>
      {row.kind !== "ctx" && decision === "pending" ? <span className={styles.srOnly}>{row.kind === "add" ? "Added: " : "Removed: "}</span> : null}
      <CodeText text={row.text} />
    </motion.div>;
  };

  return <div ref={rootRef} role="group" aria-label={`Code suggestion: ${instruction}`} className={cx(styles.root, className)} style={style}
    data-status={status} onKeyDown={onKeyDown} onPointerMove={stopAutoplay} onPointerDown={stopAutoplay}>
    <header className={styles.header}>
      {model?.mark ? <span className={styles.modelMark} aria-hidden="true">{model.mark}</span> : <span className={styles.modelMark} aria-hidden="true" />}
      <p className={styles.instruction}>{instruction}</p>
      {model ? <p className={styles.model}>{model.name}</p> : null}
    </header>

    <div className={styles.editor}>
      <div className={styles.tabs}>
        <span className={styles.tab}>
          {markNode ? <span className={styles.fileMark} aria-hidden="true">{markNode}</span> : null}
          <span className={styles.fileName}>{fileName}</span>
          {filePath ? <span className={styles.filePath}>{filePath}</span> : null}
        </span>
        <span className={styles.stats}>
          <span className={styles.srOnly}>{`${added} lines added, ${removed} removed`}</span>
          <span className={styles.statAdd} data-zero={added === 0 || undefined} aria-hidden="true">+{added}</span>
          <span className={styles.statDel} data-zero={removed === 0 || undefined} aria-hidden="true">−{removed}</span>
        </span>
      </div>
      <div ref={codeRef} className={styles.code} tabIndex={0} role="region" aria-label={`Suggested changes to ${fileName}`}
        style={maxCodeHeight ? { maxHeight: maxCodeHeight, overflowY: "auto" } : undefined}>
        <div className={styles.lines}>
          <AnimatePresence initial={false}>
            {rows.map(row => renderRow(row))}
          </AnimatePresence>
        </div>
      </div>
    </div>

    <div className={styles.footer}>
      {/* Icon, label and actions each crossfade in a one cell grid, so old and new overlap in place and nothing reflows. */}
      <div className={styles.status} aria-hidden="true">
        <span className={styles.statusIcon}>
          <AnimatePresence initial={false}>
            <motion.span key={iconKind} data-tone={tone} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: fadeOut }} transition={swap}>
              {icon}
            </motion.span>
          </AnimatePresence>
        </span>
        <span className={styles.statusLabel}>
          <AnimatePresence initial={false}>
            <motion.span key={label} data-tone={tone} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: fadeOut }} transition={swap}>
              {tone === "busy" ? <TextShimmer className={styles.statusText}>{label}</TextShimmer> : <span className={styles.statusText}>{label}</span>}
            </motion.span>
          </AnimatePresence>
        </span>
      </div>
      <div className={styles.actionsSlot}>
        <AnimatePresence initial={false}>
          {mode === "none" ? null : <motion.div key={mode} className={styles.actions} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: fadeOut }} transition={swap}>
            {mode === "busy" ? <Button size="sm" variant="secondary" className={styles.footButton} onClick={stop}>
              <Square size={11} strokeWidth={0} fill="currentColor" aria-hidden="true" />Stop
            </Button> : null}
            {mode === "review" ? <>
              <Button size="sm" variant="secondary" className={styles.footButton} onClick={() => rejectAll(true)}
                aria-keyshortcuts={shortcuts ? "Meta+Backspace Control+Backspace" : undefined}>Reject all</Button>
              <Button size="sm" variant="primary" className={cx(styles.footButton, styles.accept)} data-pressing={pressing === "accept-all" || undefined}
                onClick={() => acceptAll(true)} aria-keyshortcuts={shortcuts ? "Meta+Enter Control+Enter" : undefined}>
                Accept all{shortcuts ? <span className={styles.shortcut} aria-hidden="true">{mod}↵</span> : null}
              </Button>
            </> : null}
            {mode === "done" || mode === "error" ? <Button size="sm" variant="secondary" className={styles.footButton} onClick={regenerate}>
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />{mode === "error" ? "Retry" : "Regenerate"}
            </Button> : null}
          </motion.div>}
        </AnimatePresence>
      </div>
    </div>
    <p className={styles.srOnly} aria-live="polite" role="status">{announcement}</p>
  </div>;
}

export default CodeSuggestion;
