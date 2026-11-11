"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleAlert, CircleCheck, CircleSlash, Clock3, Flag, FlaskConical, Info, Pause, Play, RotateCcw, Rocket, Save, TriangleAlert, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { LossChart, smoothTrain, useSmoothed } from "./training-run-chart";
import { HuggingFaceMark, QwenColorMark } from "./training-run-marks";
import { useTrainingRunSimulation } from "./training-run-sim";
import type { TrainingScenario } from "./training-run-sim";
import type { LossPoint, TrainingDataset, TrainingDeployResult, TrainingEvent, TrainingEventKind, TrainingMetric, TrainingModel, TrainingRunStatus } from "./training-run-types";
import styles from "./training-run.module.css";

export type { LossPoint, TrainingDataset, TrainingDeployResult, TrainingEvent, TrainingEventKind, TrainingMetric, TrainingModel, TrainingRunStatus } from "./training-run-types";
export { useTrainingRunSimulation } from "./training-run-sim";
export type { TrainingRunSimulation, TrainingScenario } from "./training-run-sim";
export { HuggingFaceMark, MetaColorMark, QwenColorMark } from "./training-run-marks";

export interface TrainingRunProps {
  /** Where the job is. Leave it out to play the built in simulated run. */
  status?: TrainingRunStatus;
  /** The job or output model name, "support-triage-v3". */
  name?: string;
  /** The base model being fine-tuned, with its mark. */
  model?: TrainingModel;
  /** Short facts after the model name in the header, such as ["LoRA r16", "8× H200"]. */
  details?: string[];
  dataset?: TrainingDataset;
  /** Optimizer steps done, out of totalSteps. */
  step?: number;
  totalSteps?: number;
  /** Number of epochs. The step axis is split into this many bands. */
  epochs?: number;
  /** Loss samples so far, oldest first. The curve eases toward each new point. */
  loss?: LossPoint[];
  /** The current learning rate. */
  learningRate?: number;
  /** Seconds of training so far, excluding pauses. */
  elapsed?: number;
  /** Estimated seconds left. While queued it reads as the expected duration. */
  eta?: number;
  /** The run's event log, oldest first. The card lists the newest three. */
  events?: TrainingEvent[];
  /** Results shown in place of the live stats once completed. Defaults to final losses and duration. */
  metrics?: TrainingMetric[];
  /** A short line over the empty chart while queued or starting: "Waiting for 8× H200 · 2nd in queue". */
  activity?: string;
  /** Why the run failed, shown in the footer. */
  error?: string;
  onPause?: () => void;
  onResume?: () => void;
  /** Called after a confirming second press. */
  onCancel?: () => void;
  /** Retry a failed run from its last checkpoint. */
  onRetry?: () => void;
  /** Start the same job again from step 0. */
  onRestart?: () => void;
  /** Deploys the finished model. Shows a loading button, then the endpoint with a copy button. Aborted if the card unmounts or the run resets. */
  onDeploy?: (signal: AbortSignal) => Promise<TrainingDeployResult | void>;
  /** A one-off message for screen readers, such as the result of an action. */
  notice?: string;
  /** Demo only, used when status is left out: "oom" fails once at step 940 so the retry path can be seen. */
  scenario?: TrainingScenario;
  className?: string;
  ref?: Ref<HTMLDivElement>;
}

