"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleDashed, Pause, PenLine, Play, RotateCcw, StepForward, TimerOff, Unlink, Zap } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import {
  SERIES, defaultFirstToken, formatClock, formatCost, formatDuration, formatPercent, formatPrice, formatRatio, formatSeconds, formatSpeedup,
  formatTokens, sampleModel, sampleRequests, sampleSegments, simulateRequest,
  type CacheEntry, type PromptCacheModel, type PromptCacheRequest, type PromptCacheResult, type PromptCacheSegment,
} from "./prompt-cache-data";
import styles from "./prompt-cache.module.css";

export type { PromptCacheKind, PromptCacheModel, PromptCacheRequest, PromptCacheResult, PromptCacheSegment } from "./prompt-cache-data";
export { defaultFirstToken, sampleModel, sampleRequests, sampleSegments } from "./prompt-cache-data";

export interface PromptCacheProps {
  /** The stable prefix in prompt order, such as tools, system prompt, documents and conversation. Two to six segments read best. */
  segments?: PromptCacheSegment[];
  /** One to four requests per round. Each sends the same prefix plus its own new message. */
  requests?: PromptCacheRequest[];
  /** Model name, mark and prices per million tokens. Defaults to Claude Sonnet 5.5 with sample prices. */
  model?: PromptCacheModel;
  /** Seconds the cache lives after its last use. Defaults to 300 (five minutes). */
  ttl?: number;
  /** Id of the segment the change toggle edits. Defaults to "system". Pass null to hide the toggle. */
  changeSegment?: string | null;
  /** Plays on its own while in view. Defaults to true. Reduced motion opens on a finished round instead. */
  autoPlay?: boolean;
  /** After a round the cache idles, expires and the story starts over. Defaults to true. */
  loop?: boolean;
  /** Multiplies the pace. Defaults to 1. */
  speed?: number;
  /** Seconds to the first token for a prompt. Defaults to an illustrative model of prefill and cache load time. */
  firstToken?: (tokens: { processed: number; cached: number }) => number;
  /** Called when a request finishes, with its tokens, cost and timing. */
  onRequest?: (result: PromptCacheResult) => void;
  /** Called when the cache expires. */
  onExpire?: () => void;
  /** Label of the new message at the end of each prompt. Defaults to "New message". */
  messageLabel?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Timing, in milliseconds at speed 1
 * ------------------------------------------------------------------------------------------------------------- */

/** Time to process the whole bar, so the processing sweep moves at one steady speed across every segment. */
const FILL = 1100;
const MIN_SEGMENT = 120;
const FLIGHT = 460;
const SWEEP = 520;
const READ_FILL_AT = 280;
const PARTIAL_FILL_AT = 240;
const MARK_AT = 140;
const READY = 700;
const GAP = 560;
const SETTLE = 900;
const SETTLE_STEP = 460;
const SETTLE_STILL = 1400;
const IDLE = 4200;
const EXPIRED = 1700;
const CLEAR = 280;
const ROLL = 420;

const easeOut = [...motionTokens.ease.standard] as [number, number, number, number];
const clamp = (value: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, value));
const easeInOut = (t: number) => 0.5 - Math.cos(Math.PI * clamp(t)) / 2;
const lower = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/* ---------------------------------------------------------------------------------------------------------------
 * View state
 * ------------------------------------------------------------------------------------------------------------- */

type StageName = "ready" | "gap" | "run" | "settle" | "idle" | "expired" | "clear" | "stopped";
interface StageEvent { at: number; run: () => void }
/** Events stay in time order; `fired` counts the ones already run. */
interface Stage { name: StageName; slot: number; t: number; duration: number; events: StageEvent[]; fired: number; tick?: (t: number, dt: number) => void }

/** Per segment, with the new message last: when its fill starts and how long it takes. */
interface Timing { delay: number; dur: number }
interface RowView { result: PromptCacheResult; state: "run" | "done"; timing: Timing[]; showMark: boolean }
type BoxMode = "empty" | "writing" | "reading" | "warm" | "expired";
interface BoxView { filled: boolean[]; mode: BoxMode; readKey: number }
interface FlightView { key: number; from: number; left: number; top: number; width: number; height: number; dx: number; dy: number; w1: number; h1: number }
interface View { round: number; rows: (RowView | null)[]; box: BoxView; flight: FlightView | null; caption: string; clearing: boolean }

/* ---------------------------------------------------------------------------------------------------------------
 * Small parts
 * ------------------------------------------------------------------------------------------------------------- */

/** One minimal crossfade for a label swap: the old label fades out fast while the new one fades in from 2px below. */
function Swap({ id, children, reduced, className }: { id: string; children: ReactNode; reduced: boolean; className?: string }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.12 : 0.16, ease: easeOut } }}
        exit={{ opacity: 0, transition: { duration: 0.1, ease: easeOut } }}>
        {children}
      </motion.span>
    </AnimatePresence>
  </span>;
}

