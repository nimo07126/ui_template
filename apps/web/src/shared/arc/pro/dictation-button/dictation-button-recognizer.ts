/**
 * The recognizer contract behind DictationButton, plus a simulated recognizer that streams realistic interim and final
 * results with speech-like levels. Nothing touches a microphone; swap in createWebSpeechRecognizer or your own adapter
 * (Deepgram, Whisper over a websocket, AssemblyAI) when you wire it to a real product.
 */

/** Cumulative text for the current session. `final` is settled; `interim` is the recognizer's live guess and may change. */
export interface DictationTranscript {
  final: string;
  interim: string;
}

export type DictationErrorCode = "not-allowed" | "no-speech" | "audio-capture" | "network" | "unsupported" | "aborted";

export class DictationError extends Error {
  readonly code: DictationErrorCode;
  constructor(code: DictationErrorCode, message?: string) {
    super(message ?? code);
    this.name = "DictationError";
    this.code = code;
  }
}

export interface DictationHandlers {
  /** Call with the cumulative transcript whenever it changes. */
  onTranscript: (transcript: DictationTranscript) => void;
  /** Input level from 0 to 1, as often as you like (every 40 to 80ms looks best). Drives the waveform. */
  onLevel: (level: number) => void;
  /** The speaker paused long enough that the recognizer considers the utterance done. Optional. */
  onSpeechEnd: () => void;
  /** A failure after start resolved (network drop, device unplugged). */
  onError: (code: DictationErrorCode) => void;
}

export interface DictationSession {
  /** Finish listening and resolve with the final text. Aborting the start signal cancels instead. */
  stop: () => Promise<string>;
}

/**
 * Start a session. Resolve once audio is flowing; reject with a DictationError("not-allowed") when permission is denied.
 * The signal aborts when the person cancels or the component unmounts: release the microphone and stop emitting.
 */
export type DictationRecognizer = (handlers: DictationHandlers, signal: AbortSignal) => Promise<DictationSession>;

/** One recognizer phrase: what the person said, and optionally what the recognizer first heard before correcting itself. */
export interface DictationPhrase {
  text: string;
  heard?: string;
}

export const dictationScripts: DictationPhrase[][] = [
  [
    { text: "Draft a reply to Priya", heard: "Draft a reply to Pria" },
    { text: "saying the Q4 pricing review moves to Thursday at 2 PM,", heard: "saying the cue for pricing review moves to Thursday at 2 PM" },
    { text: "and ask her to bring the churn numbers from Stripe." },
  ],
  [
    { text: "Summarize the open Linear issues tagged billing,", heard: "Summarize the open linear issues tagged billing" },
    { text: "group them by customer," },
    { text: "and flag anything that blocks the October 31 release.", heard: "and flag anything that blocks the October 30 first release" },
  ],
  [
    { text: "Rewrite this onboarding email so it's shorter and warmer.", heard: "Rewrite this on boarding email so it's shorter and warmer" },
    { text: "Keep the 14-day trial", heard: "Keep the 14 day trial" },
    { text: "and the link to the setup guide." },
  ],
];

export interface SimulatedRecognizerOptions {
  /** Phrases to speak, one script per session, in rotation. */
  scripts?: DictationPhrase[][];
  /** Reject every start with "not-allowed", as a browser does after the person blocks the microphone. */
  deny?: boolean;
  /** Time to "open the microphone", in ms. */
  startDelay?: number;
  /** Time the final pass takes after stop, in ms. */
  finalizeDelay?: number;
  /** Average time between interim updates, in ms. */
  wordInterval?: number;
}

const words = (text: string) => text.split(/\s+/).filter(Boolean);

/** A recognizer that speaks a script: interim words arrive at a quick speaking pace, then each phrase settles into its final, corrected text. */
export function createSimulatedRecognizer({ scripts = dictationScripts, deny = false, startDelay = 160, finalizeDelay = 620, wordInterval = 150 }: SimulatedRecognizerOptions = {}): DictationRecognizer {
  let next = 0;
  const recognizer: DictationRecognizer = (handlers, signal) => new Promise<DictationSession>((resolve, reject) => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    let levelTimer: ReturnType<typeof setInterval> | undefined;
    const later = (fn: () => void, ms: number) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };
    const clear = () => { timers.forEach(clearTimeout); timers.clear(); if (levelTimer) clearInterval(levelTimer); levelTimer = undefined; };
    signal.addEventListener("abort", () => { clear(); reject(new DictationError("aborted")); }, { once: true });

    later(() => {
      if (deny) { reject(new DictationError("not-allowed", "Microphone access was denied")); return; }
      const script = scripts[next++ % Math.max(1, scripts.length)] ?? [];
      const finals: string[] = [];
      let phrase = 0, revealed = 0, speaking = false, phase = 0;

      // Speech-like levels: syllable pulses while words arrive, a quiet noise floor in pauses.
      levelTimer = setInterval(() => {
        phase += 0.9;
        const level = speaking ? 0.32 + 0.5 * Math.abs(Math.sin(phase)) * (0.55 + Math.random() * 0.45) + Math.random() * 0.12 : 0.03 + Math.random() * 0.05;
        handlers.onLevel(Math.min(1, level));
      }, 50);

      const emit = (interim: string) => handlers.onTranscript({ final: finals.join(" "), interim });
      const step = () => {
        const current = script[phrase];
        if (!current) { speaking = false; handlers.onSpeechEnd(); return; }
        const heard = words(current.heard ?? current.text);
        if (revealed < heard.length) {
          speaking = true;
          revealed = Math.min(heard.length, revealed + (Math.random() < 0.4 ? 2 : 1));
          emit(heard.slice(0, revealed).join(" "));
          later(step, wordInterval * (0.75 + Math.random() * 0.5));
          return;
        }
        // The phrase settles: the guess is replaced by the corrected final text, then a short breath.
        finals.push(current.text);
        phrase += 1; revealed = 0; speaking = false;
        emit("");
        later(step, 300);
      };
      later(step, 220);

      resolve({
        stop: () => new Promise<string>((done, fail) => {
          clear();
          const current = script[phrase];
          if (current && revealed > 0) finals.push(current.text);
          speaking = false;
          handlers.onLevel(0);
          emit("");
          if (signal.aborted) { fail(new DictationError("aborted")); return; }
          later(() => done(finals.join(" ")), finalizeDelay);
        }),
      });
    }, startDelay);
  });
  simulated.add(recognizer);
  return recognizer;
}

const simulated = new WeakSet<DictationRecognizer>();
/** True for recognizers made by createSimulatedRecognizer, so the UI can say that nothing is recorded. */
export const isSimulatedRecognizer = (recognizer: DictationRecognizer) => simulated.has(recognizer);
