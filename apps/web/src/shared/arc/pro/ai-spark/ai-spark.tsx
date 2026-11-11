"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import styles from "./ai-spark.module.css";

export type AiSparkStatus = "idle" | "thinking" | "generating" | "done" | "error";
export type AiSparkTone = "accent" | "foreground" | "muted" | "inherit";
export type AiSparkVariant = "mark" | "pill" | "avatar";

export interface AiSparkProps {
  /** What the AI is doing. Leave it unset and the spark plays through idle, thinking, generating and done on its own. */
  status?: AiSparkStatus;
  /** Size in px, or any CSS length such as "1em". For the mark it is the mark itself, for the avatar the round tile, for the pill the mark inside it. Defaults to 24, 32 for the avatar and 16 in the pill. */
  size?: number | string;
  /** Semantic color of the mark. Defaults to "accent". Error always eases to a muted danger tone. */
  tone?: AiSparkTone;
  /** Any CSS color, overriding `tone`. */
  color?: string;
  /** "mark" renders the spark alone, "pill" pairs it with a status label, "avatar" sets it in a round tile for buttons and message avatars. Defaults to "mark". */
  variant?: AiSparkVariant;
  /** Pill text, overriding the built-in label for the current status, such as "Reading 12 files". */
  label?: string;
  /** Multiplies every loop and spin speed. Defaults to 1. */
  speed?: number;
  /** A very slow breathing twinkle while idle. Turn it off for a fully still idle mark. Defaults to true. */
  twinkle?: boolean;
  /** Freezes the animation in place; resuming continues from the same phase. */
  paused?: boolean;
  /** Announce status changes through a polite live region. Turn it off for decorative copies. Defaults to true. */
  announce?: boolean;
  /** Accessible name; defaults to a phrase for the current status, such as "AI is thinking". */
  "aria-label"?: string;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_LABELS: Record<AiSparkStatus, string> = { idle: "Ready", thinking: "Thinking", generating: "Writing", done: "Done", error: "Couldn't finish" };
const SPOKEN: Record<AiSparkStatus, string> = { idle: "AI ready", thinking: "AI is thinking", generating: "AI is writing", done: "AI finished", error: "AI couldn't finish" };
const TONES: Record<AiSparkTone, string> = { accent: "var(--arc-accent)", foreground: "var(--arc-foreground)", muted: "var(--arc-text-muted)", inherit: "currentColor" };
const AUTOPLAY: [AiSparkStatus, number][] = [["idle", 1600], ["thinking", 2800], ["generating", 3600], ["done", 2000]];

/* ---------- The mark ----------
 * Four primary rays on the axes and four short secondary rays on the diagonals, all detached from the center.
 * Each ray is the tangent hull of two circles: a round inner cap and a smaller round tip, so it tapers outward with
 * perfectly smooth ends. Secondary rays and the core use a lighter tone of the same color, which gives depth without
 * gradients or glows. Proportions are hinted by rendered size: small marks get heavier rays, and under 18px the
 * secondaries collapse to dots so 12px stays a clean, legible sparkle. */

const TAU = Math.PI * 2;
const N = 8;
const G = N * 4; // pose layout: [len, wid, off, op] per ray, then scale, core, particles
const POSE = G + 3;
/** Small per-ray phase offsets, so waves feel drawn by hand instead of stamped. */
const JIT = [0, .021, -.014, .017, -.019, .012, .008, -.016];

const frac = (x: number) => x - Math.floor(x);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** Smooth 0..1..0 over one period. */
const wave = (x: number) => .5 - .5 * Math.cos(TAU * x);
/** A smooth bump over [c, c + w] with zero slope at both ends; 0 elsewhere. */
const bump = (x: number, c: number, w: number) => (x <= c || x >= c + w ? 0 : Math.sin((Math.PI * (x - c)) / w) ** 2);
const easeInOut = (k: number) => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k: number) => 1 - Math.pow(1 - k, 3);

