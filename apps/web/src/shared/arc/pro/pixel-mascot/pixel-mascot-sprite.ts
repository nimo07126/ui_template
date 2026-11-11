/**
 * Pixel mascot sprite: geometry, poses and the frame math. Everything lives on a 24 by 24 grid and moves in whole
 * pixels on a fixed 40ms sprite clock, so every size is an exact integer multiple of the same art.
 */

export type PixelMascotStatus = "idle" | "thinking" | "writing" | "done" | "error";

export const GRID = 24;
/** One sprite step. Every pose change lands on this clock. */
export const STEP = 40;
/** Where the robot's local origin (antenna tip, left edge of the head) sits on the grid. */
const OX = 5;
const OY = 9;

export type Rect = readonly [x: number, y: number, w: number, h: number];
type Point = readonly [x: number, y: number];

export const toPath = (rects: readonly Rect[]) => rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join("");
const px = (points: readonly Point[]): Rect[] => points.map(([x, y]) => [x, y, 1, 1]);

/** Static art. Robot parts use local coordinates; the bubble and sparkles use grid coordinates. */
export const art = {
  tip: [[6, 0, 2, 1]] as Rect[],
  ink: [[6, 1, 2, 1], [1, 2, 12, 1], [1, 11, 12, 1], [0, 3, 1, 8], [13, 3, 1, 8]] as Rect[],
  body: [[1, 3, 12, 8]] as Rect[],
  shade: [[1, 10, 12, 1], [12, 3, 1, 7]] as Rect[],
  // The screen keeps a one pixel margin around the eyes in every pose, so eyes never merge with the head.
  screen: [[3, 4, 8, 1], [2, 5, 10, 3], [3, 8, 8, 1]] as Rect[],
  cheeks: px([[2, 9], [11, 9]]),
  happy: px([[3, 6], [4, 5], [5, 6], [8, 6], [9, 5], [10, 6]]),
  cross: px([[3, 5], [5, 5], [4, 6], [3, 7], [5, 7], [8, 5], [10, 5], [9, 6], [8, 7], [10, 7]]),
  keyboardInk: [[-1, 11, 16, 1], [-1, 12, 1, 1], [14, 12, 1, 1], [0, 13, 14, 1]] as Rect[],
  keyboardGaps: [[0, 12, 1, 1], [2, 12, 1, 1], [4, 12, 1, 1], [6, 12, 2, 1], [9, 12, 1, 1], [11, 12, 1, 1], [13, 12, 1, 1]] as Rect[],
  keyboardKeys: px([[1, 12], [3, 12], [5, 12], [8, 12], [10, 12], [12, 12]]),
  cloudInk: [[15, 0, 7, 1], [15, 4, 7, 1], [14, 1, 1, 3], [22, 1, 1, 3]] as Rect[],
  cloudFill: [[15, 1, 7, 3]] as Rect[],
  tailNear: [[15, 8, 1, 1]] as Rect[],
  tailFar: [[16, 6, 1, 1]] as Rect[],
};

/** Key columns on the keyboard, left hand first. */
const KEYS = [1, 3, 5, 8, 10, 12];
export const DOTS = [16, 18, 20];

/** Arm poses for the left arm, ordered so neighbours differ by one pixel: up, mid, rest, droop, hover, press. */
const ARMS: Point[][] = [
  [[-1, 5], [-2, 4], [-2, 3]],
  [[-1, 5], [-1, 6]],
  [[-1, 6], [-1, 7]],
  [[-1, 7], [-1, 8]],
  [[-1, 8], [-1, 9]],
  [[-1, 9], [-1, 10]],
];
const UP = 0, MID = 1, REST = 2, DROOP = 3, HOVER = 4, PRESS = 5;

export const SPARKS: { x: number; y: number; reach: 1 | 2 }[] = [{ x: 2, y: 5, reach: 2 }, { x: 21, y: 4, reach: 2 }, { x: 7, y: 2, reach: 1 }];
export const sparkArt = (x: number, y: number) => ({
  core: px([[x, y]]),
  near: px([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]),
  far: px([[x - 2, y], [x + 2, y], [x, y - 2], [x, y + 2]]),
});

export interface Eyes { kind: "pair" | "happy" | "cross"; dx: number; y: number; h: number }
export interface Pose {
  dx: number;
  dy: number;
  eyes: Eyes;
  armL: number;
  armR: number;
  /** 0 hidden, 1 near tail dot, 2 both tail dots, 3 cloud. */
  bubble: number;
  /** 0 hidden, 1 and 2 rising, 3 in place. */
  keyboard: number;
  antenna: boolean;
  /** Lit thinking dot, -1 for none, -2 for all three (still pose). */
  dot: number;
  sparks: number[];
  key: number;
}

