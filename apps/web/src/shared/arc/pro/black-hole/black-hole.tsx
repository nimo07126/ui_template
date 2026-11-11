"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./black-hole.module.css";

export interface BlackHoleOptions {
  /** Where the singularity opens, in viewport coordinates. Defaults to the centre of the targets. */
  origin?: { x: number; y: number };
  /** Length of the effect in seconds. Defaults to 1.3. */
  duration?: number;
}

export interface BlackHoleHandle {
  /**
   * Pulls the elements into a tiny singularity. The surrounding content bends around it while they spiral in, then the
   * hole collapses with a soft shockwave. The elements stay hidden afterwards; remove them from your data when it resolves.
   */
  swallow: (targets: Element[], options?: BlackHoleOptions) => Promise<void>;
  /**
   * The reverse. Call it right after the elements are back in the DOM (a layout effect is ideal): they are hidden at once,
   * the list is given a moment to make room, then they spiral back out of the hole into place.
   */
  release: (targets: Element[], options?: BlackHoleOptions) => Promise<void>;
}

/**
 * A delete and archive transition drawn on the GPU. Everything inside is painted once to a texture, the chosen items are
 * pulled along a logarithmic spiral into a point, stretching as the inner edge falls faster than the outer one, and the rest
 * of the content is gravitationally lensed around the hole. Wrap the list whose items you remove.
 */
export interface BlackHoleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const seg = (t: number, a: number, b: number) => clamp((t - a) / (b - a));
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const inCubic = (x: number) => x * x * x;
const outBack = (x: number) => { const c = 1.6; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
/** Resolves a CSS colour (oklch, hex, anything) to linear 0 to 1 channels through a 1px canvas. */
function rgbOf(color: string, fallback: [number, number, number]): [number, number, number] {
  const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!ctx || !color) return fallback;
  ctx.fillStyle = "#000"; ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return [r / 255, g / 255, b / 255];
}
const nextFrame = () => new Promise<number>(resolve => requestAnimationFrame(resolve));

/* ---------- DOM painter: backgrounds, borders, text, images and inline SVG ---------- */

type PaintMode = { skip?: Set<Element>; only?: Set<Element> };

function radii(cs: CSSStyleDeclaration, s: number) {
  return [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map(v => (parseFloat(v) || 0) * s);
}
function visibleColor(color: string) {
  return !!color && color !== "transparent" && !/rgba?\(.*,\s*0\)$/.test(color) && !/\/\s*0\)$/.test(color);
}
async function loadSvgs(root: Element) {
  const map = new Map<Element, HTMLImageElement>();
  await Promise.all([...root.querySelectorAll("svg")].map(async svg => {
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const copy = svg.cloneNode(true) as SVGElement;
    copy.setAttribute("width", String(rect.width));
    copy.setAttribute("height", String(rect.height));
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const markup = new XMLSerializer().serializeToString(copy).replace(/currentColor/g, getComputedStyle(svg).color);
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    try { await image.decode(); map.set(svg, image); } catch { /* skip glyphs that fail to decode */ }
  }));
  return map;
}