type Geo = {
  p: { r0: number; r1: number; a: number; b: number };
  s: { r0: number; r1: number; a: number; b: number; dot: boolean };
  core: number; particles: boolean; toneB: number;
};

/** Optical hinting: 12px is t = 0, 96px and up is t = 1, interpolated on a log scale. */
function geometry(px: number): Geo {
  const t = clamp01(Math.log(Math.max(1, px) / 12) / Math.log(8));
  const dot = px < 18;
  return {
    p: { r0: lerp(11, 13.5, t), r1: lerp(41.5, 44, t), a: lerp(8.4, 5.6, t), b: lerp(3.9, 1.8, t) },
    s: dot
      ? { r0: 27, r1: 27, a: lerp(5.6, 5, clamp01((px - 12) / 6)), b: 0, dot }
      : { r0: lerp(23.5, 22, t), r1: lerp(32, 36, t), a: lerp(4.9, 3.7, t), b: lerp(2.3, 1.4, t), dot },
    core: px >= 28 ? lerp(2.6, 3.4, t) : 0,
    particles: px >= 40,
    toneB: lerp(.66, .5, t),
  };
}

const fmt = (v: number) => String(Math.round(v * 100) / 100);

/** A ray pointing up from radius r0 to r1: the tangent hull of a circle of radius a at r0 and radius b at r1. */
function rayPath(r0: number, r1: number, a: number, b: number) {
  const d = r1 - r0;
  if (d <= a - b + 1e-3) {
    const y = fmt(-r0), A = fmt(a);
    return `M${A} ${y}A${A} ${A} 0 1 0 -${A} ${y}A${A} ${A} 0 1 0 ${A} ${y}Z`;
  }
  const s = (a - b) / d, c = Math.sqrt(1 - s * s);
  const x1 = fmt(a * c), y1 = fmt(-r0 - a * s), x2 = fmt(b * c), y2 = fmt(-r1 - b * s);
  return `M${x1} ${y1}L${x2} ${y2}A${fmt(b)} ${fmt(b)} 0 0 0 -${x2} ${y2}L-${x1} ${y1}A${fmt(a)} ${fmt(a)} 0 1 0 ${x1} ${y1}Z`;
}

function rayD(geo: Geo, i: number, o: Float32Array) {
  const k = i * 4, len = Math.max(0, o[k]), wid = o[k + 1], off = o[k + 2];
  if (i % 2 === 0) {
    const g = geo.p, r0 = g.r0 + off;
    return rayPath(r0, r0 + (g.r1 - g.r0) * len, g.a * wid, g.b * wid);
  }
  const g = geo.s, r0 = g.r0 + off;
  if (g.dot) { const r = g.a * wid * (.72 + .28 * Math.min(1.3, len)); return rayPath(r0, r0, r, r); }
  return rayPath(r0, r0 + (g.r1 - g.r0) * len, g.a * wid, Math.min(g.a, g.b) * wid);
}

/* ---------- Motion model ----------
 * Each status is a pure, periodic function of time that writes a pose (length, width, radial offset and opacity per
 * ray, plus mark scale, core scale and particle presence), so every loop is seamless. A status change blends the
 * current pose into the next one; an interrupted blend is frozen as the new starting point, so nothing ever cuts or
 * restarts. One-shot gestures (the gather on done, the shake on error) are short impulses added on top that always
 * play out, even when the status changes again mid-gesture. Spin is integrated from a smoothed velocity and, in resting
 * states, glides into the home angle on an ease-out whose speed only falls. */

type Spec = { fill: (t: number, o: Float32Array) => void; spin: number; rest: boolean; loops: boolean };

function put(o: Float32Array, i: number, len: number, wid: number, off: number, op: number) {
  const k = i * 4; o[k] = len; o[k + 1] = wid; o[k + 2] = off; o[k + 3] = op;
}

