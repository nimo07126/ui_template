"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls, Transition } from "motion/react";
import { Check, CircleAlert, Minus, Play, Plus, RotateCcw, Search, Square, X } from "lucide-react";
import { Button } from "../../button/button";
import { Kbd } from "../kbd/kbd";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import { workflowSampleCatalog, workflowSampleSteps } from "./ai-workflow-data";
import type { WorkflowApp, WorkflowCatalogItem, WorkflowOutput, WorkflowStep, WorkflowStepKind } from "./ai-workflow-data";
import { workflowApps } from "./ai-workflow-marks";
import styles from "./ai-workflow.module.css";

export type { WorkflowApp, WorkflowAppId, WorkflowCatalogItem, WorkflowOutput, WorkflowPath, WorkflowStep, WorkflowStepKind } from "./ai-workflow-data";
export { workflowFailingSteps, workflowSampleCatalog, workflowSampleSteps } from "./ai-workflow-data";

export type WorkflowStepStatus = "idle" | "running" | "done" | "error" | "skipped";
export type WorkflowRunStatus = "idle" | "running" | "passed" | "failed" | "stopped";

export interface WorkflowRunContext {
  /** Aborts when the person presses Stop, starts a new run or the component unmounts. */
  signal: AbortSignal;
  /** Outputs of the steps that already ran in this run, by step id. */
  previous: Record<string, WorkflowOutput>;
  /** 0 on the first try, 1 after one Retry, and so on. */
  attempt: number;
}

export interface WorkflowRunResult {
  status: "passed" | "failed";
  durationMs: number;
  outputs: Record<string, WorkflowOutput>;
  failedStepId?: string;
}

export interface AiWorkflowProps {
  /** Workflow name in the header. */
  title?: string;
  /** One line under the name. */
  description?: string;
  /** Controlled steps. Pair with `onStepsChange` to keep adding and removing steps. */
  steps?: WorkflowStep[];
  /** Initial steps when uncontrolled. Defaults to the Gmail, Claude, Slack and Linear sample. */
  defaultSteps?: WorkflowStep[];
  onStepsChange?: (steps: WorkflowStep[]) => void;
  /** Entries in the add step menu. Pass an empty array to hide the menu. */
  catalog?: WorkflowCatalogItem[];
  /** Runs one step for real. Throw to fail the step; a branch returns `{ type: "route", pathId }`. Without it every run is simulated. */
  onRunStep?: (step: WorkflowStep, context: WorkflowRunContext) => Promise<WorkflowOutput | void>;
  onRunComplete?: (result: WorkflowRunResult) => void;
  /** Shows skeleton steps while your flow loads. */
  loading?: boolean;
  /** Plays a test run when scrolled into view and repeats it until someone interacts. */
  autoPlay?: boolean;
  /** Shows the add menu and remove buttons. */
  editable?: boolean;
  className?: string;
}

interface StepRun { status: WorkflowStepStatus; output?: WorkflowOutput; error?: string; ms?: number }

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const TRAVEL_MS = 240;
const STEP_GAP_MS = 120;
const kindLabel: Record<WorkflowStepKind, string> = { trigger: "Trigger", ai: "AI step", action: "Action", branch: "Branch" };
const defaultActivity: Record<WorkflowStepKind, string> = { trigger: "Waiting for the event", ai: "Thinking", action: "Working", branch: "Checking the rule" };
const defaultDuration: Record<WorkflowStepKind, number> = { trigger: 420, ai: 1000, action: 620, branch: 260 };
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
/** Critically damped: measured height on a bounce-free spring, opacity on a short tween. */
const fold = (reduced: boolean): Transition => reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .22, bounce: 0 }, opacity: { duration: .16, ease } };
const swapIn = { opacity: 1, y: 0, transition: { duration: .16, ease } };
const swapOut = { opacity: 0, transition: { duration: .1, ease } };

