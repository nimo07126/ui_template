"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./ticket-tear.module.css";

/**
 * An event ticket with a perforated stub. Pull the stub down or away and the paper rips along the dotted line from the
 * top, hole by hole, with ragged, fibrous edges on both sides and the loose flap springing away from the tear. Tear it all
 * the way, or flick it, and the rip races to the bottom and the stub peels off with a spin. Enter or Space tears it for keyboard users. Use it for check-in, redeeming a pass,
 * or confirming entry to an event.
 */
export interface TicketTearProps {
  /** The main ticket body. */
  children: ReactNode;
  /** The stub on the right of the perforation. */
  stub: ReactNode;
  /** Controlled torn state. Setting it back to false puts a fresh stub on. */
  torn?: boolean;
  /** Initial state when uncontrolled. */
  defaultTorn?: boolean;
  /** Called once the stub is off, and with false when it is restored through the controlled prop. */
  onTornChange?: (torn: boolean) => void;
  /** Stub width in px. Defaults to 104. */
  stubWidth?: number;
  /** Accessible name of the stub control. Defaults to "Tear off stub". */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Phase = "attached" | "falling" | "torn";

/** Stub paper overlaps the body by this much so the seam is invisible until it tears. */
const PAD = 5;
const HOLE = 10;
const NOTCH = 9;

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/** Edge samples per hole. Fine enough for fibers, cheap enough to rebuild every frame. */
const STEPS = 8;
const STEP = HOLE / STEPS;

function hash(k: number, seed: number) {
  const n = Math.sin(k * 12.9898 + seed * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

/** The torn edge: it passes through the center of every hole and wanders between them, coarse and fine at once. */
function tearOffset(y: number) {
  const k = Math.round(y / STEP);
  const phase = ((k % STEPS) + STEPS) % STEPS;
  if (phase === STEPS / 2) return 0;
  const nearHole = Math.abs(phase - STEPS / 2) === 1;
  const coarse = (hash(Math.floor(k / 2), 1) - .5) * 4.4;
  const fine = (hash(k, 2) - .5) * 1.6;
  return nearHole ? fine * .6 : coarse + fine;
}

/** Loose fibers past the edge, pointing away from the paper they came from. Mostly short, now and then a long one. */
function fiber(y: number) {
  const r = hash(Math.round(y / STEP), 3);
  return .5 + r * 1.3 + (r > .86 ? 1.4 : 0);
}

/** Points down the torn edge to the tip of the tear at py. dir > 0 adds fibers to the right, dir < 0 to the left. */
function edgePoints(py: number, x0: number, dir = 0) {
  const points: string[] = [];
  for (let y = 0; y < py; y += STEP) {
    const fade = Math.min(1, (py - y) / 14);
    const x = x0 + (tearOffset(y) + (dir ? dir * fiber(y) : 0)) * fade;
    points.push(`${x.toFixed(2)}px ${y.toFixed(2)}px`);
  }
  points.push(`${x0}px ${py.toFixed(2)}px`);
  return points;
}

export function TicketTear({ children, stub, torn: tornProp, defaultTorn = false, onTornChange, stubWidth = 104, label = "Tear off stub", className, style }: TicketTearProps) {
  const reduced = useReducedFlag();
  const [inner, setInner] = useState(defaultTorn);
  const controlled = tornProp !== undefined;
  const torn = controlled ? tornProp : inner;
  const [phase, setPhase] = useState<Phase>(torn ? "torn" : "attached");
  const [height, setHeight] = useState(0);
  const [bodyWidth, setBodyWidth] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; t0: number; samples: { x: number; y: number; t: number }[] } | null>(null);
  const phaseRef = useRef(phase);
  useLayoutEffect(() => { phaseRef.current = phase; }, [phase]);
  const running = useRef<AnimationPlaybackControls[]>([]);
  const lastHole = useRef(0);
  const cb = useRef(onTornChange);
  useLayoutEffect(() => { cb.current = onTornChange; });

  const progress = useMotionValue(torn ? 1 : 0);
  // Where the flap wants to be; the spring gives it the weight and give of paper.
  const bend = useMotionValue(0);
  const skew = useSpring(bend, { stiffness: 620, damping: 28, mass: .5 });
  const fallX = useMotionValue(0), fallY = useMotionValue(0), fallRotate = useMotionValue(0), fallOpacity = useMotionValue(1);
  const enterOpacity = useMotionValue(1), enterX = useMotionValue(0);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => { setHeight(root.offsetHeight); setBodyWidth(root.offsetWidth - stubWidth); };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [stubWidth]);

  const H = Math.max(height, 1);
  const stubW = stubWidth + PAD;
  // Size lives in motion values too, so the clip paths recompute on resize without re-subscribing.
  const size = useMotionValue({ h: 1, w: 0 });
  useLayoutEffect(() => { size.set({ h: H, w: bodyWidth }); }, [H, bodyWidth, size]);
  const pivot = useTransform(() => Math.max(0, Math.min(1, progress.get())) * size.get().h);

  const bodyClip = useTransform(() => {
    const py = pivot.get(), { h, w } = size.get();
    return `polygon(0px 0px, ${edgePoints(py, w).join(", ")}, ${w + PAD}px ${py.toFixed(2)}px, ${w + PAD}px ${h}px, 0px ${h}px)`;
  });
  const bodyRimClip = useTransform(() => {
    const py = pivot.get(), { h, w } = size.get();
    return py < .5 ? "polygon(0px 0px, 0px 0px, 0px 0px)" : `polygon(0px 0px, ${edgePoints(py, w, 1).join(", ")}, ${w}px ${py.toFixed(2)}px, ${w}px ${h}px, 0px ${h}px)`;
  });
  const topClip = useTransform(() => {
    const py = pivot.get();
    return py < .5 ? "polygon(0px 0px, 0px 0px, 0px 0px)" : `polygon(${edgePoints(py, PAD).join(", ")}, ${stubW}px ${py.toFixed(2)}px, ${stubW}px 0px)`;
  });
  const bottomClip = useTransform(() => {
    const py = Math.max(0, pivot.get() - .5), { h } = size.get();
    return `polygon(0px ${py.toFixed(2)}px, ${stubW}px ${py.toFixed(2)}px, ${stubW}px ${h}px, 0px ${h}px)`;
  });
  const topRimClip = useTransform(() => {
    const py = pivot.get();
    return py < .5 ? "polygon(0px 0px, 0px 0px, 0px 0px)" : `polygon(${edgePoints(py, PAD, -1).join(", ")}, ${stubW}px ${py.toFixed(2)}px, ${stubW}px 0px)`;
  });
  const topOrigin = useTransform(() => `${PAD}px ${pivot.get().toFixed(2)}px`);
  const fullClip = `polygon(${edgePoints(H, PAD).join(", ")}, ${stubW}px ${H}px, ${stubW}px 0px)`;
  const fullRimClip = `polygon(${edgePoints(H, PAD, -1).join(", ")}, ${stubW}px ${H}px, ${stubW}px 0px)`;

  const stop = () => { running.current.forEach(control => control.stop()); running.current = []; };

  const feel = (py: number) => {
    const hole = Math.floor(py / HOLE);
    if (hole > lastHole.current) {
      lastHole.current = hole;
      if (typeof navigator !== "undefined" && "vibrate" in navigator && drag.current) navigator.vibrate?.(2);
    }
  };

  const drop = useCallback((vx: number) => {
    stop();
    setPhase("falling");
    const start = skew.get();
    fallX.set(0); fallY.set(0); fallRotate.set(start); fallOpacity.set(1);
    if (reduced) {
      running.current = [animate(fallOpacity, 0, { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard], onComplete: () => setPhase("torn") })];
    } else {
      const spinDir = vx < -200 ? -1 : 1;
      const fling = Math.max(-200, Math.min(200, vx * .12));
      running.current = [
        // Freed, the stub pops up a hair as the tension lets go, then gravity takes it.
        animate(fallY, [0, -6, H * 1.2 + 140], { duration: .58, times: [0, .16, 1], ease: ["easeOut", [.55, 0, .9, .4]] }),
        animate(fallX, 30 + fling, { duration: .58, ease: [.12, .7, .3, 1] }),
        // A spring keeps the spin alive: it overshoots a touch as it falls, like a flicked card.
        animate(fallRotate, start + spinDir * (16 + Math.min(28, Math.abs(vx) * .014)), { type: "spring", stiffness: 210, damping: 18, velocity: spinDir * 140 }),
        animate(fallOpacity, 0, { duration: .18, delay: .24, ease: [...motionTokens.ease.inOut], onComplete: () => setPhase("torn") }),
      ];
    }
    if (!controlled) setInner(true);
    cb.current?.(true);
  }, [H, controlled, fallOpacity, fallRotate, fallX, fallY, reduced, skew]);