function makeIdle(twinkle: boolean): Spec {
  return {
    // A breath every 6.4s, and one diagonal at a time softly reaching out as the twinkle travels around the mark.
    fill: (t, o) => {
      for (let i = 0; i < N; i++) {
        if (i % 2 === 0) { put(o, i, 1, 1, 0, 1); continue; }
        const tw = twinkle ? bump(frac(t / 6.4 - (i - 1) / 8 + JIT[i]), 0, .32) : 0;
        put(o, i, 1 + .3 * tw, 1 + .08 * tw, 1 * tw, 1);
      }
      o[G] = twinkle ? 1 + .018 * wave(t / 6.4) : 1; o[G + 1] = twinkle ? 1 + .1 * wave(t / 3.2) : 1; o[G + 2] = 0;
    },
    spin: 0, rest: true, loops: twinkle,
  };
}

const THINKING: Spec = {
  // One crest travels around the ring every 1.9s in the direction of the turn, reaching each ray in sequence.
  // The axes move less than the diagonals, so the mark stays centered while the ripple reads clearly.
  fill: (t, o) => {
    for (let i = 0; i < N; i++) {
      const w = wave(t / 1.9 - i / N + JIT[i]) ** 1.35;
      if (i % 2 === 0) put(o, i, .7 + .3 * w, .94 + .08 * w, -1 + 2 * w, 1);
      else put(o, i, .42 + .78 * w, .88 + .16 * w, -1 + 3 * w, .5 + .5 * w);
    }
    o[G] = .965 + .03 * wave(t / 4); o[G + 1] = .7 + .22 * wave(t); o[G + 2] = 0;
  },
  spin: 26, rest: false, loops: true,
};

/** Lub dub: a strong beat, then a softer echo, then rest, inside one 0..1 period. */
const heart = (x: number) => bump(x, 0, .2) + .62 * bump(x, .2, .22);
const BEAT = 1.04;

const GENERATING: Spec = {
  // A heartbeat every 1.04s: the axes fire in sequence around the ring, the diagonals answer a beat later.
  fill: (t, o) => {
    for (let i = 0; i < N; i++) {
      const p = i >> 1;
      if (i % 2 === 0) { const e = heart(frac(t / BEAT - p * .045 + JIT[i] * .3)); put(o, i, .7 + .32 * e, .96 + .08 * e, .8 * e, 1); }
      else { const e = heart(frac(t / BEAT - .17 - p * .045 + JIT[i] * .3)); put(o, i, .55 + .65 * e, .92 + .12 * e, 2.5 * e, .6 + .4 * e); }
    }
    const h = heart(frac(t / BEAT));
    o[G] = .975 + .035 * h; o[G + 1] = .9 + .5 * heart(frac(t / BEAT - .03)); o[G + 2] = 1;
  },
  spin: 46, rest: false, loops: true,
};

const DONE: Spec = {
  fill: (_t, o) => { for (let i = 0; i < N; i++) put(o, i, 1, 1, 0, 1); o[G] = 1; o[G + 1] = 1; o[G + 2] = 0; },
  spin: 0, rest: true, loops: false,
};

const ERROR: Spec = {
  fill: (_t, o) => {
    for (let i = 0; i < N; i++) { if (i % 2 === 0) put(o, i, .56, .96, -1, 1); else put(o, i, .34, .9, -2, .45); }
    o[G] = .96; o[G + 1] = .8; o[G + 2] = 0;
  },
  spin: 0, rest: true, loops: false,
};

const IDLE_ON = makeIdle(true);
const IDLE_OFF = makeIdle(false);
function specFor(status: AiSparkStatus, twinkle: boolean): Spec {
  switch (status) {
    case "idle": return twinkle ? IDLE_ON : IDLE_OFF;
    case "thinking": return THINKING;
    case "generating": return GENERATING;
    case "done": return DONE;
    default: return ERROR;
  }
}

