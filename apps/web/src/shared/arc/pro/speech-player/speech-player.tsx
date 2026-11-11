"use client";

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, CircleAlert, RotateCcw, RotateCw, ThumbsDown, ThumbsUp, Volume2, X } from "lucide-react";
import { CopyButton } from "../../copy-button/copy-button";
import { Popover, PopoverContent, PopoverTrigger } from "../../popover/popover";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { motionTokens } from "../../lib/motion-tokens";
import { estimateSpeechTimings, fitTimings, simulateSpeech, speechSampleText, speechSampleVoices, tokenizeSpeech } from "./speech-player-data";
import type { SpeechAudio, SpeechSpeed, SpeechStatus, SpeechSynthesizeRequest, SpeechTiming, SpeechVoice, SpeechWord } from "./speech-player-data";
import { ClaudeMark } from "./speech-player-marks";
import styles from "./speech-player.module.css";

export type { SpeechAudio, SpeechSpeed, SpeechStatus, SpeechSynthesizeRequest, SpeechTiming, SpeechVoice, SpeechWord } from "./speech-player-data";
export { estimateSpeechTimings, fitTimings, simulateSpeech, speechSampleText, speechSampleVoices, tokenizeSpeech } from "./speech-player-data";

/** Where playback is when an event fires. Times are milliseconds on the 1× timeline. */
export interface SpeechPlaybackEvent { time: number; duration: number; wordIndex: number; voice: SpeechVoice; speed: SpeechSpeed }
export interface SpeechWordEvent extends SpeechPlaybackEvent { word: string }

export interface SpeechPlayerProps {
  /** The reply to read. Blank lines start new paragraphs. Leave it out for the sample reply, which plays itself once in view. */
  text?: string;
  /** Who wrote the reply, shown above it. Defaults to Claude Sonnet 5.5 for the sample and to nothing otherwise; null hides it. */
  author?: { name: string; mark?: ReactNode } | null;
  /** Voices in the picker. Defaults to the sample voices Ava, Leo, Maya and Noah. */
  voices?: SpeechVoice[];
  /** The selected voice id (controlled). Pair with onVoiceChange. */
  voice?: string;
  /** The first voice id when uncontrolled. Defaults to the first voice. */
  defaultVoice?: string;
  /** Called when a voice is picked. Changing voice mid-sentence fetches new audio and resumes from the same word. */
  onVoiceChange?: (voice: SpeechVoice) => void;
  /** Playback speed (controlled). Pair with onSpeedChange. */
  speed?: SpeechSpeed;
  defaultSpeed?: SpeechSpeed;
  onSpeedChange?: (speed: SpeechSpeed) => void;
  /** Fetches speech for the text and voice. Abort when the signal fires. Without it, a local simulation supplies timings and no audio. */
  synthesize?: (request: SpeechSynthesizeRequest) => Promise<SpeechAudio>;
  /** Marks playback as simulated in the voice menu and announcements. Defaults to true when synthesize is left out. */
  simulated?: boolean;
  /** Starts reading once the player scrolls into view. Defaults to true for the sample reply. */
  autoPlay?: boolean;
  /** Buttons after Read aloud in the action row. Defaults to Copy, Good response and Bad response; null shows Read aloud alone. */
  actions?: ReactNode;
  /** card draws a bordered surface; plain drops the border and padding to sit inside a chat column. */
  variant?: "card" | "plain";
  onPlay?: (event: SpeechPlaybackEvent) => void;
  onPause?: (event: SpeechPlaybackEvent) => void;
  onEnd?: (event: SpeechPlaybackEvent) => void;
  /** Called when a scrub, arrow key or click on a word moves playback. */
  onSeek?: (event: SpeechPlaybackEvent) => void;
  /** Called each time the spoken word changes. */
  onWordChange?: (event: SpeechWordEvent) => void;
  /** Called when the player is closed and the action row returns. */
  onClose?: () => void;
  className?: string;
}

