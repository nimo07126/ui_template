/**
 * Pose model for CubeMascot. Every status is a continuous function of time, so loops never restart:
 * idle and writing are sums of slow sines, thinking is a quarter turn whose end state is identical to its
 * start (a cube looks the same after 90 degrees), done and error settle into still poses.
 */

export type CubeStatus = "idle" | "thinking" | "writing" | "done" | "error";
export const CUBE_STATUSES: readonly CubeStatus[] = ["idle", "thinking", "writing", "done", "error"];

type Four = [number, number, number, number];

export interface CubePose {
  /** Quarter-turn progress, 0 to 1. Spin 1 looks exactly like spin 0. */
  spin: number;
  /** Extra yaw, roll and pitch in degrees. Positive pitch tips the face down. */
  yaw: number;
  roll: number;
  pitch: number;
  /** Float and sideways offset in cube half-sizes. */
  lift: number;
  shift: number;
  /** Gaze on the face plane, -1 to 1. */
  gx: number;
  gy: number;
  open: number;
  /** How much the blink schedule applies, 0 to 1. */
  blink: number;
  happy: number;
  worry: number;
  /** Mouth curve (-1 frown, 1 smile) and width (0 to 1). */
  mouth: number;
  mouthW: number;
  /** Face visibility and eye openness per side face (front, right, back, left at rest). */
  face: Four;
  faceOpen: Four;
  sparkle: number;
  ink: number;
}

export const TAU = Math.PI * 2;
export const LINE_PERIOD = 0.36;
export const LINE_LIFE = LINE_PERIOD * 4;
const HOLD = 0.5;
const TURN = 0.8;

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** Symmetric ease in and out with zero velocity at both ends. */
export const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeOut = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);
const sin = Math.sin;

function base(): CubePose {
  return {
    spin: 0, yaw: 0, roll: 0, pitch: 0, lift: 0, shift: 0,
    gx: 0, gy: 0, open: 1, blink: 1, happy: 0, worry: 0, mouth: 0.35, mouthW: 0.7,
    face: [1, 0, 0, 0], faceOpen: [1, 1, 1, 1], sparkle: 0, ink: 0,
  };
}

/** The pose of a status, t seconds after it began, at global clock g. */
export function poseAt(status: CubeStatus, t: number, g: number): CubePose {
  const p = base();
  if (status === "idle") {
    p.yaw = 4.5 * sin(TAU * g / 7.3);
    p.roll = 2.6 * sin(TAU * g / 5.3 + 0.6);
    p.pitch = 1.8 * sin(TAU * g / 6.1 + 1.9);
    p.lift = 0.045 * sin(TAU * g / 3.6);
    p.gx = 0.16 * sin(TAU * g / 8.9 + 0.3) + 0.06 * sin(TAU * g / 3.7);
    p.gy = 0.07 * sin(TAU * g / 6.3 + 1);
    return p;
  }
  if (status === "thinking") {
    const local = t % (HOLD + TURN);
    const k = local < HOLD ? 0 : easeInOut((local - HOLD) / TURN);
    const arc = sin(Math.PI * k);
    p.spin = k;
    p.roll = -2.5 * arc;
    p.pitch = -2.5;
    p.lift = 0.02 + 0.06 * arc;
    p.gx = 0.22 - 0.44 * arc;
    p.gy = -0.32 + 0.12 * arc;
    p.open = 0.95;
    p.blink = 0;
    p.mouth = 0.05;
    p.mouthW = 0.4;
    // The arriving face fades in and its eyes open as it reaches the front.
    p.face = [1, smooth(0.5, 0.85, k), 0, 0];
    p.faceOpen = [1, 0.12 + 0.88 * smooth(0.68, 1, k), 1, 1];
    return p;
  }
  if (status === "writing") {
    const sweep = TAU * t / LINE_LIFE;
    p.yaw = 2 * sin(TAU * g / 6.7);
    p.roll = 1.2 * sin(TAU * g / 4.9);
    p.pitch = 5 + sin(sweep);
    p.lift = 0.03 * sin(TAU * g / 3.6);
    p.gx = 0.2 * sin(sweep);
    p.gy = 0.42;
    p.open = 0.8;
    p.mouth = 0.1;
    p.mouthW = 0.45;
    p.ink = 1;
    return p;
  }
  if (status === "done") {
    const dip = sin(Math.PI * clamp01(t / 0.6)) ** 2;
    p.lift = -0.05 * dip + 0.015 * sin(TAU * g / 4.2);
    p.pitch = 3 * dip;
    p.roll = -1.5;
    p.gy = -0.05;
    p.blink = 0;
    p.happy = 1;
    p.mouth = 1;
    p.mouthW = 1;
    p.sparkle = easeOut((t - 0.08) / 0.45);
    return p;
  }
  // error: one shake whose envelope reaches zero with zero slope, then a still, worried pose
  const k = clamp01(t / 0.56);
  const env = (1 - k) * (1 - k);
  const osc = sin(TAU * 3.5 * k);
  p.shift = 0.1 * env * osc;
  p.yaw = 7 * env * osc;
  p.roll = -2.5;
  p.pitch = 2;
  p.gy = 0.15;
  p.open = 0.72;
  p.worry = 1;
  p.mouth = -0.8;
  p.mouthW = 0.55;
  return p;
}

/** A still, representative pose per status for reduced motion. */
export function stillPose(status: CubeStatus): CubePose {
  return poseAt(status, status === "thinking" ? 0.2 : status === "done" || status === "error" ? 2 : 0, 0);
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const lerp4 = (a: Four, b: Four, k: number): Four => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k), lerp(a[3], b[3], k)];

export function blendPose(a: CubePose, b: CubePose, k: number): CubePose {
  const out = { ...b };
  for (const key of Object.keys(b) as (keyof CubePose)[]) {
    if (key === "face" || key === "faceOpen") continue;
    out[key] = lerp(a[key] as number, b[key] as number, k) as never;
  }
  out.face = lerp4(a.face, b.face, k);
  out.faceOpen = lerp4(a.faceOpen, b.faceOpen, k);
  return out;
}

/**
 * A pose caught past a third of a quarter turn is re-expressed as the same picture one face along
 * (spin - 1, face slots shifted), so the blend to the next status keeps turning forward instead of unwinding.
 */
export function forwardSpin(p: CubePose): CubePose {
  if (p.spin <= 0.35) return { ...p, face: [...p.face] as Four, faceOpen: [...p.faceOpen] as Four };
  const shift = (a: Four): Four => [a[1], a[2], a[3], a[0]];
  return { ...p, spin: p.spin - 1, face: shift(p.face), faceOpen: shift(p.faceOpen) };
}

const BLINKS = [3.1, 4.4, 0.34, 3.7, 2.6, 4.9];
const BLINK_CYCLE = BLINKS.reduce((sum, value) => sum + value, 0);
const BLINK_LENGTH = 0.17;

/** 0 open, 1 closed. Blinks every 2.6 to 4.9s, sometimes twice. */
export function blinkClosure(g: number) {
  let at = ((g - 1.2) % BLINK_CYCLE + BLINK_CYCLE) % BLINK_CYCLE;
  for (const gap of BLINKS) {
    if (at < BLINK_LENGTH) return sin(Math.PI * at / BLINK_LENGTH) ** 2;
    at -= gap;
    if (at < 0) return 0;
  }
  return 0;
}

/** Stable pseudo random 0 to 1 per printed line, so line lengths vary like text. */
export function lineHash(n: number) {
  const x = sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
