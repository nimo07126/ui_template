"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { Pause, Play } from "lucide-react";
import styles from "./model-training.module.css";

export interface ModelTrainingLabels {
  /** Name of the stack of training data. */
  training?: string;
  /** Name of the stack the model never trains on. */
  heldOut?: string;
  /** What one sample is, used after the sample counts. */
  unit?: string;
  /** Layer names under the network. */
  input?: string;
  hidden?: string;
  output?: string;
  /** Readout names. */
  loss?: string;
  epoch?: string;
  evaluation?: string;
  /** Evaluation states. */
  waiting?: string;
  running?: string;
  passed?: string;
  /** Loss line before the first batch has been scored. */
  noBatch?: string;
}

/**
 * An animated model training illustration. Batches peel off a stack of training data and feed a small neural network.
 * Signals flow forward to a prediction, the error flows back and strengthens the useful connections, a loss curve
 * descends beside the network over the epochs, and a held-out set runs through at the end while an evaluation check
 * turns green. A step bar replays the story or jumps to any stage.
 */
export interface ModelTrainingProps {
  /** The two labels the model learns to predict. */
  classes?: readonly string[];
  /** Units in the input layer, from 2 to 5. One per feature on a data sheet. */
  inputs?: number;
  /** Units in the two hidden layers, each from 2 to 6. */
  hidden?: readonly number[];
  /** Samples in the training set. */
  samples?: number;
  /** Samples in the held-out set. */
  heldOutSamples?: number;
  /** Samples per batch, used in the captions and hover details. */
  batchSize?: number;
  /** Epochs the story trains for. */
  epochs?: number;
  /** Loss after the first batch. */
  lossFrom?: number;
  /** Loss after the last epoch. */
  lossTo?: number;
  /** Accuracy on the held-out set, in percent. */
  accuracy?: number;
  /** Accuracy the evaluation must reach to pass, in percent. */
  target?: number;
  /** Names on the diagram and readouts. */
  labels?: ModelTrainingLabels;
  /** Labels for the five stages: batch, forward pass, backprop, epochs and evaluate. */
  steps?: readonly string[];
  /** Stage to start on, from 0 to 4. */
  defaultStep?: number;
  /** Shows a sentence under the step bar that explains the current stage. */
  caption?: boolean;
  /** Shows the step bar with play and pause, so viewers can replay the story or jump to a stage. */
  controls?: boolean;
  /** Multiplies the playback speed. One full run takes about 21 seconds at 1. 0 holds still. */
  speed?: number;
  /** Holds the illustration still. Held from the start, it shows the finished, evaluated model. */
  paused?: boolean;
  /** Any CSS color for signals, learned connections, the loss curve and the active stage. Defaults to the theme accent. */
  accent?: string;
  /** Accessible description. Defaults to a sentence built from the classes and numbers. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Pt = [number, number];
type Bezier = [Pt, Pt, Pt, Pt];
interface Hop { s: number; d: number }
interface Edge { a: number; i: number; j: number; curve: Bezier; init: number; target: number }
interface Geo {
  w: number;
  h: number;
  narrow: boolean;
  D: number;
  SD: number;
  sheetW: number;
  sheetH: number;
  train: Pt;
  held: Pt;
  trainLabelY: number;
  heldLabelY: number;
  xs: number[];
  ys: number[][];
  cy: number;
  r: number;
  plates: { x: number; y: number; w: number; h: number }[];
  labelY: number;
  edges: Edge[];
  classX: number;
  barW: number;
}
interface ChartGeo { w: number; h: number; left: number; right: number; top: number; bottom: number; pts: Pt[]; cum: number[]; d: string }
type HoverKey = "train" | "held" | "l0" | "l1" | "l2" | "l3" | null;

const DEFAULT_STEPS = ["Batch", "Forward pass", "Backprop", "Epochs", "Evaluate"];
const DEFAULT_CLASSES = ["Positive", "Negative"];

/* One run, in seconds at speed 1. */
const CYCLE = 21.45;
const RESET_END = .8;
const STAGES = [0, 3.2, 6.2, 9.2, 16.35];
/** A representative frame for each stage, used with reduced motion and when a stage is picked while held. */
const STILL = [2.9, 4.75, 7.8, 14, 20.45];
const DEFAULT_STILL_STEP = 4;
const EPOCH_RUNS = 5;
const EPOCH_START = 9.2;
/* One epoch run every 1.35s: a calm, even beat rather than a flurry. */
const EPOCH_GAP = 1.35;
const EPOCH_PEEL = .46;
const EPOCH_BACK = 1.04;
const EVAL_START = 16.55;
const EVAL_DONE = 19.15;
const DASH = .2;

const TRAIN_PEELS: Hop[] = [{ s: 1, d: 1.5 }];
const FWD: Hop[][] = [[], [], []];
const BWD: Hop[][] = [[], [], []];
for (let k = 0; k < 3; k++) {
  FWD[k].push({ s: 3.4 + .9 * k, d: .8 });
  BWD[k].push({ s: 6.4 + .9 * (2 - k), d: .8 });
}
for (let c = 0; c < EPOCH_RUNS; c++) {
  const cs = EPOCH_START + EPOCH_GAP * c;
  TRAIN_PEELS.push({ s: cs, d: EPOCH_PEEL });
  for (let k = 0; k < 3; k++) {
    FWD[k].push({ s: cs + EPOCH_PEEL + .2 * k, d: .38 });
    BWD[k].push({ s: cs + EPOCH_BACK + .15 * (2 - k), d: .36 });
  }
}
const HELD_PEEL: Hop = { s: EVAL_START, d: .9 };
for (let k = 0; k < 3; k++) FWD[k].push({ s: EVAL_START + 1 + .5 * k, d: .55 });
const FIRST_SCORE = FWD[2][0].s + FWD[2][0].d;
const EVAL_RUN = [FWD[0][FWD[0].length - 1].s, FWD[2][FWD[2].length - 1].s + FWD[2][FWD[2].length - 1].d];
/** When each layer receives a signal (forward) or an error (backward), for the node pulses. */
const FWD_ARRIVE: number[][] = [[...TRAIN_PEELS, HELD_PEEL].map(h => h.s + h.d), ...FWD.map(list => list.map(h => h.s + h.d))];
const BWD_ARRIVE: number[][] = [BWD[0].map(h => h.s + h.d), BWD[1].map(h => h.s + h.d), BWD[2].map(h => h.s + h.d), BWD[2].map(h => h.s)];

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
const mod = (a: number, b: number) => ((a % b) + b) % b;
const smooth = (from: number, to: number, t: number) => { const x = clamp((t - from) / (to - from)); return x * x * (3 - 2 * x); };
const easeInOut = (x: number) => { const t = clamp(x); return t * t * t * (t * (t * 6 - 15) + 10); };
const easeOut = (x: number) => 1 - (1 - clamp(x)) ** 3;
const ends = (q: number) => clamp(Math.min(q / .14, (1 - q) / .14));
const f = (n: number) => n.toFixed(2);
const lerp = (a: Pt, b: Pt, t: number): Pt => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
const bez = (c: Bezier, t: number): Pt => {
  const a = lerp(c[0], c[1], t), b = lerp(c[1], c[2], t), d = lerp(c[2], c[3], t);
  return lerp(lerp(a, b, t), lerp(b, d, t), t);
};
const pathOf = (c: Bezier) => `M${f(c[0][0])} ${f(c[0][1])}C${f(c[1][0])} ${f(c[1][1])} ${f(c[2][0])} ${f(c[2][1])} ${f(c[3][0])} ${f(c[3][1])}`;
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
/** A stable pseudo random number per index, so server and client draw the same weights. */
const rand = (i: number) => { const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); };
const active = (list: Hop[], t: number) => { for (const h of list) if (t >= h.s && t <= h.s + h.d) return h; return null; };
const pulseAt = (times: number[], t: number, len = .6) => {
  let at = -Infinity;
  for (const x of times) if (x <= t && x > at) at = x;
  const q = (t - at) / len;
  return q >= 0 && q < 1 ? q : -1;
};
const stageAt = (t: number) => { let s = 0; for (let i = 0; i < STAGES.length; i++) if (t >= STAGES[i]) s = i; return s; };

