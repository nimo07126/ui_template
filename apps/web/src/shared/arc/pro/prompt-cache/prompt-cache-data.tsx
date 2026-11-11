import type { ReactNode } from "react";
import { ClaudeMark } from "./prompt-cache-marks";

/** One block of the stable prefix, in prompt order. Every request sends these before its new message. */
export interface PromptCacheSegment {
  id: string;
  label: string;
  tokens: number;
  /** Segment color. Defaults to the chart series colors in order. */
  color?: string;
}

/** One request in the story. Only its new message differs from the others. */
export interface PromptCacheRequest {
  /** The new user message, used in the accessible description and the onRequest payload. */
  message?: string;
  /** Tokens in the new message (the uncached suffix). */
  tokens: number;
  /** Seconds after the previous request. Ignored for the first request of a round. */
  gap?: number;
}

/** Prices are in dollars per million input tokens. */
export interface PromptCacheModel {
  name: string;
  mark?: ReactNode;
  inputPrice: number;
  cacheWritePrice: number;
  cacheReadPrice: number;
}

export type PromptCacheKind = "write" | "hit" | "partial";

/** What happened to one request, reported through onRequest. */
export interface PromptCacheResult {
  /** Position in the round, from 0. */
  index: number;
  /** Simulated seconds since the round started. */
  at: number;
  /** write: nothing matched, so the whole prefix was processed and stored. hit: the whole prefix matched. partial: it matched up to `breakAt`. */
  kind: PromptCacheKind;
  /** Index of the first segment that did not match the cache. Equals the segment count on a full hit. */
  breakAt: number;
  /** Prefix tokens read from the cache. */
  cachedTokens: number;
  /** Prefix tokens processed and written to the cache. */
  writtenTokens: number;
  /** Tokens the model processed: the written prefix plus the new message. */
  processedTokens: number;
  /** Input cost in dollars, and what the same prompt costs without caching. */
  cost: number;
  uncachedCost: number;
  /** Seconds to the first output token, with and without caching. */
  firstToken: number;
  uncachedFirstToken: number;
  /** True when this request carried an edited segment. */
  changed: boolean;
  /** True when nothing was cached when it arrived: the first request, or the first after the cache expired. */
  cold: boolean;
  message?: string;
}

export const SERIES = ["var(--arc-series-3)", "var(--arc-series-2)", "var(--arc-series-4)", "var(--arc-series-1)"];

/** A support agent's prompt: tool definitions, policy, the help center articles it answers from, and the thread so far. */
export const sampleSegments: PromptCacheSegment[] = [
  { id: "tools", label: "Tools", tokens: 3_800 },
  { id: "system", label: "System prompt", tokens: 2_400 },
  { id: "documents", label: "Documents", tokens: 36_200 },
  { id: "conversation", label: "Conversation", tokens: 6_000 },
];

export const sampleRequests: PromptCacheRequest[] = [
  { message: "Which refunds are still pending this week?", tokens: 180 },
  { message: "Draft a reply to Northwind about their late refund", tokens: 240, gap: 42 },
  { message: "Summarize ticket 48213 and the attached invoice", tokens: 410, gap: 35 },
  { message: "Which customers asked about SSO in October?", tokens: 150, gap: 51 },
];

/** Sample prices for Claude Sonnet 5.5: cache reads at 0.1x the input price, five minute cache writes at 1.25x. */
export const sampleModel: PromptCacheModel = {
  name: "Claude Sonnet 5.5",
  mark: <ClaudeMark style={{ color: "#D97757" }} aria-hidden="true" focusable="false" />,
  inputPrice: 2,
  cacheWritePrice: 2.5,
  cacheReadPrice: 0.2,
};

/** Illustrative latency: a fixed overhead, prefill of new tokens, and a much faster load of cached ones. */
export const defaultFirstToken = ({ processed, cached }: { processed: number; cached: number }) => 0.42 + processed / 40_000 + cached / 500_000;

export interface CacheEntry {
  versions: number[];
  expiresAt: number;
}

/** Prefix matching: the request reuses the cache up to the first segment that differs, and processes everything after it. */
export function simulateRequest({ cache, versions, at, roundAt, index, request, segments, model, ttl, changed, firstToken }: {
  cache: CacheEntry | null; versions: number[]; at: number; roundAt: number; index: number; request: PromptCacheRequest;
  segments: PromptCacheSegment[]; model: PromptCacheModel; ttl: number; changed: boolean;
  firstToken: (tokens: { processed: number; cached: number }) => number;
}): { result: PromptCacheResult; cache: CacheEntry } {
  const live = cache && at < cache.expiresAt ? cache : null;
  let breakAt = 0;
  if (live) while (breakAt < segments.length && live.versions[breakAt] === versions[breakAt]) breakAt++;
  const prefix = segments.reduce((total, segment) => total + segment.tokens, 0);
  const cachedTokens = segments.slice(0, breakAt).reduce((total, segment) => total + segment.tokens, 0);
  const writtenTokens = prefix - cachedTokens;
  const suffix = Math.max(0, request.tokens);
  const kind: PromptCacheKind = breakAt === segments.length ? "hit" : breakAt === 0 ? "write" : "partial";
  const result: PromptCacheResult = {
    index, at: at - roundAt, kind, breakAt, cachedTokens, writtenTokens,
    processedTokens: writtenTokens + suffix,
    cost: (cachedTokens * model.cacheReadPrice + writtenTokens * model.cacheWritePrice + suffix * model.inputPrice) / 1e6,
    uncachedCost: (prefix + suffix) * model.inputPrice / 1e6,
    firstToken: firstToken({ processed: writtenTokens + suffix, cached: cachedTokens }),
    uncachedFirstToken: firstToken({ processed: prefix + suffix, cached: 0 }),
    changed, cold: !live, message: request.message,
  };
  return { result, cache: { versions: [...versions], expiresAt: at + ttl } };
}

/* Formatting */

export function formatTokens(value: number) {
  const n = Math.max(0, value);
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}K`;
  return `${Math.round(n)}`;
}
export const formatCost = (value: number) => `$${Math.max(0, value).toFixed(4)}`;
export const formatPrice = (value: number) => `$${value.toFixed(2)}`;
export const formatSeconds = (value: number) => `${Math.max(0, value).toFixed(2)}s`;
export const formatClock = (seconds: number) => {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
export const formatRatio = (value: number) => `${+value.toFixed(2)}x`;
export const formatPercent = (value: number) => `${Math.round(Math.abs(value))}%`;
export const formatSpeedup = (value: number) => `${value.toFixed(1)}x`;
/** "5 minutes", or "5 minute" when it describes something, as in "5 minute cache". */
export function formatDuration(seconds: number, adjective = false) {
  const unit = (value: number, name: string) => `${+value.toFixed(1)} ${name}${value === 1 || adjective ? "" : "s"}`;
  if (seconds >= 3600 && seconds % 900 === 0) return unit(seconds / 3600, "hour");
  if (seconds >= 60 && seconds % 15 === 0) return unit(seconds / 60, "minute");
  return unit(seconds, "second");
}
