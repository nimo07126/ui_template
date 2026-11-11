"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import styles from "./image-trail.module.css";

export interface ImageTrailImage {
  src: string;
  /** Kept for your own records; trail images are decorative and hidden from assistive tech. */
  alt?: string;
}

/**
 * An area that leaves a trail of photos behind the pointer. Each photo pops in where the pointer is, leans a little toward
 * the direction of travel, drifts on with its momentum, and fades away. Photos appear in order and only after the pointer
 * has travelled a set distance, so a slow pass lays down a tidy sequence rather than a pile. Touch dragging draws a trail too.
 */
export interface ImageTrailProps {
  images: ImageTrailImage[];
  /** Content laid over the trail, such as a headline. */
  children?: ReactNode;
  /** Pointer travel between photos, in px. */
  spacing?: number;
  /** How long a photo stays before it fades, in ms. */
  lifetime?: number;
  /** Photo width in px. */
  size?: number;
  /** Photo width divided by height. */
  aspectRatio?: number;
  /** Largest lean in degrees at full pointer speed. */
  maxTilt?: number;
  /** How many photos can be on screen at once. */
  poolSize?: number;
  /** Plays one short sweep of photos the first time the area scrolls into view, hinting at the effect. Skipped with reduced motion. */
  intro?: boolean;
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** The shared spring curve from the foundation (bounce .15), so each photo lands with a small settle. */
const POP = "linear(0, 0.0258, 0.09, 0.1763, 0.2732, 0.3724, 0.4683, 0.5573, 0.6376, 0.7082, 0.7689, 0.8202, 0.8628, 0.8976, 0.9256, 0.9476, 0.9648, 0.9778, 0.9875, 0.9945, 0.9994, 1.0026, 1.0047, 1.0058, 1.0062, 1.0062, 1.0059, 1.0055, 1.0049, 1.0043, 1.0036, 1.0031, 1.0025, 1.002, 1.0016, 1.0013, 1)";
const ENTER = 520, EXIT = 560;

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function ImageTrail({ images, children, spacing = 90, lifetime = 700, size = 168, aspectRatio = 4 / 5, maxTilt = 10, poolSize = 14, intro = false, disabled = false, className, style }: ImageTrailProps) {
  const reduced = useReducedFlag();
  const rootRef = useRef<HTMLDivElement>(null);
  const slots = useRef<(HTMLDivElement | null)[]>([]);
  const state = useRef({ next: 0, image: 0, z: 1, drop: null as { x: number; y: number } | null, samples: [] as { t: number; x: number; y: number }[], lastDrop: 0, touch: -1, touched: false });
  const live = useRef({ images, spacing, lifetime, size, aspectRatio, maxTilt, disabled, reduced });
  useLayoutEffect(() => { live.current = { images, spacing, lifetime, size, aspectRatio, maxTilt, disabled, reduced }; });

  // Warm the cache so a photo is decoded by the time the pointer calls for it.
  useEffect(() => {
    for (const image of images) { const img = new Image(); img.decoding = "async"; img.src = image.src; }
  }, [images]);

  function spawn(x: number, y: number, vx: number, vy: number) {
    const { images: list, lifetime: stay, size: w, aspectRatio: ratio, maxTilt: tilt, reduced: calm } = live.current;
    const s = state.current, count = Math.min(poolSize, slots.current.length);
    const slot = slots.current[s.next % count];
    if (!slot || !list.length) return;
    s.next += 1;
    const img = slot.firstElementChild as HTMLImageElement | null;
    const src = list[s.image % list.length].src;
    s.image += 1;
    if (img && img.getAttribute("src") !== src) img.setAttribute("src", src);
    const h = w / ratio, left = x - w / 2, top = y - h / 2;
    slot.style.width = `${w}px`;
    slot.style.height = `${h}px`;
    slot.style.zIndex = String(++s.z);
    for (const running of slot.getAnimations()) running.cancel();
    const total = ENTER + stay + EXIT;
    const at = (tx: number, ty: number, r: number, scale: number) => `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${r.toFixed(2)}deg) scale(${scale})`;
    if (calm) {
      slot.animate([
        { transform: at(left, top, 0, 1), opacity: 0 },
        { transform: at(left, top, 0, 1), opacity: 1, offset: 160 / total },
        { transform: at(left, top, 0, 1), opacity: 1, offset: (ENTER + stay) / total },
        { transform: at(left, top, 0, 1), opacity: 0 },
      ], { duration: total, fill: "both" });
      return;
    }
    // Lean toward the direction of travel, with a little variation so the sequence never looks stamped.
    const jitter = ((s.next * 37) % 5 - 2) * .9;
    const lean = clamp(vx * 7, -tilt, tilt) + jitter;
    // Carry on along the pointer's path while fading, as if thrown down.
    const dx = clamp(vx * 70, -48, 48), dy = clamp(vy * 70, -48, 48);
    slot.animate([
      { transform: at(left - dx * .15, top - dy * .15, lean * .4, .6), opacity: 0, easing: POP },
      { transform: at(left, top, lean, 1), opacity: 1, offset: ENTER / total },
      { transform: at(left + dx * .25, top + dy * .25, lean, 1), opacity: 1, offset: (ENTER + stay) / total, easing: "cubic-bezier(.22, 1, .36, 1)" },
      { transform: at(left + dx, top + dy + 10, lean * 1.25, .86), opacity: 0 },
    ], { duration: total, fill: "both" });
  }

  /** Feeds one pointer position into the trail; a photo drops once the pointer has travelled far enough. */
  function trace(x: number, y: number, t: number) {
    const { spacing: gap, reduced: calm } = live.current;
    const s = state.current;
    s.samples.push({ t, x, y });
    while (s.samples.length > 2 && t - s.samples[0].t > 80) s.samples.shift();
    if (!s.drop) { s.drop = { x, y }; return; }
    const travel = Math.hypot(x - s.drop.x, y - s.drop.y);
    if (travel < gap * (calm ? 1.6 : 1) || t - s.lastDrop < 40) return;
    const first = s.samples[0], elapsed = Math.max(1, t - first.t);
    spawn(x, y, (x - first.x) / elapsed, (y - first.y) / elapsed);
    s.drop = { x, y };
    s.lastDrop = t;
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (live.current.disabled) return;
    const s = state.current;
    if (event.pointerType === "touch" && s.touch !== event.pointerId) return;
    s.touched = true;
    const box = event.currentTarget.getBoundingClientRect();
    trace(event.clientX - box.left, event.clientY - box.top, event.timeStamp);
  }

  // The intro: one gentle S-curve across the area, drawn through the same trail logic, the first time it comes into view.
  useEffect(() => {
    const root = rootRef.current;
    if (!intro || !root || typeof IntersectionObserver === "undefined") return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      if (live.current.reduced || live.current.disabled || state.current.touched) return;
      const start = performance.now(), duration = 1100;
      const run = (now: number) => {
        const s = state.current;
        if (s.touched) { s.drop = null; s.samples = []; return; }
        const p = Math.min(1, (now - start) / duration), eased = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        const w = root.offsetWidth, h = root.offsetHeight;
        trace(w * (.14 + .72 * eased), h * (.5 + Math.sin(eased * Math.PI * 2) * .2), now);
        if (p < 1) frame = requestAnimationFrame(run); else { s.drop = null; s.samples = []; }
      };
      frame = requestAnimationFrame(run);
    }, { threshold: .6 });
    observer.observe(root);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trace reads live refs; the intro runs once per mount.
  }, [intro]);

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.pointerType !== "touch" || live.current.disabled) return;
    const s = state.current;
    s.touch = event.pointerId;
    s.drop = null;
    s.samples = [];
  }
  function onPointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const s = state.current;
    if (event.pointerType === "touch" && event.pointerId === s.touch) s.touch = -1;
    if (event.type === "pointerleave" || event.pointerType === "touch") { s.drop = null; s.samples = []; }
  }

  return <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-disabled={disabled ? "" : undefined}
    onPointerMove={onPointerMove} onPointerDown={onPointerDown} onPointerUp={onPointerEnd} onPointerCancel={onPointerEnd} onPointerLeave={onPointerEnd}>
    <div className={styles.trail} aria-hidden="true">
      {Array.from({ length: poolSize }, (_, i) => <div key={i} ref={node => { slots.current[i] = node; }} className={styles.photo}>
        {/* eslint-disable-next-line @next/next/no-img-element -- pooled nodes get their src swapped imperatively as the pointer moves. */}
        <img alt="" draggable={false} decoding="async" />
      </div>)}
    </div>
    {children && <div className={styles.content}>{children}</div>}
  </div>;
}

export default ImageTrail;
