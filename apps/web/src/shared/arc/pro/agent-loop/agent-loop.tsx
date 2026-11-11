"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, CircleAlert, CircleCheck, CircleDashed, FileText, Layers, ListChecks, LoaderCircle, Pause, Play, RotateCcw, StepForward, Wrench, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { DEFAULT_ITERATIONS, DEFAULT_MODEL, DEFAULT_SUMMARY, DEFAULT_TASK } from "./agent-loop-data";
import type { AgentLoopCheck, AgentLoopContextBlock, AgentLoopIteration, AgentLoopModel, AgentLoopToolCall } from "./agent-loop-data";
import { LANE_GAP, angleAt, arrowPath, circlePath, polar, ringGeometry } from "./agent-loop-geometry";
import type { RingGeometry } from "./agent-loop-geometry";
import { STATIONS, buildTimeline, headAt, nextSettle, viewAt, viewKey } from "./agent-loop-timeline";
import type { AgentLoopStation, LoopView } from "./agent-loop-timeline";
import styles from "./agent-loop.module.css";

export type { AgentLoopCheck, AgentLoopContextBlock, AgentLoopIteration, AgentLoopModel, AgentLoopStation, AgentLoopToolCall };

/**
 * An illustration of the agent loop: gather context, take action, verify, repeat. A bright head with a soft trail runs
 * clockwise round a ring past three stations, with the model at the center. At Gather context a block joins the context
 * stack, at Take action a tool call drops out of the ring on a short pin and resolves with its result, and at Verify a
 * check passes or leaves a retry note that sends the loop round again. A counter rolls with each loop, and the last one
 * ends in a done state with a summary.
 */
export interface AgentLoopProps {
  /** The loops to play, in order. Each adds a context block, makes one to three tool calls and runs a check. */
  iterations?: AgentLoopIteration[];
  /** The task, shown as the caption until the loop is done. */
  task?: string;
  /** The caption once the loop is done. Defaults to a count of loops and tool calls. */
  summary?: string;
  /** The model at the center. Pass null to show only the loop counter. */
  model?: AgentLoopModel | null;
  /** Card title. */
  title?: string;
  /** Station names. Keep them to about two words. */
  stationLabels?: Partial<Record<AgentLoopStation, string>>;
  /** Starts playing the first time the card is mostly in view. Under reduced motion the card opens on its end state. */
  autoPlay?: boolean;
  /** Plays again about four seconds after it ends. */
  loop?: boolean;
  /** Playback speed, controlled. 1 plays the sample run in about 18 seconds; 0 holds still. */
  speed?: number;
  /** Starting speed when uncontrolled. */
  defaultSpeed?: number;
  /** Called when the speed control changes. */
  onSpeedChange?: (speed: number) => void;
  /** Shows play and pause, step, restart and speed. */
  controls?: boolean;
  /** Called when the head reaches a station, with the zero based loop. */
  onStationChange?: (station: AgentLoopStation, iteration: number) => void;
  /** Called each time playback reaches the end. */
  onDone?: () => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_LABELS: Record<AgentLoopStation, string> = { gather: "Gather context", act: "Take action", verify: "Verify" };
const STATION_ICONS: Record<AgentLoopStation, ReactNode> = {
  gather: <Layers aria-hidden />,
  act: <Wrench aria-hidden />,
  verify: <ListChecks aria-hidden />,
};
const SPEEDS = [{ value: "0.5", label: "0.5×" }, { value: "1", label: "1×" }, { value: "2", label: "2×" }];
/** Longest trail behind the head, in degrees of the ring; it never reaches back past most of the leg it is on. */
const TRAIL_DEG = 72;
const EASE = [...motionTokens.ease.standard] as [number, number, number, number];
const SLIDE = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const formatTokens = (v: number) => (v < 1000 ? `${Math.round(v)}` : `${(v / 1000).toFixed(1)}K`);

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/** One minimal crossfade for labels: the old one fades out fast while the new one fades in from 2px below. */
function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
        transition={{ duration: reduced ? 0 : motionTokens.duration.fast, delay: reduced ? 0 : 0.05, ease: EASE }}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

/** A number that rolls up to its new value inside a reserved, tabular width. */
function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  return <span className={styles.roll} style={{ "--digits": String(value).length } as CSSProperties}>
    <AnimatePresence initial={false}>
      <motion.span key={value} className={styles.rollItem}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: "0.75em" }}
        animate={{ opacity: 1, y: "0em" }}
        exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: "-0.75em", transition: { duration: 0.14, ease: EASE } }}
        transition={{ duration: reduced ? 0 : 0.22, ease: [...motionTokens.ease.enter] }}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