function formatDuration(ms?: number) {
  if (ms === undefined || !Number.isFinite(ms)) return "";
  return ms < 1000 ? `${Math.max(1, Math.round(ms))}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function appName(app: WorkflowApp) {
  return typeof app === "string" ? workflowApps[app].name : app.name;
}

function AppMark({ app, size = 16 }: { app: WorkflowApp; size?: number }) {
  if (typeof app !== "string") return <>{app.mark}</>;
  const { Mark, name } = workflowApps[app];
  return <Mark width={size} height={size} title={name} aria-hidden="true" />;
}

function summarize(output?: WorkflowOutput | void) {
  if (!output) return "done";
  switch (output.type) {
    case "email": return `${output.from}, ${output.subject}`;
    case "label": return output.confidence !== undefined ? `${output.label}, ${Math.round(output.confidence * 100)}% confidence` : output.label;
    case "route": return output.note ?? `took the ${output.pathId} path`;
    case "message": return `posted to ${output.channel}`;
    case "record": return `${output.id}, ${output.title}`;
    case "text": return output.text;
  }
}

function abortError() {
  return new DOMException("The run was stopped.", "AbortError");
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
    function stop() { window.clearTimeout(timer); reject(abortError()); }
    signal.addEventListener("abort", stop, { once: true });
  });
}

function countSteps(steps: WorkflowStep[]): number {
  return steps.reduce((total, step) => total + 1 + (step.paths ?? []).reduce((sum, path) => sum + countSteps(path.steps), 0), 0);
}

function findStep(steps: WorkflowStep[], id: string): WorkflowStep | undefined {
  for (const step of steps) {
    if (step.id === id) return step;
    for (const path of step.paths ?? []) { const hit = findStep(path.steps, id); if (hit) return hit; }
  }
  return undefined;
}

function removeStep(steps: WorkflowStep[], id: string): WorkflowStep[] {
  return steps.filter(step => step.id !== id).map(step => step.paths ? { ...step, paths: step.paths.map(path => ({ ...path, steps: removeStep(path.steps, id) })) } : step);
}

/** Springs a box to its content height whenever the content changes, and cuts straight to it on a width change. */
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
      controls = animate(box, { height: [from, nextHeight] }, { type: "spring", visualDuration: .2, bounce: 0, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [reduced]);
  return { outer, inner };
}

function Spinner() {
  return <svg className={styles.spinner} width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

/** Fast chunked streaming: the full text holds its final layout from the first frame and chunks only fade in. */
function StreamedText({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  const chunks = useMemo(() => {
    const words = text.split(/(?<=\s)/);
    const next: string[] = [];
    for (let index = 0; index < words.length; index += 5) next.push(words.slice(index, index + 5).join(""));
    return next;
  }, [text]);
  const total = chunks.length;
  const [shown, setShown] = useState(reduced ? total : 0);
  const [prev, setPrev] = useState({ text, reduced });
  if (prev.text !== text || prev.reduced !== reduced) {
    setPrev({ text, reduced });
    setShown(reduced ? total : 0);
  }
  useEffect(() => {
    if (reduced) return;
    let count = 0;
    const timer = window.setInterval(() => { count += 1; setShown(count); if (count >= total) window.clearInterval(timer); }, 34);
    return () => window.clearInterval(timer);
  }, [text, total, reduced]);
  return <p className={className}>{chunks.map((chunk, index) => <span key={index} className={styles.chunk} data-shown={index < shown || undefined}>{chunk}</span>)}</p>;
}

const urgentLabel = /urgent|critical|outage|blocker/i;

function OutputView({ output, reduced }: { output: WorkflowOutput; reduced: boolean }) {
  switch (output.type) {
    case "email": return <>
      <p className={styles.outLine}><span className={styles.name}>{output.from}</span>{output.address ? <span className={styles.mono}>{output.address}</span> : null}</p>
      <p className={cx(styles.outStrong, styles.clamp1)}>{output.subject}</p>
      <p className={styles.clamp1}>{output.preview}</p>
    </>;
    case "label": return <>
      <p className={styles.outLine}>
        <span className={styles.label}><span className={styles.labelDot} data-tone={urgentLabel.test(output.label) ? "urgent" : undefined} aria-hidden="true" />{output.label}</span>
        {output.confidence !== undefined ? <span className={styles.mono}>{output.confidence.toFixed(2)} confidence</span> : null}
      </p>
      {output.reason ? <StreamedText text={output.reason} reduced={reduced} /> : null}
    </>;
    case "route": return <p>{output.note ?? `Took the ${output.pathId} path.`}</p>;
    case "message": return <>
      <p className={styles.outLine}><span className={styles.name}>{output.author}</span><span className={styles.muted}>{output.channel}</span><span className={styles.muted}>now</span></p>
      <p className={styles.clamp2}>{output.text}</p>
    </>;
    case "record": return <>
      <p className={styles.outLine}><span className={styles.mono}>{output.id}</span><span className={cx(styles.outStrong, styles.clamp1)}>{output.title}</span></p>
      {output.meta ? <p className={cx(styles.muted, styles.clamp1)}>{output.meta}</p> : null}
    </>;
    case "text": return <StreamedText text={output.text} reduced={reduced} />;
  }
}

type ConnectorState = "idle" | "active" | "done";

function StatusSlot({ kind, run }: { kind: WorkflowStepKind; run: StepRun }) {
  const { status } = run;
  const content = status === "running" ? <><Spinner /><span>Running</span></>
    : status === "done" ? <><Check size={14} strokeWidth={2} /><span className={styles.tabular}>{formatDuration(run.ms)}</span></>
      : status === "error" ? <><CircleAlert size={14} strokeWidth={2} /><span>Failed</span></>
        : status === "skipped" ? <><Minus size={14} strokeWidth={2} /><span>Skipped</span></>
          : <span>{kindLabel[kind]}</span>;
  return <span className={styles.status} aria-hidden="true">
    <AnimatePresence initial={false}>
      <motion.span key={status} className={styles.statusInner} data-status={status} initial={{ opacity: 0, y: 2 }} animate={swapIn} exit={swapOut}>
        {content}
      </motion.span>
    </AnimatePresence>
  </span>;
}

interface StepNodeProps {
  step: WorkflowStep;
  run: StepRun;
  /** The line into this step, or null for the first step. */
  head: ConnectorState | null;
  /** Whether a line leaves this step toward the next one. */
  tail: boolean;
  reduced: boolean;
  removable: boolean;
  busy: boolean;
  onRemove: () => void;
  onRetry: () => void;
  children?: ReactNode;
}

const itemMotion = (reduced: boolean) => ({
  initial: reduced ? false as const : { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: reduced ? { opacity: 0, transition: { duration: 0 } } : { height: 0, opacity: 0 },
  transition: fold(reduced),
});

/** The connector into a step: a 1px hairline, an accent fill once the run has passed, and a small dot gliding down it. */
function Head({ state, reduced }: { state: ConnectorState; reduced: boolean }) {
  return <>
    <span className={styles.head} aria-hidden="true"><span className={styles.fill} data-state={state} /></span>
    {state === "active" && !reduced ? <span className={styles.dot} aria-hidden="true" /> : null}
  </>;
}

function StepNode({ step, run, head, tail, reduced, removable, busy, onRemove, onRetry, children }: StepNodeProps) {
  const name = appName(step.app);
  const activity = step.activity ?? defaultActivity[step.kind];
  const running = run.status === "running";
  const showOutput = run.status === "done" && run.output !== undefined && run.output.type !== "route";
  const statusText = run.status === "idle" ? kindLabel[step.kind] : run.status === "done" ? `Done in ${formatDuration(run.ms)}` : run.status === "running" ? "Running" : run.status === "error" ? "Failed" : "Skipped";
  return <motion.li className={styles.item} {...itemMotion(reduced)}>
    <div className={styles.inner} data-head={head ? "" : undefined}>
      {head ? <Head state={head} reduced={reduced} /> : null}
      <div className={styles.body} data-status={run.status}>
        {tail ? <span className={styles.tail} aria-hidden="true"><span className={styles.fill} data-state={run.status === "done" ? "done" : "idle"} /></span> : null}
        <div className={styles.row}>
          <span className={styles.mark}><AppMark app={step.app} /></span>
          <div className={styles.text}>
            <p className={styles.stepTitle}>{step.title}<span className={styles.srOnly}>, {name}, {statusText}</span></p>
            <p className={styles.stepDetail}>
              <span className={styles.detailText} data-hidden={running || undefined}>{step.detail ?? kindLabel[step.kind]}</span>
              <span className={styles.activity} data-hidden={!running || undefined} aria-hidden="true"><TextShimmer active={running && !reduced}>{activity}</TextShimmer></span>
            </p>
          </div>
          <StatusSlot kind={step.kind} run={run} />
          <span className={styles.removeSlot}>
            {removable ? <button type="button" className={styles.remove} onClick={onRemove} disabled={busy} aria-label={`Remove ${step.title}`}><X size={14} strokeWidth={1.75} aria-hidden="true" /></button> : null}
          </span>
        </div>
        {children}
        <AnimatePresence initial={false}>
          {showOutput && run.output ? <motion.div key="output" className={styles.fold} {...itemMotion(reduced)}>
            <div className={styles.output}><OutputView output={run.output} reduced={reduced} /></div>
          </motion.div> : null}
          {run.status === "error" ? <motion.div key="error" className={styles.fold} {...itemMotion(reduced)}>
            <div className={cx(styles.output, styles.errorOut)}>
              <p className={styles.errorText}>{run.error ?? "This step failed."}</p>
              <Button variant="secondary" size="sm" className={styles.retry} onClick={onRetry} aria-label={`Retry ${step.title}`}><RotateCcw size={12} strokeWidth={2} aria-hidden="true" />Retry</Button>
            </div>
          </motion.div> : null}
        </AnimatePresence>
      </div>
    </div>
  </motion.li>;
}

/** Compact path tabs under a branch: one shared highlight slides between them. */
function PathTabs({ label, paths, value, onChange, reduced }: { label: string; paths: { id: string; label: string }[]; value: string; onChange: (id: string) => void; reduced: boolean }) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: ReactKeyboardEvent, index: number) => {
    const last = paths.length - 1;
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    onChange(paths[next].id);
    refs.current[next]?.focus();
  };
  return <div className={styles.tabs} role="radiogroup" aria-label={label}>
    {paths.map((path, index) => {
      const selected = path.id === value;
      return <button key={path.id} ref={node => { refs.current[index] = node; }} type="button" role="radio" aria-checked={selected} tabIndex={selected ? 0 : -1}
        className={styles.tab} data-selected={selected || undefined} onClick={() => onChange(path.id)} onKeyDown={event => onKeyDown(event, index)}>
        {selected ? <motion.span layoutId={layoutId} className={styles.tabHighlight} transition={reduced ? { duration: 0 } : { type: "spring", visualDuration: .2, bounce: 0 }} aria-hidden="true" /> : null}
        <span className={styles.tabLabel}>{path.label}</span>
      </button>;
    })}
  </div>;
}

/** The add step menu, in the shape of a command menu: a search field and compact rows with marks and number shortcuts. */
function CommandList({ items, reduced, onPick }: { items: WorkflowCatalogItem[]; reduced: boolean; onPick: (item: WorkflowCatalogItem) => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { outer, inner } = useAutoHeight(reduced);
  const needle = query.trim().toLowerCase();
  const matches = needle ? items.filter(item => `${item.title} ${appName(item.app)} ${item.detail ?? ""}`.toLowerCase().includes(needle)) : items;
  const current = Math.min(active, Math.max(0, matches.length - 1));

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${current}"]`)?.scrollIntoView({ block: "nearest" });
  }, [current]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!matches.length) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current + step + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (matches[current]) onPick(matches[current]);
    } else if (!needle && /^[1-9]$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const item = matches[Number(event.key) - 1];
      if (item) { event.preventDefault(); onPick(item); }
    }
  };

  return <>
    <div className={styles.search}>
      <Search size={14} strokeWidth={1.75} aria-hidden="true" />
      <input ref={inputRef} className={styles.searchInput} value={query} placeholder="Search apps and actions" aria-label="Search steps"
        role="combobox" aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={matches[current] ? `${listId}-${current}` : undefined}
        onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={onKeyDown} />
    </div>
    <div ref={outer}><div ref={inner}>
      <ul ref={listRef} id={listId} role="listbox" aria-label="Steps" className={styles.options}>
        {matches.map((item, index) => <li key={`${item.title}-${index}`} id={`${listId}-${index}`} role="option" aria-selected={index === current} data-index={index}
          className={styles.option} data-active={index === current || undefined} onPointerMove={() => setActive(index)} onClick={() => onPick(item)}>
          <span className={styles.mark}><AppMark app={item.app} /></span>
          <span className={styles.optionTitle}>{item.title}</span>
          <span className={styles.optionMeta}>{!needle && index < 9 ? <Kbd keys={String(index + 1)} size="sm" /> : kindLabel[item.kind]}</span>
        </li>)}
        {matches.length === 0 ? <li className={styles.noMatch} role="presentation">No steps match “{query.trim()}”</li> : null}
      </ul>
    </div></div>
  </>;
}