/** A number that counts from the value before it to its own, with tabular numerals inside a reserved column. */
function Roll({ value, from, format, reduced, className }: { value: number | null; from?: number | null; format: (value: number) => string; reduced: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const [initial] = useState(() => value == null ? "–" : format(value));
  useLayoutEffect(() => {
    const node = ref.current?.firstChild;
    if (!node) return;
    if (value == null) { shown.current = null; node.nodeValue = "–"; return; }
    const start = shown.current ?? from ?? 0;
    if (reduced || start === value) { shown.current = value; node.nodeValue = format(value); return; }
    const began = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - began) / ROLL);
      const next = start + (value - start) * (1 - (1 - t) ** 3);
      shown.current = next;
      node.nodeValue = format(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    node.nodeValue = format(start);
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, from, format, reduced]);
  return <span ref={ref} className={className} data-empty={value == null || undefined}>{initial}</span>;
}

function PlayGlyph({ playing }: { playing: boolean }) {
  return <span className={styles.glyph} aria-hidden="true">
    <Play data-on={!playing} />
    <Pause data-on={playing} />
  </span>;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * Prompt caching as a stack of requests over time. Each request is a bar of the same prefix segments plus its own new
 * message. The first processes everything and writes the prefix into the cache; later ones read the matching prefix from
 * the cache, so only the new message is processed and the cost and time to first token roll down. Editing a segment breaks
 * the match from that segment on, and an idle cache expires when its time to live runs out.
 */
export function PromptCache({
  segments = sampleSegments, requests = sampleRequests, model = sampleModel, ttl = 300, changeSegment = "system",
  autoPlay = true, loop = true, speed = 1, firstToken = defaultFirstToken, onRequest, onExpire,
  messageLabel = "New message", title = "Prompt cache", className, style,
}: PromptCacheProps) {
  const reduced = useReducedFlag();
  const list = useMemo(() => requests.slice(0, 4), [requests]);
  const count = Math.max(1, list.length);
  const n = segments.length;
  const changeIndex = changeSegment == null ? -1 : segments.findIndex(segment => segment.id === changeSegment);
  const changeTarget = changeIndex >= 0 ? segments[changeIndex] : null;
  const prefixTokens = segments.reduce((total, segment) => total + segment.tokens, 0);
  /** A square root scale keeps a short message visible beside a long document, while larger segments stay larger. */
  const weights = useMemo(() => {
    const raw = [...segments.map(segment => Math.sqrt(Math.max(1, segment.tokens))), Math.sqrt(Math.max(1, ...list.map(request => request.tokens)))];
    const total = raw.reduce((a, b) => a + b, 0);
    return raw.map(value => Math.max(value, total * 0.045));
  }, [segments, list]);
  const prefixWeight = weights.slice(0, n).reduce((a, b) => a + b, 0);
  const lefts = useMemo(() => { let at = 0; return weights.slice(0, n).map(w => { const left = at / prefixWeight; at += w; return left; }); }, [weights, n, prefixWeight]);
  const colorOf = (index: number) => segments[index]?.color ?? SERIES[index % SERIES.length];
  const configKey = JSON.stringify([segments.map(s => [s.id, s.tokens]), list.map(r => [r.tokens, r.gap ?? 0]), ttl, model.inputPrice, model.cacheReadPrice, model.cacheWritePrice]);

  /* Copy */
  const ttlText = formatDuration(ttl);
  const writeRatio = formatRatio(model.cacheWritePrice / model.inputPrice);
  const readRatio = formatRatio(model.cacheReadPrice / model.inputPrice);
  const introCaption = `Every request repeats the same ${formatTokens(prefixTokens)} token prefix. Only the new message at the end changes.`;
  const captionFor = useCallback((result: PromptCacheResult, phase: "run" | "done") => {
    const number = result.index + 1;
    const broken = segments[result.breakAt];
    if (result.kind === "hit") return phase === "run"
      ? `Request ${number} matches the cached prefix, so it reads it instead of processing it.`
      : `Cache hit. ${formatTokens(result.cachedTokens)} tokens read at ${readRatio} the price. Only ${formatTokens(result.processedTokens)} new tokens processed.`;
    if (result.kind === "partial") return phase === "run"
      ? `The ${lower(broken.label)} changed, so request ${number} matches the cache only up to it.`
      : `Partial hit. ${formatTokens(result.cachedTokens)} tokens came from the cache; ${formatTokens(result.writtenTokens)} from the ${lower(broken.label)} on were processed again.`;
    if (phase === "run") return result.cold
      ? `Request ${number} processes all ${formatTokens(result.processedTokens)} tokens and writes the prefix to the cache.`
      : `The ${lower(broken.label)} changed, so nothing matches and request ${number} processes everything.`;
    return `Cache write. The prefix stays cached for ${ttlText} and cost ${writeRatio} the input price to store.`;
  }, [segments, readRatio, writeRatio, ttlText]);

  const latest = useRef({ segments, list, model, ttl, firstToken, onRequest, onExpire, loop, speed, reduced, weights, changeIndex, count, captionFor, introCaption, ttlText });
  useLayoutEffect(() => { latest.current = { segments, list, model, ttl, firstToken, onRequest, onExpire, loop, speed, reduced, weights, changeIndex, count, captionFor, introCaption, ttlText }; });

  const [view, setView] = useState<View>(() => ({ round: 0, rows: list.map(() => null), box: { filled: segments.map(() => false), mode: "empty", readKey: 0 }, flight: null, caption: "", clearing: false }));
  const [playing, setPlaying] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [armed, setArmed] = useState(false);
  const [visible, setVisible] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const rootRef = useRef<HTMLElement>(null);
  const arcRef = useRef<SVGCircleElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement | null>(null);
  const setTimeNode = useCallback((node: HTMLSpanElement | null) => {
    if (node) timeRef.current = node;
    else if (timeRef.current && !timeRef.current.isConnected) timeRef.current = null;
  }, []);
  const engine = useRef({
    stage: { name: "ready", slot: 0, t: 0, duration: READY, events: [], fired: 0 } as Stage,
    S: 0, roundAt: 0, cache: null as CacheEntry | null, versions: [] as number[], armed: false, stepping: false, playing: false,
    ring: 0, flightKey: 0, round: 0, readKey: 0, results: [] as (PromptCacheResult | null)[],
  });

  /** The engine keeps its own copy of the play state, so a frame already queued never runs a stage after a pause. */
  const play = useCallback((on: boolean) => { engine.current.playing = on; setPlaying(on); }, []);

  /* The ring and countdown are written straight to the DOM on every frame, so React only renders on events. */
  const paintRing = useCallback((dt = 0) => {
    const e = engine.current;
    const { ttl: life, reduced: still } = latest.current;
    const remaining = e.cache ? Math.max(0, e.cache.expiresAt - e.S) : 0;
    const target = life > 0 ? remaining / life : 0;
    if (target > e.ring && dt > 0 && !still) e.ring += (target - e.ring) * (1 - Math.exp(-dt / 70));
    else e.ring = target;
    const arc = arcRef.current;
    if (arc) { arc.style.strokeDashoffset = String(1 - e.ring); arc.style.opacity = e.ring > 0.003 ? "1" : "0"; }
    if (ringRef.current) ringRef.current.dataset.low = String(remaining > 0 && target < 0.2);
    const time = timeRef.current;
    if (time) { const text = formatClock(remaining); if (time.textContent !== text) time.textContent = text; }
  }, []);

  const setBox = useCallback((update: (box: BoxView) => BoxView) => setView(v => ({ ...v, box: update(v.box) })), []);

  const expire = useCallback(() => {
    const e = engine.current;
    e.cache = null;
    setView(v => ({ ...v, box: { ...v.box, filled: v.box.filled.map(() => false), mode: "expired" }, caption: "The cache expired. The next request writes the prefix again." }));
    latest.current.onExpire?.();
    if (e.stepping) setAnnouncement("The cache expired.");
  }, []);

  /** Carries the written part of a request into the cache: measured from the row's segments to the cache's. */
  const startFlight = useCallback((slot: number, from: number) => {
    const root = rootRef.current;
    const e = engine.current;
    if (!root) return;
    const last = latest.current.segments.length - 1;
    const pick = (selector: (index: number) => string) => {
      const first = root.querySelector(selector(from))?.getBoundingClientRect();
      const end = root.querySelector(selector(last))?.getBoundingClientRect();
      return first && end ? { left: first.left, top: first.top, width: end.right - first.left, height: first.height } : null;
    };
    const source = pick(index => `[data-row="${slot}"] [data-seg="${index}"]`);
    const target = pick(index => `[data-box-seg="${index}"]`);
    if (!source || !target) return;
    const base = root.getBoundingClientRect();
    e.flightKey++;
    const flight: FlightView = {
      key: e.flightKey, from,
      left: source.left - base.left - root.clientLeft, top: source.top - base.top - root.clientTop, width: source.width, height: source.height,
      dx: target.left - source.left, dy: target.top - source.top, w1: target.width, h1: target.height,
    };
    setView(v => ({ ...v, flight }));
  }, []);

  /* ---------------------------------------------------------------------------------------------------------------
   * Engine: one stage at a time, on a clock that only runs while playing or stepping
   * ------------------------------------------------------------------------------------------------------------- */

  const enter = useCallback((name: StageName, slot = 0) => {
    const e = engine.current;
    const cfg = latest.current;
    const quick = cfg.reduced;
    const stage: Stage = { name, slot, t: 0, duration: 0, events: [], fired: 0 };
    e.stage = stage;

    if (name === "ready") { stage.duration = quick ? 0 : READY; return; }

    if (name === "gap") {
      const gap = slot === 0 ? 0 : Math.max(0, cfg.list[slot]?.gap ?? 40);
      const from = e.S;
      stage.duration = gap && !quick ? GAP : 0;
      stage.tick = t => {
        e.S = from + gap * (stage.duration ? easeInOut(t / stage.duration) : 1);
        if (e.cache && e.S >= e.cache.expiresAt) expire();
      };
      return;
    }

    if (name === "run") {
      if (slot === 0) e.roundAt = e.S;
      const changed = e.armed && cfg.changeIndex >= 0;
      if (changed) { e.versions = e.versions.map((v, i) => i === cfg.changeIndex ? v + 1 : v); e.armed = false; setArmed(false); }
      const hadCache = !!e.cache && e.S < e.cache.expiresAt;
      const { result, cache: nextCache } = simulateRequest({
        cache: e.cache, versions: e.versions, at: e.S, roundAt: e.roundAt, index: slot, request: cfg.list[slot],
        segments: cfg.segments, model: cfg.model, ttl: cfg.ttl, changed, firstToken: cfg.firstToken,
      });
      e.results[slot] = result;
      const k = result.breakAt;
      const last = cfg.segments.length;
      const total = cfg.weights.reduce((a, b) => a + b, 0);
      const span = (index: number) => Math.max(MIN_SEGMENT, FILL * cfg.weights[index] / total);
      const timing: Timing[] = cfg.weights.map(() => ({ delay: 0, dur: 0 }));
      let at = result.kind === "hit" ? READ_FILL_AT : k > 0 ? PARTIAL_FILL_AT : hadCache ? MARK_AT + 80 : 0;
      for (let index = k; index < last; index++) { timing[index] = { delay: at, dur: span(index) }; at += span(index); }
      const prefixEnd = at;
      timing[last] = { delay: at, dur: span(last) };
      const fillEnd = at + span(last);
      const row: RowView = { result, state: quick ? "done" : "run", timing, showMark: changed && hadCache && result.kind !== "hit" };
      setView(v => ({ ...v, rows: v.rows.map((r, i) => i === slot ? row : r), caption: cfg.captionFor(result, "run") }));

      if (quick) {
        e.cache = nextCache;
        setBox(box => ({ ...box, filled: box.filled.map(() => true), mode: "warm" }));
        return;
      }
      if (result.kind === "hit") {
        e.readKey++;
        const readKey = e.readKey;
        setBox(box => ({ ...box, mode: "reading", readKey }));
        stage.duration = Math.max(SWEEP, fillEnd) + 60;
        stage.events.push({ at: 200, run: () => { e.cache = nextCache; } });
        stage.events.push({ at: stage.duration, run: () => setBox(box => ({ ...box, mode: "warm" })) });
        return;
      }
      // A write or a partial hit: drop what no longer matches, process from the break, then carry the new part into the cache.
      if (hadCache) stage.events.push({ at: k > 0 ? MARK_AT : 0, run: () => setBox(box => ({ ...box, filled: box.filled.map((f, i) => i < k && f), mode: "writing" })) });
      stage.events.push({ at: prefixEnd, run: () => { if (!hadCache) setBox(box => ({ ...box, mode: "writing" })); startFlight(slot, k); } });
      stage.events.push({ at: prefixEnd + FLIGHT, run: () => {
        e.cache = nextCache;
        setView(v => ({ ...v, flight: null, box: { ...v.box, filled: v.box.filled.map(() => true), mode: "warm" } }));
      } });
      stage.duration = Math.max(fillEnd, prefixEnd + FLIGHT) + 60;
      return;
    }

    if (name === "settle") {
      const stepped = e.stepping;
      stage.duration = quick ? (stepped ? 0 : SETTLE_STILL) : stepped ? SETTLE_STEP : SETTLE;
      const result = e.results[slot];
      setView(v => ({ ...v, rows: v.rows.map((r, i) => i === slot && r ? { ...r, state: "done" } : r), caption: result ? cfg.captionFor(result, "done") : v.caption }));
      if (result) {
        cfg.onRequest?.(result);
        if (stepped) setAnnouncement(`${cfg.captionFor(result, "done")} Simulated.`);
      }
      return;
    }

    if (name === "idle") {
      if (!e.cache) { stage.duration = 0; return; }
      const rate = quick ? Infinity : cfg.ttl / IDLE;
      let told = false;
      stage.duration = Infinity;
      stage.tick = (_t, dt) => {
        if (!told) { told = true; setView(v => ({ ...v, caption: `No new requests. The cache expires ${cfg.ttlText} after its last use.` })); }
        e.S = Number.isFinite(rate) ? e.S + dt * rate : (e.cache?.expiresAt ?? e.S);
        if (e.cache && e.S >= e.cache.expiresAt) { expire(); stage.duration = 0; }
      };
      return;
    }

    if (name === "expired") { stage.duration = cfg.loop ? EXPIRED : 0; return; }

    if (name === "clear") {
      stage.duration = quick ? 0 : CLEAR;
      setView(v => ({ ...v, clearing: true }));
      return;
    }

    if (name === "stopped") { stage.duration = Infinity; play(false); }
  }, [expire, setBox, startFlight, play]);

  const next = useCallback(() => {
    const e = engine.current;
    const { name, slot } = e.stage;
    if (name === "ready") return enter("gap", 0);
    if (name === "gap") return enter("run", slot);
    if (name === "run") return enter("settle", slot);
    if (name === "settle") {
      if (e.stepping) { e.stepping = false; setStepping(false); }
      return slot + 1 < latest.current.count ? enter("gap", slot + 1) : enter("idle");
    }
    if (name === "idle") return enter("expired");
    if (name === "expired") return latest.current.loop ? enter("clear") : enter("stopped");
    if (name === "clear") {
      e.round++;
      e.results = [];
      const round = e.round;
      setView(v => ({ ...v, round, rows: v.rows.map(() => null), clearing: false, box: v.box.mode === "expired" ? { ...v.box, mode: "empty" } : v.box }));
      return enter("gap", 0);
    }
  }, [enter]);

  const tick = useCallback((dt: number) => {
    const e = engine.current;
    if (!e.playing && !e.stepping) return;
    e.stage.t += dt;
    let stageDt = dt;
    for (let guard = 0; guard < 12; guard++) {
      const stage = e.stage;
      while (stage.fired < stage.events.length && stage.t >= stage.events[stage.fired].at) stage.events[stage.fired++].run();
      stage.tick?.(Math.min(stage.t, stage.duration), stageDt);
      if (stage.t < stage.duration) break;
      const overflow = stage.t - stage.duration;
      const wasStepping = e.stepping;
      next();
      // A step ends on the frame its request settles: the next stage waits at its start.
      if (wasStepping && !e.stepping) break;
      if (e.stage === stage) break;
      e.stage.t = Number.isFinite(overflow) ? overflow : 0;
      stageDt = 0;
    }
    paintRing(dt);
  }, [next, paintRing]);

  /* Clock */
  const running = (playing || stepping) && visible;
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(64, now - last) * Math.max(0, latest.current.speed);
      last = now;
      tick(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running, tick]);

  /* Advance only while on screen and in a visible tab. */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let inView = true;
    const sync = () => setVisible(inView && document.visibilityState === "visible");
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => { inView = !!entry?.isIntersecting; sync(); }, { rootMargin: "80px" });
    observer?.observe(root);
    document.addEventListener("visibilitychange", sync);
    return () => { observer?.disconnect(); document.removeEventListener("visibilitychange", sync); };
  }, []);

  /* Start over with an empty cache. Reduced motion opens on a finished round instead of playing it. */
  const initialize = useCallback((still: boolean) => {
    const e = engine.current;
    const cfg = latest.current;
    e.S = 0; e.roundAt = 0; e.cache = null; e.versions = cfg.segments.map(() => 0); e.armed = false; e.stepping = false; e.ring = 0; e.round++; e.results = [];
    setArmed(false);
    setStepping(false);
    if (still) {
      let cache: CacheEntry | null = null;
      const rows: RowView[] = cfg.list.map((request, index) => {
        if (index) e.S += Math.max(0, request.gap ?? 40);
        const { result, cache: nextCache } = simulateRequest({ cache, versions: e.versions, at: e.S, roundAt: 0, index, request, segments: cfg.segments, model: cfg.model, ttl: cfg.ttl, changed: false, firstToken: cfg.firstToken });
        cache = nextCache;
        e.results[index] = result;
        return { result, state: "done", timing: cfg.weights.map(() => ({ delay: 0, dur: 0 })), showMark: false };
      });
      e.cache = cache;
      enter("idle");
      const final = rows[rows.length - 1]?.result;
      setView({ round: e.round, rows, box: { filled: cfg.segments.map(() => true), mode: "warm", readKey: 0 }, flight: null, caption: final ? cfg.captionFor(final, "done") : cfg.introCaption, clearing: false });
    } else {
      enter("ready");
      setView({ round: e.round, rows: cfg.list.map(() => null), box: { filled: cfg.segments.map(() => false), mode: "empty", readKey: 0 }, flight: null, caption: cfg.introCaption, clearing: false });
    }
    paintRing();
  }, [enter, paintRing]);

  useEffect(() => {
    // Autoplay follows the reduced motion preference, which is only known after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initialize(reduced);
    play(autoPlay && !reduced);
  }, [reduced, configKey, autoPlay, initialize, play]);

  // The countdown node mounts with the warm status; paint it at once, including while the clock is stopped.
  useLayoutEffect(() => { paintRing(); }, [view.box.mode, paintRing]);

  /* Controls */
  const togglePlay = () => {
    const e = engine.current;
    if (playing) { play(false); setAnnouncement("Paused."); return; }
    if (e.stage.name === "stopped") initialize(false);
    e.stepping = false;
    setStepping(false);
    play(true);
  };
  const step = () => {
    const e = engine.current;
    play(false);
    if (e.stage.name === "stopped") initialize(false);
    e.stepping = true;
    setStepping(true);
    const { name, slot } = e.stage;
    if (name === "ready") enter("gap", 0);
    else if (name === "idle" || name === "expired") enter("clear");
    else if (name === "settle") enter(slot + 1 < count ? "gap" : "clear", slot + 1);
  };
  const reset = () => {
    initialize(false);
    setAnnouncement("Reset. The cache is empty.");
  };
  const toggleChange = () => {
    const e = engine.current;
    e.armed = !e.armed;
    setArmed(e.armed);
    if (!changeTarget) return;
    const warm = !!e.cache && e.S < e.cache.expiresAt;
    const text = !e.armed
      ? `Kept the ${lower(changeTarget.label)} as it was.`
      : warm
        ? `Edited the ${lower(changeTarget.label)}. The next request matches the cache only up to it.`
        : `Edited the ${lower(changeTarget.label)}. The cache is empty, so the next request processes everything anyway.`;
    setView(v => ({ ...v, caption: text }));
    setAnnouncement(text);
    // While the round idles, send the next request now so the edit meets a warm cache instead of an expired one.
    if (e.armed && warm && playing && e.stage.name === "idle") enter("clear");
  };

  /* Summary over the finished requests of this round */
  const done = view.rows.filter((row): row is RowView => !!row && row.state === "done").map(row => row.result);
  const spent = done.reduce((total, r) => total + r.cost, 0);
  const baseline = done.reduce((total, r) => total + r.uncachedCost, 0);
  const saving = done.length && baseline ? (1 - spent / baseline) * 100 : null;
  const hits = done.filter(r => r.kind === "hit");
  const hitTime = hits.length ? hits.reduce((t, r) => t + r.firstToken, 0) / hits.length : null;
  const coldTime = hits.length ? hits.reduce((t, r) => t + r.uncachedFirstToken, 0) / hits.length : null;
  const speedup = hitTime && coldTime ? coldTime / hitTime : null;
  const higher = saving != null && saving < 0;

  const boxTokens = segments.reduce((total, segment, i) => total + (view.box.filled[i] ? segment.tokens : 0), 0);

  const rowStatus = (row: RowView | null): { id: string; node: ReactNode } => {
    if (!row) return { id: "queued", node: null };
    const { result, state } = row;
    if (state === "run") {
      const label = result.kind === "hit" ? "Reading cache" : "Processing";
      return { id: `run-${label}`, node: <TextShimmer className={styles.shimmer}>{label}</TextShimmer> };
    }
    if (result.kind === "hit") return { id: "hit", node: <><Zap className={styles.statusIcon} data-tone="success" aria-hidden="true" />Cache hit</> };
    if (result.kind === "partial") return { id: "partial", node: <><Unlink className={styles.statusIcon} data-tone="warning" aria-hidden="true" />Partial hit</> };
    return { id: "write", node: <><PenLine className={styles.statusIcon} data-tone="info" aria-hidden="true" />Cache write</> };
  };

  const describe = (row: RowView | null, index: number) => {
    if (!row || row.state !== "done") return `Request ${index + 1}: not sent yet.`;
    const r = row.result;
    const kind = r.kind === "hit" ? "cache hit" : r.kind === "partial" ? `partial hit, changed at the ${lower(segments[r.breakAt].label)}` : "cache write";
    return `Request ${index + 1} at ${formatClock(r.at)}${r.message ? `, "${r.message}"` : ""}: ${kind}. ${formatTokens(r.cachedTokens)} tokens read from the cache, ${formatTokens(r.processedTokens)} processed. Input cost ${formatCost(r.cost)}, first token in ${formatSeconds(r.firstToken)}.`;
  };

  const boxStatus: { id: string; node: ReactNode } = (() => {
    switch (view.box.mode) {
      case "writing": return { id: "writing", node: <TextShimmer className={styles.shimmer}>Writing</TextShimmer> };
      case "reading": return { id: "reading", node: <TextShimmer className={styles.shimmer}>Reading</TextShimmer> };
      // The ring beside it is the timer glyph, so the countdown needs no icon of its own.
      case "warm": return { id: "warm", node: <span>Expires in <span ref={setTimeNode} className={styles.tabular}>{formatClock(ttl)}</span></span> };
      case "expired": return { id: "expired", node: <><TimerOff className={styles.statusIcon} data-tone="warning" aria-hidden="true" />Expired</> };
      default: return { id: "empty", node: <><CircleDashed className={styles.statusIcon} aria-hidden="true" />Empty</> };
    }
  })();

  const segmentStyle = (index: number, extra: Record<string, string | number>) => ({ flexGrow: weights[index], "--c": index < n ? colorOf(index) : "var(--pc-new)", ...extra }) as CSSProperties;

  return <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={{ "--pc-rate": Math.max(0.1, speed), ...style } as CSSProperties}
    aria-label={`${title}, simulated with sample prices`} data-paused={!running || speed <= 0 || undefined} data-clearing={view.clearing || undefined}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.model}>
          <span className={styles.modelName}>{model.mark ? <span className={styles.modelMark}>{model.mark}</span> : null}{model.name}</span>
          <span className={styles.modelTtl}>{formatDuration(ttl, true)} cache</span>
        </p>
      </div>
      <div className={styles.controls}>
        <Tooltip content={playing ? "Pause" : "Play"}>
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label={playing ? "Pause" : "Play"} onClick={togglePlay}><PlayGlyph playing={playing} /></Button>
        </Tooltip>
        <Tooltip content="Send the next request">
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label="Send the next request" onClick={step}><StepForward aria-hidden="true" /></Button>
        </Tooltip>
        <Tooltip content="Reset">
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label="Reset" onClick={reset}><RotateCcw aria-hidden="true" /></Button>
        </Tooltip>
      </div>
    </header>

    <ul className={styles.legend} aria-label="Prompt segments">
      {segments.map((segment, index) => <li key={segment.id} className={styles.legendItem}>
        <span className={styles.swatch} style={{ "--c": colorOf(index) } as CSSProperties} aria-hidden="true" />
        <span>{segment.label}</span>
        <span className={styles.legendTokens}>{formatTokens(segment.tokens)}</span>
      </li>)}
      <li className={styles.legendItem}>
        <span className={styles.swatch} style={{ "--c": "var(--pc-new)" } as CSSProperties} aria-hidden="true" />
        <span>{messageLabel}</span>
      </li>
    </ul>

    <div className={styles.main}>
      <div className={styles.stack}>
        <div className={styles.columns} aria-hidden="true">
          <span className={styles.keys}>
            <span className={styles.legendItem}><span className={styles.keySolid} />Processed</span>
            <span className={styles.legendItem}><span className={styles.keyCached} />From cache</span>
          </span>
          <span className={styles.metricHead}>Processed</span>
          <span className={styles.metricHead}>Input cost</span>
          <span className={styles.metricHead}>First token</span>
        </div>
        <ol className={styles.rows} aria-label="Requests">
          {view.rows.map((row, index) => {
            const status = rowStatus(row);
            const previous = index > 0 ? view.rows[index - 1] : null;
            const prev = previous && previous.state === "done" ? previous.result : null;
            const shown = row && row.state === "done" ? row.result : null;
            const k = row?.result.breakAt ?? 0;
            return <li key={index} className={styles.row} data-row={index} data-state={row ? row.state : "queued"} data-kind={row?.result.kind}>
              <span className={styles.srOnly}>{describe(row, index)}</span>
              <div className={styles.rowHead} aria-hidden="true">
                <span className={styles.rowTitle}>Request {index + 1}</span>
                <span className={styles.rowTime}>{row ? formatClock(row.result.at) : ""}</span>
                <Swap id={`${view.round}-${status.id}`} reduced={reduced} className={styles.rowStatus}>{status.node}</Swap>
              </div>
              <div className={styles.bar} aria-hidden="true">
                <div className={styles.prefix} style={{ flexGrow: prefixWeight }}>
                  {segments.map((segment, j) => {
                    const mode = !row ? "empty" : j < k ? "cached" : "process";
                    const timing = row?.timing[j];
                    return <span key={segment.id} className={styles.seg} data-seg={j} data-mode={mode}
                      style={segmentStyle(j, { "--d": `${timing?.delay ?? 0}ms`, "--t": `${timing?.dur ?? 0}ms`, "--l": lefts[j] })}>
                      <span className={styles.clip}>
                        <span className={styles.fill} />
                        {row?.state === "run" && mode === "cached" && !reduced ? <span className={styles.band} /> : null}
                      </span>
                      {row?.showMark && j === k ? <span className={styles.mark} style={{ "--m": `${MARK_AT}ms` } as CSSProperties} /> : null}
                    </span>;
                  })}
                </div>
                <span className={styles.seg} data-mode={row ? "process" : "empty"}
                  style={segmentStyle(n, { "--d": `${row?.timing[n]?.delay ?? 0}ms`, "--t": `${row?.timing[n]?.dur ?? 0}ms` })}>
                  <span className={styles.clip}><span className={styles.fill} /></span>
                </span>
              </div>
              <span className={styles.metric} aria-hidden="true">
                <Roll value={shown?.processedTokens ?? null} from={prev?.processedTokens} format={formatTokens} reduced={reduced} className={styles.metricValue} />
              </span>
              <span className={styles.metric} aria-hidden="true">
                <Roll value={shown?.cost ?? null} from={prev?.cost} format={formatCost} reduced={reduced} className={styles.metricValue} />
              </span>
              <span className={styles.metric} aria-hidden="true">
                <Roll value={shown?.firstToken ?? null} from={prev?.firstToken} format={formatSeconds} reduced={reduced} className={styles.metricValue} />
              </span>
            </li>;
          })}
        </ol>
      </div>

      <div className={styles.box} data-mode={view.box.mode} role="group" aria-label="Cache">
        <div className={styles.boxHead}>
          <span ref={ringRef} className={styles.ring} aria-hidden="true">
            <svg viewBox="0 0 36 36">
              <circle className={styles.ringTrack} cx="18" cy="18" r="15" />
              <circle ref={arcRef} className={styles.ringArc} cx="18" cy="18" r="15" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
            </svg>
          </span>
          <span className={styles.boxTitle}>
            <span className={styles.boxName}>Cache</span>
            <Swap id={boxStatus.id} reduced={reduced} className={styles.boxStatus}>{boxStatus.node}</Swap>
          </span>
        </div>
        <div className={styles.boxBar} aria-hidden="true">
          {segments.map((segment, j) => <span key={segment.id} className={styles.boxSeg} data-box-seg={j} data-on={view.box.filled[j] ?? false}
            style={{ flexGrow: weights[j], "--c": colorOf(j), "--l": lefts[j], "--i": n - 1 - j } as CSSProperties}>
            <span className={styles.clip}>
              <span className={styles.boxFill} />
              {view.box.mode === "reading" && view.box.filled[j] && !reduced ? <span key={view.box.readKey} className={styles.band} /> : null}
            </span>
          </span>)}
        </div>
        <span className={styles.boxTokens}><Roll value={boxTokens} format={formatTokens} reduced={reduced} className={styles.tabular} /> tokens cached</span>
        <div className={styles.pricing}>
          <dl className={styles.prices}>
            <div className={styles.price}><dt>Input</dt><dd>{formatPrice(model.inputPrice)}</dd></div>
            <div className={styles.price}><dt>Cache write</dt><dd>{formatPrice(model.cacheWritePrice)}</dd></div>
            <div className={styles.price}><dt>Cache read</dt><dd>{formatPrice(model.cacheReadPrice)}</dd></div>
          </dl>
          <p className={styles.priceNote}>Per million tokens</p>
        </div>
      </div>

      {view.flight ? <span key={view.flight.key} className={styles.ghost} aria-hidden="true" style={{
        left: view.flight.left, top: view.flight.top, width: view.flight.width, height: view.flight.height,
        "--dx": `${view.flight.dx}px`, "--dy": `${view.flight.dy}px`, "--w1": `${view.flight.w1}px`, "--h1": `${view.flight.h1}px`, "--fly": `${FLIGHT}ms`,
      } as CSSProperties}>
        {segments.slice(view.flight.from).map((segment, offset) => {
          const index = (view.flight?.from ?? 0) + offset;
          return <span key={segment.id} className={styles.ghostSeg} style={{ flexGrow: weights[index], "--c": colorOf(index) } as CSSProperties}>
            <span className={styles.ghostSolid} />
          </span>;
        })}
      </span> : null}
    </div>

    <Swap id={view.caption || introCaption} reduced={reduced} className={styles.caption}>{view.caption || introCaption}</Swap>

    <footer className={styles.footer}>
      <div className={styles.stats}>
        <div className={styles.stat}>
          <Roll value={saving == null ? null : Math.abs(saving)} format={formatPercent} reduced={reduced} className={styles.statValue} />
          <Swap id={higher ? "higher" : "lower"} reduced={reduced} className={styles.statLabel}>{higher ? "higher input cost" : "lower input cost"}</Swap>
          <span className={styles.statDetail}>{saving != null ? `${formatCost(spent)} vs ${formatCost(baseline)} uncached` : "No requests yet"}</span>
        </div>
        <div className={styles.stat}>
          <Roll value={speedup} format={formatSpeedup} reduced={reduced} className={styles.statValue} />
          <span className={styles.statLabel}>faster first token</span>
          <span className={styles.statDetail}>{hitTime && coldTime ? `${formatSeconds(hitTime)} vs ${formatSeconds(coldTime)} on cache hits` : "No cache hits yet"}</span>
        </div>
      </div>
      {changeTarget ? <Button variant="secondary" size="sm" className={styles.change} aria-pressed={armed} onClick={toggleChange}>
        <PenLine aria-hidden="true" />
        {`Change the ${lower(changeTarget.label)}`}
      </Button> : null}
    </footer>

    <p className={styles.srOnly} aria-live="polite">{announcement}</p>
  </section>;
}

export default PromptCache;
