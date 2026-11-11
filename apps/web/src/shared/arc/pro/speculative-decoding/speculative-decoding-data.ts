/** One token of the target model's answer. Text keeps its leading space, the way tokenizers store it. */
export interface DecodeToken {
  text: string;
  /** How likely the draft model is to guess this token, from 0 to 1. Defaults to 0.8. */
  ease?: number;
  /** What the draft model proposes when it misses this token. */
  miss?: string;
}

/** One round of a recorded run: the draft model's guesses, how many the target accepted, and the target's own token. */
export interface DecodeRound {
  /** Tokens the draft model proposed this round, in order, with their leading spaces. */
  draft: string[];
  /** How many draft tokens the target accepted, counted from the start. */
  accepted: number;
  /** The target's token: the correction at the first rejected position, or a bonus token when every draft was accepted. */
  target: string;
}

export interface DecodeStats {
  /** Target forward passes. */
  passes: number;
  /** Draft tokens proposed and accepted. */
  drafted: number;
  accepted: number;
  /** Output tokens produced. */
  tokens: number;
  /** Accepted over drafted, 0 to 1. */
  acceptance: number;
  tokensPerPass: number;
  /** Time without speculation over time with it, counting draft time. */
  speedup: number;
}

export type TokenOrigin = "draft" | "target";
export interface OutputToken { text: string; origin: TokenOrigin; round: number }

export interface PlannedRound extends DecodeRound {
  index: number;
  /** Timeline in target pass units: drafting starts, verification starts, tokens leave for the output, the round ends. */
  start: number;
  verify: number;
  settle: number;
  end: number;
  /** Index of the round's first token in the output. */
  outStart: number;
}

export interface DecodePlan {
  rounds: PlannedRound[];
  output: OutputToken[];
  /** Time when the speculative run is done, in target pass units. */
  end: number;
  stats: DecodeStats;
}

/** Where the sweep and the settle fall inside one target pass, as fractions of it. */
export const SWEEP = 0.4;
export const SETTLE = 0.72;

/**
 * The sample answer. Ease is how predictable each token is for a small model: function words and punctuation come easy,
 * numbers and specific nouns are where the draft guesses wrong. Values are illustrative, not measured.
 */
export const sampleTokens: DecodeToken[] = [
  { text: "Your", ease: 0.92, miss: "The" },
  { text: " preview", ease: 0.55, miss: " latest" },
  { text: " deploy", ease: 0.9, miss: " build" },
  { text: " finished", ease: 0.8, miss: " completed" },
  { text: " in", ease: 0.97, miss: " after" },
  { text: " 42", ease: 0.3, miss: " 38" },
  { text: " seconds", ease: 0.95, miss: " minutes" },
  { text: ",", ease: 0.85, miss: " and" },
  { text: " and", ease: 0.9, miss: " so" },
  { text: " all", ease: 0.7, miss: " the" },
  { text: " 318", ease: 0.25, miss: " 300" },
  { text: " checks", ease: 0.85, miss: " tests" },
  { text: " passed", ease: 0.9, miss: " ran" },
  { text: ",", ease: 0.8, miss: "." },
  { text: " so", ease: 0.65, miss: " and" },
  { text: " the", ease: 0.92, miss: " your" },
  { text: " branch", ease: 0.6, miss: " pull" },
  { text: " is", ease: 0.95, miss: " can" },
  { text: " ready", ease: 0.9, miss: " safe" },
  { text: " to", ease: 0.97, miss: " for" },
  { text: " merge", ease: 0.85, miss: " ship" },
  { text: ".", ease: 0.95, miss: " now" },
];