function AddMenu({ label, items, disabled, reduced, onPick }: { label: string; items: WorkflowCatalogItem[]; disabled: boolean; reduced: boolean; onPick: (item: WorkflowCatalogItem) => void }) {
  const [open, setOpen] = useState(false);
  if (disabled && open) setOpen(false);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger className={styles.addButton} disabled={disabled}>
      <Plus size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.addLabel}>{label}</span>
    </PopoverTrigger>
    <PopoverContent side="bottom" align="end" sideOffset={6} className={styles.menu} onOpenAutoFocus={event => event.preventDefault()}>
      <CommandList items={items} reduced={reduced} onPick={item => { onPick(item); setOpen(false); }} />
    </PopoverContent>
  </Popover>;
}

function Skeleton() {
  return <ol className={styles.list} aria-hidden="true">
    {[0, 1, 2].map(index => <li key={index} className={styles.item}>
      <div className={styles.inner} data-head={index > 0 ? "" : undefined}>
        {index > 0 ? <span className={styles.head} /> : null}
        <div className={styles.body}>
          {index < 2 ? <span className={styles.tail} /> : null}
          <div className={styles.row}>
            <span className={cx(styles.mark, styles.skeletonMark)} />
            <span className={styles.skeletonLine} style={{ "--w": `${[52, 64, 44][index]}%` } as CSSProperties} />
          </div>
        </div>
      </div>
    </li>)}
  </ol>;
}