const defaultModel: TrainingModel = { name: "Qwen3.8 Max", mark: <QwenColorMark /> };
const defaultDataset: TrainingDataset = { name: "arcwork/support-tickets-oct", examples: 48210, mark: <HuggingFaceMark /> };
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const fmt = (n: number) => Math.floor(n).toLocaleString("en-US");
const lr = (n: number) => { if (n === 0) return "0"; const [m, e] = n.toExponential(2).split("e"); return `${m}e${Number(e)}`; };
function duration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor(s / 60) % 60).padStart(2, "0")}m`;
  if (s >= 60) return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * A fine-tuning job card: base model, dataset, a live train and validation loss curve on a fixed step axis that doubles as the
 * epoch progress bar, learning rate, elapsed time and ETA, the latest evals and checkpoints, pause and cancel, and on completion
 * the results with a Deploy button. With no props it plays a simulated run of Qwen3.8 Max.
 */
export function TrainingRun(props: TrainingRunProps) {
  if (props.status === undefined) return <SimulatedTrainingRun {...props} />;
  return <TrainingRunView {...props} status={props.status} />;
}

/** The demo. Pass `scenario="oom"` to watch a run fail and retry from its checkpoint. */
function SimulatedTrainingRun({ scenario, ...props }: TrainingRunProps) {
  const [visible, setVisible] = useState(true);
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { if (entry) setVisible(entry.isIntersecting); });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node]);
  const run = useTrainingRunSimulation(scenario, visible);
  return <TrainingRunView {...props} ref={setNode} name={props.name ?? "support-triage-v3"} details={props.details ?? ["LoRA r16", "8× H200"]}
    status={run.status} step={run.step} totalSteps={run.totalSteps} epochs={run.epochs} loss={run.loss} learningRate={run.learningRate}
    elapsed={run.elapsed} eta={run.eta} events={run.events} metrics={run.metrics} activity={run.activity} error={run.error} notice={run.notice}
    onPause={run.onPause} onResume={run.onResume} onCancel={run.onCancel} onRetry={run.onRetry} onRestart={run.onRestart} onDeploy={run.onDeploy} />;
}

/** Crossfades content in one grid cell: old out in 100ms, new in over 160ms with a 2px rise. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/** A loss value in reserved width; before the first sample the slot stays empty instead of reading 0.000. */
function Reading({ value }: { value?: string }) {
  return <span className={styles.num} data-empty={value === undefined || undefined}>{value ?? "0.000"}</span>;
}

function Spinner() {
  return <svg className={styles.spinner} viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle cx="8" cy="8" r="6" className={styles.spinnerTrack} />
    <path d="M8 2a6 6 0 0 1 6 6" className={styles.spinnerArc} />
  </svg>;
}

const eventIcon: Record<TrainingEventKind, typeof Save> = { start: Play, checkpoint: Save, eval: FlaskConical, epoch: Flag, info: Info, warning: TriangleAlert, error: CircleAlert, done: CircleCheck };

type Action = { label: string; icon?: ReactNode; onClick: () => void; variant: "secondary" | "accent" | "danger"; loading?: boolean };

/** One footer action. The Button persists while its label changes, so it morphs width instead of remounting. */
function ActionSlot({ action, reduced }: { action: Action | null; reduced: boolean }) {
  return <AnimatePresence mode="popLayout" initial={false}>
    {action ? <motion.span key="slot" className={styles.slot} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>
      <Button size="sm" variant={action.variant === "accent" ? "primary" : action.variant} loading={action.loading} className={action.variant === "accent" ? styles.accent : undefined} onClick={action.onClick}>
        {action.icon}{action.label}
      </Button>
    </motion.span> : null}
  </AnimatePresence>;
}

type DeployState = { phase: "idle" | "deploying" | "deployed" | "error"; endpoint?: string; error?: string };

function TrainingRunView({
  status, name = "Fine-tuning job", model = defaultModel, details = [], dataset = defaultDataset, step = 0, totalSteps = 1, epochs = 1, loss = [],
  learningRate, elapsed, eta, events = [], metrics, activity, error, onPause, onResume, onCancel, onRetry, onRestart, onDeploy, notice, className, ref,
}: TrainingRunProps & { status: TrainingRunStatus }) {
  const reduced = useReducedMotion() ?? false;
  const total = Math.max(1, totalSteps), epochCount = Math.max(1, epochs);
  const clamped = Math.min(Math.max(0, step), total);
  const lastPoint = loss.at(-1)?.step ?? 0;
  const shown = useSmoothed(lastPoint, reduced);
  const progress = useSmoothed(status === "completed" ? total : clamped, reduced);
  const [hover, setHover] = useState<number | null>(null);

  // Cancel asks for a second press within 3 seconds. Deploy lives here so any onDeploy gets a loading state, a result and an
  // error path. A status change drops a pending confirm, and leaving completed resets the deploy.
  const [confirming, setConfirming] = useState(false);
  const [deploy, setDeploy] = useState<DeployState>({ phase: "idle" });
  const [seenStatus, setSeenStatus] = useState(status);
  if (seenStatus !== status) {
    setSeenStatus(status);
    setConfirming(false);
    if (status !== "completed") setDeploy({ phase: "idle" });
  }
  useEffect(() => {
    if (!confirming) return;
    const id = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(id);
  }, [confirming]);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => { if (status !== "completed") controller.current?.abort(); }, [status]);
  useEffect(() => () => controller.current?.abort(), []);
  const runDeploy = async () => {
    if (!onDeploy || deploy.phase === "deploying") return;
    const ac = new AbortController();
    controller.current = ac;
    setDeploy({ phase: "deploying" });
    try {
      const result = await onDeploy(ac.signal);
      if (!ac.signal.aborted) setDeploy({ phase: "deployed", endpoint: result?.endpoint });
    } catch (cause) {
      if (!ac.signal.aborted) setDeploy({ phase: "error", error: cause instanceof Error ? cause.message : "Deploy failed" });
    }
  };

  // Values: the legend follows the cursor, otherwise the latest sample.
  const train = useMemo(() => smoothTrain(loss), [loss]);
  const latestTrain = train.at(-1)?.v;
  const latestVal = useMemo(() => { for (let i = loss.length - 1; i >= 0; i--) if (loss[i].val !== undefined) return loss[i].val; return undefined; }, [loss]);
  const inspect = hover === null ? null : {
    train: train.find(p => p.step === hover)?.v,
    val: (() => { let v: number | undefined; for (const p of loss) { if (p.step > hover) break; if (p.val !== undefined) v = p.val; } return v; })(),
  };
  const trainValue = (inspect ? inspect.train : latestTrain)?.toFixed(3);
  const valValue = (inspect ? inspect.val : latestVal)?.toFixed(3);
  // Only the digits are tabular, so the live step holds still between digit counts and "Step" stays flush against it.
  const stepText = hover !== null ? <>Step <span className={styles.num}>{fmt(hover)}</span></>
    : <>Step <span className={styles.num}>{fmt(clamped)}</span> / <span className={styles.num}>{fmt(total)}</span></>;

  const deployed = status === "completed" && deploy.phase === "deployed";
  const starting = status === "running" && loss.length === 0;
  const badge = deployed ? { key: "deployed", label: "Deployed", icon: <Rocket size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "success" }
    : status === "queued" ? { key: "queued", label: "Queued", icon: <Clock3 size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "quiet" }
      : status === "running" ? { key: starting ? "starting" : "running", label: starting ? "Starting" : "Training", icon: <Spinner />, tone: "live" }
        : status === "paused" ? { key: "paused", label: "Paused", icon: <Pause size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "quiet" }
          : status === "completed" ? { key: "completed", label: "Completed", icon: <CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "success" }
            : status === "failed" ? { key: "failed", label: "Failed", icon: <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "danger" }
              : { key: "cancelled", label: "Cancelled", icon: <CircleSlash size={14} strokeWidth={1.75} aria-hidden="true" />, tone: "quiet" };

  const epochNow = Math.min(epochCount, Math.floor(clamped / (total / epochCount)) + 1);
  const live: TrainingMetric[] = [
    { label: "Epoch", value: status === "queued" || starting ? `0 of ${epochCount}` : `${epochNow} of ${epochCount}` },
    { label: "Learning rate", value: learningRate === undefined ? "Not set" : lr(learningRate) },
    { label: "Elapsed", value: duration(elapsed ?? 0) },
    { label: "ETA", value: status === "queued" ? `About ${duration(eta ?? 0)}` : status === "failed" || status === "cancelled" ? "Stopped" : status === "paused" ? "On hold" : duration(eta ?? 0) },
  ];
  const results: TrainingMetric[] = metrics ?? [
    { label: "Train loss", value: latestTrain?.toFixed(3) ?? "0.000" },
    { label: "Validation loss", value: latestVal?.toFixed(3) ?? "0.000" },
    { label: "Steps", value: fmt(total) },
    { label: "Duration", value: duration(elapsed ?? 0) },
  ];
  const showResults = status === "completed";
  const cells = showResults ? results.slice(0, 4) : live;

  const overlay = status === "queued" || starting ? <span className={styles.overlayBox}><span className={styles.overlayText} data-shimmer={reduced ? undefined : ""}>{activity ?? (starting ? "Starting" : "Waiting for a GPU")}</span></span>
    : loss.length === 0 ? <span className={styles.overlayBox}><span className={styles.overlayText}>No loss samples yet</span></span> : null;

  // Footer: one line of context on the left, up to two actions on the right.
  const info = deploy.phase === "error" ? { key: `deploy-error:${deploy.error}`, tone: "danger", body: <><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.truncate}>{deploy.error}</span></> }
    : deployed && deploy.endpoint ? { key: `endpoint:${deploy.endpoint}`, tone: "plain", body: <><CircleCheck size={14} strokeWidth={1.75} aria-hidden="true" className={styles.successIcon} /><code className={`${styles.truncate} ${styles.endpoint}`}>{deploy.endpoint}</code><CopyButton value={deploy.endpoint} label="Copy endpoint" iconOnly variant="plain" className={styles.copy} /></> }
      : status === "failed" && error ? { key: `error:${error}`, tone: "danger", body: <><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.truncate}>{error}</span></> }
        : { key: `dataset:${dataset.name}`, tone: "plain", body: <>{dataset.mark ? <span className={styles.datasetMark} aria-hidden="true">{dataset.mark}</span> : null}<span className={styles.truncate}>{dataset.name}</span>{dataset.examples !== undefined ? <span className={styles.muted}>{fmt(dataset.examples)} examples</span> : null}</> };

  const icon = (Icon: typeof Pause) => <Icon size={16} strokeWidth={1.75} aria-hidden="true" />;
  const cancelAction: Action | null = onCancel ? confirming ? { label: "Confirm cancel", onClick: () => { setConfirming(false); onCancel(); }, variant: "danger" } : { label: "Cancel", icon: icon(X), onClick: () => setConfirming(true), variant: "secondary" } : null;
  let left: Action | null = null, right: Action | null = null;
  if (status === "queued") left = cancelAction;
  else if (status === "running") { left = cancelAction; right = onPause ? { label: "Pause", icon: icon(Pause), onClick: onPause, variant: "secondary" } : null; }
  else if (status === "paused") { left = cancelAction; right = onResume ? { label: "Resume", icon: icon(Play), onClick: onResume, variant: "accent" } : null; }
  else if (status === "failed") { left = onRestart ? { label: "Run again", onClick: onRestart, variant: "secondary" } : null; right = onRetry ? { label: "Retry from checkpoint", icon: icon(RotateCcw), onClick: onRetry, variant: "accent" } : null; }
  else if (status === "cancelled") right = onRestart ? { label: "Run again", icon: icon(RotateCcw), onClick: onRestart, variant: "accent" } : null;
  else if (status === "completed") {
    left = onRestart ? { label: "Run again", onClick: onRestart, variant: "secondary" } : null;
    right = onDeploy && !deployed ? { label: deploy.phase === "error" ? "Retry deploy" : deploy.phase === "deploying" ? "Deploying" : "Deploy", icon: icon(Rocket), onClick: runDeploy, variant: "accent", loading: deploy.phase === "deploying" } : null;
  }
  const spoken = `${name}: ${badge.label}${status === "failed" && error ? `. ${error}` : ""}${confirming ? ". Press Confirm cancel to stop the run" : ""}`;
  const chartLabel = loss.length ? `Loss curve, step ${fmt(clamped)} of ${fmt(total)}. Train loss ${latestTrain?.toFixed(3) ?? "none"}, validation loss ${latestVal?.toFixed(3) ?? "none"}. Use the arrow keys to inspect steps.` : "Loss curve, no samples yet";
  const chartTone = status === "failed" ? "danger" : status === "completed" ? "done" : status === "running" ? "live" : "quiet";
  const recent = events.slice(-4).reverse();

  return <div ref={ref} className={[styles.root, className].filter(Boolean).join(" ")} data-status={status}>
    <header className={styles.header}>
      {model.mark ? <span className={styles.mark} aria-hidden="true">{model.mark}</span> : null}
      <div className={styles.heading}>
        <h3 className={styles.title}>{name}</h3>
        <p className={styles.meta}>{[model.name, ...details].join(" · ")}</p>
      </div>
      <Swap id={badge.key} className={styles.badgeSlot} reduced={reduced}>
        <span className={styles.badge} data-tone={badge.tone}>{badge.icon}<span>{badge.label}</span></span>
      </Swap>
    </header>

    <section className={styles.curve} aria-label="Loss">
      <div className={styles.legend}>
        <span className={styles.key}><span className={styles.swatch} data-series="train" aria-hidden="true" /><span className={styles.keyLabel}>Train</span><Reading value={trainValue} /></span>
        <span className={styles.key}><span className={styles.swatch} data-series="val" aria-hidden="true" /><span className={styles.keyLabel}><span className={styles.long}>Validation</span><span className={styles.short}>Val</span></span><Reading value={valValue} /></span>
        <span className={styles.stepText}>{stepText}</span>
      </div>
      <LossChart loss={loss} totalSteps={total} epochs={epochCount} shown={shown} progress={progress} tone={chartTone} hover={hover} onHover={setHover} overlay={overlay} label={chartLabel} />
    </section>

    <Swap id={showResults ? "results" : "live"} className={styles.statsSlot} reduced={reduced}>
      <dl className={styles.stats}>
        {cells.map(cell => <div key={cell.label} className={styles.stat}>
          <dt>{cell.label}</dt>
          {/* Epoch, elapsed and ETA tick in fixed-width digits; the learning rate (3.00e-4) and results read as plain text. */}
          <dd><span className={!showResults && cell !== live[1] ? styles.num : undefined}>{cell.value}</span>{cell.hint ? <span className={styles.hint}>{cell.hint}</span> : null}</dd>
        </div>)}
      </dl>
    </Swap>

    <section className={styles.events} aria-label="Events">
      <ol className={styles.eventList}>
        {recent.length ? <AnimatePresence initial={false}>
          {recent.map((item, index) => {
            const Icon = eventIcon[item.kind];
            return <motion.li key={item.id} className={styles.event} data-kind={item.kind} aria-hidden={index > 2 || undefined}
              initial={{ opacity: 0, y: index * 32 }} animate={{ opacity: index > 2 ? 0 : 1, y: index * 32 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}
              transition={reduced ? { duration: 0 } : { y: { type: "spring", visualDuration: .24, bounce: 0 }, opacity: { duration: motionTokens.duration.fast, ease } }}>
              <Icon size={14} strokeWidth={1.75} aria-hidden="true" className={styles.eventIcon} />
              <span className={styles.truncate}>{item.label}</span>
              {item.step !== undefined ? <span className={styles.eventStep}>Step {fmt(item.step)}</span> : null}
            </motion.li>;
          })}
        </AnimatePresence> : <li className={styles.eventEmpty}>Evals and checkpoints show here</li>}
      </ol>
    </section>

    <footer className={styles.footer}>
      <Swap id={info.key} className={styles.infoSlot} reduced={reduced}>
        <span className={styles.info} data-tone={info.tone}>{info.body}</span>
      </Swap>
      <div className={styles.actions}>
        <ActionSlot action={left} reduced={reduced} />
        <ActionSlot action={right} reduced={reduced} />
      </div>
    </footer>
    <span className={styles.srOnly} role="status">{[spoken, notice].filter(Boolean).join(". ")}</span>
  </div>;
}

export default TrainingRun;
