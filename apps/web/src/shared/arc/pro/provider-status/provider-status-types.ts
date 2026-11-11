import type { ReactNode } from "react";

/** A provider's health right now, or a day's worst health. */
export type ProviderHealth = "operational" | "degraded" | "outage";

/** One day of the uptime bar. */
export interface ProviderDay {
  /** Calendar day as "YYYY-MM-DD". */
  date: string;
  /** Percent of the day the provider was up, 0 to 100. Null when there is no data for that day. */
  uptime: number | null;
  /** The day's worst health. Derived from uptime when left out (below 99.9 degraded, below 99 outage). */
  status?: ProviderHealth;
  /** A short note for the tooltip, such as "Elevated errors on Grok 4.7 for 22 min". */
  note?: string;
}

export type IncidentStage = "investigating" | "identified" | "monitoring" | "resolved";

export interface IncidentUpdate {
  stage: IncidentStage;
  /** When the update was posted. A Date, a timestamp, or a preformatted label such as "14:02 UTC". */
  at: Date | number | string;
  message: string;
}

export interface ProviderIncident {
  id: string;
  title: string;
  /** Updates in any order; the panel lists the newest first. */
  updates: IncidentUpdate[];
  /** The provider's page for this incident. Shows a "Status page" link in the panel. */
  url?: string;
}

export interface ProviderStatusItem {
  id: string;
  name: string;
  /** A 16px mark. Mono marks should draw with currentColor. */
  mark?: ReactNode;
  /** One short line under the name, such as the models you call. */
  detail?: string;
  status: ProviderHealth;
  /** Median latency in milliseconds. Null shows a dash. */
  latencyMs?: number | null;
  /** Oldest first. The bar shows the last 30. */
  days?: ProviderDay[];
  /** An open or just resolved incident. Its row expands to show the updates. */
  incident?: ProviderIncident;
}
