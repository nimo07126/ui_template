"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import {
  CUBE_STATUSES, LINE_LIFE, LINE_PERIOD, TAU, blendPose, blinkClosure, easeInOut, forwardSpin, lineHash, poseAt, smooth, stillPose,
  type CubePose, type CubeStatus,
} from "./cube-mascot-pose";
import styles from "./cube-mascot.module.css";

export { CUBE_STATUSES, type CubeStatus };

export interface CubeMascotProps {
  /** What the assistant is doing. Leave unset to play through every state on a loop (the docs demo). */
  status?: CubeStatus;
  /** Width and height in px, 24 to 160. Below 56 a compact drawing takes over. */
  size?: number;
  /** Any CSS color for the cube body. Defaults to the accent. */
  color?: string;
  /** Any CSS color for the eyes, brows and mouth. Defaults to the accent foreground. */
  faceColor?: string;
  /** Contact shadow and the printed lines while writing. Drawn at 56px and up. */
  ground?: boolean;
  /** Freeze on the current frame. The cube also pauses off screen and in background tabs. */
  paused?: boolean;
  /** Used in the accessible label, for example "Atlas, thinking". */
  name?: string;
  /** Overrides the whole accessible label. */
  label?: string;
  /** Announce status changes in a polite live region. */
  announce?: boolean;
  /** Called when the self-playing loop (status unset) moves to the next state. */
  onStatusChange?: (status: CubeStatus) => void;
  className?: string;
  style?: CSSProperties;
}

const STATUS_TEXT: Record<CubeStatus, string> = {
  idle: "ready", thinking: "thinking", writing: "writing", done: "done", error: "something went wrong",
};
const AUTO_ORDER: CubeStatus[] = ["idle", "thinking", "writing", "done", "error"];
const AUTO_SECONDS: Record<CubeStatus, number> = { idle: 2.4, thinking: 2.75, writing: 3.2, done: 2.3, error: 1.7 };

const DEG = Math.PI / 180;
const ELEVATION = 32 * DEG;
const CE = Math.cos(ELEVATION);
const SE = Math.sin(ELEVATION);
const BASE_YAW = -30 * DEG;
/** Light from the upper left, slightly in front. Tones are relative to the face side at rest. */
const LIGHT = [-0.45, 0.75, 0.48];
const REST_TONE = -0.5 * LIGHT[0] + -0.866 * SE * LIGHT[1] + 0.866 * CE * LIGHT[2];
const GROUND = -1.06;

interface Geometry {
  S: number; cx: number; cy: number; radius: number;
  eyeX: number; eyeY: number; eyeW: number; eyeH: number; gazeX: number; gazeY: number;
  stroke: number; mouthY: number; mouth: boolean; ground: boolean;
  spark: [number, number, number]; spark2: [number, number, number] | null;
}

function geometry(compact: boolean, ground: boolean): Geometry {
  if (compact) {
    const S = 28;
    return {
      S, cx: 50, cy: 51, radius: 0.3 * S,
      eyeX: 16, eyeY: -4, eyeW: 14, eyeH: 24, gazeX: 6, gazeY: 6,
      stroke: 6, mouthY: 14, mouth: false, ground: false,
      spark: [50 + 1.2 * S, 51 - 1.36 * S, 0.38 * S], spark2: null,
    };
  }
  const S = 24;
  const cy = ground ? 47.6 : 50;
  return {
    S, cx: 50, cy, radius: 0.26 * S,
    eyeX: 14, eyeY: -8, eyeW: 10, eyeH: 17, gazeX: 8, gazeY: 7,
    stroke: 3.4, mouthY: 12, mouth: true, ground,
    spark: [50 + 1.35 * S, cy - 1.5 * S, 0.42 * S],
    spark2: [50 + 1.88 * S, cy - 0.98 * S, 0.19 * S],
  };
}