/** Deterministic hash to [0, 1), so the same seed, token and draft position always give the same guess. */
function chance(seed: number, position: number, offset: number) {
  let h = (Math.imul(seed + 1, 2654435761) ^ Math.imul(position + 1, 374761393) ^ Math.imul(offset + 7, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h = Math.imul(h ^ (h >>> 13), 3266489917);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const FALLBACK_MISS = [" the", " a", " and", ",", " to", " of"];
const missFor = (token: DecodeToken, position: number) => token.miss ?? FALLBACK_MISS[position % FALLBACK_MISS.length];

/**
 * Plays the draft and target against each other for one answer. Each round drafts up to `draftLength` tokens; the target
 * accepts them while they match, and a guess gets less likely the further ahead it is. Everything after the first miss is
 * thrown away, which is why long drafts accept a smaller share.
 */
export function simulateRounds(tokens: DecodeToken[], draftLength: number, seed = 12): DecodeRound[] {
  const rounds: DecodeRound[] = [];
  const k = Math.max(0, Math.round(draftLength));
  let position = 0;
  while (position < tokens.length) {
    // Leave the last token of the answer to the target, so every round ends with a token of its own.
    const size = Math.min(k, tokens.length - position - 1);
    let accepted = 0;
    while (accepted < size && chance(seed, position + accepted, accepted) < (tokens[position + accepted].ease ?? 0.8) * Math.pow(0.95, accepted)) accepted += 1;
    const draft = Array.from({ length: size }, (_, offset) => {
      const index = position + offset;
      return offset === accepted ? missFor(tokens[index], index) : tokens[index].text;
    });
    rounds.push({ draft, accepted, target: tokens[position + accepted].text });
    position += accepted + 1;
  }
  return rounds;
}

/** Lays rounds on a timeline. One target pass is 1; each draft token costs `draftCost` of a pass. */
export function planRounds(input: DecodeRound[], draftCost = 0.1): DecodePlan {
  const rounds: PlannedRound[] = [];
  const output: OutputToken[] = [];
  let time = 0;
  let drafted = 0;
  let accepted = 0;
  input.forEach((round, index) => {
    const draft = round.draft.slice();
    const hits = Math.max(0, Math.min(draft.length, Math.round(round.accepted)));
    const verify = time + draft.length * draftCost;
    rounds.push({ draft, accepted: hits, target: round.target, index, start: time, verify, settle: verify + SETTLE, end: verify + 1, outStart: output.length });
    draft.slice(0, hits).forEach(text => output.push({ text, origin: "draft", round: index }));
    output.push({ text: round.target, origin: "target", round: index });
    drafted += draft.length;
    accepted += hits;
    time = verify + 1;
  });
  const tokens = output.length;
  return {
    rounds,
    output,
    end: time,
    stats: {
      passes: rounds.length,
      drafted,
      accepted,
      tokens,
      acceptance: drafted ? accepted / drafted : 0,
      tokensPerPass: rounds.length ? tokens / rounds.length : 0,
      speedup: time ? tokens / time : 1,
    },
  };
}

export type DecodePhase = "idle" | "draft" | "verify" | "settle" | "done";

/** Everything the card shows at one moment, derived from the clock alone so pause, restart and scrubbing stay exact. */
export interface DecodeView {
  phase: DecodePhase;
  /** Round in progress, or -1 before the first. */
  round: number;
  /** Draft chips on screen. */
  shown: number;
  /** Sweep progress in columns, 0 to the draft size. */
  sweep: number;
  /** Columns with a verdict. */
  verdicts: number;
  /** Whether the target's own token is on screen. */
  targetShown: boolean;
  /** Output tokens landed, with and without speculation. */
  emitted: number;
  baseline: number;
  /** Rounds whose tokens have landed. */
  settled: number;
  specDone: boolean;
  baseDone: boolean;
  /** Current target pass without speculation, 1 based, 0 before the start. */
  basePass: number;
}

export function viewAt(plan: DecodePlan, time: number): DecodeView {
  const total = plan.output.length;
  let round = -1;
  for (let index = 0; index < plan.rounds.length; index += 1) if (plan.rounds[index].start <= time) round = index;
  let emitted = 0;
  let settled = 0;
  for (const item of plan.rounds) if (item.settle <= time) { emitted += item.accepted + 1; settled += 1; }
  const baseline = Math.max(0, Math.min(total, Math.floor(time - SETTLE) + 1));
  const base = { emitted, settled, baseline, specDone: time >= plan.end, baseDone: time >= total, basePass: time > 0 ? Math.min(total, Math.floor(time) + 1) : 0 };
  if (round < 0 || time <= 0) return { phase: "idle", round: -1, shown: 0, sweep: 0, verdicts: 0, targetShown: false, ...base };
  const current = plan.rounds[round];
  const size = current.draft.length;
  if (time >= plan.end) return { phase: "done", round, shown: size, sweep: size, verdicts: size, targetShown: true, ...base };
  const step = size ? (current.verify - current.start) / size : 0;
  const shown = step ? Math.min(size, Math.floor((time - current.start) / step) + 1) : 0;
  const progress = Math.max(0, Math.min(1, (time - current.verify) / SWEEP));
  const sweep = time < current.verify ? 0 : progress * size;
  const verdicts = Math.min(size, Math.floor(sweep + 0.45));
  const targetShown = current.accepted < size ? verdicts > current.accepted : progress >= 1;
  const phase: DecodePhase = time < current.verify ? "draft" : time < current.settle ? "verify" : "settle";
  return { phase, round, shown, sweep, verdicts, targetShown, ...base };
}

/** Running stats over the rounds that have landed. */
export function statsAt(plan: DecodePlan, settled: number): DecodeStats | null {
  if (settled <= 0) return null;
  const done = plan.rounds.slice(0, settled);
  const drafted = done.reduce((sum, item) => sum + item.draft.length, 0);
  const accepted = done.reduce((sum, item) => sum + item.accepted, 0);
  const tokens = accepted + done.length;
  const time = done[done.length - 1].end;
  return { passes: done.length, drafted, accepted, tokens, acceptance: drafted ? accepted / drafted : 0, tokensPerPass: tokens / done.length, speedup: tokens / time };
}
