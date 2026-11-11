/**
 * Pose math for the AI mascot. Every state is a continuous function of time, so loops have no seam:
 * nothing restarts, the curves simply keep going. A frame is the blend of two poses while a status changes.
 */

export type MascotStatus = "idle" | "listening" | "thinking" | "writing" | "done" | "error";

export const MASCOT_STATUSES: MascotStatus[] = ["idle", "listening", "thinking", "writing", "done", "error"];

export const STATUS_LABEL: Record<MascotStatus, string> = {
  idle: "Ready",
  listening: "Listening",
  thinking: "Thinking",
  writing: "Writing",
  done: "Done",
  error: "Something went wrong",
};

export interface Pose {
  /** Body translate, rotation in degrees and scale around the bottom center. */
  bx: number; by: number; brot: number; bsx: number; bsy: number;
  /** Gaze target in eye units and how stiff the eyes follow it. */
  gx: number; gy: number; gk: number;
  /** How much the pointer may steer the gaze (0 to 1). */
  pointer: number;
  eyeS: number; happy: number; worry: number; blinkable: number;
  /** Companion dot: position, scale, opacity, how far behind the body it is (0 front, 1 back). */
  dx: number; dy: number; dr: number; dop: number; back: number;
  /** Sparkle morph of the dot, its rotation, and a second smaller sparkle. */
  star: number; srot: number; star2: number;
  /** Writing line: current end x and opacity. */
  lx: number; lop: number;
}

export interface Geometry {
  compact: boolean;
  view: string;
  eyeW: number; eyeL: number;
  gazeX: number; gazeY: number;
  dotR: number; starS: number;
  orbit: { cx: number; cy: number; rx: number; ry: number };
  home: [number, number]; listen: [number, number]; done: [number, number]; err: [number, number];
  x0: number; x1: number; ly: number;
}

export const FULL: Geometry = {
  compact: false, view: "4 8 112 112",
  eyeW: 8, eyeL: 8, gazeX: 8, gazeY: 6,
  dotR: 4.5, starS: 1,
  orbit: { cx: 60, cy: 25, rx: 46, ry: 9 },
  home: [94, 24], listen: [91, 20], done: [95, 23], err: [93, 32],
  x0: 36, x1: 84, ly: 115,
};

export const COMPACT: Geometry = {
  compact: true, view: "18 16 84 84",
  eyeW: 10.5, eyeL: 6.5, gazeX: 6.5, gazeY: 4.5,
  dotR: 7, starS: 1.4,
  orbit: { cx: 60, cy: 26, rx: 35, ry: 6.5 },
  home: [92, 26], listen: [90, 24], done: [90, 27], err: [91, 31],
  x0: 38, x1: 82, ly: 111,
};

const TAU = Math.PI * 2;
const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const easeInOutCubic = (t: number) => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;
const easeOutQuad = (t: number) => 1 - (1 - t) * (1 - t);

/** Writing cycle: a line is written left to right, then the pen lifts and returns while the line fades. */
const WRITE_PERIOD = 1.75;
const WRITE_TIME = 1.34;

export interface PoseInput {
  /** Seconds on the mascot's own clock, which only runs while it is visible. */
  t: number;
  /** Seconds since this status began. */
  te: number;
  geo: Geometry;
  /** Idle glance target picked by the scheduler. */
  glance: [number, number];
  /** Reduced motion: a still, representative pose with no travel or loops. */
  still: boolean;
}