interface Rot { cy: number; sy: number; cr: number; sr: number; cp: number; sp: number }
const rotation = (yaw: number, roll: number, pitch: number): Rot => ({
  cy: Math.cos(yaw), sy: Math.sin(yaw), cr: Math.cos(roll), sr: Math.sin(roll), cp: Math.cos(pitch), sp: Math.sin(pitch),
});
/** Yaw, then roll, then pitch, then the fixed camera elevation. Returns view space: x right, y up, z to the viewer. */
function view(r: Rot, x: number, y: number, z: number, out: number[]) {
  const x1 = x * r.cy + z * r.sy;
  const z1 = -x * r.sy + z * r.cy;
  const x2 = x1 * r.cr - y * r.sr;
  const y2 = x1 * r.sr + y * r.cr;
  const y3 = y2 * r.cp - z1 * r.sp;
  const z3 = y2 * r.sp + z1 * r.cp;
  out[0] = x2;
  out[1] = y3 * CE - z3 * SE;
  out[2] = y3 * SE + z3 * CE;
}

const f2 = (n: number) => (Math.round(n * 100) / 100).toString();
const set = (el: Element | null | undefined, name: string, value: string) => {
  if (el && el.getAttribute(name) !== value) el.setAttribute(name, value);
};
const show = (el: Element | null | undefined, on: boolean) => set(el, "display", on ? "inline" : "none");

/** Side face k: normal, in-plane right vector, up vector. k = 4 is the top. */
function faceBasis(k: number): { n: number[]; u: number[]; v: number[] } {
  if (k === 4) return { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1] };
  const a = k * Math.PI / 2;
  const s = Math.round(Math.sin(a));
  const c = Math.round(Math.cos(a));
  return { n: [s, 0, c], u: [c, 0, -s], v: [0, 1, 0] };
}
const BASES = [0, 1, 2, 3, 4].map(faceBasis);
const CORNERS = [[-1, 1], [1, 1], [1, -1], [-1, -1]];

/** Tone 0 is the face side at rest, about +0.63 the top, about -0.63 the shaded side. */
function toneFill(t: number) {
  const amount = Math.round(Math.min(100, Math.abs(t) / 0.63 * 100));
  if (amount === 0) return "var(--cube-front)";
  return `color-mix(in oklab, var(--cube-front), var(${t > 0 ? "--cube-top" : "--cube-side"}) ${amount}%)`;
}

type Pt = [number, number];
const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
/** Convex hull, monotone chain; drops collinear points. */
function hull(points: Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-6) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-6) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
/** A convex polygon with each corner rounded (radius r, tangents limited to half of the shorter edge). */
function rounded(poly: Pt[], r: number) {
  const n = poly.length;
  let d = "";
  for (let i = 0; i < n; i++) {
    const prev = poly[(i + n - 1) % n], cur = poly[i], next = poly[(i + 1) % n];
    const ax = prev[0] - cur[0], ay = prev[1] - cur[1], bx = next[0] - cur[0], by = next[1] - cur[1];
    const la = Math.hypot(ax, ay) || 1, lb = Math.hypot(bx, by) || 1;
    const angle = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb))));
    const t = Math.min(r / Math.tan(angle / 2 || 1e-6), la / 2, lb / 2);
    d += `${i ? "L" : "M"}${f2(cur[0] + ax / la * t)} ${f2(cur[1] + ay / la * t)}Q${f2(cur[0])} ${f2(cur[1])} ${f2(cur[0] + bx / lb * t)} ${f2(cur[1] + by / lb * t)}`;
  }
  return d + "Z";
}

function starPath(r: number) {
  const c = r * 0.16;
  return `M0 ${f2(-r)}Q${f2(c)} ${f2(-c)} ${f2(r)} 0Q${f2(c)} ${f2(c)} 0 ${f2(r)}Q${f2(-c)} ${f2(c)} ${f2(-r)} 0Q${f2(-c)} ${f2(-c)} 0 ${f2(-r)}Z`;
}

interface Nodes {
  clip: SVGPathElement;
  under: SVGPathElement;
  fills: SVGPathElement[];
  shadow: SVGPathElement;
  feats: { g: SVGGElement; eyes: SVGRectElement[]; arcs: SVGPathElement[]; brows: SVGPathElement[]; mouth: SVGPathElement }[];
  lines: SVGPathElement[];
  spark: SVGGElement;
  spark2: SVGGElement;
}

