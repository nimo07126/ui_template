/**
 * Geometry and poses for the ghost mascot. Everything here is pure: a pose plus a few continuous clocks go in,
 * SVG attribute strings come out. Clocks only ever grow, so every loop is a function of an unbroken phase and has
 * no seam to restart from.
 */

export type GhostStatus = "idle" | "listening" | "thinking" | "writing" | "done" | "error";

export const GHOST_STATUSES: GhostStatus[] = ["idle", "listening", "thinking", "writing", "done", "error"];

export const GHOST_STATUS_LABEL: Record<GhostStatus, string> = {
  idle: "Idle",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Error",
};

/** Every field blends linearly between states. Rates are integrated into phases, so blending a rate never jumps. */
export interface Pose {
  /** Float center offset and amplitude in viewBox units, rate in cycles per second. */
  y: number; floatAmp: number; floatRate: number;
  /** Horizontal lean, rotation in degrees, how much the slow sway shows, overall scale. */
  lx: number; rot: number; sway: number; scale: number;
  /** Opacity of the sheet (eyes and marks stay solid). */
  opacity: number;
  /** Hem ripple amplitude, ripple speed in wavelengths per second, how far the hem corners flare out. */
  hemAmp: number; hemRate: number; flare: number;
  /** Resting gaze (-1 to 1) and the stiffness of the eye spring. */
  gx: number; gy: number; gk: number;
  /** Eye size and spacing multipliers, happy squint and droopy lids (0 to 1). */
  eyeScale: number; spread: number; happy: number; droop: number;
  /** How much blinks, idle glances and the pen pull on the eyes. */
  blinkable: number; glance: number; followPen: number;
  /** Visibility of the thinking swirl, the writing pen and line, and the done sparkle. */
  swirl: number; pen: number; star: number;
}

const IDLE: Pose = {
  y: 0, floatAmp: 3, floatRate: .3,
  lx: 0, rot: 0, sway: 1, scale: 1,
  opacity: 1,
  hemAmp: 3, hemRate: .5, flare: 2.8,
  gx: 0, gy: 0, gk: 140,
  eyeScale: 1, spread: 1, happy: 0, droop: 0,
  blinkable: 1, glance: 1, followPen: 0,
  swirl: 0, pen: 0, star: 0,
};

export const POSES: Record<GhostStatus, Pose> = {
  idle: IDLE,
  // Comes forward a little: larger, lower, a small head tilt, wide eyes looking straight out.
  listening: { ...IDLE, y: 1.5, floatAmp: 1.8, floatRate: .36, rot: -4, sway: .4, scale: 1.05, hemAmp: 2.1, hemRate: .7, flare: 3, gy: .12, gk: 220, eyeScale: 1.2, spread: 1.06, glance: 0, blinkable: .7 },
  // Drifts up and turns translucent, eyes up toward the swirl, slower float.
  thinking: { ...IDLE, y: -2, floatAmp: 3.4, floatRate: .22, rot: 3, sway: 1.2, opacity: .56, hemAmp: 3.1, hemRate: .36, flare: 2.2, gx: .55, gy: -1, gk: 46, eyeScale: .96, glance: 0, blinkable: .35, swirl: 1 },
  // Leans toward its line, eyes on the pen tip, a busier hem.
  writing: { ...IDLE, y: 1, floatAmp: 1.5, floatRate: .38, lx: -7, rot: 4, sway: .35, hemAmp: 2.3, hemRate: .85, gk: 260, glance: 0, followPen: 1, blinkable: .5, pen: 1 },
  // Lifts a little with a happy squint and a sparkle.
  done: { ...IDLE, y: -2.5, floatAmp: 2.6, floatRate: .36, rot: -2, sway: .6, hemAmp: 3, hemRate: .7, flare: 3, gk: 160, spread: 1.04, happy: 1, glance: 0, blinkable: 0, star: 1 },
  // Sinks, the hem goes slack, lids droop. The wobble is added on top by the clock.
  error: { ...IDLE, y: 3.5, floatAmp: 1.1, floatRate: .24, sway: .3, hemAmp: 1.3, hemRate: .26, flare: 1.4, gy: .55, gk: 90, eyeScale: .96, droop: 1, glance: 0, blinkable: .5 },
};

