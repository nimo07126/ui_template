import type { ReactNode } from "react";

/** What the card shows: the article itself, a prose summary, or key points with links back to their source. */
export type TldrMode = "full" | "summary" | "points";
/** The length slider, from 1 (brief) to 5 (detailed). Summaries aim for 35 to 130 words, key points for 3 to 7 items. */
export type TldrLength = 1 | 2 | 3 | 4 | 5;

export interface TldrParagraph {
  /** Stable id. Key points link back to it with `source`. */
  id: string;
  text: string;
}

export interface TldrArticle {
  title: string;
  paragraphs: TldrParagraph[];
  /** Publication or product the article belongs to, with an optional 14px mark. */
  source?: { name: string; mark?: ReactNode };
  author?: { name: string; avatar?: string };
  /** Display date, for example "Oct 21, 2026". */
  date?: string;
  /** For example "6 min read". Worked out from the word count (230 words a minute) when left out. */
  readingTime?: string;
}

export interface TldrKeyPoint {
  text: string;
  /** Id of the paragraph this point came from. Its jump link scrolls there and highlights it. */
  source: string;
}

/** One streamed piece. `point` starts a new key point; `text` appends to the summary or to the current point. */
export type TldrStreamEvent = { type: "text"; text: string } | { type: "point"; source: string };

export interface TldrRequest {
  mode: "summary" | "points";
  length: TldrLength;
  /** Roughly how many words a summary at this length should have. */
  targetWords: number;
  /** How many key points to return at this length. */
  pointCount: number;
  article: TldrArticle;
  /** Aborts when the reader stops, switches mode, changes length, or the card unmounts. */
  signal: AbortSignal;
}

/**
 * Produces a summary or key points. Return an async iterable of events to stream (map your provider's deltas to
 * `text` events, and start each key point with a `point` event), or a promise of the finished string or points,
 * which the card then streams in fast chunks itself.
 */
export type TldrSummarize = (request: TldrRequest) => AsyncIterable<TldrStreamEvent> | Promise<string | TldrKeyPoint[]>;

export interface TldrModel {
  name: string;
  /** 14px brand mark. Give a mono mark its brand color, for example the Claude mark in #D97757. */
  mark?: ReactNode;
}

export interface TldrResult {
  mode: "summary" | "points";
  length: TldrLength;
  /** The summary, or the key points as one line each. */
  text: string;
  points?: TldrKeyPoint[];
  words: number;
}
