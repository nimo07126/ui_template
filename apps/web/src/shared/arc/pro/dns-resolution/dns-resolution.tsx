"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import styles from "./dns-resolution.module.css";

export type DnsResolutionNodeKey = "browser" | "resolver" | "root" | "tld" | "authoritative";

export interface DnsResolutionNode {
  /** Short name under the node, such as Resolver or Root server. */
  label?: string;
  /** Secondary text under the name, such as 1.1.1.1 or ns1.acme.dev. For the nameserver it is also the host the TLD refers to. */
  meta?: string;
  /** One line shown in a small tag while the node is hovered. */
  detail?: string;
  /**
   * A mark beside the name. A string is either SVG path data on a 24 by 24 viewBox (the Simple Icons format), painted in color,
   * or an image URL for a full color logo. Any ReactNode works too and inherits the muted text color.
   */
  icon?: string | ReactNode;
  /** Brand color for a path mark. Leave it out for black and white brands so the mark follows the text color. */
  color?: string;
}

/**
 * An animated DNS lookup on a layered 2.5D stage: the browser asks a resolver, the query hops to a root server, the TLD server
 * and the authoritative nameserver, each pointing to the next, until an address comes back and the page connects. The
 * resolver keeps the answer with a TTL ring that drains, and a second lookup is answered from that cache in one short hop.
 */
