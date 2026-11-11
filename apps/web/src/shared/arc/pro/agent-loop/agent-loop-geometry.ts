/**
 * Ring geometry for the agent loop, laid out in real pixels from the measured width so strokes and text stay crisp.
 * The loop is a circle run clockwise from the top: Gather context at 12 o'clock, Take action lower right and Verify
 * lower left. Their labels sit outside the ring beside the stations, so the radius is whatever leaves room for them.
 * On the narrowest cards the two lower stations move further down the ring, which frees width for a larger circle.
 */

export interface Point { x: number; y: number }

export interface RingGeometry {
  /** Measured width of the ring column. */
  w: number;
  /** Height of the ring area, from the top label to just under the circle. */
  h: number;
  cx: number;
  cy: number;
  r: number;
  /** Narrow layout: smaller labels without icons, one outcome lane. */
  compact: boolean;
  /** Gap between a station and its label. */
  gap: number;
  /** Station angles in degrees, clockwise from 3 o'clock: gather, act, verify. */
  angles: [number, number, number];
  /** Station points: gather, act, verify. */
  nodes: [Point, Point, Point];
  /** Direction arrows halfway between stations, with their clockwise heading in degrees. */
  arrows: { x: number; y: number; heading: number }[];
}

/** Gap between the ring area and the outcome lanes; pins run across it. */
export const LANE_GAP = 14;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const rad = (deg: number) => (deg * Math.PI) / 180;

export const polar = (cx: number, cy: number, r: number, deg: number): Point =>
  ({ x: cx + r * Math.cos(rad(deg)), y: cy + r * Math.sin(rad(deg)) });

export function ringGeometry(w: number): RingGeometry {
  const compact = w < 360;
  const gap = compact ? 13 : 14;
  // Room the Take action label needs beside its station: icon, gap and text on wide cards, text alone on narrow ones.
  const room = w / 2 - gap - (compact ? 64 : 106);
  let act = 30;
  let r = room / Math.cos(rad(act));
  if (r < 66) { act = 50; r = room / Math.cos(rad(act)); }
  r = Math.round(clamp(r, 54, 94));
  const angles: [number, number, number] = [-90, act, 180 - act];
  const top = compact ? 30 : 34;
  const cx = Math.round(w / 2);
  const cy = top + r;
  const nodes = angles.map(a => polar(cx, cy, r, a)) as [Point, Point, Point];
  const ends = [...angles, 270];
  const arrows = angles.map((a, i) => {
    const mid = (a + ends[i + 1]) / 2;
    return { ...polar(cx, cy, r, mid), heading: mid + 90 };
  });
  return { w, h: cy + r + 6, cx, cy, r, compact, gap, angles, nodes, arrows };
}

/** The angle of the head for a position in station units (0 gather, 1 act, 2 verify, 3 gather again). */
export function angleAt(g: RingGeometry, u: number) {
  const ends = [...g.angles, 270];
  const k = ((u % 3) + 3) % 3;
  const i = Math.min(2, Math.floor(k));
  return ends[i] + (ends[i + 1] - ends[i]) * (k - i);
}

/** The full circle as one path that starts at the top and runs clockwise, so dash offsets follow the loop. */
export const circlePath = (g: RingGeometry) =>
  `M ${g.cx} ${g.cy - g.r} A ${g.r} ${g.r} 0 1 1 ${g.cx} ${g.cy + g.r} A ${g.r} ${g.r} 0 1 1 ${g.cx} ${g.cy - g.r}`;

/** A small chevron that sits on the track and points along it. */
export const arrowPath = "M -2.75 -4 L 1.75 0 L -2.75 4";
