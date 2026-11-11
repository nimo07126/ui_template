import type { ReactNode } from "react";
import { CalendarDays, CodeXml, Hash, Quote, Sigma, UserRound, WholeWord, Zap } from "lucide-react";

export interface MixtureOfExpertsExpert {
  /** Short name on the expert, such as "Numbers". One word reads best: narrow cards show only the icon. */
  name: string;
  /** What the expert tends to handle, shown when it is hovered or focused. Illustrative; real experts are not this tidy. */
  handles?: string;
  /** A 14px glyph. Narrow cards show it instead of the name. Defaults to the first letter of the name. */
  icon?: ReactNode;
}

export interface MixtureOfExpertsToken {
  /** The token as text. Leading spaces are trimmed for display. */
  text: string;
  /**
   * Gate scores, one per expert, in expert order. Any non-negative weights work; they are normalized to sum to 1. Leave
   * them out and the token gets stable sample scores derived from its text.
   */
  scores?: number[];
}

export interface MixtureOfExpertsParameters {
  /** Every parameter in the model, in billions. */
  total: number;
  /** Parameters every token uses: attention, embeddings and any shared expert, in billions. */
  shared: number;
  /** Parameters in one routed expert, in billions. Active parameters are shared plus top k times this. */
  perExpert: number;
}

/** The routing of one token, given to onRoute and used for the readouts. */
export interface MixtureOfExpertsRoute {
  /** Index of the token in the sequence. */
  index: number;
  token: string;
  /** Normalized gate scores, one per expert. */
  scores: number[];
  /** Chosen experts, best first. */
  experts: number[];
  /** Mixing weights of the chosen experts, renormalized over the top k so they sum to 1. */
  weights: number[];
  /** Chosen experts that were already at capacity, so they skipped this token. */
  dropped: number[];
}

/** A route with the running load it leaves behind. */
export interface PlannedRoute extends MixtureOfExpertsRoute {
  /** Tokens each expert has taken once this token is through. */
  loads: number[];
}

const icon = (Glyph: typeof Hash) => <Glyph size={14} strokeWidth={1.75} aria-hidden="true" />;

/** Illustrative experts. Real routers learn overlapping, far less readable specialties. */
export const DEFAULT_EXPERTS: MixtureOfExpertsExpert[] = [
  { name: "Code", handles: "Commands, identifiers and keywords", icon: icon(CodeXml) },
  { name: "Numbers", handles: "Digits, amounts and counts", icon: icon(Hash) },
  { name: "Punctuation", handles: "Commas, periods and brackets", icon: icon(Quote) },
  { name: "Names", handles: "People, products and places", icon: icon(UserRound) },
  { name: "Grammar", handles: "Short words such as on, then and the", icon: icon(WholeWord) },
  { name: "Verbs", handles: "Actions and tense", icon: icon(Zap) },
  { name: "Dates", handles: "Months, days and times", icon: icon(CalendarDays) },
  { name: "Symbols", handles: "Currency, units and math signs", icon: icon(Sigma) },
];

/** Illustrative sizes: 5B shared plus 16B per routed expert gives 21B at top 1 and 37B at top 2, out of 671B. */
export const DEFAULT_PARAMETERS: MixtureOfExpertsParameters = { total: 671, shared: 5, perExpert: 16 };

/** The sample sentence: text, first choice, second choice, and their scores. The other experts share the rest. */
const SAMPLE: [string, number, number, number, number][] = [
  ["Maya", 3, 5, .46, .21],
  [" paid", 5, 7, .42, .2],
  [" $", 7, 1, .51, .24],
  ["1", 1, 7, .48, .19],
  [",", 2, 1, .44, .22],
  ["240", 1, 2, .53, .17],
  [" on", 4, 6, .39, .23],
  [" Oct", 6, 3, .47, .2],
  [" 21", 6, 1, .41, .29],
  [",", 2, 4, .5, .18],
  [" then", 4, 5, .43, .21],
  [" ran", 5, 0, .4, .24],
  [" npm", 0, 3, .55, .18],
  [" test", 0, 5, .45, .26],
  [".", 2, 4, .49, .2],
];

