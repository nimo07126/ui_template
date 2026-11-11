import { ClaudeMark, GeminiColorMark, GrokMark, OpenaiMark } from "./model-card-marks";
import type { ModelCardBenchmark, ModelCardModel } from "./model-card-types";

/**
 * Sample data, October 2026. Context windows, prices and benchmark scores are plausible samples for the demo,
 * not official figures. Wire your own from your model catalog.
 */
const claude = <ClaudeMark aria-hidden style={{ color: "#D97757" }} />;

export const modelCardBenchmarks: ModelCardBenchmark[] = [
  { id: "swe-bench", name: "SWE-bench Verified", shortName: "SWE-bench", description: "real GitHub issues resolved" },
  { id: "gpqa", name: "GPQA Diamond", shortName: "GPQA", description: "graduate level science questions" },
  { id: "terminal-bench", name: "Terminal-Bench 2.0", shortName: "Terminal-Bench", description: "agentic tasks in a real terminal" },
];

export const modelCardModels = {
  opus: {
    id: "claude-opus-5-5",
    name: "Claude Opus 5.5",
    provider: "Anthropic",
    mark: claude,
    summary: "Anthropic's most capable model for long running agents, complex coding and deep research.",
    modalities: ["text", "image", "pdf", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2026-03",
    pricing: { input: 5, output: 25, cachedInput: 0.5 },
    scores: { "swe-bench": 86.4, gpqa: 89.2, "terminal-bench": 68.3 },
  },
  sonnet: {
    id: "claude-sonnet-5-5",
    name: "Claude Sonnet 5.5",
    provider: "Anthropic",
    mark: claude,
    summary: "The balanced Claude for everyday coding, agents and analysis at scale.",
    modalities: ["text", "image", "pdf", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 64_000,
    knowledgeCutoff: "2026-03",
    pricing: { input: 3, output: 15, cachedInput: 0.3 },
    scores: { "swe-bench": 82.1, gpqa: 85.4, "terminal-bench": 61.7 },
  },
  haiku: {
    id: "claude-haiku-5-5",
    name: "Claude Haiku 5.5",
    provider: "Anthropic",
    mark: claude,
    summary: "The fastest Claude, for real time chat, sub-agents and high volume tasks.",
    modalities: ["text", "image", "tools"],
    contextWindow: 400_000,
    maxOutput: 64_000,
    knowledgeCutoff: "2026-02",
    pricing: { input: 1, output: 5, cachedInput: 0.1 },
    scores: { "swe-bench": 74.6, gpqa: 76.8, "terminal-bench": 48.2 },
  },
  gpt: {
    id: "gpt-6.1-sol",
    name: "GPT-6.1 Sol",
    provider: "OpenAI",
    mark: <OpenaiMark aria-hidden />,
    summary: "OpenAI's flagship reasoning model for coding, agents and multimodal work.",
    modalities: ["text", "image", "audio", "tools", "reasoning"],
    contextWindow: 1_000_000,
    maxOutput: 128_000,
    knowledgeCutoff: "2026-01",
    pricing: { input: 4, output: 24, cachedInput: 0.4 },
    scores: { "swe-bench": 84.1, gpqa: 90.1, "terminal-bench": 63.9 },
  },
  gemini: {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "Google",
    mark: <GeminiColorMark aria-hidden />,
    summary: "Google's most capable Gemini, with native video and audio understanding.",
    modalities: ["text", "image", "audio", "video", "pdf", "tools", "reasoning"],
    contextWindow: 2_000_000,
    maxOutput: 64_000,
    knowledgeCutoff: "2026-02",
    pricing: { input: 2.5, output: 15, cachedInput: 0.25 },
    scores: { "swe-bench": 82.7, gpqa: 88.5, "terminal-bench": 61.2 },
  },
  grok: {
    id: "grok-4.7",
    name: "Grok 4.7",
    provider: "xAI",
    mark: <GrokMark aria-hidden />,
    summary: "xAI's frontier model with live search and long context reasoning.",
    modalities: ["text", "image", "tools", "reasoning"],
    contextWindow: 512_000,
    maxOutput: 64_000,
    knowledgeCutoff: "2026-04",
    pricing: { input: 3, output: 15, cachedInput: 0.75 },
    scores: { "swe-bench": 80.9, gpqa: 87.3, "terminal-bench": 57.6 },
  },
} satisfies Record<string, ModelCardModel>;

export const modelCardRivals: ModelCardModel[] = [modelCardModels.gpt, modelCardModels.gemini, modelCardModels.grok];
