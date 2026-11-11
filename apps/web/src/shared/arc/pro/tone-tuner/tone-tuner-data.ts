/** Types, the sample support reply and its rewrites, and the text helpers behind the tone tuner. */

export type ToneLevel = 0 | 1 | 2;
export type ToneVoice = "neutral" | "friendly" | "confident" | "empathetic";

export interface ToneSettings {
  /** 0 casual, 1 neutral, 2 formal. */
  formality: ToneLevel;
  /** 0 concise, 1 balanced, 2 detailed. */
  detail: ToneLevel;
  voice: ToneVoice;
}

export interface TonePreset {
  voice: Exclude<ToneVoice, "neutral">;
  label: string;
  formality: ToneLevel;
  detail: ToneLevel;
}

export interface ToneRewriteRequest extends ToneSettings {
  /** The original draft, always the source of every rewrite. */
  text: string;
  /** A ready made instruction for a model, built from the settings. */
  instructions: string;
}

/** A paragraph of sentences, or of lines (a sign off) when `lines` is set. Empty strings are slots with nothing in them. */
export interface ToneParagraph { segments: string[]; lines?: boolean }
export type ToneDoc = ToneParagraph[];

export const toneOriginal: ToneSettings = { formality: 1, detail: 1, voice: "neutral" };

export const tonePresets: TonePreset[] = [
  { voice: "friendly", label: "Friendly", formality: 0, detail: 1 },
  { voice: "confident", label: "Confident", formality: 1, detail: 0 },
  { voice: "empathetic", label: "Empathetic", formality: 1, detail: 2 },
];

export const formalityLabels = ["Casual", "Neutral", "Formal"] as const;
export const detailLabels = ["Concise", "Balanced", "Detailed"] as const;

type ByLevel = readonly [string, string, string];

/* A billing support reply: Sofia Ramirez was charged twice for invoice INV-20481 on October 24, 2026. */
const greeting: ByLevel = ["Hi Sofia,", "Hello Sofia,", "Dear Ms. Ramirez,"];

const opener: Record<ToneVoice, ByLevel> = {
  neutral: [
    "Thanks for flagging the double charge on your October invoice.",
    "Thank you for reporting the duplicate charge on your October invoice.",
    "Thank you for bringing the duplicate charge on invoice INV-20481 to our attention.",
  ],
  friendly: [
    "Thanks so much for the heads up about the double charge, and sorry for the hassle!",
    "Thanks for letting us know about the double charge, and sorry for the hassle.",
    "Thank you kindly for letting us know about the duplicate charge on invoice INV-20481.",
  ],
  confident: [
    "Good catch on the double charge. It's already sorted.",
    "You were right about the duplicate charge, and it is already resolved.",
    "We have confirmed the duplicate charge on invoice INV-20481 and resolved it in full.",
  ],
  empathetic: [
    "I'm really sorry you got charged twice. That's stressful, especially at month end.",
    "I'm sorry you were charged twice. I know how disruptive that is at month end.",
    "Please accept our apologies for the duplicate charge. We understand how disruptive this is at month end.",
  ],
};

const core: ByLevel = ["We've refunded the extra $1,240", "We have refunded the extra $1,240.00", "A full refund of $1,240.00 has been issued to your card ending 4417"];
const timing: ByLevel = [", so it should land on your card in 5 to 10 business days", ", and it should reach your card within 5 to 10 business days", " and should appear on your statement within 5 to 10 business days"];
const cause: ByLevel = [
  "A payment retry fired twice after a timeout, and we've added a check so it can't happen again.",
  "A payment retry ran twice after a timeout, and we have added a safeguard so it cannot happen again.",
  "The cause was a payment retry that ran twice following a timeout; we have since added a safeguard to prevent any recurrence.",
];

const closer: Record<ToneVoice, ByLevel> = {
  neutral: ["Let me know if anything else looks off.", "Let me know if anything else looks wrong.", "Please let us know if you notice any further discrepancies."],
  friendly: ["Shout if anything else looks off, happy to help!", "Just reply here if anything else looks off. Happy to help.", "Please do reply if anything else looks amiss; we are always happy to help."],
  confident: ["You're all set.", "No action is needed on your side.", "No further action is required on your part."],
  empathetic: ["If it caused any trouble on your end, tell me and I'll make it right.", "If this caused any trouble on your end, reply here and I will make it right.", "Should this have caused any difficulty on your side, please reply and we will make it right."],
};

