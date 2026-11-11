"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FocusEvent as ReactFocusEvent, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, PenLine, Shapes, Trash2, Undo2, Wand } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./cursor-trail-draw.module.css";

/* ------------------------------------------------------------------------------------------------
 * Types
 * ---------------------------------------------------------------------------------------------- */

export type WhiteboardTool = "pen" | "laser";
export type WhiteboardShape = "freehand" | "line" | "circle" | "ellipse" | "rectangle" | "square" | "triangle" | "polygon";

/** A stroke on the board. Points are in board units: the board is always 1000 units wide. */
export interface WhiteboardItem {
  id: string;
  shape: WhiteboardShape;
  /** Id of the ink color. */
  color: string;
  /** Average stroke width in board units. */
  width: number;
  /** Centerline of the stroke as drawn, or of the clean shape once it snapped. */
  points: [number, number][];
}

export interface WhiteboardColor {
  id: string;
  label: string;
  /** Any CSS color, including a var(). */
  value: string;
}

export interface CursorTrailDrawProps {
  /** Heading and accessible name of the board. */
  label?: string;
  /** Ink colors in the toolbar. The first one is the default. */
  colors?: WhiteboardColor[];
  /** Tool selected first. */
  defaultTool?: WhiteboardTool;
  /** Whether rough circles, boxes, triangles and lines snap to clean shapes. People can switch it in the toolbar. */
  defaultSnap?: boolean;
  /** Pen size in CSS pixels at half pressure. */
  size?: number;
  /** How much the ink trails the pointer, from 0 (raw) to 1 (very smooth). */
  smoothing?: number;
  /** How long the laser trail takes to fade, in milliseconds. */
  laserFade?: number;
  /** Plays a short sketch the first time the board is in view: a rough circle and box snap clean and get connected. */
  intro?: boolean;
  /** Multiplies the speed of the snap and fade animations. */
  speed?: number;
  /** Stops all animation. Shapes land at once and the laser shows only its dot. Drawing still works. */
  paused?: boolean;
  /** Any CSS color for the accent ink, the laser and the selected tool. Defaults to the theme accent. */
  accent?: string;
  /** Short line in the empty board. Pass an empty string to hide it. */
  hint?: string;
  /** Called with every item after a stroke lands, snaps, is kept as drawn, undone or cleared. */
  onChange?: (items: WhiteboardItem[]) => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_COLORS: WhiteboardColor[] = [
  { id: "ink", label: "Ink", value: "var(--arc-foreground)" },
  { id: "accent", label: "Accent", value: "var(--ctd-accent)" },
  { id: "red", label: "Red", value: "var(--arc-danger)" },
];

const SHAPE_NAMES: Record<WhiteboardShape, string> = {
  freehand: "stroke",
  line: "line",
  circle: "circle",
  ellipse: "ellipse",
  rectangle: "rectangle",
  square: "square",
  triangle: "triangle",
  polygon: "shape",
};

/* ------------------------------------------------------------------------------------------------
 * Geometry
 * ---------------------------------------------------------------------------------------------- */

type V = [number, number];
interface Pt { x: number; y: number; w: number }

const f1 = (n: number) => (Math.round(n * 10) / 10).toString();
const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const smoothstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

function pathLength(pts: { x: number; y: number }[]) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += dist(pts[i - 1], pts[i]);
  return l;
}

/** Evenly resamples a polyline by arc length, carrying widths along. */
function resample(pts: Pt[], n: number): Pt[] {
  if (pts.length < 2) return Array.from({ length: n }, () => ({ ...(pts[0] ?? { x: 0, y: 0, w: 1 }) }));
  const total = pathLength(pts);
  if (total < 1e-6) return Array.from({ length: n }, () => ({ ...pts[0] }));
  const out: Pt[] = [{ ...pts[0] }];
  const step = total / (n - 1);
  let acc = 0, i = 1, prev = pts[0];
  while (out.length < n - 1 && i < pts.length) {
    const cur = pts[i], seg = dist(prev, cur);
    if (acc + seg >= step && seg > 0) {
      const t = (step - acc) / seg;
      const p = { x: prev.x + (cur.x - prev.x) * t, y: prev.y + (cur.y - prev.y) * t, w: prev.w + (cur.w - prev.w) * t };
      out.push(p);
      prev = p;
      acc = 0;
    } else {
      acc += seg;
      prev = cur;
      i++;
    }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out;
}

/** Filled outline of a variable width stroke with round caps, smoothed with quadratic midpoints. */
function outline(pts: Pt[]): string {
  const n = pts.length;
  if (!n) return "";
  if (n === 1 || pathLength(pts) < pts[0].w * .25) {
    const { x, y } = pts[0], r = Math.max(.5, pts[0].w * .55);
    return `M${f1(x - r)} ${f1(y)}a${f1(r)} ${f1(r)} 0 1 0 ${f1(r * 2)} 0a${f1(r)} ${f1(r)} 0 1 0 ${f1(-r * 2)} 0Z`;
  }
  const L: V[] = [], R: V[] = [];
  let nx = 0, ny = 1;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
    const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    if (len > 1e-6) { nx = -dy / len; ny = dx / len; }
    const r = pts[i].w / 2;
    L.push([pts[i].x + nx * r, pts[i].y + ny * r]);
    R.push([pts[i].x - nx * r, pts[i].y - ny * r]);
  }
  const smooth = (arr: V[]) => {
    let s = "";
    for (let i = 1; i < arr.length - 1; i++) {
      const m: V = [(arr[i][0] + arr[i + 1][0]) / 2, (arr[i][1] + arr[i + 1][1]) / 2];
      s += `Q${f1(arr[i][0])} ${f1(arr[i][1])} ${f1(m[0])} ${f1(m[1])}`;
    }
    const last = arr[arr.length - 1];
    return s + `L${f1(last[0])} ${f1(last[1])}`;
  };
  const re = f1(Math.max(.1, pts[n - 1].w / 2)), rs = f1(Math.max(.1, pts[0].w / 2));
  R.reverse();
  return `M${f1(L[0][0])} ${f1(L[0][1])}${smooth(L)}A${re} ${re} 0 0 0 ${f1(R[0][0])} ${f1(R[0][1])}${smooth(R)}A${rs} ${rs} 0 0 0 ${f1(L[0][0])} ${f1(L[0][1])}Z`;
}

/** Distance from p to segment ab. */
function segDist(p: V, a: V, b: V) {
  const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
  const t = l2 ? clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2, 0, 1) : 0;
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t);
}

function rdp(pts: V[], eps: number): V[] {
  if (pts.length < 3) return pts;
  let max = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= eps) return [pts[0], pts[pts.length - 1]];
  const a = rdp(pts.slice(0, idx + 1), eps), b = rdp(pts.slice(idx), eps);
  return [...a.slice(0, -1), ...b];
}

const rot = (p: V, a: number): V => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a)];
const signedArea = (pts: V[]) => { let s = 0; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; };

interface Recognized {
  shape: Exclude<WhiteboardShape, "freehand">;
  /** Target centerline, same length as the morph source. */
  target: V[];
  /** Exact clean path for the settled state. */
  d: string;
}