function paintTree(ctx: CanvasRenderingContext2D, node: Element, origin: DOMRect, s: number, mode: PaintMode, svgs: Map<Element, HTMLImageElement>, painting: boolean, forced: boolean) {
  if (mode.skip?.has(node)) return;
  if (mode.only?.has(node)) { painting = true; forced = true; }
  const cs = getComputedStyle(node);
  if (cs.display === "none") return;
  const opacity = parseFloat(cs.opacity);
  if (!forced && opacity === 0) return;
  const shown = forced || cs.visibility !== "hidden";
  const rect = node.getBoundingClientRect();
  const x = (rect.left - origin.left) * s, y = (rect.top - origin.top) * s, w = rect.width * s, h = rect.height * s;
  ctx.save();
  if (painting && !forced) ctx.globalAlpha *= opacity;
  if (painting && shown && w > 0 && h > 0) {
    const r = radii(cs, s);
    if (visibleColor(cs.backgroundColor)) {
      ctx.fillStyle = cs.backgroundColor;
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill();
    }
    const widths = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map(v => (parseFloat(v) || 0) * s);
    const colors = [cs.borderTopColor, cs.borderRightColor, cs.borderBottomColor, cs.borderLeftColor];
    if (widths.every(v => v > 0 && v === widths[0]) && colors.every(c => c === colors[0]) && visibleColor(colors[0])) {
      ctx.strokeStyle = colors[0]; ctx.lineWidth = widths[0];
      ctx.beginPath(); ctx.roundRect(x + widths[0] / 2, y + widths[0] / 2, w - widths[0], h - widths[0], r.map(v => Math.max(0, v - widths[0] / 2))); ctx.stroke();
    } else {
      widths.forEach((width, i) => {
        if (!width || !visibleColor(colors[i])) return;
        ctx.fillStyle = colors[i];
        if (i === 0) ctx.fillRect(x, y, w, width);
        if (i === 1) ctx.fillRect(x + w - width, y, width, h);
        if (i === 2) ctx.fillRect(x, y + h - width, w, width);
        if (i === 3) ctx.fillRect(x, y, width, h);
      });
    }
    if (node instanceof HTMLImageElement && node.complete && node.naturalWidth) {
      ctx.save();
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
      const ratio = node.naturalWidth / node.naturalHeight, box = w / h;
      const cover = cs.objectFit === "cover";
      let dw = w, dh = h;
      if (cover) { if (ratio > box) dw = h * ratio; else dh = w / ratio; }
      try { ctx.drawImage(node, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); } catch { /* ignore */ }
      ctx.restore();
    }
    const svg = svgs.get(node);
    if (svg) ctx.drawImage(svg, x, y, w, h);
    if (cs.overflow !== "visible" && cs.overflowX !== "visible") {
      ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.clip();
    }
  }
  if (node instanceof SVGElement || node instanceof HTMLImageElement || node instanceof HTMLCanvasElement) { ctx.restore(); return; }
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (!painting || !shown) continue;
      const text = child.textContent ?? "";
      if (!text.trim()) continue;
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${parseFloat(cs.fontSize) * s}px ${cs.fontFamily}`;
      ctx.fillStyle = cs.color;
      if ("letterSpacing" in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = cs.letterSpacing === "normal" ? "0px" : `${parseFloat(cs.letterSpacing) * s}px`;
      ctx.textBaseline = "alphabetic";
      const metrics = ctx.measureText("Hg");
      const ascent = metrics.fontBoundingBoxAscent ?? parseFloat(cs.fontSize) * s * .8, descent = metrics.fontBoundingBoxDescent ?? parseFloat(cs.fontSize) * s * .2;
      const range = document.createRange();
      for (const match of text.matchAll(/\S+/g)) {
        range.setStart(child, match.index ?? 0);
        range.setEnd(child, (match.index ?? 0) + match[0].length);
        const box = range.getBoundingClientRect();
        if (!box.width) continue;
        const bx = (box.left - origin.left) * s, by = (box.top - origin.top) * s, bh = box.height * s;
        ctx.fillText(match[0], bx, by + (bh - ascent - descent) / 2 + ascent);
      }
    } else if (child instanceof Element) {
      paintTree(ctx, child, origin, s, mode, svgs, painting, forced);
    }
  }
  ctx.restore();
}

/* ---------- WebGL ---------- */

const QUAD_VS = `#version 300 es
in vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const LENS_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; uniform vec2 uRes; uniform vec2 uO; uniform float uLens;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 d = p - uO; float r = length(d);
  vec2 q = p;
  if (uLens > 0.0) { float beta = r - uLens * uLens / max(r, 0.5); q = uO + d / max(r, 0.001) * beta; }
  vec2 uv = q / uRes;
  color = (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) ? vec4(0.0) : texture(uTex, uv);
}`;

const MESH_VS = `#version 300 es
in vec2 aPos;
uniform vec2 uRes; uniform vec2 uO; uniform float uT; uniform float uMaxR; uniform float uSpin;
out vec2 vUv; out float vFade;
void main() {
  vec2 v = aPos - uO; float r0 = length(v); float a0 = atan(v.y, v.x);
  float dn = clamp(r0 / uMaxR, 0.0, 1.0);
  float start = 0.08 + 0.36 * dn;
  float u = clamp((uT - start) / 0.46, 0.0, 1.0);
  float f = u * u * (1.5 - 0.5 * u);
  float r = r0 * (1.0 - f);
  float a = a0 + uSpin * -log(max(1.0 - f, 0.015)) * 0.55;
  vec2 p = uO + vec2(cos(a), sin(a)) * r;
  vUv = aPos / uRes;
  vFade = 1.0 - smoothstep(0.72, 0.98, f);
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
}`;

const MESH_FS = `#version 300 es
precision highp float;
uniform sampler2D uTex; in vec2 vUv; in float vFade; out vec4 color;
void main() { color = texture(uTex, vUv) * vFade; }`;

const CORE_FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform vec2 uO; uniform float uCore; uniform float uWave; uniform float uWaveAlpha; uniform float uDark; uniform float uPx; uniform vec3 uAccent;
out vec4 color;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  float r = length(p - uO);
  float halo = uCore > 0.0 ? exp(-max(r - uCore, 0.0) / (uCore * 1.6)) * 0.22 * (1.0 - uDark * 0.4) : 0.0;
  float ring = uCore > 0.0 ? exp(-pow((r - uCore * 1.18) / (0.8 * uPx), 2.0)) * mix(0.5, 0.65, uDark) : 0.0;
  float core = uCore > 0.0 ? 1.0 - smoothstep(uCore - 1.2 * uPx, uCore + 0.4 * uPx, r) : 0.0;
  float wave = uWaveAlpha * exp(-pow((r - uWave) / (2.5 * uPx), 2.0));
  vec4 c = vec4(0.0);
  c = vec4(0.0, 0.0, 0.0, halo);
  // The photon ring and the closing shockwave wear the accent; the core and its halo stay ink.
  c = vec4(uAccent * ring, ring) + c * (1.0 - ring);
  c = vec4(uAccent * wave * 0.6, wave * 0.6) + c * (1.0 - wave * 0.6);
  c = vec4(vec3(0.0), core) + c * (1.0 - core);
  color = c;
}`;

