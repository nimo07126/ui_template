"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

/** A visitor who just arrived, shown as a dot on the map. */
export interface LiveVisitorPing {
  id: string;
  lat: number;
  lon: number;
  /** "event" pings (a signup or upgrade) draw a stronger ring. Defaults to "visit". */
  kind?: "visit" | "event";
}

/** A page with people on it right now. */
export interface LivePage {
  path: string;
  visitors: number;
}

/** A conversion that just happened. */
export interface LiveVisitorEvent {
  id: string;
  /** Short past tense label: "Signed up", "Upgraded to Pro". */
  label: string;
  city: string;
  /** ISO 3166 alpha-2 code, such as "DE". Draws the flag and names the country for screen readers. */
  country: string;
  /** When it happened. The row shows "now", then seconds or minutes ago. */
  at: number | Date;
  /** Where it happened. With coordinates the map labels the event's dot for a moment. */
  lat?: number;
  lon?: number;
  /** Replaces the built-in flag, for countries outside the built-in set. */
  flag?: ReactNode;
}

export interface LiveVisitorsSnapshot {
  count: number;
  pages: LivePage[];
  visitors: LiveVisitorPing[];
  events: LiveVisitorEvent[];
}

type City = { city: string; country: string; lat: number; lon: number; weight: number };

const cities: City[] = [
  { city: "San Francisco", country: "US", lat: 37.77, lon: -122.42, weight: 9 },
  { city: "New York", country: "US", lat: 40.71, lon: -74, weight: 9 },
  { city: "Austin", country: "US", lat: 30.27, lon: -97.74, weight: 4 },
  { city: "Seattle", country: "US", lat: 47.6, lon: -122.33, weight: 4 },
  { city: "Chicago", country: "US", lat: 41.88, lon: -87.63, weight: 3 },
  { city: "London", country: "GB", lat: 51.5, lon: -0.12, weight: 8 },
  { city: "Manchester", country: "GB", lat: 53.48, lon: -2.24, weight: 2 },
  { city: "Berlin", country: "DE", lat: 52.52, lon: 13.4, weight: 6 },
  { city: "Munich", country: "DE", lat: 48.14, lon: 11.58, weight: 3 },
  { city: "Paris", country: "FR", lat: 48.86, lon: 2.35, weight: 5 },
  { city: "Amsterdam", country: "NL", lat: 52.37, lon: 4.9, weight: 4 },
  { city: "Stockholm", country: "SE", lat: 59.33, lon: 18.07, weight: 3 },
  { city: "Zurich", country: "CH", lat: 47.37, lon: 8.54, weight: 3 },
  { city: "Tokyo", country: "JP", lat: 35.68, lon: 139.69, weight: 5 },
  { city: "Osaka", country: "JP", lat: 34.69, lon: 135.5, weight: 2 },
  { city: "Bengaluru", country: "IN", lat: 12.97, lon: 77.59, weight: 5 },
  { city: "Mumbai", country: "IN", lat: 19.08, lon: 72.88, weight: 3 },
  { city: "São Paulo", country: "BR", lat: -23.55, lon: -46.63, weight: 4 },
  { city: "Rio de Janeiro", country: "BR", lat: -22.9, lon: -43.2, weight: 2 },
];

const totalWeight = cities.reduce((sum, c) => sum + c.weight, 0);
const byName = (name: string) => cities.find(c => c.city === name)!;

function pickCity(rand: () => number) {
  let roll = rand() * totalWeight;
  for (const c of cities) {
    roll -= c.weight;
    if (roll <= 0) return c;
  }
  return cities[0];
}

/** Mulberry32: the first frame is seeded so server and client render the same dots. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PING_LIFE = 6400;
const TICK = 600;

type SimPing = LiveVisitorPing & { born: number };
type SimState = Omit<LiveVisitorsSnapshot, "visitors"> & { visitors: SimPing[]; tick: number; seq: number };

const jitter = (rand: () => number) => (rand() - .5) * 2.4;

function makePing(rand: () => number, seq: number, born: number, city = pickCity(rand), kind: "visit" | "event" = "visit"): SimPing {
  return { id: `v${seq}`, lat: city.lat + jitter(rand), lon: city.lon + jitter(rand), kind, born };
}

function initial(): SimState {
  const rand = seeded(128);
  const now = Date.now();
  const visitors = Array.from({ length: 14 }, (_, i) => makePing(rand, i, now - i * 420));
  const event = (id: string, label: string, name: string, ago: number): LiveVisitorEvent => {
    const c = byName(name);
    return { id, label, city: c.city, country: c.country, lat: c.lat, lon: c.lon, at: now - ago };
  };
  return {
    count: 128,
    pages: [
      { path: "/pricing", visitors: 31 },
      { path: "/docs/quickstart", visitors: 24 },
      { path: "/", visitors: 19 },
      { path: "/changelog", visitors: 12 },
      { path: "/blog/realtime-analytics", visitors: 10 },
    ],
    visitors,
    events: [
      event("e4", "Signed up", "Berlin", 3000),
      event("e3", "Upgraded to Pro", "San Francisco", 16000),
      event("e2", "Signed up", "Tokyo", 38000),
      event("e1", "Signed up", "London", 71000),
    ],
    tick: 0,
    seq: 100,
  };
}

function step(state: SimState): SimState {
  const rand = Math.random;
  const now = Date.now();
  const tick = state.tick + 1;
  let seq = state.seq;
  const visitors = state.visitors.filter(v => now - v.born < PING_LIFE);
  const arrivals = rand() < .3 ? 2 : 1;
  for (let i = 0; i < arrivals; i++) visitors.push(makePing(rand, ++seq, now));

  let count = state.count;
  if (tick % 2 === 0) {
    const pull = count > 148 ? -2 : count < 116 ? 2 : 0;
    count = Math.max(0, count + Math.round(rand() * 7 - 3) + pull);
  }

  let pages = state.pages;
  if (tick % 2 === 1) {
    pages = pages.map(p => ({ ...p }));
    for (let i = 0; i < 2; i++) {
      const page = pages[Math.floor(rand() * pages.length)];
      page.visitors = Math.max(3, Math.min(48, page.visitors + (rand() < .52 ? 1 : -1) * (1 + Math.floor(rand() * 2))));
    }
  }

  let events = state.events;
  if (tick % 4 === 0) {
    const c = pickCity(rand);
    const roll = rand();
    const label = roll < .14 ? "Upgraded to Team" : roll < .32 ? "Upgraded to Pro" : "Signed up";
    events = [{ id: `e${++seq}`, label, city: c.city, country: c.country, lat: c.lat, lon: c.lon, at: now }, ...events].slice(0, 6);
    visitors.push({ ...makePing(rand, ++seq, now, c, "event"), lat: c.lat, lon: c.lon });
  }

  return { count, pages, visitors, events, tick, seq };
}

/**
 * A simulated realtime stream for demos and tests: about 128 people on a SaaS marketing site, a new arrival every 600ms,
 * the count and top pages drifting, and a signup or upgrade every 2.4s. Nothing is fetched. Pass `active: false` to hold it.
 */
export function useLiveVisitorsSimulation(active = true): LiveVisitorsSnapshot {
  const [state, setState] = useState(initial);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setState(step), TICK);
    return () => window.clearInterval(id);
  }, [active]);
  return state;
}
