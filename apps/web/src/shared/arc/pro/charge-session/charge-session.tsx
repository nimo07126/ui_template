"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { BatteryFull, RotateCcw, Square, Zap } from "lucide-react";
import styles from "./charge-session.module.css";

export type ChargeSessionState = "charging" | "stopped" | "complete";

/** Session totals passed to callbacks. */
export interface ChargeSessionDetail {
  /** State of charge in percent, 0 to 100. */
  charge: number;
  /** Energy added this session in kWh. */
  energy: number;
  /** Cost of the energy added so far, in the session currency. */
  cost: number;
  /** The charge limit in percent. */
  limit: number;
}

/**
 * A charging session card. Energy packets flow from the charger along the cable into the battery, the pack fills toward a
 * draggable charge limit, the power curve tapers near full, and time to limit and cost roll live. Stop charging drains the flow.
 */
export interface ChargeSessionProps {
  /** Name of the charger or device, shown as the card heading. */
  title?: string;
  /** Secondary line under the title, such as the site and the charger's peak power. */
  location?: string;
  /** Usable battery capacity in kWh. */
  capacity?: number;
  /** Peak charging power in kW, reached on the flat part of the curve. */
  maxPower?: number;
  /** State of charge in percent when the session starts. */
  startCharge?: number;
  /** Charge limit in percent to start with. The component owns it after mount. */
  defaultLimit?: number;
  /** Lowest limit the marker can be set to, in percent. */
  minLimit?: number;
  /** State of charge in percent where the power starts to taper. */
  taperAt?: number;
  /** Price per kWh in the session currency. */
  rate?: number;
  /** ISO 4217 currency code for the cost. */
  currency?: string;
  /** Locale used to format the cost. */
  locale?: string;
  /** Multiplies the simulated time. At 1, one second on screen is forty seconds of charging. 0 holds the session still. */
  speed?: number;
  /** Holds the session and the flow on their current frame. */
  paused?: boolean;
  /** Any CSS color for the energy, the fill and the curve. Defaults to the accent. */
  accent?: string;
  /** Called when charging stops, resumes, completes or a new session starts. */
  onStateChange?: (state: ChargeSessionState, detail: ChargeSessionDetail) => void;
  /** Called when the charge limit settles after a drag or a key press. */
  onLimitChange?: (limit: number) => void;
  /** Accessible name of the card. Defaults to the title. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/* Time compression: one real second is this many seconds of charging at speed 1. */
const TIME_SCALE = 40;

/* Hero scene, in viewBox units (1000 x 240, scaled with meet so shapes stay true). */
const HV_W = 1000;
const HV_H = 240;
const IN_X = 244;
const IN_W = 728;
const IN_Y = 32;
const IN_H = 176;
const MID_Y = 120;
const CABLE = { x0: 84, y0: 176, x1: 140, y1: 238, x2: 168, y2: 120, x3: 212, y3: 120 };
const CABLE_D = `M ${CABLE.x0} ${CABLE.y0} C ${CABLE.x1} ${CABLE.y1} ${CABLE.x2} ${CABLE.y2} ${CABLE.x3} ${CABLE.y3}`;
/* The packet path continues through the nub into the pack. */
const NUB_LEN = IN_X - CABLE.x3;

/* Charge curve plot, in viewBox units (1000 x 300, stretched, non scaling strokes). */
const CV_W = 1000;
const CV_H = 300;
const CV_BASE = 288;
const CV_PEAK = 44;

const POOL = 18;
const SPACING = 64;
const PACKET_SPEED = 300;
/* Distance over which a packet dissolves into the fill front. */
const FADE = 26;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };

/** Normalized charging power at a state of charge (0 to 1): a short ramp, a flat peak, then a taper toward full. */
function powerShape(s: number, taper: number) {
  if (s < .1) return .62 + .38 * smooth(s / .1);
  if (s <= taper) return 1;
  const u = (s - taper) / Math.max(.01, 1 - taper);
  return .06 + .94 * Math.exp(-3.2 * Math.pow(u, 1.4));
}

/** Simulated seconds to go from one state of charge to another at full availability. */
function secondsBetween(from: number, to: number, capacity: number, maxPower: number, taper: number) {
  if (to <= from) return 0;
  const steps = 48, ds = (to - from) / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) sum += ds / powerShape(from + ds * (i + .5), taper);
  return sum * capacity * 3600 / maxPower;
}

