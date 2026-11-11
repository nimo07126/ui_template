/** Types, sample content and the simulated speech engine behind the speech player preview. */

export type SpeechSpeed = 1 | 1.5 | 2;
export type SpeechStatus = "idle" | "loading" | "playing" | "paused" | "ended" | "error";

export interface SpeechVoice {
  id: string;
  name: string;
  /** One short line under the name in the voice menu, such as "Warm and conversational". */
  description?: string;
}

/** When one word is spoken, in milliseconds on the 1× timeline. One entry per whitespace separated word, in order. */
export interface SpeechTiming { start: number; end: number }

/** What a synthesize call resolves with. Leave out src for a silent, timed playback (prototypes and tests). */
export interface SpeechAudio {
  /** An audio URL or object URL. Playback, seeking and speed then follow the audio element. */
  src?: string;
  /** Word timings from your TTS provider's alignment data. Estimated from the text (and scaled to the audio length) when left out. */
  timings?: SpeechTiming[];
  /** Total length in milliseconds. Defaults to the audio's duration or the end of the last word. */
  duration?: number;
}

export interface SpeechSynthesizeRequest { text: string; voice: SpeechVoice; signal: AbortSignal }

export interface SpeechWord { text: string; index: number; paragraph: number }

/* Sample reply: a travel assistant answering "When do I need to leave for the airport on Thursday?" */
export const speechSampleText = `Your flight to Lisbon leaves Thursday, October 29 at 7:40 from Zurich, gate A54. Check-in closes 40 minutes before departure, so plan to reach the airport by 6:15.

Lisbon looks warm, 21 degrees with a light breeze off the river. Your hotel in Príncipe Real holds the room until midnight, and I added both confirmations to your calendar.`;

export const speechSampleVoices: SpeechVoice[] = [
  { id: "ava", name: "Ava", description: "Warm and conversational" },
  { id: "leo", name: "Leo", description: "Calm, lower register" },
  { id: "maya", name: "Maya", description: "Bright and quick" },
  { id: "noah", name: "Noah", description: "Steady narrator" },
];

/** Speaking pace per sample voice, relative to Ava. Unknown voices read at 1. */
const samplePace: Record<string, number> = { ava: 1, leo: .93, maya: 1.08, noah: .97 };

/** Splits text into paragraphs (blank lines) and words (whitespace). Word indexes run across paragraphs. */
export function tokenizeSpeech(text: string) {
  const paragraphs: SpeechWord[][] = [];
  let index = 0;
  for (const block of text.trim().split(/\n\s*\n/)) {
    const words = block.split(/\s+/).filter(Boolean).map(word => ({ text: word, index: index++, paragraph: paragraphs.length }));
    if (words.length) paragraphs.push(words);
  }
  return { paragraphs, words: paragraphs.flat() };
}

/**
 * Estimates word timings the way a neural voice paces speech: longer words take longer, numbers are read out in full,
 * and commas, sentence ends and paragraph breaks add pauses. About 175 words a minute at pace 1.
 */
export function estimateSpeechTimings(text: string, pace = 1): { timings: SpeechTiming[]; duration: number } {
  const { paragraphs } = tokenizeSpeech(text);
  const timings: SpeechTiming[] = [];
  let t = 140;
  paragraphs.forEach((words, p) => {
    words.forEach((word, i) => {
      const letters = word.text.replace(/[^\p{L}]/gu, "").length;
      const digits = word.text.replace(/[^\p{N}]/gu, "").length;
      const spoken = 150 + letters * 36 + digits * 82;
      timings.push({ start: Math.round(t), end: Math.round(t + spoken / pace) });
      t += spoken / pace;
      const last = i === words.length - 1;
      const pause = last && p < paragraphs.length - 1 ? 560 : /[.!?]["')”]?$/.test(word.text) ? 360 : /[,;:]$/.test(word.text) ? 190 : 22;
      t += pause / pace;
    });
  });
  return { timings, duration: Math.round(t + 160) };
}

/** Scales timings so the last word ends just before the audio does, for providers that return audio without alignment. */
export function fitTimings(timings: SpeechTiming[], duration: number) {
  const end = timings.at(-1)?.end ?? 0;
  if (!end || !duration) return timings;
  const k = Math.max(.1, (duration - 120) / end);
  return timings.map(({ start, end: stop }) => ({ start: Math.round(start * k), end: Math.round(stop * k) }));
}

function abortError() {
  return new DOMException("The request was aborted.", "AbortError");
}

export interface SimulateSpeechOptions { delay?: number; fail?: boolean }

/**
 * A stand in for a TTS request: waits briefly like a network round trip, then resolves with estimated word timings and
 * no audio. Nothing is sent anywhere. Pass fail to see the error state.
 */
export function simulateSpeech({ text, voice, signal }: SpeechSynthesizeRequest, { delay = 640, fail = false }: SimulateSpeechOptions = {}): Promise<SpeechAudio> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      if (fail) { reject(new Error(`${voice.name} timed out. Simulated, nothing was sent.`)); return; }
      resolve(estimateSpeechTimings(text, samplePace[voice.id] ?? 1));
    }, delay);
    function onAbort() { window.clearTimeout(timer); reject(abortError()); }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
