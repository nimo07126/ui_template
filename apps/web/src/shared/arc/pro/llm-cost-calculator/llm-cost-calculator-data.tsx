import type { ReactNode } from "react";
import { ClaudeMark, DeepseekColorMark, GeminiColorMark, OpenaiMark } from "./llm-cost-calculator-marks";

/** One model's list price in US dollars per million tokens. */
export interface LlmModelPrice {
  id: string;
  name: string;
  /** Shown to screen readers and in the breakdown, for example "Anthropic". */
  provider: string;
  /** A 16px mark. Mono marks should draw with currentColor so they follow the theme. */
  mark?: ReactNode;
  /** Dollars per 1M input tokens. */
  input: number;
  /** Dollars per 1M output tokens. */
  output: number;
  /** Dollars per 1M cached input tokens (cache reads). Without it, cached tokens bill at the input price. */
  cachedInput?: number;
}

/** What a workload sends: tokens per request and requests per day. */
export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  requestsPerDay: number;
  /** Bill part of the input at the cached rate (the share is `cacheHitRate`). */
  cached: boolean;
}

export interface LlmUsagePreset {
  id: string;
  label: string;
  usage: LlmUsage;
}

const claude = <ClaudeMark style={{ color: "#D97757" }} />;

/**
 * Sample list prices per 1M tokens, October 2026. Plausible figures for illustration, not quotes:
 * pass your own `models` with prices from each provider's pricing page.
 */
export const llmCostSampleModels: LlmModelPrice[] = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", provider: "Anthropic", mark: claude, input: 5, cachedInput: 0.5, output: 25 },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", provider: "Anthropic", mark: claude, input: 3, cachedInput: 0.3, output: 15 },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", provider: "Anthropic", mark: claude, input: 1, cachedInput: 0.1, output: 5 },
  { id: "gpt-6-1-sol", name: "GPT-6.1 Sol", provider: "OpenAI", mark: <OpenaiMark />, input: 2.5, cachedInput: 0.25, output: 20 },
  { id: "gpt-6-luna", name: "GPT-6 Luna", provider: "OpenAI", mark: <OpenaiMark />, input: 0.25, cachedInput: 0.025, output: 3 },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", provider: "Google", mark: <GeminiColorMark />, input: 2, cachedInput: 0.5, output: 12 },
  { id: "gemini-3-8-flash", name: "Gemini 3.8 Flash", provider: "Google", mark: <GeminiColorMark />, input: 0.3, cachedInput: 0.075, output: 2.5 },
  { id: "deepseek-v4-1-flash", name: "DeepSeek V4.1 Flash", provider: "DeepSeek", mark: <DeepseekColorMark />, input: 0.2, cachedInput: 0.02, output: 0.8 },
];

export const llmCostPresets: LlmUsagePreset[] = [
  { id: "chat", label: "Chat", usage: { inputTokens: 2000, outputTokens: 500, requestsPerDay: 10000, cached: false } },
  { id: "rag", label: "RAG", usage: { inputTokens: 16000, outputTokens: 500, requestsPerDay: 5000, cached: true } },
  { id: "agent", label: "Agent", usage: { inputTokens: 64000, outputTokens: 2000, requestsPerDay: 2500, cached: true } },
  { id: "batch", label: "Batch", usage: { inputTokens: 8000, outputTokens: 250, requestsPerDay: 50000, cached: false } },
];

/** Slider stops. The sliders move through these, so each step is a sensible jump at any scale. */
export const llmCostStops = {
  inputTokens: [250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 64000, 128000, 200000],
  outputTokens: [100, 250, 500, 1000, 2000, 4000, 8000, 16000],
  requestsPerDay: [100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000],
};