/** How far each group of weights has learned: a small nudge after the first backprop, the rest over the epochs. */
function learnedAt(group: number, t: number) {
  if (t < RESET_END) return 1 - smooth(.05, .75, t);
  let v = .12 * smooth(BWD[group][0].s + .1, BWD[group][0].s + BWD[group][0].d, t);
  for (let c = 1; c <= EPOCH_RUNS; c++) { const h = BWD[group][c]; v += (.88 / EPOCH_RUNS) * smooth(h.s, h.s + h.d, t); }
  return v;
}
/** Training progress from the first batch to the last epoch, which drives the loss, epoch count and predictions. */
function progressAt(t: number) {
  if (t < RESET_END) return 1;
  let p = .03 * smooth(BWD[0][0].s + .1, BWD[0][0].s + BWD[0][0].d, t);
  for (let c = 0; c < EPOCH_RUNS; c++) { const cs = EPOCH_START + EPOCH_GAP * c; p += (.97 / EPOCH_RUNS) * smooth(cs + EPOCH_BACK, cs + EPOCH_BACK + .66, t); }
  return p;
}
const lossCurve = (p: number, from: number, to: number) => {
  const k = 4.2, base = (Math.exp(-k * p) - Math.exp(-k)) / (1 - Math.exp(-k));
  const noise = .045 * (from - to) * (.5 + .5 * Math.sin(p * 41) * Math.sin(p * 13 + 1)) * 4 * p * (1 - p);
  return to + (from - to) * base + noise;
};

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (cb: () => void) => {
  const mq = window.matchMedia(REDUCE);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
function useReducedFlag() {
  return useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);
}

