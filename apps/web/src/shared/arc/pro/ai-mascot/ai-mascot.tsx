"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import {
  BODY_PATH, COMPACT, FULL, STAR_PATH, STATUS_LABEL,
  easeInOutCubic, errorShake, frameAttrs, mixPose, poseFor,
  type FrameAttrs, type Geometry, type MascotStatus, type Pose,
} from "./ai-mascot-pose";
import styles from "./ai-mascot.module.css";

export type { MascotStatus } from "./ai-mascot-pose";
export { MASCOT_STATUSES, STATUS_LABEL as MASCOT_STATUS_LABEL } from "./ai-mascot-pose";

export type MascotTone = "accent" | "ink" | "soft";

export interface AiMascotProps {
  /** What the assistant is doing. Leave unset to play through every state on a loop. */
  status?: MascotStatus;
  /** Rendered width and height in px, from 24 (inline next to a message) to 160 (empty state). Below 56 the mascot switches to a compact drawing with bolder eyes. */
  size?: number;
  /** Body color from the theme: the accent, the foreground ink, or a soft muted surface. */
  tone?: MascotTone;
  /** Any CSS color for the body. Overrides tone. Pair it with eyeColor when the color is dark. */
  color?: string;
  /** Any CSS color for the eyes and brows. */
  eyeColor?: string;
  /** Eyes follow the pointer while it is over the mascot (true), anywhere on the page ("page"), or never (false). */
  followPointer?: boolean | "page";
  /** The small companion dot that floats, orbits while thinking, writes and turns into a sparkle when done. */
  companion?: boolean;
  /** The soft contact shadow and the writing line under the mascot. Only drawn at 56px and up. */
  ground?: boolean;
  /** Freeze the animation on its current frame. It also pauses by itself off screen and in background tabs. */
  paused?: boolean;
  /** The assistant's name, used in the accessible label: "Atlas, thinking". */
  name?: string;
  /** Overrides the whole accessible label. */
  label?: string;
  /** Announce status changes in a polite live region. Turn on for the one mascot that carries status, not for decorative copies. */
  announce?: boolean;
  /** Called when the self-playing loop (status unset) moves to the next state. */
  onStatusChange?: (status: MascotStatus) => void;
  className?: string;
  style?: CSSProperties;
}

/** The loop used when status is unset: every state, with a second short think that ends in an error. */
const AUTOPLAY: [MascotStatus, number][] = [
  ["idle", 2.6], ["listening", 2.3], ["thinking", 2.6], ["writing", 3.5], ["done", 2.3],
  ["idle", 1.8], ["thinking", 1.7], ["error", 2], ["idle", 1.4],
];

const TRANSITION = .42;
const BLINK = .16;
const LINE_DASH = "9 5.5 4.5 5.5 12 5.5 6 5.5 10 5.5";

const random = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

type From = { kind: "live"; status: MascotStatus; start: number } | { kind: "snap"; pose: Pose };

/**
 * A small assistant character: a soft pebble with pill eyes and a companion dot. It breathes and glances around
 * when idle, leans in to listen, looks up while a dot orbits its head when thinking, reads along a line as it
 * writes, squints happily with a sparkle when done and shakes once with worried brows on an error.
 */