export function poseFor(status: MascotStatus, { t, te, geo, glance, still }: PoseInput): Pose {
  const breath = still ? 0 : Math.sin((TAU * t) / 3.6);
  const sway = still ? 0 : Math.sin((TAU * t) / 7.2);
  const float = still ? 0 : Math.sin((TAU * t) / 4.8);
  const base: Pose = {
    bx: 0, by: -1.3 * breath, brot: .8 * sway, bsx: 1 - .012 * breath, bsy: 1 + .018 * breath,
    gx: 0, gy: 0, gk: 260, pointer: 1,
    eyeS: 1, happy: 0, worry: 0, blinkable: 1,
    dx: geo.home[0] + 1.2 * float, dy: geo.home[1] + 1.8 * Math.sin((TAU * t) / 3.6 + 1.1) * (still ? 0 : 1), dr: 1, dop: 1, back: 0,
    star: 0, srot: 0, star2: 0,
    lx: geo.x0, lop: 0,
  };

  switch (status) {
    case "idle":
      return { ...base, gx: glance[0] * geo.gazeX, gy: glance[1] * geo.gazeY, gk: 900 };

    case "listening": {
      // A voice-like level from three slow sines: smooth, organic, never repeating visibly.
      const level = still ? .4 : .5 + .5 * (Math.sin(t * 7.1) * .55 + Math.sin(t * 11.3 + 1.3) * .3 + Math.sin(t * 3.7) * .15);
      return {
        ...base,
        by: -1 - (still ? 0 : .55 * Math.sin((TAU * t) / 1.7)), brot: 0,
        bsx: 1.03 - .008 * breath, bsy: 1.04 + .012 * breath,
        gx: 0, gy: .08 * geo.gazeY, gk: 220, eyeS: 1.16,
        dx: geo.listen[0], dy: geo.listen[1], dr: .92 + .3 * level,
      };
    }

    case "thinking": {
      const { cx, cy, rx, ry } = geo.orbit;
      const angle = still ? Math.PI * .7 : -.5 + te * (TAU / 2.4);
      const depth = Math.sin(angle);
      const x = cx + rx * Math.cos(angle);
      return {
        ...base,
        by: -1 - .8 * breath, brot: 3 + (still ? 0 : .6 * Math.sin((TAU * t) / 4)),
        gx: ((x - cx) / rx) * geo.gazeX * .55, gy: -geo.gazeY + depth * .8, gk: 70, pointer: 0,
        dx: x, dy: cy + ry * depth, dr: .84 + .16 * depth, dop: .8 + .2 * (depth + 1) / 2,
        // Switch layers only near the ends of the orbit, where the dot is clear of the body.
        back: clamp(.5 - depth * 4),
      };
    }

    case "writing": {
      const u = still ? WRITE_TIME * .6 : te % WRITE_PERIOD;
      let x: number, y: number, lx: number, lop: number;
      if (u < WRITE_TIME) {
        const p = u / WRITE_TIME;
        const e = easeInOutSine(p) + .012 * Math.sin(TAU * 4 * p);
        x = geo.x0 + (geo.x1 - geo.x0) * e;
        y = geo.ly + .5 * Math.sin(TAU * 7 * p);
        lx = x;
        lop = clamp((x - geo.x0) / 4);
      } else {
        const q = (u - WRITE_TIME) / (WRITE_PERIOD - WRITE_TIME);
        x = geo.x1 + (geo.x0 - geo.x1) * easeInOutCubic(q);
        y = geo.ly - 7 * Math.sin(Math.PI * q);
        lx = geo.x1;
        lop = 1 - easeOutQuad(q);
      }
      const hidden = geo.compact;
      return {
        ...base,
        by: -.6 * breath + (still ? 0 : .7 * Math.sin((TAU * te) / (WRITE_PERIOD / 2))), brot: (x - 60) * .045,
        gx: ((x - 60) / ((geo.x1 - geo.x0) / 2)) * geo.gazeX * .5, gy: geo.gazeY * .75, gk: 520, pointer: 0,
        dx: x, dy: y, dop: hidden ? 0 : 1, dr: hidden ? .6 : 1,
        lx: hidden ? geo.x0 : lx, lop: hidden ? 0 : lop,
      };
    }

    case "done":
      return {
        ...base,
        by: -1.5 - 1.1 * breath, bsy: 1.015 + .016 * breath,
        gx: 0, gy: -.25 * geo.gazeY, gk: 160, eyeS: 1.04, happy: 1, blinkable: 0,
        dx: geo.done[0], dy: geo.done[1], dr: 1 + (still ? 0 : .07 * Math.sin((TAU * t) / 2.2)),
        star: 1, srot: still ? 0 : 10 * Math.sin((TAU * t) / 3.2), star2: geo.compact ? 0 : 1,
      };

    case "error":
      return {
        ...base,
        by: 1 - .5 * breath, brot: 0, bsx: 1.01 - .006 * breath, bsy: .985 + .01 * breath,
        gx: 0, gy: .42 * geo.gazeY, gk: 220, pointer: .6, eyeS: .86, worry: 1,
        dx: geo.err[0], dy: geo.err[1], dop: .55, dr: .85,
      };
  }
}

/**
 * One shake when an error arrives, decaying to rest within about .7s. It is added after the pose blend so the
 * transition does not swallow it.
 */
export function errorShake(te: number) {
  const s = te - .06;
  return s <= 0 || s > 1 ? 0 : 3.2 * Math.exp(-s * 6) * Math.sin(s * TAU * 5.5);
}

export function mixPose(a: Pose, b: Pose, w: number): Pose {
  const out = {} as Pose;
  for (const key in a) {
    const k = key as keyof Pose;
    out[k] = a[k] + (b[k] - a[k]) * w;
  }
  return out;
}