const SPEEDS: SpeechSpeed[] = [1, 1.5, 2];
const SAMPLE_AUTHOR = { name: "Claude Sonnet 5.5", mark: <ClaudeMark style={{ color: "#D97757" }} /> };
/* The sample loop alternates between these, so voice switching and 1.5× both get seen. */
const DEMO_LOOP: { voice: string; speed: SpeechSpeed }[] = [{ voice: "ava", speed: 1 }, { voice: "leo", speed: 1.5 }];
const FALLBACK_VOICE: SpeechVoice = { id: "default", name: "Default" };

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const speedLabel = (speed: SpeechSpeed) => `${speed}×`;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 0:04, 1:12: whole seconds, tabular, so the label never shifts its neighbours. */
export function formatSpeechTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** The last word that has started by time t, or -1 before the first. */
function findWord(timings: SpeechTiming[], t: number) {
  let lo = 0, hi = timings.length - 1, found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timings[mid].start <= t) { found = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return found;
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";

/* Crossfades: the outgoing layer leaves in 100ms, the incoming one arrives in 160ms with a 2px rise. */
const fadeIn = (reduced: boolean): Transition => reduced ? { duration: 0 } : { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter], delay: .04 };
const fadeOut = (reduced: boolean): Transition => reduced ? { duration: 0 } : { duration: .1, ease: [...motionTokens.ease.standard] };
const layer = (on: boolean, reduced: boolean) => ({ animate: { opacity: on ? 1 : 0, y: on || reduced ? 0 : 2 }, transition: on ? fadeIn(reduced) : fadeOut(reduced) });

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".3" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

function PlayGlyph() {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M5.25 3.6v8.8a.75.75 0 0 0 1.14.64l7.1-4.4a.75.75 0 0 0 0-1.28l-7.1-4.4a.75.75 0 0 0-1.14.64Z" /></svg>;
}

function PauseGlyph() {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="4.25" y="3.25" width="2.75" height="9.5" rx=".9" /><rect x="9" y="3.25" width="2.75" height="9.5" rx=".9" /></svg>;
}

type PlayMode = "play" | "pause" | "replay" | "retry" | "loading";
const playLabel: Record<PlayMode, string> = { play: "Play", pause: "Pause", replay: "Play again", retry: "Retry", loading: "Preparing audio" };

function playMode(status: SpeechStatus): PlayMode {
  if (status === "playing") return "pause";
  if (status === "loading") return "loading";
  if (status === "ended") return "replay";
  if (status === "error") return "retry";
  return "play";
}

/** Icons swap with a quick scale and fade in place; the button itself never moves. */
function PlayIcon({ mode, reduced }: { mode: PlayMode; reduced: boolean }) {
  const icon = mode === "pause" ? <PauseGlyph /> : mode === "loading" ? <Spinner /> : mode === "replay" ? <RotateCcw size={16} strokeWidth={2} aria-hidden="true" /> : mode === "retry" ? <RotateCw size={16} strokeWidth={2} aria-hidden="true" /> : <PlayGlyph />;
  return <AnimatePresence initial={false}>
    <motion.span key={mode} className={styles.playIcon}
      initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .6 }} animate={{ opacity: 1, scale: 1 }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: .6, transition: { duration: .1 } }}
      transition={reduced ? { duration: 0 } : { ...motionTokens.spring.snappy, opacity: { duration: motionTokens.duration.instant } }}>{icon}</motion.span>
  </AnimatePresence>;
}

/** Copy, Good response and Bad response: the default action row next to Read aloud. Feedback is local and says so. */
function DefaultActions({ text, announce }: { text: string; announce: (message: string) => void }) {
  const [feedback, setFeedback] = useState<"good" | "bad" | null>(null);
  const rate = (value: "good" | "bad") => {
    const next = feedback === value ? null : value;
    setFeedback(next);
    announce(next ? `Marked as a ${next} response. Simulated, nothing was sent.` : "Feedback removed.");
  };
  return <>
    <CopyButton value={text} label="Copy reply" iconOnly variant="plain" className={styles.copy} />
    <Tooltip content="Good response"><button type="button" className={styles.iconButton} aria-label="Good response" aria-pressed={feedback === "good"} onClick={() => rate("good")}>
      <ThumbsUp size={16} strokeWidth={1.75} aria-hidden="true" />
    </button></Tooltip>
    <Tooltip content="Bad response"><button type="button" className={styles.iconButton} aria-label="Bad response" aria-pressed={feedback === "bad"} onClick={() => rate("bad")}>
      <ThumbsDown size={16} strokeWidth={1.75} aria-hidden="true" />
    </button></Tooltip>
  </>;
}

interface EngineState {
  status: SpeechStatus;
  open: boolean;
  time: number;
  duration: number;
  timings: SpeechTiming[];
  audio: HTMLAudioElement | null;
  raf: number;
  last: number;
  word: number;
  second: number;
  speed: SpeechSpeed;
  loadedVoice: string | null;
  requestedVoice: string | null;
  resumeAfterLoad: boolean;
  controller: AbortController | null;
  dragging: boolean;
  reduced: boolean;
  highlightTop: number | null;
  focus: "play" | "read" | null;
  /* Sample autoplay */
  interacted: boolean;
  autoPaused: boolean;
  timers: number[];
  onAutoEnd: (() => void) | null;
}