function collect(svg: SVGSVGElement): Nodes {
  const all = <T extends Element>(sel: string, root: Element = svg) => Array.from(root.querySelectorAll<T>(sel));
  return {
    clip: svg.querySelector<SVGPathElement>("[data-clip]")!,
    under: svg.querySelector<SVGPathElement>("[data-under]")!,
    fills: all<SVGPathElement>("[data-fill]"),
    shadow: svg.querySelector<SVGPathElement>("[data-shadow]")!,
    feats: all<SVGGElement>("[data-feat]").map(g => ({
      g,
      eyes: all<SVGRectElement>("[data-eye]", g),
      arcs: all<SVGPathElement>("[data-arc]", g),
      brows: all<SVGPathElement>("[data-brow]", g),
      mouth: g.querySelector<SVGPathElement>("[data-mouth]")!,
    })),
    lines: all<SVGPathElement>("[data-line]"),
    spark: svg.querySelector<SVGGElement>("[data-spark]")!,
    spark2: svg.querySelector<SVGGElement>("[data-spark2]")!,
  };
}

function draw(n: Nodes, G: Geometry, p: CubePose, g: number, lineClock: number | null) {
  const theta = BASE_YAW + p.yaw * DEG - p.spin * Math.PI / 2;
  const r = rotation(theta, p.roll * DEG, p.pitch * DEG);
  const S = G.S;
  const ox = G.cx + S * p.shift;
  const oy = G.cy - S * p.lift;
  const tmp = [0, 0, 0];
  const nz: number[] = [];
  const sx = (x: number) => ox + S * x;
  const sy = (y: number) => oy - S * y;

  // Silhouette: the hull of the eight corners with rounded corners clips the faces, so the outline is soft
  // while the edges between faces stay exact.
  const corners: Pt[] = [];
  for (let i = 0; i < 8; i++) {
    view(r, i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, tmp);
    corners.push([sx(tmp[0]), sy(tmp[1])]);
  }
  const outline = rounded(hull(corners), G.radius);
  set(n.clip, "d", outline);
  set(n.under, "d", outline);

  // Faces, each shaded by how it faces the light. A face turned away is not drawn.
  for (let k = 0; k < 5; k++) {
    const { n: nn, u, v } = BASES[k];
    view(r, nn[0], nn[1], nn[2], tmp);
    nz[k] = tmp[2];
    const el = n.fills[k];
    if (tmp[2] <= 0) { show(el, false); continue; }
    const tone = tmp[0] * LIGHT[0] + tmp[1] * LIGHT[1] + tmp[2] * LIGHT[2] - REST_TONE;
    let d = "";
    CORNERS.forEach(([a, b], i) => {
      view(r, nn[0] + a * u[0] + b * v[0], nn[1] + a * u[1] + b * v[1], nn[2] + a * u[2] + b * v[2], tmp);
      d += `${i ? "L" : "M"}${f2(sx(tmp[0]))} ${f2(sy(tmp[1]))}`;
    });
    set(el, "d", d + "Z");
    show(el, true);
    const fill = toneFill(tone);
    if (el.dataset.tone !== fill) { el.dataset.tone = fill; el.style.fill = fill; }
  }

  // Face features, painted on each side face through its projected basis.
  const closure = p.blink > 0 ? p.blink * blinkClosure(g) : 0;
  for (let k = 0; k < 4; k++) {
    const f = n.feats[k];
    const visible = p.face[k] * smooth(0.08, 0.4, nz[k]);
    if (visible < 0.005) { show(f.g, false); continue; }
    const { n: nn, u, v } = BASES[k];
    const ru = [0, 0, 0], rv = [0, 0, 0], rc = [0, 0, 0];
    view(r, u[0], u[1], u[2], ru);
    view(r, v[0], v[1], v[2], rv);
    view(r, nn[0], nn[1], nn[2], rc);
    const q = S / 50;
    show(f.g, true);
    set(f.g, "opacity", f2(visible));
    set(f.g, "transform", `matrix(${[q * ru[0], -q * ru[1], -q * rv[0], q * rv[1], sx(rc[0]), sy(rc[1])].map(x => x.toFixed(4)).join(" ")})`);

    const gx = p.gx * G.gazeX;
    const gy = p.gy * G.gazeY;
    const open = p.open * (1 - closure) * p.faceOpen[k] * (1 - p.happy);
    const h = Math.max(G.eyeW * 0.3, G.eyeH * open);
    const pillOpacity = f2(1 - smooth(0.55, 0.95, p.happy));
    const arcOpacity = f2(smooth(0.35, 0.85, p.happy));
    const arcH = (0.3 + 0.7 * p.happy) * G.eyeW * 0.8;
    const half = G.eyeW * 0.66;
    [-1, 1].forEach((side, i) => {
      const ex = side * G.eyeX + gx;
      const ey = G.eyeY + gy;
      const eye = f.eyes[i];
      set(eye, "x", f2(ex - G.eyeW / 2));
      set(eye, "y", f2(ey - h / 2));
      set(eye, "width", f2(G.eyeW));
      set(eye, "height", f2(h));
      set(eye, "rx", f2(G.eyeW / 2));
      set(eye, "opacity", pillOpacity);
      set(f.arcs[i], "d", `M${f2(ex - half)} ${f2(ey + arcH * 0.45)}Q${f2(ex)} ${f2(ey - arcH * 1.1)} ${f2(ex + half)} ${f2(ey + arcH * 0.45)}`);
      set(f.arcs[i], "opacity", arcOpacity);
      set(f.arcs[i], "stroke-width", f2(G.stroke * 1.15));
      // Worried brows: the inner ends rise.
      const by = G.eyeY - G.eyeH / 2 - G.eyeW * 0.5 + gy * 0.6;
      const inner = side * (G.eyeX - G.eyeW * 0.7) + gx;
      const outer = side * (G.eyeX + G.eyeW * 0.7) + gx;
      set(f.brows[i], "d", `M${f2(outer)} ${f2(by + 2 * p.worry)}L${f2(inner)} ${f2(by - 3.5 * p.worry)}`);
      set(f.brows[i], "opacity", f2(p.worry));
      set(f.brows[i], "stroke-width", f2(G.stroke));
    });
    show(f.mouth, G.mouth);
    if (G.mouth) {
      const w = 1.5 + 5.5 * p.mouthW;
      const my = G.mouthY + gy * 0.5;
      const c = p.mouth * 5.5;
      const mx = gx * 0.5;
      set(f.mouth, "d", `M${f2(mx - w)} ${f2(my - c * 0.3)}Q${f2(mx)} ${f2(my + c)} ${f2(mx + w)} ${f2(my - c * 0.3)}`);
      set(f.mouth, "stroke-width", f2(G.stroke));
    }
  }

  // Ground: contact shadow and printed lines turn with the cube but ignore its tilt and float.
  const flat = rotation(theta, 0, 0);
  const gxs = (x: number) => G.cx + S * p.shift + S * x;
  const gys = (y: number) => G.cy - S * y;
  show(n.shadow, G.ground);
  if (G.ground) {
    const square: Pt[] = CORNERS.map(([a, b]) => {
      view(flat, a * 1.08, GROUND, b * 1.08, tmp);
      return [gxs(tmp[0]), gys(tmp[1])];
    });
    set(n.shadow, "d", rounded(square, G.radius));
    set(n.shadow, "opacity", f2(Math.max(0.4, 1 - Math.max(0, p.lift) * 6)));
  }

  const { n: fn, u: fu } = BASES[0];
  for (let j = 0; j < 4; j++) {
    const line = n.lines[j];
    const index = lineClock === null ? -1 : Math.floor(lineClock / LINE_PERIOD) - j;
    if (!G.ground || lineClock === null || p.ink < 0.005 || index < 0) { show(line, false); continue; }
    const age = (lineClock - index * LINE_PERIOD) / LINE_LIFE;
    const opacity = p.ink * smooth(0, 0.18, age) * (1 - smooth(0.62, 1, age));
    const dist = 1.34 + age * 0.92;
    const span = index % 5 === 4 ? 0.45 + 0.35 * lineHash(index) : 1.05 + 0.4 * lineHash(index);
    let d = "";
    [-0.74, -0.74 + span].forEach((a, i) => {
      view(flat, fn[0] * dist + fu[0] * a, GROUND, fn[2] * dist + fu[2] * a, tmp);
      d += `${i ? "L" : "M"}${f2(G.cx + S * tmp[0])} ${f2(gys(tmp[1]))}`;
    });
    set(line, "d", d);
    set(line, "opacity", f2(opacity));
    show(line, opacity > 0.005);
  }

  // Done sparkle: grows and turns in, then twinkles slowly.
  const sparkles: [SVGGElement, [number, number, number] | null, number][] = [
    [n.spark, G.spark, p.sparkle],
    [n.spark2, G.spark2, Math.max(0, (p.sparkle - 0.3) / 0.7)],
  ];
  sparkles.forEach(([el, spot, amount], i) => {
    if (!spot || amount < 0.005) { show(el, false); return; }
    const twinkle = 1 + 0.07 * amount * Math.sin(TAU * g / 2.4 + i * 1.7);
    show(el, true);
    set(el, "opacity", f2(Math.min(1, amount * 1.6)));
    set(el, "transform", `translate(${f2(spot[0])} ${f2(spot[1])}) rotate(${f2(-60 * (1 - amount))}) scale(${(amount * twinkle).toFixed(3)})`);
    set(el.firstElementChild, "d", starPath(spot[2]));
  });
}