/** A compact automation builder: a trigger, an AI step and actions on one hairline rail, with a test run that travels the flow. */
export function AiWorkflow({
  title = "Escalate urgent support email",
  description = "Runs on every new email to support@northwind.dev",
  steps: stepsProp,
  defaultSteps,
  onStepsChange,
  catalog = workflowSampleCatalog,
  onRunStep,
  onRunComplete,
  loading = false,
  autoPlay = true,
  editable = true,
  className,
}: AiWorkflowProps) {
  const reduced = useReducedMotion() ?? false;
  const [internalSteps, setInternalSteps] = useState<WorkflowStep[]>(() => defaultSteps ?? stepsProp ?? workflowSampleSteps);
  const steps = stepsProp ?? internalSteps;
  const [runs, setRuns] = useState<Record<string, StepRun>>({});
  const [travel, setTravel] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<WorkflowRunStatus>("idle");
  const [failedTitle, setFailedTitle] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [activePath, setActivePath] = useState<Record<string, string>>({});
  const [announcement, setAnnouncement] = useState("");
  const [inView, setInView] = useState(false);
  const [interacted, setInteracted] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const runsRef = useRef<Record<string, StepRun>>({});
  const stepsRef = useRef(steps);
  const attemptsRef = useRef<Record<string, number>>({});
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef(0);
  const callbacks = useRef({ onRunStep, onRunComplete });
  useLayoutEffect(() => {
    stepsRef.current = steps;
    callbacks.current = { onRunStep, onRunComplete };
  });
  const simulated = !onRunStep;
  const total = countSteps(steps);
  const running = runStatus === "running";
  const { outer: pathsOuter, inner: pathsInner } = useAutoHeight(reduced);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry?.isIntersecting ?? false), { threshold: .35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const setRun = (id: string, run: StepRun) => {
    runsRef.current = { ...runsRef.current, [id]: run };
    setRuns(runsRef.current);
  };

  async function execute(step: WorkflowStep, context: WorkflowRunContext): Promise<WorkflowOutput | void> {
    const handler = callbacks.current.onRunStep;
    if (handler) return handler(step, context);
    await wait(step.durationMs ?? defaultDuration[step.kind], context.signal);
    if (step.error && context.attempt === 0) throw new Error(step.error);
    if (step.output) return step.output;
    if (step.kind === "branch" && step.paths?.[0]) return { type: "route", pathId: step.paths[0].id };
  }

  async function run(resume = false) {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;
    if (!resume) { runsRef.current = {}; setRuns({}); attemptsRef.current = {}; setElapsed(0); }
    setRunStatus("running");
    setTravel(null);
    setAnnouncement(resume ? "Retrying the failed step." : `Test run started.${simulated ? " Simulated, nothing is sent." : ""}`);
    let outputs: Record<string, WorkflowOutput> = {};
    let list = stepsRef.current;
    let index = 0;
    let first = true;
    let current: WorkflowStep | undefined;
    let ms = Object.values(runsRef.current).reduce((sum, item) => sum + (item.status === "done" ? item.ms ?? 0 : 0), 0);
    try {
      while (index < list.length) {
        const step = list[index];
        current = step;
        const existing = runsRef.current[step.id];
        if (existing?.status === "done") {
          if (existing.output) outputs = { ...outputs, [step.id]: existing.output };
        } else {
          if (!first) {
            setTravel(step.id);
            await wait(reduced ? 0 : TRAVEL_MS, signal);
            setTravel(null);
          }
          setRun(step.id, { status: "running" });
          const attempt = attemptsRef.current[step.id] ?? 0;
          attemptsRef.current[step.id] = attempt + 1;
          const started = performance.now();
          let output: WorkflowOutput | void;
          try {
            output = await execute(step, { signal, previous: { ...outputs }, attempt });
          } catch (error) {
            if (signal.aborted) throw error;
            const message = error instanceof Error ? error.message : "This step failed.";
            setRun(step.id, { status: "error", error: message });
            setFailedTitle(step.title);
            setRunStatus("failed");
            setAnnouncement(`${step.title} failed. ${message}`);
            callbacks.current.onRunComplete?.({ status: "failed", durationMs: ms, outputs, failedStepId: step.id });
            return;
          }
          signal.throwIfAborted();
          const took = Math.round(performance.now() - started);
          ms += took;
          setElapsed(ms);
          setRun(step.id, { status: "done", output: output ?? undefined, ms: took });
          if (output) outputs = { ...outputs, [step.id]: output };
          setAnnouncement(`${step.title}: ${summarize(output)}.`);
          await wait(reduced ? 0 : STEP_GAP_MS, signal);
        }
        first = false;
        if (step.kind === "branch" && step.paths?.length) {
          const route = runsRef.current[step.id]?.output;
          const path = step.paths.find(item => route?.type === "route" && item.id === route.pathId) ?? step.paths[0];
          setActivePath(previous => ({ ...previous, [step.id]: path.id }));
          for (const other of step.paths) if (other.id !== path.id) for (const child of other.steps) setRun(child.id, { status: "skipped" });
          list = path.steps;
          index = 0;
          continue;
        }
        index += 1;
      }
      setRunStatus("passed");
      setAnnouncement(`Test run passed in ${formatDuration(ms)}.${simulated ? " Simulated, nothing was sent." : ""}`);
      callbacks.current.onRunComplete?.({ status: "passed", durationMs: ms, outputs });
    } catch {
      if (abortRef.current !== controller) return;
      setTravel(null);
      if (current && runsRef.current[current.id]?.status === "running") setRun(current.id, { status: "idle" });
      setRunStatus("stopped");
      setAnnouncement(`Test run stopped.${simulated ? " Nothing was sent." : ""}`);
    }
  }

  const stop = () => abortRef.current?.abort();

  // Autoplay: play once in view, then repeat after a pause until someone interacts. Off screen, nothing is scheduled.
  useEffect(() => {
    if (!autoPlay || !inView || interacted || loading || total === 0) return;
    if (runStatus === "running" || runStatus === "stopped") return;
    const timer = window.setTimeout(() => { void run(); }, runStatus === "idle" ? 600 : 4200);
    return () => window.clearTimeout(timer);
    // run reads refs, so it is safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, inView, interacted, loading, total, runStatus]);

  const commit = (next: WorkflowStep[]) => {
    if (stepsProp === undefined) setInternalSteps(next);
    stepsRef.current = next;
    onStepsChange?.(next);
    if (runStatus !== "idle") { setRunStatus("idle"); }
  };

  const last = steps[steps.length - 1];
  const branchTail = last?.kind === "branch" && last.paths?.length ? last : undefined;
  const tailPathId = branchTail ? (activePath[branchTail.id] ?? branchTail.paths![0].id) : undefined;
  const tailPathLabel = branchTail?.paths!.find(path => path.id === tailPathId)?.label;

  const addStep = (item: WorkflowCatalogItem) => {
    idRef.current += 1;
    const step: WorkflowStep = { ...item, id: `${typeof item.app === "string" ? item.app : "step"}-added-${idRef.current}` };
    if (branchTail && tailPathId) {
      commit(steps.map(entry => entry !== branchTail ? entry : { ...entry, paths: entry.paths!.map(path => path.id === tailPathId ? { ...path, steps: [...path.steps, step] } : path) }));
      setAnnouncement(`Added ${step.title} to the ${tailPathLabel ?? ""} path.`);
    } else {
      commit([...steps, step]);
      setAnnouncement(`Added ${step.title}.`);
    }
  };

  const remove = (id: string) => {
    const step = findStep(steps, id);
    commit(removeStep(steps, id));
    setAnnouncement(step ? `Removed ${step.title}.` : "Removed the step.");
  };

  const runOf = (id: string): StepRun => runs[id] ?? { status: "idle" };
  const headOf = (id: string): ConnectorState => travel === id ? "active" : runOf(id).status === "idle" || runOf(id).status === "skipped" ? "idle" : "done";
  const empty = steps.length === 0;
  const menuItems = catalog.filter(item => item.kind !== "trigger");
  const triggers = catalog.filter(item => item.kind === "trigger");

  const renderStep = (step: WorkflowStep, isFirst: boolean, tail: boolean, children?: ReactNode) => <StepNode key={step.id} step={step} run={runOf(step.id)} head={isFirst ? null : headOf(step.id)} tail={tail} reduced={reduced}
    removable={editable && step.kind !== "trigger"} busy={running} onRemove={() => remove(step.id)} onRetry={() => { void run(true); }}>{children}</StepNode>;

  const summary = running
    ? { key: "running", icon: <span className={styles.liveDot} />, text: <TextShimmer active={!reduced}>Test run in progress</TextShimmer> }
    : runStatus === "passed"
      ? { key: "passed", icon: <Check size={14} strokeWidth={2} />, text: <>Passed in <span className={styles.tabular}>{formatDuration(elapsed)}</span>{simulated ? <span className={styles.summarySuffix}>, simulated, nothing was sent</span> : null}</> }
      : runStatus === "failed"
        ? { key: "failed", icon: <CircleAlert size={14} strokeWidth={2} />, text: <>Failed at {failedTitle}</> }
        : runStatus === "stopped"
          ? { key: "stopped", icon: <Square size={11} strokeWidth={2} />, text: <>Stopped{simulated ? ", nothing was sent" : ""}</> }
          : { key: "idle", icon: null, text: loading ? <>Loading steps</> : empty ? <>No steps yet</> : <><span className={styles.tabular}>{total}</span> {total === 1 ? "step" : "steps"}{simulated ? <span className={styles.summarySuffix}>, test runs are simulated</span> : null}</> };

  const runButton = running
    ? <Button variant="secondary" size="sm" className={styles.runButton} onClick={stop}><Square size={10} strokeWidth={2.4} aria-hidden="true" />Stop</Button>
    : <Button variant="primary" size="sm" className={styles.runButton} onClick={() => { void run(); }} disabled={loading || empty}>
      {runStatus === "idle" || runStatus === "stopped" ? <><Play size={12} strokeWidth={2.2} aria-hidden="true" />Test run</> : <><RotateCcw size={12} strokeWidth={2.2} aria-hidden="true" />Run again</>}
    </Button>;

  return <section ref={rootRef} className={cx(styles.root, className)} aria-label={title} aria-busy={running || loading || undefined}
    onPointerDownCapture={() => setInteracted(true)} onKeyDownCapture={() => setInteracted(true)}>
    <header className={styles.header}>
      <div className={styles.headText}>
        <h3 className={styles.title}>{title}</h3>
        {description ? <p className={styles.description}>{description}</p> : null}
      </div>
      {runButton}
    </header>

    <div className={styles.canvas}>
      {loading ? <Skeleton /> : empty ? <div className={styles.empty}>
        <p className={styles.emptyTitle}>Start with a trigger</p>
        <p className={styles.emptyText}>Pick the event that starts this workflow.</p>
        {editable && triggers.length ? <ul className={styles.triggerList}>
          {triggers.map(item => <li key={item.title}>
            <button type="button" className={styles.triggerOption} onClick={() => addStep(item)}>
              <span className={styles.mark}><AppMark app={item.app} /></span>
              <span className={styles.optionTitle}>{item.title}</span>
              {item.detail ? <span className={styles.triggerDetail}>{item.detail}</span> : null}
            </button>
          </li>)}
        </ul> : null}
      </div> : <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            if (step.kind !== "branch" || !step.paths?.length) return renderStep(step, index === 0, !isLast);
            const pathId = activePath[step.id] ?? step.paths[0].id;
            const path = step.paths.find(item => item.id === pathId) ?? step.paths[0];
            const tabs = <PathTabs label={`Paths for ${step.title}`} paths={step.paths} value={path.id} reduced={reduced}
              onChange={value => setActivePath(previous => ({ ...previous, [step.id]: value }))} />;
            return [
              renderStep(step, index === 0, true, tabs),
              <motion.li key={`${step.id}-paths`} className={styles.pathItem} initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}>
                <div ref={pathsOuter}><div ref={pathsInner}>
                  <AnimatePresence initial={false} mode="popLayout">
                    <motion.ol key={path.id} className={styles.list} aria-label={`${path.label} path`}
                      initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: .16, ease, delay: .04 } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>
                      <AnimatePresence initial={false}>
                        {path.steps.map((child, childIndex) => renderStep(child, false, childIndex < path.steps.length - 1))}
                      </AnimatePresence>
                      {path.steps.length === 0 ? <li className={styles.item}>
                        <div className={styles.inner} data-head="">
                          <span className={styles.head} aria-hidden="true" />
                          <div className={cx(styles.row, styles.pathEmpty)}>
                            <span className={cx(styles.mark, styles.emptyMark)} aria-hidden="true" />
                            <span className={styles.emptyText}>No steps on this path yet</span>
                          </div>
                        </div>
                      </li> : null}
                    </motion.ol>
                  </AnimatePresence>
                </div></div>
              </motion.li>,
            ];
          })}
        </AnimatePresence>
      </ol>}
    </div>

    <footer className={styles.footer}>
      <p className={styles.summary} aria-hidden="true">
        <AnimatePresence initial={false}>
          <motion.span key={summary.key} className={styles.summaryInner} data-state={summary.key} initial={{ opacity: 0, y: 2 }} animate={swapIn} exit={swapOut}>
            {summary.icon ? <span className={styles.summaryIcon}>{summary.icon}</span> : null}
            <span className={styles.summaryText}>{summary.text}</span>
          </motion.span>
        </AnimatePresence>
      </p>
      {editable && !empty && menuItems.length > 0 && !loading
        ? <AddMenu label={branchTail ? `Add to ${tailPathLabel ?? "path"}` : "Add step"} items={menuItems} disabled={running} reduced={reduced} onPick={addStep} />
        : null}
    </footer>
    <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>
  </section>;
}

export default AiWorkflow;