function buildGeometry(w: number, sizes: number[]): Geo {
  const narrow = w < 480;
  const D = narrow ? 4 : 5, SD = narrow ? 4 : 5;
  const sheetW = Math.round(narrow ? 64 : clamp(w * .15, 76, 100));
  const sheetH = Math.round(sheetW * (narrow ? .64 : .68));
  const maxN = Math.max(...sizes);
  const sp = narrow ? 36 : 44;
  const r = narrow ? 5.5 : 6.5;
  const pad = narrow ? 16 : 20;
  const pw = narrow ? 22 : 28;
  const right = narrow ? 78 : 112;
  let h: number, train: Pt, held: Pt, x0: number, cy: number;
  if (narrow) {
    /* Phones: the two stacks sit side by side above the network, and batches drop into the input layer. */
    const top = 4 + SD * 3;
    train = [2 + sheetW / 2, top + sheetH / 2];
    held = [2 + sheetW * 1.5 + SD * 3 + 28, top + sheetH / 2];
    cy = Math.round(top + sheetH + 40 + 34 + ((maxN - 1) / 2) * sp + pad);
    x0 = pw / 2 + 4;
    h = Math.round(cy + ((maxN - 1) / 2) * sp + pad + 30);
  } else {
    /* Two blocks on the left: the training stack above the held-out stack, each with two lines of label. */
    h = 316;
    const block = SD * 3 + sheetH + 40;
    const gap = (h - block * 2) / 3;
    train = [2 + sheetW / 2, gap + SD * 3 + sheetH / 2];
    held = [2 + sheetW / 2, gap * 2 + block + SD * 2 + sheetH / 2];
    x0 = 2 + sheetW + SD * 3 + clamp(w * .1, 44, 80);
    cy = Math.round(h / 2 - 10);
  }
  const x3 = w - right;
  const xs = [0, 1, 2, 3].map(l => x0 + (x3 - x0) * l / 3);
  const ys = sizes.map(n => Array.from({ length: n }, (_, i) => cy + (i - (n - 1) / 2) * sp));
  const plates = sizes.map((n, l) => ({ x: xs[l] - pw / 2, y: cy - ((n - 1) / 2) * sp - pad, w: pw, h: (n - 1) * sp + pad * 2 }));
  const labelY = cy + ((maxN - 1) / 2) * sp + pad + 20;
  const edges: Edge[] = [];
  let n = 0;
  for (let a = 0; a < 3; a++) for (let i = 0; i < sizes[a]; i++) for (let j = 0; j < sizes[a + 1]; j++) {
    const p0: Pt = [xs[a] + r + 1, ys[a][i]], p3: Pt = [xs[a + 1] - r - 1, ys[a + 1][j]];
    const dx = (p3[0] - p0[0]) * .5;
    const init = .2 + .16 * rand(n * 3 + 1);
    const raw = rand(n * 7 + 5);
    /* A few connections become strong, most stay light, so the learned structure reads at a glance. */
    const target = raw > .72 ? .78 + .22 * rand(n + 11) : .06 + .3 * raw;
    edges.push({ a, i, j, curve: [p0, [p0[0] + dx, p0[1]], [p3[0] - dx, p3[1]], p3], init, target });
    n++;
  }
  /* Class names start clear of the output plate and its depth step. */
  const classX = xs[3] + pw / 2 + D + (narrow ? 7 : 10);
  return { w, h, narrow, D, SD, sheetW, sheetH, train, held, trainLabelY: train[1] + sheetH / 2 + 18, heldLabelY: held[1] + sheetH / 2 + 18, xs, ys, cy, r, plates, labelY, edges, classX, barW: Math.max(40, Math.min(84, w - classX - 4)) };
}

function buildChart(w: number, from: number, to: number): ChartGeo {
  const h = 112, left = 2, right = w - 10, top = 10, bottom = h - 20;
  const max = Math.max(from, to) * 1.08;
  const pts: Pt[] = [];
  const N = 72;
  for (let i = 0; i <= N; i++) {
    const p = i / N;
    pts.push([left + p * (right - left), top + (1 - lossCurve(p, from, to) / max) * (bottom - top)]);
  }
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const total = cum[cum.length - 1] || 1;
  return { w, h, left, right, top, bottom, pts, cum: cum.map(c => c / total), d: pts.map((p, i) => `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}`).join("") };
}
const chartAt = (c: ChartGeo, p: number): { pt: Pt; frac: number } => {
  const x = clamp(p) * (c.pts.length - 1), i = Math.min(c.pts.length - 2, Math.floor(x)), k = x - i;
  return { pt: lerp(c.pts[i], c.pts[i + 1], k), frac: c.cum[i] + (c.cum[i + 1] - c.cum[i]) * k };
};

interface Els {
  edge: (SVGPathElement | null)[];
  grad: (SVGPathElement | null)[];
  dot: (SVGCircleElement | null)[];
  act: (SVGCircleElement | null)[][];
  ring: (SVGCircleElement | null)[][];
  sheet: (SVGGElement | null)[];
  heldSheet: (SVGGElement | null)[];
  outVal: (SVGTextElement | null)[];
  outBar: (SVGRectElement | null)[];
  outRow: (SVGGElement | null)[];
  loss: HTMLSpanElement | null;
  lossMeta: HTMLSpanElement | null;
  epoch: HTMLSpanElement | null;
  stats: HTMLDivElement | null;
  line: SVGPathElement | null;
  head: SVGCircleElement | null;
  val: SVGGElement | null;
  evalRow: HTMLDivElement | null;
  acc: HTMLSpanElement | null;
  spin: SVGCircleElement | null;
  check: SVGPathElement | null;
  step: (HTMLButtonElement | null)[];
  stepFill: (HTMLSpanElement | null)[];
  caption: HTMLSpanElement | null;
  captionStage: HTMLSpanElement | null;
}

