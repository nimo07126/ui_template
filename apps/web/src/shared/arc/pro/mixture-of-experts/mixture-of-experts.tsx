"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowRight, CircleCheck, Pause, Play, RotateCcw, TriangleAlert } from "lucide-react";
import SegmentedControl from "../../segmented-control/segmented-control";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { motionTokens } from "../../lib/motion-tokens";
import { balanceOf, capacityFor, DEFAULT_EXPERTS, DEFAULT_PARAMETERS, DEFAULT_TOKENS, planRoutes } from "./mixture-of-experts-data";
import type { MixtureOfExpertsExpert, MixtureOfExpertsParameters, MixtureOfExpertsRoute, MixtureOfExpertsToken, PlannedRoute } from "./mixture-of-experts-data";
import { buildGeometry, narrowHeight, wideHeight } from "./mixture-of-experts-geometry";
import type { Geometry, Rect, Seg } from "./mixture-of-experts-geometry";
import styles from "./mixture-of-experts.module.css";

export type { MixtureOfExpertsExpert, MixtureOfExpertsParameters, MixtureOfExpertsRoute, MixtureOfExpertsToken } from "./mixture-of-experts-data";
export { DEFAULT_EXPERTS, DEFAULT_PARAMETERS, DEFAULT_TOKENS } from "./mixture-of-experts-data";

/**
 * A sparse mixture of experts layer, one token at a time. Each token slides into a router that scores every expert, travels
 * to its top k experts, lights them up and rolls their load counters, then the outputs merge into the token's output. Hover
 * or focus a token to freeze on its gate scores and choices; hover an expert to see what it tends to handle and which tokens
 * it took. Top k switches between one and two experts per token and rolls the active parameter readout.
 */
export interface MixtureOfExpertsProps {
  /** The sequence to route. Defaults to a short sample sentence with hand tuned scores. */
  tokens?: MixtureOfExpertsToken[];
  /** The routed experts, from 2 to 12. Defaults to eight illustrative specialties. */
  experts?: MixtureOfExpertsExpert[];
  /** Experts per token, controlled. */
  topK?: 1 | 2;
  /** Experts per token on first render when uncontrolled. */
  defaultTopK?: 1 | 2;
  onTopKChange?: (topK: 1 | 2) => void;
  /** Model sizes in billions for the active parameter readout. Illustrative by default. */
  parameters?: MixtureOfExpertsParameters;
  /** Room per expert as a multiple of an even share of the routes. Overflow skips the expert. Infinity never drops. */
  capacityFactor?: number;
  /** Multiplies the pace. At 1 one token takes about two seconds. 0 holds still. */
  speed?: number;
  /** Holds the animation, controlled. */
  paused?: boolean;
  /** Starts paused when uncontrolled. */
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Starts over after the last token. Reduced motion never loops. */
  loop?: boolean;
  /** Called as each token is sent to its experts. */
  onRoute?: (route: MixtureOfExpertsRoute) => void;
  /** Accessible name of the whole component. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Phase = "enter" | "in" | "gate" | "dispatch" | "expert" | "merge" | "out" | "done";
type Step = { index: number; phase: Phase; cycle: number };
type Inspect = { kind: "token" | "expert"; index: number };

const ORDER: Record<Phase, number> = { enter: 0, in: 1, gate: 2, dispatch: 3, expert: 4, merge: 5, out: 6, done: 7 };
/** Seconds into a token at speed 1: the chip enters, travels to the router, is scored, goes to its experts, merges, exits. */
const FULL = { in: .18, gate: .5, dispatch: .78, expert: 1.16, merge: 1.4, join: 1.68, out: 1.86, next: 2.2 };
/** Reduced motion: no travel, the same states land in place. */
const STILL = { in: 0, gate: 0, dispatch: .6, expert: .6, merge: 1.1, join: 1.1, out: 1.1, next: 1.8 };
type Timing = typeof FULL;
const DONE_HOLD = 3.6;

const phaseAt = (t: number, T: Timing): Phase =>
  t < T.in ? "enter" : t < T.gate ? "in" : t < T.dispatch ? "gate" : t < T.expert ? "dispatch" : t < T.merge ? "expert" : t < T.out ? "merge" : "out";

const ease = (p: number) => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const pct = (v: number) => `${Math.round(v * 100)}%`;
const RANK_LABEL = ["first", "second"];

const swap = {
  initial: { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } },
  exit: { opacity: 0, transition: { duration: .1 } },
};
const still = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
};