function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

export function normalize(scores: number[]) {
  const clean = scores.map(v => (Number.isFinite(v) && v > 0 ? v : 0));
  const sum = clean.reduce((a, b) => a + b, 0);
  return sum > 0 ? clean.map(v => v / sum) : clean.map(() => 1 / Math.max(1, clean.length));
}

/** Spreads what the first two choices leave over the other experts, unevenly but stably. */
function fill(text: string, count: number, first: number, second: number, p1: number, p2: number) {
  const rest = Math.max(0, 1 - p1 - p2);
  const others = Array.from({ length: count }, (_, i) => i).filter(i => i !== first && i !== second);
  const raw = others.map(i => 0.45 + (hash(`${text}:${i}`) % 1000) / 1000);
  const sum = raw.reduce((a, b) => a + b, 0) || 1;
  const scores = new Array<number>(count).fill(0);
  scores[first] = p1;
  if (second !== first) scores[second] = p2;
  /** Never let a leftover outrank the second choice. */
  others.forEach((i, j) => { scores[i] = Math.min(p2 * 0.8, (raw[j] / sum) * rest); });
  return normalize(scores);
}

/** Stable sample scores for a token that brings none. */
export function sampleScores(text: string, count: number) {
  if (count <= 1) return [1];
  const h = hash(text.trim() || text);
  const first = h % count;
  const second = (first + 1 + ((h >>> 8) % (count - 1))) % count;
  const p1 = 0.38 + ((h >>> 4) % 100) / 100 * 0.17;
  const p2 = 0.16 + ((h >>> 12) % 100) / 100 * 0.1;
  return fill(text, count, first, second, p1, p2);
}

export const DEFAULT_TOKENS: MixtureOfExpertsToken[] = SAMPLE.map(([text, a, b, p1, p2]) => ({ text, scores: fill(text, DEFAULT_EXPERTS.length, a, b, p1, p2) }));

/** Best experts first; ties keep expert order so the choice never flickers. */
export function topExperts(scores: number[], k: number) {
  return scores.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v || a.i - b.i).slice(0, Math.max(1, k)).map(o => o.i);
}

/** How many tokens one expert may take in this sequence: the capacity factor times an even share of every route. */
export function capacityFor(tokens: number, experts: number, k: number, factor: number) {
  if (!Number.isFinite(factor) || factor <= 0 || experts < 1) return Infinity;
  return Math.max(1, Math.ceil((factor * tokens * k) / experts));
}

/**
 * Routes every token in order. Each picks its top k experts by gate score; an expert that already holds `capacity`
 * tokens skips the rest, the way capacity limited routers drop overflow.
 */
export function planRoutes(tokens: MixtureOfExpertsToken[], count: number, k: number, capacity: number): PlannedRoute[] {
  const loads = new Array<number>(count).fill(0);
  return tokens.map((token, index) => {
    const given = token.scores && token.scores.length ? Array.from({ length: count }, (_, i) => token.scores?.[i] ?? 0) : null;
    const scores = given ? normalize(given) : sampleScores(token.text, count);
    const experts = topExperts(scores, Math.min(k, count));
    const chosen = experts.map(i => scores[i]);
    const sum = chosen.reduce((a, b) => a + b, 0) || 1;
    const dropped: number[] = [];
    experts.forEach(e => { if (loads[e] >= capacity) dropped.push(e); else loads[e] += 1; });
    return { index, token: token.text.trim() || token.text, scores, experts, weights: chosen.map(v => v / sum), dropped, loads: loads.slice() };
  });
}

/** How evenly routes spread: 100% when every expert took the same number, 0% when one took them all. */
export function balanceOf(loads: number[]) {
  const total = loads.reduce((a, b) => a + b, 0);
  if (!total || loads.length < 2) return null;
  const mean = total / loads.length;
  const peak = Math.max(...loads);
  return Math.max(0, 1 - (peak / mean - 1) / (loads.length - 1));
}