/** A token count that counts to its new value in tabular numerals. */
function Tokens({ value, reduced }: { value: number; reduced: boolean }) {
  const count = useMotionValue(value);
  const text = useTransform(count, formatTokens);
  useEffect(() => {
    if (reduced) { count.jump(value); return; }
    const controls = animate(count, value, { duration: 0.5, ease: EASE });
    return () => controls.stop();
  }, [value, reduced, count]);
  return <motion.span className={styles.tokenValue}>{text}</motion.span>;
}

function ToolChip({ call, resolved, reduced }: { call: AgentLoopToolCall; resolved: boolean; reduced: boolean }) {
  const failed = call.status === "error";
  const state = !resolved ? "running" : failed ? "error" : "success";
  return <div className={styles.chip} data-state={state}>
    <span className={styles.chipHead}>
      <span className={styles.chipMark}>{call.mark ?? <Wrench aria-hidden />}</span>
      <span className={styles.chipTitle}>{call.action}</span>
      <Swap id={state} reduced={reduced} className={styles.chipIcon}>
        {state === "running" ? <LoaderCircle aria-hidden className={styles.spin} /> : state === "error" ? <X aria-hidden /> : <Check aria-hidden />}
      </Swap>
    </span>
    <Swap id={state} reduced={reduced} className={styles.chipBody}>
      {state === "running"
        ? <TextShimmer active={!reduced}>{`Calling ${call.tool}`}</TextShimmer>
        : <span className={styles.chipText}><span className={styles.srOnly}>{failed ? `${call.tool} failed: ` : `${call.tool} returned: `}</span>{call.result}</span>}
    </Swap>
  </div>;
}

function CheckChip({ check }: { check: AgentLoopCheck }) {
  return <div className={styles.chip} data-state={check.passed ? "passed" : "retry"}>
    <span className={styles.chipHead}>
      <span className={styles.chipMark} data-tone={check.passed ? "success" : "warning"}>{check.passed ? <CircleCheck aria-hidden /> : <RotateCcw aria-hidden />}</span>
      <span className={styles.chipTitle}>{check.passed ? "Check passed" : "Retry"}</span>
    </span>
    <span className={styles.chipBody}><span className={styles.chipText}>{check.note}</span></span>
  </div>;
}

type LaneItem = { id: string; node: ReactNode } | null;

/**
 * An outcome lane under the ring. Each new outcome drops out of its station: the pin draws down from the ring, the chip
 * lands at its end (a short slide with no bounce) and the one before it fades out fast in the same cell, so the lane never
 * changes size. Lanes reserve their height, so nothing under them moves.
 */
function Lane({ item, empty, live, reduced, pinX }: { item: LaneItem; empty: string; live: boolean; reduced: boolean; pinX: number }) {
  return <div className={styles.lane} data-live={live || undefined}>
    <AnimatePresence initial={false}>
      <motion.div key={item?.id ?? "empty"} className={styles.pop} style={{ transformOrigin: `${pinX}px 0` }}
        initial={reduced || !item ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.08 } }}
        transition={reduced ? { duration: 0 } : item ? { ...SLIDE, delay: 0.1 } : { duration: motionTokens.duration.fast }}>
        {item ? item.node : <div className={styles.laneEmpty}>{empty}</div>}
      </motion.div>
    </AnimatePresence>
  </div>;
}

