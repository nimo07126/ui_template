import { avatar } from "../lib/media";
import { ClaudeMark, LinearMark } from "./tldr-toggle-marks";
import type { TldrArticle, TldrKeyPoint, TldrLength, TldrModel, TldrRequest, TldrStreamEvent } from "./tldr-toggle-types";

/** Target summary length in words for each step of the length slider. */
export const TLDR_TARGET_WORDS = [35, 60, 85, 100, 130] as const;
/** Key points for each step of the length slider: 3 to 7. */
export const tldrPointCount = (length: TldrLength) => length + 2;

/* Sample content: a plausible engineering post. The numbers are sample figures, not published results. */
export const tldrSampleArticle: TldrArticle = {
  title: "How we made sync 4x faster for the largest workspaces",
  source: { name: "Linear blog", mark: <LinearMark aria-hidden="true" /> },
  author: { name: "Olivia Bennett", avatar: avatar("olivia-bennett") },
  date: "Oct 21, 2026",
  paragraphs: [
    { id: "cold-start", text: "Last spring our largest customers started to feel it. Workspaces with more than 400,000 issues took up to 11 seconds to become interactive on a cold start, and every reconnect after a laptop woke from sleep replayed thousands of changes the client already had. Sync was designed for teams of fifty. It was now serving companies of five thousand." },
    { id: "root-cause", text: "The root cause was the bootstrap payload. On first load, the client downloaded a full snapshot of every issue, comment and project it could see, then applied changes on top. For a workspace with 400,000 issues that snapshot was 180 MB of JSON, and parsing it blocked the main thread long before anything appeared on screen." },
    { id: "partial-bootstrap", text: "We replaced the snapshot with partial bootstrapping. The client now loads only the teams, views and issues the first screen needs, about 2 percent of a typical large workspace, and streams the rest in the background over the same connection. Anything else is fetched the first time a view asks for it, then kept in IndexedDB for the next visit." },
    { id: "reconnects", text: "Reconnects now carry a sequence number per model instead of one global cursor. A client coming back online sends the last number it saw for each model, and the server returns only what changed since. A laptop that slept through the weekend catches up in about 300 milliseconds instead of replaying 40,000 changes." },
    { id: "results", text: "The results held across every cohort we measured. Median time to interactive for the largest workspaces fell from 11.2 to 2.6 seconds, memory on first load dropped by 58 percent, and sync-related support tickets fell by two thirds in the month after the rollout finished on October 6." },
    { id: "next", text: "Partial bootstrapping is now on for every workspace, with no setting to change. Next we are moving search indexing into a web worker, so typing in the command menu never waits on the network, and in November we are publishing the sync protocol docs for integration partners." },
  ],
};

export const tldrDefaultModel: TldrModel = { name: "Claude Haiku 5.5", mark: <ClaudeMark aria-hidden="true" style={{ color: "#D97757" }} /> };

/* Summary sentences in reading order. A shorter summary keeps the highest priorities and still reads in this order. */
const sampleSummary: { text: string; priority: number }[] = [
  { priority: 1, text: "Linear made sync about 4x faster for its largest workspaces by replacing the full bootstrap snapshot with partial bootstrapping." },
  { priority: 5, text: "The old 180 MB snapshot blocked the main thread for up to 11 seconds in workspaces with 400,000 issues." },
  { priority: 3, text: "The client now loads only what the first screen needs, about 2 percent of the workspace, and streams the rest in the background." },
  { priority: 4, text: "Reconnects use a sequence number per model, so a laptop that slept all weekend catches up in about 300 ms instead of replaying 40,000 changes." },
  { priority: 2, text: "Median time to interactive fell from 11.2 to 2.6 seconds, and first-load memory dropped 58 percent." },
  { priority: 6, text: "Sync-related support tickets fell by two thirds after the rollout finished on October 6." },
  { priority: 7, text: "Next up: search indexing in a web worker, and public sync protocol docs for partners in November." },
];
const summaryCounts = [2, 3, 4, 5, 7];