  /** Rips the rest of the way on its own, accelerating like a perforation that has started to give, then drops the stub. */
  const tearAll = useCallback((vx = 0, quick = false) => {
    if (phaseRef.current !== "attached") return;
    stop();
    if (reduced) { progress.set(1); drop(vx); return; }
    const remaining = 1 - progress.get();
    const duration = quick ? Math.max(.07, remaining * .14) : Math.max(.12, remaining * .3);
    bend.set(Math.max(bend.get(), quick ? 13 : 11));
    running.current = [
      animate(progress, 1, { duration, ease: quick ? [.25, .5, .6, 1] : [.6, 0, .85, .45], onUpdate: value => feel(value * H), onComplete: () => drop(vx) }),
    ];
  }, [H, bend, drop, progress, reduced]);

  /** Puts a fresh stub on the ticket. */
  const restore = useCallback(() => {
    stop();
    progress.set(0); bend.set(0); skew.jump(0); lastHole.current = 0;
    fallX.set(0); fallY.set(0); fallRotate.set(0); fallOpacity.set(1);
    setPhase("attached");
    if (reduced) { enterOpacity.set(0); running.current = [animate(enterOpacity, 1, { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] })]; return; }
    enterOpacity.set(0); enterX.set(18);
    running.current = [
      animate(enterOpacity, 1, { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.standard] }),
      animate(enterX, 0, motionTokens.spring.morph),
    ];
  }, [bend, enterOpacity, enterX, fallOpacity, fallRotate, fallX, fallY, progress, reduced, skew]);

  // Follow the controlled prop in both directions.
  const wasTorn = useRef(torn);
  useEffect(() => {
    if (wasTorn.current === torn) return;
    wasTorn.current = torn;
    if (torn && phaseRef.current === "attached") tearAll();
    if (!torn && phaseRef.current !== "attached") restore();
  }, [torn, tearAll, restore]);

  useEffect(() => () => stop(), []);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (phase !== "attached" || drag.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    const now = performance.now();
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t0: progress.get(), samples: [{ x: event.clientX, y: event.clientY, t: now }] };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const dx = event.clientX - d.x, dy = event.clientY - d.y;
    d.samples.push({ x: event.clientX, y: event.clientY, t: performance.now() });
    if (d.samples.length > 6) d.samples.shift();
    // Pulling down or away both tear. The paper never heals, so progress only grows.
    const pull = Math.max(0, dy * .85 + dx * .55);
    // The tip of the tear tracks the pointer directly, and paper gives a little faster than the hand moves.
    const next = Math.max(progress.get(), Math.min(1, d.t0 + pull / (H * .7)));
    progress.set(next);
    feel(next * H);
    if (!reduced) bend.set(next > 0 ? Math.max(0, Math.min(18, 3 + next * 8 + Math.max(0, dx) * .06 + Math.max(0, dy) * .016)) : 0);
    if (next >= 1) { drag.current = null; drop(Math.max(0, dx) * 4 + 300); }
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    const first = d.samples[0], lastSample = d.samples[d.samples.length - 1];
    const dt = Math.max(1, lastSample.t - first.t) / 1000;
    const vx = (lastSample.x - first.x) / dt, vy = (lastSample.y - first.y) / dt;
    const moved = Math.hypot(lastSample.x - d.x, lastSample.y - d.y);
    // A flick along the pull finishes the tear.
    if ((vy * .85 + vx * .55) > 500 && progress.get() > .12) { tearAll(vx, true); return; }
    if (moved < 4 && event.pointerType !== "mouse") return;
    // A partial tear stays torn; the flap springs most of the way back and the ticket settles.
    bend.set(reduced ? 0 : progress.get() * 3);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") { event.preventDefault(); tearAll(); }
  };

  const ready = height > 0;

  return <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={{ ...style, ["--stub" as string]: `${stubWidth}px`, ["--pad" as string]: `${PAD}px`, ["--notch" as string]: `${NOTCH}px`, ["--hole" as string]: `${HOLE}px` }} data-phase={phase}>
    <div className={styles.bodyWrap}>
      {!reduced && <motion.div className={`${styles.body} ${styles.rim}`} aria-hidden="true" style={{ clipPath: ready ? bodyRimClip : "polygon(0 0, 0 0, 0 0)" }} />}
      <motion.div className={styles.body} style={{ clipPath: ready ? bodyClip : undefined }}>{children}</motion.div>
    </div>

    {phase === "attached" && <motion.div className={styles.stubWrap} style={{ opacity: enterOpacity, x: enterX }}
      role="button" tabIndex={0} aria-label={label} onKeyDown={onKeyDown}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <motion.div className={styles.stub} style={{ clipPath: ready ? bottomClip : undefined }}>{stub}</motion.div>
      {!reduced && <motion.div className={`${styles.stub} ${styles.rim} ${styles.flap}`} aria-hidden="true" style={{ clipPath: ready ? topRimClip : "polygon(0 0, 0 0, 0 0)", rotate: skew, transformOrigin: topOrigin }} />}
      <motion.div className={`${styles.stub} ${styles.flap}`} aria-hidden="true" style={{ clipPath: ready ? topClip : "polygon(0 0, 0 0, 0 0)", rotate: skew, transformOrigin: topOrigin }}>{stub}</motion.div>
    </motion.div>}

    <span className={styles.status} role="status">{phase === "attached" ? "" : "Stub torn off"}</span>

    {phase === "falling" && <motion.div className={styles.stubWrap} aria-hidden="true" style={{ x: fallX, y: fallY, rotate: fallRotate, opacity: fallOpacity, transformOrigin: `${PAD}px ${H}px`, pointerEvents: "none" }}>
      {!reduced && <div className={`${styles.stub} ${styles.rim}`} style={{ clipPath: fullRimClip }} />}
      <div className={styles.stub} style={{ clipPath: fullClip }}>{stub}</div>
    </motion.div>}
  </div>;
}