/** How far the dot sits on the body (0 off, 1 fully on), so it can take the eye color there and stay visible. */
export function overlap(x: number, y: number, by: number) {
  const e = ((x - 60) / 36) ** 2 + ((y - 62 - by) / 34) ** 2;
  return clamp((1.1 - e) / .3);
}

export const BODY_PATH = "M60 28C84 28 96 44 96 64C96 84 82 96 60 96C38 96 24 84 24 64C24 44 36 28 60 28Z";
export const STAR_PATH = "M0 -7C.9 -1.6 1.6 -.9 7 0C1.6 .9 .9 1.6 0 7C-.9 1.6 -1.6 .9 -7 0C-1.6 -.9 -.9 -1.6 0 -7Z";

export interface FrameAttrs {
  body: string;
  pill: [string, string];
  arc: [string, string];
  arcOpacity: string;
  brows: string; browOpacity: string;
  dotFront: { cx: string; cy: string; r: string; opacity: string; on: string };
  dotBack: { cx: string; cy: string; r: string; opacity: string };
  star: string; starOpacity: string;
  star2: string; star2Opacity: string;
  line: { x2: string; opacity: string };
  shadow: string;
}

const f = (value: number) => (Math.round(value * 100) / 100).toString();
const EYES: [number, number] = [47, 60];
const EYE_GAP = 26;

/** Turns a pose plus the live gaze and blink into SVG attribute strings. Used for the first render and every frame. */
export function frameAttrs(pose: Pose, gaze: [number, number], open: number, geo: Geometry): FrameAttrs {
  const { bx, by, brot, bsx, bsy } = pose;
  const body = `translate(${f(bx)} ${f(by)}) translate(60 96) rotate(${f(brot)}) scale(${f(bsx)} ${f(bsy)}) translate(-60 -96)`;
  const happy = clamp(pose.happy);
  const pillY = Math.max(.06, open * clamp(1 - 2 * happy)) * pose.eyeS;
  const arcY = clamp(2 * happy - 1);
  const pill = [0, 1].map(i => {
    const x = EYES[0] + i * EYE_GAP + gaze[0] + (i === 0 ? -1 : 1) * (pose.eyeS - 1) * 3;
    const y = EYES[1] + gaze[1];
    return `translate(${f(x)} ${f(y)}) scale(${f(pose.eyeS)} ${f(pillY)})`;
  }) as [string, string];
  const arc = [0, 1].map(i => {
    const x = EYES[0] + i * EYE_GAP + gaze[0] * .4;
    const y = EYES[1] - 1 + gaze[1] * .4;
    return `translate(${f(x)} ${f(y)}) scale(${f(pose.eyeS)} ${f(Math.max(.06, arcY))})`;
  }) as [string, string];
  const worry = clamp(pose.worry);
  const brows = `translate(${f(gaze[0] * .5)} ${f(gaze[1] * .4 + (1 - worry) * 3)})`;

  const dotR = geo.dotR * pose.dr * clamp(1 - pose.star);
  const back = clamp(pose.back);
  const dotOpacity = clamp(pose.dop);
  const ring = overlap(pose.dx, pose.dy, by);
  const starS = geo.starS * pose.dr * clamp(pose.star);
  const star = `translate(${f(pose.dx)} ${f(pose.dy)}) rotate(${f(pose.srot)}) scale(${f(Math.max(.001, starS))})`;
  const s2 = clamp(pose.star2);
  const star2 = `translate(${f(pose.dx + 11)} ${f(pose.dy + 15)}) rotate(${f(-pose.srot * 1.4)}) scale(${f(Math.max(.001, .5 * s2 * (2 - pose.dr)))})`;
  const lift = -by;
  const shadow = `translate(60 104) scale(${f((1 - lift * .018) * bsx)} 1)`;

  return {
    body, pill, arc,
    arcOpacity: f(clamp((happy - .45) / .15)),
    brows, browOpacity: f(worry),
    dotFront: { cx: f(pose.dx), cy: f(pose.dy), r: f(dotR), opacity: f(dotOpacity * (1 - back)), on: f(ring * dotOpacity * (1 - back)) },
    dotBack: { cx: f(pose.dx), cy: f(pose.dy), r: f(dotR), opacity: f(dotOpacity * back) },
    star: star, starOpacity: f(clamp(pose.star * 4) * dotOpacity),
    star2, star2Opacity: f(clamp(s2 * 3)),
    // A zero-length line would still draw its round cap as a dot, so the line fades in over its first few units.
    line: { x2: f(Math.max(geo.x0, pose.lx)), opacity: f(clamp(pose.lop) * clamp((pose.lx - geo.x0) / 4)) },
    shadow,
  };
}
