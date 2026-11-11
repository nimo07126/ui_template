import type { ReactNode } from "react";

/** idle: never run. queued: waiting for a free slot. running: the model is working. done and failed are settled. */
export type EnrichColumnStatus = "idle" | "queued" | "running" | "done" | "failed";

export interface EnrichColumnSource {
  /** Short label shown in the cell, such as "crunchbase.com". */
  label: string;
  href: string;
}

export interface EnrichColumnResult {
  value: string;
  source?: EnrichColumnSource;
}

export interface EnrichColumnCell {
  status: EnrichColumnStatus;
  value?: string;
  source?: EnrichColumnSource;
  /** Why a failed cell failed, in a few words. */
  error?: string;
  /** What a running cell is doing right now, such as "Reading crunchbase.com". */
  activity?: string;
}

export interface EnrichColumnRow {
  id: string;
  name: string;
  domain?: string;
  /** A 16px mark. SVGs size to the slot. */
  logo?: ReactNode;
}

export interface EnrichColumnDefinition {
  name: string;
  prompt: string;
}

export interface EnrichColumnModel {
  name: string;
  /** Quiet detail after the name, such as "Web search". */
  detail?: string;
  mark?: ReactNode;
}

export interface EnrichColumnContext {
  prompt: string;
  column: EnrichColumnDefinition;
  /** Aborts when the person stops the run, re-runs the cell or edits the column. */
  signal: AbortSignal;
  /** 1 on a fresh run, then 2, 3 and so on for each retry of a failed cell. */
  attempt: number;
  /** Updates the shimmering label while the cell runs. */
  setActivity: (text: string) => void;
}

export type EnrichColumnEnrich = (row: EnrichColumnRow, context: EnrichColumnContext) => Promise<EnrichColumnResult>;
