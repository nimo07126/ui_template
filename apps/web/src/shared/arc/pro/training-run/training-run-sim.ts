"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { smoothTrain } from "./training-run-chart";
import type { LossPoint, TrainingDeployResult, TrainingEvent, TrainingMetric, TrainingRunStatus } from "./training-run-types";

/** "healthy" runs to completion; "oom" fails once at step 940 with a CUDA out of memory error, then retries from the last checkpoint. */
export type TrainingScenario = "healthy" | "oom";

export interface TrainingRunSimulation {
  status: TrainingRunStatus;
  step: number;
  totalSteps: number;
  epochs: number;
  loss: LossPoint[];
  learningRate: number;
  elapsed: number;
  eta: number;
  events: TrainingEvent[];
  metrics?: TrainingMetric[];
  activity?: string;
  error?: string;
  notice?: string;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRestart: () => void;
  onDeploy: (signal: AbortSignal) => Promise<TrainingDeployResult>;
}

const TOTAL = 1860;
const EPOCHS = 3;
const PER_EPOCH = TOTAL / EPOCHS;
/** Real milliseconds the simulated run takes from first step to done. */
const RUN_MS = 14000;
/** Simulated training throughput, so elapsed and ETA read like a real 18m 40s job. */
const STEPS_PER_SECOND = TOTAL / 1120;
const TRAIN_EVERY = 10;
const VAL_EVERY = 60;
const EVAL_EVERY = 310;
const FAIL_AT = 940;
const EXAMPLES = 48210;

const noise = (s: number) => { const x = Math.sin(s * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x) - .5; };
export const sampleTrainLoss = (s: number) => .3 + 1.62 * Math.exp(-s / 240) + .14 * Math.exp(-s / 1100) - .035 * Math.floor(Math.min(s, TOTAL - 1) / PER_EPOCH) + noise(s) * .08 * (.45 + .55 * Math.exp(-s / 700));
export const sampleValLoss = (s: number) => .44 + 1.38 * Math.exp(-s / 280) + .1 * Math.exp(-s / 1000) + .00003 * Math.max(0, s - 1300) + noise(s + 7) * .01;
const accuracy = (s: number) => .87 - .29 * Math.exp(-s / 520);
const learningRate = (s: number) => s < 60 ? 2e-4 * (s / 60) : 2e-5 + .5 * (2e-4 - 2e-5) * (1 + Math.cos(Math.PI * (s - 60) / (TOTAL - 60)));
const fmt = (n: number) => n.toLocaleString("en-US");

interface State {
  status: TrainingRunStatus;
  step: number;
  loss: LossPoint[];
  events: TrainingEvent[];
  activity?: string;
  error?: string;
  notice?: string;
  /** Milliseconds left in the current pause between phases (queue, warm up, the hold after a result). */
  wait: number;
  phase: "queue" | "warmup" | "train" | "hold" | "idle";
  failedOnce: boolean;
}

let eventSeq = 0;
const event = (kind: TrainingEvent["kind"], label: string, step?: number): TrainingEvent => ({ id: `e${++eventSeq}`, kind, label, step });

function fresh(): State {
  return { status: "queued", step: 0, loss: [], events: [], activity: "Waiting for 8× H200 · 2nd in queue", wait: 1300, phase: "queue", failedOnce: false };
}

/** Points and events crossed between two steps. */
function advance(state: State, to: number): State {
  const from = state.step;
  const loss = state.loss.slice();
  const events = state.events.slice();
  for (let s = Math.floor(from / TRAIN_EVERY) * TRAIN_EVERY + TRAIN_EVERY; s <= to; s += TRAIN_EVERY) {
    const point: LossPoint = { step: s, train: sampleTrainLoss(s) };
    if (s % VAL_EVERY === 0 || s === TOTAL) point.val = sampleValLoss(s);
    loss.push(point);
    if (s % PER_EPOCH === 0 && s < TOTAL) events.push(event("checkpoint", `Checkpoint saved · epoch ${s / PER_EPOCH}`, s));
    if (s % EVAL_EVERY === 0 && s % PER_EPOCH !== 0) events.push(event("eval", `Eval: ${accuracy(s).toFixed(2)} accuracy`, s));
  }
  return { ...state, step: to, loss, events };
}

/**
 * Drives the built in fine-tuning demo: a queue wait, warm up, a 3 epoch LoRA run on Qwen3.8 Max with live loss, evals and
 * checkpoints, then results. Nothing is sent anywhere. Pass `active: false` (off screen) to freeze it.
 */
