export type Pt = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

/** A connector a packet can travel: a straight line or a cubic curve, with an arc length table so travel is even. */
export interface Seg {
  d: string;
  len: number;
  at: (s: number) => Pt;
}

export interface Geometry {
  w: number;
  h: number;
  /** Wide stages flow left to right with the experts in a column; narrow stages flow top to bottom with them in a row. */
  wide: boolean;
  /** Where the input and output chips sit. The input chip hugs the right edge of its slot on wide stages. */
  intake: Rect;
  output: Rect;
  router: Rect;
  /** One score track per expert inside the router, and the box its score label fills. */
  tracks: Rect[];
  scores: Rect[];
  tiles: Rect[];
  inSeg: Seg;
  gates: Seg[];
  curves: Seg[];
  outSeg: Seg;
  merge: Pt;
  labels: { text: string; x: number; y: number; align: "start" | "center" | "end" }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const f = (v: number) => v.toFixed(1);

/** Stage width at which the flow turns from top to bottom into left to right. */
export const WIDE_AT = 520;
const LABEL = 22;
const ROW = 28;
const ROW_GAP = 4;
const PAD = 10;
const CHIP = 28;

/** Narrow layout rhythm, top to bottom. */
const N = { chip: CHIP, toRouter: 22, router: 92, toTiles: 22, tile: 52, toMerge: 26, toOut: 16 };

export function wideHeight(count: number) {
  return LABEL + PAD * 2 + count * ROW + (count - 1) * ROW_GAP;
}

export function narrowHeight() {
  return N.chip + N.toRouter + N.router + N.toTiles + N.tile + N.toMerge + N.toOut + N.chip;
}

export function buildGeometry(width: number, count: number): Geometry {
  const w = Math.max(240, width);
  return w >= WIDE_AT ? wideGeometry(w, count) : narrowGeometry(w, count);
}

function line(a: Pt, b: Pt): Seg {
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  return { d: `M${f(a.x)} ${f(a.y)}L${f(b.x)} ${f(b.y)}`, len, at: s => { const t = len ? clamp(s / len, 0, 1) : 1; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; } };
}

function cubic(p0: Pt, p1: Pt, p2: Pt, p3: Pt): Seg {
  const point = (t: number): Pt => {
    const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
    return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
  };
  const STEPS = 40;
  const table = [0];
  let prev = p0;
  for (let i = 1; i <= STEPS; i++) { const p = point(i / STEPS); table.push(table[i - 1] + Math.hypot(p.x - prev.x, p.y - prev.y)); prev = p; }
  const len = table[STEPS];
  const at = (s: number) => {
    const target = clamp(s, 0, len);
    let i = 1;
    while (i < STEPS && table[i] < target) i++;
    const span = table[i] - table[i - 1] || 1;
    return point((i - 1 + (target - table[i - 1]) / span) / STEPS);
  };
  return { d: `M${f(p0.x)} ${f(p0.y)}C${f(p1.x)} ${f(p1.y)} ${f(p2.x)} ${f(p2.y)} ${f(p3.x)} ${f(p3.y)}`, len, at };
}

function wideGeometry(w: number, count: number): Geometry {
  const body = count * ROW + (count - 1) * ROW_GAP;
  const top = LABEL + PAD;
  const h = top + body + PAD;
  const mid = top + body / 2;
  const io = Math.round(clamp(w * 0.12, 64, 92));
  const routerW = Math.round(clamp(w * 0.22, 124, 168));
  const expW = Math.round(clamp(w * 0.26, 148, 196));
  const free = w - io * 2 - routerW - expW;
  const inGap = Math.round(free * 0.27);
  const gateGap = Math.round(free * 0.33);
  const rx = io + inGap;
  const ex = rx + routerW + gateGap;
  const exEnd = ex + expW;
  const ox = w - io;
  const mx = Math.round(exEnd + (ox - exEnd) * 0.62);
  const rowY = (i: number) => top + i * (ROW + ROW_GAP);
  const cy = (i: number) => rowY(i) + ROW / 2;
  const ids = Array.from({ length: count }, (_, i) => i);
  const bend = (mx - exEnd) * 0.6;
  const scoreW = 30;
  return {
    w, h, wide: true,
    intake: { x: 0, y: mid - CHIP / 2, w: io, h: CHIP },
    output: { x: ox, y: mid - CHIP / 2, w: io, h: CHIP },
    router: { x: rx, y: top - PAD, w: routerW, h: body + PAD * 2 },
    tracks: ids.map(i => ({ x: rx + 12, y: cy(i) - 2, w: routerW - 24 - scoreW - 6, h: 4 })),
    scores: ids.map(i => ({ x: rx + routerW - 12 - scoreW, y: cy(i) - 8, w: scoreW, h: 16 })),
    tiles: ids.map(i => ({ x: ex, y: rowY(i), w: expW, h: ROW })),
    inSeg: line({ x: io, y: mid }, { x: rx, y: mid }),
    gates: ids.map(i => line({ x: rx + routerW, y: cy(i) }, { x: ex, y: cy(i) })),
    curves: ids.map(i => cubic({ x: exEnd, y: cy(i) }, { x: exEnd + bend, y: cy(i) }, { x: mx - bend * 0.55, y: mid }, { x: mx, y: mid })),
    outSeg: line({ x: mx, y: mid }, { x: ox, y: mid }),
    merge: { x: mx, y: mid },
    labels: [
      { text: "Input", x: io, y: LABEL / 2, align: "end" },
      { text: "Router", x: rx + routerW / 2, y: LABEL / 2, align: "center" },
      { text: "Experts", x: ex + expW / 2, y: LABEL / 2, align: "center" },
      { text: "Output", x: ox, y: LABEL / 2, align: "start" },
    ],
  };
}

function narrowGeometry(w: number, count: number): Geometry {
  const gap = count > 6 ? 4 : 6;
  const colW = (w - (count - 1) * gap) / count;
  const cx = (i: number) => i * (colW + gap) + colW / 2;
  const ids = Array.from({ length: count }, (_, i) => i);
  const mid = w / 2;
  const chipW = Math.min(180, w * 0.5);
  const routerY = N.chip + N.toRouter;
  const trackTop = routerY + 30;
  const trackH = N.router - 30 - 12;
  const tileY = routerY + N.router + N.toTiles;
  const mergeY = tileY + N.tile + N.toMerge;
  const outY = mergeY + N.toOut;
  const bend = N.toMerge * 0.7;
  return {
    w, h: outY + N.chip, wide: false,
    intake: { x: mid - chipW / 2, y: 0, w: chipW, h: N.chip },
    output: { x: mid - chipW / 2, y: outY, w: chipW, h: N.chip },
    router: { x: 0, y: routerY, w, h: N.router },
    tracks: ids.map(i => ({ x: cx(i) - 2, y: trackTop, w: 4, h: trackH })),
    scores: ids.map(i => ({ x: cx(i) - colW / 2, y: routerY + 8, w: colW, h: 16 })),
    tiles: ids.map(i => ({ x: i * (colW + gap), y: tileY, w: colW, h: N.tile })),
    inSeg: line({ x: mid, y: N.chip }, { x: mid, y: routerY }),
    gates: ids.map(i => line({ x: cx(i), y: routerY + N.router }, { x: cx(i), y: tileY })),
    curves: ids.map(i => cubic({ x: cx(i), y: tileY + N.tile }, { x: cx(i), y: tileY + N.tile + bend }, { x: mid, y: mergeY - bend * 0.5 }, { x: mid, y: mergeY })),
    outSeg: line({ x: mid, y: mergeY }, { x: mid, y: outY }),
    merge: { x: mid, y: mergeY },
    labels: [
      { text: "Input", x: 0, y: N.chip / 2, align: "start" },
      { text: "Output", x: 0, y: outY + N.chip / 2, align: "start" },
    ],
  };
}
