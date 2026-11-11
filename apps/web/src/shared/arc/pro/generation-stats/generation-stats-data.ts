import type { GenerationProvider } from "./generation-stats-marks";

export type { GenerationProvider } from "./generation-stats-marks";

/** Where the response is. "waiting" runs until the first token arrives, "streaming" until the last. */
export type GenerationStatus = "idle" | "waiting" | "streaming" | "done" | "stopped" | "error";

export interface GenerationModel {
  /** Display name, for example "Claude Sonnet 5.5". */
  name: string;
  /** Picks the mark drawn next to the name. */
  provider: GenerationProvider;
  /** Your API model id. Included in the copied stats. */
  id?: string;
}

/** USD per million tokens. */
export interface GenerationPricing {
  input: number;
  /** Rate for prompt tokens read from cache. Defaults to the input rate. */
  cachedInput?: number;
  output: number;
}

/** Everything is optional: pass what your provider reports and the rest is derived while the response streams. */
export interface GenerationUsage {
  /** All prompt tokens, cached ones included. */
  inputTokens?: number;
  /** The part of inputTokens read from the prompt cache. */
  cachedTokens?: number;
  /** Visible output tokens so far. Update it as chunks arrive. */
  outputTokens?: number;
  /** Hidden reasoning tokens, billed at the output rate. */
  reasoningTokens?: number;
  /** Time to first token. While waiting it is measured live from startedAt. */
  ttftMs?: number;
  /** Total latency, request to last token. While streaming it is measured live from startedAt. */
  durationMs?: number;
  /** Overrides the derived speed (output tokens per second of generation). */
  tokensPerSecond?: number;
  /** Overrides the cost derived from pricing. */
  costUsd?: number;
}

export interface GenerationSampleRun {
  model: GenerationModel;
  pricing: GenerationPricing;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  ttftMs: number;
  /** Peak streaming speed; the run ramps up to it and wavers a little, like a real stream. */
  tokensPerSecond: number;
  /** Fails after this many output tokens, then succeeds when retried. */
  failAtTokens?: number;
  error?: string;
}

/** Sample runs for the self-playing preview. Rates are plausible samples, not published prices. */
export const generationSampleRuns: GenerationSampleRun[] = [
  {
    model: { name: "Claude Sonnet 5.5", provider: "anthropic", id: "claude-sonnet-5-5" },
    pricing: { input: 3, cachedInput: 0.3, output: 15 },
    inputTokens: 6214, cachedTokens: 5632, outputTokens: 284, ttftMs: 420, tokensPerSecond: 98,
  },
  {
    model: { name: "GPT-6.1 Sol", provider: "openai", id: "gpt-6.1-sol" },
    pricing: { input: 2.5, cachedInput: 0.25, output: 12 },
    inputTokens: 3948, cachedTokens: 2560, outputTokens: 318, reasoningTokens: 224, ttftMs: 690, tokensPerSecond: 112,
  },
  {
    model: { name: "Gemini 3.8 Flash", provider: "google", id: "gemini-3.8-flash" },
    pricing: { input: 0.3, cachedInput: 0.03, output: 2.5 },
    inputTokens: 8416, cachedTokens: 6144, outputTokens: 642, ttftMs: 260, tokensPerSecond: 246,
  },
  {
    model: { name: "Mistral Large 4", provider: "mistral", id: "mistral-large-4" },
    pricing: { input: 2, cachedInput: 0.2, output: 6 },
    inputTokens: 4120, cachedTokens: 0, outputTokens: 356, ttftMs: 380, tokensPerSecond: 124,
    failAtTokens: 131, error: "Mistral returned 529 overloaded after 131 tokens.",
  },
];