export interface DnsResolutionProps {
  /** The name being looked up. The TLD server and the default nameserver are derived from it. */
  domain?: string;
  /** The address the nameserver answers with. */
  address?: string;
  /** Time to live of the answer in seconds, shown on the cached record while its ring drains. */
  ttl?: number;
  /** Milliseconds the full lookup takes, counted up in the browser status. */
  lookupMs?: number;
  /** Milliseconds the cached lookup takes. */
  cachedMs?: number;
  /** Overrides for each node: name, meta line, hover detail and an optional mark. */
  nodes?: Partial<Record<DnsResolutionNodeKey, DnsResolutionNode>>;
  /** Multiplies the pace. At 1 one lookup and cache cycle takes 16 seconds. 0 holds still. */
  speed?: number;
  /** Holds the animation. Paused from the start, it shows the cached state with every hop answered. */
  paused?: boolean;
  /** Any CSS color for the moving query, lit paths and the TTL ring. Defaults to the theme accent. */
  accent?: string;
  /** Shows the step scrubber with a pause button, so viewers can replay or jump between stages. */
  controls?: boolean;
  /** Shows one line under the scrubber that narrates the current stage. */
  caption?: boolean;
  /** Accessible description. Defaults to a sentence built from the domain, servers and address. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

type Pt = { x: number; y: number };
type NodeKind = "browser" | "resolver" | "server";
type EdgeKey = "ask" | "root" | "tld" | "authoritative";
type NodeGeo = { key: DnsResolutionNodeKey; kind: NodeKind; cx: number; cy: number; a: number; h: number; port: Pt; floor: number };
type Arc = {
  d: string; floorD: string; len: number; lift: number;
  xs: Float32Array; ys: Float32Array; fx: Float32Array; fy: Float32Array; acc: Float32Array;
};
type Layout = { w: number; h: number; wide: boolean; nodes: Record<DnsResolutionNodeKey, NodeGeo>; edges: Record<EdgeKey, Arc> };

const NODE_KEYS: DnsResolutionNodeKey[] = ["browser", "resolver", "root", "tld", "authoritative"];
const EDGE_KEYS: EdgeKey[] = ["ask", "root", "tld", "authoritative"];
const EDGE_END: Record<EdgeKey, DnsResolutionNodeKey> = { ask: "browser", root: "root", tld: "tld", authoritative: "authoritative" };
/** The resolver's cache tier sits this far above its base, and the packets leave from its top face. */
const TIER = 12;
const TIER_A = 0.58;
/** Below this root width the stage switches to the portrait layout. */
const WIDE = 640;
const SAMPLES = 56;
const TRAIL = 46;

/** Timeline in seconds at speed 1. Every frame is a pure function of this clock, so the loop repeats seamlessly. */
const T = {
  ask: 0.5, askTrip: 0.95,
  check: 1.45,
  root: 2.05, tld: 4.25, authoritative: 6.45, out: 0.9, think: 0.3,
  store: 8.55, fill: 0.5,
  answer: 8.8, answerTrip: 0.95,
  page: 9.9,
  again: 11.6, hop: 0.6, hit: 12.2, back: 12.3,
  expire: 15, fade: 15.35, cycle: 16,
};
const ARRIVE = (key: "root" | "tld" | "authoritative") => T[key] + T.out;
const REPLY = (key: "root" | "tld" | "authoritative") => ARRIVE(key) + T.think;
const CONNECTED = T.answer + T.answerTrip;
const TTL_FULL = T.store + T.fill;
const CACHED_CONNECTED = T.back + T.hop;

type Trip = { edge: EdgeKey; t0: number; d: number; back: boolean; kind: "query" | "referral" | "answer" };
const TRIPS: Trip[] = [
  { edge: "ask", t0: T.ask, d: T.askTrip, back: false, kind: "query" },
  { edge: "root", t0: T.root, d: T.out, back: false, kind: "query" },
  { edge: "root", t0: REPLY("root"), d: T.out, back: true, kind: "referral" },
  { edge: "tld", t0: T.tld, d: T.out, back: false, kind: "query" },
  { edge: "tld", t0: REPLY("tld"), d: T.out, back: true, kind: "referral" },
  { edge: "authoritative", t0: T.authoritative, d: T.out, back: false, kind: "query" },
  { edge: "authoritative", t0: REPLY("authoritative"), d: T.out, back: true, kind: "answer" },
  { edge: "ask", t0: T.answer, d: T.answerTrip, back: true, kind: "answer" },
  { edge: "ask", t0: T.again, d: T.hop, back: false, kind: "query" },
  { edge: "ask", t0: T.back, d: T.hop, back: true, kind: "answer" },
];

/** The six stages the scrubber jumps between. rep is a settled moment used for the still frame of each stage. */
const STAGES = [
  { start: 0, rep: T.root - 0.1, short: "Ask", title: "Ask the resolver" },
  { start: T.root - 0.05, rep: T.tld - 0.1, short: "Root", title: "Root server" },
  { start: T.tld - 0.05, rep: T.authoritative - 0.1, short: "TLD", title: "TLD server" },
  { start: T.authoritative - 0.05, rep: T.store - 0.02, short: "Nameserver", title: "Authoritative nameserver" },
  { start: T.store, rep: T.page + 1, short: "Answer", title: "Answer and connect" },
  { start: T.again - 0.5, rep: T.back + T.hop + 0.6, short: "Cache", title: "Answered from cache" },
];
const STILL = STAGES[5].rep;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const ease = (t: number) => 0.5 - Math.cos(Math.PI * clamp(t, 0, 1)) / 2;
const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
/** Rises over rin from a, holds until b, then falls over rout. */
const windowed = (t: number, a: number, b: number, rin: number, rout: number) =>
  t < a || t > b + rout ? 0 : t < a + rin ? ease((t - a) / rin) : t <= b ? 1 : 1 - ease((t - b) / rout);
/** A flash that lands at once and fades out over len seconds. */
const flash = (dt: number, len = 0.7) => (dt < 0 || dt > len ? 0 : (1 - dt / len) ** 2);
const isUrl = (value: string) => /^(\/|\.|https?:|data:|blob:)/.test(value);
const f2 = (v: number) => v.toFixed(2);

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/** A slab on the 2:1 isometric grid: top face centered on (cx, cy), half width a, thickness h. */
function slab(cx: number, cy: number, a: number, h: number) {
  const b = a / 2;
  const p = (pts: number[][]) => pts.map(([x, y]) => `${f2(x)},${f2(y)}`).join(" ");
  return {
    top: p([[cx, cy - b], [cx + a, cy], [cx, cy + b], [cx - a, cy]]),
    left: p([[cx - a, cy], [cx, cy + b], [cx, cy + b + h], [cx - a, cy + h]]),
    right: p([[cx, cy + b], [cx + a, cy], [cx + a, cy + h], [cx, cy + b + h]]),
    outline: p([[cx, cy - b], [cx + a, cy], [cx + a, cy + h], [cx, cy + b + h], [cx - a, cy + h], [cx - a, cy]]),
  };
}

/** A point on a slab's top face: u runs toward the right corner, v toward the left corner. */
const onTop = (cx: number, cy: number, a: number, u: number, v: number): Pt => ({ x: cx + (u - v) * a, y: cy - a / 2 + (u + v) * (a / 2) });

/** An isometric circle on a top face as a path that starts at the back and runs clockwise, so a dash can drain it. */
function isoRing(cx: number, cy: number, r: number) {
  const ry = r / 2;
  return `M${f2(cx)} ${f2(cy - ry)} A${f2(r)} ${f2(ry)} 0 0 1 ${f2(cx)} ${f2(cy + ry)} A${f2(r)} ${f2(ry)} 0 0 1 ${f2(cx)} ${f2(cy - ry)}`;
}

/** A quadratic arc through the air from a to b, with its shadow line on the floor, sampled for an even pace. */
function makeArc(a: Pt, b: Pt, fa: Pt, fb: Pt, bend: Pt): Arc {
  const c = { x: (a.x + b.x) / 2 + bend.x, y: (a.y + b.y) / 2 + bend.y };
  const n = SAMPLES + 1;
  const xs = new Float32Array(n), ys = new Float32Array(n), fx = new Float32Array(n), fy = new Float32Array(n), acc = new Float32Array(n);
  let lift = 1;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLES, u = 1 - t;
    xs[i] = u * u * a.x + 2 * u * t * c.x + t * t * b.x;
    ys[i] = u * u * a.y + 2 * u * t * c.y + t * t * b.y;
    fx[i] = fa.x + (fb.x - fa.x) * t;
    fy[i] = fa.y + (fb.y - fa.y) * t;
    lift = Math.max(lift, fy[i] - ys[i]);
    acc[i] = i ? acc[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]) : 0;
  }
  return {
    d: `M${f2(a.x)} ${f2(a.y)} Q${f2(c.x)} ${f2(c.y)} ${f2(b.x)} ${f2(b.y)}`,
    floorD: `M${f2(fa.x)} ${f2(fa.y)} L${f2(fb.x)} ${f2(fb.y)}`,
    len: acc[n - 1] || 1, lift, xs, ys, fx, fy, acc,
  };
}

function sampleArc(arc: Arc, s: number) {
  const { acc } = arc;
  const target = clamp(s, 0, arc.len);
  let lo = 0, hi = acc.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (acc[mid] < target) lo = mid; else hi = mid;
  }
  const k = (target - acc[lo]) / (acc[hi] - acc[lo] || 1);
  const mix = (arr: Float32Array) => arr[lo] + (arr[hi] - arr[lo]) * k;
  return { x: mix(arc.xs), y: mix(arc.ys), fx: mix(arc.fx), fy: mix(arc.fy) };
}