/** Freezes an interrupted blend at weight e so it becomes the start of the next one. */
function frozenBlend(a: Spec, b: Spec, e: number): Spec {
  const A = new Float32Array(POSE), B = new Float32Array(POSE);
  return {
    fill: (t, o) => { a.fill(t, A); b.fill(t, B); for (let k = 0; k < POSE; k++) o[k] = A[k] + (B[k] - A[k]) * e; },
    spin: b.spin, rest: b.rest, loops: a.loops || b.loops,
  };
}

/** Done: rays draw in toward the center, then ease out to rest. Fast in, slow out, no overshoot. */
function gather(tau: number) {
  if (tau < 0 || tau >= .68) return 0;
  return tau < .17 ? easeOut(tau / .17) : 1 - easeInOut((tau - .17) / .51);
}
/** Error: one small decaying shake. */
function shake(tau: number) {
  if (tau < 0 || tau >= .46) return 0;
  return 3.2 * Math.sin((TAU * tau) / .15) * (1 - tau / .46) ** 2;
}

type Impulse = { kind: "gather" | "shake"; start: number };
type Engine = {
  status: AiSparkStatus; twinkle: boolean;
  from: Spec; to: Spec; mixStart: number; mixDur: number;
  t: number; clock: number; angle: number; vel: number; target: number | null;
  glide: { start: number; from: number; v0: number; distance: number; duration: number };
  impulses: Impulse[]; A: Float32Array; B: Float32Array; out: Float32Array;
  raf: number; last: number; inView: boolean; kick: () => void;
};

function samplePose(from: Spec, to: Spec, k: number, t: number, A: Float32Array, B: Float32Array, out: Float32Array) {
  if (k >= 1) { to.fill(t, out); return; }
  from.fill(t, A);
  to.fill(t, B);
  for (let j = 0; j < POSE; j++) out[j] = A[j] + (B[j] - A[j]) * k;
}

function restPose(status: AiSparkStatus) {
  const out = new Float32Array(POSE);
  specFor(status, false).fill(0, out);
  return out;
}

const subscribeHydration = () => () => {};

/**
 * An animated spark mark that shows an AI at work: a slow breathing twinkle at rest, a traveling ripple while thinking,
 * a heartbeat pulse with orbiting particles while generating, a short gather and settle when done, and one small shake
 * in a muted tone on error. Use `variant="pill"` for a status label or `variant="avatar"` for a round tile.
 */