function narrate(view: LoopView, iterations: AgentLoopIteration[], summary: string) {
  const loop = iterations[view.loop];
  switch (view.beat) {
    case "ready": return "";
    case "done": return summary;
    case "gather": return loop ? `Loop ${view.loop + 1}. Gathered context: ${loop.gather.label}` : "";
    case "call": {
      const call = view.call && iterations[view.call.loop]?.calls[view.call.index];
      return call ? `Calling ${call.tool}: ${call.action}` : "";
    }
    case "result": {
      const call = view.call && iterations[view.call.loop]?.calls[view.call.index];
      return call ? `${call.tool} ${call.status === "error" ? "failed" : "returned"}: ${call.result}` : "";
    }
    case "verify": {
      const check = view.verify && iterations[view.verify.loop]?.verify;
      if (!check) return "";
      return check.passed ? `Check passed: ${check.note}` : `Retry: ${check.note}. The loop runs again`;
    }
  }
}

export function AgentLoop({
  iterations = DEFAULT_ITERATIONS,
  task = DEFAULT_TASK,
  summary,
  model = DEFAULT_MODEL,
  title = "Agent loop",
  stationLabels,
  autoPlay = true,
  loop: replay = false,
  speed: speedProp,
  defaultSpeed = 1,
  onSpeedChange,
  controls = true,
  onStationChange,
  onDone,
  className,
  style,
}: AgentLoopProps) {
  const reduced = useReducedFlag();
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const labels = { ...DEFAULT_LABELS, ...stationLabels };
  const empty = iterations.length === 0;
  const callCounts = iterations.map(it => clamp(it.calls.length, 1, 3));
  const countsKey = callCounts.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tl = useMemo(() => buildTimeline(callCounts), [countsKey]);
  const totalCalls = iterations.reduce((sum, it) => sum + Math.min(3, it.calls.length), 0);
  const stopped = !empty && !iterations[iterations.length - 1].verify.passed;
  const endSummary = summary ?? (iterations === DEFAULT_ITERATIONS ? DEFAULT_SUMMARY
    : stopped ? `Stopped after ${plural(iterations.length, "loop")} without a passing check.`
      : `Finished after ${plural(iterations.length, "loop")} and ${plural(totalCalls, "tool call")}.`);

  const [speedState, setSpeedState] = useState(defaultSpeed);
  const speed = speedProp ?? speedState;
  const setSpeed = (value: number) => { if (speedProp === undefined) setSpeedState(value); onSpeedChange?.(value); };

  const rootRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const trailRef = useRef<SVGPathElement>(null);
  const gradRef = useRef<SVGLinearGradientElement>(null);
  const stepButtonRef = useRef<HTMLButtonElement>(null);
  const restartButtonRef = useRef<HTMLButtonElement>(null);

  const [geo, setGeo] = useState<RingGeometry | null>(null);
  const geoRef = useRef<RingGeometry | null>(null);
  const tRef = useRef(0);
  const targetRef = useRef<number | null>(null);
  const [mode, setMode] = useState<"idle" | "playing" | "stepping">("idle");
  const [view, setView] = useState<LoopView>(() => viewAt(tl, 0));
  const [live, setLive] = useState("");

  const live$ = useRef({ tl, reduced, speed });
  useLayoutEffect(() => { live$.current = { tl, reduced, speed }; });
  const callbacks = useRef({ onStationChange, onDone });
  useLayoutEffect(() => { callbacks.current = { onStationChange, onDone }; });

  /** Writes the head and its trail straight to the DOM, so React renders once per beat rather than once per frame. */
  const paint = useCallback(() => {
    const g = geoRef.current, head = headRef.current, trail = trailRef.current, grad = gradRef.current;
    if (!g || !head || !trail || !grad) return;
    const { tl: timeline, reduced: still } = live$.current;
    const { u, moving } = headAt(timeline, tRef.current, still);
    const angle = angleAt(g, u);
    const p = polar(g.cx, g.cy, g.r, angle);
    head.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
    const ends = [...g.angles, 270];
    const leg = Math.min(2, Math.floor((((u % 3) + 3) % 3)));
    const span = still ? 0 : moving * Math.min(TRAIL_DEG, 0.7 * (ends[leg + 1] - ends[leg]));
    if (span < 1) { trail.setAttribute("d", ""); return; }
    const tail = polar(g.cx, g.cy, g.r, angle - span);
    trail.setAttribute("d", `M ${tail.x.toFixed(2)} ${tail.y.toFixed(2)} A ${g.r} ${g.r} 0 0 1 ${p.x.toFixed(2)} ${p.y.toFixed(2)}`);
    grad.setAttribute("x1", tail.x.toFixed(2)); grad.setAttribute("y1", tail.y.toFixed(2));
    grad.setAttribute("x2", p.x.toFixed(2)); grad.setAttribute("y2", p.y.toFixed(2));
  }, []);

  const sync = useCallback(() => {
    const next = viewAt(live$.current.tl, tRef.current);
    setView(prev => (viewKey(prev) === viewKey(next) ? prev : next));
  }, []);

  // Measure the ring column; the ring is laid out in real pixels so strokes and text stay crisp at every size.
  useLayoutEffect(() => {
    const node = ringRef.current;
    if (!node) return;
    const measure = () => {
      const w = Math.round(node.getBoundingClientRect().width);
      if (!w || geoRef.current?.w === w) return;
      const next = ringGeometry(w);
      geoRef.current = next;
      setGeo(next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useLayoutEffect(() => { paint(); }, [geo, reduced, paint]);

  // A new set of loops starts over.
  const firstTimeline = useRef(true);
  useEffect(() => {
    if (firstTimeline.current) { firstTimeline.current = false; return; }
    tRef.current = 0; targetRef.current = null; setMode("idle"); sync(); paint();
  }, [tl, sync, paint]);

  // Under reduced motion the card opens on its end state instead of playing on its own.
  useEffect(() => {
    if (!reduced || empty || tRef.current !== 0) return;
    tRef.current = tl.end; sync(); paint();
  }, [reduced, empty, tl, sync, paint]);

  // The clock. It runs only while playing or stepping and advances by real time times speed.
  const running = mode !== "idle";
  useEffect(() => {
    if (!running) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const { tl: timeline, speed: pace, reduced: still } = live$.current;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const target = targetRef.current;
      const before = tRef.current;
      let t = before;
      if (target !== null) t = still ? target : Math.min(target, t + dt * Math.max(1, pace) * 2.5);
      else t = Math.min(timeline.end, t + dt * pace);
      tRef.current = t;
      paint(); sync();
      if (before < timeline.end && t >= timeline.end) callbacks.current.onDone?.();
      if (target !== null && t >= target) { targetRef.current = null; setMode("idle"); return; }
      if (t >= timeline.end) { setMode("idle"); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, paint, sync]);

  const play = useCallback(() => {
    if (empty) return;
    if (tRef.current >= tl.end) { tRef.current = 0; sync(); paint(); }
    targetRef.current = null;
    setMode("playing");
  }, [empty, tl, sync, paint]);
  const pause = () => { targetRef.current = null; setMode("idle"); };
  const step = () => {
    if (empty || tRef.current >= tl.end) return;
    targetRef.current = nextSettle(tl, tRef.current);
    setMode("stepping");
  };
  const restart = () => {
    if (empty) return;
    tRef.current = 0; targetRef.current = null; sync(); paint(); setMode("playing");
  };

  // Autoplay once, the first time the card is mostly in view.
  const autoPlayed = useRef(false);
  useEffect(() => {
    const node = rootRef.current;
    if (!autoPlay || reduced || empty || autoPlayed.current || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || autoPlayed.current) return;
      autoPlayed.current = true;
      observer.disconnect();
      if (tRef.current === 0) play();
    }, { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [autoPlay, reduced, empty, play]);

  // Replay after a pause on the end state.
  useEffect(() => {
    if (!replay || !view.done || mode !== "idle" || reduced) return;
    const timer = window.setTimeout(() => { tRef.current = 0; sync(); paint(); setMode("playing"); }, 4000 / Math.max(0.5, speed));
    return () => window.clearTimeout(timer);
  }, [replay, view.done, mode, reduced, speed, sync, paint]);

  // Station changes fire once per beat, never per frame; onDone fires from the clock when it crosses the end.
  useEffect(() => { if (view.at) callbacks.current.onStationChange?.(view.at, view.loop); }, [view.at, view.loop]);

  // Screen readers hear each beat when the reader steps or pauses, and the summary at the end, but not every beat while
  // the loop plays on its own.
  const narration = narrate(view, iterations, endSummary);
  const nextLive = mode === "playing" && !view.done ? live : narration;
  if (nextLive !== live) setLive(nextLive);

  // Stepping onto the end disables Step, so its focus moves to Restart instead of the page.
  useEffect(() => {
    if (view.done && document.activeElement === stepButtonRef.current) restartButtonRef.current?.focus();
  }, [view.done]);

  const working = mode !== "idle";
  const ended = view.done;
  const tokens = iterations.slice(0, view.context).reduce((sum, it) => sum + it.gather.tokens, 0);
  const stationState = (station: AgentLoopStation) => {
    if (view.ready) return "idle";
    if (ended) return "visited";
    if (view.at === station) return "active";
    const last = view.last ? STATIONS.indexOf(view.last) : -1;
    return STATIONS.indexOf(station) <= last ? "visited" : "idle";
  };

  const callData = view.call ? iterations[view.call.loop]?.calls[view.call.index] : undefined;
  const checkData = view.verify ? iterations[view.verify.loop]?.verify : undefined;
  const callItem: LaneItem = callData && view.call
    ? { id: `call-${view.call.loop}-${view.call.index}`, node: <ToolChip call={callData} resolved={view.call.resolved} reduced={reduced} /> } : null;
  const checkItem: LaneItem = checkData && view.verify ? { id: `check-${view.verify.loop}`, node: <CheckChip check={checkData} /> } : null;
  // One lane on narrow cards shows whichever outcome came last.
  const latest: "act" | "verify" = view.verify && (!view.call || view.verify.loop >= view.call.loop) ? "verify" : "act";

  const status = ended
    ? stopped ? { key: "stopped", icon: <CircleAlert aria-hidden />, label: "Stopped", tone: "warning" } : { key: "done", icon: <CircleCheck aria-hidden />, label: "Done", tone: "success" }
    : working ? { key: "running", icon: <LoaderCircle aria-hidden className={styles.spin} />, label: "Running", tone: "accent" }
      : view.ready ? { key: "ready", icon: <CircleDashed aria-hidden />, label: "Ready", tone: "muted" }
        : { key: "paused", icon: <Pause aria-hidden />, label: "Paused", tone: "muted" };
  const playLabel = mode === "playing" ? "Pause" : ended ? "Play again" : "Play";

  const centerLine = empty ? <span>No loops yet</span>
    : ended ? <span className={styles.centerEnd} data-tone={stopped ? "warning" : "success"}>
      {stopped ? <CircleAlert aria-hidden /> : <CircleCheck aria-hidden />}<span><span className={styles.centerLead}>{stopped ? "Stopped after " : "Done in "}</span>{plural(iterations.length, "loop")}</span>
    </span>
      : view.ready ? <span>Ready</span>
        : <span className={styles.centerCount}>Loop <Roll value={view.loop + 1} reduced={reduced} /></span>;

  const stationLabel = (key: AgentLoopStation, i: number, g: RingGeometry) => {
    const state = stationState(key);
    const n = g.nodes[i];
    const pos = key === "gather" ? { left: n.x, top: n.y - g.gap, maxWidth: g.w }
      : key === "act" ? { left: n.x + g.gap, top: n.y, maxWidth: g.w - n.x - g.gap }
        : { left: n.x - g.gap, top: n.y, maxWidth: n.x - g.gap };
    return <span key={key} className={styles.station} data-key={key} data-state={state} style={pos}>
      {STATION_ICONS[key]}
      <TextShimmer active={state === "active" && working && !reduced} className={styles.stationText}>{labels[key]}</TextShimmer>
    </span>;
  };

  const split = !!geo && !geo.compact;
  const actX = geo ? geo.nodes[1].x : 0, verifyX = geo ? geo.nodes[2].x : 0;
  // Pin x inside each lane, so a chip grows from the end of its pin.
  const laneWidth = geo ? (split ? (geo.w - 12) / 2 : geo.w) : 0;
  const pins = geo ? (split
    ? [{ key: "verify", x: verifyX, on: !!checkItem, live: view.at === "verify" }, { key: "act", x: actX, on: !!callItem, live: view.at === "act" }]
    : [{ key: latest, x: latest === "act" ? actX : verifyX, on: !!(latest === "act" ? callItem : checkItem), live: view.at === "act" || view.at === "verify" }]) : [];

  return <div ref={rootRef} className={cx(styles.root, className)} style={style} role="group" aria-labelledby={`${uid}-title`}
    data-ready={view.ready || undefined} data-done={(ended && !stopped) || undefined} data-ended={ended || undefined}
    data-measured={geo ? "" : undefined} data-compact={geo?.compact || undefined}>
    <div className={styles.header}>
      <h3 id={`${uid}-title`} className={styles.title}>{title}</h3>
      <span className={styles.status} data-tone={status.tone}>
        <Swap id={status.key} reduced={reduced} className={styles.statusSwap}>
          <span className={styles.statusItem}>{status.icon}{status.label}</span>
        </Swap>
      </span>
      <p className={styles.caption}><Swap id={ended ? "summary" : "task"} reduced={reduced}>{ended ? endSummary : task}</Swap></p>
      <p className={styles.srOnly} role="status" aria-live="polite">{live}</p>
    </div>

    <div className={styles.stage}>
      <div className={styles.loop}>
        <div ref={ringRef} className={styles.ring} style={geo ? { height: geo.h } : undefined}>
          {geo && <>
            <svg className={styles.svg} width={geo.w} height={geo.h + LANE_GAP} viewBox={`0 0 ${geo.w} ${geo.h + LANE_GAP}`} aria-hidden="true">
              <defs>
                <linearGradient ref={gradRef} id={`${uid}-trail`} gradientUnits="userSpaceOnUse">
                  <stop offset="0" className={styles.trailStop} stopOpacity="0" />
                  <stop offset="1" className={styles.trailStop} stopOpacity="0.7" />
                </linearGradient>
              </defs>
              {pins.map(pin => {
                const node = pin.key === "act" ? geo.nodes[1] : geo.nodes[2];
                const d = `M ${pin.x} ${node.y + 9} V ${geo.h + LANE_GAP}`;
                return <g key={pin.key}>
                  <path className={styles.pin} d={d} />
                  <AnimatePresence initial={false}>
                    {pin.on && <motion.path key={pin.key === "act" ? callItem?.id : checkItem?.id} className={styles.pinLive} d={d}
                      data-live={pin.live || undefined}
                      initial={reduced ? { pathLength: 1, opacity: 0 } : { pathLength: 0, opacity: 1 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
                      transition={{ duration: reduced ? 0 : 0.18, ease: EASE }} />}
                  </AnimatePresence>
                </g>;
              })}
              <path className={styles.track} d={circlePath(geo)} />
              {geo.arrows.map((a, i) => <path key={i} className={styles.arrow} d={arrowPath}
                transform={`translate(${a.x.toFixed(2)} ${a.y.toFixed(2)}) rotate(${a.heading})`} />)}
              <path className={styles.doneLine} d={circlePath(geo)} pathLength={1} />
              <path ref={trailRef} className={styles.trail} stroke={`url(#${uid}-trail)`} />
              {STATIONS.map((key, i) => {
                const p = geo.nodes[i];
                const state = stationState(key);
                return <g key={key} transform={`translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`}>
                  <circle className={styles.nodeRing} r={10.5} data-on={state === "active" || undefined} />
                  <circle className={styles.node} r={5} data-state={state} />
                </g>;
              })}
              <g ref={headRef} className={styles.headGroup}><circle className={styles.head} r={5} /></g>
            </svg>
            {STATIONS.map((key, i) => stationLabel(key, i, geo))}
            <div className={styles.center} style={{ left: geo.cx, top: geo.cy, maxWidth: geo.r * 1.7 }}>
              {model?.mark && <span className={styles.centerMark}>{model.mark}</span>}
              {model && <span className={styles.centerName} title={model.name}>{model.name}</span>}
              <Swap id={empty ? "empty" : ended ? "end" : view.ready ? "ready" : "loop"} reduced={reduced} className={styles.centerLine}>{centerLine}</Swap>
            </div>
          </>}
        </div>

        <div className={styles.lanes} data-split={split || undefined}>
          {split
            ? <>
              <Lane item={checkItem} empty="Checks land here" live={view.at === "verify"} reduced={reduced} pinX={verifyX} />
              <Lane item={callItem} empty="Tool calls land here" live={view.at === "act"} reduced={reduced} pinX={actX - laneWidth - 12} />
            </>
            : <Lane item={latest === "verify" ? checkItem : callItem} empty="Tool calls and checks land here"
              live={view.at === "act" || view.at === "verify"} reduced={reduced} pinX={latest === "act" ? actX : verifyX} />}
        </div>
      </div>

      <div className={styles.context}>
        <div className={styles.contextHead}>
          <span className={styles.contextTitle}>Context</span>
          <span className={styles.tokens}><Tokens value={tokens} reduced={reduced} /> tokens</span>
        </div>
        <ol className={styles.blocks} style={{ "--slots": Math.max(1, iterations.length), "--rows": Math.max(1, Math.ceil(iterations.length / 2)) } as CSSProperties} aria-label="Context blocks">
          <AnimatePresence initial={false}>
            {iterations.slice(0, view.context).map((it, i) => <motion.li key={`${i}-${it.gather.label}`} className={styles.block}
              data-fresh={(i === view.context - 1 && view.at === "gather") || undefined}
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.12 } }}
              transition={reduced ? { duration: 0 } : SLIDE}>
              <span className={styles.blockMark}>{it.gather.mark ?? <FileText aria-hidden />}</span>
              <span className={styles.blockLabel}>{it.gather.label}</span>
              <span className={styles.blockTokens}>{formatTokens(it.gather.tokens)}<span className={styles.srOnly}> tokens</span></span>
              {it.gather.detail && <span className={styles.blockDetail}>{it.gather.detail}</span>}
            </motion.li>)}
            {view.context === 0 && <motion.li key="empty" className={styles.blocksEmpty}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
              transition={{ duration: reduced ? 0 : motionTokens.duration.fast }}>
              {empty ? "Nothing to gather yet" : "Fills as the agent gathers context"}
            </motion.li>}
          </AnimatePresence>
        </ol>
      </div>
    </div>

    {controls && <div className={styles.footer}>
      <div className={styles.buttons}>
        <Tooltip content={playLabel}>
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label={playLabel} disabled={empty} onClick={mode === "playing" ? pause : play}>
            <span className={styles.glyph}><Play data-on={mode !== "playing"} aria-hidden /><Pause data-on={mode === "playing"} aria-hidden /></span>
          </Button>
        </Tooltip>
        <Tooltip content="Next step">
          <Button ref={stepButtonRef} variant="secondary" size="sm" className={styles.iconButton} aria-label="Next step" disabled={empty || ended} onClick={step}><StepForward aria-hidden /></Button>
        </Tooltip>
        <Tooltip content="Restart">
          <Button ref={restartButtonRef} variant="secondary" size="sm" className={styles.iconButton} aria-label="Restart" disabled={empty} onClick={restart}><RotateCcw aria-hidden /></Button>
        </Tooltip>
      </div>
      <div className={styles.speed}>
        <span className={styles.speedLabel} aria-hidden="true">Speed</span>
        <SegmentedControl label="Speed" value={String(speed)} onValueChange={value => setSpeed(Number(value))} options={SPEEDS} />
      </div>
    </div>}
  </div>;
}

export default AgentLoop;
