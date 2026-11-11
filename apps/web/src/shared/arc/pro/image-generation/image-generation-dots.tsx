"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import type { CSSProperties, RefObject } from "react";
import type { MotionValue } from "motion/react";

/**
 * The dot matrix behind the image generation loading state. A canvas of small neutral dots, DPR aware. While an image
 * generates a soft radial halftone wave breathes and travels across it (dots under it grow and darken, with a blurred
 * twin for glow); as progress rises each dot takes the colour of the coming photo at its cell and grows by the photo's
 * darkness, so the image forms as a coloured halftone; at the end the dots blur away into the sharp photo. The final
 * frame is the photo itself, so the real <img> lands on it without a cut.
 *
 * Everything runs from the progress motion value in one rAF loop with direct canvas and style writes; React never
 * re-renders per frame. The loop runs only while running and on screen.
 */

type RGB = [number, number, number];
const clamp = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const TAU = Math.PI * 2;

/** Progress windows: colour arrives from COLOR_FROM, the dots dissolve into the photo from DISSOLVE_FROM. */
const COLOR_FROM = .2;
const COLOR_SPAN = .58;
const DISSOLVE_FROM = .8;

/* ───────────────────────── Colours ───────────────────────── */

let probe: CanvasRenderingContext2D | null = null;
/** Any CSS colour (oklch included) to sRGB, through a 1×1 canvas. */
function toRGB(color: string, fallback: RGB): RGB {
  if (typeof document === "undefined" || !color) return fallback;
  if (!probe) {
    const canvas = document.createElement("canvas");
    canvas.width = 1; canvas.height = 1;
    probe = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!probe) return fallback;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = color;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return [r, g, b];
}
/** The ink the dots are drawn in: the theme foreground, read from the element so light and dark both work. */
function inkOf(node: Element): RGB {
  return toRGB(getComputedStyle(node).getPropertyValue("--arc-foreground").trim(), [23, 23, 23]);
}

const grids = new Map<string, Promise<Uint8ClampedArray | null>>();
/**
 * The photo downscaled to the dot grid, cover fitted like `object-fit: cover`, so dot (i, j) carries the colour under
 * it. Cached per source and grid size; null when the image cannot be read (cross origin without CORS).
 */
function sampleGrid(src: string, cols: number, rows: number): Promise<Uint8ClampedArray | null> {
  const key = `${src}|${cols}|${rows}`;
  const cached = grids.get(key);
  if (cached) return cached;
  const job = new Promise<Uint8ClampedArray | null>(resolve => {
    if (typeof document === "undefined" || cols < 1 || rows < 1) { resolve(null); return; }
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = cols; canvas.height = rows;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) { resolve(null); return; }
        const scale = Math.max(cols / image.naturalWidth, rows / image.naturalHeight);
        const w = image.naturalWidth * scale, h = image.naturalHeight * scale;
        context.imageSmoothingQuality = "high";
        context.drawImage(image, (cols - w) / 2, (rows - h) / 2, w, h);
        resolve(context.getImageData(0, 0, cols, rows).data);
      } catch { resolve(null); }
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
  grids.set(key, job);
  // Resizes ask for many grid sizes; keep the cache small.
  if (grids.size > 48) { const first = grids.keys().next().value; if (first) grids.delete(first); }
  return job;
}

/* ───────────────────────── Canvas plumbing ───────────────────────── */

interface Board { w: number; h: number; dpr: number; cols: number; rows: number; ox: number; oy: number }