const signoff: ByLevel = ["Cheers,", "Best,", "Kind regards,"];
const signature: ByLevel = ["Jordan", "Jordan", "Jordan Reyes, Billing support"];

/** The sample reply for a set of settings. Every version has the same slots, so each sentence crossfades in place. */
export function sampleDoc({ formality: f, detail: d, voice }: ToneSettings): ToneDoc {
  return [
    { segments: [greeting[f]] },
    { segments: [opener[voice][f], `${core[f]}${d > 0 ? timing[f] : ""}.`, d > 1 ? cause[f] : ""] },
    { segments: [closer[voice][f]] },
    { segments: [signoff[f], signature[f]], lines: true },
  ];
}

const levels: ToneLevel[] = [0, 1, 2];
const voices: ToneVoice[] = ["neutral", "friendly", "confident", "empathetic"];
/**
 * The longest sample version for each formality and detail level (indexed [formality][detail]), laid out invisibly
 * under the text. Switching voice never resizes the card; a slider move eases it to the new height.
 */
export const sampleTallest: ToneDoc[][] = levels.map(formality => levels.map(detail => voices.map(voice => sampleDoc({ formality, detail, voice }))
  .reduce((best, doc) => docText(doc).length > docText(best).length ? doc : best)));

/** Plain text: paragraphs split by a blank line, sign off lines by a line break. */
export function docText(doc: ToneDoc) {
  return doc.map(p => p.segments.filter(Boolean).join(p.lines ? "\n" : " ")).filter(Boolean).join("\n\n");
}

/** Splits plain text into paragraphs and sentences. A paragraph with single line breaks keeps its lines. */
export function parseDoc(text: string): ToneDoc {
  return text.trim().split(/\n\s*\n/).map(block => block.trim()).filter(Boolean).map(block => block.includes("\n")
    ? { segments: block.split("\n").map(line => line.trim()).filter(Boolean), lines: true }
    : { segments: (block.match(/[^.!?]+(?:[.!?]+["')\]]*|$)/g) ?? [block]).map(s => s.trim()).filter(Boolean) });
}

export const sameSettings = (a: ToneSettings, b: ToneSettings) => a.formality === b.formality && a.detail === b.detail && a.voice === b.voice;

export function describeSettings(s: ToneSettings) {
  const voice = s.voice === "neutral" ? "neutral voice" : `${s.voice} voice`;
  return `${voice}, ${formalityLabels[s.formality].toLowerCase()}, ${detailLabels[s.detail].toLowerCase()}`;
}

export function instructionsFor(s: ToneSettings) {
  const formality = ["casual and conversational", "neutral and plain", "formal and polished"][s.formality];
  const detail = ["as short as possible", "about the same length", "more detailed, adding useful context"][s.detail];
  const voice = s.voice === "neutral" ? "" : ` Use a ${s.voice} voice.`;
  return `Rewrite this message. Make it ${formality}, ${detail}.${voice} Keep every fact, number and name. Return plain text with the same paragraph breaks.`;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);
const norm = (word: string) => word.toLowerCase().replace(/[^\p{L}\p{N}$]/gu, "");

/**
 * Marks which words in `doc` are new compared with `original`: a word level longest common subsequence over the whole
 * text. Returns one flag per word for every segment, in the same shape as the doc.
 */
export function diffDoc(original: ToneDoc, doc: ToneDoc): boolean[][][] {
  const a = original.flatMap(p => p.segments.flatMap(words)).map(norm);
  const shape = doc.map(p => p.segments.map(words));
  const b = shape.flat(2).map(norm);
  const rows = a.length + 1, cols = b.length + 1;
  const table = new Uint16Array(rows * cols);
  for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) {
    table[i * cols + j] = a[i] === b[j] ? table[(i + 1) * cols + j + 1] + 1 : Math.max(table[(i + 1) * cols + j], table[i * cols + j + 1]);
  }
  const added = new Array<boolean>(b.length).fill(true);
  for (let i = 0, j = 0; i < a.length && j < b.length;) {
    if (a[i] === b[j]) { added[j] = false; i++; j++; }
    else if (table[(i + 1) * cols + j] >= table[i * cols + j + 1]) i++;
    else j++;
  }
  let k = 0;
  return shape.map(p => p.map(seg => seg.map(() => added[k++])));
}

export const wordCount = (doc: ToneDoc) => doc.reduce((n, p) => n + p.segments.reduce((m, s) => m + words(s).length, 0), 0);