export function AiMascot({
  status,
  size = 96,
  tone = "accent",
  color,
  eyeColor,
  followPointer = true,
  companion = true,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: AiMascotProps) {
  const clipId = `mascot-${useId().replace(/:/g, "")}`;
  const geo: Geometry = size < 56 ? COMPACT : FULL;
  const showGround = ground && !geo.compact;
  const [autoStatus, setAutoStatus] = useState<MascotStatus>(AUTOPLAY[0][0]);
  const shown: MascotStatus = status ?? autoStatus;

  const rootRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const pillRefs = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const arcRefs = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const browsRef = useRef<SVGGElement>(null);
  const dotFrontRef = useRef<SVGCircleElement>(null);
  const dotBackRef = useRef<SVGCircleElement>(null);
  const glintRef = useRef<SVGCircleElement>(null);
  const starRef = useRef<SVGPathElement>(null);
  const star2Ref = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);

  // First paint (and server render) uses the still pose, and the loop eases out of it
  // over one transition instead of cutting to the live pose on its first frame.
  const initialPose = poseFor(shown, { t: 0, te: 10, geo, glance: [0, 0], still: true });
  const initial = frameAttrs(initialPose, [initialPose.gx, initialPose.gy], 1, geo);

  // Latest props for the animation loop, which never re-subscribes.
  const live = useRef({ status, geo, paused, onStatusChange, followPointer });
  useLayoutEffect(() => { live.current = { status, geo, paused, onStatusChange, followPointer }; });
  const runRef = useRef<() => void>(() => {});
  const engine = useRef({
    clock: 0,
    current: { status: shown, start: -10 },
    from: { kind: "snap", pose: initialPose } as From | null,
    transStart: 0,
    pose: initialPose as Pose | null,
    gaze: [initialPose.gx, initialPose.gy] as [number, number],
    velocity: [0, 0] as [number, number],
    blinkAt: 2.2, blinkStart: -1,
    glance: [0, 0] as [number, number], glanceAt: 1.4,
    autoIndex: 0, autoAt: AUTOPLAY[0][1],
    pointer: { active: false, gx: 0, gy: 0, weight: 0 },
    dirty: true,
  });

  const apply = (a: FrameAttrs) => {
    bodyRef.current?.setAttribute("transform", a.body);
    pillRefs.forEach((ref, i) => ref.current?.setAttribute("transform", a.pill[i]));
    arcRefs.forEach((ref, i) => {
      ref.current?.setAttribute("transform", a.arc[i]);
      ref.current?.setAttribute("opacity", a.arcOpacity);
    });
    browsRef.current?.setAttribute("transform", a.brows);
    browsRef.current?.setAttribute("opacity", a.browOpacity);
    const front = dotFrontRef.current;
    if (front) {
      front.setAttribute("cx", a.dotFront.cx); front.setAttribute("cy", a.dotFront.cy);
      front.setAttribute("r", a.dotFront.r); front.setAttribute("opacity", a.dotFront.opacity);
    }
    const glint = glintRef.current;
    if (glint) {
      glint.setAttribute("cx", a.dotFront.cx); glint.setAttribute("cy", a.dotFront.cy);
      glint.setAttribute("r", a.dotFront.r); glint.setAttribute("opacity", a.dotFront.on);
    }
    const back = dotBackRef.current;
    if (back) {
      back.setAttribute("cx", a.dotBack.cx); back.setAttribute("cy", a.dotBack.cy);
      back.setAttribute("r", a.dotBack.r); back.setAttribute("opacity", a.dotBack.opacity);
    }
    starRef.current?.setAttribute("transform", a.star);
    starRef.current?.setAttribute("opacity", a.starOpacity);
    star2Ref.current?.setAttribute("transform", a.star2);
    star2Ref.current?.setAttribute("opacity", a.star2Opacity);
    lineRef.current?.setAttribute("x2", a.line.x2);
    lineRef.current?.setAttribute("opacity", a.line.opacity);
    shadowRef.current?.setAttribute("transform", a.shadow);
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

      if (target !== e.current.status) {
        const blending = e.from !== null && t - e.transStart < TRANSITION;
        e.from = reduced ? null : blending && e.pose ? { kind: "snap", pose: e.pose } : { kind: "live", status: e.current.status, start: e.current.start };
        e.transStart = t;
        e.current = { status: target, start: t };
        e.dirty = true;
      }

      if (reduced) {
        // Still poses only: repaint when the status or drawing changes, never every frame.
        if (!e.dirty) return;
        e.dirty = false;
        const pose = poseFor(e.current.status, { t, te: 10, geo, glance: [0, 0], still: true });
        e.pose = pose;
        e.gaze = [pose.gx, pose.gy];
        applyRef.current(frameAttrs(pose, e.gaze, 1, geo));
        return;
      }

      // Idle glances: quick saccades to a new spot, often back to center.
      if (t >= e.glanceAt) {
        e.glance = Math.random() < .35 ? [0, 0] : [random(-.9, .9), random(-.75, .55)];
        e.glanceAt = t + random(1.1, 3.2);
      }
      // Blinks every few seconds, sometimes twice.
      if (t >= e.blinkAt) {
        e.blinkStart = t;
        e.blinkAt = t + (Math.random() < .2 ? .3 : random(2.4, 5.2));
      }

      const input = { t, te: t - e.current.start, geo, glance: e.glance, still: false };
      let pose = poseFor(e.current.status, input);
      if (e.from) {
        const w = easeInOutCubic(clamp((t - e.transStart) / TRANSITION));
        if (w >= 1) e.from = null;
        else {
          const from = e.from.kind === "live" ? poseFor(e.from.status, { ...input, te: t - e.from.start }) : e.from.pose;
          pose = mixPose(from, pose, w);
        }
      }
      if (e.current.status === "error") {
        const shake = errorShake(t - e.current.start);
        pose = { ...pose, bx: pose.bx + shake, brot: pose.brot + shake * .5 };
      }
      e.pose = pose;

      // Pointer steering eases in and out instead of snapping.
      const p = e.pointer;
      p.weight += ((p.active ? 1 : 0) - p.weight) * (1 - Math.exp(-dt * 10));
      const steer = p.weight * clamp(pose.pointer);
      const tx = pose.gx + (p.gx * geo.gazeX - pose.gx) * steer;
      const ty = pose.gy + (p.gy * geo.gazeY - pose.gy) * steer;

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

      applyRef.current(frameAttrs(pose, e.gaze, open, geo));
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

  // Keep the self-playing loop on the state a caller just released, instead of jumping back to the start, and
  // hold it for a short beat so releasing never cuts straight to the next state.
  const [lastStatus, setLastStatus] = useState(status);
  if (status !== lastStatus) {
    setLastStatus(status);
    if (status !== undefined && AUTOPLAY.some(([s]) => s === status)) setAutoStatus(status);
  }
  const wasControlled = useRef(status !== undefined);
  useEffect(() => {
    const e = engine.current;
    const released = status === undefined && wasControlled.current;
    wasControlled.current = status !== undefined;
    if (status === undefined) { if (released) e.autoAt = e.clock + Math.min(1.2, AUTOPLAY[e.autoIndex][1]); return; }
    const index = AUTOPLAY.findIndex(([s]) => s === status);
    if (index >= 0) { e.autoIndex = index; e.autoAt = e.clock + AUTOPLAY[index][1]; }
  }, [status]);

  // Pointer following.
  const aim = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const [vx, vy, vw] = live.current.geo.view.split(" ").map(Number);
    const cx = rect.left + ((60 - vx) / vw) * rect.width;
    const cy = rect.top + ((62 - vy) / vw) * rect.height;
    const reach = Math.max(rect.width, 40) * .7;
    const nx = (clientX - cx) / reach;
    const ny = (clientY - cy) / reach;
    const p = engine.current.pointer;
    p.gx = clamp((nx / Math.sqrt(1 + nx * nx)) * 1.3, -1, 1);
    p.gy = clamp((ny / Math.sqrt(1 + ny * ny)) * 1.3, -1, 1);
    p.active = true;
  };
  useEffect(() => {
    if (followPointer !== "page" || reduced) return;
    const pointer = engine.current.pointer;
    const move = (event: PointerEvent) => { if (event.pointerType !== "touch") aim(event.clientX, event.clientY); };
    const leave = () => { pointer.active = false; };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      pointer.active = false;
    };
    // aim only reads refs.
  }, [followPointer, reduced]);
  const hoverFollow = followPointer === true && !reduced;
  const onPointerMove = (event: ReactPointerEvent) => { if (hoverFollow && event.pointerType !== "touch") aim(event.clientX, event.clientY); };
  const onPointerLeave = () => { if (followPointer !== "page") engine.current.pointer.active = false; };

  const accessibleLabel = label ?? `${name}, ${STATUS_LABEL[shown].toLowerCase()}`;
  const vars = {
    width: size, height: size,
    ...(color ? { "--mascot-body": color } : null),
    ...(eyeColor ? { "--mascot-eye": eyeColor } : null),
    ...style,
  } as CSSProperties;
  const eyeW = geo.eyeW;
  const arcStroke = geo.compact ? 5.4 : 4;
  const browStroke = geo.compact ? 4.4 : 3.2;

  return (
    <span
      ref={rootRef}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-tone={color ? "custom" : tone}
      data-status={shown}
      style={vars}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <svg ref={svgRef} className={styles.svg} viewBox={geo.view} width={size} height={size} role="img" aria-label={accessibleLabel} focusable="false">
        <defs>
          <clipPath id={clipId}><path d={BODY_PATH} /></clipPath>
        </defs>
        {showGround && <ellipse ref={shadowRef} className={styles.ground} cx={0} cy={0} rx={29} ry={3.2} transform={initial.shadow} />}
        {showGround && companion && (
          <line ref={lineRef} className={styles.line} x1={geo.x0} y1={geo.ly} x2={initial.line.x2} y2={geo.ly} strokeWidth={2.6} strokeDasharray={LINE_DASH} opacity={initial.line.opacity} />
        )}
        {companion && <circle ref={dotBackRef} className={styles.dot} cx={initial.dotBack.cx} cy={initial.dotBack.cy} r={initial.dotBack.r} opacity={initial.dotBack.opacity} />}
        <g ref={bodyRef} transform={initial.body}>
          <g clipPath={`url(#${clipId})`}>
            <path className={styles.shade} d={BODY_PATH} />
            <path className={styles.body} d={BODY_PATH} transform="translate(-2.5 -4)" />
          </g>
          {tone === "soft" && !color && <path className={styles.outline} d={BODY_PATH} />}
          <g className={styles.eyes}>
            {[0, 1].map(i => (
              <g key={`pill-${i}`} ref={pillRefs[i]} transform={initial.pill[i]}>
                <line x1={0} y1={-geo.eyeL / 2} x2={0} y2={geo.eyeL / 2} strokeWidth={eyeW} />
              </g>
            ))}
            {[0, 1].map(i => (
              <g key={`arc-${i}`} ref={arcRefs[i]} transform={initial.arc[i]} opacity={initial.arcOpacity}>
                <path d="M-6.5 2.5Q0 -5.5 6.5 2.5" strokeWidth={arcStroke} fill="none" />
              </g>
            ))}
            <g ref={browsRef} transform={initial.brows} opacity={initial.browOpacity}>
              <line x1={40.5} y1={46.5} x2={52} y2={43} strokeWidth={browStroke} />
              <line x1={68} y1={43} x2={79.5} y2={46.5} strokeWidth={browStroke} />
            </g>
          </g>
        </g>
        {companion && (
          <>
            <g opacity={1}>
              <circle ref={dotFrontRef} className={styles.dot} cx={initial.dotFront.cx} cy={initial.dotFront.cy} r={initial.dotFront.r} opacity={initial.dotFront.opacity} />
              {/* Over the body the dot takes the eye color, so it reads as a light crossing the crown. */}
              <circle ref={glintRef} className={styles.glint} cx={initial.dotFront.cx} cy={initial.dotFront.cy} r={initial.dotFront.r} opacity={initial.dotFront.on} />
            </g>
            <path ref={starRef} className={styles.dot} d={STAR_PATH} transform={initial.star} opacity={initial.starOpacity} />
            {!geo.compact && <path ref={star2Ref} className={styles.dot} d={STAR_PATH} transform={initial.star2} opacity={initial.star2Opacity} />}
          </>
        )}
      </svg>
      {announce && <span className={styles.srOnly} aria-live="polite">{accessibleLabel}</span>}
    </span>
  );
}

export default AiMascot;