const OPEN: Eyes = { kind: "pair", dx: 0, y: 5, h: 3 };
const THINK: Eyes = { kind: "pair", dx: 1, y: 5, h: 2 };
const SCAN: Eyes = { kind: "pair", dx: 0, y: 6, h: 2 };
const HAPPY: Eyes = { kind: "happy", dx: 0, y: 5, h: 2 };
const CROSS: Eyes = { kind: "cross", dx: 0, y: 5, h: 3 };

const blink = (eyes: Eyes): Eyes => ({ ...eyes, y: eyes.y + eyes.h - 1, h: 1 });
const within = (t: number, from: number, to: number) => t >= from && t < to;
/** A one pixel bob: level for the first half of the period, up for the second. */
const bob = (t: number, period: number) => (t % period < period / 2 ? 0 : -1);
const lookup = (table: readonly (readonly [number, number])[], t: number, fallback: number) => table.find(([until]) => t < until)?.[1] ?? fallback;

/** Typing rhythm over a 1.6s bar: eight keystrokes, then a short pause before the line repeats. */
const HITS = [[0, 1], [160, 4], [320, 0], [480, 2], [640, 5], [880, 3], [1040, 1], [1200, 4]] as const;
/** Done: crouch, rise with an ease out, hold at the top, settle with an ease in. One pixel per step, no rebound. */
const JUMP = [[80, 1], [120, 0], [160, -1], [200, -2], [320, -3], [360, -2], [400, -1]] as const;
const RAISE = [[80, REST], [120, MID], [400, UP], [440, MID]] as const;
const SPARK_START = [200, 280, 360];
const SHAKE = [1, 0, -1, 0, 1, 0];

/** Where every part wants to be at time t (ms since the status began). With still, the resting pose for the status. */
export function targetPose(status: PixelMascotStatus, t: number, still: boolean): Pose {
  const pose: Pose = { dx: 0, dy: 0, eyes: OPEN, armL: REST, armR: REST, bubble: 0, keyboard: 0, antenna: true, dot: -1, sparks: [0, 0, 0], key: -1 };
  switch (status) {
    case "idle": {
      if (still) return pose;
      pose.dy = bob(t, 2000);
      const cycle = t % 8000;
      const eyes = within(cycle, 3600, 4400) ? { ...OPEN, dx: 1 } : OPEN;
      pose.eyes = within(cycle, 2400, 2480) || within(cycle, 5600, 5680) || within(cycle, 5880, 5960) ? blink(eyes) : eyes;
      return pose;
    }
    case "thinking": {
      pose.bubble = 3;
      pose.eyes = THINK;
      if (still) { pose.dot = -2; return pose; }
      pose.dy = bob(t, 2400);
      const beat = Math.floor(t / 280) % 4;
      pose.dot = beat < 3 ? beat : -1;
      pose.antenna = beat !== 3;
      if (within(t % 2800, 2000, 2080)) pose.eyes = blink(THINK);
      return pose;
    }
    case "writing": {
      pose.keyboard = 3;
      pose.armL = pose.armR = HOVER;
      pose.eyes = SCAN;
      const typed = t - 200;
      if (still || typed < 0) return pose;
      const bar = typed % 1600;
      pose.eyes = { ...SCAN, dx: bar < 500 ? -1 : bar < 1000 ? 0 : 1 };
      const hit = HITS.find(([at]) => within(bar, at, at + 80));
      if (hit) {
        pose.key = hit[1];
        if (hit[1] < 3) pose.armL = PRESS; else pose.armR = PRESS;
      }
      return pose;
    }
    case "done": {
      pose.eyes = HAPPY;
      if (still) return pose;
      pose.dy = t < 900 ? lookup(JUMP, t, 0) : bob(t - 900, 2000);
      pose.armL = pose.armR = lookup(RAISE, t, REST);
      pose.sparks = SPARK_START.map(start => (within(t - start, 0, 320) ? Math.floor((t - start) / 80) + 1 : 0));
      return pose;
    }
    case "error": {
      pose.eyes = CROSS;
      pose.dy = 1;
      pose.armL = pose.armR = DROOP;
      pose.antenna = false;
      if (!still && t < 240) { pose.dx = SHAKE[Math.floor(t / 40)] ?? 0; pose.dy = 0; }
      return pose;
    }
  }
}

export const stillPose = (status: PixelMascotStatus) => targetPose(status, 0, true);

const toward = (from: number, to: number) => from + Math.sign(to - from);

