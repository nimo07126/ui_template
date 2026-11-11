/**
 * Adapter: the browser Web Speech API as a DictationRecognizer. Chrome, Edge and Safari ship SpeechRecognition
 * (prefixed as webkitSpeechRecognition); Firefox does not, so start rejects with "unsupported" there. Chrome sends audio
 * to a cloud service, so say so in your privacy copy. Levels come from a separate getUserMedia stream through an
 * AnalyserNode, which also triggers the permission prompt up front.
 *
 *   <DictationButton recognizer={createWebSpeechRecognizer({ lang: "en-US" })} onSend={send} />
 */
import { DictationError } from "./dictation-button-recognizer";
import type { DictationErrorCode, DictationRecognizer } from "./dictation-button-recognizer";

interface SpeechAlternative { transcript: string }
interface SpeechResult { isFinal: boolean; 0: SpeechAlternative }
interface SpeechResultEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface SpeechErrorEvent { error: string }
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  onspeechend: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const codeFor = (error: string): DictationErrorCode =>
  error === "not-allowed" || error === "service-not-allowed" ? "not-allowed"
    : error === "no-speech" ? "no-speech"
    : error === "audio-capture" ? "audio-capture"
    : error === "network" ? "network"
    : error === "aborted" ? "aborted"
    : "network";

export interface WebSpeechRecognizerOptions {
  /** BCP 47 language tag. Defaults to the document language, then en-US. */
  lang?: string;
  /** Read input levels from the microphone for the waveform. Defaults to true. */
  levels?: boolean;
}

export function createWebSpeechRecognizer({ lang, levels = true }: WebSpeechRecognizerOptions = {}): DictationRecognizer {
  return async (handlers, signal) => {
    const scope = globalThis as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
    const Recognition = scope.SpeechRecognition ?? scope.webkitSpeechRecognition;
    if (!Recognition) throw new DictationError("unsupported", "SpeechRecognition is not available in this browser");

    let stream: MediaStream | undefined;
    let audio: AudioContext | undefined;
    let frame = 0;
    const release = () => { cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()); void audio?.close().catch(() => {}); stream = undefined; audio = undefined; };

    if (levels && navigator.mediaDevices?.getUserMedia) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      } catch (error) {
        const name = (error as { name?: string }).name;
        throw new DictationError(name === "NotAllowedError" || name === "SecurityError" ? "not-allowed" : "audio-capture");
      }
      if (signal.aborted) { release(); throw new DictationError("aborted"); }
      audio = new AudioContext();
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      audio.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const read = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
        handlers.onLevel(Math.min(1, Math.sqrt(sum / data.length) * 5));
        frame = requestAnimationFrame(read);
      };
      read();
    }

    const recognition = new Recognition();
    recognition.lang = lang ?? (document.documentElement.lang || "en-US");
    recognition.continuous = true;
    recognition.interimResults = true;

    let finalText = "";
    let started = false;
    let ended = false;
    let finish: ((text: string) => void) | undefined;

    recognition.onresult = event => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      handlers.onTranscript({ final: finalText.trim(), interim: interim.trim() });
    };
    recognition.onspeechend = () => handlers.onSpeechEnd();
    recognition.onend = () => { ended = true; release(); finish?.(finalText.trim()); };
    signal.addEventListener("abort", () => { recognition.abort(); release(); }, { once: true });

    await new Promise<void>((resolve, reject) => {
      recognition.onstart = () => { started = true; resolve(); };
      recognition.onerror = event => {
        const code = codeFor(event.error);
        if (!started) { release(); reject(new DictationError(code)); return; }
        if (code !== "aborted") handlers.onError(code);
      };
      recognition.start();
    });

    return {
      stop: () => new Promise<string>(resolve => {
        if (ended) { resolve(finalText.trim()); return; }
        finish = resolve;
        recognition.stop();
      }),
    };
  };
}
