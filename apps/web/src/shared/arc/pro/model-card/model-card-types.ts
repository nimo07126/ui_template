import type { CSSProperties, ReactNode } from "react";

/** What a model takes in or can do. Each one renders as a chip with an icon and a short label. */
export type ModelCardModality = "text" | "image" | "audio" | "video" | "pdf" | "tools" | "reasoning";

/** Prices per million tokens, in the card's currency. */
export interface ModelCardPricing {
  input: number;
  output: number;
  /** Price for cached input reads. Omit it to hide the cell. */
  cachedInput?: number;
}

export interface ModelCardModel {
  /** The API model id. "Copy model id" copies exactly this string. */
  id: string;
  /** Display name, for example "Claude Opus 5.5". */
  name: string;
  /** Provider name, for example "Anthropic". */
  provider: string;
  /** Provider mark. Any SVG or ReactNode; it is sized by the card and hidden from assistive technology. */
  mark?: ReactNode;
  /** One line about what the model is for. */
  summary?: string;
  modalities?: ModelCardModality[];
  /** Context window in tokens, for example 1_000_000. */
  contextWindow?: number;
  /** Maximum output tokens per response. */
  maxOutput?: number;
  /** Knowledge cutoff as an ISO month, "2026-03". Shown as "Mar 2026". Any other string is shown as is. */
  knowledgeCutoff?: string;
  pricing?: ModelCardPricing;
  /** Benchmark scores keyed by benchmark id. A model without a score is left out of that benchmark's rows. */
  scores?: Record<string, number>;
}

export interface ModelCardBenchmark {
  id: string;
  /** Full name, used in the caption and the compare table. */
  name: string;
  /** Short label for the benchmark switcher. Falls back to name. */
  shortName?: string;
  /** What the score measures, shown after the name in the caption. */
  description?: string;
  /** The score that fills a bar. Defaults to 100. */
  max?: number;
  /** Suffix after each score. Defaults to "%". */
  unit?: string;
}

export type ModelCardView = "details" | "compare";

export interface ModelCardProps {
  /** The model this card describes. Defaults to Claude Opus 5.5 (sample data). */
  model?: ModelCardModel;
  /** Other models. The first three appear in the benchmark rows; all of them can be picked in the compare view. Pass [] to hide compare. */
  rivals?: ModelCardModel[];
  /** Benchmarks to show, in order. Only benchmarks the model has a score for are offered. Pass [] to hide the section. */
  benchmarks?: ModelCardBenchmark[];
  /** Controlled view. Pair it with onViewChange. */
  view?: ModelCardView;
  defaultView?: ModelCardView;
  onViewChange?: (view: ModelCardView) => void;
  /** Controlled id of the rival shown in the compare view. */
  compareWith?: string;
  defaultCompareWith?: string;
  onCompareWithChange?: (id: string) => void;
  /** Benchmark selected on mount. Defaults to the first one the model has a score for. */
  defaultBenchmark?: string;
  onBenchmarkChange?: (id: string) => void;
  /** Monthly token volume the cost estimator starts at. Snaps to the nearest stop (1M to 1B). Defaults to 100M. */
  defaultMonthlyTokens?: number;
  /** Called with the monthly token volume while the estimator slider moves. */
  onMonthlyTokensChange?: (tokens: number) => void;
  /** Share of the monthly volume billed as input; the rest is billed as output. Defaults to 0.75. */
  inputShare?: number;
  /** ISO 4217 currency for prices. Defaults to "USD". */
  currency?: string;
  /** Labels prices and benchmark scores as samples. Defaults to true; set it to false once you wire real figures. */
  sample?: boolean;
  /** Shows a skeleton of the card while details load. */
  loading?: boolean;
  /** Shows an error in place of the details. */
  error?: string;
  /** Adds a Retry button to the error state. */
  onRetry?: () => void;
  /** Called after the model id is copied. */
  onCopyId?: (id: string) => void;
  /** Adds a primary "Use model" button to the footer. */
  onSelect?: (model: ModelCardModel) => void;
  /** Shows the select button in its selected state. */
  selected?: boolean;
  /** Label for the select button. Defaults to "Use model". */
  selectLabel?: string;
  className?: string;
  style?: CSSProperties;
}