export function AiSpark({
  status, size, tone = "accent", color, variant = "mark", label, speed = 1, twinkle = true, paused = false,
  announce = true, "aria-label": ariaLabel, className, style,
}: AiSparkProps) {
  const auto = useAutoplay(status === undefined && !paused);
  const current: AiSparkStatus = status ?? auto;
  const pill = variant === "pill";
  const avatar = variant === "avatar";
  const outerSize = size ?? (pill ? 16 : avatar ? 32 : 24);
  const outerDim = typeof outerSize === "number" ? `${outerSize}px` : outerSize;
  const markDim = avatar
    ? typeof outerSize === "number" ? `${Math.round(outerSize * .56)}px` : `calc(${outerSize} * .56)`
    : outerDim;

  const prefersReduced = useReducedMotion();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const reduced = Boolean(hydrated && prefersReduced);

  const rootRef = useRef<HTMLSpanElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const outerRef = useRef<SVGGElement>(null);
  const spinRef = useRef<SVGGElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const rayRefs = useRef<(SVGPathElement | null)[]>([]);
  const dotRefs = useRef<(SVGCircleElement | null)[]>([]);
  const engine = useRef<Engine | null>(null);

  // Rendered pixel size drives the optical hinting. Numbers are known up front; CSS lengths are measured.
  const [measured, setMeasured] = useState<number | null>(null);
  const numericPx = typeof outerSize === "number" ? (avatar ? Math.round(outerSize * .56) : outerSize) : null;
  useLayoutEffect(() => {
    if (numericPx !== null) return;
    const el = svgRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const w = el.getBoundingClientRect().width; if (w > 0) setMeasured(Math.round(w)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [numericPx]);
  const px = numericPx ?? measured ?? 16;
  const geo = useMemo(() => geometry(px), [px]);

  const live = useRef({ geo, speed, reduced, paused, twinkle });
  useLayoutEffect(() => { live.current = { geo, speed, reduced, paused, twinkle }; });

  // The render pass draws the first status at rest so server HTML matches the first frame; the loop owns it after that.
  const [first] = useState(current);
  const firstPose = useMemo(() => restPose(first), [first]);

  // The frame loop: writes a few SVG attributes per frame, never re-renders React, stops when settled or hidden.
  useEffect(() => {
    const spec = specFor(first, live.current.twinkle);
    const s: Engine = engine.current ?? {
      status: first, twinkle: live.current.twinkle, from: spec, to: spec, mixStart: 0, mixDur: 0,
      t: 0, clock: 0, angle: 0, vel: 0, target: null, glide: { start: 0, from: 0, v0: 0, distance: 0, duration: 0 },
      impulses: [], A: new Float32Array(POSE), B: new Float32Array(POSE), out: new Float32Array(POSE),
      raf: 0, last: 0, inView: true, kick: () => {},
    };
    engine.current = s;
    const mixK = () => (s.mixDur <= 0 ? 1 : Math.min(1, (s.clock - s.mixStart) / s.mixDur));

    const draw = () => {
      const { geo: g, reduced: rm } = live.current;
      const o = s.out;
      samplePose(s.from, s.to, easeInOut(mixK()), rm ? 0 : s.t, s.A, s.B, o);

      let dx = 0, scale = o[G], core = o[G + 1];
      if (!rm) {
        for (const imp of s.impulses) {
          const tau = s.clock - imp.start;
          if (imp.kind === "shake") { dx += shake(tau); continue; }
          const k = gather(tau);
          if (k <= 0) continue;
          for (let i = 0; i < N; i++) {
            const j = i * 4, major = i % 2 === 0;
            o[j] *= 1 - (major ? .12 : .2) * k;
            o[j + 2] -= (major ? 2.4 : 3) * k;
          }
          scale *= 1 - .045 * k;
          core *= 1 + .35 * k;
        }
      }

      for (let i = 0; i < N; i++) {
        const el = rayRefs.current[i];
        if (!el) continue;
        el.setAttribute("d", rayD(g, i, o));
        el.setAttribute("opacity", o[i * 4 + 3].toFixed(3));
      }
      coreRef.current?.setAttribute("r", (g.core * Math.max(0, core)).toFixed(2));
      outerRef.current?.setAttribute("transform", `translate(${dx.toFixed(2)} 0) scale(${scale.toFixed(4)})`);
      spinRef.current?.setAttribute("transform", `rotate(${s.angle.toFixed(3)})`);

      // Two particles orbit just outside the rays while generating, each at its own pace and twinkle.
      const part = g.particles && !rm ? o[G + 2] : 0;
      for (let k = 0; k < 2; k++) {
        const el = dotRefs.current[k];
        if (!el) continue;
        if (part < .01) { el.setAttribute("opacity", "0"); continue; }
        const angle = k === 0 ? 30 + (360 * s.t) / 2.6 : 210 + (360 * s.t) / 3.9;
        const twk = .55 + .45 * wave(s.t / 1.3 + k * .5);
        el.setAttribute("transform", `rotate(${(angle % 360).toFixed(2)}) translate(0 -47.5) scale(${(.5 + .5 * part).toFixed(3)})`);
        el.setAttribute("opacity", (part * twk).toFixed(3));
      }
    };

    const step = (now: number) => {
      const { speed: sp, reduced: rm } = live.current;
      const dt = s.last ? Math.min(1 / 30, (now - s.last) / 1000) : 1 / 60;
      s.last = now;
      s.clock += dt;
      if (!rm) s.t += dt * sp;
      if (mixK() >= 1) s.from = s.to;
      s.impulses = s.impulses.filter((imp) => s.clock - imp.start < .7);

      const sym = 90;
      if (rm) {
        s.vel = 0;
        s.angle = Math.round(s.angle / sym) * sym;
      } else if (!s.to.rest) {
        s.target = null;
        s.vel += (s.to.spin * sp - s.vel) * (1 - Math.exp(-dt * 3));
        s.angle += s.vel * dt;
        if (s.angle >= 360) s.angle -= 360;
      } else {
        // Glide into the next home angle with an ease-out whose speed only ever falls, so the mark never whips or backs up.
        if (s.target === null) {
          const v0 = Math.max(0, s.vel);
          s.target = Math.ceil((s.angle + v0 * .2) / sym - 1e-6) * sym;
          const distance = s.target - s.angle;
          s.glide = { start: s.clock, from: s.angle, v0, distance, duration: Math.min(1.8, Math.max(.6, v0 > .5 ? (3 * distance) / v0 : 1.2)) };
        }
        const gl = s.glide;
        const tau = s.clock - gl.start;
        if (gl.distance < .01 || tau >= gl.duration) { s.angle = s.target; s.vel = 0; }
        else {
          const T = gl.duration, D = gl.distance;
          const a = (3 * D - 2 * gl.v0 * T) / (T * T), b = (gl.v0 * T - 2 * D) / (T * T * T);
          s.angle = gl.from + gl.v0 * tau + a * tau * tau + b * tau * tau * tau;
          s.vel = gl.v0 + 2 * a * tau + 3 * b * tau * tau;
        }
      }
      draw();

      const spinDone = rm || (s.to.rest && s.target !== null && s.angle === s.target);
      if (mixK() >= 1 && s.impulses.length === 0 && spinDone && (rm || !s.to.loops)) {
        if (!rm && s.target !== null) { s.angle = s.target % 360; s.target = s.angle; s.vel = 0; draw(); }
        s.raf = 0; s.last = 0;
        return;
      }
      s.raf = requestAnimationFrame(step);
    };

    const stop = () => { if (s.raf) cancelAnimationFrame(s.raf); s.raf = 0; s.last = 0; };
    s.kick = () => {
      if (!s.inView || document.hidden || live.current.paused) { stop(); return; }
      if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(step); }
    };

    const root = rootRef.current;
    const observer = typeof IntersectionObserver !== "undefined" && root
      ? new IntersectionObserver(([entry]) => { s.inView = entry.isIntersecting; s.kick(); }, { rootMargin: "48px" })
      : null;
    if (observer && root) observer.observe(root);
    const onVisibility = () => s.kick();
    document.addEventListener("visibilitychange", onVisibility);
    s.kick();
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [first]);

  // Status, twinkle, pause and size changes. Any change of pose blends from wherever the mark is right now.
  useEffect(() => {
    const s = engine.current;
    if (!s) return;
    if (s.status !== current || s.twinkle !== twinkle) {
      const k = s.mixDur <= 0 ? 1 : Math.min(1, (s.clock - s.mixStart) / s.mixDur);
      s.from = k < 1 ? frozenBlend(s.from, s.to, easeInOut(k)) : s.to;
      s.to = specFor(current, twinkle);
      s.mixStart = s.clock;
      s.mixDur = reduced ? .2 : current === "generating" ? .42 : current === "done" ? .5 : .56;
      if (s.status !== current) {
        s.target = null;
        if (!reduced && current === "done") s.impulses.push({ kind: "gather", start: s.clock });
        if (!reduced && current === "error") s.impulses.push({ kind: "shake", start: s.clock });
      }
      s.status = current;
      s.twinkle = twinkle;
    }
    s.kick();
  }, [current, twinkle, reduced, paused, geo]);

  const busy = current === "thinking" || current === "generating";
  const text = label ?? DEFAULT_LABELS[current];
  const spoken = ariaLabel ?? (pill ? undefined : SPOKEN[current]);
  const vars = { "--spark-color": color ?? TONES[tone], ...(avatar ? { width: outerDim, height: outerDim } : null), ...style } as CSSProperties;

  return (
    <span
      ref={rootRef}
      className={[styles.root, pill ? styles.pill : "", avatar ? styles.avatar : "", className].filter(Boolean).join(" ")}
      data-status={current}
      style={vars}
      role={announce ? "status" : "img"}
      aria-live={announce ? "polite" : undefined}
      aria-busy={busy || undefined}
      aria-label={announce ? undefined : spoken ?? text}
    >
      <svg
        ref={svgRef}
        className={styles.mark}
        viewBox="-50 -50 100 100"
        width={markDim}
        height={markDim}
        aria-hidden="true"
        focusable="false"
        shapeRendering="geometricPrecision"
      >
        <g ref={outerRef}>
          <g ref={spinRef}>
            {Array.from({ length: N }, (_, i) => (
              <path
                key={i}
                ref={(el) => { rayRefs.current[i] = el; }}
                d={rayD(geo, i, firstPose)}
                opacity={firstPose[i * 4 + 3]}
                transform={`rotate(${i * 45})`}
                fill="currentColor"
                fillOpacity={i % 2 === 0 ? 1 : geo.toneB}
              />
            ))}
            <circle ref={coreRef} r={geo.core * firstPose[G + 1]} fill="currentColor" fillOpacity={geo.toneB} />
          </g>
          {[1.9, 1.3].map((r, k) => (
            <circle key={k} ref={(el) => { dotRefs.current[k] = el; }} r={r} opacity={0} fill="currentColor" fillOpacity={k === 0 ? .8 : geo.toneB} />
          ))}
        </g>
      </svg>
      {pill ? <PillLabel text={text} busy={busy} reduced={reduced} /> : announce ? <span className={styles.srOnly}>{spoken}</span> : null}
    </span>
  );
}

/** One crossfade per label change while the pill eases to the new width; the shimmer runs only while busy. */
function PillLabel({ text, busy, reduced }: { text: string; busy: boolean; reduced: boolean }) {
  const boxRef = useRef<HTMLSpanElement>(null);
  const restWidth = useRef(0);

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const sizing = Boolean(box.style.width);
    const from = sizing ? box.getBoundingClientRect().width : restWidth.current;
    box.style.width = "";
    const next = box.getBoundingClientRect().width;
    restWidth.current = next;
    if (reduced || !from || Math.abs(from - next) < .5) return;
    const controls = animate(box, { width: [from, next] }, { type: "spring", visualDuration: .24, bounce: 0, onComplete: () => { box.style.width = ""; } });
    return () => controls.stop();
  }, [text, reduced]);

  return (
    <span ref={boxRef} className={styles.labelBox}>
      <span className={styles.sizer} aria-hidden="true">{text}</span>
      <AnimatePresence initial={false}>
        <motion.span
          key={text}
          className={styles.labelLayer}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? .1 : .16, ease: [.22, 1, .36, 1] } }}
          exit={{ opacity: 0, transition: { duration: .1, ease: "easeOut" } }}
        >
          <TextShimmer active={busy}>{text}</TextShimmer>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Plays idle, thinking, generating and done in a loop when no status is passed. */
function useAutoplay(enabled: boolean): AiSparkStatus {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => setIndex((i) => (i + 1) % AUTOPLAY.length), AUTOPLAY[index][1]);
    return () => window.clearTimeout(id);
  }, [enabled, index]);
  return AUTOPLAY[index][0];
}

export default AiSpark;