/** One digit window of a rolling number. */
function Digit({ digit, reduced }: { digit: number; reduced: boolean }) {
  return <span className={styles.digit}>
    <span className={styles.sizer}>0</span>
    <motion.span className={styles.strip} initial={false} animate={{ y: `${-digit * 10}%` }} transition={reduced ? { duration: 0 } : motionTokens.spring.smooth}>
      {"0123456789".split("").map(d => <span key={d}>{d}</span>)}
    </motion.span>
  </span>;
}

/** A whole number whose digits roll on tabular numerals. Columns are keyed by place, so 9 to 10 keeps the ones column. */
function Roll({ value, reduced }: { value: number; reduced: boolean }) {
  const text = String(Math.max(0, Math.round(value)));
  return <span className={styles.roll} aria-hidden="true">
    {text.split("").map((d, i) => <Digit key={text.length - i} digit={+d} reduced={reduced} />)}
  </span>;
}

/** False on the server and during hydration, so the first client render matches the server markup. */
const subscribeNothing = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

const box = (r: Rect): CSSProperties => ({ left: r.x, top: r.y, width: r.w, height: r.h });
const initialOf = (name: string) => <span className={styles.initial}>{name.trim().charAt(0) || "?"}</span>;

export function MixtureOfExperts({
  tokens = DEFAULT_TOKENS,
  experts: expertsProp = DEFAULT_EXPERTS,
  topK,
  defaultTopK = 2,
  onTopKChange,
  parameters = DEFAULT_PARAMETERS,
  capacityFactor = 1,
  speed = 1,
  paused: pausedProp,
  defaultPaused = false,
  onPausedChange,
  loop = true,
  onRoute,
  label = "Mixture of experts routing",
  className,
  style,
}: MixtureOfExpertsProps) {
  const prefersReduced = useReducedMotion();
  const hydrated = useHydrated();
  const reduced = hydrated && !!prefersReduced;
  const experts = useMemo(() => expertsProp.slice(0, 12), [expertsProp]);
  const count = Math.max(1, experts.length);
  const n = tokens.length;

  const [kState, setKState] = useState<1 | 2>(defaultTopK);
  const k = topK ?? kState;
  const setK = (next: 1 | 2) => { if (topK === undefined) setKState(next); onTopKChange?.(next); };
  const [pausedState, setPausedState] = useState(defaultPaused);
  const paused = pausedProp ?? pausedState;
  const setPaused = useCallback((next: boolean) => { if (pausedProp === undefined) setPausedState(next); onPausedChange?.(next); }, [pausedProp, onPausedChange]);

  const capacity = capacityFor(n, count, k, capacityFactor);
  const plan = useMemo(() => planRoutes(tokens, count, k, capacity), [tokens, count, k, capacity]);
  const zeros = useMemo(() => new Array<number>(count).fill(0), [count]);

  // Measure the stage; until then CSS reserves its height for both layouts.
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    setWidth(node.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const geo = useMemo<Geometry | null>(() => (width > 0 ? buildGeometry(width, count) : null), [width, count]);

  // Pause while scrolled away.
  const rootRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Inspection: hover wins over keyboard focus, which wins over a pin. Any of them freezes the clock.
  const [hover, setHover] = useState<Inspect | null>(null);
  const [focused, setFocused] = useState<Inspect | null>(null);
  const [pinned, setPinned] = useState<Inspect | null>(null);
  const inspect = hover ?? focused ?? pinned;
  const [tokenCursor, setTokenCursor] = useState(0);
  const [expertCursor, setExpertCursor] = useState(0);
  const [announce, setAnnounce] = useState("");

  // The clock. React hears about phase changes only; packets are drawn straight to the DOM every frame.
  const [step, setStep] = useState<Step>({ index: 0, phase: "enter", cycle: 0 });
  const clock = useRef({ t: 0, index: 0, phase: "enter" as Phase, cycle: 0 });
  const T = reduced ? STILL : FULL;
  const ended = step.phase === "done" && (!loop || reduced);
  const running = !paused && !inspect && inView && !!geo && n > 0 && speed > 0 && !ended;

  const packetRefs = useRef<(SVGGElement | null)[]>([]);
  const live = useRef({ geo, plan, T, reduced });
  useEffect(() => { live.current = { geo, plan, T, reduced }; });

  const draw = useCallback(() => {
    const { geo: g, plan: p, T: timing, reduced: still } = live.current;
    const { t, index, phase } = clock.current;
    const route = p[index];
    const slots: ({ seg: Seg; at: number } | null)[] = [null, null, null, null, null, null];
    if (g && route && !still && phase !== "done") {
      const span = (a: number, b: number) => (t >= a && t < b ? ease((t - a) / (b - a)) : -1);
      const pIn = span(timing.in, timing.gate);
      if (pIn >= 0) slots[0] = { seg: g.inSeg, at: pIn };
      const pGate = span(timing.dispatch, timing.expert);
      const pCurve = span(timing.merge, timing.join);
      const pOut = span(timing.join, timing.out);
      route.experts.forEach((e, r) => {
        if (pGate >= 0) slots[1 + r] = { seg: g.gates[e], at: route.dropped.includes(e) ? pGate * .92 : pGate };
        if (pCurve >= 0 && !route.dropped.includes(e)) slots[3 + r] = { seg: g.curves[e], at: pCurve };
      });
      if (pOut >= 0 && route.dropped.length < route.experts.length) slots[5] = { seg: g.outSeg, at: pOut };
    }
    slots.forEach((slot, i) => {
      const group = packetRefs.current[i];
      if (!group) return;
      if (!slot) { group.style.opacity = "0"; return; }
      const [long, short, dot] = group.children as unknown as [SVGPathElement, SVGPathElement, SVGCircleElement];
      const { seg, at } = slot;
      const d = at * seg.len;
      const tail = Math.min(34, seg.len * .7);
      if (long.getAttribute("d") !== seg.d) { long.setAttribute("d", seg.d); short.setAttribute("d", seg.d); }
      long.setAttribute("stroke-dasharray", `${tail} ${seg.len + tail}`);
      long.setAttribute("stroke-dashoffset", `${tail - d}`);
      short.setAttribute("stroke-dasharray", `${tail * .45} ${seg.len + tail}`);
      short.setAttribute("stroke-dashoffset", `${tail * .45 - d}`);
      const pt = seg.at(d);
      dot.setAttribute("cx", pt.x.toFixed(2));
      dot.setAttribute("cy", pt.y.toFixed(2));
      group.style.opacity = "1";
    });
  }, []);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const c = clock.current;
      const { T: timing, plan: p, reduced: still } = live.current;
      c.t += Math.min(.05, (now - last) / 1000) * speed;
      last = now;
      if (c.phase === "done") {
        if (c.t >= DONE_HOLD && loop && !still) { c.t = 0; c.index = 0; c.cycle += 1; c.phase = "enter"; }
      } else if (c.t >= timing.next) {
        if (c.index + 1 < p.length) { c.index += 1; c.t -= timing.next; }
        else { c.phase = "done"; c.t = 0; }
      }
      if (c.phase !== "done") c.phase = phaseAt(c.t, timing);
      setStep(prev => (prev.index === c.index && prev.phase === c.phase && prev.cycle === c.cycle ? prev : { index: c.index, phase: c.phase, cycle: c.cycle }));
      draw();
      if (c.phase === "done" && (!loop || still)) return;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, speed, loop, draw]);

  // Redraw packets in place when the layout or the plan changes while still.
  useEffect(() => { draw(); }, [geo, plan, draw]);

  // A shorter sequence than where the clock stands starts over.
  useEffect(() => {
    if (clock.current.index < n) return;
    clock.current = { t: 0, index: 0, phase: "enter", cycle: clock.current.cycle + 1 };
    setStep({ index: 0, phase: "enter", cycle: clock.current.cycle });
  }, [n]);

  // Tell the host each time a token is sent to its experts.
  const onRouteRef = useRef(onRoute);
  useEffect(() => { onRouteRef.current = onRoute; });
  const routed = useRef("");
  useEffect(() => {
    const route = plan[step.index];
    if (!route || ORDER[step.phase] < ORDER.dispatch || step.phase === "done") return;
    const key = `${step.cycle}:${step.index}`;
    if (routed.current === key) return;
    routed.current = key;
    onRouteRef.current?.({ index: route.index, token: route.token, scores: route.scores, experts: route.experts, weights: route.weights, dropped: route.dropped });
  }, [step, plan]);

  const restart = () => {
    clock.current = { t: 0, index: 0, phase: "enter", cycle: clock.current.cycle + 1 };
    setStep({ index: 0, phase: "enter", cycle: clock.current.cycle });
  };

  // What the stage shows: the live step, or a still of the inspected token with every part of its route lit.
  const ord = ORDER[step.phase];
  const done = step.phase === "done";
  const current = plan[step.index] as PlannedRoute | undefined;
  const previous = step.index > 0 ? plan[step.index - 1] : undefined;
  const inspectedToken = inspect?.kind === "token" ? plan[inspect.index] : undefined;
  const inspectedExpert = inspect?.kind === "expert" ? inspect.index : null;

  const liveLoads = done ? plan[n - 1]?.loads ?? zeros : ord >= ORDER.expert ? current?.loads ?? zeros : previous?.loads ?? zeros;
  /** Inspecting a token scrubs the counters to the moment it was routed. */
  const shownLoads = inspectedToken ? inspectedToken.loads : liveLoads;
  const view = inspectedToken
    ? { bars: inspectedToken, barsLive: true, gates: inspectedToken, curves: inspectedToken, lit: inspectedToken, input: inspectedToken.index, inputSpent: false, output: inspectedToken.index }
    : {
      bars: done ? plan[n - 1] : ord >= ORDER.gate ? current : previous,
      barsLive: !done && ord >= ORDER.gate,
      gates: !done && inspectedExpert === null && ord >= ORDER.dispatch && ord <= ORDER.expert ? current : undefined,
      curves: !done && inspectedExpert === null && ord === ORDER.merge ? current : undefined,
      lit: !done && inspectedExpert === null && ord >= ORDER.expert ? current : undefined,
      input: done || !current ? null : step.index,
      inputSpent: ord >= ORDER.gate,
      output: done ? n - 1 : ord >= ORDER.out ? step.index : step.index - 1,
    };
  const rankOf = (route: PlannedRoute | undefined, e: number) => (route ? route.experts.indexOf(e) : -1);

  const active = parameters.shared + k * parameters.perExpert;
  const balance = balanceOf(shownLoads);
  const totalRouted = shownLoads.reduce((a, b) => a + b, 0);

  // Interaction helpers.
  const keyboardFocus = (event: FocusEvent<HTMLElement>) => { try { return event.currentTarget.matches(":focus-visible"); } catch { return true; } };
  const togglePin = (next: Inspect) => {
    const same = pinned && pinned.kind === next.kind && pinned.index === next.index;
    setPinned(same ? null : next);
    const name = next.kind === "token" ? plan[next.index]?.token : experts[next.index]?.name;
    setAnnounce(same ? "Unpinned, routing resumes" : `Pinned ${name}. Press Escape to resume.`);
  };
  const onCardKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape" || !pinned) return;
    setPinned(null);
    setAnnounce("Unpinned, routing resumes");
  };
  const tokenRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const expertRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rove = (event: KeyboardEvent<HTMLButtonElement>, index: number, total: number, refs: (HTMLButtonElement | null)[], set: (i: number) => void) => {
    const last = total - 1;
    const to = event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(last, index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(0, index - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (to < 0) return;
    event.preventDefault();
    set(to);
    refs[to]?.focus();
  };

  const togglePlay = () => {
    if (ended) { restart(); setPaused(false); setPinned(null); setAnnounce("Routing again from the first token"); return; }
    if (pinned) { setPinned(null); setPaused(false); setAnnounce("Routing resumes"); return; }
    setPaused(!paused);
    setAnnounce(paused ? "Routing resumes" : "Paused");
  };
  const playLabel = ended ? "Route again" : paused || pinned ? "Play" : "Pause";

  const changeK = (value: string) => {
    const next = value === "1" ? 1 : 2;
    if (next === k) return;
    setK(next);
    setAnnounce(`Top ${next}: ${parameters.shared + next * parameters.perExpert}B of ${parameters.total}B parameters active per token`);
  };

  // Reserve the stage before it is measured.
  const stageStyle = { "--moe-wide-h": `${wideHeight(count)}px`, "--moe-narrow-h": `${narrowHeight()}px`, ...(geo ? { height: geo.h } : null) } as CSSProperties;
  const motionSet = reduced ? still : swap;

  // Footer copy.
  const nameOf = (e: number) => experts[e]?.name ?? `Expert ${e + 1}`;
  const tokenRef = (text: string) => <span className={styles.tokenRef}>{text}</span>;
  const joinNames = (list: number[]) => list.map(nameOf).join(" and ");
  const sentence = (route: PlannedRoute): { icon?: ReactNode; text: ReactNode } => {
    const kept = route.experts.filter(e => !route.dropped.includes(e));
    if (route.dropped.length && kept.length) return { icon: <TriangleAlert size={14} strokeWidth={1.75} className={styles.warnIcon} aria-hidden="true" />, text: <>{joinNames(route.dropped)} is at capacity, so only {nameOf(kept[0])} processes {tokenRef(route.token)}.</> };
    if (route.dropped.length) return { icon: <TriangleAlert size={14} strokeWidth={1.75} className={styles.warnIcon} aria-hidden="true" />, text: <>{joinNames(route.dropped)} is at capacity, so {tokenRef(route.token)} passes through unchanged.</> };
    if (route.experts.length === 1) return { text: <>{nameOf(route.experts[0])} processes {tokenRef(route.token)} alone. The other {count - 1} experts stay idle.</> };
    return { text: <>{joinNames(route.experts)} process {tokenRef(route.token)}. Their outputs blend {route.weights.map(w => Math.round(w * 100)).join(" to ")}.</> };
  };

  let lineKey: string;
  let line: ReactNode;
  let note: { icon?: ReactNode; text: ReactNode };
  const focusRoute = inspectedToken ?? (!done && ord >= ORDER.gate ? current : undefined);
  if (n === 0) {
    lineKey = "empty";
    line = <span className={styles.lineMuted}>No tokens yet</span>;
    note = { text: "Pass tokens to see how the gate routes them." };
  } else if (inspectedExpert !== null) {
    const ex = experts[inspectedExpert];
    const load = shownLoads[inspectedExpert] ?? 0;
    lineKey = `expert-${inspectedExpert}`;
    line = <>
      <span className={styles.lineIcon}>{ex?.icon ?? initialOf(ex?.name ?? "")}</span>
      <span className={styles.lineName}>{nameOf(inspectedExpert)}</span>
      <span className={styles.lineMeta}>{Number.isFinite(capacity) ? `${load} of ${capacity} tokens` : `${load} ${load === 1 ? "token" : "tokens"}`}</span>
    </>;
    const full = Number.isFinite(capacity) && load >= capacity;
    note = { text: <>{ex?.handles ? `Tends to handle ${ex.handles.charAt(0).toLowerCase()}${ex.handles.slice(1)}.` : `Takes whatever the gate sends it.`}{full ? " It is full, so later tokens skip it." : ""}</> };
  } else if (done && !inspectedToken) {
    lineKey = `done-${k}`;
    line = <><CircleCheck size={14} strokeWidth={1.75} className={styles.okIcon} aria-hidden="true" /><span className={styles.lineName}>Routed {n} {n === 1 ? "token" : "tokens"}</span></>;
    note = { text: <>Each token used {k} of {count} experts, so only {active}B of {parameters.total}B parameters ran.</> };
  } else if (focusRoute) {
    lineKey = `route-${focusRoute.index}-${k}-${inspectedToken ? "still" : step.cycle}`;
    line = <>
      <span className={styles.lineChip}>{focusRoute.token}</span>
      <ArrowRight size={14} strokeWidth={1.75} className={styles.lineArrow} aria-hidden="true" />
      {focusRoute.experts.map((e, r) => {
        const dropped = focusRoute.dropped.includes(e);
        return <span key={e} className={styles.pick} data-rank={r} data-dropped={dropped || undefined}>
          {dropped ? <TriangleAlert size={12} strokeWidth={1.75} className={styles.warnIcon} aria-hidden="true" /> : <span className={styles.swatch} aria-hidden="true" />}
          <span className={styles.pickName}>{nameOf(e)}</span>
          <span className={styles.pickValue}>{dropped ? "full" : pct(focusRoute.weights[r])}</span>
        </span>;
      })}
    </>;
    note = sentence(focusRoute);
  } else {
    lineKey = `scoring-${step.index}-${step.cycle}`;
    line = <>
      {current && <span className={styles.lineChip}>{current.token}</span>}
      <ArrowRight size={14} strokeWidth={1.75} className={styles.lineArrow} aria-hidden="true" />
      <TextShimmer className={styles.lineShimmer} active={!paused}>{`Scoring ${count} experts`}</TextShimmer>
    </>;
    note = { text: <>The gate scores every expert. The top {k} {k === 1 ? "takes" : "take"} the token.</> };
  }

  return <div ref={rootRef} className={`${styles.root} ${className ?? ""}`} style={style}>
    <div className={styles.card} role="group" aria-label={label} onKeyDown={onCardKey} data-inspect={inspect ? inspect.kind : undefined} data-reduced={reduced || undefined}>
      <div className={styles.header}>
        <SegmentedControl label="Experts per token" options={[{ value: "1", label: "Top 1" }, { value: "2", label: "Top 2" }]} value={String(k)} onValueChange={changeK} />
        <p className={styles.params}>
          <span className={styles.paramsLabel}>Active parameters</span>
          <span className={styles.paramsValue}><Roll value={active} reduced={reduced} />B</span>
          <span className={styles.paramsLabel}>of {parameters.total}B</span>
          <span className={styles.srOnly}>{active}B of {parameters.total}B parameters active per token</span>
        </p>
        <Tooltip content={playLabel}>
          <button type="button" className={styles.play} aria-label={playLabel} onClick={togglePlay} disabled={n === 0}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={playLabel} className={styles.playIcon} {...motionSet}>
                {ended ? <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> : playLabel === "Play" ? <Play size={14} strokeWidth={1.75} aria-hidden="true" /> : <Pause size={14} strokeWidth={1.75} aria-hidden="true" />}
              </motion.span>
            </AnimatePresence>
          </button>
        </Tooltip>
      </div>

      <div ref={stageRef} className={styles.stage} style={stageStyle} data-ready={geo ? "" : undefined} data-layout={geo ? (geo.wide ? "wide" : "narrow") : undefined}>
        {geo && <>
          <svg className={styles.lines} width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
            <path className={styles.flow} d={geo.inSeg.d} data-on={view.input !== null && !view.inputSpent ? "" : undefined} />
            {geo.gates.map((seg, e) => {
              const r = rankOf(view.gates, e);
              return <path key={e} className={styles.gate} d={seg.d} data-rank={r >= 0 ? r : undefined} data-dropped={r >= 0 && view.gates?.dropped.includes(e) ? "" : undefined} />;
            })}
            {geo.curves.map((seg, e) => {
              const r = rankOf(view.curves, e);
              const dropped = !!view.curves?.dropped.includes(e);
              return <path key={e} className={styles.curve} d={seg.d} data-rank={r >= 0 && !dropped ? r : undefined} />;
            })}
            <path className={styles.flow} d={geo.outSeg.d} />
            <circle className={styles.joint} cx={geo.merge.x} cy={geo.merge.y} r={2.5} />
          </svg>

          {geo.labels.map(l => <span key={l.text} className={styles.stageLabel} data-align={l.align} style={{ left: l.x, top: l.y }}>{l.text}</span>)}

          <div className={styles.router} style={box(geo.router)} data-live={view.barsLive ? "" : undefined} aria-hidden="true" />
          {geo.tracks.map((track, e) => {
            const score = view.bars?.scores[e] ?? 0;
            const r = view.barsLive ? rankOf(view.bars, e) : -1;
            return <span key={e} className={styles.track} style={box(track)} data-rank={r >= 0 ? r : undefined} data-live={view.barsLive ? "" : undefined} aria-hidden="true">
              <span className={styles.fill} style={{ "--s": view.bars ? score : 0 } as CSSProperties} />
            </span>;
          })}
          {geo.scores.map((slot, e) => {
            const r = view.barsLive ? rankOf(view.bars, e) : -1;
            return <span key={e} className={styles.score} style={box(slot)} data-rank={r >= 0 ? r : undefined} data-live={view.barsLive ? "" : undefined} aria-hidden="true">{view.bars ? pct(view.bars.scores[e] ?? 0) : "0%"}</span>;
          })}

          <div className={styles.tiles} role="group" aria-label="Experts">
            {geo.tiles.map((tile, e) => {
              const ex = experts[e];
              const r = rankOf(view.lit, e);
              const dropped = r >= 0 && !!view.lit?.dropped.includes(e);
              const load = shownLoads[e] ?? 0;
              const full = Number.isFinite(capacity) && load >= capacity;
              return <button
                key={e}
                ref={node => { expertRefs.current[e] = node; }}
                type="button"
                className={styles.tile}
                style={{ ...box(tile), "--g": Number.isFinite(capacity) ? Math.min(1, load / capacity) : 0 } as CSSProperties}
                data-rank={r >= 0 && !dropped ? r : undefined}
                data-dropped={dropped || undefined}
                data-full={full || undefined}
                data-inspect={inspectedExpert === e || undefined}
                data-pinned={pinned?.kind === "expert" && pinned.index === e ? "" : undefined}
                tabIndex={e === expertCursor ? 0 : -1}
                aria-pressed={pinned?.kind === "expert" && pinned.index === e}
                aria-label={`${nameOf(e)} expert, ${load} ${load === 1 ? "token" : "tokens"}${full ? ", at capacity" : ""}${r >= 0 ? `, ${dropped ? "skipped" : `${RANK_LABEL[r]} choice`} for ${view.lit?.token}` : ""}`}
                onPointerEnter={event => { if (event.pointerType === "mouse") setHover({ kind: "expert", index: e }); }}
                onPointerLeave={() => setHover(null)}
                onFocus={event => { setExpertCursor(e); if (keyboardFocus(event)) setFocused({ kind: "expert", index: e }); }}
                onBlur={() => setFocused(null)}
                onKeyDown={event => rove(event, e, count, expertRefs.current, setExpertCursor)}
                onClick={() => togglePin({ kind: "expert", index: e })}
              >
                <span className={styles.gauge} aria-hidden="true" />
                <span className={styles.tileIcon} aria-hidden="true">{dropped ? <TriangleAlert size={14} strokeWidth={1.75} /> : ex?.icon ?? initialOf(ex?.name ?? "")}</span>
                <span className={styles.tileName}>{nameOf(e)}</span>
                <span className={styles.tileCount}><Roll value={load} reduced={reduced} /></span>
              </button>;
            })}
          </div>

          <div className={styles.slot} data-side="in" style={box(geo.intake)}>
            <AnimatePresence initial={false}>
              {view.input !== null && plan[view.input] && <motion.span
                key={`in-${view.input}-${inspectedToken ? "still" : step.cycle}`}
                className={styles.chip}
                data-spent={view.inputSpent || undefined}
                initial={reduced ? { opacity: 0 } : geo.wide ? { opacity: 0, x: -14 } : { opacity: 0, y: -8 }}
                animate={{ opacity: 1, x: 0, y: 0, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] } }}
                exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}
              >{plan[view.input].token}</motion.span>}
            </AnimatePresence>
            {n === 0 && <span className={styles.chip} data-empty="">Empty</span>}
          </div>
          <div className={styles.slot} data-side="out" style={box(geo.output)}>
            <AnimatePresence initial={false}>
              {view.output >= 0 && plan[view.output] && <motion.span
                key={`out-${view.output}-${inspectedToken ? "still" : step.cycle}`}
                className={styles.chip}
                data-out=""
                data-pass={plan[view.output].dropped.length === plan[view.output].experts.length || undefined}
                initial={reduced ? { opacity: 0 } : geo.wide ? { opacity: 0, x: -10 } : { opacity: 0, y: -6 }}
                animate={{ opacity: 1, x: 0, y: 0, transition: reduced ? { duration: 0 } : { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] } }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : geo.wide ? { opacity: 0, x: 10, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } } : { opacity: 0, y: 6, transition: { duration: motionTokens.duration.fast } }}
              >
                <span className={styles.chipDots} aria-hidden="true">
                  {plan[view.output].experts.map((e, r) => plan[view.output].dropped.includes(e) ? null : <i key={e} data-rank={r} />)}
                </span>
                {plan[view.output].token}
              </motion.span>}
            </AnimatePresence>
          </div>

          <svg className={styles.packets} width={geo.w} height={geo.h} viewBox={`0 0 ${geo.w} ${geo.h}`} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map(i => <g key={i} ref={node => { packetRefs.current[i] = node; }} className={styles.packet} data-slot={i === 0 || i === 5 ? "flow" : (i - 1) % 2} style={{ opacity: 0 }}>
              <path className={styles.trailLong} />
              <path className={styles.trailShort} />
              <circle className={styles.dot} r={3.5} />
            </g>)}
          </svg>
        </>}
      </div>

      <div className={styles.sequence} role="group" aria-label="Tokens. Hover, focus or select one to see its route.">
        {plan.map((route, i) => {
          const state = done || i < step.index || (i === step.index && ord >= ORDER.out) ? "done" : i === step.index ? "current" : "next";
          const r = inspectedExpert !== null ? route.experts.indexOf(inspectedExpert) : -1;
          const isPinned = pinned?.kind === "token" && pinned.index === i;
          return <button
            key={i}
            ref={node => { tokenRefs.current[i] = node; }}
            type="button"
            className={styles.token}
            data-state={state}
            data-inspect={inspectedToken?.index === i || undefined}
            data-rank={r >= 0 && !route.dropped.includes(inspectedExpert ?? -1) ? r : undefined}
            data-dropped={r >= 0 && route.dropped.includes(inspectedExpert ?? -1) ? "" : undefined}
            data-fade={inspectedExpert !== null && r < 0 ? "" : undefined}
            tabIndex={i === tokenCursor ? 0 : -1}
            aria-pressed={isPinned}
            aria-label={`${route.token}: ${route.experts.map((e, j) => `${nameOf(e)} ${route.dropped.includes(e) ? "skipped, at capacity" : pct(route.weights[j])}`).join(", ")}`}
            onPointerEnter={event => { if (event.pointerType === "mouse") setHover({ kind: "token", index: i }); }}
            onPointerLeave={() => setHover(null)}
            onFocus={event => { setTokenCursor(i); if (keyboardFocus(event)) setFocused({ kind: "token", index: i }); }}
            onBlur={() => setFocused(null)}
            onKeyDown={event => rove(event, i, n, tokenRefs.current, setTokenCursor)}
            onClick={() => togglePin({ kind: "token", index: i })}
          >{route.token}</button>;
        })}
        {n === 0 && <span className={styles.sequenceEmpty}>No tokens to route</span>}
      </div>

      <div className={styles.footer}>
        <div className={styles.inspector}>
          <div className={styles.line}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div key={lineKey} className={styles.lineInner} {...motionSet}>{line}</motion.div>
            </AnimatePresence>
          </div>
          <div className={styles.note}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.p key={`${lineKey}-note`} className={styles.noteInner} {...motionSet}>
                {note.icon}<span>{note.text}</span>
              </motion.p>
            </AnimatePresence>
          </div>
        </div>
        <div className={styles.load}>
          <div className={styles.loadHead}>
            <span>Load balance</span>
            <span className={styles.loadValue}>{balance === null ? <span className={styles.lineMuted}>No routes yet</span> : <><Roll value={balance * 100} reduced={reduced} />%</>}</span>
          </div>
          <div className={styles.loadBar} aria-hidden="true" data-empty={totalRouted === 0 || undefined}>
            {shownLoads.map((load, e) => {
              const r = rankOf(view.lit, e);
              return <span
                key={e}
                className={styles.seg}
                style={{ flexGrow: load }}
                data-zero={load === 0 || undefined}
                data-rank={r >= 0 && !view.lit?.dropped.includes(e) ? r : undefined}
                data-inspect={inspectedExpert === e || undefined}
                onPointerEnter={event => { if (event.pointerType === "mouse") setHover({ kind: "expert", index: e }); }}
                onPointerLeave={() => setHover(null)}
              />;
            })}
          </div>
          <span className={styles.srOnly}>{balance === null ? "No routes yet" : `Load balance ${Math.round(balance * 100)} percent across ${count} experts, ${totalRouted} routes`}</span>
        </div>
      </div>
      <span className={styles.srOnly} role="status" aria-live="polite">{announce}</span>
    </div>
  </div>;
}

export default MixtureOfExperts;