function buildLayout(wide: boolean): Layout {
  const w = wide ? 1000 : 390;
  const h = wide ? 612 : 676;
  const spec: Record<DnsResolutionNodeKey, [NodeKind, number, number, number, number]> = wide
    ? {
      browser: ["browser", 160, 290, 74, 14],
      resolver: ["resolver", 480, 290, 84, 20],
      root: ["server", 850, 80, 58, 26],
      tld: ["server", 850, 272, 58, 26],
      authoritative: ["server", 850, 464, 58, 26],
    }
    : {
      browser: ["browser", 104, 122, 62, 12],
      resolver: ["resolver", 112, 452, 70, 18],
      root: ["server", 294, 104, 50, 22],
      tld: ["server", 294, 318, 50, 22],
      authoritative: ["server", 294, 532, 50, 22],
    };
  const nodes = {} as Record<DnsResolutionNodeKey, NodeGeo>;
  for (const key of NODE_KEYS) {
    const [kind, cx, cy, a, th] = spec[key];
    const raised = kind === "resolver" ? TIER : 0;
    nodes[key] = { key, kind, cx, cy, a, h: th, port: { x: cx, y: cy - raised }, floor: cy + th };
  }
  const floorOf = (n: NodeGeo): Pt => ({ x: n.cx, y: n.floor + n.a / 2 * 0.2 });
  const r = nodes.resolver;
  const arc = (from: NodeGeo, to: NodeGeo, bend: Pt) => makeArc(from.port, to.port, floorOf(from), floorOf(to), bend);
  const edges: Record<EdgeKey, Arc> = wide
    ? {
      ask: arc(nodes.browser, r, { x: 0, y: -118 }),
      root: arc(r, nodes.root, { x: -40, y: -92 }),
      tld: arc(r, nodes.tld, { x: 0, y: -104 }),
      authoritative: arc(r, nodes.authoritative, { x: 24, y: -60 }),
    }
    : {
      ask: arc(nodes.browser, r, { x: -64, y: -30 }),
      root: arc(r, nodes.root, { x: -40, y: -70 }),
      tld: arc(r, nodes.tld, { x: -10, y: -76 }),
      authoritative: arc(r, nodes.authoritative, { x: 20, y: -40 }),
    };
  return { w, h, wide, nodes, edges };
}

function Mark({ node, className }: { node: DnsResolutionNode; className: string }) {
  const { icon, color } = node;
  if (icon == null) return null;
  if (typeof icon === "string") {
    // eslint-disable-next-line @next/next/no-img-element -- a small logo mark at its natural size; any URL is allowed.
    if (isUrl(icon)) return <img className={className} src={icon} alt="" draggable={false} />;
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d={icon} fill={color ?? "currentColor"} /></svg>;
  }
  return <span className={className} aria-hidden="true">{icon}</span>;
}