export function ModelTraining({
  classes = DEFAULT_CLASSES,
  inputs = 3,
  hidden = [4, 4],
  samples = 12800,
  heldOutSamples = 1600,
  batchSize = 32,
  epochs = 12,
  lossFrom = .69,
  lossTo = .08,
  accuracy = 94.2,
  target = 90,
  labels,
  steps = DEFAULT_STEPS,
  defaultStep,
  caption = true,
  controls = true,
  speed = 1,
  paused = false,
  accent,
  label,
  className,
  style,
}: ModelTrainingProps) {
  const reduced = useReducedFlag();
  const rootRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [chartW, setChartW] = useState(0);
  const [hover, setHover] = useState<HoverKey>(null);
  const [playing, setPlaying] = useState(true);

  const nm = {
    training: labels?.training ?? "Training set",
    heldOut: labels?.heldOut ?? "Held-out set",
    unit: labels?.unit ?? "reviews",
    input: labels?.input ?? "Input",
    hidden: labels?.hidden ?? "Hidden",
    output: labels?.output ?? "Output",
    loss: labels?.loss ?? "Loss",
    epoch: labels?.epoch ?? "Epoch",
    evaluation: labels?.evaluation ?? "Evaluation",
    waiting: labels?.waiting ?? "Waiting",
    running: labels?.running ?? "Running",
    passed: labels?.passed ?? "Passed",
    noBatch: labels?.noBatch ?? "Waiting for a batch",
  };
  const cls = [classes[0] ?? DEFAULT_CLASSES[0], classes[1] ?? DEFAULT_CLASSES[1]];
  const sizesKey = [clamp(Math.round(inputs), 2, 5), clamp(Math.round(hidden[0] ?? 4), 2, 6), clamp(Math.round(hidden[1] ?? 4), 2, 6), 2].join(",");
  const sizes = useMemo(() => sizesKey.split(",").map(Number), [sizesKey]);
  const stepNames = useMemo(() => DEFAULT_STEPS.map((s, i) => steps[i] ?? s), [steps]);
  const epochCount = Math.max(1, Math.round(epochs));

  const g = useMemo(() => (width > 0 ? buildGeometry(width, sizes) : null), [width, sizes]);
  const chart = useMemo(() => (chartW > 0 ? buildChart(chartW, lossFrom, lossTo) : null), [chartW, lossFrom, lossTo]);

  const captions = useMemo(() => [
    `A batch of ${batchSize} labeled ${nm.unit} leaves the training set. Each feature feeds one input.`,
    `Signals flow forward through each layer and the network guesses a label.`,
    `The error flows backward and nudges every weight, strengthening the connections that helped.`,
    `Batch after batch for ${epochCount} epochs, the loss falls from ${lossFrom.toFixed(2)} to ${lossTo.toFixed(2)}.`,
    `The ${nm.heldOut.toLowerCase()} was never trained on. It scores ${accuracy.toFixed(1)}%, above the ${target}% target, so the model passes.`,
  ], [batchSize, nm.unit, nm.heldOut, epochCount, lossFrom, lossTo, accuracy, target]);

  const els = useRef<Els>({
    edge: [], grad: [], dot: [], act: [[], [], [], []], ring: [[], [], [], []], sheet: [], heldSheet: [], outVal: [], outBar: [], outRow: [],
    loss: null, lossMeta: null, epoch: null, stats: null, line: null, head: null, val: null, evalRow: null, acc: null, spin: null, check: null,
    step: [], stepFill: [], caption: null, captionStage: null,
  });

  const initial = clamp(Math.round(defaultStep ?? 0), 0, 4);
  const sim = useRef({
    time: initial === 0 ? 0 : STAGES[initial], rate: NaN, rateV: 0, frame: 0, running: false, visible: true, started: false, atStill: false, ticked: false,
    cache: new Map<Element, Record<string, string>>(),
  });
  const hold = paused || !playing || speed === 0;
  const goal = speed * (hover ? .6 : 1);
  const live = useRef({ g, chart, hold, goal, reduced, captions, stepNames, lossFrom, lossTo, accuracy, epochCount, nm });
  useLayoutEffect(() => { live.current = { g, chart, hold, goal, reduced, captions, stepNames, lossFrom, lossTo, accuracy, epochCount, nm }; });

  /** Writes an attribute, a CSS variable or text only when it changed, so an idle frame touches nothing. */
  const put = useCallback((node: Element | null | undefined, key: string, value: string) => {
    if (!node) return;
    const cache = sim.current.cache;
    let entry = cache.get(node);
    if (!entry) { entry = {}; cache.set(node, entry); }
    if (entry[key] === value) return;
    entry[key] = value;
    if (key === "text") {
      /* Rewrites the existing text node in place, so a counting readout never swaps DOM nodes. */
      const first = node.firstChild;
      if (first && first.nodeType === 3 && !first.nextSibling) (first as Text).data = value;
      else node.textContent = value;
    }
    else if (key.startsWith("--")) (node as HTMLElement).style.setProperty(key, value);
    else node.setAttribute(key, value);
  }, []);

  const paint = useCallback((time: number) => {
    const { g: geo, chart: ch, lossFrom: lf, lossTo: lt, accuracy: accTarget, epochCount: total, nm: names, captions: copy, stepNames: titles } = live.current;
    const e = els.current;
    const t = mod(time, CYCLE);
    const stage = stageAt(t);
    const resetting = t < RESET_END;
    /* The readouts crossfade from the finished run back to an untrained model while the weights relax. */
    const swap = .35;
    const showEnd = resetting && t < swap;

    const p = progressAt(t);
    const scored = !resetting && t >= FIRST_SCORE;
    let pr = .5;
    if (resetting) pr = .5 + .47 * (1 - smooth(.05, .75, t));
    else {
      pr = .5 + .02 * smooth(FIRST_SCORE, FIRST_SCORE + .3, t) + .42 * p;
      const land = EVAL_RUN[1];
      pr += (.97 - pr) * smooth(land, land + .3, t);
    }

    if (geo) {
      const learned = [0, 1, 2].map(k => learnedAt(k, t));
      geo.edges.forEach((ed, i) => {
        const s = ed.init + (ed.target - ed.init) * learned[ed.a];
        put(e.edge[i], "stroke-width", f(.6 + 1.7 * s));
        put(e.edge[i], "stroke-opacity", f(.3 + .7 * s));
        put(e.edge[i], "--k", f(clamp((s - .55) / .35)));
        const vis = .45 + .55 * s;
        const fw = active(FWD[ed.a], t);
        if (fw) {
          const q = (t - fw.s) / fw.d;
          const pt = bez(ed.curve, easeInOut(q));
          put(e.dot[i], "transform", `translate(${f(pt[0])} ${f(pt[1])})`);
          put(e.dot[i], "opacity", f(vis * ends(q)));
        } else put(e.dot[i], "opacity", "0");
        const bw = active(BWD[ed.a], t);
        if (bw) {
          const q = (t - bw.s) / bw.d;
          put(e.grad[i], "stroke-dashoffset", (-(1 - easeInOut(q) * (1 + DASH))).toFixed(4));
          put(e.grad[i], "opacity", f(vis * ends(q)));
        } else put(e.grad[i], "opacity", "0");
      });

      /* Nodes fill as a signal lands and ring as the error passes through. */
      const win = clamp((pr - .56) / .3);
      for (let l = 0; l < 4; l++) {
        const fq = pulseAt(FWD_ARRIVE[l], t, .7);
        const act = fq >= 0 ? Math.min(1, fq / .12) * (1 - fq) ** 1.5 : 0;
        const bq = pulseAt(BWD_ARRIVE[l], t, .6);
        for (let j = 0; j < geo.ys[l].length; j++) {
          const base = l === 3 && j === 0 ? .85 * win : 0;
          put(e.act[l][j], "opacity", f(Math.max(base, .9 * clamp(act))));
          if (bq >= 0) {
            put(e.ring[l][j], "r", f(geo.r + 7 * easeOut(bq)));
            put(e.ring[l][j], "opacity", f(.7 * (1 - bq) ** 2));
          } else put(e.ring[l][j], "opacity", "0");
        }
      }

      /* Data sheets. The stack advances one slot as each batch leaves, and the front sheet flies into the input layer. */
      const into: Pt = [geo.xs[0], geo.cy];
      const placeSheets = (list: (SVGGElement | null)[], peels: Hop[], front: Pt, depth: number, lift: number) => {
        let adv = 0;
        for (const h of peels) adv += smooth(h.s, h.s + h.d, t);
        if (resetting) adv = 0;
        const fr = adv - Math.floor(adv);
        const curve: Bezier = geo.narrow
          ? [front, [front[0], front[1] + 70], [into[0] + 30, into[1] - 80], into]
          : [front, [front[0] + 60, front[1] + lift], [into[0] - 40, into[1] + lift * .6], into];
        list.forEach((node, i) => {
          const pos = i - fr;
          if (pos < 0) {
            const q = -pos;
            const pt = bez(curve, q);
            put(node, "transform", `translate(${f(pt[0])} ${f(pt[1])}) scale(${(1 - .66 * q).toFixed(3)})`);
            put(node, "opacity", f(1 - smooth(.55, .98, q)));
            put(node, "data-front", "true");
          } else {
            const x = front[0] + pos * geo.SD, y = front[1] - pos * geo.SD;
            put(node, "transform", `translate(${f(x)} ${f(y)})`);
            put(node, "opacity", f(pos > depth ? clamp(depth + 1 - pos) : 1));
            put(node, "data-front", pos < .5 ? "true" : "false");
          }
        });
      };
      placeSheets(e.sheet, TRAIN_PEELS, geo.train, 3, geo.narrow ? 0 : -34);
      placeSheets(e.heldSheet, [HELD_PEEL], geo.held, 2, geo.narrow ? 0 : 30);

      /* Predictions beside the output layer. */
      const probs = [pr, 1 - pr];
      for (let j = 0; j < 2; j++) {
        put(e.outVal[j], "text", probs[j].toFixed(2));
        put(e.outBar[j], "width", f(Math.max(.5, geo.barW * probs[j])));
        put(e.outRow[j], "data-win", j === 0 && win > .5 ? "true" : "false");
      }
    }

    /* Readouts: loss, epoch and the loss curve. */
    const loss = lossCurve(p, lf, lt);
    const statO = resetting ? (t < swap ? 1 - smooth(0, swap, t) : .4 * smooth(swap, RESET_END, t)) : scored ? .4 + .6 * smooth(FIRST_SCORE, FIRST_SCORE + .3, t) : .4;
    put(e.stats, "--o", f(statO));
    put(e.loss, "text", showEnd ? lt.toFixed(2) : scored ? loss.toFixed(2) : lf.toFixed(2));
    put(e.lossMeta, "text", showEnd || scored ? `Started at ${lf.toFixed(2)}` : names.noBatch);
    put(e.epoch, "text", showEnd ? String(total) : scored ? String(Math.max(1, Math.ceil(total * p - 1e-6))) : "0");
    if (ch) {
      const at = chartAt(ch, p);
      const lineO = resetting ? 1 - smooth(0, .5, t) : scored ? smooth(FIRST_SCORE, FIRST_SCORE + .25, t) : 0;
      put(e.line, "stroke-dasharray", `${Math.max(.0005, at.frac).toFixed(4)} 2`);
      put(e.line, "opacity", f(lineO));
      put(e.head, "transform", `translate(${f(at.pt[0])} ${f(at.pt[1])})`);
      const valO = resetting ? 1 - smooth(0, .5, t) : smooth(EVAL_DONE, EVAL_DONE + .35, t);
      /* The validation point takes over from the moving head at the end, so the two never sit on top of each other. */
      put(e.head, "opacity", f(lineO * (1 - valO)));
      put(e.val, "opacity", f(valO));
    }

    /* Evaluation: waiting, then running with a counting score, then the check turns green. */
    const state = showEnd ? "passed" : resetting || t < EVAL_START ? "waiting" : t < EVAL_DONE ? "running" : "passed";
    put(e.evalRow, "data-state", state);
    put(e.evalRow, "--o", f(resetting ? (t < swap ? 1 - smooth(0, swap, t) : smooth(swap, RESET_END, t)) : 1));
    const acc = state === "passed" ? accTarget : state === "running" ? accTarget * easeOut((t - EVAL_RUN[0]) / (EVAL_RUN[1] - EVAL_RUN[0])) : 0;
    put(e.acc, "text", state === "waiting" ? "" : `${acc.toFixed(1)}%`);
    if (state === "running") put(e.spin, "transform", `rotate(${f((t * 360) % 360)} 12 12)`);
    put(e.check, "stroke-dashoffset", f(showEnd ? 0 : 1 - smooth(EVAL_DONE, EVAL_DONE + .4, t)));

    /* Step bar and caption. */
    for (let i = 0; i < 5; i++) {
      const state = i < stage ? "done" : i === stage ? "current" : "todo";
      const end = i < 4 ? STAGES[i + 1] : CYCLE;
      const start = i === 0 ? RESET_END : STAGES[i];
      /* While the run resets, every track rewinds together instead of snapping empty. */
      const fill = resetting && !sim.current.atStill ? 1 - easeInOut(t / RESET_END) : i < stage ? 1 : i > stage ? 0 : sim.current.atStill ? 1 : clamp((t - start) / (end - start));
      put(e.step[i], "data-state", state);
      put(e.step[i], "aria-current", state === "current" ? "step" : "false");
      put(e.stepFill[i], "--s", f(fill));
    }
    put(e.caption, "text", copy[stage]);
    put(e.captionStage, "text", `${titles[stage]}. `);
  }, [put]);

  const loop = useCallback(() => {
    const s = sim.current;
    if (s.running || !s.visible) return;
    if (live.current.hold || live.current.reduced) return;
    s.running = true;
    let last = performance.now();
    const tick = (now: number) => {
      const { hold: h, reduced: still, goal: target } = live.current;
      if (h || still || !s.visible) { s.running = false; return; }
      const dt = clamp((now - last) / 1000, 0, .05);
      last = now;
      if (Number.isNaN(s.rate)) s.rate = target;
      /* Hover slows the story on a critically damped spring, so it never jolts. */
      s.rateV += (40 * (target - s.rate) - 2 * Math.sqrt(40) * s.rateV) * dt;
      s.rate += s.rateV * dt;
      s.time += dt * s.rate;
      s.atStill = false;
      s.ticked = true;
      paint(s.time);
      s.frame = requestAnimationFrame(tick);
    };
    s.frame = requestAnimationFrame(tick);
  }, [paint]);

  useLayoutEffect(() => {
    const stage = stageRef.current, box = chartRef.current;
    if (!stage || !box) return;
    const measure = () => {
      setWidth(Math.floor(stage.clientWidth));
      setChartW(Math.floor(box.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    observer.observe(box);
    return () => observer.disconnect();
  }, []);

  /** Paint now and (re)start the loop whenever anything that shapes the frame changes. New elements clear the write cache. */
  useLayoutEffect(() => {
    const s = sim.current;
    s.cache = new Map();
    const pick = defaultStep === undefined ? DEFAULT_STILL_STEP : initial;
    if (!s.started && (hold || reduced)) { s.time = STILL[pick]; s.atStill = true; }
    s.started = true;
    if (reduced && !s.atStill) {
      s.time = s.ticked ? STILL[stageAt(mod(s.time, CYCLE))] : STILL[pick];
      s.atStill = true;
    }
    paint(s.time);
    loop();
  }, [reduced, hold, goal, g, chart, captions, stepNames, paint, loop, defaultStep, initial]);

  useEffect(() => {
    const node = rootRef.current, s = sim.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      s.visible = entry.isIntersecting && !document.hidden;
      if (s.visible) loop(); else { cancelAnimationFrame(s.frame); s.running = false; }
    });
    const onVisibility = () => {
      s.visible = !document.hidden;
      if (s.visible) loop(); else { cancelAnimationFrame(s.frame); s.running = false; }
    };
    observer.observe(node);
    document.addEventListener("visibilitychange", onVisibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", onVisibility); cancelAnimationFrame(s.frame); s.running = false; };
  }, [loop]);

  /** Jumps to a stage: its start while playing, or its representative frame while held. */
  const seek = (i: number) => {
    const s = sim.current;
    const base = Math.floor(s.time / CYCLE) * CYCLE;
    const { hold: h, reduced: r } = live.current;
    s.atStill = h || r;
    s.time = base + (s.atStill ? STILL[i] : i === 0 ? RESET_END : STAGES[i]);
    paint(s.time);
  };
  const togglePlay = () => {
    const s = sim.current;
    /* Resuming from a held frame restarts that stage, so it plays from its beginning. */
    if (!playing && s.atStill) {
      const t = mod(s.time, CYCLE), i = stageAt(t);
      s.time = s.time - t + (i === 0 ? RESET_END : STAGES[i]);
      s.atStill = false;
    }
    setPlaying(v => !v);
  };

  const aria = label ?? `Model training. Batches of ${batchSize} labeled ${nm.unit} feed a small neural network with ${sizes[0]} inputs, two hidden layers and a ${cls[0].toLowerCase()} or ${cls[1].toLowerCase()} output. Signals flow forward to a prediction, the error flows backward and strengthens the useful connections, and over ${epochCount} epochs the loss falls from ${lossFrom.toFixed(2)} to ${lossTo.toFixed(2)}. A held-out set then scores ${accuracy.toFixed(1)}% against a ${target}% target and the evaluation passes.`;

  const e = els.current;
  const rootStyle = { ...(accent ? { "--mt-accent": accent } : null), ...style } as CSSProperties;
  const hoverOn = (key: HoverKey) => ({
    onPointerEnter: (event: ReactPointerEvent) => { if (event.pointerType === "mouse") setHover(key); },
    onPointerLeave: () => setHover(current => (current === key ? null : current)),
  });
  const layerName = (l: number) => (l === 0 ? nm.input : l === 3 ? nm.output : nm.hidden);

  /* One line about the hovered part, placed above it inside the drawing. */
  let tag: { text: string; x: number; y: number; align: "start" | "center" | "end" } | null = null;
  if (g && hover) {
    if (hover === "train") tag = { text: `${fmt(samples)} labeled ${nm.unit}, batches of ${batchSize}`, x: g.train[0] - g.sheetW / 2, y: g.trainLabelY + (g.narrow ? 42 : 40), align: "start" };
    else if (hover === "held") tag = { text: `${fmt(heldOutSamples)} ${nm.unit} it never trains on`, x: g.narrow ? g.held[0] + g.sheetW / 2 + g.SD * 3 : g.held[0] - g.sheetW / 2, y: g.narrow ? g.heldLabelY + 42 : g.held[1] - g.sheetH / 2 - g.SD * 2 - 8, align: g.narrow ? "end" : "start" };
    else {
      const l = Number(hover.slice(1));
      const text = l === 0 ? `${sizes[0]} features per sample` : l === 3 ? `Softmax over ${cls[0].toLowerCase()} and ${cls[1].toLowerCase()}` : `${sizes[l]} units, ReLU, ${sizes[l - 1] * sizes[l]} weights in`;
      tag = { text, x: g.xs[l], y: g.plates[l].y - g.D - 8, align: l === 3 ? "end" : l === 0 && g.narrow ? "start" : "center" };
      if (tag.align === "end") tag.x = g.xs[l] + g.plates[l].w / 2;
      if (tag.align === "start") tag.x = g.xs[l] - g.plates[l].w / 2;
    }
  }

  const sheet = (i: number, held: boolean) => {
    if (!g) return null;
    const w = g.sheetW, h = g.sheetH, x = -w / 2, y = -h / 2, n = sizes[0];
    const bars = Array.from({ length: n }, (_, k) => ({ y: y + h * ((k + 1) / (n + 1)), w: (w - 22) * [.78, .92, .56, .7, .84][k] }));
    return <g
      key={`${held ? "h" : "t"}-${i}`}
      ref={el => { (held ? e.heldSheet : e.sheet)[i] = el; }}
      className={styles.sheet}
      data-held={held || undefined}
      opacity={0}
    >
      <rect className={styles.sheetRect} x={x} y={y} width={w} height={h} rx={g.narrow ? 6 : 9} />
      {bars.map((b, k) => <rect key={k} className={k === 0 ? styles.sheetBarStrong : styles.sheetBar} x={x + 11} y={b.y - 1.75} width={b.w} height={3.5} rx={1.75} />)}
    </g>;
  };

  return <figure
    ref={rootRef}
    className={[styles.root, className].filter(Boolean).join(" ")}
    style={rootStyle}
    data-ready={g && chart ? true : undefined}
  >
    <div className={styles.body}>
      <div className={styles.diagram} role="img" aria-label={aria}>
        <div ref={stageRef} className={styles.stage} data-hover={hover ?? undefined} style={g ? { height: g.h } : undefined}>
          {g && <svg className={styles.svg} viewBox={`0 0 ${g.w} ${g.h}`} width={g.w} height={g.h} aria-hidden="true">
            {g.plates.map((pl, l) => <g key={`plate-${l}`} className={styles.plate} data-on={hover === `l${l}` || undefined}>
              <rect className={styles.back} x={pl.x + g.D} y={pl.y - g.D} width={pl.w} height={pl.h} rx={pl.w / 2} />
              <rect className={styles.face} x={pl.x} y={pl.y} width={pl.w} height={pl.h} rx={pl.w / 2} />
            </g>)}

            {g.edges.map((ed, i) => <path key={`edge-${i}`} ref={el => { e.edge[i] = el; }} className={styles.edge} data-a={ed.a} data-b={ed.a + 1} d={pathOf(ed.curve)} strokeWidth={.6 + 1.7 * ed.init} strokeOpacity={.3 + .7 * ed.init} />)}
            {g.edges.map((ed, i) => <path key={`grad-${i}`} ref={el => { e.grad[i] = el; }} className={styles.grad} d={pathOf(ed.curve)} pathLength={1} strokeDasharray={`${DASH} 2`} strokeDashoffset={-1} opacity={0} />)}
            {g.edges.map((_, i) => <circle key={`dot-${i}`} ref={el => { e.dot[i] = el; }} className={styles.dot} r={g.narrow ? 2.5 : 3} opacity={0} />)}

            {g.ys.map((col, l) => col.map((y, j) => <g key={`node-${l}-${j}`}>
              <circle ref={el => { e.ring[l][j] = el; }} className={styles.ring} cx={g.xs[l]} cy={y} r={g.r} opacity={0} />
              <circle className={styles.node} cx={g.xs[l]} cy={y} r={g.r} />
              <circle ref={el => { e.act[l][j] = el; }} className={styles.act} cx={g.xs[l]} cy={y} r={g.r - 2} opacity={0} />
            </g>))}

            {g.xs.map((x, l) => <text key={`lab-${l}`} className={styles.layerLabel} x={x} y={g.labelY} textAnchor="middle">{layerName(l)}</text>)}

            {cls.map((name, j) => {
              const y = g.ys[3][j];
              return <g key={`out-${j}`} ref={el => { e.outRow[j] = el; }} className={styles.outRow} data-win="false">
                <text className={styles.outName} x={g.classX} y={g.narrow ? y - 4 : y - 5}>{name}</text>
                <text ref={el => { e.outVal[j] = el; }} className={styles.outVal} x={g.narrow ? g.classX : g.classX + g.barW} y={g.narrow ? y + 11 : y - 5} textAnchor={g.narrow ? "start" : "end"}>0.50</text>
                {!g.narrow && <>
                  <rect className={styles.outTrack} x={g.classX} y={y + 3} width={g.barW} height={3} rx={1.5} />
                  <rect ref={el => { e.outBar[j] = el; }} className={styles.outBar} x={g.classX} y={y + 3} width={g.barW / 2} height={3} rx={1.5} />
                </>}
              </g>;
            })}

            <text className={styles.stackName} x={g.train[0] - g.sheetW / 2} y={g.trainLabelY}>{nm.training}</text>
            <text className={styles.stackMeta} x={g.train[0] - g.sheetW / 2} y={g.trainLabelY + 15}>{`${fmt(samples)} ${nm.unit}`}</text>
            <text className={styles.stackName} x={g.held[0] - g.sheetW / 2} y={g.heldLabelY}>{nm.heldOut}</text>
            <text className={styles.stackMeta} x={g.held[0] - g.sheetW / 2} y={g.heldLabelY + 15}>{`${fmt(heldOutSamples)} ${nm.unit}`}</text>

            {[3, 2, 1, 0].map(i => sheet(i, true))}
            {[4, 3, 2, 1, 0].map(i => sheet(i, false))}

            {/* Hover targets sit on top and never block the drawing. */}
            <rect className={styles.hit} x={g.train[0] - g.sheetW / 2 - 2} y={g.train[1] - g.sheetH / 2 - g.SD * 3} width={g.sheetW + g.SD * 3 + 4} height={g.sheetH + g.SD * 3 + 40} {...hoverOn("train")} />
            <rect className={styles.hit} x={g.held[0] - g.sheetW / 2 - 2} y={g.held[1] - g.sheetH / 2 - g.SD * 2} width={g.sheetW + g.SD * 3 + 4} height={g.sheetH + g.SD * 2 + 40} {...hoverOn("held")} />
            {g.plates.map((pl, l) => <rect key={`hit-${l}`} className={styles.hit} x={pl.x - 12} y={pl.y - g.D - 4} width={pl.w + g.D + 24} height={pl.h + g.D + 8} {...hoverOn(`l${l}` as HoverKey)} />)}
          </svg>}
          {tag && <div key={hover ?? undefined} className={styles.tagWrap} data-align={tag.align} style={{ transform: `translate(${f(tag.x)}px, ${f(tag.y)}px)` }}>
            <span className={styles.tag}>{tag.text}</span>
          </div>}
        </div>
      </div>

      <div className={styles.panel} aria-hidden="true">
        <div ref={el => { e.stats = el; }} className={styles.stats}>
          <span className={styles.stat}>
            <span className={styles.statLabel}>{nm.loss}</span>
            <span ref={el => { e.loss = el; }} className={styles.statValue}>{lossFrom.toFixed(2)}</span>
            <span ref={el => { e.lossMeta = el; }} className={styles.statMeta}>{nm.noBatch}</span>
          </span>
          <span className={styles.stat}>
            <span className={styles.statLabel}>{nm.epoch}</span>
            <span className={styles.statValue}><span ref={el => { e.epoch = el; }}>0</span></span>
            <span className={styles.statMeta}>of {epochCount}</span>
          </span>
        </div>
        <div ref={chartRef} className={styles.chart}>
          {chart && <svg viewBox={`0 0 ${chart.w} ${chart.h}`} width={chart.w} height={chart.h}>
            {[0, .5, 1].map(k => <line key={k} className={k === 1 ? styles.axis : styles.grid} x1={chart.left} x2={chart.right} y1={chart.top + k * (chart.bottom - chart.top)} y2={chart.top + k * (chart.bottom - chart.top)} />)}
            <text className={styles.tick} x={chart.left} y={chart.h - 4}>1</text>
            <text className={styles.tick} x={chart.right} y={chart.h - 4} textAnchor="end">{epochCount}</text>
            <path ref={el => { e.line = el; }} className={styles.line} d={chart.d} pathLength={1} strokeDasharray="0.0005 2" opacity={0} />
            <circle ref={el => { e.head = el; }} className={styles.head} r={3.5} opacity={0} />
            <g ref={el => { e.val = el; }} opacity={0}>
              {(() => {
                const y = chart.top + (1 - (lossTo * 1.4) / (Math.max(lossFrom, lossTo) * 1.08)) * (chart.bottom - chart.top);
                return <>
                  <circle className={styles.valDot} cx={chart.right} cy={y} r={3.5} />
                  <text className={styles.valText} x={chart.right - 8} y={y - 7} textAnchor="end">Val {(lossTo * 1.4).toFixed(2)}</text>
                </>;
              })()}
            </g>
          </svg>}
        </div>
        <div ref={el => { e.evalRow = el; }} className={styles.evalRow} data-state="waiting">
          <svg className={styles.evalMark} viewBox="0 0 24 24">
            <circle className={styles.evalTrack} cx={12} cy={12} r={10.5} />
            <circle ref={el => { e.spin = el; }} className={styles.evalSpin} cx={12} cy={12} r={10.5} pathLength={1} strokeDasharray="0.26 1" />
            <path ref={el => { e.check = el; }} className={styles.evalCheck} d="M7.5 12.4l3 3 6-6.4" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} />
          </svg>
          <span className={styles.evalText}>
            <span className={styles.evalName}>{nm.evaluation}</span>
            <span className={styles.evalMeta}>Target {target}%</span>
          </span>
          <span className={styles.evalRight}>
            <span ref={el => { e.acc = el; }} className={styles.evalValue} />
            <span className={styles.evalTags}>
              <span className={styles.evalTag} data-kind="waiting">{nm.waiting}</span>
              <span className={styles.evalTag} data-kind="running">{nm.running}</span>
              <span className={styles.evalTag} data-kind="passed">{nm.passed}</span>
            </span>
          </span>
        </div>
      </div>
    </div>

    {controls && <div className={styles.controls}>
      {!reduced && <button type="button" className={styles.play} onClick={togglePlay} aria-label={playing && !paused ? "Pause the training run" : "Play the training run"}>
        {playing && !paused ? <Pause aria-hidden="true" strokeWidth={1.75} /> : <Play aria-hidden="true" strokeWidth={1.75} />}
      </button>}
      <ol className={styles.steps} aria-label="Training stages">
        {stepNames.map((name, i) => <li key={name + i} className={styles.stepItem}>
          <button type="button" ref={el => { e.step[i] = el; }} className={styles.step} data-state={i === initial ? "current" : i < initial ? "done" : "todo"} onClick={() => seek(i)} aria-label={`Stage ${i + 1}, ${name}`}>
            <span className={styles.stepLabel}><span className={styles.stepNumber}>{i + 1}</span><span className={styles.stepName}>{name}</span></span>
            <span className={styles.track}><span ref={el => { e.stepFill[i] = el; }} className={styles.trackFill} /></span>
          </button>
        </li>)}
      </ol>
    </div>}

    {caption && <figcaption className={styles.caption} aria-hidden="true">
      <span><span ref={el => { e.captionStage = el; }} className={styles.captionStage} /><span ref={el => { e.caption = el; }}>{captions[initial]}</span></span>
    </figcaption>}
  </figure>;
}

export default ModelTraining;