/** Samples a closed polygon evenly by perimeter, always landing on its corners. */
function samplePolygon(corners: V[], n: number): V[] {
  const edges = corners.map((c, i) => { const d = corners[(i + 1) % corners.length]; return Math.hypot(d[0] - c[0], d[1] - c[1]); });
  const per = edges.reduce((a, b) => a + b, 0) || 1;
  const out: V[] = [];
  let left = n;
  corners.forEach((c, i) => {
    const d = corners[(i + 1) % corners.length];
    const k = i === corners.length - 1 ? left : Math.max(1, Math.round(n * edges[i] / per));
    left -= k;
    for (let j = 0; j < k; j++) out.push([c[0] + (d[0] - c[0]) * j / k, c[1] + (d[1] - c[1]) * j / k]);
  });
  return out.slice(0, n);
}

/** Turns a rough stroke into a clean line, circle, ellipse, rectangle or triangle, or returns null when it is freehand. */
function recognize(raw: Pt[], unitsPerPx: number, n: number): Recognized | null {
  const len = pathLength(raw);
  if (len / unitsPerPx < 28) return null;
  const R = resample(raw, 72).map(p => [p.x, p.y] as V);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of R) { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); }
  const D = Math.hypot(maxX - minX, maxY - minY) || 1;
  const first = R[0], last = R[R.length - 1];
  const gap = Math.hypot(last[0] - first[0], last[1] - first[1]);

  // Line: nearly as long as its chord. Snaps to 0, 45 and 90 degrees when it is close.
  if (gap / len > .94) {
    let ang = Math.atan2(last[1] - first[1], last[0] - first[0]);
    const snapTo = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
    if (Math.abs(ang - snapTo) < 7 * Math.PI / 180) ang = snapTo;
    const b: V = [first[0] + Math.cos(ang) * gap, first[1] + Math.sin(ang) * gap];
    const target = Array.from({ length: n }, (_, i) => [first[0] + (b[0] - first[0]) * i / (n - 1), first[1] + (b[1] - first[1]) * i / (n - 1)] as V);
    return { shape: "line", target, d: `M${f1(first[0])} ${f1(first[1])}L${f1(b[0])} ${f1(b[1])}` };
  }
  if (gap > .3 * D || len < 1.6 * D) return null;

  // Trim the overshoot past the start so the loop is one lap.
  let cut = R.length - 1, best = Infinity;
  for (let i = Math.floor(R.length * .6); i < R.length; i++) {
    const d = Math.hypot(R[i][0] - first[0], R[i][1] - first[1]);
    if (d < best) { best = d; cut = i; }
  }
  const loop = R.slice(0, cut + 1);
  const pts = loop.slice(0, -1).length > 8 ? loop : R;

  // Ellipse fit on principal axes.
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p[0]; cy += p[1]; }
  cx /= pts.length; cy /= pts.length;
  let sxx = 0, syy = 0, sxy = 0;
  for (const p of pts) { const dx = p[0] - cx, dy = p[1] - cy; sxx += dx * dx; syy += dy * dy; sxy += dx * dy; }
  let theta = .5 * Math.atan2(2 * sxy, sxx - syy);
  const local = pts.map(p => rot([p[0] - cx, p[1] - cy], -theta));
  let lx0 = Infinity, lx1 = -Infinity, ly0 = Infinity, ly1 = -Infinity;
  for (const [x, y] of local) { lx0 = Math.min(lx0, x); lx1 = Math.max(lx1, x); ly0 = Math.min(ly0, y); ly1 = Math.max(ly1, y); }
  let rx = (lx1 - lx0) / 2, ry = (ly1 - ly0) / 2;
  const off = rot([(lx0 + lx1) / 2, (ly0 + ly1) / 2], theta);
  const ex = cx + off[0], ey = cy + off[1];
  let ellipseErr = 0;
  for (const p of pts) {
    const q = rot([p[0] - ex, p[1] - ey], -theta);
    ellipseErr += Math.abs(Math.hypot(q[0] / (rx || 1), q[1] / (ry || 1)) - 1);
  }
  ellipseErr = ellipseErr / pts.length * ((rx + ry) / 2) / D;

  // Polygon fit: split the loop at its two farthest points and simplify each half.
  let far = 0, fd = -1;
  for (let i = 0; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - cx, pts[i][1] - cy); if (d > fd) { fd = d; far = i; } }
  const ring = [...pts.slice(far), ...pts.slice(0, far)];
  let opp = 0; fd = -1;
  for (let i = 0; i < ring.length; i++) { const d = Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]); if (d > fd) { fd = d; opp = i; } }
  const eps = .055 * D;
  const halfA = rdp(ring.slice(0, opp + 1), eps), halfB = rdp([...ring.slice(opp), ring[0]], eps);
  let corners: V[] = [...halfA.slice(0, -1), ...halfB.slice(0, -1)];
  // Merge corners that sit close together, then drop ones that barely turn.
  corners = corners.filter((c, i) => { const p = corners[(i + corners.length - 1) % corners.length]; return Math.hypot(c[0] - p[0], c[1] - p[1]) > .12 * D || corners.length <= 3; });
  let changed = true;
  while (changed && corners.length > 3) {
    changed = false;
    for (let i = 0; i < corners.length; i++) {
      const a = corners[(i + corners.length - 1) % corners.length], b = corners[i], c = corners[(i + 1) % corners.length];
      const a1 = Math.atan2(b[1] - a[1], b[0] - a[0]), a2 = Math.atan2(c[1] - b[1], c[0] - b[0]);
      let turn = Math.abs(a2 - a1);
      if (turn > Math.PI) turn = 2 * Math.PI - turn;
      if (turn < 28 * Math.PI / 180) { corners.splice(i, 1); changed = true; break; }
    }
  }
  let polyErr = Infinity;
  if (corners.length === 3 || corners.length === 4) {
    polyErr = 0;
    for (const p of pts) {
      let m = Infinity;
      for (let i = 0; i < corners.length; i++) m = Math.min(m, segDist(p, corners[i], corners[(i + 1) % corners.length]));
      polyErr += m;
    }
    polyErr = polyErr / pts.length / D;
  }

  const orient = signedArea(loop) >= 0 ? 1 : -1;
  /** Orients a closed target like the stroke and starts it at the point nearest the pen down. */
  const align = (base: V[]): V[] => {
    const t = signedArea(base) * orient < 0 ? [...base].reverse() : base;
    let k = 0, kd = Infinity;
    t.forEach((p, i) => { const d = Math.hypot(p[0] - first[0], p[1] - first[1]); if (d < kd) { kd = d; k = i; } });
    const out = [...t.slice(k), ...t.slice(0, k)];
    return [...out, out[0]];
  };

  if (polyErr < .034 && polyErr < ellipseErr * 1.15) {
    if (corners.length === 4) {
      const angles = corners.map((c, i) => { const p = corners[(i + corners.length - 1) % corners.length], q = corners[(i + 1) % corners.length]; const v1: V = [p[0] - c[0], p[1] - c[1]], v2: V = [q[0] - c[0], q[1] - c[1]]; return Math.acos(clamp((v1[0] * v2[0] + v1[1] * v2[1]) / ((Math.hypot(...v1) * Math.hypot(...v2)) || 1), -1, 1)); });
      const square = angles.every(a => Math.abs(a - Math.PI / 2) < 24 * Math.PI / 180);
      if (square) {
        // Rectangle on the dominant edge direction, flattened to the axes when it is close.
        let sc = 0, ss = 0;
        corners.forEach((c, i) => { const d = corners[(i + 1) % 4]; const a = Math.atan2(d[1] - c[1], d[0] - c[0]), l = Math.hypot(d[0] - c[0], d[1] - c[1]); sc += Math.cos(4 * a) * l; ss += Math.sin(4 * a) * l; });
        let a = Math.atan2(ss, sc) / 4;
        if (Math.abs(a) < 9 * Math.PI / 180) a = 0;
        const loc = corners.map(c => rot([c[0] - cx, c[1] - cy], -a));
        let x0 = 0, x1 = 0, y0 = 0, y1 = 0;
        // Average opposite sides instead of taking the extremes, so a wobble does not inflate the box.
        const xs = loc.map(p => p[0]).sort((p, q) => p - q), ys = loc.map(p => p[1]).sort((p, q) => p - q);
        x0 = (xs[0] + xs[1]) / 2; x1 = (xs[2] + xs[3]) / 2; y0 = (ys[0] + ys[1]) / 2; y1 = (ys[2] + ys[3]) / 2;
        let w = x1 - x0, h = y1 - y0;
        const isSquare = Math.abs(w - h) / Math.max(w, h) < .1;
        if (isSquare) { const s = (w + h) / 2, mx = (x0 + x1) / 2, my = (y0 + y1) / 2; x0 = mx - s / 2; x1 = mx + s / 2; y0 = my - s / 2; y1 = my + s / 2; w = h = s; }
        const box = ([[x0, y0], [x1, y0], [x1, y1], [x0, y1]] as V[]).map(p => { const r = rot(p, a); return [r[0] + cx, r[1] + cy] as V; });
        return { shape: isSquare ? "square" : "rectangle", target: align(samplePolygon(box, n - 1)), d: `M${box.map(p => `${f1(p[0])} ${f1(p[1])}`).join("L")}Z` };
      }
      return { shape: "polygon", target: align(samplePolygon(corners, n - 1)), d: `M${corners.map(p => `${f1(p[0])} ${f1(p[1])}`).join("L")}Z` };
    }
    // Triangle: an edge that is nearly level lands level.
    const tri = corners.map(c => [...c] as V);
    for (let i = 0; i < 3; i++) {
      const a = tri[i], b = tri[(i + 1) % 3];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) % Math.PI;
      if (Math.abs(Math.sin(ang)) < Math.sin(8 * Math.PI / 180)) { const y = (a[1] + b[1]) / 2; a[1] = y; b[1] = y; break; }
    }
    return { shape: "triangle", target: align(samplePolygon(tri, n - 1)), d: `M${tri.map(p => `${f1(p[0])} ${f1(p[1])}`).join("L")}Z` };
  }

  if (ellipseErr < .05) {
    const ratio = rx / (ry || 1);
    let shape: Recognized["shape"] = "ellipse";
    // A circle centers on its bounding box, not the point average, so an overlapping lap or a bulge does not pull it off.
    if (ratio > .82 && ratio < 1.22) { const r = (rx + ry) / 2; rx = ry = r; theta = 0; shape = "circle"; }
    else {
      // Level ellipses land level.
      const deg = ((theta * 180 / Math.PI) % 180 + 180) % 180;
      if (deg < 10 || deg > 170) theta = 0;
      else if (Math.abs(deg - 90) < 10) { theta = 0; [rx, ry] = [ry, rx]; }
    }
    const m = n - 1;
    const base = Array.from({ length: m }, (_, i) => { const t = i / m * Math.PI * 2; const p = rot([Math.cos(t) * rx, Math.sin(t) * ry], theta); return [p[0] + ex, p[1] + ey] as V; });
    const p0 = rot([rx, 0], theta), deg = f1(theta * 180 / Math.PI);
    const d = `M${f1(ex + p0[0])} ${f1(ey + p0[1])}A${f1(rx)} ${f1(ry)} ${deg} 1 1 ${f1(ex - p0[0])} ${f1(ey - p0[1])}A${f1(rx)} ${f1(ry)} ${deg} 1 1 ${f1(ex + p0[0])} ${f1(ey + p0[1])}Z`;
    return { shape, target: align(base), d };
  }
  return null;
}