export function useTrainingRunSimulation(scenario: TrainingScenario = "healthy", active = true): TrainingRunSimulation {
  const [state, setState] = useState<State>(fresh);
  const activeRef = useRef(active);
  useEffect(() => { activeRef.current = active; }, [active]);
  // A new scenario starts a fresh run.
  const [playing, setPlaying] = useState(scenario);
  if (playing !== scenario) { setPlaying(scenario); setState(fresh()); }

  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(100, now - last);
      last = now;
      if (!activeRef.current) return;
      setState(prev => {
        if (prev.phase === "queue" || prev.phase === "warmup" || prev.phase === "hold") {
          const wait = prev.wait - dt;
          if (wait > 0) return { ...prev, wait };
          if (prev.phase === "queue") return { ...prev, status: "running", phase: "warmup", wait: 900, activity: `Loading weights · ${fmt(EXAMPLES)} examples` };
          if (prev.phase === "warmup") return { ...prev, phase: "train", activity: undefined, loss: [{ step: 0, train: sampleTrainLoss(0), val: sampleValLoss(0) }], events: [event("start", "Training started on 8× H200", 0)] };
          return { ...fresh(), failedOnce: false };
        }
        if (prev.phase !== "train" || prev.status !== "running") return prev;
        let to = Math.min(TOTAL, prev.step + dt * TOTAL / RUN_MS);
        const failing = scenario === "oom" && !prev.failedOnce && to >= FAIL_AT;
        if (failing) to = FAIL_AT;
        let next = advance(prev, to);
        if (failing) {
          return { ...next, status: "failed", phase: "idle", failedOnce: true, error: `CUDA out of memory on GPU 3 at step ${fmt(FAIL_AT)}`,
            events: [...next.events, event("error", "Out of memory · GPU 3", FAIL_AT)], notice: "Run failed at step 940. Simulated, nothing was sent." };
        }
        if (to >= TOTAL) {
          next = { ...next, status: "completed", phase: "hold", wait: 9000, events: [...next.events, event("done", `Training complete · ${accuracy(TOTAL).toFixed(2)} accuracy`, TOTAL)] };
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [scenario]);

  const onPause = useCallback(() => setState(prev => prev.status === "running" ? { ...prev, status: "paused", notice: `Paused at step ${fmt(Math.floor(prev.step))}. Simulated, nothing was sent.` } : prev), []);
  const onResume = useCallback(() => setState(prev => prev.status === "paused" ? { ...prev, status: "running", notice: "Resumed. Simulated, nothing was sent." } : prev), []);
  const onCancel = useCallback(() => setState(prev => ({
    ...prev, status: "cancelled", phase: "hold", wait: 7000, activity: undefined,
    events: [...prev.events, event("warning", "Cancelled · last checkpoint kept", Math.floor(prev.step))], notice: "Run cancelled. Simulated, nothing was sent.",
  })), []);
  const onRetry = useCallback(() => setState(prev => {
    const checkpoint = Math.floor(prev.step / PER_EPOCH) * PER_EPOCH;
    return {
      ...prev, status: "running", phase: "train", step: checkpoint, error: undefined, loss: prev.loss.filter(p => p.step <= checkpoint),
      events: [...prev.events, event("info", checkpoint ? `Resumed from checkpoint · epoch ${checkpoint / PER_EPOCH}` : "Restarted from step 0", checkpoint)],
      notice: `Retrying from step ${fmt(checkpoint)}. Simulated, nothing was sent.`,
    };
  }), []);
  const onRestart = useCallback(() => setState(() => ({ ...fresh(), notice: "Run queued again. Simulated, nothing was sent." })), []);
  const onDeploy = useCallback(async (signal: AbortSignal): Promise<TrainingDeployResult> => {
    setState(prev => ({ ...prev, wait: Math.max(prev.wait, 8000) }));
    await new Promise<void>((resolve, reject) => {
      const id = window.setTimeout(resolve, 1200);
      signal.addEventListener("abort", () => { window.clearTimeout(id); reject(signal.reason); }, { once: true });
    });
    setState(prev => ({ ...prev, wait: 6500, notice: "Deployed. Simulated, nothing was deployed." }));
    return { endpoint: "ft:qwen3.8-max:arcwork:support-triage-v3" };
  }, []);

  const step = Math.floor(state.step);
  const firstVal = state.loss[0]?.val ?? sampleValLoss(0);
  const lastVal = [...state.loss].reverse().find(p => p.val !== undefined)?.val ?? firstVal;
  const metrics: TrainingMetric[] | undefined = state.status === "completed" ? [
    { label: "Validation loss", value: lastVal.toFixed(3), hint: `from ${firstVal.toFixed(2)}` },
    { label: "Eval accuracy", value: accuracy(TOTAL).toFixed(2), hint: `from ${accuracy(0).toFixed(2)}` },
    { label: "Train loss", value: (smoothTrain(state.loss).at(-1)?.v ?? 0).toFixed(3), hint: "smoothed" },
    { label: "Cost", value: "$9.70", hint: "Sample" },
  ] : undefined;

  return {
    status: state.status, step, totalSteps: TOTAL, epochs: EPOCHS, loss: state.loss, learningRate: learningRate(step),
    elapsed: step / STEPS_PER_SECOND, eta: (TOTAL - step) / STEPS_PER_SECOND, events: state.events, metrics,
    activity: state.activity, error: state.error, notice: state.notice,
    onPause, onResume, onCancel, onRetry, onRestart, onDeploy,
  };
}
