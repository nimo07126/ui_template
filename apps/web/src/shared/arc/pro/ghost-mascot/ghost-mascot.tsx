"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  COMPACT, FULL, GHOST_STATUS_LABEL, PEN_PERIOD, POSES, STAR_PATH, STILL, SWIRL_PATH,
  easeInOutCubic, frameAttrs, mixPose, penGaze,
  type Clocks, type FrameAttrs, type Geometry, type GhostStatus, type Pose,
} from "./ghost-mascot-shape";
import styles from "./ghost-mascot.module.css";

export type { GhostStatus } from "./ghost-mascot-shape";
export { GHOST_STATUSES, GHOST_STATUS_LABEL } from "./ghost-mascot-shape";

export type GhostTone = "accent" | "sheet" | "ink";

export interface GhostMascotProps {
  /** What the assistant is doing. Leave unset to play through every state on a loop. */
  status?: GhostStatus;
  /** Width and height in px, from 24 (inline next to a message) to 160 (empty state). Below 56 a compact drawing with bolder eyes takes over. */
  size?: number;
  /** Sheet color from the theme: the accent, a pale raised surface with a hairline, or the foreground ink. */
  tone?: GhostTone;
  /** Any CSS color for the sheet. Overrides tone. */
  color?: string;
  /** Any CSS color for the eyes. */
  eyeColor?: string;
  /** The soft floating shadow under the ghost. Drawn at 56px and up. */
  ground?: boolean;
  /** Freeze on the current frame. It also pauses by itself off screen and in background tabs. */
  paused?: boolean;
  /** The assistant's name, used in the accessible label: "Atlas, thinking". */
  name?: string;
  /** Overrides the whole accessible label. */
  label?: string;
  /** Announce status changes in a polite live region. Turn on for the one mascot that carries status. */
  announce?: boolean;
  /** Called when the self-playing loop (status unset) moves to the next state. */
  onStatusChange?: (status: GhostStatus) => void;
  className?: string;
  style?: CSSProperties;
}

/** The loop used when status is unset: every state, then a second short think that ends in an error. */
const AUTOPLAY: [GhostStatus, number][] = [
  ["idle", 2.6], ["listening", 2.2], ["thinking", 2.6], ["writing", 3.6], ["done", 2.3],
  ["idle", 1.6], ["thinking", 1.7], ["error", 2.1], ["idle", 1.3],
];

const TRANSITION = .4;
const BLINK = .16;
const SWIRL_PERIOD = 1.7;

const random = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

function stillClocks(status: GhostStatus): Clocks {
  const pose = POSES[status];
  const pen = penGaze(STILL.pen);
  const gaze: [number, number] = [
    pose.gx + (pen[0] - pose.gx) * pose.followPen,
    pose.gy + (pen[1] - pose.gy) * pose.followPen,
  ];
  return { t: 0, ...STILL, sinceError: 10, sinceDone: 10, gaze, open: 1 };
}

/**
 * A floating ghost: a soft sheet with a rippling hem and two simple eyes. It floats and blinks when idle, comes
 * forward with wide eyes to listen, turns translucent and looks up at a small swirl while thinking, writes a line
 * with a tiny pen, squints happily with a sparkle when done, and wobbles once with droopy eyes on an error.
 */