interface Latest {
  text: string;
  words: SpeechWord[];
  voice: SpeechVoice;
  voices: SpeechVoice[];
  synthesize?: SpeechPlayerProps["synthesize"];
  simulated: boolean;
  props: SpeechPlayerProps;
}

/**
 * Read aloud for an AI reply. The action row's Read aloud button turns into a compact player in place: play and pause,
 * a scrubbable progress bar, speed and voice. The spoken word is highlighted as it plays, and the highlight glides
 * from word to word. Wire a TTS provider through synthesize, or leave it out for simulated timing with no audio.
 */
export function SpeechPlayer(props: SpeechPlayerProps) {
  const { text: textProp, author: authorProp, voices: voicesProp, voice: voiceProp, defaultVoice, onVoiceChange, speed: speedProp, defaultSpeed = 1, onSpeedChange, synthesize, simulated: simulatedProp, autoPlay: autoPlayProp, actions, variant = "card", className } = props;
  const demo = textProp === undefined;
  const text = textProp ?? speechSampleText;
  const voices = voicesProp?.length ? voicesProp : speechSampleVoices;
  const author = authorProp === undefined ? (demo ? SAMPLE_AUTHOR : null) : authorProp;
  const simulated = simulatedProp ?? !synthesize;
  const autoPlay = autoPlayProp ?? demo;
  const reduced = useReducedMotion() ?? false;
  const id = useId();

  const [voiceState, setVoiceState] = useState(defaultVoice ?? voices[0]?.id ?? FALLBACK_VOICE.id);
  const voiceId = voiceProp ?? voiceState;
  const voice = voices.find(item => item.id === voiceId) ?? voices[0] ?? FALLBACK_VOICE;
  const [speedState, setSpeedState] = useState<SpeechSpeed>(defaultSpeed);
  const speed = speedProp ?? speedState;
  const { paragraphs, words } = useMemo(() => tokenizeSpeech(text), [text]);

  const [open, setOpen] = useState(false);
  const [status, setStatusState] = useState<SpeechStatus>("idle");
  const [wordIndex, setWordIndex] = useState(-1);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState("");
  const [loadingLabel, setLoadingLabel] = useState("");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [voiceWidth, setVoiceWidth] = useState<number>();

  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const scrubRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  const readRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const voiceProbeRef = useRef<HTMLSpanElement>(null);
  const wordEls = useRef<(HTMLSpanElement | null)[]>([]);
  const st = useRef<EngineState>({
    status: "idle", open: false, time: 0, duration: 0, timings: [], audio: null, raf: 0, last: 0, word: -1, second: -1, speed: defaultSpeed,
    loadedVoice: null, requestedVoice: null, resumeAfterLoad: false, controller: null, dragging: false, reduced: false, highlightTop: null, focus: null,
    interacted: false, autoPaused: false, timers: [], onAutoEnd: null,
  });
  const latest = useRef<Latest>({ text, words, voice, voices, synthesize, simulated, props });
  useLayoutEffect(() => {
    latest.current = { text, words, voice, voices, synthesize, simulated, props };
    st.current.reduced = reduced;
  });

  const announce = useCallback((message: string) => setNotice(message), []);

  /* Everything that runs on the clock lives here, outside React's render cycle: one rAF loop writes the progress bar
     straight to the DOM and only commits state when the word or the whole second changes. */
  const engine = useMemo(() => {
    const setStatus = (next: SpeechStatus) => { st.current.status = next; setStatusState(next); };
    const event = (): SpeechPlaybackEvent => {
      const s = st.current;
      return { time: Math.round(s.time), duration: s.duration, wordIndex: s.word, voice: latest.current.voice, speed: s.speed };
    };
    const setWord = (index: number) => {
      const s = st.current;
      if (index === s.word) return;
      s.word = index;
      setWordIndex(index);
      const word = latest.current.words[index];
      if (word) latest.current.props.onWordChange?.({ ...event(), word: word.text });
    };
    const paintBar = (t: number) => {
      const s = st.current;
      const p = s.duration ? clamp(t / s.duration, 0, 1) : 0;
      if (fillRef.current) fillRef.current.style.transform = `scaleX(${p})`;
      if (thumbRef.current) thumbRef.current.style.transform = `translateX(${p * 100}%)`;
    };
    const paint = (t: number) => {
      const s = st.current;
      paintBar(t);
      const second = Math.floor(t / 1000);
      if (second !== s.second) { s.second = second; setElapsed(second); }
      setWord(findWord(s.timings, t));
    };
    const stopClock = () => { cancelAnimationFrame(st.current.raf); st.current.raf = 0; };

    const finish = () => {
      const s = st.current;
      stopClock();
      s.audio?.pause();
      s.time = s.duration;
      paint(s.duration);
      setWord(-1);
      setStatus("ended");
      latest.current.props.onEnd?.(event());
      announce("Finished reading.");
      if (!s.interacted) s.onAutoEnd?.();
    };
    const tick = (now: number) => {
      const s = st.current;
      if (s.status !== "playing") return;
      if (!s.dragging) {
        const t = s.audio ? s.audio.currentTime * 1000 : s.time + (now - s.last) * s.speed;
        if (t >= s.duration) { finish(); return; }
        s.time = t;
        paint(t);
      }
      s.last = now;
      s.raf = requestAnimationFrame(tick);
    };
    const fail = (message: string) => {
      stopClock();
      st.current.audio?.pause();
      setStatus("error");
      setError(message);
      announce(`Couldn't generate audio. ${message}`);
    };
    const play = () => {
      const s = st.current;
      if (!s.timings.length) return;
      if (s.time >= s.duration) { s.time = 0; paint(0); }
      setStatus("playing");
      s.last = performance.now();
      if (s.audio) {
        s.audio.playbackRate = s.speed;
        if (Math.abs(s.audio.currentTime * 1000 - s.time) > 40) s.audio.currentTime = s.time / 1000;
        s.audio.play().catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "NotAllowedError") { stopClock(); setStatus("paused"); announce("Press play to start the audio."); return; }
          if (!isAbort(err)) fail("The audio could not be played.");
        });
      }
      stopClock();
      s.raf = requestAnimationFrame(tick);
      latest.current.props.onPlay?.(event());
      announce(`Reading aloud with ${latest.current.voice.name} at ${speedLabel(s.speed)}.${latest.current.simulated ? " Simulated, no audio plays." : ""}`);
    };
    const pause = () => {
      const s = st.current;
      if (s.status !== "playing") return;
      stopClock();
      s.audio?.pause();
      setStatus("paused");
      latest.current.props.onPause?.(event());
      announce(`Paused at ${formatSpeechTime(s.time)}.`);
    };
    const seek = (to: number, commit: boolean) => {
      const s = st.current;
      if (!s.duration) return;
      const t = clamp(to, 0, s.duration);
      s.time = t;
      s.last = performance.now();
      if (s.audio) s.audio.currentTime = t / 1000;
      if (s.status === "ended" && t < s.duration) setStatus("paused");
      paint(t);
      if (commit) latest.current.props.onSeek?.(event());
    };

    const onAudioEnded = () => { if (st.current.status === "playing") finish(); };
    const onAudioError = () => fail("The audio could not be loaded.");
    const disposeAudio = () => {
      const audio = st.current.audio;
      if (!audio) return;
      audio.pause();
      audio.removeEventListener("ended", onAudioEnded);
      audio.removeEventListener("error", onAudioError);
      audio.removeAttribute("src");
      audio.load();
      st.current.audio = null;
    };

    /** Fetches speech for a voice, then resumes from the given word (or the start). Aborts any request in flight. */
    const load = async (resume: boolean, anchor: number, voiceOverride?: SpeechVoice) => {
      const s = st.current;
      const L = latest.current;
      const voice = voiceOverride ?? L.voice;
      s.controller?.abort();
      const controller = new AbortController();
      s.controller = controller;
      stopClock();
      s.audio?.pause();
      const switching = s.loadedVoice !== null && s.loadedVoice !== voice.id && s.open && s.word >= 0;
      s.requestedVoice = voice.id;
      s.resumeAfterLoad = resume;
      setError("");
      setLoadingLabel(switching ? `Switching to ${voice.name}` : `Preparing ${voice.name}'s voice`);
      setStatus("loading");
      announce(switching ? `Switching to ${voice.name}.` : `Preparing ${voice.name}'s voice.`);
      const request = L.synthesize ?? ((req: SpeechSynthesizeRequest) => simulateSpeech(req, { delay: switching ? 460 : 640 }));
      try {
        const result = await request({ text: L.text, voice, signal: controller.signal });
        if (controller.signal.aborted) return;
        let timings = result.timings;
        let total = result.duration;
        let audio: HTMLAudioElement | null = null;
        if (result.src) {
          const element = new Audio();
          element.preload = "auto";
          element.src = result.src;
          audio = element;
          if (!timings || total === undefined) {
            await new Promise<void>((resolve, reject) => {
              if (element.readyState >= 1) { resolve(); return; }
              element.addEventListener("loadedmetadata", () => resolve(), { once: true });
              element.addEventListener("error", () => reject(new Error("The audio could not be loaded.")), { once: true });
            });
            if (controller.signal.aborted) return;
            if (total === undefined && Number.isFinite(element.duration)) total = element.duration * 1000;
          }
        }
        if (!timings) {
          const estimate = estimateSpeechTimings(L.text);
          timings = total ? fitTimings(estimate.timings, total) : estimate.timings;
          total ??= estimate.duration;
        }
        total ??= (timings.at(-1)?.end ?? 0) + 240;
        disposeAudio();
        if (audio) {
          audio.playbackRate = s.speed;
          audio.addEventListener("ended", onAudioEnded);
          audio.addEventListener("error", onAudioError);
        }
        s.audio = audio;
        s.timings = timings;
        s.duration = total;
        s.loadedVoice = voice.id;
        s.controller = null;
        s.second = -1;
        setDuration(total);
        s.time = anchor >= 0 && timings[anchor] ? timings[anchor].start : 0;
        paint(s.time);
        if (resume) play(); else setStatus("paused");
      } catch (err) {
        if (controller.signal.aborted || isAbort(err)) return;
        s.controller = null;
        fail(err instanceof Error && err.message ? err.message : "Something went wrong.");
      }
    };

    /** Read aloud: opens the player and starts from the top, reusing audio already fetched for this voice. */
    const start = (user: boolean, voiceOverride?: SpeechVoice) => {
      const s = st.current;
      s.open = true;
      setOpen(true);
      if (user) s.focus = "play";
      const voice = voiceOverride ?? latest.current.voice;
      if (s.loadedVoice === voice.id && s.timings.length) { s.time = 0; s.second = -1; paint(0); play(); }
      else void load(true, -1, voiceOverride);
    };
    const toggle = () => {
      const s = st.current;
      if (s.status === "playing") pause();
      else if (s.status === "loading") return;
      else if (s.status === "error" || s.loadedVoice !== latest.current.voice.id) void load(true, s.word);
      else play();
    };
    const close = (user: boolean) => {
      const s = st.current;
      s.controller?.abort();
      s.controller = null;
      stopClock();
      s.audio?.pause();
      s.requestedVoice = s.loadedVoice;
      s.time = 0;
      s.second = -1;
      setWord(-1);
      setElapsed(0);
      setError("");
      paintBar(0);
      setStatus("idle");
      s.open = false;
      setOpen(false);
      if (user && rootRef.current?.contains(document.activeElement)) s.focus = "read";
      latest.current.props.onClose?.();
      announce("Stopped reading.");
    };
    /** Drops fetched audio, for a new text. */
    const reset = () => {
      const s = st.current;
      if (s.open) close(false);
      disposeAudio();
      s.timings = [];
      s.duration = 0;
      s.loadedVoice = null;
      s.requestedVoice = null;
      setDuration(0);
    };
    const dispose = () => {
      st.current.controller?.abort();
      stopClock();
      disposeAudio();
    };
    return { play, pause, seek, load, start, toggle, close, reset, dispose };
  }, [announce]);

  /* Speed applies on the next frame: the clock and the audio element both read it live. */
  useEffect(() => {
    const s = st.current;
    s.speed = speed;
    s.last = performance.now();
    if (s.audio) s.audio.playbackRate = speed;
  }, [speed]);

  /* A new voice while the player is open fetches its audio and resumes from the word being spoken. */
  useEffect(() => {
    const s = st.current;
    if (!s.open || s.status === "idle" || s.requestedVoice === voiceId) return;
    const resume = s.status === "playing" || (s.status === "loading" && s.resumeAfterLoad);
    void engine.load(resume, s.word);
  }, [voiceId, engine]);

  /* New text drops the old audio. */
  useEffect(() => { engine.reset(); }, [text, engine]);
  useEffect(() => () => engine.dispose(), [engine]);

  /* Focus follows the swap between the action row and the player, only when the person caused it. */
  useEffect(() => {
    const s = st.current;
    if (s.focus === "play" && open) playRef.current?.focus();
    if (s.focus === "read" && !open) readRef.current?.focus();
    s.focus = null;
  }, [open]);

  /* The highlight: one rounded rect behind the text. It glides between words on a line and cuts to the next line,
     so it never sweeps diagonally across the paragraph. Positions come from offsets, which ignore transforms. */
  const placeHighlight = useCallback((snap: boolean) => {
    const s = st.current;
    const el = highlightRef.current;
    if (!el) return;
    const word = s.word >= 0 ? wordEls.current[s.word] : null;
    const show = s.open && !!word && (s.status === "playing" || s.status === "paused" || s.status === "loading");
    if (!show || !word) { el.dataset.visible = "false"; s.highlightTop = null; return; }
    const x = word.offsetLeft - 3, y = word.offsetTop - 1, w = word.offsetWidth + 6, h = word.offsetHeight + 2;
    const cut = snap || s.reduced || el.dataset.visible !== "true" || s.highlightTop === null || Math.abs(y - s.highlightTop) > 2;
    if (cut) el.dataset.snap = "true";
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.dataset.visible = "true";
    s.highlightTop = y;
    if (cut) { void el.offsetWidth; delete el.dataset.snap; }
  }, []);
  useLayoutEffect(() => { placeHighlight(false); }, [wordIndex, open, status, placeHighlight]);
  useEffect(() => {
    const node = textRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let width = node.offsetWidth;
    const observer = new ResizeObserver(() => {
      if (node.offsetWidth === width) return;
      width = node.offsetWidth;
      placeHighlight(true);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [placeHighlight]);

  /* The voice label hugs the current name: a hidden probe measures it and the width eases there (no bounce), so a short
     name never leaves a gap before the chevron. The observer catches web fonts arriving late. */
  const measureVoice = useCallback(() => {
    const probe = voiceProbeRef.current;
    if (probe) setVoiceWidth(Math.ceil(probe.getBoundingClientRect().width));
  }, []);
  useLayoutEffect(measureVoice, [voice.name, measureVoice]);
  useEffect(() => {
    const probe = voiceProbeRef.current;
    if (!probe || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measureVoice);
    observer.observe(probe);
    return () => observer.disconnect();
  }, [measureVoice]);

  /* Sample autoplay: starts once in view, pauses off screen, and loops through two voices until someone interacts.
     With reduced motion it reads once and stops. */
  useEffect(() => {
    const root = rootRef.current;
    if (!autoPlay || !root || typeof IntersectionObserver === "undefined") return;
    const s = st.current;
    let visible = false;
    let pending: (() => void) | null = null;
    let loop = 0;
    const later = (fn: () => void, ms: number) => {
      s.timers.push(window.setTimeout(() => {
        if (s.interacted) return;
        if (visible) fn(); else pending = fn;
      }, ms));
    };
    const begin = (step: number) => {
      const L = latest.current;
      const scene = demo && L.props.voice === undefined && L.props.speed === undefined ? DEMO_LOOP[step % DEMO_LOOP.length] : null;
      const voice = scene ? L.voices.find(item => item.id === scene.voice) : undefined;
      if (scene && voice) {
        s.speed = scene.speed;
        setSpeedState(scene.speed);
        setVoiceState(voice.id);
      }
      engine.start(false, voice);
    };
    s.onAutoEnd = demo && !s.reduced ? () => {
      later(() => engine.close(false), 1800);
      later(() => { loop += 1; begin(loop); }, 3000);
    } : null;
    const observer = new IntersectionObserver(([entry]) => {
      visible = !!entry?.isIntersecting;
      if (visible) {
        if (s.autoPaused && !s.interacted) { s.autoPaused = false; engine.play(); }
        if (pending && !s.interacted) { const fn = pending; pending = null; fn(); }
      } else if (s.status === "playing" && !s.interacted) {
        s.autoPaused = true;
        engine.pause();
      }
    }, { threshold: .4 });
    observer.observe(root);
    later(() => begin(0), 900);
    return () => {
      observer.disconnect();
      s.timers.forEach(timer => window.clearTimeout(timer));
      s.timers = [];
      s.onAutoEnd = null;
    };
  }, [autoPlay, demo, engine]);

  const stopAuto = () => {
    const s = st.current;
    if (s.interacted) return;
    s.interacted = true;
    s.autoPaused = false;
    s.timers.forEach(timer => window.clearTimeout(timer));
    s.timers = [];
  };

  /* Scrubbing: pointer capture keeps the drag on the bar; the clock holds still while the thumb is down. */
  const timeAt = (clientX: number) => {
    const bar = scrubRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return clamp((clientX - rect.left) / rect.width, 0, 1) * st.current.duration;
  };
  const onScrubDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    st.current.dragging = true;
    event.currentTarget.dataset.dragging = "true";
    engine.seek(timeAt(event.clientX), false);
  };
  const onScrubMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!st.current.dragging) return;
    engine.seek(timeAt(event.clientX), false);
  };
  const onScrubUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!st.current.dragging) return;
    st.current.dragging = false;
    delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    engine.seek(timeAt(event.clientX), true);
  };
  const onScrubKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const s = st.current;
    const step = { ArrowRight: 2000, ArrowUp: 2000, ArrowLeft: -2000, ArrowDown: -2000, PageUp: 10000, PageDown: -10000 }[event.key];
    if (step !== undefined) { event.preventDefault(); engine.seek(s.time + step, true); return; }
    if (event.key === "Home") { event.preventDefault(); engine.seek(0, true); return; }
    if (event.key === "End") { event.preventDefault(); engine.seek(s.duration, true); return; }
    if (event.key === " " || event.key === "k") { event.preventDefault(); engine.toggle(); }
  };

  /* A click on a word jumps there; from the end it plays on from that word. A text selection is left alone. */
  const onTextClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s.open || !(s.status === "playing" || s.status === "paused" || s.status === "ended")) return;
    if (window.getSelection()?.toString()) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-word]");
    const index = target ? Number(target.dataset.word) : NaN;
    const timing = s.timings[index];
    if (!timing) return;
    const wasEnded = s.status === "ended";
    engine.seek(timing.start, true);
    if (wasEnded) engine.play();
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    st.current.speed = next;
    if (speedProp === undefined) setSpeedState(next);
    onSpeedChange?.(next);
    announce(`Speed ${speedLabel(next)}.`);
  };
  const chooseVoice = (next: SpeechVoice) => {
    setMenuOpen(false);
    if (next.id === voice.id) return;
    if (voiceProp === undefined) setVoiceState(next.id);
    onVoiceChange?.(next);
    if (!st.current.open) announce(`Voice set to ${next.name}.`);
  };
  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("[role=menuitemradio]") ?? []);
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const move = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (move !== undefined) { event.preventDefault(); items[(current + move + items.length) % items.length]?.focus(); }
    else if (event.key === "Home") { event.preventDefault(); items[0]?.focus(); }
    else if (event.key === "End") { event.preventDefault(); items.at(-1)?.focus(); }
  };

  const mode = playMode(status);
  const slot = status === "loading" ? "loading" : status === "error" ? "error" : "timeline";
  const reading = open && (status === "playing" || status === "paused" || status === "loading" || (status === "error" && wordIndex >= 0));
  const seekable = open && (status === "playing" || status === "paused" || status === "ended");
  const durationLabel = formatSpeechTime(duration);
  const elapsedLabel = formatSpeechTime(Math.min(elapsed * 1000, duration));
  const style = { "--sp-move": `${Math.round(150 / speed)}ms` } as CSSProperties;

  return <div ref={rootRef} className={cx(styles.root, variant === "plain" && styles.plain, className)} style={style}
    data-reading={reading || undefined} data-seekable={seekable || undefined} data-status={status}
    onPointerDownCapture={stopAuto} onKeyDownCapture={stopAuto}>
    {author ? <div className={styles.author}>
      {author.mark ? <span className={styles.mark} aria-hidden="true">{author.mark}</span> : null}
      <span className={styles.authorName}>{author.name}</span>
    </div> : null}

    <div ref={textRef} id={`${id}-text`} className={styles.text} onClick={onTextClick}>
      <span ref={highlightRef} className={styles.highlight} data-visible="false" aria-hidden="true" />
      {paragraphs.length ? paragraphs.map((list, p) => <p key={p} className={styles.paragraph}>
        {list.map((word, i) => <Fragment key={word.index}>
          {i ? " " : null}
          <span ref={el => { wordEls.current[word.index] = el; }} className={styles.word} data-word={word.index}
            data-state={!reading ? undefined : word.index < wordIndex ? "spoken" : word.index === wordIndex ? "current" : "upcoming"}>{word.text}</span>
        </Fragment>)}
      </p>) : <p className={cx(styles.paragraph, styles.empty)}>Nothing to read yet.</p>}
    </div>

    <div className={styles.dock}>
      <motion.div className={styles.actions} inert={open} aria-hidden={open || undefined} initial={false} {...layer(!open, reduced)}>
        <button ref={readRef} type="button" className={styles.readAloud} onClick={() => engine.start(true)} disabled={!words.length} aria-describedby={`${id}-text`}>
          <Volume2 size={16} strokeWidth={1.75} aria-hidden="true" />
          <span>Read aloud</span>
        </button>
        {actions === undefined ? <DefaultActions text={text} announce={announce} /> : actions}
      </motion.div>

      <motion.div className={styles.player} role="group" aria-label="Read aloud player" inert={!open} aria-hidden={!open || undefined} initial={false} {...layer(open, reduced)}>
        <button ref={playRef} type="button" className={styles.play} data-mode={mode} aria-label={playLabel[mode]} aria-disabled={mode === "loading" || undefined} onClick={engine.toggle}>
          <PlayIcon mode={mode} reduced={reduced} />
        </button>

        <div className={styles.middle}>
          <motion.div className={styles.slot} inert={slot !== "timeline"} aria-hidden={slot !== "timeline" || undefined} initial={false} {...layer(slot === "timeline", reduced)}>
            <span className={cx(styles.time, styles.elapsed)} aria-hidden="true">{elapsedLabel}</span>
            <div ref={scrubRef} className={styles.scrub} role="slider" tabIndex={0} aria-label="Seek"
              aria-valuemin={0} aria-valuemax={Math.floor(duration / 1000)} aria-valuenow={Math.min(elapsed, Math.floor(duration / 1000))} aria-valuetext={`${elapsedLabel} of ${durationLabel}`}
              onPointerDown={onScrubDown} onPointerMove={onScrubMove} onPointerUp={onScrubUp} onPointerCancel={onScrubUp} onKeyDown={onScrubKey}>
              <span className={styles.track}><span ref={fillRef} className={styles.fill} /></span>
              <span ref={thumbRef} className={styles.thumbRail}><span className={styles.thumb} /></span>
            </div>
            <span className={cx(styles.time, styles.total)} aria-hidden="true">{durationLabel}</span>
          </motion.div>
          <motion.div className={cx(styles.slot, styles.message)} aria-hidden="true" initial={false} {...layer(slot === "loading", reduced)}>
            <TextShimmer active={slot === "loading" && !reduced} className={cx(styles.messageText, styles.shimmer)}>{loadingLabel || `Preparing ${voice.name}'s voice`}</TextShimmer>
          </motion.div>
          <motion.div className={cx(styles.slot, styles.message, styles.error)} aria-hidden="true" initial={false} {...layer(slot === "error", reduced)}>
            <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
            <span className={styles.messageText}><span className={styles.errorLong}>Couldn&apos;t generate audio</span><span className={styles.errorShort}>Audio failed</span></span>
            {error ? <span className={styles.errorDetail} title={error}>{error}</span> : null}
          </motion.div>
        </div>

        <Tooltip content="Playback speed">
          <button type="button" className={styles.speed} onClick={cycleSpeed} aria-label={`Playback speed ${speedLabel(speed)}`}>
            {SPEEDS.map(item => <span key={item} className={styles.measure} aria-hidden="true">{speedLabel(item)}</span>)}
            <AnimatePresence initial={false}>
              <motion.span key={speed} className={styles.swap} aria-hidden="true"
                initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: reduced ? 0 : -2, transition: fadeOut(reduced) }} transition={fadeIn(reduced)}>{speedLabel(speed)}</motion.span>
            </AnimatePresence>
          </button>
        </Tooltip>

        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger className={styles.voice} aria-label={`Voice: ${voice.name}`}>
            <span className={styles.voiceName} style={voiceWidth ? { width: voiceWidth } : undefined}>
              <span ref={voiceProbeRef} className={styles.voiceProbe} aria-hidden="true">{voice.name}</span>
              <AnimatePresence initial={false}>
                <motion.span key={voice.id} className={styles.swap} aria-hidden="true"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduced ? 0 : -2, transition: fadeOut(reduced) }} transition={fadeIn(reduced)}>{voice.name}</motion.span>
              </AnimatePresence>
            </span>
            <ChevronDown className={styles.chevron} size={14} strokeWidth={2} aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={8} className={styles.menu}
            onOpenAutoFocus={event => { event.preventDefault(); menuRef.current?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus(); }}>
            <div ref={menuRef} role="menu" aria-label="Voice" onKeyDown={onMenuKey}>
              {voices.map(item => <button key={item.id} type="button" role="menuitemradio" aria-checked={item.id === voice.id} className={styles.menuItem} onClick={() => chooseVoice(item)}>
                <span className={styles.menuText}>
                  <span className={styles.menuName}>{item.name}</span>
                  {item.description ? <span className={styles.menuDescription}>{item.description}</span> : null}
                </span>
                <Check className={styles.menuCheck} size={16} strokeWidth={1.75} aria-hidden="true" />
              </button>)}
            </div>
            {simulated ? <p className={styles.menuNote}>Simulated voices, no audio plays.</p> : null}
          </PopoverContent>
        </Popover>

        <Tooltip content="Stop reading">
          <button type="button" className={styles.iconButton} aria-label="Stop reading" onClick={() => engine.close(true)}>
            <X size={16} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </Tooltip>
      </motion.div>
    </div>

    <span className={styles.srOnly} role="status" aria-live="polite">{notice}</span>
  </div>;
}

export default SpeechPlayer;
