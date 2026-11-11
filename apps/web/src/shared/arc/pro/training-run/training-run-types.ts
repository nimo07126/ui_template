import type { ReactNode } from "react";

/** Where the job is. "running" with no loss points yet reads as starting up (loading weights, tokenizing). */
export type TrainingRunStatus = "queued" | "running" | "paused" | "completed" | "failed" | "cancelled";

/** The base model being fine-tuned. */
export interface TrainingModel {
  /** "Qwen3.8 Max" */
  name: string;
  /** A 20px mark. Color marks keep their brand fills; mono marks should draw with currentColor. */
  mark?: ReactNode;
}

/** The training data. */
export interface TrainingDataset {
  /** "arcwork/support-tickets-oct" */
  name: string;
  /** Number of training examples. */
  examples?: number;
  /** A 14px mark for where the data lives, such as Hugging Face. */
  mark?: ReactNode;
}

/** One sample on the loss curve. Train and validation can arrive at different steps. */
export interface LossPoint {
  step: number;
  train?: number;
  val?: number;
}

export type TrainingEventKind = "start" | "checkpoint" | "eval" | "epoch" | "info" | "warning" | "error" | "done";

/** A line in the run's event log, newest last. */
export interface TrainingEvent {
  id: string;
  kind: TrainingEventKind;
  /** Short, sentence case: "Checkpoint saved", "Eval: 0.82 accuracy". */
  label: string;
  step?: number;
}

/** A result shown in place of the live stats once the run completes. */
export interface TrainingMetric {
  label: string;
  value: string;
  /** Muted text after the value: "from 1.88", "Sample". */
  hint?: string;
}

/** What a deploy resolves with. The endpoint shows in the footer with a copy button. */
export interface TrainingDeployResult {
  endpoint?: string;
}
