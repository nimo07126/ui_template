"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { animate, useReducedMotion } from "motion/react";
import { Copy, RotateCw, X } from "lucide-react";
import styles from "./prize-wheel.module.css";
import { writeClipboard } from "../../lib/use-copy-feedback";

export interface PrizeSegment {
  /** Stable key. Defaults to the label. */
  id?: string;
  /** Short prize name drawn on the wheel, such as "20% off". Keep it to about 14 characters. */
  label: string;
  /** One line under the prize in the reward card. */
  detail?: string;
  /** Promo code shown in the reward card with a copy button. */
  code?: string;
  /** Relative chance of landing here. Defaults to 1. Weights are normalized, so 30 and 0.3 mean the same thing next to their peers. */
  weight?: number;
  /** Marks the rare top prize with the accent on the wheel and in the odds list. */
  featured?: boolean;
}

export interface PrizeWheelLabels {
  spin?: string;
  again?: string;
  done?: string;
  copy?: string;
  copied?: string;
  copyFailed?: string;
  odds?: string;
  hint?: string;
  weak?: string;
}

/**
 * A promo or referral prize wheel. Flick it (or hold Spin to wind it up) and it keeps the momentum you gave it, a flexible
 * pointer ticks against every peg, and a long, slow settle lands on a segment picked by weight. The won segment lifts into a
 * reward card with a copyable code.
 */