export function DnsResolution({
  domain = "app.acme.dev",
  address = "203.0.113.24",
  ttl = 300,
  lookupMs = 84,
  cachedMs = 1,
  nodes: nodeOverrides,
  speed = 1,
  paused = false,
  accent,
  controls = true,
  caption = true,
  label,
  className,
  style,
}: DnsResolutionProps) {
  const reduced = useReducedFlag();
  const root = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<DnsResolutionNodeKey | null>(null);
  const [held, setHeld] = useState(false);

  const parts = domain.split(".").filter(Boolean);
  const tld = `.${parts[parts.length - 1] ?? "com"}`;
  const zone = parts.slice(-2).join(".") || domain;

  const info = useMemo(() => {
    const o = nodeOverrides ?? {};
    const merged: Record<DnsResolutionNodeKey, DnsResolutionNode> = {
      browser: { label: "Browser", meta: domain, detail: "Needs an address before it can connect", ...o.browser },
      resolver: { label: "Resolver", meta: "Recursive DNS", detail: "Walks the chain for you and caches the answer", ...o.resolver },
      root: { label: "Root server", meta: "a.root-servers.net", detail: "Knows where every top level domain lives", ...o.root },
      tld: { label: "TLD server", meta: `${tld} registry`, detail: `Knows the nameservers for every ${tld} name`, ...o.tld },
      authoritative: { label: "Nameserver", meta: `ns1.${zone}`, detail: `Holds the records for ${zone}`, ...o.authoritative },
    };
    return merged;
  }, [nodeOverrides, domain, tld, zone]);
  const nsHost = info.authoritative.meta ?? `ns1.${zone}`;

  const text = useMemo(() => ({
    messages: { query: `A? ${domain}`, rootRef: `NS ${tld}`, tldRef: `NS ${nsHost}`, answer: `A ${address}` },
    replies: { root: `Try ${tld}`, tld: `Try ${nsHost}`, authoritative: address } as Record<"root" | "tld" | "authoritative", string>,
    asking: { root: "Asking root", tld: `Asking ${tld}`, authoritative: `Asking ${nsHost}` } as Record<"root" | "tld" | "authoritative", string>,
    captions: [
      `Your browser asks the resolver for ${domain}. It is not in the cache yet.`,
      `The root server does not know the address, but points to the ${tld} servers.`,
      `The ${tld} server points to ${nsHost}, the nameserver for ${zone}.`,
      `${nsHost} answers with the address ${address}.`,
      `The resolver caches the answer for ${ttl} s and the browser connects in ${lookupMs} ms.`,
      `The next lookup comes straight from the cache in ${cachedMs} ms, until the TTL runs out.`,
    ],
  }), [tld, nsHost, address, domain, zone, ttl, lookupMs, cachedMs]);

  const wide = width >= WIDE, measured = width > 0;
  const layout = useMemo(() => (measured ? buildLayout(wide) : null), [measured, wide]);

  const els = useRef({
    node: {} as Partial<Record<DnsResolutionNodeKey, SVGGElement | null>>,
    led: {} as Partial<Record<DnsResolutionNodeKey, SVGCircleElement | null>>,
    port: {} as Partial<Record<DnsResolutionNodeKey, SVGEllipseElement | null>>,
    status: {} as Partial<Record<DnsResolutionNodeKey, HTMLSpanElement | null>>,
    statusText: {} as Partial<Record<DnsResolutionNodeKey, HTMLSpanElement | null>>,
    edge: {} as Partial<Record<EdgeKey, SVGPathElement | null>>,
    floor: {} as Partial<Record<EdgeKey, SVGPathElement | null>>,
    trail: {} as Partial<Record<EdgeKey, SVGPathElement | null>>,
    packet: {} as Partial<Record<EdgeKey, SVGCircleElement | null>>,
    shadow: {} as Partial<Record<EdgeKey, SVGEllipseElement | null>>,
    page: [] as (SVGPathElement | null)[],
    lock: null as SVGCircleElement | null,
    ring: null as SVGPathElement | null,
    record: null as HTMLSpanElement | null,
    recordTtl: null as HTMLSpanElement | null,
    fill: [] as (HTMLSpanElement | null)[],
    seg: [] as (HTMLButtonElement | null)[],
    caption: null as HTMLElement | null,
    capTitle: null as HTMLSpanElement | null,
    capText: null as HTMLSpanElement | null,
    msg: null as HTMLSpanElement | null,
    msgText: null as HTMLSpanElement | null,
  });

  const sim = useRef({ t: paused || speed === 0 ? STILL : 0, rate: NaN, rateV: 0, frame: 0, running: false, visible: true, cache: new Map<Element, Record<string, string>>() });
  const target = paused || held ? 0 : speed * (focus ? 0.7 : 1);
  const scale = layout ? width / layout.w : 1;
  const live = useRef({ layout, text, target, reduced, lookupMs, cachedMs, ttl, scale });
  useLayoutEffect(() => { live.current = { layout, text, target, reduced, lookupMs, cachedMs, ttl, scale }; });

  /**
   * Writes a value only when it changed, so resting elements cost nothing per frame. Keys starting with -- are custom
   * properties, s: sets a style property, text sets textContent, and anything else is an attribute.
   */
  const put = useCallback((node: Element | null | undefined, key: string, value: string) => {
    if (!node) return;
    const cache = sim.current.cache;
    let entry = cache.get(node);
    if (!entry) { entry = {}; cache.set(node, entry); }
    if (entry[key] === value) return;
    entry[key] = value;
    if (key === "text") {
      const first = node.firstChild;
      if (first && first.nodeType === 3 && !first.nextSibling) (first as Text).data = value;
      else node.textContent = value;
    }
    else if (key.startsWith("--")) (node as HTMLElement).style.setProperty(key, value);
    else if (key.startsWith("s:")) (node as HTMLElement).style.setProperty(key.slice(2), value);
    else node.setAttribute(key, value);
  }, []);

  const paint = useCallback((time: number) => {
    const { layout: g, text: tx, lookupMs: fullMs, cachedMs: hitMs, ttl: life, scale: k0 } = live.current;
    const e = els.current;
    const raw = ((time % T.cycle) + T.cycle) % T.cycle;
    const t = raw;
    /** Everything the story built up fades together at the end, so the next cycle starts clean. */
    const vis = raw < T.fade ? 1 : 1 - ease((raw - T.fade) / (T.cycle - T.fade));
    /** Status text dips out at the seam and back in, instead of jumping. */
    const dip = raw < 0.35 ? ease(raw / 0.35) : vis;

    /** Scrubber and caption. */
    let stage = 0;
    STAGES.forEach((s, i) => { if (t >= s.start) stage = i; });
    STAGES.forEach((s, i) => {
      const end = STAGES[i + 1]?.start ?? T.cycle;
      /** A still frame fills every step up to the chosen one; playback fills the current step as it runs. */
      const done = live.current.reduced ? (i <= stage ? 1 : 0) : clamp((t - s.start) / (end - s.start), 0, 1);
      put(e.fill[i], "s:transform", `scaleX(${done.toFixed(4)})`);
      /** At the seam the filled track fades out with the scene instead of snapping back to empty. */
      put(e.fill[i], "s:opacity", vis.toFixed(3));
      put(e.seg[i], "data-current", i === stage ? "true" : "false");
      put(e.seg[i], "aria-current", i === stage ? "step" : "false");
    });
    put(e.capTitle, "text", STAGES[stage].title);
    put(e.capText, "text", tx.captions[stage]);
    /** The caption dips out just before a stage ends and back in after the next begins, so the text never swaps in view. */
    const capStart = STAGES[stage].start, capEnd = STAGES[stage + 1]?.start ?? T.cycle;
    const capOp = live.current.reduced ? 1 : Math.min(ease((t - capStart) / 0.3), ease((capEnd - t) / 0.15));
    put(e.caption, "s:opacity", capOp.toFixed(3));

    if (!g) return;

    /** Packets: one per edge, since two trips on the same edge never overlap. */
    const lit: Record<EdgeKey, number> = { ask: 0, root: 0, tld: 0, authoritative: 0 };
    const hits: Record<DnsResolutionNodeKey, number> = { browser: 0, resolver: 0, root: 0, tld: 0, authoritative: 0 };
    const active: Partial<Record<EdgeKey, { u: number; trip: Trip }>> = {};
    for (const trip of TRIPS) {
      const u = (t - trip.t0) / trip.d;
      if (u >= 0 && u <= 1) active[trip.edge] = { u, trip };
      /** The first trip over an edge leaves it tinted, so the chain stays readable after the packet has passed. */
      lit[trip.edge] = Math.max(lit[trip.edge], ease(clamp(u, 0, 1)));
      const to = trip.back ? (trip.edge === "ask" ? "browser" : "resolver") : (trip.edge === "ask" ? "resolver" : EDGE_END[trip.edge]);
      hits[to] = Math.max(hits[to], flash(t - trip.t0 - trip.d, 0.8));
    }
    /** In the cached stage the long chain steps back so the one short hop stands out. */
    const recede = 1 - 0.62 * ease((t - (T.again - 0.4)) / 0.5);
    let message = false;
    for (const key of EDGE_KEYS) {
      const arc = g.edges[key];
      put(e.edge[key], "--lit", ((key === "ask" ? lit[key] : lit[key] * recede) * vis).toFixed(3));
      const run = active[key];
      const packet = e.packet[key], trail = e.trail[key], shadow = e.shadow[key];
      if (!run) {
        put(packet, "opacity", "0"); put(trail, "opacity", "0"); put(shadow, "opacity", "0");
        continue;
      }
      const { u, trip } = run;
      const s = ease(u) * arc.len;
      const pos = trip.back ? arc.len - s : s;
      const p = sampleArc(arc, pos);
      const sink = ease((u - 0.8) / 0.2);
      const rise = ease(u / 0.16);
      put(packet, "transform", `translate(${f2(p.x)} ${f2(p.y)}) scale(${(1 - 0.5 * sink).toFixed(3)})`);
      put(packet, "opacity", (rise * (1 - sink)).toFixed(3));
      put(packet, "data-kind", trip.kind);
      const height = clamp((p.fy - p.y) / arc.lift, 0, 1);
      put(shadow, "transform", `translate(${f2(p.fx)} ${f2(p.fy)}) scale(${(1 - 0.45 * height).toFixed(3)})`);
      put(shadow, "opacity", ((0.9 - 0.5 * height) * rise * (1 - sink)).toFixed(3));
      const len = Math.min(TRAIL, s);
      const from = trip.back ? pos : pos - len;
      const k = 1000 / arc.len;
      put(trail, "stroke-dasharray", `${(len * k).toFixed(2)} 3000`);
      put(trail, "stroke-dashoffset", `${(-from * k).toFixed(2)}`);
      put(trail, "opacity", (clamp(u / 0.12, 0, 1) * (1 - clamp((u - 0.82) / 0.18, 0, 1))).toFixed(3));
      /** The record the packet carries rides just above it, in real DNS shorthand. */
      message = true;
      put(e.msg, "s:transform", `translate3d(${(p.x * k0).toFixed(1)}px, ${(p.y * k0 - 10).toFixed(1)}px, 0) translate(-50%, -100%)`);
      put(e.msg, "s:opacity", (ease(u / 0.2) * (1 - ease((u - 0.78) / 0.2))).toFixed(3));
      put(e.msg, "data-kind", trip.kind);
      put(e.msgText, "text", tx.messages[trip.kind === "query" ? "query" : trip.kind === "answer" ? "answer" : key === "root" ? "rootRef" : "tldRef"]);
    }
    if (!message) put(e.msg, "s:opacity", "0");

    /** Nodes: an accent edge flash when something lands, a lit port while a packet leaves, a lit LED while a server works. */
    for (const key of NODE_KEYS) {
      put(e.node[key], "--hit", hits[key].toFixed(3));
      let leave = 0;
      for (const trip of TRIPS) {
        const from = trip.back ? (trip.edge === "ask" ? "resolver" : EDGE_END[trip.edge]) : (trip.edge === "ask" ? "browser" : "resolver");
        if (from === key) leave = Math.max(leave, flash(t - trip.t0, 0.6));
      }
      put(e.port[key], "fill-opacity", Math.max(leave, hits[key]).toFixed(3));
    }
    for (const key of ["root", "tld", "authoritative"] as const) {
      put(e.led[key], "fill-opacity", windowed(t, ARRIVE(key), REPLY(key), 0.08, 0.35).toFixed(3));
    }

    /** Browser: the page draws in on its top face once connected, and flashes when the cached lookup lands. */
    e.page.forEach((line, i) => {
      const p = ease((t - T.page - i * 0.14) / 0.55) * vis;
      put(line, "stroke-dashoffset", (1 - p).toFixed(4));
      /** Round caps would leave a dot on an empty dash, so an undrawn line hides. */
      put(line, "opacity", p > 0.002 ? "1" : "0");
    });
    put(e.lock, "fill-opacity", ((t >= CONNECTED ? easeOut((t - CONNECTED) / 0.3) : 0) * vis).toFixed(3));

    /** TTL ring: fills when the answer is stored, then drains until the record expires. */
    const drain = clamp((t - TTL_FULL) / (T.expire - TTL_FULL), 0, 1);
    const full = t < T.store ? 0 : t < TTL_FULL ? easeOut((t - T.store) / T.fill) : 1 - drain;
    put(e.ring, "stroke-dasharray", `${(full * 1000).toFixed(2)} 1000`);
    put(e.ring, "opacity", (full < 0.002 ? 0 : t < T.expire ? 1 : 1 - ease((t - T.expire) / 0.3)).toFixed(3));
    const recordOp = windowed(t, T.store, T.expire + 0.2, 0.35, 0.35) * vis;
    put(e.record, "s:opacity", recordOp.toFixed(3));
    put(e.record, "s:transform", `translateY(${(-6 * (1 - easeOut((t - T.store) / 0.5))).toFixed(2)}px)`);
    put(e.record, "data-state", t >= T.expire ? "expired" : t >= T.hit && t < T.hit + 0.9 ? "hit" : "live");
    put(e.recordTtl, "text", t >= T.expire ? "Expired" : `TTL ${Math.max(0, Math.ceil(life * (t < TTL_FULL ? 1 : 1 - drain)))} s`);

    /** Status lines under each node, all derived from the same clock. */
    const status = (key: DnsResolutionNodeKey, state: string, value: string, op = dip) => {
      put(e.status[key], "data-state", state);
      put(e.statusText[key], "text", value);
      put(e.status[key], "s:opacity", op.toFixed(3));
    };
    const msSoFar = Math.round(fullMs * clamp((t - T.ask) / (CONNECTED - T.ask), 0, 1));
    if (t < T.ask) status("browser", "idle", "Ready");
    else if (t < CONNECTED) status("browser", "busy", `Resolving ${msSoFar} ms`);
    else if (t < CONNECTED + 0.7) status("browser", "busy", "Connecting");
    else if (t < T.again) status("browser", "done", `Connected in ${fullMs} ms`);
    else if (t < CACHED_CONNECTED) status("browser", "busy", "Resolving");
    else status("browser", "done", `Connected in ${hitMs} ms`);

    if (t < T.check) status("resolver", "idle", "Waiting");
    else if (t < T.root) status("resolver", "busy", t < T.check + 0.35 ? "Checking cache" : "Not cached");
    else if (t < ARRIVE("authoritative") + T.out + T.think) {
      const key = t < T.tld ? "root" : t < T.authoritative ? "tld" : "authoritative";
      status("resolver", "busy", tx.asking[key]);
    }
    else if (t < T.hit) status("resolver", "done", "Answer cached");
    else if (t < T.expire) status("resolver", "done", "Cache hit");
    else status("resolver", "idle", "Expired");

    for (const key of ["root", "tld", "authoritative"] as const) {
      const arrive = ARRIVE(key), reply = REPLY(key);
      const op = (t < arrive ? 0 : ease((t - arrive) / 0.25)) * vis;
      if (t < reply) status(key, "busy", "Looking up", op);
      else status(key, key === "authoritative" ? "done" : "refer", tx.replies[key], op);
    }
  }, [put]);

  const loop = useCallback(() => {
    const s = sim.current;
    if (s.running || !s.visible || live.current.reduced) return;
    s.running = true;
    let last = performance.now();
    const tick = (now: number) => {
      if (!s.visible || live.current.reduced) { s.running = false; return; }
      const dt = clamp((now - last) / 1000, 0, 0.05);
      last = now;
      const goal = live.current.target;
      if (Number.isNaN(s.rate)) s.rate = goal;
      /** Speed changes, pausing and the hover slowdown ease on a critically damped spring, so nothing jolts. */
      s.rateV += (40 * (goal - s.rate) - 2 * Math.sqrt(40) * s.rateV) * dt;
      s.rate += s.rateV * dt;
      if (Math.abs(goal - s.rate) < 1e-4 && Math.abs(s.rateV) < 1e-4) { s.rate = goal; s.rateV = 0; }
      s.t += dt * s.rate;
      paint(s.t);
      if ((s.rate === 0 && goal === 0) || !s.visible || live.current.reduced) { s.running = false; return; }
      s.frame = requestAnimationFrame(tick);
    };
    s.frame = requestAnimationFrame(tick);
  }, [paint]);

  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    const measure = () => setWidth(Math.floor(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /** With reduced motion the clock rests on a settled moment of a stage, showing the finished state without travel. */
  const [stillStage, setStillStage] = useState(5);
  useLayoutEffect(() => {
    sim.current.cache = new Map();
    if (reduced) paint(STAGES[stillStage].rep);
    else { paint(sim.current.t); loop(); }
  }, [layout, scale, text, reduced, target, stillStage, paint, loop]);

  useEffect(() => {
    const node = root.current, s = sim.current;
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

  /** Jumps to the start of a stage in the current cycle and keeps playing from there. */
  const jump = useCallback((i: number) => {
    const s = sim.current;
    if (live.current.reduced) { setStillStage(i); return; }
    const raw = ((s.t % T.cycle) + T.cycle) % T.cycle;
    s.t = s.t - raw + STAGES[i].start + (i === 0 ? 0 : 0.001);
    paint(s.t);
    loop();
  }, [paint, loop]);

  const onSegKey = (event: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = event.key === "ArrowRight" ? i + 1 : event.key === "ArrowLeft" ? i - 1 : event.key === "Home" ? 0 : event.key === "End" ? STAGES.length - 1 : -1;
    if (next < 0 || next >= STAGES.length) return;
    event.preventDefault();
    els.current.seg[next]?.focus();
    jump(next);
  };

  const hover = (key: DnsResolutionNodeKey) => ({
    onPointerEnter: (event: ReactPointerEvent) => { if (event.pointerType === "mouse") setFocus(key); },
    onPointerLeave: () => setFocus(current => (current === key ? null : current)),
  });
  const edgeOn = (key: EdgeKey) => focus === "resolver" || focus === EDGE_END[key];

  const aria = label ?? `DNS resolution for ${domain}. The browser asks a resolver, which asks a root server, the ${tld} TLD server and the nameserver ${nsHost} in turn. Each points to the next until ${nsHost} answers ${address} and the browser connects in ${lookupMs} ms. The resolver caches the answer for ${ttl} seconds, so the next lookup is answered from the cache in one short hop.`;

  const g = layout;
  const rootStyle = { ...style, ...(accent ? { "--dns-accent": accent } : null) } as CSSProperties;
  const showHeld = held || paused || speed === 0;
  const pct = (v: number, of: number) => `${((v / of) * 100).toFixed(3)}%`;

  /** Nodes paint back to front so nearer slabs overlap the ones behind them. */
  const order = g ? [...NODE_KEYS].sort((p, q) => g.nodes[p].cy - g.nodes[q].cy) : [];

  const renderNode = (key: DnsResolutionNodeKey) => {
    if (!g) return null;
    const n = g.nodes[key];
    const s = slab(n.cx, n.cy, n.a, n.h);
    const dim = focus !== null && focus !== key && !(focus === "resolver") && !(key === "resolver");
    const b = n.a / 2;
    return <g
      key={key}
      ref={el => { els.current.node[key] = el; }}
      className={styles.node}
      data-on={focus === key || undefined}
      data-dim={dim || undefined}
      {...hover(key)}
    >
      <polygon className={styles.faceLeft} points={s.left} />
      <polygon className={styles.faceRight} points={s.right} />
      <polygon className={styles.faceTop} points={s.top} />
      {n.kind === "server" && <>
        {[1, 2].map(k => {
          const d = (n.h * k) / 3;
          return <line key={k} className={styles.rack} x1={n.cx - n.a} y1={n.cy + d} x2={n.cx} y2={n.cy + b + d} />;
        })}
        {[1, 2].map(k => {
          const d = (n.h * k) / 3;
          return <line key={`r${k}`} className={styles.rack} x1={n.cx} y1={n.cy + b + d} x2={n.cx + n.a * 0.62} y2={n.cy + b * 0.38 + d} />;
        })}
        <circle className={styles.ledBase} cx={n.cx + n.a * 0.8} cy={n.cy + b * 0.2 + n.h / 2} r={2.4} />
        <circle ref={el => { els.current.led[key] = el; }} className={styles.led} cx={n.cx + n.a * 0.8} cy={n.cy + b * 0.2 + n.h / 2} r={2.4} fillOpacity={0} />
      </>}
      {n.kind === "browser" && (() => {
        const bar0 = onTop(n.cx, n.cy, n.a, 0.1, 0.16), bar1 = onTop(n.cx, n.cy, n.a, 0.9, 0.16);
        const rows = [[0.36, 0.1, 0.84], [0.5, 0.1, 0.66], [0.64, 0.1, 0.76], [0.78, 0.1, 0.5]];
        const lock = onTop(n.cx, n.cy, n.a, 0.16, 0.16);
        return <>
          <path className={styles.bar} d={`M${f2(bar0.x)} ${f2(bar0.y)} L${f2(bar1.x)} ${f2(bar1.y)}`} />
          <circle className={styles.lockBase} cx={lock.x} cy={lock.y} r={1.8} />
          <circle ref={el => { els.current.lock = el; }} className={styles.lock} cx={lock.x} cy={lock.y} r={1.8} fillOpacity={0} />
          {rows.map(([v, u0, u1], i) => {
            const p0 = onTop(n.cx, n.cy, n.a, u0, v), p1 = onTop(n.cx, n.cy, n.a, u1, v);
            const d = `M${f2(p0.x)} ${f2(p0.y)} L${f2(p1.x)} ${f2(p1.y)}`;
            return <g key={i}>
              <path className={styles.ghost} d={d} />
              <path ref={el => { els.current.page[i] = el; }} className={styles.pageLine} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1} opacity={0} />
            </g>;
          })}
        </>;
      })()}
      {n.kind === "resolver" && (() => {
        const ta = n.a * TIER_A, tcy = n.cy - TIER;
        const tier = slab(n.cx, tcy, ta, TIER);
        const r = ta * 0.64;
        return <>
          <polygon className={styles.faceLeft} points={tier.left} />
          <polygon className={styles.faceRight} points={tier.right} />
          <polygon className={styles.faceTop} points={tier.top} />
          <path className={styles.ringTrack} d={isoRing(n.cx, tcy, r)} />
          <path ref={el => { els.current.ring = el; }} className={styles.ring} d={isoRing(n.cx, tcy, r)} pathLength={1000} strokeDasharray="0 1000" opacity={0} />
        </>;
      })()}
      <ellipse className={styles.portBase} cx={n.port.x} cy={n.port.y} rx={4.5} ry={2.25} />
      <ellipse ref={el => { els.current.port[key] = el; }} className={styles.port} cx={n.port.x} cy={n.port.y} rx={4.5} ry={2.25} fillOpacity={0} />
      <polygon className={styles.hit} points={n.kind === "resolver" ? slab(n.cx, n.cy, n.a, n.h).outline : s.outline} />
    </g>;
  };

  return <figure
    className={[styles.root, className].filter(Boolean).join(" ")}
    style={rootStyle}
    data-ready={g ? true : undefined}
    data-layout={g ? (g.wide ? "wide" : "stack") : undefined}
    data-focus={focus ? true : undefined}
  >
    <div ref={root} className={styles.stage} role="img" aria-label={aria} style={g ? { aspectRatio: `${g.w} / ${g.h}` } : undefined}>
      {g && <>
        <svg className={styles.svg} viewBox={`0 0 ${g.w} ${g.h}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {/* Floor: the shadow of every route, with the packet's shadow sliding along it. */}
          <g>
            {EDGE_KEYS.map(key => <path
              key={key}
              ref={el => { els.current.floor[key] = el; }}
              className={styles.floor}
              d={g.edges[key].floorD}
              data-dim={(focus !== null && !edgeOn(key)) || undefined}
            />)}
            {EDGE_KEYS.map(key => <ellipse key={`s-${key}`} ref={el => { els.current.shadow[key] = el; }} className={styles.shadow} cx={0} cy={0} rx={5} ry={2.5} opacity={0} />)}
          </g>
          {order.map(renderNode)}
          {/* Routes through the air, then the lit trail and the packet on top. */}
          {EDGE_KEYS.map(key => <g key={`e-${key}`} className={styles.route} data-on={edgeOn(key) || undefined} data-dim={(focus !== null && !edgeOn(key)) || undefined}>
            <path ref={el => { els.current.edge[key] = el; }} className={styles.edge} d={g.edges[key].d} />
            <path ref={el => { els.current.trail[key] = el; }} className={styles.trail} d={g.edges[key].d} pathLength={1000} opacity={0} />
            <circle ref={el => { els.current.packet[key] = el; }} className={styles.packet} cx={0} cy={0} r={4.5} opacity={0} data-kind="query" />
          </g>)}
        </svg>

        {NODE_KEYS.map(key => {
          const n = g.nodes[key], node = info[key];
          /** On phones the browser label sits above its slab, so the route up from the resolver never crosses it. */
          const above = !g.wide && key === "browser";
          const top = above ? n.cy - n.a / 2 - 12 : n.floor + n.a / 2 + 12;
          return <div
            key={key}
            className={styles.label}
            data-on={focus === key || undefined}
            data-above={above || undefined}
            style={{ left: pct(n.cx, g.w), top: pct(top, g.h) }}
            {...hover(key)}
          >
            <span className={styles.name}><Mark node={node} className={styles.mark} />{node.label}</span>
            {node.meta && <span className={styles.meta}>{node.meta}</span>}
            <span ref={el => { els.current.status[key] = el; }} className={styles.status} data-state="idle">
              <span className={styles.dot} aria-hidden="true" />
              <span ref={el => { els.current.statusText[key] = el; }}>{key === "browser" ? "Ready" : key === "resolver" ? "Waiting" : "Looking up"}</span>
            </span>
            {key === "resolver" && <span ref={el => { els.current.record = el; }} className={styles.record} style={{ opacity: 0 }}>
              <span className={styles.recordName}>{domain}</span>
              <span className={styles.recordRow}>
                <span className={styles.recordValue}>A {address}</span>
                <span ref={el => { els.current.recordTtl = el; }} className={styles.recordTtl}>TTL {ttl} s</span>
              </span>
            </span>}
          </div>;
        })}

        {NODE_KEYS.map(key => {
          const n = g.nodes[key];
          const detail = info[key].detail;
          if (!detail) return null;
          const top = n.cy - (n.kind === "resolver" ? TIER + (n.a * TIER_A) / 2 : n.a / 2) - 10;
          const edge = n.cx / g.w;
          return <span
            key={`tag-${key}`}
            className={styles.tag}
            data-show={focus === key || undefined}
            data-align={edge > 0.7 ? "end" : edge < 0.3 ? "start" : "center"}
            style={{ left: pct(n.cx, g.w), top: pct(top, g.h) }}
            aria-hidden="true"
          >{detail}</span>;
        })}
        <span ref={el => { els.current.msg = el; }} className={styles.msg} style={{ opacity: 0 }} aria-hidden="true">
          <span ref={el => { els.current.msgText = el; }}>{`A? ${domain}`}</span>
        </span>
      </>}
    </div>

    {controls && <div className={styles.controls}>
      {!reduced && <button type="button" className={styles.toggle} aria-label={showHeld ? "Play" : "Pause"} aria-pressed={held} disabled={paused || speed === 0} onClick={() => setHeld(v => !v)}>
        {showHeld ? <Play size={16} strokeWidth={1.75} aria-hidden="true" /> : <Pause size={16} strokeWidth={1.75} aria-hidden="true" />}
      </button>}
      <div className={styles.segments} role="group" aria-label="Lookup steps">
        {STAGES.map((s, i) => <button
          key={s.short}
          ref={el => { els.current.seg[i] = el; }}
          type="button"
          className={styles.seg}
          aria-label={`Step ${i + 1} of ${STAGES.length}: ${s.title}`}
          onClick={() => jump(i)}
          onKeyDown={event => onSegKey(event, i)}
        >
          <span className={styles.track}><span ref={el => { els.current.fill[i] = el; }} className={styles.fill} /></span>
          <span className={styles.segLabel}>{i === 2 ? tld : s.short}</span>
        </button>)}
      </div>
    </div>}
    {caption && <figcaption ref={el => { els.current.caption = el; }} className={styles.caption} aria-hidden="true">
      <span ref={el => { els.current.capTitle = el; }} className={styles.capTitle}>{STAGES[0].title}</span>
      <span ref={el => { els.current.capText = el; }} className={styles.capText}>{text.captions[0]}</span>
    </figcaption>}
  </figure>;
}

export default DnsResolution;
