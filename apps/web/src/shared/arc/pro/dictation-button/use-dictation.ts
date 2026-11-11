"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { DictationError, createSimulatedRecognizer } from "./dictation-button-recognizer";
import type { DictationErrorCode, DictationRecognizer, DictationSession, DictationTranscript } from "./dictation-button-recognizer";

export type DictationStatus = "idle" | "starting" | "listening" | "processing" | "denied" | "error";

export interface UseDictationOptions {
  /** Where speech comes from. Defaults to a simulated recognizer that never touches the microphone. */
  recognizer?: DictationRecognizer;
  /** Seconds before listening stops and inserts on its own. Defaults to 120; 0 turns the limit off. */
  maxDuration?: number;
  /** Live, cumulative transcript for the current session. */
  onTranscript?: (transcript: DictationTranscript) => void;
  /** The final text after the person confirms. Not called for empty results (status becomes error, "no-speech"). */
  onCommit?: (text: string) => void;
  onCancel?: () => void;
  onSpeechEnd?: () => void;
  onStatusChange?: (status: DictationStatus, error?: DictationErrorCode) => void;
}

export interface Dictation {
  status: DictationStatus;
  transcript: DictationTranscript;
  error: DictationErrorCode | null;
  /** performance.now() when the current session started. */
  startedAt: number | null;
  /** Latest input level from 0 to 1. A ref, so a waveform can read it every frame without re-rendering. */
  levelRef: RefObject<number>;
  start: () => void;
  /** Stop listening and insert. While the microphone is still opening, this cancels instead. */
  confirm: () => void;
  /** Stop listening and discard. */
  cancel: () => void;
  /** Clear a denied or error state back to idle. */
  dismiss: () => void;
}

const EMPTY: DictationTranscript = { final: "", interim: "" };
const BUSY: DictationStatus[] = ["starting", "listening", "processing"];
const codeOf = (error: unknown): DictationErrorCode => error instanceof DictationError ? error.code : (error as { name?: string })?.name === "NotAllowedError" ? "not-allowed" : "network";

type Run = { controller: AbortController; session?: DictationSession };

/** The dictation state machine: idle, starting, listening, processing, then idle again, or denied and error on failure. */
export function useDictation(options: UseDictationOptions = {}): Dictation {
  const { recognizer, maxDuration = 120 } = options;
  const latest = useRef(options);
  const [fallback] = useState(() => createSimulatedRecognizer());
  const recognizerRef = useRef<DictationRecognizer>(recognizer ?? fallback);
  useEffect(() => { latest.current = options; recognizerRef.current = recognizer ?? fallback; });

  const [status, setStatusState] = useState<DictationStatus>("idle");
  const statusRef = useRef<DictationStatus>("idle");
  const [transcript, setTranscript] = useState<DictationTranscript>(EMPTY);
  const [error, setError] = useState<DictationErrorCode | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const levelRef = useRef(0);
  const run = useRef<Run | null>(null);

  const setStatus = useCallback((next: DictationStatus, code?: DictationErrorCode) => {
    statusRef.current = next;
    setStatusState(next);
    latest.current.onStatusChange?.(next, code);
  }, []);

  const fail = useCallback((code: DictationErrorCode) => {
    run.current?.controller.abort();
    run.current = null;
    levelRef.current = 0;
    if (code === "aborted") { setTranscript(EMPTY); setStatus("idle"); return; }
    setError(code);
    setStatus(code === "not-allowed" ? "denied" : "error", code);
  }, [setStatus]);

  const cancel = useCallback(() => {
    const current = run.current;
    if (!current) return;
    current.controller.abort();
    run.current = null;
    levelRef.current = 0;
    setTranscript(EMPTY);
    setStatus("idle");
    latest.current.onCancel?.();
  }, [setStatus]);

  const confirm = useCallback(async () => {
    const current = run.current;
    if (!current) return;
    if (statusRef.current === "starting" || !current.session) { cancel(); return; }
    if (statusRef.current !== "listening") return;
    setStatus("processing");
    levelRef.current = 0;
    try {
      const text = (await current.session.stop()).trim();
      if (run.current !== current) return;
      if (!text) { fail("no-speech"); return; }
      run.current = null;
      setTranscript({ final: text, interim: "" });
      setStatus("idle");
      latest.current.onCommit?.(text);
    } catch (reason) {
      if (run.current === current) fail(codeOf(reason));
    }
  }, [cancel, fail, setStatus]);

  const start = useCallback(async () => {
    if (BUSY.includes(statusRef.current)) return;
    const controller = new AbortController();
    const current: Run = { controller };
    run.current = current;
    const live = () => run.current === current && !controller.signal.aborted;
    levelRef.current = 0;
    setTranscript(EMPTY);
    setError(null);
    setStartedAt(performance.now());
    setStatus("starting");
    try {
      const session = await recognizerRef.current({
        onTranscript: next => { if (!live() || statusRef.current === "processing" && next.interim) return; setTranscript(next); latest.current.onTranscript?.(next); },
        onLevel: level => { if (live()) levelRef.current = Math.max(0, Math.min(1, level)); },
        onSpeechEnd: () => { if (live()) latest.current.onSpeechEnd?.(); },
        onError: code => { if (live()) fail(code); },
      }, controller.signal);
      if (!live()) return;
      current.session = session;
      if (statusRef.current === "starting") setStatus("listening");
    } catch (reason) {
      if (live()) fail(codeOf(reason));
    }
  }, [fail, setStatus]);

  const dismiss = useCallback(() => {
    if (statusRef.current !== "denied" && statusRef.current !== "error") return;
    setError(null);
    setStatus("idle");
  }, [setStatus]);

  useEffect(() => {
    if (status !== "listening" || startedAt === null || !maxDuration) return;
    const id = setTimeout(() => void confirm(), Math.max(0, startedAt + maxDuration * 1000 - performance.now()));
    return () => clearTimeout(id);
  }, [status, startedAt, maxDuration, confirm]);

  useEffect(() => () => { run.current?.controller.abort(); run.current = null; }, []);

  return {
    status, transcript, error, startedAt, levelRef,
    start: () => void start(),
    confirm: () => void confirm(),
    cancel, dismiss,
  };
}