interface Engine {
  setStatus: (status: CubeStatus) => void;
  setOptions: (options: { compact: boolean; ground: boolean; paused: boolean; auto: boolean }) => void;
  destroy: () => void;
}

function createEngine(svg: SVGSVGElement, initial: CubeStatus, onAutoNext: (status: CubeStatus) => void): Engine {
  const nodes = collect(svg);
  let G = geometry(false, true);
  let status = initial;
  let clock = 0;
  let statusStart = 0;
  let blendStart = -Infinity;
  let blendLength = 0.42;
  let writeStart: number | null = initial === "writing" ? 0 : null;
  let snapshot: CubePose = poseAt(initial, 0, 0);
  let current: CubePose = snapshot;
  let paused = false;
  let auto = false;
  let onScreen = true;
  let pageVisible = typeof document === "undefined" ? true : !document.hidden;
  let reduced = false;
  let raf = 0;
  let last = 0;
  let autoAsked = false;

  const running = () => !paused && onScreen && pageVisible && !reduced;

  const frame = () => {
    if (reduced) {
      current = stillPose(status);
      draw(nodes, G, current, 0, status === "writing" ? LINE_PERIOD * 2.5 : null);
      return;
    }
    const target = poseAt(status, clock - statusStart, clock);
    const k = (clock - blendStart) / blendLength;
    current = k < 1 ? blendPose(snapshot, target, easeInOut(k)) : target;
    draw(nodes, G, current, clock, writeStart === null ? null : clock - writeStart);
  };

  const tick = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    clock += dt;
    if (auto && !autoAsked && clock - statusStart > AUTO_SECONDS[status]) {
      autoAsked = true;
      onAutoNext(AUTO_ORDER[(AUTO_ORDER.indexOf(status) + 1) % AUTO_ORDER.length]);
    }
    frame();
    raf = requestAnimationFrame(tick);
  };

  const sync = () => {
    const should = running();
    if (should && !raf) { last = 0; raf = requestAnimationFrame(tick); }
    if (!should && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!should) frame();
  };

  // Reduced motion still advances the self-playing loop, on a plain timer.
  let reducedTimer = 0;
  const scheduleReducedAuto = () => {
    window.clearTimeout(reducedTimer);
    if (reduced && auto && !paused && onScreen && pageVisible) {
      reducedTimer = window.setTimeout(() => onAutoNext(AUTO_ORDER[(AUTO_ORDER.indexOf(status) + 1) % AUTO_ORDER.length]), AUTO_SECONDS[status] * 1000);
    }
  };

  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  reduced = query.matches;
  const onQuery = () => { reduced = query.matches; sync(); scheduleReducedAuto(); };
  query.addEventListener("change", onQuery);

  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    sync();
    scheduleReducedAuto();
  }, { rootMargin: "48px" });
  observer.observe(svg);
  const onVisibility = () => { pageVisible = !document.hidden; sync(); scheduleReducedAuto(); };
  document.addEventListener("visibilitychange", onVisibility);

  frame();

  return {
    setStatus(next) {
      if (next === status) return;
      snapshot = forwardSpin(current);
      if (next === "writing" && (writeStart === null || current.ink < 0.05)) writeStart = clock;
      status = next;
      statusStart = clock;
      autoAsked = false;
      blendLength = next === "error" ? 0.24 : 0.42;
      blendStart = running() ? clock : -Infinity;
      if (!running()) frame();
      scheduleReducedAuto();
    },
    setOptions(options) {
      G = geometry(options.compact, options.ground);
      paused = options.paused;
      auto = options.auto;
      sync();
      scheduleReducedAuto();
    },
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(reducedTimer);
      query.removeEventListener("change", onQuery);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}