/** Eyes morph one pixel per step: lids close and open, eyes slide, and other shapes swap through a closed lid. */
function morphEyes(from: Eyes, to: Eyes): Eyes {
  if (from.kind !== to.kind) {
    if (from.kind === "pair") return from.h > 1 ? { ...from, y: from.y + 1, h: from.h - 1 } : to;
    return to.kind === "pair" ? blink(to) : { kind: "pair", dx: 0, y: 6, h: 1 };
  }
  if (from.kind !== "pair") return from;
  if (from.h > to.h) return to.y > from.y ? { ...from, y: from.y + 1, h: from.h - 1 } : { ...from, h: from.h - 1 };
  if (from.h < to.h) return to.y < from.y ? { ...from, y: from.y - 1, h: from.h + 1 } : { ...from, h: from.h + 1 };
  if (from.y !== to.y) return { ...from, y: toward(from.y, to.y) };
  if (from.dx !== to.dx) return { ...from, dx: toward(from.dx, to.dx) };
  return from;
}

/** One sprite step from the shown pose toward the target. Nothing moves more than one pixel or one frame per step. */
export function advance(shown: Pose, target: Pose): Pose {
  const keyboard = toward(shown.keyboard, target.keyboard);
  return {
    dx: target.dx,
    dy: toward(shown.dy, target.dy),
    eyes: morphEyes(shown.eyes, target.eyes),
    armL: toward(shown.armL, target.armL),
    armR: toward(shown.armR, target.armR),
    bubble: toward(shown.bubble, target.bubble),
    keyboard,
    antenna: target.antenna,
    dot: target.dot,
    sparks: target.sparks,
    key: keyboard === 3 ? target.key : -1,
  };
}

export type Attrs = Record<string, string>;
const SHADOW_WIDTH: Record<number, number> = { 1: 12, 0: 10, [-1]: 10, [-2]: 8, [-3]: 6 };
const SHADOW_OPACITY: Record<number, number> = { 1: 1, 0: 1, [-1]: 0.7, [-2]: 0.6, [-3]: 0.45 };
const vis = (on: boolean) => (on ? "visible" : "hidden");

/** Every attribute the pose sets, by part. The first render and the animation loop both write from this. */
export function poseAttrs(pose: Pose): Record<string, Attrs> {
  const { eyes } = pose;
  const out: Record<string, Attrs> = {
    root: { "data-screen": eyes.kind === "cross" ? "error" : "normal", "data-antenna": pose.antenna && eyes.kind !== "cross" ? "on" : "off" },
    body: { transform: `translate(${OX + pose.dx} ${OY + pose.dy})` },
    eyeL: { x: String(4 + eyes.dx), y: String(eyes.y), height: String(eyes.h), visibility: vis(eyes.kind === "pair") },
    eyeR: { x: String(8 + eyes.dx), y: String(eyes.y), height: String(eyes.h), visibility: vis(eyes.kind === "pair") },
    happy: { visibility: vis(eyes.kind === "happy") },
    cross: { visibility: vis(eyes.kind === "cross") },
    cheeks: { visibility: vis(eyes.kind === "happy") },
    keyboard: { transform: `translate(0 ${[0, 2, 1, 0][pose.keyboard]})`, visibility: vis(pose.keyboard > 0) },
    key: { x: String(KEYS[Math.max(0, pose.key)]), visibility: vis(pose.key >= 0) },
    tailNear: { visibility: vis(pose.bubble >= 1) },
    tailFar: { visibility: vis(pose.bubble >= 2) },
    cloud: { visibility: vis(pose.bubble >= 3) },
  };
  const clampedDy = Math.max(-3, Math.min(1, pose.dy));
  const width = SHADOW_WIDTH[clampedDy];
  out.shadow = { x: String(GRID / 2 - width / 2), width: String(width), opacity: String(SHADOW_OPACITY[clampedDy]) };
  (["L", "R"] as const).forEach(side => {
    const points = ARMS[side === "L" ? pose.armL : pose.armR];
    for (let i = 0; i < 3; i++) {
      const [x, y] = points[Math.min(i, points.length - 1)];
      out[`arm${side}${i}`] = { x: String(side === "L" ? x : 13 - x), y: String(y), visibility: vis(i < points.length) };
    }
  });
  DOTS.forEach((_, i) => {
    // The lit dot steps along in place; a rise would touch the cloud outline at this size.
    out[`dot${i}`] = { opacity: pose.dot === i || pose.dot === -2 ? "1" : "0.3" };
  });
  pose.sparks.forEach((frame, i) => {
    out[`spark${i}core`] = { visibility: vis(frame === 1 || frame === 2) };
    out[`spark${i}near`] = { visibility: vis(frame === 2 || frame === 3) };
    out[`spark${i}far`] = { visibility: vis(frame === 3 || frame === 4) };
  });
  return out;
}
