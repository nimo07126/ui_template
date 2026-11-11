/**
 * The agent loop as a pure function of time, so playback can pause anywhere, step to the next beat and replay exactly.
 * Times are seconds at speed 1. The head moves in station units: gather, act and verify of loop i sit at 3i, 3i + 1
 * and 3i + 2, and the next loop's gather at 3i + 3.
 */

export type AgentLoopStation = "gather" | "act" | "verify";

export const STATIONS: AgentLoopStation[] = ["gather", "act", "verify"];

type EventKind = "arrive" | "context" | "callStart" | "callEnd" | "verify" | "depart" | "done";

export interface TimelineEvent {
  t: number;
  kind: EventKind;
  loop: number;
  station?: AgentLoopStation;
  call?: number;
}

interface Travel { t0: number; t1: number; u0: number }

export interface Timeline {
  events: TimelineEvent[];
  travels: Travel[];
  /** Where a step comes to rest: just after each new block, tool result, check and the end. */
  settles: number[];
  /** When the head first lands on gather; before it the loop reads as ready. */
  start: number;
  /** When the loop is done. */
  end: number;
}

/** Seconds at speed 1. */
const LEAD = 0.2;
const GATHER = 0.85;
const CONTEXT_AT = 0.12;
const CALL_LEAD = 0.1;
const CALL = 0.75;
const CALL_GAP = 0.4;
const VERIFY_AT = 0.1;
const VERIFY = 0.95;
const TRAVEL = [0.7, 0.5, 0.7] as const;

export function buildTimeline(callCounts: number[]): Timeline {
  const events: TimelineEvent[] = [];
  const travels: Travel[] = [];
  const settles: number[] = [];
  let t = LEAD;
  callCounts.forEach((calls, loop) => {
    const u = loop * 3;
    events.push({ t, kind: "arrive", loop, station: "gather" });
    events.push({ t: t + CONTEXT_AT, kind: "context", loop });
    settles.push(t + CONTEXT_AT + 0.4);
    t += GATHER;
    events.push({ t, kind: "depart", loop, station: "gather" });
    travels.push({ t0: t, t1: t + TRAVEL[0], u0: u });
    t += TRAVEL[0];

    events.push({ t, kind: "arrive", loop, station: "act" });
    t += CALL_LEAD;
    for (let call = 0; call < Math.max(1, calls); call++) {
      if (call > 0) t += CALL_GAP;
      events.push({ t, kind: "callStart", loop, call });
      t += CALL;
      events.push({ t, kind: "callEnd", loop, call });
      settles.push(t + 0.25);
    }
    t += CALL_GAP + 0.1;
    events.push({ t, kind: "depart", loop, station: "act" });
    travels.push({ t0: t, t1: t + TRAVEL[1], u0: u + 1 });
    t += TRAVEL[1];

    events.push({ t, kind: "arrive", loop, station: "verify" });
    events.push({ t: t + VERIFY_AT, kind: "verify", loop });
    settles.push(t + VERIFY_AT + 0.4);
    t += VERIFY;
    events.push({ t, kind: "depart", loop, station: "verify" });
    travels.push({ t0: t, t1: t + TRAVEL[2], u0: u + 2 });
    t += TRAVEL[2];
  });
  events.push({ t, kind: "done", loop: Math.max(0, callCounts.length - 1) });
  settles.push(t + 0.05);
  return { events, travels, settles, start: LEAD, end: t + 0.05 };
}

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
/** Ease in and out, so the head leaves and lands on a station gently. */
const inOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

/** The head in station units at time t, and how far through a travel it is (0 at rest). */
export function headAt(tl: Timeline, t: number, reduced: boolean): { u: number; moving: number } {
  let u = 0;
  for (const travel of tl.travels) {
    if (t < travel.t0) break;
    if (t >= travel.t1) { u = travel.u0 + 1; continue; }
    if (reduced) return { u: travel.u0, moving: 0 };
    const x = clamp((t - travel.t0) / (travel.t1 - travel.t0));
    return { u: travel.u0 + inOut(x), moving: Math.sin(Math.PI * x) };
  }
  return { u, moving: 0 };
}

export interface LoopView {
  /** Before the head lands for the first time. */
  ready: boolean;
  done: boolean;
  /** Current loop, zero based. */
  loop: number;
  /** Station the head rests on, or null while it travels. */
  at: AgentLoopStation | null;
  /** The last station the head reached. */
  last: AgentLoopStation | null;
  /** Context blocks added so far. */
  context: number;
  /** The latest tool call. */
  call: { loop: number; index: number; resolved: boolean } | null;
  /** The latest check. */
  verify: { loop: number } | null;
  /** What the caption describes. */
  beat: "ready" | "gather" | "call" | "result" | "verify" | "done";
}

export function viewAt(tl: Timeline, t: number): LoopView {
  const view: LoopView = { ready: t < tl.start, done: false, loop: 0, at: null, last: null, context: 0, call: null, verify: null, beat: "ready" };
  if (view.ready) return view;
  for (const e of tl.events) {
    if (e.t > t) break;
    switch (e.kind) {
      case "arrive":
        view.at = e.station ?? null; view.last = view.at;
        if (e.station === "gather") view.loop = e.loop;
        break;
      case "depart": view.at = null; break;
      case "context": view.context += 1; view.beat = "gather"; break;
      case "callStart": view.call = { loop: e.loop, index: e.call ?? 0, resolved: false }; view.beat = "call"; break;
      case "callEnd": if (view.call) view.call = { ...view.call, resolved: true }; view.beat = "result"; break;
      case "verify": view.verify = { loop: e.loop }; view.beat = "verify"; break;
      case "done": view.done = true; view.at = null; view.beat = "done"; break;
    }
  }
  return view;
}

export const viewKey = (v: LoopView) => [v.ready, v.done, v.loop, v.at, v.last, v.context, v.call ? `${v.call.loop}.${v.call.index}.${v.call.resolved}` : "-", v.verify ? v.verify.loop : "-", v.beat].join("|");

/** The next resting point after t, or the end. */
export function nextSettle(tl: Timeline, t: number) {
  return tl.settles.find(s => s > t + 0.01) ?? tl.end;
}