/**
 * An isometric cube mascot for AI generation states: three shaded faces, a face painted on the front,
 * and a motion per status that blends from the pose on screen.
 */
export function CubeMascot({
  status,
  size = 96,
  color,
  faceColor,
  ground = true,
  paused = false,
  name = "Assistant",
  label,
  announce = false,
  onStatusChange,
  className,
  style,
}: CubeMascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const clipId = `cube-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const engineRef = useRef<Engine | null>(null);
  const [autoStatus, setAutoStatus] = useState<CubeStatus>("idle");
  const onChangeRef = useRef(onStatusChange);
  useEffect(() => { onChangeRef.current = onStatusChange; }, [onStatusChange]);

  // Resuming the self-playing loop continues from the status that was last shown.
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    setPrevStatus(status);
    if (status === undefined && prevStatus !== undefined) setAutoStatus(prevStatus);
  }
  const auto = status === undefined;
  const shown = status ?? autoStatus;
  const compact = size < 56;
  const initialRef = useRef(shown);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const engine = createEngine(svg, initialRef.current, next => {
      setAutoStatus(next);
      onChangeRef.current?.(next);
    });
    engineRef.current = engine;
    return () => { engine.destroy(); engineRef.current = null; };
  }, []);

  useLayoutEffect(() => {
    engineRef.current?.setOptions({ compact, ground, paused, auto });
  }, [compact, ground, paused, auto]);

  useLayoutEffect(() => {
    engineRef.current?.setStatus(shown);
  }, [shown]);

  const text = label ?? `${name}, ${STATUS_TEXT[shown]}`;
  const vars = { width: size, height: size, ...(color ? { "--cube-body": color } : null), ...(faceColor ? { "--cube-ink": faceColor } : null), ...style } as CSSProperties;

  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")} style={vars} data-status={shown}>
      <svg ref={svgRef} className={styles.svg} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={text}>
        <defs>
          <clipPath id={clipId}><path data-clip /></clipPath>
        </defs>
        <path data-shadow className={styles.shadow} display="none" />
        <g clipPath={`url(#${clipId})`}>
          <path data-under className={styles.under} />
          {[0, 1, 2, 3, 4].map(k => <path key={k} data-fill={k} className={styles.fill} display="none" />)}
          {[0, 1, 2, 3].map(k => (
            <g key={k} data-feat={k} display="none">
              <rect data-eye className={styles.eye} />
              <rect data-eye className={styles.eye} />
              <path data-arc className={styles.stroke} />
              <path data-arc className={styles.stroke} />
              <path data-brow className={styles.stroke} />
              <path data-brow className={styles.stroke} />
              <path data-mouth className={styles.stroke} />
            </g>
          ))}
        </g>
        {[0, 1, 2, 3].map(k => <path key={k} data-line className={styles.line} display="none" />)}
        <g data-spark display="none"><path className={styles.spark} /></g>
        <g data-spark2 display="none"><path className={styles.spark} /></g>
      </svg>
      {announce ? <span className={styles.live} role="status" aria-live="polite">{text}</span> : null}
    </span>
  );
}

export default CubeMascot;