/* ------------------------------------------------------------------------------------------------
 * Intro sketch: rough strokes generated from a fixed seed, so the server and client agree.
 * ---------------------------------------------------------------------------------------------- */

interface ScriptStroke { tool: WhiteboardTool; color: number; path: V[]; ms: number; pause: number }

function introScript(H: number): ScriptStroke[] {
  const vertical = H > 900;
  const unit = vertical ? 1000 : Math.min(1000, H * 1.6);
  const r = unit * (vertical ? .13 : .12);
  const c: V = vertical ? [500, H * .3] : [500 - unit * .27, H * .46];
  const bw = vertical ? 420 : unit * .3, bh = vertical ? 230 : unit * .19;
  const b: V = vertical ? [500, H * .68] : [500 + unit * .24, H * .46];

  const circle: V[] = [];
  for (let i = 0; i <= 90; i++) {
    const t = -1.9 + i / 90 * (Math.PI * 2 + .45);
    const k = 1 + .045 * Math.sin(3 * t + 1.2) + .025 * Math.sin(5 * t + .4) + .03 * (i / 90);
    circle.push([c[0] + Math.cos(t) * r * 1.06 * k, c[1] + Math.sin(t) * r * .96 * k]);
  }
  const box: V[] = [];
  // The hand rounds corners and the fit averages opposite sides, so the rough box is drawn a touch larger and lower
  // than the clean box it should land on.
  const dw = bw + 16, dh = bh + 8, bx0 = b[0] - dw / 2, by0 = b[1] + (vertical ? 10 : 4) - dh / 2;
  const corners: V[] = [[bx0 + 6, by0 + 2], [bx0 + dw - 4, by0 - 6], [bx0 + dw + 5, by0 + dh + 3], [bx0 - 5, by0 + dh - 2], [bx0 + 10, by0 + 5]];
  for (let s = 0; s < corners.length - 1; s++) {
    const p = corners[s], q = corners[s + 1];
    for (let i = 0; i < 24; i++) {
      const t = i / 24, bow = Math.sin(t * Math.PI) * (s % 2 ? 5 : -4);
      const nx = -(q[1] - p[1]), ny = q[0] - p[0], nl = Math.hypot(nx, ny) || 1;
      box.push([p[0] + (q[0] - p[0]) * t + nx / nl * bow, p[1] + (q[1] - p[1]) * t + ny / nl * bow]);
    }
  }
  box.push(corners[corners.length - 1]);
  const gap = 22;
  const from: V = vertical ? [c[0], c[1] + r + gap] : [c[0] + r * 1.06 + gap, c[1]];
  const to: V = vertical ? [b[0], b[1] - bh / 2 - gap] : [b[0] - bw / 2 - gap, b[1]];
  const line: V[] = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30, bow = Math.sin(t * Math.PI) * 4;
    line.push(vertical ? [from[0] + bow, from[1] + (to[1] - from[1]) * t] : [from[0] + (to[0] - from[0]) * t, from[1] - bow]);
  }
  const laser: V[] = [];
  const lc: V = [b[0], b[1] + bh / 2 + (vertical ? 48 : 60)];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    laser.push([lc[0] - bw * .42 + bw * .84 * t, lc[1] + Math.sin(t * Math.PI * 2) * 6 - t * 4]);
  }
  // Even spacing by arc length, so the hand keeps one speed along long and short edges alike.
  const even = (path: V[]) => {
    const pts = path.map(([x, y]) => ({ x, y, w: 0 }));
    return resample(pts, Math.max(8, Math.ceil(pathLength(pts) / 4))).map(p => [p.x, p.y] as V);
  };
  return [
    { tool: "pen", color: 0, path: even(circle), ms: 1100, pause: 560 },
    { tool: "pen", color: 0, path: even(box), ms: 1300, pause: 560 },
    { tool: "pen", color: 1, path: even(line), ms: 560, pause: 620 },
    { tool: "laser", color: 0, path: even(laser), ms: 820, pause: 0 },
  ];
}