export function GhostMascot({
  status,
  size = 96,
  tone = "accent",
  color,
  eyeColor,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: GhostMascotProps) {
  const id = useId().replace(/:/g, "");
  const clipId = `ghost-clip-${id}`;
  const geo: Geometry = size < 56 ? COMPACT : FULL;
  const showGround = ground && !geo.compact;
  const [autoStatus, setAutoStatus] = useState<GhostStatus>(AUTOPLAY[0][0]);
  const shown: GhostStatus = status ?? autoStatus;

  const rootRef = useRef<HTMLSpanElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const sheetRef = useRef<SVGGElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  // Nodes drawn more than once (the sheet shape, the eyes, the stars), collected after every render.
  const nodes = useRef({ shapes: [] as Element[], eyes: [] as Element[], stars: [] as Element[] });
  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    nodes.current = {
      shapes: [...svg.querySelectorAll("[data-shape]")],
      eyes: [...svg.querySelectorAll("[data-eye]")],
      stars: [...svg.querySelectorAll("[data-star]")],
    };
  });
  const swirlRef = useRef<SVGPathElement>(null);
  const penRef = useRef<SVGGElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const groundRef = useRef<SVGEllipseElement>(null);

  // Latest props for the animation loop, which never re-subscribes.
  const live = useRef({ status, geo, paused, onStatusChange });
  useLayoutEffect(() => { live.current = { status, geo, paused, onStatusChange }; });
  const runRef = useRef<() => void>(() => {});
  const engine = useRef({
    clock: 0,
    current: shown,
    from: null as Pose | null,
    transStart: 0,
    pose: POSES[shown] as Pose,
    float: STILL.float, hem: STILL.hem, hem2: STILL.hem2, swirl: STILL.swirl,
    writeAt: -STILL.pen * PEN_PERIOD, errorAt: -10, doneAt: -10,
    gaze: [...stillClocks(shown).gaze] as [number, number],
    velocity: [0, 0] as [number, number],
    blinkAt: 2.4, blinkStart: -1,
    glance: [0, 0] as [number, number], glanceAt: 1.6,
    autoIndex: 0, autoAt: AUTOPLAY[0][1],
    dirty: true,
  });

  // First paint (and server render) is the still pose, so nothing jumps when the loop takes over.
  const initial = frameAttrs(POSES[shown], stillClocks(shown), geo);

  const apply = (a: FrameAttrs) => {
    bodyRef.current?.setAttribute("transform", a.body);
    sheetRef.current?.setAttribute("opacity", a.opacity);
    const { shapes, eyes, stars } = nodes.current;
    shapes.forEach(node => node.setAttribute("d", a.d));
    eyes.forEach((node, i) => node.setAttribute("d", a.eyes[i]));
    const swirl = swirlRef.current;
    if (swirl) {
      swirl.setAttribute("transform", a.swirl.transform);
      swirl.setAttribute("stroke-dasharray", a.swirl.dash);
      swirl.setAttribute("stroke-dashoffset", a.swirl.offset);
      swirl.setAttribute("opacity", a.swirl.opacity);
    }
    stars.forEach((node, i) => {
      node.setAttribute("transform", a.stars[i].transform);
      node.setAttribute("opacity", a.stars[i].opacity);
    });
    penRef.current?.setAttribute("transform", a.pen.transform);
    penRef.current?.setAttribute("opacity", a.pen.opacity);
    lineRef.current?.setAttribute("d", a.line.d);
    lineRef.current?.setAttribute("opacity", a.line.opacity);
    groundRef.current?.setAttribute("transform", a.ground.transform);
    groundRef.current?.setAttribute("opacity", a.ground.opacity);
  };
  const applyRef = useRef(apply);
  useLayoutEffect(() => { applyRef.current = apply; });

  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  // A size change swaps the drawing; repaint it on the next frame.
  useLayoutEffect(() => { engine.current.dirty = true; }, [geo]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const e = engine.current;
    let frame = 0;
    let last = 0;
    let onScreen = true;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const dt = last ? Math.min(now - last, 50) / 1000 : 0;
      last = now;
      e.clock += dt;
      const t = e.clock;
      const { geo, status: controlled } = live.current;

      // Self-playing loop when status is unset.
      if (controlled === undefined && t >= e.autoAt) {
        e.autoIndex = (e.autoIndex + 1) % AUTOPLAY.length;
        const [next, duration] = AUTOPLAY[e.autoIndex];
        e.autoAt = t + duration;
        setAutoStatus(next);
        live.current.onStatusChange?.(next);
      }
      const target = controlled ?? AUTOPLAY[e.autoIndex][0];

      if (target !== e.current) {
        // Blend from the pose on screen, so a change during a blend never snaps back.
        e.from = reduced ? null : e.pose;
        e.transStart = t;
        e.current = target;
        // Restart the line and the sparkle only when they are not already showing, so a quick back and forth never jumps.
        if (target === "writing" && e.pose.pen < .05) e.writeAt = t;
        if (target === "done" && e.pose.star < .05) e.doneAt = t;
        if (target === "error") e.errorAt = t;
        e.dirty = true;
      }

      if (reduced) {
        // Still poses only: repaint when the status or drawing changes, never every frame.
        if (!e.dirty) return;
        e.dirty = false;
        e.pose = POSES[e.current];
        applyRef.current(frameAttrs(e.pose, stillClocks(e.current), geo));
        return;
      }

      let pose = POSES[e.current];
      if (e.from) {
        const w = easeInOutCubic(clamp((t - e.transStart) / TRANSITION));
        if (w >= 1) e.from = null;
        else pose = mixPose(e.from, pose, w);
      }
      e.pose = pose;

      // Rates are integrated, so a blended rate changes speed without a jump.
      e.float += dt * pose.floatRate;
      e.hem += dt * pose.hemRate;
      e.hem2 += dt * pose.hemRate * .43;
      e.swirl += dt / SWIRL_PERIOD;
      const pen = (((t - e.writeAt) / PEN_PERIOD) % 1 + 1) % 1;

      // Idle glances: quick saccades to a new spot, often back to center.
      if (t >= e.glanceAt) {
        e.glance = Math.random() < .35 ? [0, 0] : [random(-.85, .85), random(-.6, .45)];
        e.glanceAt = t + random(1.2, 3.2);
      }
      // Blinks every few seconds, sometimes twice.
      if (t >= e.blinkAt) {
        e.blinkStart = t;
        e.blinkAt = t + (Math.random() < .2 ? .32 : random(2.4, 5.2));
      }

      const [pgx, pgy] = penGaze(pen);
      const restX = pose.gx + e.glance[0] * pose.glance;
      const restY = pose.gy + e.glance[1] * pose.glance;
      const tx = restX + (pgx - restX) * clamp(pose.followPen);
      const ty = restY + (pgy - restY) * clamp(pose.followPen);

      // Critically damped spring for the eyes, in small steps so stiff saccades stay stable.
      const k = pose.gk;
      const damping = 2 * Math.sqrt(k);
      const steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        e.velocity[0] += (k * (tx - e.gaze[0]) - damping * e.velocity[0]) * h;
        e.velocity[1] += (k * (ty - e.gaze[1]) - damping * e.velocity[1]) * h;
        e.gaze[0] += e.velocity[0] * h;
        e.gaze[1] += e.velocity[1] * h;
      }

      const sinceBlink = t - e.blinkStart;
      let shut = 0;
      if (sinceBlink >= 0 && sinceBlink < BLINK) shut = sinceBlink < .06 ? Math.sin((sinceBlink / .06) * Math.PI / 2) : Math.cos(((sinceBlink - .06) / (BLINK - .06)) * Math.PI / 2);
      const open = 1 - shut * clamp(pose.blinkable);

      applyRef.current(frameAttrs(pose, {
        t, float: e.float, hem: e.hem, hem2: e.hem2,
        swirl: e.swirl % 1, pen,
        sinceError: t - e.errorAt, sinceDone: t - e.doneAt,
        gaze: e.gaze, open,
      }, geo));
    };

    const run = () => {
      const should = onScreen && !live.current.paused && document.visibilityState === "visible";
      if (should && !frame) { last = 0; frame = requestAnimationFrame(tick); }
      if (!should && frame) { cancelAnimationFrame(frame); frame = 0; }
    };
    const observer = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; run(); }, { rootMargin: "48px" });
    observer.observe(root);
    document.addEventListener("visibilitychange", run);
    runRef.current = run;
    run();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", run);
      cancelAnimationFrame(frame);
      frame = 0;
      runRef.current = () => {};
    };
  }, [reduced]);

  useEffect(() => { runRef.current(); }, [paused]);

  // Keep the self-playing loop on the state a caller just released, instead of jumping back to the start.
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status !== undefined) setAutoStatus(status);
  }
  useEffect(() => {
    if (status === undefined) return;
    const e = engine.current;
    const index = AUTOPLAY.findIndex(([s]) => s === status);
    if (index >= 0) { e.autoIndex = index; e.autoAt = e.clock + AUTOPLAY[index][1]; }
  }, [status]);

  const accessibleLabel = label ?? `${name}, ${GHOST_STATUS_LABEL[shown].toLowerCase()}`;
  const vars = {
    width: size, height: size,
    ...(color ? { "--ghost-body": color } : null),
    ...(eyeColor ? { "--ghost-eye": eyeColor } : null),
    ...style,
  } as CSSProperties;
  const outlined = tone === "sheet" && !color;
  const nib = geo.penStroke * .5;

  return (
    <span
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-tone={color ? "custom" : tone}
      data-status={shown}
      style={vars}
    >
      <svg ref={svgRef} className={styles.svg} viewBox={geo.view} width={size} height={size} role="img" aria-label={accessibleLabel} focusable="false">
        <defs>
          <clipPath id={clipId}><path data-shape d={initial.d} /></clipPath>
        </defs>
        {showGround && <ellipse ref={groundRef} className={styles.ground} cx={0} cy={0} rx={23} ry={3.1} transform={initial.ground.transform} opacity={initial.ground.opacity} />}
        <path
          ref={lineRef} className={styles.line} d={initial.line.d} opacity={initial.line.opacity}
          strokeWidth={geo.lineStroke}
        />
        <g ref={bodyRef} transform={initial.body}>
          <g ref={sheetRef} opacity={initial.opacity}>
            <g clipPath={`url(#${clipId})`}>
              <path data-shape className={styles.shade} d={initial.d} />
              <path data-shape className={styles.body} d={initial.d} transform="translate(-1.8 -3)" />
            </g>
            {outlined && <path data-shape className={styles.outline} d={initial.d} />}
          </g>
          <path data-eye className={styles.eye} d={initial.eyes[0]} />
          <path data-eye className={styles.eye} d={initial.eyes[1]} />
          <path
            ref={swirlRef} className={styles.swirl} d={SWIRL_PATH} pathLength={1}
            strokeWidth={geo.markStroke / geo.markScale}
            transform={initial.swirl.transform} strokeDasharray={initial.swirl.dash}
            strokeDashoffset={initial.swirl.offset} opacity={initial.swirl.opacity}
          />
          <path data-star className={styles.mark} d={STAR_PATH} transform={initial.stars[0].transform} opacity={initial.stars[0].opacity} />
          <path data-star className={styles.mark} d={STAR_PATH} transform={initial.stars[1].transform} opacity={initial.stars[1].opacity} />
        </g>
        <g ref={penRef} className={styles.pen} transform={initial.pen.transform} opacity={initial.pen.opacity}>
          {geo.compact ? (
            <line x1={.6} y1={-1.1} x2={4.9} y2={-9} strokeWidth={geo.penStroke} />
          ) : (
            <>
              <line x1={0} y1={0} x2={1.3} y2={-2.4} strokeWidth={nib} />
              <line x1={2.3} y1={-4.1} x2={6.6} y2={-11.9} strokeWidth={geo.penStroke} />
            </>
          )}
        </g>
      </svg>
      {announce && <span className={styles.srOnly} aria-live="polite">{accessibleLabel}</span>}
    </span>
  );
}

export default GhostMascot;
