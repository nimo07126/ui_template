"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { generationSampleRuns } from "./generation-stats-data";
import type { GenerationModel, GenerationPricing, GenerationSampleRun, GenerationStatus, GenerationUsage } from "./generation-stats-data";

/** One moment of a simulated request, shaped exactly like the props a real integration passes. */
export interface GenerationFrame {
  /** Changes with every new request. */
  runKey: number;
  model: GenerationModel;
  pricing: GenerationPricing;
  status: GenerationStatus;
  /** Epoch ms when the request was sent. */
  startedAt?: number;
  usage: GenerationUsage;
  error?: string;
  /** Speed readings for the settled run shown before the first simulated request. */
  speedSamples?: number[];
}

export interface GenerationSimulationOptions {
  runs?: GenerationSampleRun[];
  /** Ticks only while true, for example while the card is on screen. */
  active?: boolean;
  /** Keeps a settled run on screen instead of moving to the next one, for example while someone reads the breakdown. */
  hold?: boolean;
  /** Plays the runs in a loop. Defaults to true. */
  loop?: boolean;
}

type Phase = "waiting" | "streaming" | "done" | "error";

const TICK = 40;
const CUE_OPEN = 1000, CUE_CLOSE = 3900, NEXT_RUN = 4400, FIRST_RUN = 1200, AUTO_RETRY = 2400;

const settledUsage = (run: GenerationSampleRun): GenerationUsage => ({
  inputTokens: run.inputTokens, cachedTokens: run.cachedTokens, outputTokens: run.outputTokens, reasoningTokens: run.reasoningTokens,
  ttftMs: run.ttftMs, durationMs: Math.round(run.ttftMs + run.outputTokens / (run.tokensPerSecond * .9) * 1000),
});

/** The same ramp and waver the stream uses, read every 160ms, so the first paint already has a believable sparkline. */
function sampleCurve(run: GenerationSampleRun, seed: number) {
  const seconds = run.outputTokens / (run.tokensPerSecond * .9);
  const points: number[] = [];
  let ema: number | undefined;
  for (let t = .16; t <= seconds; t += .16) {
    const rate = run.tokensPerSecond * (.58 + .42 * Math.min(1, t / .4)) * (1 + .07 * Math.sin(6.3 * t + seed) + .045 * Math.sin(15.7 * t + 2 * seed));
    ema = ema === undefined ? rate : ema + .45 * (rate - ema);
    points.push(Math.round(ema * 10) / 10);
  }
  return points;
}

/**
 * Streams the sample runs in virtual time: a wait for the first token, then output that ramps up and arrives in chunks of
 * a few tokens. It starts on a settled run so the first paint is complete, then moves on. Pauses whenever `active` is false.
 */
export function useGenerationSimulation({ runs = generationSampleRuns, active = true, hold = false, loop = true }: GenerationSimulationOptions = {}) {
  const first = runs[0];
  const [frame, setFrame] = useState<GenerationFrame>(() => ({ runKey: 0, model: first.model, pricing: first.pricing, status: "done", usage: settledUsage(first), speedSamples: sampleCurve(first, 1.3) }));
  const [cueOpen, setCueOpen] = useState(false);
  const state = useRef({ index: 0, retrying: false, key: 0, vt: 0, runStart: 0, phase: "done" as Phase, settledAt: 0, initial: true, acc: 0, delivered: 0, seed: 1.3 });
  const holdRef = useRef(hold);
  const loopRef = useRef(loop);
  useEffect(() => { holdRef.current = hold; loopRef.current = loop; }, [hold, loop]);

  const start = useCallback((index: number, retrying: boolean) => {
    const s = state.current;
    const run = runs[index % runs.length];
    Object.assign(s, { index: index % runs.length, retrying, key: s.key + 1, runStart: s.vt, phase: "waiting", initial: false, acc: 0, delivered: 0, seed: (s.seed * 7.13) % 6.28 });
    setCueOpen(false);
    setFrame({ runKey: s.key, model: run.model, pricing: run.pricing, status: "waiting", startedAt: Date.now(), usage: { inputTokens: run.inputTokens, cachedTokens: run.cachedTokens, outputTokens: 0 } });
  }, [runs]);

  const retry = useCallback(() => start(state.current.index, true), [start]);
  const next = useCallback(() => start(state.current.index + 1, false), [start]);

  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = Math.min(now - last, 100);
      last = now;
      const s = state.current;
      s.vt += dt;
      const run = runs[s.index];
      const elapsed = s.vt - s.runStart;
      const startedAt = Date.now() - elapsed;

      if (s.phase === "done" || s.phase === "error") {
        if (holdRef.current) { s.settledAt += dt; return; }
        const since = s.vt - s.settledAt;
        if (s.phase === "error") { if (since >= AUTO_RETRY) start(s.index, true); return; }
        if (s.initial) { if (since >= FIRST_RUN && loopRef.current) start(s.index + 1, false); return; }
        if (since >= CUE_OPEN && since < CUE_CLOSE) setCueOpen(true);
        if (since >= CUE_CLOSE) setCueOpen(false);
        if (since >= NEXT_RUN && loopRef.current) start(s.index + 1, false);
        return;
      }

      if (elapsed < run.ttftMs) {
        setFrame(prev => Math.abs((prev.startedAt ?? 0) - startedAt) > 30 ? { ...prev, startedAt } : prev);
        return;
      }

      // Output ramps to its peak over 400ms, then wavers by a few percent. Tokens leave in chunks of four or more.
      const t = (elapsed - run.ttftMs) / 1000;
      const ramp = .58 + .42 * Math.min(1, t / .4);
      const waver = 1 + .07 * Math.sin(6.3 * t + s.seed) + .045 * Math.sin(15.7 * t + 2 * s.seed);
      s.acc += run.tokensPerSecond * ramp * waver * (dt / 1000);
      const failAt = s.retrying ? undefined : run.failAtTokens;
      const target = failAt ?? run.outputTokens;
      const finished = s.acc >= target;
      const whole = Math.min(target, Math.max(1, Math.floor(s.acc)));
      if (!finished && whole - s.delivered < 4 && s.phase === "streaming") return;
      s.delivered = whole;
      const usage: GenerationUsage = { inputTokens: run.inputTokens, cachedTokens: run.cachedTokens, outputTokens: whole, reasoningTokens: run.reasoningTokens, ttftMs: run.ttftMs };
      if (finished) {
        s.phase = failAt !== undefined ? "error" : "done";
        s.settledAt = s.vt;
        setFrame({ runKey: s.key, model: run.model, pricing: run.pricing, status: s.phase, startedAt, usage: { ...usage, durationMs: Math.round(elapsed) }, error: failAt !== undefined ? run.error : undefined });
        return;
      }
      s.phase = "streaming";
      setFrame({ runKey: s.key, model: run.model, pricing: run.pricing, status: "streaming", startedAt, usage });
    }, TICK);
    return () => window.clearInterval(id);
  }, [active, runs, start]);

  return { frame, cueOpen, retry, next };
}