function scriptAt(path: V[], t: number): V {
  // Ease in and out so the ghost hand accelerates like a real one.
  const e = t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const f = clamp(e, 0, 1) * (path.length - 1), i = Math.floor(f), k = f - i;
  const a = path[i], b = path[Math.min(path.length - 1, i + 1)];
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
}

/* ------------------------------------------------------------------------------------------------
 * Component
 * ---------------------------------------------------------------------------------------------- */

const N = 97;
const MORPH_K = 260, MORPH_ZETA = .56;

interface Stroke { pts: Pt[]; tip: V; raw: V; rawPrev: V; pr: number; travel: number; idle: number; pressure: number | null }
interface Item {
  id: string;
  shape: WhiteboardShape;
  color: string;
  raw: Pt[];
  from: Pt[] | null;
  to: V[] | null;
  clean: string | null;
  mean: number;
  p: number;
  v: number;
  target: 0 | 1;
  el: SVGPathElement | null;
  recognized: Recognized | null;
}
interface LaserPt { x: number; y: number; t: number }

function newStroke(x: number, y: number): Stroke {
  return { pts: [], tip: [x, y], raw: [x, y], rawPrev: [x, y], pr: .6, travel: 0, idle: 0, pressure: null };
}

export function CursorTrailDraw({
  label = "Whiteboard",
  colors = DEFAULT_COLORS,
  defaultTool = "pen",
  defaultSnap = true,
  size = 4,
  smoothing = .5,
  laserFade = 700,
  intro = true,
  speed = 1,
  paused = false,
  accent,
  hint = "Draw a rough circle, box or line. It snaps clean.",
  onChange,
  className,
  style,
}: CursorTrailDrawProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const reduced = useReducedMotion();
  const still = !!reduced || paused;

  const [tool, setTool] = useState<WhiteboardTool>(defaultTool);
  const [colorId, setColorId] = useState(colors[0]?.id ?? "ink");
  const [snap, setSnap] = useState(defaultSnap);
  const [list, setList] = useState<{ id: string; shape: WhiteboardShape; leaving?: boolean }[]>([]);
  const [chip, setChip] = useState<{ id: string; shape: WhiteboardShape } | null>(null);
  const [message, setMessage] = useState("");
  const [drawing, setDrawing] = useState(false);
  const [introOn, setIntroOn] = useState(false);

  const root = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const livePath = useRef<SVGPathElement>(null);
  const laserPath = useRef<SVGPathElement>(null);
  const nib = useRef<SVGCircleElement>(null);
  const nibRing = useRef<SVGCircleElement>(null);
  const pattern = useRef<SVGPatternElement>(null);
  const dot = useRef<SVGCircleElement>(null);
  const chipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const s = useRef({
    w: 0, h: 0, u: 1, H: 625,
    items: new Map<string, Item>(),
    order: [] as string[],
    stroke: null as Stroke | null,
    strokeColor: "ink",
    laser: [] as LaserPt[],
    laserStroke: null as Stroke | null,
    frame: 0, last: 0, inView: false, visible: true,
    pointer: null as number | null,
    hover: false, nibAt: [500, 300] as V,
    kbd: false, keys: new Set<string>(), kDown: false,
    intro: null as null | { script: ScriptStroke[]; idx: number; t: number; phase: "draw" | "pause"; startDelay: number },
    introDone: false,
    seq: 0,
  });

  // Latest props for the loop without restarting it.
  const live = useRef({ tool, colorId, snap, size, smoothing, laserFade, speed, still, colors, onChange });
  useLayoutEffect(() => { live.current = { tool, colorId, snap, size, smoothing, laserFade, speed, still, colors, onChange }; });

  const announce = useCallback((m: string) => setMessage(prev => (prev === m ? m + " " : m)), []);

  const colorValue = useCallback((id: string) => live.current.colors.find(c => c.id === id)?.value ?? "var(--arc-foreground)", []);

  /* ---------- painting ---------- */

  const paintItem = useCallback((it: Item) => {
    const el = it.el;
    if (!el) return;
    el.style.color = colorValue(it.color);
    const settled = Math.abs(it.p - it.target) < .002 && Math.abs(it.v) < .01;
    if (it.to && it.from && it.clean && settled && it.target === 1) {
      el.setAttribute("d", it.clean);
      el.setAttribute("stroke-width", f1(it.mean));
      el.dataset.mode = "clean";
      return;
    }
    el.dataset.mode = "ink";
    el.removeAttribute("stroke-width");
    if (!it.to || !it.from || (settled && it.target === 0)) { el.setAttribute("d", outline(it.raw)); return; }
    const p = it.p, wp = clamp(p, 0, 1);
    const pts: Pt[] = it.from.map((a, i) => ({ x: a.x + (it.to![i][0] - a.x) * p, y: a.y + (it.to![i][1] - a.y) * p, w: a.w + (it.mean - a.w) * wp }));
    el.setAttribute("d", outline(pts));
  }, [colorValue]);

  const paintNib = useCallback(() => {
    const S = s.current, el = nib.current, ring = nibRing.current;
    if (!el || !ring) return;
    const L = live.current;
    const scripted = S.intro ? S.intro.script[S.intro.idx] : null;
    const laser = scripted ? scripted.tool === "laser" : L.tool === "laser";
    const show = S.hover || S.kbd || !!scripted;
    const r = laser ? 4.5 * S.u : Math.max(1.5, L.size * S.u * .6);
    const [x, y] = S.nibAt;
    for (const c of [el, ring]) { c.setAttribute("cx", f1(x)); c.setAttribute("cy", f1(y)); c.dataset.tool = laser ? "laser" : "pen"; }
    el.setAttribute("r", f1(r));
    ring.setAttribute("r", f1(laser ? 11 * S.u : r + 6 * S.u));
    ring.setAttribute("stroke-width", f1(1.25 * S.u));
    el.toggleAttribute("data-show", show);
    ring.toggleAttribute("data-show", show && (laser || S.kbd || !!scripted));
    ring.toggleAttribute("data-down", S.kDown || S.pointer != null);
    const color = laser ? "var(--ctd-accent)" : colorValue(scripted ? (L.colors[scripted.color]?.id ?? "ink") : L.colorId);
    el.style.color = color;
    ring.style.color = color;
  }, [colorValue]);

  const paintLive = useCallback(() => {
    const S = s.current, el = livePath.current;
    if (!el) return;
    if (!S.stroke || !S.stroke.pts.length) { el.setAttribute("d", ""); return; }
    el.setAttribute("d", outline(S.stroke.pts));
  }, []);

  const paintLaser = useCallback((now: number) => {
    const S = s.current, el = laserPath.current;
    if (!el) return;
    const life = Math.max(1, live.current.laserFade / Math.max(.1, live.current.speed));
    if (live.current.still) { el.setAttribute("d", ""); return; }
    const pts: Pt[] = [];
    for (const p of S.laser) {
      const k = 1 - (now - p.t) / life;
      if (k > 0) pts.push({ x: p.x, y: p.y, w: 7 * S.u * Math.pow(k, .9) });
    }
    el.setAttribute("d", pts.length > 1 ? outline(pts) : "");
  }, []);

  /* ---------- items ---------- */

  const publicItems = useCallback((): WhiteboardItem[] => {
    const S = s.current;
    return S.order.map(id => S.items.get(id)!).filter(Boolean).map(it => ({
      id: it.id,
      shape: it.shape,
      color: it.color,
      width: it.mean,
      points: it.to && it.target === 1 ? it.to.map(p => [p[0], p[1]] as V) : it.raw.map(p => [p.x, p.y] as V),
    }));
  }, []);

  const emit = useCallback(() => { live.current.onChange?.(publicItems()); }, [publicItems]);

  const showChip = useCallback((id: string, shape: WhiteboardShape) => {
    if (chipTimer.current) clearTimeout(chipTimer.current);
    setChip({ id, shape });
    chipTimer.current = setTimeout(() => setChip(null), 4200);
  }, []);

  /** Commits a finished pen stroke: snaps it when it reads as a shape. */
  const commit = useCallback((raw: Pt[], color: string, opts: { snap: boolean; instant: boolean; quiet?: boolean }) => {
    const S = s.current;
    if (!raw.length) return;
    // Taper the last stretch like a pen lifting off.
    let back = 0;
    for (let i = raw.length - 1; i > 0 && back < 18 * S.u; i--) {
      raw[i].w *= .45 + .55 * (back / (18 * S.u));
      back += dist(raw[i], raw[i - 1]);
    }
    const mean = raw.reduce((a, p) => a + p.w, 0) / raw.length;
    const rec = opts.snap ? recognize(raw, S.u, N) : null;
    const id = `s${++S.seq}`;
    const it: Item = {
      // Clean shapes share one weight, whatever the speed they were drawn at.
      id, shape: rec?.shape ?? "freehand", color, raw, mean: rec ? live.current.size * S.u * .85 : mean,
      from: rec ? resample(raw, N) : null, to: rec?.target ?? null, clean: rec?.d ?? null,
      p: rec && opts.instant ? 1 : 0, v: 0, target: rec ? 1 : 0, el: null, recognized: rec,
    };
    S.items.set(id, it);
    S.order.push(id);
    setList(l => [...l, { id, shape: it.shape }]);
    if (rec && !opts.quiet) {
      showChip(id, rec.shape);
      announce(`Snapped to ${SHAPE_NAMES[rec.shape]}`);
    } else if (!opts.quiet) announce("Stroke added");
    emit();
    return it;
  }, [announce, emit, showChip]);

  /* ---------- stroke physics ---------- */

  const pushPoint = useCallback((st: Stroke, x: number, y: number, dtMs: number) => {
    const S = s.current, L = live.current;
    const last = st.pts[st.pts.length - 1];
    const dpx = last ? Math.hypot(x - last.x, y - last.y) / S.u : 0;
    if (last && dpx < .8) { st.idle += dtMs; return; }
    const speedPx = last ? dpx / Math.max(1, dtMs + st.idle) : 0;
    st.idle = 0;
    const target = st.pressure != null ? clamp(st.pressure, .05, 1) : 1 - .66 * smoothstep(.12, 2.4, speedPx);
    st.pr += (target - st.pr) * (last ? .2 : 1);
    st.travel += dpx;
    const ramp = Math.min(1, .38 + st.travel / 20);
    st.pts.push({ x, y, w: L.size * S.u * (.5 + .72 * st.pr) * ramp });
  }, []);

  /** Moves a stroke tip toward the pointer in substeps, so fast strokes stay dense and slow ones glide. */
  const advance = useCallback((st: Stroke, dtMs: number, push: (x: number, y: number, dt: number) => void) => {
    const S = s.current, L = live.current;
    const rate = 78 - 60 * clamp(L.smoothing, 0, 1);
    const span = Math.hypot(st.raw[0] - st.rawPrev[0], st.raw[1] - st.rawPrev[1]) + Math.hypot(st.raw[0] - st.tip[0], st.raw[1] - st.tip[1]);
    const k = clamp(Math.ceil(span / (2.5 * S.u)), 1, 16);
    const a = 1 - Math.exp(-rate * dtMs / 1000 / k);
    for (let i = 1; i <= k; i++) {
      const tx = st.rawPrev[0] + (st.raw[0] - st.rawPrev[0]) * i / k, ty = st.rawPrev[1] + (st.raw[1] - st.rawPrev[1]) * i / k;
      st.tip[0] += (tx - st.tip[0]) * a;
      st.tip[1] += (ty - st.tip[1]) * a;
      push(st.tip[0], st.tip[1], dtMs / k);
    }
    st.rawPrev = [st.raw[0], st.raw[1]];
  }, []);

  /** Lets the tip catch up with the pointer before the stroke ends. */
  const flush = useCallback((st: Stroke, push: (x: number, y: number, dt: number) => void) => {
    for (let i = 0; i < 60 && Math.hypot(st.raw[0] - st.tip[0], st.raw[1] - st.tip[1]) > .5 * s.current.u; i++) advance(st, 8, push);
    push(st.raw[0], st.raw[1], 8);
  }, [advance]);

  /* ---------- loop ---------- */

  const loopRef = useRef<(now: number) => void>(() => {});

  const kick = useCallback(() => {
    const S = s.current;
    if (S.frame || !S.inView || !S.visible) return;
    S.frame = requestAnimationFrame(t => loopRef.current(t));
  }, []);

  const beginPen = useCallback((x: number, y: number, pressure: number | null, color: string) => {
    const S = s.current;
    S.stroke = newStroke(x, y);
    S.strokeColor = color;
    if (livePath.current) livePath.current.style.color = colorValue(color);
    S.stroke.pressure = pressure;
    pushPoint(S.stroke, x, y, 16);
    paintLive();
  }, [colorValue, paintLive, pushPoint]);

  const endPen = useCallback((opts: { quiet?: boolean } = {}) => {
    const S = s.current, st = S.stroke;
    if (!st) return;
    flush(st, (x, y, dt) => pushPoint(st, x, y, dt));
    S.stroke = null;
    const it = commit(st.pts, S.strokeColor, { snap: live.current.snap, instant: live.current.still, quiet: opts.quiet });
    paintLive();
    if (it) paintItem(it);
  }, [commit, flush, paintItem, paintLive, pushPoint]);

  const beginLaser = useCallback((x: number, y: number) => {
    const S = s.current;
    S.laserStroke = newStroke(x, y);
    S.laser.push({ x, y, t: performance.now() });
  }, []);

  const endLaser = useCallback(() => { s.current.laserStroke = null; }, []);

  const finishIntro = useCallback((keep: boolean) => {
    const S = s.current;
    if (!S.intro) return;
    const cur = S.intro.script[S.intro.idx];
    if (cur && S.intro.phase === "draw") {
      if (cur.tool === "pen") { if (keep) endPen({ quiet: true }); else { S.stroke = null; paintLive(); } }
      else endLaser();
    }
    S.intro = null;
    S.introDone = true;
    setIntroOn(false);
    paintNib();
  }, [endLaser, endPen, paintLive, paintNib]);

  useEffect(() => {
    loopRef.current = (now: number) => {
      const S = s.current, L = live.current;
      S.frame = 0;
      const dtMs = Math.min(50, S.last ? now - S.last : 16.7);
      S.last = now;
      let busy = false, scripted = false;

      // Scripted intro drives the same pipeline as a pointer.
      const I = S.intro;
      if (I) {
        busy = true;
        if (I.startDelay > 0) I.startDelay -= dtMs;
        else {
          const cur = I.script[I.idx];
          if (I.phase === "draw") {
            // Fixed 8ms substeps feed the same pipeline as a pointer, so the sketch lands the same at 30, 60 or 120 fps.
            const steps = Math.max(1, Math.ceil(dtMs / 8)), h = dtMs / steps, dur = cur.ms / Math.max(.1, L.speed);
            let k = 0;
            for (let i = 0; i < steps && k < 1; i++) {
              I.t += h;
              k = clamp(I.t / dur, 0, 1);
              const [x, y] = scriptAt(cur.path, k);
              S.nibAt = [x, y];
              if (cur.tool === "pen") {
                if (!S.stroke) beginPen(x, y, null, L.colors[cur.color]?.id ?? "ink");
                const st = S.stroke!;
                st.raw = [x, y];
                advance(st, h, (px, py, pdt) => pushPoint(st, px, py, pdt));
              } else {
                if (!S.laserStroke) beginLaser(x, y);
                const st = S.laserStroke!;
                st.raw = [x, y];
                advance(st, h, (px, py) => {
                  const lp = S.laser[S.laser.length - 1];
                  if (!lp || Math.hypot(px - lp.x, py - lp.y) > .8 * S.u) S.laser.push({ x: px, y: py, t: now - dtMs + h * (i + 1) });
                });
              }
            }
            scripted = true;
            if (k >= 1) {
              // Only the first snap raises the chip, so the intro reads calmly.
              if (cur.tool === "pen") endPen({ quiet: I.idx > 0 });
              else endLaser();
              I.phase = "pause"; I.t = 0;
            }
          } else {
            I.t += dtMs;
            const pauseMs = cur.pause / Math.max(.1, L.speed), next = I.script[I.idx + 1];
            // The lifted pen glides to where the next stroke starts instead of jumping there.
            if (next) {
              const a = cur.path[cur.path.length - 1], b = next.path[0];
              const g = clamp(I.t / (pauseMs * .82), 0, 1), e = g * g * g * (g * (g * 6 - 15) + 10);
              S.nibAt = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
            }
            if (I.t >= pauseMs) {
              I.idx++; I.phase = "draw"; I.t = 0;
              if (I.idx >= I.script.length) { S.intro = null; S.introDone = true; setIntroOn(false); }
            }
          }
          paintNib();
        }
      }

      // Keyboard pen: held arrows move the cursor smoothly, diagonals included.
      if (S.kbd && S.keys.size) {
        busy = true;
        const v = (S.keys.has("Shift") ? 110 : 340) * S.u * dtMs / 1000;
        let dx = 0, dy = 0;
        if (S.keys.has("ArrowLeft")) dx -= 1;
        if (S.keys.has("ArrowRight")) dx += 1;
        if (S.keys.has("ArrowUp")) dy -= 1;
        if (S.keys.has("ArrowDown")) dy += 1;
        const l = Math.hypot(dx, dy) || 1;
        S.nibAt = [clamp(S.nibAt[0] + dx / l * v, 0, 1000), clamp(S.nibAt[1] + dy / l * v, 0, S.H)];
        if (S.stroke) S.stroke.raw = [...S.nibAt];
        if (S.laserStroke) S.laserStroke.raw = [...S.nibAt];
        paintNib();
      }

      if (S.stroke) {
        const st = S.stroke;
        if (!scripted) advance(st, dtMs, (x, y, dt) => pushPoint(st, x, y, dt));
        paintLive();
        busy = true;
      }
      if (S.laserStroke && !scripted) {
        const st = S.laserStroke;
        advance(st, dtMs, (x, y) => {
          const lp = S.laser[S.laser.length - 1];
          if (!lp || Math.hypot(x - lp.x, y - lp.y) > .8 * S.u) S.laser.push({ x, y, t: now });
        });
        busy = true;
      }
      if (S.laser.length) {
        const life = L.laserFade / Math.max(.1, L.speed);
        while (S.laser.length && now - S.laser[0].t > life) S.laser.shift();
        paintLaser(now);
        if (S.laser.length) busy = true;
      }

      // Snap morphs on a lightly underdamped spring, so shapes land with a small, physical settle.
      const k = MORPH_K * L.speed * L.speed, c = 2 * MORPH_ZETA * Math.sqrt(k), dt = dtMs / 1000;
      for (const id of S.order) {
        const it = S.items.get(id);
        if (!it || !it.to) continue;
        if (Math.abs(it.p - it.target) < .002 && Math.abs(it.v) < .01) {
          if (it.p !== it.target) { it.p = it.target; it.v = 0; paintItem(it); }
          continue;
        }
        if (L.still) { it.p = it.target; it.v = 0; paintItem(it); continue; }
        for (let sub = 0; sub < 2; sub++) {
          const h = dt / 2;
          it.v += (-k * (it.p - it.target) - c * it.v) * h;
          it.p += it.v * h;
        }
        paintItem(it);
        busy = true;
      }

      if (busy && S.inView && S.visible) S.frame = requestAnimationFrame(t => loopRef.current(t));
      else S.last = 0;
    };
  }, [advance, beginLaser, beginPen, endLaser, endPen, paintItem, paintLaser, paintLive, paintNib, pushPoint]);

  /* ---------- measure ---------- */

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const S = s.current;
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight;
      if (!w || !h || (Math.abs(w - S.w) < .5 && Math.abs(h - S.h) < .5)) return;
      S.w = w; S.h = h; S.u = 1000 / w; S.H = h * S.u;
      svg.current?.setAttribute("viewBox", `0 0 1000 ${f1(S.H)}`);
      const gap = 22 * S.u;
      pattern.current?.setAttribute("width", f1(gap));
      pattern.current?.setAttribute("height", f1(gap));
      dot.current?.setAttribute("cx", f1(gap / 2));
      dot.current?.setAttribute("cy", f1(gap / 2));
      dot.current?.setAttribute("r", f1(.9 * S.u));
      if (!S.kbd && !S.intro) S.nibAt = [500, S.H / 2];
      paintNib();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [paintNib]);

  /** Seeds the finished sketch at once: the reduced motion and paused state. */
  const seed = useCallback(() => {
    const S = s.current;
    if (S.order.length || S.introDone) return;
    S.introDone = true;
    for (const st of introScript(S.H)) {
      if (st.tool !== "pen") continue;
      const stroke = newStroke(st.path[0][0], st.path[0][1]);
      const steps = Math.round(st.ms / 8);
      for (let i = 0; i <= steps; i++) {
        const [x, y] = scriptAt(st.path, i / steps);
        stroke.raw = [x, y];
        advance(stroke, 8, (px, py, dt) => pushPoint(stroke, px, py, dt));
      }
      flush(stroke, (px, py, dt) => pushPoint(stroke, px, py, dt));
      const it = commit(stroke.pts, live.current.colors[st.color]?.id ?? "ink", { snap: true, instant: true, quiet: true });
      if (it) paintItem(it);
    }
  }, [advance, commit, flush, paintItem, pushPoint]);

  // Pause offscreen and in background tabs; start the intro the first time the board is seen.
  useEffect(() => {
    const el = root.current, S = s.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      S.inView = entry.isIntersecting;
      if (S.inView) {
        if (intro && !S.introDone && !S.intro && !S.order.length && S.H) {
          if (live.current.still) seed();
          else {
            const script = introScript(S.H);
            S.intro = { script, idx: 0, t: 0, phase: "draw", startDelay: 450 };
            S.nibAt = [...script[0].path[0]];
            setIntroOn(true);
          }
        }
        kick();
      } else if (S.frame) { cancelAnimationFrame(S.frame); S.frame = 0; S.last = 0; }
    }, { threshold: .35 });
    io.observe(el);
    const onVis = () => {
      S.visible = document.visibilityState === "visible";
      if (S.visible) kick();
      else if (S.frame) { cancelAnimationFrame(S.frame); S.frame = 0; S.last = 0; }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(S.frame);
      S.frame = 0;
    };
  }, [intro, kick, seed]);

  // Reduced motion or paused switched on: finish the intro and land every shape now.
  useEffect(() => {
    const S = s.current;
    if (!still) return;
    finishIntro(false);
    S.laser = [];
    paintLaser(performance.now());
    for (const id of S.order) { const it = S.items.get(id); if (it) { it.p = it.target; it.v = 0; paintItem(it); } }
  }, [still, finishIntro, paintItem, paintLaser]);

  // Colors can be swapped by props; repaint.
  useEffect(() => {
    const S = s.current;
    for (const id of S.order) { const it = S.items.get(id); if (it) paintItem(it); }
    paintNib();
  }, [colors, colorId, tool, paintItem, paintNib]);

  useEffect(() => () => { if (chipTimer.current) clearTimeout(chipTimer.current); }, []);

  /* ---------- pointer ---------- */

  const toBoard = (e: { clientX: number; clientY: number }): V => {
    const r = stage.current!.getBoundingClientRect(), S = s.current;
    return [(e.clientX - r.left) * S.u, (e.clientY - r.top) * S.u];
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || s.current.pointer != null) return;
    const S = s.current;
    if (S.intro) finishIntro(false);
    S.kbd = false; S.kDown = false; S.keys.clear();
    S.pointer = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    const [x, y] = toBoard(e);
    S.nibAt = [x, y];
    S.hover = e.pointerType !== "touch";
    setChip(null);
    if (live.current.tool === "pen") beginPen(x, y, e.pointerType === "pen" && e.pressure > 0 ? e.pressure : null, live.current.colorId);
    else beginLaser(x, y);
    setDrawing(true);
    paintNib();
    kick();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const S = s.current;
    if (S.intro) return;
    const [x, y] = toBoard(e);
    S.nibAt = [x, y];
    if (e.pointerType !== "touch") S.hover = true;
    if (S.pointer === e.pointerId) {
      if (S.stroke) { S.stroke.raw = [x, y]; if (e.pointerType === "pen" && e.pressure > 0) S.stroke.pressure = e.pressure; }
      if (S.laserStroke) S.laserStroke.raw = [x, y];
      kick();
    }
    paintNib();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const S = s.current;
    if (S.pointer !== e.pointerId) return;
    S.pointer = null;
    if (S.stroke) endPen();
    if (S.laserStroke) endLaser();
    if (e.pointerType === "touch") S.hover = false;
    setDrawing(false);
    paintNib();
    kick();
  };

  const onPointerLeave = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (s.current.pointer === e.pointerId) return;
    s.current.hover = false;
    paintNib();
  };

  /* ---------- actions ---------- */

  const removeIds = useCallback((ids: string[], msg: string) => {
    if (!ids.length) return;
    const S = s.current;
    S.order = S.order.filter(id => !ids.includes(id));
    setList(l => l.map(x => (ids.includes(x.id) ? { ...x, leaving: true } : x)));
    setChip(c => (c && ids.includes(c.id) ? null : c));
    const drop = () => {
      for (const id of ids) S.items.delete(id);
      setList(l => l.filter(x => !ids.includes(x.id)));
    };
    if (live.current.still) drop(); else setTimeout(drop, 200);
    announce(msg);
    emit();
  }, [announce, emit]);

  const undo = useCallback(() => {
    const S = s.current;
    if (S.intro) finishIntro(true);
    const id = S.order[S.order.length - 1];
    if (!id) { announce("Nothing to undo"); return; }
    const it = S.items.get(id);
    removeIds([id], `Removed ${SHAPE_NAMES[it?.shape ?? "freehand"]}`);
  }, [announce, finishIntro, removeIds]);

  const clear = useCallback(() => {
    const S = s.current;
    if (S.intro) finishIntro(false);
    removeIds([...S.order], "Board cleared");
  }, [finishIntro, removeIds]);

  const keepAsDrawn = useCallback((id: string) => {
    const S = s.current, it = S.items.get(id);
    if (!it || !it.to) return;
    it.target = 0;
    it.shape = "freehand";
    if (live.current.still) { it.p = 0; it.v = 0; }
    paintItem(it);
    setList(l => l.map(x => (x.id === id ? { ...x, shape: "freehand" } : x)));
    setChip(null);
    announce("Kept as drawn");
    emit();
    kick();
  }, [announce, emit, kick, paintItem]);

  const chooseTool = useCallback((t: WhiteboardTool) => {
    setTool(t);
    announce(t === "pen" ? "Pen" : "Laser pointer. Trails fade on their own");
  }, [announce]);

  const toggleSnap = useCallback(() => {
    setSnap(v => { announce(v ? "Shape snapping off" : "Shape snapping on"); return !v; });
  }, [announce]);

  /* ---------- keyboard ---------- */

  const onStageKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const S = s.current, L = live.current;
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (mod || e.altKey) return;
    if (e.key.startsWith("Arrow")) {
      e.preventDefault();
      if (S.intro) finishIntro(true);
      S.kbd = true;
      S.keys.add(e.key);
      if (e.shiftKey) S.keys.add("Shift"); else S.keys.delete("Shift");
      paintNib();
      kick();
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      if (e.repeat) return;
      if (S.intro) finishIntro(true);
      S.kbd = true;
      if (!S.kDown) {
        S.kDown = true;
        const [x, y] = S.nibAt;
        if (L.tool === "pen") beginPen(x, y, null, L.colorId); else beginLaser(x, y);
        setChip(null);
        setDrawing(true);
        announce(L.tool === "pen" ? "Pen down. Move with the arrow keys, press Space to lift" : "Laser on. Move with the arrow keys");
      } else {
        S.kDown = false;
        const snapped = S.stroke != null;
        if (S.stroke) endPen(); else endLaser();
        setDrawing(false);
        if (!snapped) announce("Laser off");
      }
      paintNib();
      kick();
      return;
    }
    if (e.key === "Escape" && S.kDown) {
      e.preventDefault();
      S.kDown = false;
      S.stroke = null; paintLive(); endLaser();
      setDrawing(false);
      announce("Stroke cancelled");
      return;
    }
    const k = e.key.toLowerCase();
    if (k === "p") chooseTool("pen");
    else if (k === "l") chooseTool("laser");
    else if (k === "s") toggleSnap();
  };

  const onStageKeyUp = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const S = s.current;
    S.keys.delete(e.key);
    if (e.key === "Shift") S.keys.delete("Shift");
  };

  const onStageFocus = (e: ReactFocusEvent<HTMLDivElement>) => {
    // Show the keyboard cursor only when focus arrived from the keyboard.
    s.current.kbd = e.currentTarget.matches(":focus-visible") && s.current.pointer == null;
    paintNib();
  };
  const onStageBlur = () => {
    const S = s.current;
    S.keys.clear();
    if (S.kDown) { S.kDown = false; if (S.stroke) endPen(); else endLaser(); setDrawing(false); }
    S.kbd = false;
    paintNib();
  };

  const onToolbarKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    const btns = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (i < 0) return;
    e.preventDefault();
    const next = e.key === "Home" ? 0 : e.key === "End" ? btns.length - 1 : (i + (e.key === "ArrowRight" ? 1 : -1) + btns.length) % btns.length;
    btns[next]?.focus();
  };

  /* ---------- render ---------- */

  const visible = list.filter(x => !x.leaving);
  const count = visible.length;
  const summary = useMemo(() => {
    if (!visible.length) return "The board is empty.";
    const tally = new Map<string, number>();
    for (const x of visible) tally.set(SHAPE_NAMES[x.shape], (tally.get(SHAPE_NAMES[x.shape]) ?? 0) + 1);
    return `On the board: ${[...tally].map(([name, n]) => `${n} ${name}${n > 1 ? "s" : ""}`).join(", ")}.`;
  }, [visible]);

  const rootStyle = { ...(accent ? { "--ctd-accent": accent } : null), ...style } as CSSProperties;
  const chipTransition = still ? { duration: 0 } : motionTokens.spring.snappy;
  const titleId = `${uid}-title`, helpId = `${uid}-help`, sumId = `${uid}-sum`;

  return (
    <section ref={root} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} aria-labelledby={titleId}>
      <header className={styles.header}>
        <h3 id={titleId} className={styles.title}>{label}</h3>
        <p className={styles.count} aria-hidden="true">{count === 1 ? "1 item" : `${count} items`}</p>
      </header>

      <div ref={stage} className={styles.stage} data-tool={tool} data-drawing={drawing ? "" : undefined}>
        <div
          className={styles.canvas}
          role="application"
          aria-roledescription="whiteboard"
          aria-label={`${label} canvas`}
          aria-describedby={`${helpId} ${sumId}`}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
          onKeyDown={onStageKeyDown}
          onKeyUp={onStageKeyUp}
          onFocus={onStageFocus}
          onBlur={onStageBlur}
        >
          <svg ref={svg} className={styles.svg} viewBox="0 0 1000 625" preserveAspectRatio="xMinYMin slice" aria-hidden="true">
            <defs>
              <pattern ref={pattern} id={`${uid}-grid`} patternUnits="userSpaceOnUse" width="22" height="22">
                <circle ref={dot} className={styles.gridDot} cx="11" cy="11" r="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${uid}-grid)`} />
            <g>
              {list.map(x => (
                <path
                  key={x.id}
                  className={styles.ink}
                  data-leaving={x.leaving ? "" : undefined}
                  ref={el => {
                    const it = s.current.items.get(x.id);
                    if (it && it.el !== el) { it.el = el; if (el) paintItem(it); }
                  }}
                />
              ))}
            </g>
            <path ref={livePath} className={styles.ink} />
            <path ref={laserPath} className={styles.laser} />
            <circle ref={nibRing} className={styles.nibRing} cx="500" cy="300" r="8" />
            <circle ref={nib} className={styles.nib} cx="500" cy="300" r="3" />
          </svg>
        </div>

        {hint ? <p className={styles.hint} data-hidden={count || drawing || introOn ? "" : undefined} aria-hidden="true">{hint}</p> : null}

        <AnimatePresence>
          {chip ? (
            <motion.div
              key={chip.id}
              className={styles.chip}
              initial={still ? false : { opacity: 0, y: -8, scale: .96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -6, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.exit] } }}
              transition={chipTransition}
            >
              <Check size={16} strokeWidth={1.75} aria-hidden="true" className={styles.chipIcon} />
              <span className={styles.chipText}>Snapped to {SHAPE_NAMES[chip.shape]}</span>
              <button type="button" className={styles.chipButton} onClick={() => keepAsDrawn(chip.id)}>Keep as drawn</button>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <div className={styles.toolbar} role="toolbar" aria-label="Drawing tools" onKeyDown={onToolbarKeyDown}>
          <div className={styles.group}>
            {(["pen", "laser"] as const).map(t => (
              <button
                key={t}
                type="button"
                className={styles.tool}
                aria-pressed={tool === t}
                aria-label={t === "pen" ? "Pen" : "Laser pointer"}
                title={t === "pen" ? "Pen (P)" : "Laser pointer (L)"}
                onClick={() => chooseTool(t)}
              >
                {tool === t ? (
                  <motion.span layoutId={`${uid}-tool`} className={styles.toolHighlight} transition={still ? { duration: 0 } : motionTokens.spring.morph} aria-hidden="true" />
                ) : null}
                {t === "pen" ? <PenLine size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} /> : <Wand size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />}
              </button>
            ))}
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.group} data-dim={tool === "laser" ? "" : undefined}>
            {colors.map(c => (
              <button
                key={c.id}
                type="button"
                className={styles.swatch}
                aria-pressed={colorId === c.id}
                aria-label={`${c.label} ink`}
                title={`${c.label} ink`}
                onClick={() => { setColorId(c.id); if (tool !== "pen") setTool("pen"); announce(`${c.label} ink`); }}
                style={{ "--swatch": c.value } as CSSProperties}
              >
                <span className={styles.swatchDot} aria-hidden="true" />
              </button>
            ))}
          </div>
          <span className={styles.divider} aria-hidden="true" />
          <div className={styles.group}>
            <button type="button" className={styles.tool} data-toggle="" aria-pressed={snap} aria-label="Snap shapes" title="Snap shapes (S)" onClick={toggleSnap}>
              <Shapes size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
            </button>
            <button type="button" className={styles.tool} aria-label="Undo last stroke" title="Undo (Ctrl or Cmd Z)" onClick={undo} disabled={!count && !introOn}>
              <Undo2 size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
            </button>
            <button type="button" className={styles.tool} aria-label="Clear board" title="Clear board" onClick={clear} disabled={!count && !introOn}>
              <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" className={styles.icon} />
            </button>
          </div>
        </div>
      </div>

      <p id={helpId} className={styles.srOnly}>
        Draw with a pointer, or with the keyboard: arrow keys move the cursor, Shift moves slowly, Space or Enter puts the pen down and lifts it, Escape cancels a stroke. P picks the pen, L the laser pointer, S turns shape snapping on or off, and Control or Command Z undoes.
      </p>
      <p id={sumId} className={styles.srOnly}>{summary}</p>
      <span className={styles.srOnly} role="status" aria-live="polite">{message}</span>
    </section>
  );
}

export default CursorTrailDraw;