/** Sizes the canvases to the element at device pixels and calls back with the dot grid that fits. */
function useBoard(wrap: RefObject<HTMLElement | null>, canvases: RefObject<HTMLCanvasElement | null>[], pitch: number, onBoard: (board: Board) => void) {
  const callback = useRef(onBoard);
  useEffect(() => { callback.current = onBoard; });
  useEffect(() => {
    const node = wrap.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = node.clientWidth, h = node.clientHeight;
      if (!w || !h) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      for (const ref of canvases) {
        const canvas = ref.current;
        if (!canvas) continue;
        const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
        if (canvas.width !== cw) canvas.width = cw;
        if (canvas.height !== ch) canvas.height = ch;
      }
      const cols = Math.max(1, Math.floor(w / pitch)), rows = Math.max(1, Math.floor(h / pitch));
      callback.current({ w, h, dpr, cols, rows, ox: (w - cols * pitch) / 2 + pitch / 2, oy: (h - rows * pitch) / 2 + pitch / 2 });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
    // The canvas refs are stable for the life of the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wrap, pitch]);
}

/** Calls back when the theme may have changed (a class or attribute on <html>, or the system scheme). */
function useThemeChange(onChange: () => void) {
  const callback = useRef(onChange);
  useEffect(() => { callback.current = onChange; });
  useEffect(() => {
    if (typeof MutationObserver === "undefined") return;
    const fire = () => callback.current();
    const observer = new MutationObserver(fire);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style", "data-accent"] });
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    media?.addEventListener?.("change", fire);
    return () => { observer.disconnect(); media?.removeEventListener?.("change", fire); };
  }, []);
}

/** Runs only while the element is on screen. */
function useOnScreen(wrap: RefObject<HTMLElement | null>) {
  const visible = useRef(true);
  const listeners = useRef(new Set<() => void>());
  useEffect(() => {
    const node = wrap.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = !!entry?.isIntersecting;
      listeners.current.forEach(listener => listener());
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [wrap]);
  return { visible, listeners };
}

/* ───────────────────────── Dot field ───────────────────────── */

export type DotPhase = "idle" | "running" | "halted" | "done";

export interface DotFieldProps {
  /** Generation progress, 0 to 1. Without it the field draws its idle halftone glow. */
  progress?: MotionValue<number>;
  /** The coming photo: dots take its colours and dissolve into it. */
  preview?: string;
  phase: DotPhase;
  reduced: boolean;
  /** Varies where the wave starts and how it travels, so neighbouring tiles never move in step. */
  seed?: number;
  /** Distance between dot centres in CSS pixels. */
  pitch?: number;
  /** Draws a blurred twin of the dots under the wave. */
  glow?: boolean;
  className?: string;
  canvasClassName?: string;
  glowClassName?: string;
  previewClassName?: string;
}

export function DotField({ progress, preview, phase, reduced, seed = 0, pitch = 8, glow = true, className, canvasClassName, glowClassName, previewClassName }: DotFieldProps) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glowCanvas = useRef<HTMLCanvasElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const board = useRef<Board | null>(null);
  const ink = useRef<RGB>([23, 23, 23]);
  const grid = useRef<Uint8ClampedArray | null>(null);
  const clock = useRef(0);
  const draw = useRef<() => void>(() => undefined);
  const { visible, listeners } = useOnScreen(wrap);

  // One frame: the wave, the colours and the dissolve at the current progress and clock.
  useLayoutEffect(() => { draw.current = () => {
    const b = board.current, context = canvas.current?.getContext("2d");
    if (!b || !context) return;
    const p = phase === "idle" ? 0 : clamp(progress?.get() ?? 0);
    const g = glow && phase === "running" && !reduced ? glowCanvas.current?.getContext("2d") : null;
    const still = reduced || phase !== "running";
    const t = clock.current;
    const colour = reduced ? 0 : smooth(clamp((p - COLOR_FROM) / COLOR_SPAN));
    const dissolve = phase === "done" ? 1 : reduced ? p : smooth(clamp((p - DISSOLVE_FROM) / (1 - DISSOLVE_FROM)));

    // The wave: a soft radial region that breathes and wanders; still, it rests in the middle like a halftone glow.
    const s = seed * 1.7;
    const cx = still ? .5 : .5 + .26 * Math.sin(t * .55 + s) + .06 * Math.sin(t * 1.3 + s * 2);
    const cy = still ? .5 : .5 + .2 * Math.cos(t * .42 + s * 1.3);
    const radius = (still ? .4 : .34 + .07 * Math.sin(t * 1.25 + s)) * Math.max(b.w, b.h);
    const inv = 1 / (radius * radius);
    const wx = cx * b.w, wy = cy * b.h;
    // The wave fades as the photo takes over.
    const waveGain = 1 - colour * .7;

    context.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
    context.clearRect(0, 0, b.w, b.h);
    if (g) { g.setTransform(b.dpr, 0, 0, b.dpr, 0, 0); g.clearRect(0, 0, b.w, b.h); }
    const [ir, ig, ib] = ink.current;
    const samples = colour > 0 ? grid.current : null;
    const half = pitch / 2;

    for (let j = 0; j < b.rows; j++) {
      const y = b.oy + j * pitch;
      for (let i = 0; i < b.cols; i++) {
        const x = b.ox + i * pitch;
        const dx = x - wx, dy = y - wy;
        const wave = Math.exp(-(dx * dx + dy * dy) * inv) * waveGain;
        let r = pitch * (.1 + .17 * wave);
        let alpha = .13 + .55 * wave;
        let fill: string | null = null;
        if (samples) {
          const k = (j * b.cols + i) * 4;
          const pr = samples[k], pg = samples[k + 1], pb = samples[k + 2];
          // Colour shows first under the wave, then everywhere.
          const amount = clamp(colour * (.8 + .45 * wave));
          const lum = (.2126 * pr + .7152 * pg + .0722 * pb) / 255;
          r = lerp(r, half * (.58 + .4 * (1 - lum)) , amount);
          alpha = lerp(alpha, 1, amount);
          fill = `rgb(${Math.round(lerp(ir, pr, amount))},${Math.round(lerp(ig, pg, amount))},${Math.round(lerp(ib, pb, amount))})`;
        }
        context.globalAlpha = alpha;
        context.fillStyle = fill ?? `rgb(${ir},${ig},${ib})`;
        context.beginPath();
        context.arc(x, y, r, 0, TAU);
        context.fill();
        if (g && wave > .3) {
          g.globalAlpha = (wave - .3) * .9;
          g.fillStyle = fill ?? `rgb(${ir},${ig},${ib})`;
          g.beginPath();
          g.arc(x, y, r * 1.7, 0, TAU);
          g.fill();
        }
      }
    }
    context.globalAlpha = 1;
    if (g) g.globalAlpha = 1;

    // The hand off: the dots blur and fade while the photo sharpens out of them.
    const field = canvas.current!;
    field.style.opacity = `${1 - dissolve}`;
    field.style.filter = !reduced && dissolve > 0 && dissolve < 1 ? `blur(${(dissolve * 5).toFixed(2)}px)` : "";
    if (glowCanvas.current) glowCanvas.current.style.opacity = g ? `${1 - dissolve}` : "0";
    const photo = image.current;
    if (photo) {
      photo.style.opacity = `${dissolve}`;
      photo.style.filter = !reduced && dissolve < 1 ? `blur(${((1 - dissolve) * 12).toFixed(2)}px)` : "";
      photo.style.transform = !reduced && dissolve < 1 ? `scale(${(1 + (1 - dissolve) * .04).toFixed(4)})` : "";
    }
  }; });

  useBoard(wrap, [canvas, glowCanvas], pitch, next => {
    const changed = !board.current || board.current.cols !== next.cols || board.current.rows !== next.rows;
    board.current = next;
    if (changed) grid.current = null;
    if (changed && preview) {
      const src = preview;
      void sampleGrid(src, next.cols, next.rows).then(data => {
        if (board.current?.cols === next.cols && board.current.rows === next.rows) { grid.current = data; draw.current(); }
      });
    }
    if (wrap.current) ink.current = inkOf(wrap.current);
    draw.current();
  });

  // A new preview: sample it at the current grid.
  useEffect(() => {
    const b = board.current;
    grid.current = null;
    if (!preview || !b) return;
    let live = true;
    void sampleGrid(preview, b.cols, b.rows).then(data => { if (live && board.current === b) { grid.current = data; draw.current(); } });
    return () => { live = false; };
  }, [preview]);

  useThemeChange(() => { if (wrap.current) { ink.current = inkOf(wrap.current); draw.current(); } });

  // The loop: animated while running and visible; otherwise one frame per change.
  useEffect(() => {
    if (wrap.current) ink.current = inkOf(wrap.current);
    draw.current();
    if (phase !== "running") return;
    if (reduced) return progress?.on("change", () => draw.current());
    let frame = 0, last = 0;
    const tick = (now: number) => {
      clock.current += last ? Math.min(.05, (now - last) / 1000) : 0;
      last = now;
      draw.current();
      frame = visible.current ? requestAnimationFrame(tick) : 0;
    };
    const resume = () => { if (visible.current && !frame) { last = 0; frame = requestAnimationFrame(tick); } };
    const set = listeners.current;
    set.add(resume);
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); set.delete(resume); };
  }, [phase, reduced, progress, visible, listeners]);

  return <div ref={wrap} className={className} aria-hidden="true">
    <canvas ref={glowCanvas} className={glowClassName} />
    <canvas ref={canvas} className={canvasClassName} />
    {/* eslint-disable-next-line @next/next/no-img-element -- framework agnostic registry component */}
    {preview ? <img ref={image} src={preview} alt="" className={previewClassName} draggable={false} decoding="async" style={{ opacity: phase === "done" ? 1 : 0 }} /> : null}
  </div>;
}