function formatDuration(seconds: number) {
  const m = seconds / 60;
  if (m < 1) return "Under 1 min";
  if (m < 59.5) return `${Math.round(m)} min`;
  const total = Math.round(m), h = Math.floor(total / 60);
  return `${h} h ${String(total % 60).padStart(2, "0")} min`;
}
function spokenDuration(seconds: number) {
  const m = Math.round(seconds / 60);
  if (m < 1) return "under a minute";
  if (m < 60) return `about ${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60), r = m % 60;
  return `about ${h} hour${h === 1 ? "" : "s"}${r ? ` ${r} minute${r === 1 ? "" : "s"}` : ""}`;
}

/* Arc length table for the cable curve, so packets move at an even pace. */
const cablePoint = (t: number) => {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * CABLE.x0 + b * CABLE.x1 + c * CABLE.x2 + d * CABLE.x3, a * CABLE.y0 + b * CABLE.y1 + c * CABLE.y2 + d * CABLE.y3] as const;
};
const CABLE_LUT = (() => {
  const n = 64, lengths = [0];
  let [px, py] = cablePoint(0), total = 0;
  for (let i = 1; i <= n; i++) {
    const [x, y] = cablePoint(i / n);
    total += Math.hypot(x - px, y - py);
    lengths.push(total);
    px = x; py = y;
  }
  return { n, lengths, total };
})();
function pointAtLength(d: number): readonly [number, number] {
  const { n, lengths, total } = CABLE_LUT;
  if (d <= 0) return cablePoint(0);
  if (d < total) {
    let lo = 0, hi = n;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (lengths[mid] < d) lo = mid; else hi = mid; }
    const t = (lo + (d - lengths[lo]) / (lengths[hi] - lengths[lo])) / n;
    return cablePoint(t);
  }
  return [CABLE.x3 + (d - total), MID_Y];
}

const REDUCE = "(prefers-reduced-motion: reduce)";
const subscribeReduced = (onChange: () => void) => {
  const query = window.matchMedia(REDUCE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const useReducedFlag = () => useSyncExternalStore(subscribeReduced, () => window.matchMedia(REDUCE).matches, () => false);

/** Writes an attribute, style or text only when it changed, so an idle frame touches nothing. */
const written = new WeakMap<Element, Record<string, string>>();
function put(node: Element | null | undefined, key: string, value: string) {
  if (!node) return;
  let seen = written.get(node);
  if (!seen) { seen = {}; written.set(node, seen); }
  if (seen[key] === value) return;
  seen[key] = value;
  if (key === "text") node.textContent = value;
  else if (key.startsWith("--") || key === "transform" || key === "opacity") (node as HTMLElement).style.setProperty(key, value);
  else node.setAttribute(key, value);
}

const STATUS: Record<ChargeSessionState, string> = { charging: "Charging", stopped: "Stopped", complete: "Charged to limit" };

export function ChargeSession({
  title = "Fast charger 4",
  location = "Harbor Street hub, 150 kW",
  capacity = 77,
  maxPower = 150,
  startCharge = 34,
  defaultLimit = 80,
  minLimit = 50,
  taperAt = 50,
  rate = .42,
  currency = "USD",
  locale = "en-US",
  speed = 1,
  paused = false,
  accent,
  onStateChange,
  onLimitChange,
  label,
  className,
  style,
}: ChargeSessionProps) {
  const uid = useId().replace(/:/g, "");
  const reduced = useReducedFlag();
  const start = clamp(startCharge, 0, 99) / 100;
  const taper = clamp(taperAt, 10, 95) / 100;
  const lowLimit = clamp(Math.round(minLimit), 1, 100);
  const initialLimit = clamp(Math.round(defaultLimit), lowLimit, 100);

  const [mode, setMode] = useState<ChargeSessionState>(() => (start * 100 >= initialLimit ? "complete" : "charging"));
  const [announcement, setAnnouncement] = useState("");

  const money = useMemo(() => {
    try { return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
    catch { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }); }
  }, [locale, currency]);

  /* Everything the loop reads, refreshed every render. */
  const live = useRef({ capacity, maxPower, taper, rate, speed, paused, reduced, money, start, lowLimit, onStateChange, onLimitChange });
  useEffect(() => {
    live.current = { capacity, maxPower, taper, rate, speed, paused, reduced, money, start, lowLimit, onStateChange, onLimitChange };
  });

  const sim = useRef({
    soc: start,
    limit: initialLimit,
    level: mode === "charging" ? 1 : 0,
    mode: mode as ChargeSessionState,
    pos: new Float32Array(POOL),
    alive: new Uint8Array(POOL),
    emit: 0,
    pulse: 0,
    seeded: false,
    visible: true,
    running: false,
    frame: 0,
    announceTimer: 0 as ReturnType<typeof setTimeout> | 0,
  });

  /* DOM nodes the loop writes to. */
  const root = useRef<HTMLDivElement>(null);
  const fill = useRef<SVGRectElement>(null);
  const front = useRef<SVGLineElement>(null);
  const beyond = useRef<SVGRectElement>(null);
  const limitLine = useRef<SVGLineElement>(null);
  const led = useRef<SVGRectElement>(null);
  const core = useRef<SVGPathElement>(null);
  const packets = useRef<(SVGCircleElement | null)[]>([]);
  const handle = useRef<HTMLDivElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const socText = useRef<HTMLSpanElement>(null);
  const powerText = useRef<HTMLElement>(null);
  const energyText = useRef<HTMLElement>(null);
  const timeLabel = useRef<HTMLElement>(null);
  const timeText = useRef<HTMLElement>(null);
  const costText = useRef<HTMLElement>(null);
  const traveled = useRef<SVGRectElement>(null);
  const curveBeyond = useRef<SVGRectElement>(null);
  const curveLimit = useRef<SVGLineElement>(null);
  const dot = useRef<HTMLSpanElement>(null);
  const atText = useRef<HTMLSpanElement>(null);
  const heroStage = useRef<HTMLDivElement>(null);
  const plot = useRef<HTMLDivElement>(null);

  const curvePaths = useMemo(() => {
    let line = "";
    for (let i = 0; i <= 200; i++) {
      const s = i / 200;
      const y = CV_BASE - powerShape(s, taper) * (CV_BASE - CV_PEAK);
      line += `${i ? "L" : "M"} ${(s * CV_W).toFixed(1)} ${y.toFixed(1)} `;
    }
    return { line: line.trim(), area: `${line}L ${CV_W} ${CV_BASE} L 0 ${CV_BASE} Z` };
  }, [taper]);

  const detail = useCallback((): ChargeSessionDetail => {
    const s = sim.current, L = live.current;
    const energy = Math.max(0, (s.soc - L.start) * L.capacity);
    return { charge: Math.round(s.soc * 1000) / 10, energy: Math.round(energy * 100) / 100, cost: Math.round(energy * L.rate * 100) / 100, limit: s.limit };
  }, []);

  /** Writes every value that depends on the session into the DOM. */
  const paint = useCallback(() => {
    const s = sim.current, L = live.current;
    const soc = s.soc, lim = s.limit / 100;
    const power = L.maxPower * powerShape(soc, L.taper) * s.level;
    const energy = Math.max(0, (soc - L.start) * L.capacity);
    const frontX = IN_X + soc * IN_W;
    const limX = IN_X + lim * IN_W;

    put(fill.current, "width", (soc * IN_W).toFixed(2));
    put(front.current, "x1", frontX.toFixed(2));
    put(front.current, "x2", frontX.toFixed(2));
    put(front.current, "opacity", soc > .005 ? (.5 + .4 * s.pulse).toFixed(3) : "0");
    put(beyond.current, "x", limX.toFixed(2));
    put(beyond.current, "width", Math.max(0, IN_X + IN_W - limX).toFixed(2));
    put(limitLine.current, "x1", limX.toFixed(2));
    put(limitLine.current, "x2", limX.toFixed(2));
    put(led.current, "opacity", (.18 + .82 * s.level).toFixed(3));
    put(core.current, "opacity", (s.level * .55).toFixed(3));
    put(handle.current, "--x", `${((limX / HV_W) * 100).toFixed(3)}`);
    put(pill.current, "text", `${s.limit}%`);

    put(socText.current, "text", `${Math.floor(soc * 100 + 1e-6)}%`);
    put(powerText.current, "text", `${Math.round(power)} kW`);
    put(energyText.current, "text", `${energy.toFixed(1)} kWh`);
    put(costText.current, "text", L.money.format(energy * L.rate));
    put(timeLabel.current, "text", `Time to ${s.limit}%`);
    const left = secondsBetween(soc, lim, L.capacity, L.maxPower, L.taper);
    put(timeText.current, "text", s.mode === "complete" ? "Done" : s.mode === "stopped" ? "Paused" : formatDuration(left));

    const cx = soc * CV_W;
    put(traveled.current, "x", (L.start * CV_W).toFixed(2));
    put(traveled.current, "width", Math.max(0, cx - L.start * CV_W).toFixed(2));
    put(curveBeyond.current, "x", (lim * CV_W).toFixed(2));
    put(curveBeyond.current, "width", ((1 - lim) * CV_W).toFixed(2));
    put(curveLimit.current, "x1", (lim * CV_W).toFixed(2));
    put(curveLimit.current, "x2", (lim * CV_W).toFixed(2));
    const dy = CV_BASE - powerShape(soc, L.taper) * s.level * (CV_BASE - CV_PEAK);
    put(dot.current, "--x", (soc * 100).toFixed(3));
    put(dot.current, "--y", ((dy / CV_H) * 100).toFixed(3));
    put(atText.current, "text", `${Math.round(power)} kW at ${Math.floor(soc * 100 + 1e-6)}%`);

    /* Packets: along the cable, through the nub, then along the pack, dissolving into the fill front. */
    const inside = CABLE_LUT.total + NUB_LEN;
    const end = inside + soc * IN_W - 6;
    for (let i = 0; i < POOL; i++) {
      const node = packets.current[i];
      if (!node) continue;
      if (!s.alive[i]) { put(node, "opacity", "0"); continue; }
      const d = s.pos[i];
      const [x, y] = pointAtLength(d);
      put(node, "cx", x.toFixed(2));
      put(node, "cy", y.toFixed(2));
      put(node, "data-in", d > inside - 6 ? "in" : "out");
      put(node, "opacity", (smooth(d / 28) * smooth((end - d) / FADE)).toFixed(3));
      /* Radius eases from the cable size to the pack size across the nub, so nothing pops. */
      put(node, "r", (5.5 - smooth((d - CABLE_LUT.total) / NUB_LEN)).toFixed(2));
    }
  }, []);

  /** Places packets at an even, still spacing: the reduced motion frame, and the seed for a seamless start. */
  const seedPackets = useCallback(() => {
    const s = sim.current;
    const end = CABLE_LUT.total + NUB_LEN + s.soc * IN_W - 10;
    for (let i = 0; i < POOL; i++) {
      const d = end - 20 - i * SPACING;
      s.alive[i] = d > 0 ? 1 : 0;
      s.pos[i] = Math.max(0, d);
    }
    s.emit = 0;
    s.seeded = true;
  }, []);

  const setSessionMode = useCallback((next: ChargeSessionState, message?: string) => {
    const s = sim.current;
    if (s.mode === next) return;
    s.mode = next;
    setMode(next);
    if (message) setAnnouncement(message);
    live.current.onStateChange?.(next, detail());
  }, [detail]);

  /** Advances the session by dt real seconds. Returns true while anything is still moving. */
  const step = useCallback((dt: number) => {
    const s = sim.current, L = live.current;
    const target = s.mode === "charging" ? 1 : 0;
    const k = target > s.level ? 2.6 : 4.2;
    s.level += (target - s.level) * (1 - Math.exp(-dt * k));
    if (Math.abs(target - s.level) < .002) s.level = target;

    if (s.level > 0 && L.speed > 0) {
      const power = L.maxPower * powerShape(s.soc, L.taper) * s.level;
      const lim = s.limit / 100;
      s.soc = Math.min(Math.max(lim, s.soc), s.soc + power * dt * L.speed * TIME_SCALE / (L.capacity * 3600));
      if (s.mode === "charging" && s.soc >= lim - 1e-6) {
        s.soc = lim;
        const d = detail();
        setSessionMode("complete", `Charged to ${s.limit}%. ${d.energy.toFixed(1)} kWh added for ${L.money.format(d.cost)}.`);
      }
    }

    /* The fill front brightens a little as each packet lands. */
    s.pulse *= Math.exp(-dt * 5);
    if (s.pulse < .002) s.pulse = 0;

    /* Packets: emitted in step with the power, easing a little as they meet the fill front and dissolving into it,
       so the spacing stays even instead of queueing at the front. */
    const inside = CABLE_LUT.total + NUB_LEN;
    const end = inside + s.soc * IN_W - 6;
    const pace = PACKET_SPEED * (.4 + .6 * s.level) * Math.max(.35, Math.min(1.4, L.speed));
    s.emit += dt * s.level * pace / SPACING;
    let any = false;
    for (let i = 0; i < POOL; i++) {
      if (!s.alive[i]) continue;
      /* Landed once it has faded out, within a couple of units of the front (the front itself keeps moving). */
      if (s.pos[i] >= end - 1.5) {
        s.alive[i] = 0;
        s.pulse = Math.min(1, s.pulse + .4);
        continue;
      }
      const ease = .72 + .28 * smooth((end - s.pos[i]) / 90);
      const launch = .45 + .55 * smooth(s.pos[i] / 60);
      s.pos[i] = Math.min(end, s.pos[i] + pace * ease * launch * dt);
      any = true;
    }
    while (s.emit >= 1) {
      s.emit -= 1;
      if (s.level < .08) continue;
      const free = s.alive.indexOf(0);
      if (free < 0) break;
      s.alive[free] = 1; s.pos[free] = 0; any = true;
    }
    return any || s.level > 0 || s.pulse > 0 || s.mode === "charging";
  }, [detail, setSessionMode]);

  const kick = useCallback(() => {
    const s = sim.current, L = live.current;
    if (L.reduced || L.paused) {
      cancelAnimationFrame(s.frame);
      s.running = false;
      if (L.reduced) {
        s.level = s.mode === "charging" ? 1 : 0;
        if (s.mode === "charging") seedPackets(); else s.alive.fill(0);
      }
      paint();
      return;
    }
    if (!s.seeded && s.mode === "charging") seedPackets();
    if (s.running || !s.visible) { paint(); return; }
    s.running = true;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min(.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const moving = step(dt);
      paint();
      if (s.visible && moving && !live.current.paused && !live.current.reduced) s.frame = requestAnimationFrame(tick);
      else s.running = false;
    };
    s.frame = requestAnimationFrame(tick);
  }, [paint, seedPackets, step]);

  useEffect(() => { kick(); }, [kick, reduced, paused, speed, mode, capacity, maxPower, taper, rate, money]);

  /* Pause offscreen and in background tabs. */
  useEffect(() => {
    const s = sim.current, node = root.current;
    if (!node) return;
    let inView = true;
    const update = () => {
      const visible = inView && document.visibilityState === "visible";
      if (visible === s.visible) return;
      s.visible = visible;
      if (visible) kick();
      else { cancelAnimationFrame(s.frame); s.running = false; }
    };
    const observer = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; update(); });
    observer.observe(node);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      cancelAnimationFrame(s.frame);
      s.running = false;
      if (s.announceTimer) clearTimeout(s.announceTimer);
    };
  }, [kick]);

  /* Limit changes from pointer or keyboard write straight to the DOM; the announcement and callback settle after. */
  const applyLimit = useCallback((value: number, settle: boolean) => {
    const s = sim.current, L = live.current;
    const next = clamp(Math.round(value), L.lowLimit, 100);
    const changed = next !== s.limit;
    s.limit = next;
    const lim = next / 100;
    if (changed) {
      if (s.mode === "complete" && lim > s.soc + .004) {
        setSessionMode("charging", `Charging resumed to ${next}%.`);
      } else if (s.mode === "charging" && lim <= s.soc) {
        const d = detail();
        setSessionMode("complete", `Charged to ${Math.floor(s.soc * 100)}%. ${d.energy.toFixed(1)} kWh added for ${L.money.format(d.cost)}.`);
      }
      const secs = secondsBetween(s.soc, lim, L.capacity, L.maxPower, L.taper);
      const text = `Charge limit ${next}%${lim > s.soc ? `, ${spokenDuration(secs)} to go` : ""}`;
      put(handle.current, "aria-valuenow", String(next));
      put(handle.current, "aria-valuetext", text);
      paint();
      kick();
    }
    if (settle) {
      if (s.announceTimer) clearTimeout(s.announceTimer);
      s.announceTimer = setTimeout(() => {
        const secs = secondsBetween(s.soc, s.limit / 100, L.capacity, L.maxPower, L.taper);
        setAnnouncement(`Charge limit ${s.limit}%.${s.limit / 100 > s.soc ? ` ${spokenDuration(secs)} to go at full power.` : ""}`);
        live.current.onLimitChange?.(s.limit);
      }, 350);
    }
  }, [detail, kick, paint, setSessionMode]);

  /* Pointer: press anywhere on the pack or the curve to move the limit there, then drag. */
  const drag = useRef<{ id: number; left: number; width: number; kind: "hero" | "plot" } | null>(null);
  const socFromPointer = (clientX: number) => {
    const d = drag.current;
    if (!d) return sim.current.limit;
    const x = (clientX - d.left) / d.width;
    return d.kind === "hero" ? ((x * HV_W - IN_X) / IN_W) * 100 : x * 100;
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const kind = e.currentTarget.dataset.surface === "plot" ? "plot" : "hero";
    const rect = e.currentTarget.getBoundingClientRect();
    drag.current = { id: e.pointerId, left: rect.left, width: rect.width, kind };
    e.currentTarget.setPointerCapture(e.pointerId);
    root.current?.setAttribute("data-dragging", "");
    // Pointer focus keeps keyboard handling ready but never draws the keyboard ring.
    handle.current?.setAttribute("data-pointer", "");
    handle.current?.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
    applyLimit(socFromPointer(e.clientX), false);
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    applyLimit(socFromPointer(e.clientX), false);
  };
  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    root.current?.removeAttribute("data-dragging");
    applyLimit(sim.current.limit, true);
  };

  const onHandleKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    e.currentTarget.removeAttribute("data-pointer");
    const s = sim.current;
    const big = e.shiftKey ? 10 : 1;
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") next = s.limit + big;
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = s.limit - big;
    else if (e.key === "PageUp") next = s.limit + 10;
    else if (e.key === "PageDown") next = s.limit - 10;
    else if (e.key === "Home") next = live.current.lowLimit;
    else if (e.key === "End") next = 100;
    if (next === null) return;
    e.preventDefault();
    applyLimit(next, true);
  };

  const onAction = () => {
    const s = sim.current, L = live.current;
    if (s.mode === "charging") {
      const d = detail();
      setSessionMode("stopped", `Charging stopped at ${Math.floor(s.soc * 100)}%. ${d.energy.toFixed(1)} kWh added for ${L.money.format(d.cost)}.`);
    } else if (s.mode === "stopped") {
      if (s.limit / 100 <= s.soc + .004) setSessionMode("complete", `Already at the ${s.limit}% limit. Raise the limit to keep charging.`);
      else setSessionMode("charging", `Charging resumed to ${s.limit}%.`);
    } else {
      s.soc = L.start;
      s.alive.fill(0);
      s.seeded = false;
      if (s.limit / 100 <= s.soc + .004) {
        s.limit = Math.max(s.limit, Math.min(100, Math.ceil(s.soc * 100) + 20));
      }
      put(handle.current, "aria-valuenow", String(s.limit));
      setSessionMode("charging", `New session started at ${Math.floor(s.soc * 100)}%, charging to ${s.limit}%.`);
    }
  };

  /* Server safe first render values. */
  const initialCharging = start * 100 < initialLimit;
  const initialPower = maxPower * powerShape(start, taper) * (initialCharging ? 1 : 0);
  const initialLeft = secondsBetween(start, initialLimit / 100, capacity, maxPower, taper);
  const lim0 = initialLimit / 100;
  const limX0 = IN_X + lim0 * IN_W;
  const cells = Array.from({ length: 9 }, (_, i) => IN_X + ((i + 1) / 10) * IN_W);

  const rootStyle = { ...(accent ? { "--cs-accent": accent } : null), ...style } as CSSProperties;
  const actionLabel = mode === "charging" ? "Stop charging" : mode === "stopped" ? "Resume charging" : "Start new session";

  return (
    <div
      ref={root}
      role="group"
      aria-label={label ?? title}
      className={[styles.root, className].filter(Boolean).join(" ")}
      style={rootStyle}
      data-mode={mode}
    >
      <div className={styles.card}>
      <header className={styles.header}>
        <div className={styles.titles}>
          <h3 className={styles.title}>{title}</h3>
          {location ? <p className={styles.location}>{location}</p> : null}
        </div>
        <div className={styles.charge}>
          <span ref={socText} className={styles.soc}>{`${Math.floor(start * 100 + 1e-6)}%`}</span>
          <span className={styles.status} data-mode={mode}>
            {mode === "charging" ? <Zap size={16} strokeWidth={1.75} aria-hidden="true" /> : mode === "stopped" ? <Square size={14} strokeWidth={1.75} aria-hidden="true" /> : <BatteryFull size={16} strokeWidth={1.75} aria-hidden="true" />}
            {STATUS[mode]}
          </span>
        </div>
      </header>

      <div
        ref={heroStage}
        className={styles.hero}
        data-surface="hero"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        <svg className={styles.heroSvg} viewBox={`0 0 ${HV_W} ${HV_H}`} aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id={`${uid}-metal`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" className={styles.m1} />
              <stop offset=".3" className={styles.m2} />
              <stop offset=".55" className={styles.m3} />
              <stop offset=".8" className={styles.m4} />
              <stop offset="1" className={styles.m5} />
            </linearGradient>
            <clipPath id={`${uid}-pack`}>
              <rect x={IN_X} y={IN_Y} width={IN_W} height={IN_H} rx={32} />
            </clipPath>
          </defs>

          {/* Charger */}
          <rect x={12} y={28} width={72} height={184} rx={18} fill={`url(#${uid}-metal)`} className={styles.post} />
          <rect x={28} y={46} width={40} height={24} rx={6} className={styles.screen} />
          <rect ref={led} x={44} y={96} width={8} height={56} rx={4} className={styles.led} opacity={initialCharging ? 1 : .18} />

          {/* Cable, leaving the plug on the post */}
          <path d={CABLE_D} className={styles.cable} />
          <path ref={core} d={CABLE_D} className={styles.core} opacity={initialCharging ? .55 : 0} />
          <rect x={72} y={166} width={18} height={20} rx={5} className={styles.holster} />
          <rect x={CABLE.x3 - 2} y={96} width={NUB_LEN + 10} height={48} rx={10} className={styles.nub} />

          {/* Pack */}
          <rect x={232} y={20} width={752} height={200} rx={44} className={styles.shell} />
          <g clipPath={`url(#${uid}-pack)`}>
            <rect x={IN_X} y={IN_Y} width={IN_W} height={IN_H} className={styles.well} />
            <rect ref={fill} x={IN_X} y={IN_Y} width={start * IN_W} height={IN_H} className={styles.fill} />
            <rect ref={beyond} x={limX0} y={IN_Y} width={Math.max(0, IN_X + IN_W - limX0)} height={IN_H} className={styles.beyond} />
            {cells.map(x => <line key={x} x1={x} x2={x} y1={IN_Y + 14} y2={IN_Y + IN_H - 14} className={styles.cell} />)}
            <line ref={front} x1={IN_X + start * IN_W} x2={IN_X + start * IN_W} y1={IN_Y} y2={IN_Y + IN_H} className={styles.front} />
          </g>
          <path d={`M ${276} 25 H ${940}`} className={styles.sheen} />
          <line ref={limitLine} x1={limX0} x2={limX0} y1={20} y2={220} className={styles.limitLine} />

          {/* Energy */}
          <g className={styles.packets}>
            {Array.from({ length: POOL }, (_, i) => (
              <circle key={i} ref={node => { packets.current[i] = node; }} cx={CABLE.x0} cy={CABLE.y0} r={5.5} opacity={0} data-in="out" className={styles.packet} />
            ))}
          </g>
        </svg>

        <div
          ref={handle}
          className={styles.handle}
          role="slider"
          tabIndex={0}
          aria-label="Charge limit"
          aria-valuemin={lowLimit}
          aria-valuemax={100}
          aria-valuenow={initialLimit}
          aria-valuetext={`Charge limit ${initialLimit}%${lim0 > start ? `, ${spokenDuration(initialLeft)} to go` : ""}`}
          aria-describedby={`${uid}-hint`}
          onKeyDown={onHandleKey}
          style={{ "--x": ((limX0 / HV_W) * 100).toFixed(3) } as CSSProperties}
        >
          <span ref={pill} className={styles.pill}>{`${initialLimit}%`}</span>
        </div>
      </div>

      <div className={styles.lower}>
        <section className={styles.curve} aria-label="Charge curve">
          <div className={styles.curveHead}>
            <span className={styles.curveTitle}>Charge curve</span>
            <span ref={atText} className={styles.curveAt} aria-hidden="true">{`${Math.round(initialPower)} kW at ${Math.floor(start * 100 + 1e-6)}%`}</span>
          </div>
          <div
            ref={plot}
            className={styles.plot}
            data-surface="plot"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            aria-hidden="true"
          >
            <svg className={styles.plotSvg} viewBox={`0 0 ${CV_W} ${CV_H}`} preserveAspectRatio="none" focusable="false">
              <defs>
                <linearGradient id={`${uid}-area`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" className={styles.areaTop} />
                  <stop offset="1" className={styles.areaBottom} />
                </linearGradient>
                <clipPath id={`${uid}-done`}>
                  <rect ref={traveled} x={start * CV_W} y={0} width={0} height={CV_H} />
                </clipPath>
              </defs>
              <line x1={0} x2={CV_W} y1={CV_PEAK} y2={CV_PEAK} className={styles.grid} />
              <line x1={0} x2={CV_W} y1={(CV_PEAK + CV_BASE) / 2} y2={(CV_PEAK + CV_BASE) / 2} className={styles.grid} />
              <line x1={0} x2={CV_W} y1={CV_BASE} y2={CV_BASE} className={styles.axis} />
              <rect ref={curveBeyond} x={lim0 * CV_W} y={0} width={(1 - lim0) * CV_W} height={CV_BASE} className={styles.curveBeyond} />
              <path d={curvePaths.area} fill={`url(#${uid}-area)`} clipPath={`url(#${uid}-done)`} />
              <path d={curvePaths.line} className={styles.curveLine} />
              <path d={curvePaths.line} className={styles.curveDone} clipPath={`url(#${uid}-done)`} />
              <line ref={curveLimit} x1={lim0 * CV_W} x2={lim0 * CV_W} y1={CV_PEAK - 30} y2={CV_BASE} className={styles.curveLimit} />
            </svg>
            <span className={styles.yLabel} style={{ top: `${(CV_PEAK / CV_H) * 100}%` }}>{`${maxPower} kW`}</span>
            <span className={styles.xLabel} data-edge="start">0%</span>
            <span className={styles.xLabel} style={{ left: `${taper * 100}%` }}>{`${Math.round(taper * 100)}%`}</span>
            <span className={styles.xLabel} data-edge="end">100%</span>
            <span
              ref={dot}
              className={styles.dot}
              style={{ "--x": (start * 100).toFixed(3), "--y": (((CV_BASE - powerShape(start, taper) * (initialCharging ? 1 : 0) * (CV_BASE - CV_PEAK)) / CV_H) * 100).toFixed(3) } as CSSProperties}
            />
          </div>
        </section>

        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Power</dt>
            <dd ref={powerText}>{`${Math.round(initialPower)} kW`}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Energy added</dt>
            <dd ref={energyText}>0.0 kWh</dd>
          </div>
          <div className={styles.stat}>
            <dt ref={timeLabel}>{`Time to ${initialLimit}%`}</dt>
            <dd ref={timeText}>{initialCharging ? formatDuration(initialLeft) : "Done"}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Cost</dt>
            <dd ref={costText}>{money.format(0)}</dd>
          </div>
        </dl>
      </div>

      <footer className={styles.footer}>
        <p id={`${uid}-hint`} className={styles.hint}>Drag across the pack or the curve to set the charge limit.</p>
        <button type="button" className={styles.action} onClick={onAction} data-mode={mode}>
          <span className={styles.actionIcon} aria-hidden="true">
            {mode === "charging" ? <Square size={14} strokeWidth={1.75} /> : mode === "stopped" ? <Zap size={16} strokeWidth={1.75} /> : <RotateCcw size={16} strokeWidth={1.75} />}
          </span>
          <span className={styles.actionLabels}>
            {(["Stop charging", "Resume charging", "Start new session"] as const).map(text => (
              <span key={text} className={styles.actionLabel} data-active={text === actionLabel ? "" : undefined} aria-hidden={text === actionLabel ? undefined : true}>{text}</span>
            ))}
          </span>
        </button>
      </footer>

      </div>
      <p className={styles.sr} role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}

export default ChargeSession;