export function mixPose(a: Pose, b: Pose, w: number): Pose {
  const out = { ...a };
  for (const key of Object.keys(a) as (keyof Pose)[]) out[key] = a[key] + (b[key] - a[key]) * w;
  return out;
}

export interface Geometry {
  compact: boolean;
  view: string;
  eyeRx: number; eyeRy: number; spread: number;
  markStroke: number; lineStroke: number; penStroke: number; markScale: number;
}

/** 56px and up. */
export const FULL: Geometry = {
  compact: false, view: "0 0 120 120",
  eyeRx: 3.7, eyeRy: 5.3, spread: 10,
  markStroke: 2.3, lineStroke: 2.3, penStroke: 3.3, markScale: 1,
};

/** Below 56px: tighter framing, bigger eyes, heavier marks so they read at 24px. */
export const COMPACT: Geometry = {
  compact: true, view: "8 7 104 104",
  eyeRx: 5, eyeRy: 6.9, spread: 11.6,
  markStroke: 3.8, lineStroke: 3.6, penStroke: 4.6, markScale: 1.2,
};

const TAU = Math.PI * 2;
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const lerp = (a: number, b: number, w: number) => a + (b - a) * w;
const n = (v: number) => (Math.round(v * 100) / 100).toString();
export const easeInOutCubic = (x: number) => (x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const easeInOutSine = (x: number) => .5 - .5 * Math.cos(Math.PI * clamp(x));
const easeOutCubic = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const smooth = (x: number) => { const c = clamp(x); return c * c * (3 - 2 * c); };

/* ---------- Body ---------- */

const CX = 60;
const DOME_Y = 46;
const R = 28;
const K = .5523 * R;
const HEM_Y = 90;
const K1 = TAU / 21;
const K2 = TAU / 37;
const CORNER = 2.8;
const HEM_SEGMENTS = 8;

interface Hem { amp: number; phase: number; phase2: number; base: number; shift: number }

const hemY = (h: Hem, x: number) => {
  const u = x - CX - h.shift;
  return h.base + h.amp * (.8 * Math.sin(K1 * u - TAU * h.phase) + .2 * Math.sin(K2 * u + TAU * h.phase2));
};
const hemSlope = (h: Hem, x: number) => {
  const u = x - CX - h.shift;
  return h.amp * (.8 * K1 * Math.cos(K1 * u - TAU * h.phase) + .2 * K2 * Math.cos(K2 * u + TAU * h.phase2));
};

/** A dome, two soft sides that flare toward the hem, rounded corners and a rippling hem drawn as exact Hermite curves. */
export function bodyPath(h: Hem, flare: number): string {
  const xr = CX + R + flare + h.shift * .6;
  const xl = CX - R - flare + h.shift * .6;
  const yr = hemY(h, xr);
  const yl = hemY(h, xl);
  const a = xr - CORNER;
  const b = xl + CORNER;
  let d = `M${n(CX - R)} ${DOME_Y}`
    + `C${n(CX - R)} ${n(DOME_Y - K)} ${n(CX - K)} ${DOME_Y - R} ${CX} ${DOME_Y - R}`
    + `C${n(CX + K)} ${DOME_Y - R} ${n(CX + R)} ${n(DOME_Y - K)} ${n(CX + R)} ${DOME_Y}`
    + `C${n(CX + R)} ${DOME_Y + 15} ${n(xr)} ${n(yr - 17)} ${n(xr)} ${n(yr - CORNER)}`
    + `Q${n(xr)} ${n(yr)} ${n(a)} ${n(hemY(h, a))}`;
  const step = (b - a) / HEM_SEGMENTS;
  for (let i = 0; i < HEM_SEGMENTS; i++) {
    const x0 = a + step * i;
    const x1 = x0 + step;
    const y0 = hemY(h, x0);
    const y1 = hemY(h, x1);
    const t = step / 3;
    d += `C${n(x0 + t)} ${n(y0 + hemSlope(h, x0) * t)} ${n(x1 - t)} ${n(y1 - hemSlope(h, x1) * t)} ${n(x1)} ${n(y1)}`;
  }
  d += `Q${n(xl)} ${n(yl)} ${n(xl)} ${n(yl - CORNER)}`
    + `C${n(xl)} ${n(yl - 17)} ${n(CX - R)} ${DOME_Y + 15} ${n(CX - R)} ${DOME_Y}Z`;
  return d;
}

/* ---------- Eyes ---------- */

const EYE_Y = 50;

/**
 * One filled eye drawn as two cubics, so it can morph without swapping shapes: an oval, a closed blink line,
 * a happy crescent (the lower edge bends up past the upper one's start) or droopy lids (the outer top sinks).
 */
function eyePath(cx: number, cy: number, rx: number, ry: number, open: number, happy: number, droop: number, side: -1 | 1): string {
  const o = .12 + .88 * open;
  const ht = lerp(4 / 3 * ry, 1.62 * ry, happy) * o;
  const hb = lerp(4 / 3 * ry, -.6 * ry, happy) * o;
  const w = rx * (1 + .12 * happy);
  const y = cy + happy * ry * .4 + droop * ry * .1;
  // Droopy lids: the top flattens into a line that slopes down toward the outer corner.
  const outerTop = ht * (1 - .88 * droop);
  const innerTop = ht * (1 - .62 * droop);
  const outerDrop = droop * ry * .34;
  const innerLift = -droop * ry * .22;
  const ay = y + (side < 0 ? outerDrop : innerLift);
  const by = y + (side < 0 ? innerLift : outerDrop);
  const ah = side < 0 ? outerTop : innerTop;
  const bh = side < 0 ? innerTop : outerTop;
  const ax = cx - w;
  const bx = cx + w;
  return `M${n(ax)} ${n(ay)}C${n(ax)} ${n(ay - ah)} ${n(bx)} ${n(by - bh)} ${n(bx)} ${n(by)}`
    + `C${n(bx)} ${n(by + hb)} ${n(ax)} ${n(ay + hb)} ${n(ax)} ${n(ay)}Z`;
}

/* ---------- Marks ---------- */

/** A curl drawn from its outer end into the center, 1.35 turns. Its stroke is animated with pathLength 1. */
export const SWIRL_PATH = (() => {
  const points: string[] = [];
  const steps = 56;
  for (let i = 0; i <= steps; i++) {
    const a = i / steps;
    const angle = -Math.PI / 2 + a * 1.35 * TAU;
    const r = 6.2 - a * 4.6;
    points.push(`${n(Math.cos(angle) * r)} ${n(Math.sin(angle) * r)}`);
  }
  return `M${points.join("L")}`;
})();

/** A four point sparkle with soft concave sides, unit radius. */
export const STAR_PATH = "M0 -1C.1 -.28 .28 -.1 1 0C.28 .1 .1 .28 0 1C-.1 .28 -.28 .1 -1 0C-.28 -.1 -.1 -.28 0 -1Z";

const SWIRL_AT = [90, 21] as const;
const STARS = [{ x: 91, y: 22, r: 6.6, delay: 0 }, { x: 100.5, y: 35.5, r: 3.3, delay: .1 }] as const;

/* ---------- Writing ---------- */

export const PEN_PERIOD = 2.3;
export const LINE = { x0: 77, width: 29, y: 107 } as const;
const WORDS: [number, number][] = [[0, .3], [.38, .66], [.74, 1]];
const DRAW_END = .62;
const ERASE_START = .7;

const scribble = (p: number) => {
  const xu = p * LINE.width;
  return LINE.y - (1.5 * Math.sin(xu * 1.1) + .45 * Math.sin(xu * 2.2 + 1.1));
};

/** Where the line has been drawn up to, and where it has been erased from, at writing cycle progress u. */
function lineSpan(u: number) {
  const draw = clamp(u / DRAW_END);
  const head = draw * .62 + .38 * easeInOutSine(draw);
  const tail = easeInOutSine((u - ERASE_START) / .25);
  return { head, tail };
}

/** The pen tip at cycle progress u: on the line while writing, lifted between words and on the way back. */
export function penTip(u: number): { x: number; y: number; progress: number } {
  if (u < ERASE_START) {
    const { head } = lineSpan(u);
    let lift = 0;
    for (let i = 0; i < WORDS.length - 1; i++) {
      const from = WORDS[i][1];
      const to = WORDS[i + 1][0];
      if (head > from && head < to) lift = 1.8 * Math.sin(Math.PI * (head - from) / (to - from));
    }
    return { x: LINE.x0 + head * LINE.width, y: scribble(head) - lift, progress: head };
  }
  const r = easeInOutCubic(clamp((u - ERASE_START) / (1 - ERASE_START)));
  const x = lerp(LINE.x0 + LINE.width, LINE.x0, r);
  const y = lerp(scribble(1), scribble(0), r) - 3.4 * Math.sin(Math.PI * r);
  return { x, y, progress: 1 - r };
}

function linePath(u: number): string {
  const { head, tail } = lineSpan(u);
  let d = "";
  for (const [a, b] of WORDS) {
    const s = Math.max(a, tail);
    const e = Math.min(b, head);
    if (e - s < .004) continue;
    const count = Math.max(1, Math.ceil((e - s) / .018));
    for (let i = 0; i <= count; i++) {
      const p = s + (e - s) * (i / count);
      d += `${i ? "L" : "M"}${n(LINE.x0 + p * LINE.width)} ${n(scribble(p))}`;
    }
  }
  return d || "M0 0";
}

/* ---------- Frame ---------- */

export interface Clocks {
  /** Continuous seconds. */
  t: number;
  /** Integrated float, hem and second hem phases, in cycles. */
  float: number; hem: number; hem2: number;
  /** Swirl cycle progress 0 to 1, writing cycle progress 0 to 1. */
  swirl: number; pen: number;
  /** Seconds since the last error (wobble) and since done began (sparkle pop). */
  sinceError: number; sinceDone: number;
  gaze: readonly [number, number];
  /** Eye openness, 1 open, 0 shut. */
  open: number;
}

export interface FrameAttrs {
  body: string; d: string; opacity: string;
  eyes: [string, string];
  swirl: { transform: string; dash: string; offset: string; opacity: string };
  stars: [{ transform: string; opacity: string }, { transform: string; opacity: string }];
  pen: { transform: string; opacity: string };
  line: { d: string; opacity: string };
  ground: { transform: string; opacity: string };
}

/** A damped single wobble after an error: about 1.2s, softened at the start so it never kicks. */
export function wobble(since: number): number {
  if (since < 0 || since > 1.6) return 0;
  return (1 - Math.exp(-28 * since)) * Math.exp(-4.2 * since) * Math.sin(TAU * 2.1 * since);
}

/** Resting gaze for the pen: further right as the line grows, down at the tip. */
export function penGaze(u: number): [number, number] {
  const tip = penTip(u);
  return [.2 + .75 * tip.progress, .88 - (LINE.y - tip.y) * .05];
}

export function frameAttrs(p: Pose, c: Clocks, geo: Geometry): FrameAttrs {
  const ampN = p.floatAmp / 3;
  const s = Math.sin(TAU * c.float);
  const v = Math.cos(TAU * c.float); // > 0 while sinking
  const wob = wobble(c.sinceError);
  const tip = penTip(c.pen);

  const fy = p.y + p.floatAmp * s;
  const lx = p.lx + wob * 1.6 + (tip.progress - .5) * 3 * p.followPen;
  const rot = p.rot + 1.3 * Math.sin(TAU * c.float * .5) * p.sway + wob * 9;
  // Squash and stretch with the float: taller on the way up, the hem trailing behind and flaring on the way down.
  const sx = p.scale * (1 + .008 * v * ampN);
  const sy = p.scale * (1 - .014 * v * ampN);
  const hem: Hem = {
    amp: p.hemAmp, phase: c.hem, phase2: c.hem2,
    base: HEM_Y - v * 1.5 * ampN,
    shift: -wob * 2.6 + .8 * Math.sin(TAU * c.hem2),
  };
  const flare = p.flare + v * 1.1 * ampN;

  const body = `translate(${n(lx)} ${n(fy)}) rotate(${n(rot)} 60 58) translate(60 46) scale(${n(sx)} ${n(sy)}) translate(-60 -46)`;

  const rx = geo.eyeRx * p.eyeScale;
  const ry = geo.eyeRy * p.eyeScale * (1 + .06 * (p.eyeScale - 1) / .2);
  const spread = geo.spread * p.spread;
  const ex = c.gaze[0] * 3.1;
  const ey = c.gaze[1] * 2.7;
  const eyes: [string, string] = [
    eyePath(CX - spread + ex, EYE_Y + ey, rx, ry, c.open, p.happy, p.droop, -1),
    eyePath(CX + spread + ex, EYE_Y + ey, rx, ry, c.open, p.happy, p.droop, 1),
  ];

  // Swirl: the visible stretch runs from tail to head along the curl; both sit at an end when the cycle wraps.
  const head = easeInOutSine(c.swirl / .6);
  const tail = easeInOutSine((c.swirl - .32) / .6);
  const seg = Math.max(0, head - tail);
  const swirl = {
    transform: `translate(${SWIRL_AT[0]} ${SWIRL_AT[1]}) rotate(${n((c.t * 40) % 360)}) scale(${geo.markScale})`,
    dash: `${n(seg + .0001)} 3`,
    offset: n(-tail),
    opacity: n(p.swirl * smooth(seg / .06)),
  };

  const pop = easeOutCubic(c.sinceDone / .34);
  const stars = STARS.map((star, i) => {
    const grow = easeOutCubic((c.sinceDone - star.delay) / .32);
    const twinkle = 1 - .1 * (.5 - .5 * Math.cos(TAU * (c.t * .7 + i * .4)));
    const scale = star.r * geo.markScale * grow * twinkle * (.55 + .45 * p.star);
    const turn = 12 * Math.sin(TAU * c.t * .2 + i) + (1 - pop) * -30;
    return { transform: `translate(${star.x} ${star.y}) rotate(${n(turn)}) scale(${n(Math.max(scale, .001))})`, opacity: n(p.star) };
  }) as FrameAttrs["stars"];

  const pen = { transform: `translate(${n(tip.x)} ${n(tip.y)})`, opacity: n(p.pen) };
  const line = { d: linePath(c.pen), opacity: n(p.pen) };

  const height = (fy - p.y) / 3.4;
  const ground = {
    transform: `translate(${n(60 + lx * .8)} 112) scale(${n(1 + .05 * height)} 1)`,
    opacity: n((.86 + .14 * height) * (.45 + .55 * p.opacity)),
  };

  return { body, d: bodyPath(hem, flare), opacity: n(p.opacity), eyes, swirl, stars, pen, line, ground };
}

/** Clocks for a still, representative frame: the first paint, and every frame under reduced motion. */
export const STILL = { float: 0, hem: .15, hem2: .4, swirl: .5, pen: .45 } as const;