/* ───────────────────────── Upscale sweep ───────────────────────── */

/** Centre of the upscale band as a fraction of the width, from just off the left edge to just off the right. */
export const sweepAt = (value: number) => -.14 + clamp(value) * 1.28;
/** Half width of the band as a fraction of the width. */
export const SWEEP_HALF = .12;

/**
 * The dot band of the upscale: a vertical strip of halftone dots in the photo's own colours, biggest at its centre,
 * with a blurred twin. The photo layers around it are masked from the same progress (sharp behind, soft ahead).
 */
export function UpscaleBand({ src, progress, pitch = 6, className, canvasClassName, glowClassName }: { src: string; progress: MotionValue<number>; pitch?: number; className?: string; canvasClassName?: string; glowClassName?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const glowCanvas = useRef<HTMLCanvasElement>(null);
  const board = useRef<Board | null>(null);
  const grid = useRef<Uint8ClampedArray | null>(null);
  const draw = useRef<() => void>(() => undefined);

  useLayoutEffect(() => { draw.current = () => {
    const b = board.current, context = canvas.current?.getContext("2d"), g = glowCanvas.current?.getContext("2d");
    if (!b || !context) return;
    context.setTransform(b.dpr, 0, 0, b.dpr, 0, 0);
    context.clearRect(0, 0, b.w, b.h);
    if (g) { g.setTransform(b.dpr, 0, 0, b.dpr, 0, 0); g.clearRect(0, 0, b.w, b.h); }
    const samples = grid.current;
    if (!samples) return;
    const at = sweepAt(progress.get()) * b.w, reach = SWEEP_HALF * b.w * 1.15;
    const first = Math.max(0, Math.floor((at - reach - b.ox) / pitch)), last = Math.min(b.cols - 1, Math.ceil((at + reach - b.ox) / pitch));
    for (let i = first; i <= last; i++) {
      const x = b.ox + i * pitch;
      const k = smooth(clamp(1 - Math.abs(x - at) / reach));
      if (k <= 0) continue;
      for (let j = 0; j < b.rows; j++) {
        const y = b.oy + j * pitch;
        const q = (j * b.cols + i) * 4;
        const lum = (.2126 * samples[q] + .7152 * samples[q + 1] + .0722 * samples[q + 2]) / 255;
        const fill = `rgb(${samples[q]},${samples[q + 1]},${samples[q + 2]})`;
        const r = pitch * .5 * (.45 + .55 * k) * (.7 + .3 * (1 - lum));
        context.globalAlpha = .55 + .45 * k;
        context.fillStyle = fill;
        context.beginPath();
        context.arc(x, y, r, 0, TAU);
        context.fill();
        if (g && k > .45) {
          g.globalAlpha = (k - .45) * 1.2;
          g.fillStyle = fill;
          g.beginPath();
          g.arc(x, y, r * 1.8, 0, TAU);
          g.fill();
        }
      }
    }
    context.globalAlpha = 1;
    if (g) g.globalAlpha = 1;
  }; });

  useBoard(wrap, [canvas, glowCanvas], pitch, next => {
    board.current = next;
    void sampleGrid(src, next.cols, next.rows).then(data => { if (board.current === next) { grid.current = data; draw.current(); } });
    draw.current();
  });

  useEffect(() => progress.on("change", () => draw.current()), [progress]);

  return <div ref={wrap} className={className} aria-hidden="true">
    <canvas ref={glowCanvas} className={glowClassName} />
    <canvas ref={canvas} className={canvasClassName} />
  </div>;
}

/* ───────────────────────── 3×3 spinner ───────────────────────── */

/** Order in which the nine dots light: around the ring, the centre last. */
const SPIN_ORDER = [0, 1, 2, 7, 8, 3, 6, 5, 4];

/** A tiny 3×3 dot matrix whose dots light in turn around the ring. Static with reduced motion (CSS). */
export function DotSpinner({ className, dotClassName }: { className?: string; dotClassName?: string }) {
  return <span className={className} aria-hidden="true">
    {SPIN_ORDER.map((step, index) => <span key={index} className={dotClassName} style={{ animationDelay: `${(step - 9) * 90}ms` } as CSSProperties} data-center={index === 4 || undefined} />)}
  </span>;
}