export interface PrizeWheelProps {
  /** The prizes around the wheel, clockwise from the top. Two to twelve segments. */
  segments?: readonly PrizeSegment[];
  /** Heading beside the wheel before the first spin. */
  title?: string;
  /** One line under the heading. */
  description?: string;
  /** Visible words, for localization. */
  labels?: PrizeWheelLabels;
  /**
   * Decides the winning index when a spin starts, such as a result your server already drew. Without it the wheel draws by
   * weight in the browser, which is fine for a demo but not for a real prize.
   */
  pickWinner?: (segments: readonly PrizeSegment[]) => number;
  /** Called once the wheel comes to rest on a prize. */
  onResult?: (segment: PrizeSegment, index: number) => void;
  /** Allows a single spin. The wheel locks on the prize and Spin again is hidden. */
  once?: boolean;
  /** Draws each segment with an angle proportional to its weight instead of equal slices. */
  sizing?: "equal" | "weight";
  /** Shows the list of prizes with their odds beside the wheel. */
  showOdds?: boolean;
  /** Multiplies the slow idle drift before the first spin. 0 holds the wheel still. */
  speed?: number;
  /** Holds the idle drift. A spin the visitor starts still runs. */
  paused?: boolean;
  /** Color of the pointer, the featured prize, the charge ring, and the won segment. Defaults to the accent token. */
  accent?: string;
  /** Accessible name of the wheel. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

const defaultSegments: PrizeSegment[] = [
  { label: "10% off", detail: "Off your first year of Pro", code: "SPIN-10OFF", weight: 30 },
  { label: "Free month", detail: "One month of Pro on us", code: "SPIN-FREEMONTH", weight: 12 },
  { label: "20% off", detail: "Off your first year of Pro", code: "SPIN-20OFF", weight: 18 },
  { label: "Lifetime Pro", detail: "Pro for life, every future update included", code: "SPIN-LIFETIME", weight: 1, featured: true },
  { label: "15% off", detail: "Off your first year of Pro", code: "SPIN-15OFF", weight: 20 },
  { label: "Extra seat", detail: "One more teammate, free for a year", code: "SPIN-SEAT", weight: 14 },
  { label: "2x credits", detail: "Double referral credit for 90 days", code: "SPIN-2XCREDIT", weight: 3 },
  { label: "Priority help", detail: "Replies within four hours for a year", code: "SPIN-PRIORITY", weight: 2 },
];

const defaultLabels: Required<PrizeWheelLabels> = {
  spin: "Spin",
  again: "Spin again",
  done: "Claimed",
  copy: "Copy code",
  copied: "Copied",
  copyFailed: "Copy failed",
  odds: "Odds",
  hint: "Flick the wheel, or hold Spin to wind it up.",
  weak: "A little faster. Flick and let go to spin.",
};

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

const TAU = Math.PI * 2;
/** Wheel geometry in a 400 unit viewBox. The top band holds the pointer, so the wheel spans 22 to 378. */
const C = 200;
const R_FACE = 162;
const R_RIM = 170;
const RIM_W = 16;
const R_PEG = 170;
const PEG_R = 3.6;
const R_LABEL_OUT = 148;
/**
 * The pointer: a round head on a pivot above the rim, tapering to a round tip that rests between two pegs. It collides
 * with the pegs as a tapered capsule, so it only moves when a peg actually touches it and slips free once the peg clears
 * the tip, around 30 degrees of bend.
 */
const PIVOT_Y = 7;
const HEAD_R = 6.5;
const TIP_R = 1.5;
const FLAP_L = 21;
/** Pointer spring: stiff with light damping, so each release is a short, crisp wobble. */
const FLAP_K = 1000;
const FLAP_C = 15;
/** The flap's base stops it past this bend, and a peg hands it at most this much angular speed, so a fast spin rattles it instead of flinging it. */
const FLAP_MAX = 0.6;
const FLAP_KICK = 9;
/** Spin profile: position follows 1 - (1 - u)^EASE_K, so velocity decays smoothly and the last turn crawls. */
const EASE_K = 3;
/** A spin thrown from the hub or the Spin again button builds its speed over this time constant instead of in one frame. */
const LAUNCH = 0.07;
const MIN_SPIN = 4.5;
const MAX_SPIN = 28;
const DRIFT = 0.075;
const CHARGE_TIME = 1.1;
const WIND_BACK = 0.24;

const wrap = (a: number) => {
  let v = (a + Math.PI) % TAU;
  if (v < 0) v += TAU;
  return v - Math.PI;
};
const mod = (a: number, m: number) => ((a % m) + m) % m;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const point = (a: number, r: number) => [C + r * Math.sin(a), C - r * Math.cos(a)] as const;
const f = (n: number) => Math.round(n * 100) / 100;
const TAPER = Math.asin((HEAD_R - TIP_R) / FLAP_L);
/** Pointer outline in viewBox units: the head arc, straight tangents, and the tip arc. */
const POINTER_D = (() => {
  const hx = HEAD_R * Math.cos(TAPER);
  const hy = PIVOT_Y + HEAD_R * Math.sin(TAPER);
  const tx = TIP_R * Math.cos(TAPER);
  const ty = PIVOT_Y + FLAP_L + TIP_R * Math.sin(TAPER);
  return `M${f(C - hx)} ${f(hy)}A${HEAD_R} ${HEAD_R} 0 1 1 ${f(C + hx)} ${f(hy)}L${f(C + tx)} ${f(ty)}A${TIP_R} ${TIP_R} 0 0 1 ${f(C - tx)} ${f(ty)}Z`;
})();

/**
 * The smallest angle between the pointer and a peg seen from the pivot, for a peg at distance r: along the body the
 * capsule is as wide as its taper there; past the tip only the tip circle is in the way. 0 means the peg cannot touch it.
 */
function clearance(r: number) {
  const reach = PEG_R + TIP_R;
  if (r <= FLAP_L) {
    const width = PEG_R + HEAD_R - (HEAD_R - TIP_R) * (r / FLAP_L);
    return r > width ? Math.asin(width / r) : Math.PI / 2;
  }
  if (r >= FLAP_L + reach) return 0;
  return Math.acos(clamp((r * r + FLAP_L * FLAP_L - reach * reach) / (2 * r * FLAP_L), -1, 1));
}
const percent = (p: number) => `${Math.round(p * 1000) / 10}%`;

function wedgePath(a0: number, a1: number, r: number) {
  const [x0, y0] = point(a0, r);
  const [x1, y1] = point(a1, r);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${C} ${C}L${f(x0)} ${f(y0)}A${r} ${r} 0 ${large} 1 ${f(x1)} ${f(y1)}Z`;
}

interface Live {
  reduced: boolean;
  paused: boolean;
  speed: number;
  phase: string;
}
const isDrifting = (l: Live, sim: Sim) => !l.reduced && !l.paused && l.speed > 0 && l.phase === "idle" && sim.mode === "idle";
const needsFrame = (l: Live, sim: Sim) => sim.mode !== "idle" || isDrifting(l, sim) || Math.abs(sim.phi) > 0.002 || Math.abs(sim.phiV) > 0.01;

type Phase = "idle" | "spinning" | "won";
type Mode = "idle" | "drag" | "charge" | "spin" | "coast";
type CopyState = "idle" | "copied" | "failed";

interface Sim {
  theta: number;
  omega: number;
  mode: Mode;
  lastDir: number;
  phi: number;
  phiV: number;
  spinT: number;
  spinDur: number;
  spinFrom: number;
  spinDist: number;
  spinDir: number;
  spinRamp: number;
  winner: number;
  charge: number;
  chargeBase: number;
  grabTheta: number;
  grabAngle: number;
  grabAcc: number;
  samples: { t: number; theta: number }[];
}

/** Copy faces crossfade centered in one cell that eases to the shown face's measured width, so "Copied" never sits in the space
 *  held for "Copy failed" and nothing jumps. */
function FitFaces({ shown, children }: { shown: number; children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [widths, setWidths] = useState<number[]>([]);
  useLayoutEffect(() => {
    const faces = Array.from(ref.current?.children ?? []) as HTMLElement[];
    const read = () => setWidths(faces.map(face => face.offsetWidth));
    read();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(read);
    faces.forEach(face => observer.observe(face));
    return () => observer.disconnect();
  }, []);
  return <span ref={ref} className={styles.copyStack} style={widths[shown] ? { width: widths[shown] } : undefined}>{children}</span>;
}

export function PrizeWheel({
  segments: segmentsProp,
  title = "Spin for a reward",
  description = "Every spin wins something. Your code works at checkout.",
  labels: labelsProp,
  pickWinner,
  onResult,
  once = false,
  sizing = "equal",
  showOdds = true,
  speed = 1,
  paused = false,
  accent,
  label = "Prize wheel",
  className,
  style,
}: PrizeWheelProps) {
  const segments = useMemo(() => {
    const list = (segmentsProp ?? defaultSegments).slice(0, 12);
    return list.length >= 2 ? list : defaultSegments;
  }, [segmentsProp]);
  const labels = { ...defaultLabels, ...labelsProp };
  const reduced = useReducedFlag();
  const uid = useId().replace(/:/g, "");

  /** Normalized odds and the local angle span of each segment, clockwise from the top. */
  const geometry = useMemo(() => {
    const weights = segments.map(s => Math.max(0, s.weight ?? 1));
    const total = weights.reduce((a, b) => a + b, 0) || 1;
    const odds = weights.map(w => w / total);
    const sizes = segments.map((_, i) => (sizing === "weight" ? Math.max(odds[i], 0.012) : 1 / segments.length));
    const starts = sizes.map((_, i) => sizes.slice(0, i).reduce((a, b) => a + b, 0));
    const spans = sizes.map((size, i) => ({ start: starts[i], end: starts[i] + size }));
    const scale = TAU / sizes.reduce((a, b) => a + b, 0);
    const arcs = spans.map(s => ({ start: s.start * scale, end: s.end * scale }));
    return { odds, arcs, pegs: arcs.map(a => a.start) };
  }, [segments, sizing]);

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<number | null>(null);
  /** The last prize won. The card keeps showing it while it fades out, so its text never swaps mid-exit. */
  const [lastWon, setLastWon] = useState<number | null>(null);
  const [flight, setFlight] = useState(0);
  const [announce, setAnnounce] = useState("");
  const [hint, setHint] = useState<"hint" | "weak">("hint");
  const [copy, setCopy] = useState<CopyState>("idle");

  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const rotorRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<SVGGElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const flightRef = useRef<ReturnType<typeof animate> | null>(null);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const visibleRef = useRef(true);
  const pressAtRef = useRef(-1e9);
  const writtenRef = useRef({ rot: NaN, flap: NaN, ring: NaN });
  const simRef = useRef<Sim>({
    theta: 0, omega: 0, mode: "idle", lastDir: 1, phi: 0, phiV: 0,
    spinT: 0, spinDur: 1, spinFrom: 0, spinDist: 0, spinDir: 1, spinRamp: 0, winner: 0,
    charge: 0, chargeBase: 0, grabTheta: 0, grabAngle: 0, grabAcc: 0, samples: [],
  });

  /** Latest props and state for the loop, synced after each commit so the loop never reads stale values. */
  const live = useRef({ segments, geometry, pickWinner, onResult, once, speed, paused, reduced, phase, labels });
  useLayoutEffect(() => {
    live.current = { segments, geometry, pickWinner, onResult, once, speed, paused, reduced, phase, labels };
  });

  const write = useCallback(() => {
    const sim = simRef.current;
    const w = writtenRef.current;
    const rot = Math.round((sim.theta * 180 / Math.PI) * 1000) / 1000;
    if (rot !== w.rot && rotorRef.current) {
      rotorRef.current.style.transform = `rotate(${rot}deg)`;
      w.rot = rot;
    }
    const flap = Math.round((sim.phi * 180 / Math.PI) * 100) / 100;
    if (flap !== w.flap && flapRef.current) {
      flapRef.current.style.transform = `rotate(${flap}deg)`;
      w.flap = flap;
    }
    const ring = sim.mode === "charge" ? Math.round((1 - sim.charge) * 1000) / 1000 : 1;
    if (ring !== w.ring && ringRef.current) {
      ringRef.current.style.strokeDashoffset = String(ring);
      w.ring = ring;
    }
  }, []);

  const settle = useCallback((winner: number) => {
    const { segments: segs, onResult: cb } = live.current;
    const seg = segs[winner];
    setPhase("won");
    setResult(winner);
    setLastWon(winner);
    setFlight(n => n + 1);
    setCopy("idle");
    setAnnounce(`You won ${seg.label}.${seg.code ? ` Your code is ${seg.code.split("").join(" ")}.` : ""}`);
    cb?.(seg, winner);
  }, []);

  const step = useCallback((dt: number) => {
    const sim = simRef.current;
    const l = live.current;
    const before = sim.theta;
    switch (sim.mode) {
      case "idle":
        if (isDrifting(l, sim)) sim.theta += DRIFT * l.speed * dt;
        break;
      case "charge": {
        sim.charge = Math.min(1, sim.charge + dt / CHARGE_TIME);
        const eased = sim.charge * sim.charge * (3 - 2 * sim.charge);
        sim.theta = sim.chargeBase - WIND_BACK * eased;
        break;
      }
      case "spin": {
        sim.spinT += dt;
        // Launch time warp: the clock runs slow at first and reaches full rate within a few frames, so a throw builds speed.
        const r = sim.spinRamp;
        const clock = r > 0 ? sim.spinT - r * (1 - Math.exp(-sim.spinT / r)) : sim.spinT;
        const u = Math.min(1, clock / sim.spinDur);
        sim.theta = sim.spinFrom + sim.spinDir * sim.spinDist * (1 - Math.pow(1 - u, EASE_K));
        if (u >= 1) {
          sim.mode = "idle";
          settle(sim.winner);
        }
        break;
      }
      case "coast":
        sim.omega *= Math.exp(-1.9 * dt);
        sim.theta += sim.omega * dt;
        if (Math.abs(sim.omega) < 0.05) sim.mode = "idle";
        break;
      default:
        break;
    }
    if (sim.mode !== "drag") sim.omega = dt > 0 ? (sim.theta - before) / dt : 0;
    if (Math.abs(sim.omega) > 1e-4) sim.lastDir = Math.sign(sim.omega);

    if (l.reduced) {
      sim.phi = 0;
      sim.phiV = 0;
      return;
    }
    // The pointer is a damped spring. Pegs push it aside as solid circles against its tapered body; once a peg clears the
    // tip, the spring snaps it back. Substeps follow the wheel in small steps, so no peg ever jumps through the pointer.
    const pegs = l.geometry.pegs;
    const travel = sim.theta - before;
    const sub = clamp(Math.ceil((Math.abs(travel) * R_PEG) / 1.5), 4, 40);
    const h = dt / sub;
    for (let k = 1; k <= sub; k++) {
      const theta = before + (travel * k) / sub;
      const prev = sim.phi;
      sim.phiV += (-FLAP_K * sim.phi - FLAP_C * sim.phiV) * h;
      sim.phi += sim.phiV * h;
      let pushed = false;
      for (let i = 0; i < pegs.length; i++) {
        const a = pegs[i] + theta;
        const qy = C - R_PEG * Math.cos(a) - PIVOT_Y;
        if (qy > FLAP_L + TIP_R + PEG_R) continue;
        const qx = R_PEG * Math.sin(a);
        const gap = clearance(Math.hypot(qx, qy));
        if (!gap) continue;
        const psi = Math.atan2(-qx, qy);
        const off = sim.phi - psi;
        if (Math.abs(off) >= gap) continue;
        const side = off > 0 ? 1 : off < 0 ? -1 : -sim.lastDir;
        sim.phi = psi + side * gap;
        pushed = true;
      }
      if (pushed && h > 0) sim.phiV = clamp((sim.phi - prev) / h, -FLAP_KICK, FLAP_KICK);
      if (Math.abs(sim.phi) > FLAP_MAX) {
        sim.phi = Math.sign(sim.phi) * FLAP_MAX;
        if (sim.phiV * sim.phi > 0) sim.phiV *= -0.25;
      }
    }
  }, [settle]);

  const loopRef = useRef<((now: number) => void) | null>(null);
  useLayoutEffect(() => {
    loopRef.current = (now: number) => {
      const dt = lastRef.current ? Math.min(0.034, (now - lastRef.current) / 1000) : 1 / 60;
      lastRef.current = now;
      step(dt);
      write();
      if (needsFrame(live.current, simRef.current) && visibleRef.current) rafRef.current = requestAnimationFrame(n => loopRef.current?.(n));
      else {
        rafRef.current = 0;
        lastRef.current = 0;
      }
    };
  });

  const kick = useCallback(() => {
    if (rafRef.current || !visibleRef.current) return;
    lastRef.current = 0;
    rafRef.current = requestAnimationFrame(n => loopRef.current?.(n));
  }, []);

  // Run only while on screen and in a visible tab.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let inView = true;
    const update = () => {
      visibleRef.current = inView && document.visibilityState === "visible";
      if (visibleRef.current) kick();
      else if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
        lastRef.current = 0;
      }
    };
    const io = new IntersectionObserver(entries => {
      inView = entries.some(e => e.isIntersecting);
      update();
    });
    io.observe(root);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", update);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [kick]);

  // Drift restarts when it becomes allowed again.
  useEffect(() => { kick(); }, [kick, paused, speed, reduced, phase]);

  /** Starts a spin with the given angular velocity: draws the winner, then picks a travel that matches the momentum. */
  const spin = useCallback((omega: number, ramp = LAUNCH) => {
    const l = live.current;
    const sim = simRef.current;
    if (l.once && l.phase === "won") return;
    const n = l.segments.length;
    let winner = 0;
    if (l.pickWinner) {
      const picked = Math.round(l.pickWinner(l.segments));
      winner = Number.isFinite(picked) ? clamp(picked, 0, n - 1) : 0;
    } else {
      let r = Math.random();
      winner = n - 1;
      for (let i = 0; i < n; i++) {
        r -= l.geometry.odds[i];
        if (r <= 0) { winner = i; break; }
      }
    }
    const arc = l.geometry.arcs[winner];
    const span = arc.end - arc.start;
    const margin = Math.min(span * 0.42, Math.max(span * 0.12, 0.07));
    const local = arc.start + margin + Math.random() * Math.max(0, span - margin * 2);
    const w0 = clamp(Math.abs(omega), MIN_SPIN, MAX_SPIN);
    const dir = omega < 0 ? -1 : 1;
    const target = -local;
    const base = mod(dir * (target - sim.theta), TAU);
    const tPref = clamp(3.8 + w0 * 0.12, 4.2, 7.2);
    const natural = (w0 * tPref) / EASE_K;
    const turns = Math.max(2, Math.round((natural - base) / TAU));
    const dist = base + turns * TAU;

    setPhase("spinning");
    setResult(null);
    setHint("hint");
    setAnnounce("Spinning");
    if (l.reduced) {
      sim.theta = sim.theta + dir * dist;
      sim.mode = "idle";
      write();
      settle(winner);
      return;
    }
    sim.mode = "spin";
    sim.winner = winner;
    sim.spinT = 0;
    sim.spinFrom = sim.theta;
    sim.spinDist = dist;
    sim.spinDir = dir;
    sim.spinRamp = ramp;
    sim.spinDur = clamp((EASE_K * dist) / w0, 3.2, 10);
    kick();
  }, [kick, settle, write]);

  const locked = once && phase === "won";
  const busy = phase === "spinning";

  /* Hub: press and hold winds the wheel back and fills the ring; release throws it. */
  const startCharge = () => {
    const sim = simRef.current;
    if (busy || locked || sim.mode === "spin" || sim.mode === "charge") return;
    if (phase === "won") { setPhase("idle"); setResult(null); }
    sim.mode = "charge";
    sim.charge = 0;
    sim.chargeBase = sim.theta;
    kick();
  };
  const releaseCharge = () => {
    const sim = simRef.current;
    if (sim.mode !== "charge") return;
    pressAtRef.current = performance.now();
    const power = sim.charge;
    sim.mode = "idle";
    spin(9 + power * 19);
  };
  const cancelCharge = () => {
    const sim = simRef.current;
    if (sim.mode !== "charge") return;
    sim.mode = "coast";
    sim.omega = 0.8;
    kick();
  };
  const onHubClick = () => {
    // Screen reader activation arrives as a bare click with no press before it.
    if (performance.now() - pressAtRef.current < 500) return;
    if (busy || locked || simRef.current.mode === "spin") return;
    spin(16);
  };
  const onHubKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    if (!e.repeat) startCharge();
  };
  const onHubKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    releaseCharge();
  };

  /* Wheel drag: the wheel follows the pointer angle around the hub; the release velocity becomes the spin. */
  const rectRef = useRef<DOMRect | null>(null);
  const angleAt = (x: number, y: number) => {
    const r = rectRef.current;
    if (!r) return null;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (Math.hypot(dx, dy) < r.width * 0.1) return null;
    return Math.atan2(dx, -dy);
  };
  const onRotorDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const sim = simRef.current;
    if (e.button !== 0 || busy || locked || sim.mode === "spin") return;
    rectRef.current = stageRef.current?.getBoundingClientRect() ?? null;
    const a = angleAt(e.clientX, e.clientY);
    if (a === null) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (phase === "won") { setPhase("idle"); setResult(null); }
    sim.mode = "drag";
    sim.omega = 0;
    sim.grabTheta = sim.theta;
    sim.grabAngle = a;
    sim.grabAcc = 0;
    sim.samples = [{ t: e.timeStamp, theta: sim.theta }];
    kick();
  };
  const onRotorMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const sim = simRef.current;
    if (sim.mode !== "drag") return;
    const a = angleAt(e.clientX, e.clientY);
    if (a === null) return;
    sim.grabAcc += wrap(a - sim.grabAngle);
    sim.grabAngle = a;
    sim.theta = sim.grabTheta + sim.grabAcc;
    const t = e.timeStamp;
    sim.samples.push({ t, theta: sim.theta });
    while (sim.samples.length > 2 && t - sim.samples[0].t > 100) sim.samples.shift();
    const first = sim.samples[0];
    sim.omega = t > first.t ? ((sim.theta - first.theta) / (t - first.t)) * 1000 : 0;
    kick();
  };
  const onRotorUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const sim = simRef.current;
    if (sim.mode !== "drag") return;
    const last = sim.samples[sim.samples.length - 1];
    // A pointer that stopped before letting go carries no momentum.
    const omega = last && e.timeStamp - last.t < 80 ? sim.omega : 0;
    if (Math.abs(omega) >= MIN_SPIN) {
      sim.mode = "idle";
      spin(clamp(omega, -MAX_SPIN, MAX_SPIN), 0);
      return;
    }
    sim.mode = "coast";
    sim.omega = omega;
    if (Math.abs(sim.theta - sim.grabTheta) > 0.35) setHint("weak");
    kick();
  };

  // The won segment lifts into the card: the card starts small at the segment under the pointer and flies to its place.
  // Inline values are cleared once the flight ends or stops, so the stylesheet's fade out runs when the card hides.
  useLayoutEffect(() => {
    const card = cardRef.current;
    const stage = stageRef.current;
    if (!flight || !card || !stage) return;
    const clear = () => {
      card.style.transform = "";
      card.style.opacity = "";
    };
    // Measure the card at rest, not where an interrupted flight left it.
    clear();
    if (reduced) return;
    const s = stage.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    const fromX = s.left + s.width / 2;
    const fromY = s.top + s.height * ((C - R_FACE * 0.6) / 400);
    const dx = fromX - (c.left + c.width / 2);
    const dy = fromY - (c.top + c.height / 2);
    const controls = animate(card, { x: [dx, 0], y: [dy, 0], scale: [0.18, 1], opacity: [0, 1] }, { type: "spring", visualDuration: 0.62, bounce: 0.14 });
    flightRef.current = controls;
    controls.then(clear, clear);
    return () => {
      controls.stop();
      clear();
      if (flightRef.current === controls) flightRef.current = null;
    };
  }, [flight, reduced]);

  // A spin that starts mid-flight hands the card straight to its fade out.
  useLayoutEffect(() => {
    if (result !== null || !flightRef.current) return;
    flightRef.current.stop();
    flightRef.current = null;
    if (cardRef.current) {
      cardRef.current.style.transform = "";
      cardRef.current.style.opacity = "";
    }
  }, [result]);

  const copyCode = async (code: string) => {
    try {
      await writeClipboard(code);
      setCopy("copied");
      setAnnounce("Code copied");
    } catch {
      setCopy("failed");
      setAnnounce("Copy failed. Select the code and copy it manually.");
    }
  };
  useEffect(() => {
    if (copy === "idle") return;
    const t = window.setTimeout(() => setCopy("idle"), 1800);
    return () => window.clearTimeout(t);
  }, [copy]);

  const again = () => {
    if (once) return;
    spin(14 + Math.random() * 8);
  };

  const won = result !== null ? segments[result] : null;
  const shown = won ?? segments[lastWon ?? 0] ?? segments[0];
  const wheelLabel = `${label}. ${segments.length} prizes: ${segments.map((s, i) => `${s.label}, ${percent(geometry.odds[i])} chance`).join("; ")}.`;
  const rootStyle = { ...style, ...(accent ? { "--pw-accent": accent } : null) } as CSSProperties;

  return (
    <div ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={rootStyle} data-phase={phase} role="group" aria-label={label}>
      <div className={styles.layout}>
        <div ref={stageRef} className={styles.stage}>
          <div className={styles.shadow} aria-hidden="true" />
          <div
            className={styles.grip}
            data-locked={locked || busy || undefined}
            onPointerDown={onRotorDown}
            onPointerMove={onRotorMove}
            onPointerUp={onRotorUp}
            onPointerCancel={onRotorUp}
            role="img"
            aria-label={wheelLabel}
          >
            <div ref={rotorRef} className={styles.rotor}>
              <svg viewBox="0 0 400 400" className={styles.svg} aria-hidden="true">
                {segments.map((seg, i) => {
                  const arc = geometry.arcs[i];
                  const mid = (arc.start + arc.end) / 2;
                  const deg = (mid * 180) / Math.PI;
                  const span = arc.end - arc.start;
                  return (
                    <g key={seg.id ?? `${seg.label}-${i}`} className={styles.wedge} data-alt={i % 2 === 1 || undefined} data-featured={seg.featured || undefined} data-won={result === i || undefined}>
                      <path d={wedgePath(arc.start, arc.end, R_FACE)} />
                      {span > 0.2 && (
                        <text x={C} y={C - R_LABEL_OUT} transform={`rotate(${f(deg)} ${C} ${C}) rotate(-90 ${C} ${C - R_LABEL_OUT})`} textAnchor="end" dominantBaseline="central">
                          {seg.label}
                        </text>
                      )}
                    </g>
                  );
                })}
                {geometry.pegs.map((a, i) => {
                  const [x, y] = point(a, R_FACE);
                  return <line key={`d${i}`} className={styles.divider} x1={C} y1={C} x2={f(x)} y2={f(y)} />;
                })}
                <circle className={styles.faceEdge} cx={C} cy={C} r={R_FACE} />
                <circle className={styles.rim} cx={C} cy={C} r={R_RIM} strokeWidth={RIM_W} />
                <circle className={styles.rimEdge} cx={C} cy={C} r={R_RIM + RIM_W / 2 - 0.5} />
                {geometry.pegs.map((a, i) => {
                  const [x, y] = point(a, R_PEG);
                  return (
                    <g key={`p${i}`} className={styles.peg}>
                      <circle cx={f(x)} cy={f(y)} r={PEG_R} />
                      <circle className={styles.pegShine} cx={f(x - 0.9)} cy={f(y - 0.9)} r={1.2} />
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Static light on the rim, so the metal keeps its highlight while the wheel turns under it. */}
          <svg viewBox="0 0 400 400" className={styles.overlay} aria-hidden="true">
            <defs>
              <linearGradient id={`${uid}-sheen`} x1="0.15" y1="0" x2="0.85" y2="1">
                <stop offset="0" className={styles.sheenHi} />
                <stop offset="0.45" className={styles.sheenLo} />
                <stop offset="1" className={styles.sheenMid} />
              </linearGradient>
            </defs>
            <circle cx={C} cy={C} r={R_RIM} fill="none" stroke={`url(#${uid}-sheen)`} strokeWidth={RIM_W} />
            <g ref={flapRef} className={styles.flap}>
              <path className={styles.pointer} d={POINTER_D} />
              <circle className={styles.pivot} cx={C} cy={PIVOT_Y} r={2.6} />
            </g>
          </svg>

          <button
            type="button"
            className={styles.hub}
            aria-disabled={busy || locked || undefined}
            aria-describedby={`${uid}-hint`}
            aria-label={locked ? labels.done : busy ? "Spinning" : "Spin the wheel"}
            onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); startCharge(); } }}
            onPointerUp={releaseCharge}
            onPointerCancel={cancelCharge}
            onLostPointerCapture={releaseCharge}
            onKeyDown={onHubKeyDown}
            onKeyUp={onHubKeyUp}
            onBlur={cancelCharge}
            onClick={onHubClick}
          >
            <svg viewBox="0 0 100 100" className={styles.hubRing} aria-hidden="true">
              <circle ref={ringRef} cx="50" cy="50" r="46" pathLength={1} />
            </svg>
            <span className={styles.hubLabel}>{locked ? labels.done : labels.spin}</span>
          </button>
        </div>

        <div className={styles.panel}>
          <div className={styles.slot}>
            {/* Every prize's card, laid out invisibly in the same cell, so the slot holds the tallest one and nothing below it moves on a win. */}
            {segments.map((seg, i) => (
              <div key={`s-${seg.id ?? `${seg.label}-${i}`}`} className={`${styles.card} ${styles.sizer}`} aria-hidden="true" inert>
                <p className={styles.cardPrize}>{seg.label}</p>
                {seg.detail && <p className={styles.cardDetail}>{seg.detail}</p>}
                {seg.code && (
                  <div className={styles.code}>
                    <span className={styles.codeText}>{seg.code}</span>
                    <span className={styles.copy}><span className={styles.copyFace} data-on><Copy size={16} strokeWidth={1.75} />{labels.copy}</span></span>
                  </div>
                )}
                {!once && <span className={styles.again}><RotateCw size={16} strokeWidth={1.75} />{labels.again}</span>}
              </div>
            ))}
            <div className={styles.idle} data-hidden={won ? true : undefined} aria-hidden={won ? true : undefined}>
              <h3 className={styles.title}>{title}</h3>
              <p className={styles.description}>{description}</p>
              <p id={`${uid}-hint`} className={styles.hint} data-weak={hint === "weak" || undefined}>{hint === "weak" ? labels.weak : labels.hint}</p>
            </div>
            <div ref={cardRef} className={styles.card} data-show={won ? true : undefined} aria-hidden={won ? undefined : true} inert={!won}>
              <p className={styles.cardPrize}>{shown.label}</p>
              {shown.detail && <p className={styles.cardDetail}>{shown.detail}</p>}
              {shown.code && (
                <div className={styles.code}>
                  <span className={styles.codeText}>{shown.code}</span>
                  <button type="button" className={styles.copy} data-state={copy} onClick={() => copyCode(shown.code ?? "")} aria-label={copy === "copied" ? labels.copied : copy === "failed" ? labels.copyFailed : `${labels.copy} ${shown.code}`}>
                    <FitFaces shown={copy === "copied" ? 1 : copy === "failed" ? 2 : 0}>
                      <span className={styles.copyFace} data-on={copy === "idle" || undefined}><Copy size={16} strokeWidth={1.75} aria-hidden="true" />{labels.copy}</span>
                      <span className={styles.copyFace} data-on={copy === "copied" || undefined}><svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className={styles.copyCheck} aria-hidden="true"><path d="M4 12l5 5L20 6" pathLength={1} /></svg>{labels.copied}</span>
                      <span className={styles.copyFace} data-on={copy === "failed" || undefined}><X size={16} strokeWidth={1.75} aria-hidden="true" />{labels.copyFailed}</span>
                    </FitFaces>
                  </button>
                </div>
              )}
              {!once && (
                <button type="button" className={styles.again} onClick={again}>
                  <RotateCw size={16} strokeWidth={1.75} aria-hidden="true" />
                  {labels.again}
                </button>
              )}
            </div>
          </div>

          {showOdds && (
            <div className={styles.odds}>
              <p className={styles.oddsTitle}>{labels.odds}</p>
              <ul className={styles.oddsList}>
                {segments.map((seg, i) => (
                  <li key={seg.id ?? `${seg.label}-${i}`} className={styles.oddsRow} data-featured={seg.featured || undefined} data-won={result === i || undefined}>
                    <span className={styles.oddsLabel}>{seg.label}</span>
                    <span className={styles.oddsValue}>{percent(geometry.odds[i])}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
    </div>
  );
}

export default PrizeWheel;
