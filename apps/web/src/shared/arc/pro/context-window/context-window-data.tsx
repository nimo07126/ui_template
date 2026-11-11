import type { ComponentType, SVGProps } from "react";
import { ClaudeMark, MoonshotMark, OpenaiMark } from "./context-window-marks";

export type ContextCategory = "system" | "tools" | "files" | "summary" | "messages";

export interface ContextModel {
  id: string;
  name: string;
  /** Context window in tokens. */
  window: number;
  /** Tokens held back for the model's reply. They are never filled by the conversation. */
  reserve: number;
  mark: ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;
  /** Brand color for a mono mark. */
  color?: string;
}

/** One thing in the window: the system prompt, a tool server, a file, or a conversation turn. */
export interface ContextItem {
  id: string;
  category: ContextCategory;
  label: string;
  tokens: number;
}

/** A turn the demo adds when you send a message: your message, tool results and the reply together. */
export interface ContextTurn {
  label: string;
  tokens: number;
}

export const CATEGORY_ORDER: ContextCategory[] = ["system", "tools", "files", "summary", "messages"];

export const CATEGORY_NAME: Record<ContextCategory | "free" | "reserve", string> = {
  system: "System prompt",
  tools: "Tools",
  files: "Files and memory",
  summary: "Summary",
  messages: "Messages",
  free: "Free",
  reserve: "Reserved for output",
};

/**
 * Sample models. The Claude Opus 5.5 window is real; the output reserves and the other two models' figures are
 * sample settings for the demo.
 */
export const sampleModels: ContextModel[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", window: 1_000_000, reserve: 64_000, mark: ClaudeMark, color: "#D97757" },
  { id: "kimi-k3", name: "Kimi K3", window: 512_000, reserve: 32_000, mark: MoonshotMark },
  { id: "gpt-6-luna", name: "GPT-6 Luna", window: 400_000, reserve: 32_000, mark: OpenaiMark },
];

/** A coding agent session on a billing service, about 41% into a 1M window. */
export const sampleItems: ContextItem[] = [
  { id: "system", category: "system", label: "System prompt", tokens: 4_100 },
  { id: "github", category: "tools", label: "GitHub tools", tokens: 14_200 },
  { id: "linear", category: "tools", label: "Linear tools", tokens: 9_600 },
  { id: "sentry", category: "tools", label: "Sentry tools", tokens: 8_200 },
  { id: "claude-md", category: "files", label: "CLAUDE.md", tokens: 6_400 },
  { id: "invoice", category: "files", label: "src/billing/invoice.ts", tokens: 38_000 },
  { id: "schema", category: "files", label: "db/schema.sql", tokens: 55_600 },
  ...Array.from({ length: 24 }, (_, index) => ({ id: `turn-${index + 1}`, category: "messages" as const, label: `Turn ${index + 1}`, tokens: [9_800, 14_200, 11_600, 12_900][index % 4]! })),
];

/** Turns the demo sends, in order: each is your message plus the tool results and the reply it produced. */
export const sampleTurns: ContextTurn[] = [
  { label: "Retry failed invoices with backoff", tokens: 31_400 },
  { label: "Add tests for the retry schedule", tokens: 27_800 },
  { label: "Explain the failing Sentry event", tokens: 36_200 },
  { label: "Update the migration for retry_count", tokens: 24_600 },
  { label: "Summarize the changes for the PR", tokens: 19_300 },
];

/** Files the demo attaches, in order. */
export const sampleFiles: ContextTurn[] = [
  { label: "api/openapi.yaml", tokens: 64_000 },
  { label: "docs/billing-runbook.md", tokens: 22_000 },
  { label: "src/billing/retry.ts", tokens: 18_500 },
];