/* Key points in article order, each tied to the paragraph it came from. */
const samplePoints: (TldrKeyPoint & { priority: number })[] = [
  { priority: 6, source: "cold-start", text: "Workspaces with over 400,000 issues took up to 11 seconds to become interactive on a cold start." },
  { priority: 4, source: "root-cause", text: "The old 180 MB JSON snapshot blocked the main thread before anything rendered." },
  { priority: 1, source: "partial-bootstrap", text: "Partial bootstrapping loads about 2 percent of a workspace up front and streams the rest in the background." },
  { priority: 3, source: "reconnects", text: "A sequence number per model lets a client that slept all weekend catch up in about 300 ms." },
  { priority: 2, source: "results", text: "Median time to interactive fell from 11.2 to 2.6 seconds for the largest workspaces." },
  { priority: 5, source: "results", text: "First-load memory dropped 58 percent and sync support tickets fell by two thirds." },
  { priority: 7, source: "next", text: "Search indexing moves to a web worker next, and the sync protocol docs open to partners in November." },
];

const firstSentence = (text: string) => text.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text;
const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

/** The built-in result for a request: authored for the sample article, extractive (lead sentences) for any other. */
export function sampleResult({ mode, length, article }: Pick<TldrRequest, "mode" | "length" | "article">): string | TldrKeyPoint[] {
  const isSample = article.title === tldrSampleArticle.title;
  if (mode === "points") {
    const count = tldrPointCount(length);
    if (isSample) {
      const keep = new Set(samplePoints.map(point => point.priority).sort((a, b) => a - b).slice(0, count));
      return samplePoints.filter(point => keep.has(point.priority)).map(({ source, text }) => ({ source, text }));
    }
    return article.paragraphs.slice(0, count).map(paragraph => ({ source: paragraph.id, text: firstSentence(paragraph.text) }));
  }
  if (isSample) {
    const count = summaryCounts[length - 1] ?? 3;
    const picked = sampleSummary.filter(sentence => sentence.priority <= count).map(sentence => sentence.text);
    // Longer summaries break into two paragraphs before the results.
    if (count < 5) return picked.join(" ");
    const split = picked.findIndex(text => text.startsWith("Median"));
    return `${picked.slice(0, split).join(" ")}\n\n${picked.slice(split).join(" ")}`;
  }
  const target = TLDR_TARGET_WORDS[length - 1] ?? 60;
  const sentences: string[] = [];
  for (const paragraph of article.paragraphs) {
    if (sentences.length && wordCount(sentences.join(" ")) >= target) break;
    sentences.push(firstSentence(paragraph.text));
  }
  return sentences.join(" ");
}

const abortError = () => new DOMException("The summary was stopped.", "AbortError");

/** Resolves after `ms`, or rejects at once when the signal aborts. */
export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(abortError());
    const onAbort = () => { window.clearTimeout(timer); reject(abortError()); };
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** Word groups of 3 to 8, in a fixed rhythm so the stream feels like a fast model, not a metronome. */
const RHYTHM = [4, 6, 3, 7, 5, 8, 4, 5, 6, 3];
export function chunkText(text: string) {
  const words = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  for (let index = 0, beat = 0; index < words.length; beat++) {
    const size = RHYTHM[beat % RHYTHM.length]!;
    chunks.push(words.slice(index, index + size).join(""));
    index += size;
  }
  return chunks;
}

/** Streams a finished result as events, a chunk every 30 to 40ms. Used for promise results and the simulation. */
export async function* streamResult(result: string | TldrKeyPoint[], signal: AbortSignal): AsyncGenerator<TldrStreamEvent> {
  const tick = (beat: number) => wait(30 + (beat * 7) % 11, signal);
  let beat = 0;
  if (typeof result === "string") {
    for (const chunk of chunkText(result)) { yield { type: "text", text: chunk }; await tick(beat++); }
    return;
  }
  for (const point of result) {
    yield { type: "point", source: point.source };
    for (const chunk of chunkText(point.text)) { yield { type: "text", text: chunk }; await tick(beat++); }
  }
}

export interface SimulateTldrOptions {
  /** Fail after the thinking pause, to show the error state. */
  fail?: boolean;
  /** Milliseconds of thinking before the first chunk. Defaults to 700. */
  thinkMs?: number;
}

/**
 * The simulation behind the preview. Nothing is sent anywhere: it waits briefly, then streams the sample result in
 * 3 to 8 word chunks. Pass it as `summarize` (wrapped, to set options) when prototyping.
 */
export async function* simulateTldr(request: TldrRequest, options: SimulateTldrOptions = {}): AsyncGenerator<TldrStreamEvent> {
  await wait(options.thinkMs ?? 700, request.signal);
  if (options.fail) throw new Error("The model did not respond in time.");
  yield* streamResult(sampleResult(request), request.signal);
}