type GL = WebGL2RenderingContext;
function program(gl: GL, vs: string, fs: string) {
  const make = (type: number, src: string) => { const sh = gl.createShader(type)!; gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
  const p = gl.createProgram()!;
  gl.attachShader(p, make(gl.VERTEX_SHADER, vs)); gl.attachShader(p, make(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, "aPos");
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link failed");
  const uniforms = new Map<string, WebGLUniformLocation | null>();
  return { p, u: (name: string) => { if (!uniforms.has(name)) uniforms.set(name, gl.getUniformLocation(p, name)); return uniforms.get(name)!; } };
}

type Base = { gl: GL; lens: ReturnType<typeof program>; mesh: ReturnType<typeof program>; core: ReturnType<typeof program>; quad: WebGLBuffer };
type Scene = Base & { grid: WebGLBuffer; gridCount: number; rest: WebGLTexture; sel: WebGLTexture };

function texture(gl: GL, source: HTMLCanvasElement) {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

function gridBuffer(gl: GL, w: number, h: number, cell: number) {
  const cols = Math.max(1, Math.ceil(w / cell)), rows = Math.max(1, Math.ceil(h / cell));
  const data = new Float32Array(cols * rows * 12);
  let i = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x0 = c * w / cols, x1 = (c + 1) * w / cols, y0 = r * h / rows, y1 = (r + 1) * h / rows;
    data.set([x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1], i); i += 12;
  }
  const buffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return { buffer, count: cols * rows * 6 };
}

export const BlackHole = forwardRef<BlackHoleHandle, BlackHoleProps>(function BlackHole({ children, className, style }, ref) {
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const reducedRef = useRef(reduced);
  useEffect(() => { reducedRef.current = reduced; });

  /** One context and compiled programs per instance, prepared while the page is idle so the first delete starts at once. */
  const glRef = useRef<Base | null | undefined>(undefined);
  const ensureGl = useCallback((): Base | null => {
    if (glRef.current !== undefined) return glRef.current;
    const canvas = canvasRef.current;
    try {
      const gl = canvas?.getContext("webgl2", { premultipliedAlpha: true, antialias: true }) ?? null;
      if (!gl) { glRef.current = null; return null; }
      const quad = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, quad);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      glRef.current = { gl, lens: program(gl, QUAD_VS, LENS_FS), mesh: program(gl, MESH_VS, MESH_FS), core: program(gl, QUAD_VS, CORE_FS), quad };
    } catch { glRef.current = null; }
    return glRef.current;
  }, []);
  useEffect(() => {
    if (reduced) return;
    const idle = window.requestIdleCallback ?? ((fn: () => void) => window.setTimeout(fn, 200));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const handle = idle(() => ensureGl());
    return () => cancel(handle);
  }, [ensureGl, reduced]);

  const run = useCallback(async (targets: Element[], direction: 1 | -1, options: BlackHoleOptions = {}) => {
    const root = rootRef.current, content = contentRef.current, canvas = canvasRef.current;
    const els = targets.filter(el => el.isConnected) as HTMLElement[];
    if (!root || !content || !canvas || !els.length) return;
    if (direction < 0) {
      els.forEach(el => { el.style.visibility = "hidden"; });
      // Let the list make room before anything flies out.
      let last = "", still = 0;
      const begin = performance.now(), until = begin + 1200;
      while ((still < 6 || performance.now() - begin < 160) && performance.now() < until) {
        await nextFrame();
        const sig = [root, ...els].map(el => { const r = el.getBoundingClientRect(); return `${r.left.toFixed(1)},${r.top.toFixed(1)},${r.width.toFixed(1)},${r.height.toFixed(1)}`; }).join("|");
        still = sig === last ? still + 1 : 0; last = sig;
      }
    }
    const fade = (el: HTMLElement, from: number, to: number) => {
      // Reduced motion and no WebGL both land here: a plain cross-fade, instant when motion is reduced.
      const ease = from > to ? motionTokens.ease.exit : motionTokens.ease.enter;
      const duration = reducedRef.current ? 0 : (from > to ? motionTokens.duration.exit : motionTokens.duration.standard) * 1000;
      return el.animate([{ opacity: from }, { opacity: to }], { duration, easing: `cubic-bezier(${ease.join(",")})` }).finished;
    };
    const base = reducedRef.current ? null : ensureGl();
    const gl = base?.gl ?? null;
    if (!gl) {
      if (direction > 0) { await Promise.all(els.map(el => fade(el, 1, 0))); els.forEach(el => { el.style.visibility = "hidden"; }); }
      else { els.forEach(el => { el.style.visibility = ""; }); await Promise.all(els.map(el => fade(el, 0, 1))); }
      return;
    }

    const rect = root.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.max(1, Math.round(rect.width * dpr)), H = Math.max(1, Math.round(rect.height * dpr));
    canvas.width = W; canvas.height = H;
    const targetSet = new Set<Element>(els);
    const svgs = await loadSvgs(content);
    const paint = (mode: PaintMode, painting: boolean) => {
      const c = document.createElement("canvas"); c.width = W; c.height = H;
      const ctx = c.getContext("2d")!;
      paintTree(ctx, content, rect, dpr, mode, svgs, painting, false);
      return c;
    };
    const restCanvas = paint({ skip: targetSet }, true);
    const selCanvas = paint({ only: targetSet }, false);

    // Where the hole opens and how far the farthest corner is.
    const boxes = els.map(el => el.getBoundingClientRect());
    const left = Math.min(...boxes.map(b => b.left)), right = Math.max(...boxes.map(b => b.right));
    const top = Math.min(...boxes.map(b => b.top)), bottom = Math.max(...boxes.map(b => b.bottom));
    const ox = ((options.origin?.x ?? (left + right) / 2) - rect.left) * dpr, oy = ((options.origin?.y ?? (top + bottom) / 2) - rect.top) * dpr;
    const maxR = Math.max(...boxes.flatMap(b => [[b.left, b.top], [b.right, b.top], [b.left, b.bottom], [b.right, b.bottom]].map(([x, y]) => Math.hypot((x - rect.left) * dpr - ox, (y - rect.top) * dpr - oy)))) || 1;
    const dark = document.documentElement.classList.contains("dark");
    const accent = rgbOf(getComputedStyle(root).getPropertyValue("--arc-accent").trim(), dark ? [1, 1, 1] : [0, 0, 0]);

    const grid = gridBuffer(gl, W, H, 5 * dpr);
    const scene: Scene = { ...base!, grid: grid.buffer, gridCount: grid.count, rest: texture(gl, restCanvas), sel: texture(gl, selCanvas) };

    const draw = (t: number) => {
      const g = scene.gl;
      g.viewport(0, 0, W, H);
      g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
      g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE_MINUS_SRC_ALPHA);
      const open = outBack(seg(t, 0, .16)), collapse = inCubic(seg(t, .84, .92));
      const core = 6.5 * dpr * (open + seg(t, .2, .8) * .35) * (1 - collapse);
      const lens = core * 3.4;
      const waveT = seg(t, .88, 1);
      // Rest of the content, lensed.
      g.useProgram(scene.lens.p);
      g.bindBuffer(g.ARRAY_BUFFER, scene.quad); g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, scene.rest);
      g.uniform1i(scene.lens.u("uTex"), 0); g.uniform2f(scene.lens.u("uRes"), W, H); g.uniform2f(scene.lens.u("uO"), ox, oy); g.uniform1f(scene.lens.u("uLens"), lens);
      g.drawArrays(g.TRIANGLES, 0, 3);
      // The chosen items, spiralling in.
      g.useProgram(scene.mesh.p);
      g.bindBuffer(g.ARRAY_BUFFER, scene.grid); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
      g.bindTexture(g.TEXTURE_2D, scene.sel);
      g.uniform1i(scene.mesh.u("uTex"), 0); g.uniform2f(scene.mesh.u("uRes"), W, H); g.uniform2f(scene.mesh.u("uO"), ox, oy);
      g.uniform1f(scene.mesh.u("uT"), t); g.uniform1f(scene.mesh.u("uMaxR"), maxR); g.uniform1f(scene.mesh.u("uSpin"), 1.6);
      g.drawArrays(g.TRIANGLES, 0, scene.gridCount);
      // The hole and the shockwave.
      g.useProgram(scene.core.p);
      g.bindBuffer(g.ARRAY_BUFFER, scene.quad); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
      g.uniform2f(scene.core.u("uRes"), W, H); g.uniform2f(scene.core.u("uO"), ox, oy); g.uniform1f(scene.core.u("uCore"), core);
      g.uniform1f(scene.core.u("uWave"), outCubic(waveT) * 90 * dpr); g.uniform1f(scene.core.u("uWaveAlpha"), waveT > 0 ? (1 - waveT) * (1 - waveT) : 0);
      g.uniform1f(scene.core.u("uDark"), dark ? 1 : 0); g.uniform1f(scene.core.u("uPx"), dpr); g.uniform3f(scene.core.u("uAccent"), ...accent);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };

    const duration = (options.duration ?? 1.3) * (direction < 0 ? .92 : 1) * 1000;
    let t = direction > 0 ? 0 : 1;
    draw(t);
    canvas.style.visibility = "visible";
    content.style.visibility = "hidden";
    const start = await nextFrame();
    let now = start;
    while (direction > 0 ? t < 1 : t > 0) {
      now = await nextFrame();
      const p = clamp((now - start) / duration);
      t = direction > 0 ? p : 1 - p;
      draw(t);
    }
    els.forEach(el => { el.style.visibility = direction > 0 ? "hidden" : ""; });
    content.style.visibility = "";
    canvas.style.visibility = "hidden";
    const g = scene.gl;
    g.deleteTexture(scene.rest); g.deleteTexture(scene.sel); g.deleteBuffer(scene.grid);
    g.clearColor(0, 0, 0, 0); g.clear(g.COLOR_BUFFER_BIT);
  }, [ensureGl]);

  const enqueue = useCallback((targets: Element[], direction: 1 | -1, options?: BlackHoleOptions) => {
    if (direction < 0) targets.forEach(el => { (el as HTMLElement).style.visibility = "hidden"; });
    const next = queue.current.then(() => run(targets, direction, options)).catch(() => {
      targets.forEach(el => { (el as HTMLElement).style.visibility = direction > 0 ? "hidden" : ""; });
      if (contentRef.current) contentRef.current.style.visibility = "";
    });
    queue.current = next;
    return next;
  }, [run]);

  useImperativeHandle(ref, () => ({
    swallow: (targets, options) => enqueue(targets, 1, options),
    release: (targets, options) => enqueue(targets, -1, options),
  }), [enqueue]);

  return <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style}>
    <div ref={contentRef} className={styles.content}>{children}</div>
    <canvas ref={canvasRef} className={styles.canvas} aria-hidden />
  </div>;
});

export default BlackHole;
