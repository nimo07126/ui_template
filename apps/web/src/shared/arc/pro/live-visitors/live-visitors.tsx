"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Pause, Play } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { Tooltip } from "../../tooltip/tooltip";
import { isLand } from "./live-visitors-land";
import { countryNames, Flag, hasFlag } from "./live-visitors-marks";
import { useLiveVisitorsSimulation } from "./live-visitors-sim";
import type { LivePage, LiveVisitorEvent, LiveVisitorPing, LiveVisitorsSnapshot } from "./live-visitors-sim";
import styles from "./live-visitors.module.css";

export type { LivePage, LiveVisitorEvent, LiveVisitorPing, LiveVisitorsSnapshot } from "./live-visitors-sim";
export { useLiveVisitorsSimulation } from "./live-visitors-sim";
export type { FlagCode } from "./live-visitors-marks";

export type LiveVisitorsConnection = "live" | "connecting" | "reconnecting";

export interface LiveVisitorsProps {
  /** People on the site right now. Leave it out to play the built-in simulated stream (and ignore pages, visitors and events). */
  count?: number;
  /** Pages with people on them. Sorted by visitors; the card lists the top few with bars. */
  pages?: LivePage[];
  /** Recent arrivals as map dots. Remove a visitor and its dot fades out. Keep it to the last few seconds of arrivals. */
  visitors?: LiveVisitorPing[];
  /** Recent signups and upgrades, newest first. */
  events?: LiveVisitorEvent[];
  /** The stream's state. "connecting" shows placeholders, "reconnecting" keeps the last data with a warning label. Defaults to "live". */
  connection?: LiveVisitorsConnection;
  /** Freezes what the card shows. Pair with onPausedChange. */
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Hides the pause button. */
  hidePause?: boolean;
  /** The words after the number. Defaults to "person on the site now" / "people on the site now". */
  label?: (count: number) => string;
  /** How many pages to list. Defaults to 4. */
  maxPages?: number;
  /** How many events to list. Defaults to 4. */
  maxEvents?: number;
  /** Accessible name for the card. Defaults to "Live visitors". */
  title?: string;
  className?: string;
}

/* Map: an equirectangular crop from 50°S to 76°N. One path of round caps draws every land dot. */
const WEST = -170, EAST = 180, NORTH = 76, SOUTH = -50;
const VB_W = 600;
const VB_H = Math.round(VB_W * (NORTH - SOUTH) / (EAST - WEST));
const STEP = 6.25;
const project = (lat: number, lon: number) => ({ x: (lon - WEST) / (EAST - WEST) * VB_W, y: (NORTH - lat) / (NORTH - SOUTH) * VB_H });

let landPath: string | null = null;
function getLandPath() {
  if (landPath) return landPath;
  let d = "";
  for (let y = STEP / 2; y < VB_H; y += STEP) {
    const lat = NORTH - y / VB_H * (NORTH - SOUTH);
    for (let x = STEP / 2; x < VB_W; x += STEP) {
      const lon = WEST + x / VB_W * (EAST - WEST);
      if (isLand(lon, lat)) d += `M${x.toFixed(2)} ${y.toFixed(2)}h0`;
    }
  }
  return (landPath = d);
}

const ROW = 36;
const defaultLabel = (n: number) => `${n === 1 ? "person" : "people"} on the site now`;
const toMs = (at: number | Date) => at instanceof Date ? at.getTime() : at;
const subscribe = () => () => {};
const useHydrated = () => useSyncExternalStore(subscribe, () => true, () => false);
const ease = [...motionTokens.ease.standard] as [number, number, number, number];

function ago(now: number, at: number | Date) {
  const s = Math.max(0, Math.round((now - toMs(at)) / 1000));
  if (s < 5) return "now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function spokenAgo(now: number, at: number | Date) {
  const s = Math.max(0, Math.round((now - toMs(at)) / 1000));
  if (s < 5) return "just now";
  if (s < 60) return `${s} seconds ago`;
  if (s < 3600) return `${Math.floor(s / 60)} minutes ago`;
  return `${Math.floor(s / 3600)} hours ago`;
}

/**
 * A realtime visitors card for an analytics view or an admin home: a live count that rolls digit by digit, a dotted world map
 * where new arrivals ping in and fade, the top pages right now with bars, and a ticker of signups and upgrades with flags.
 * With no props it plays a simulated stream of a SaaS marketing site.
 */
export function LiveVisitors(props: LiveVisitorsProps) {
  if (props.count === undefined) return <SimulatedLiveVisitors {...props} />;
  return <LiveVisitorsView {...props} count={props.count} simulated={false} />;
}

function SimulatedLiveVisitors(props: LiveVisitorsProps) {
  const [paused, setPaused] = useState(props.defaultPaused ?? false);
  const [visible, setVisible] = useState(true);
  const isPaused = props.paused ?? paused;
  const live = useLiveVisitorsSimulation(!isPaused && visible);
  const onPausedChange = useCallback((next: boolean) => {
    setPaused(next);
    props.onPausedChange?.(next);
  }, [props]);
  return <LiveVisitorsView {...props} {...live} paused={isPaused} onPausedChange={onPausedChange} simulated onVisibleChange={setVisible} />;
}

function LiveVisitorsView({
  count, pages = [], visitors = [], events = [], connection = "live", paused: pausedProp, defaultPaused = false, onPausedChange, hidePause = false,
  label = defaultLabel, maxPages = 4, maxEvents = 4, title = "Live visitors", className, simulated, onVisibleChange,
}: LiveVisitorsProps & { count: number; simulated: boolean; onVisibleChange?: (visible: boolean) => void }) {
  const reduced = useReducedMotion() ?? false;
  const hydrated = useHydrated();
  const headingId = useId();
  const rootRef = useRef<HTMLElement>(null);

  const [ownPaused, setOwnPaused] = useState(defaultPaused);
  const paused = pausedProp ?? ownPaused;
  const [notice, setNotice] = useState("");
  const togglePaused = () => {
    const next = !paused;
    if (pausedProp === undefined) setOwnPaused(next);
    onPausedChange?.(next);
    setNotice(next ? "Live updates paused." : simulated ? "Live updates resumed. Simulated stream, no visitors are tracked." : "Live updates resumed.");
  };

  // Paused holds the last snapshot, whatever the parent keeps sending.
  const live: LiveVisitorsSnapshot = { count, pages, visitors, events };
  const [frozen, setFrozen] = useState<LiveVisitorsSnapshot | null>(null);
  if (paused && !frozen) setFrozen(live);
  else if (!paused && frozen) setFrozen(null);
  const shown = paused && frozen ? frozen : live;

  // Loops and the clock rest while the card is off screen.
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting);
      onVisibleChange?.(entry.isIntersecting);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [onVisibleChange]);

  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [visible]);

  const connecting = connection === "connecting";
  const state: "live" | "paused" | "connecting" | "reconnecting" = paused ? "paused" : connection;
  const stateLabels = { live: "Live", paused: "Paused", connecting: "Connecting", reconnecting: "Reconnecting" } as const;

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={headingId} data-active={visible && state === "live" ? "" : undefined}>
      <h2 id={headingId} className={styles.srOnly}>{title}</h2>
      <header className={styles.head}>
        <div className={styles.headText}>
          <div className={styles.status} data-state={state}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.stateStack}>
              {(Object.keys(stateLabels) as (keyof typeof stateLabels)[]).map(key => (
                <span key={key} className={styles.stateLabel} data-on={key === state ? "" : undefined} aria-hidden={key === state ? undefined : true}>{stateLabels[key]}</span>
              ))}
            </span>
          </div>
          <p className={styles.countRow}>
            <span className={styles.count} data-pending={connecting ? "" : undefined}>
              <RollingNumber value={shown.count} reduced={reduced} grow />
              <span className={styles.countSkeleton} aria-hidden="true" />
            </span>
            <span className={styles.countLabel}>{label(shown.count)}</span>
            <span className={styles.srOnly}>{connecting ? "Connecting to the live stream" : `${shown.count} ${label(shown.count)}`}</span>
          </p>
        </div>
        <div className={styles.headActions}>
          {simulated ? <span className={styles.meta}>Sample data</span> : null}
          {hidePause ? null : (
            <Tooltip content={paused ? "Resume updates" : "Pause updates"}>
              <Button variant="ghost" size="sm" className={styles.iconButton} aria-label={paused ? "Resume live updates" : "Pause live updates"} aria-pressed={paused} onClick={togglePaused} disabled={connecting}>
                {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
              </Button>
            </Tooltip>
          )}
        </div>
      </header>

      <VisitorMap visitors={shown.visitors} events={shown.events} reduced={reduced} hydrated={hydrated} />

      <div className={styles.lists}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Top pages</h3>
            <span className={styles.meta}>Visitors</span>
          </div>
          <PageList pages={shown.pages} max={maxPages} connecting={connecting} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Just now</h3>
            <span className={styles.meta}>Signups and upgrades</span>
          </div>
          <EventList events={shown.events} max={maxEvents} now={now} hydrated={hydrated} connecting={connecting} />
        </div>
      </div>
      <p className={styles.srOnly} aria-live="polite">{notice}</p>
    </section>
  );
}

/* Rolling number: each digit is a strip of 0 to 9 that slides to its value. Tabular numerals keep every column the same width. */
function RollingNumber({ value, reduced, grow = false }: { value: number; reduced: boolean; grow?: boolean }) {
  const text = Math.max(0, Math.round(value)).toLocaleString("en-US");
  const hydrated = useHydrated() && grow;
  const chars = text.split("");
  return (
    <span className={styles.rolling} aria-hidden="true" data-reduced={reduced ? "" : undefined}>
      {chars.map((char, i) => {
        const place = chars.length - i;
        return /\d/.test(char) ? <DigitColumn key={place} digit={Number(char)} enter={hydrated} /> : <span key={`s${place}`}>{char}</span>;
      })}
    </span>
  );
}

function DigitColumn({ digit, enter }: { digit: number; enter: boolean }) {
  // A column that mounts after the first paint (99 to 100) grows in; columns present on load never animate.
  const [grows] = useState(enter);
  return (
    <span className={styles.digit} data-enter={grows ? "" : undefined}>
      <span className={styles.digitSizer}>0</span>
      <span className={styles.digitWindow}>
        <span className={styles.digitStrip} style={{ transform: `translateY(${-digit * 10}%)` }}>
          {"0123456789".split("").map(d => <span key={d}>{d}</span>)}
        </span>
      </span>
    </span>
  );
}

function useFirstIds(ids: string[]) {
  const [first] = useState(() => new Set(ids));
  return first;
}

function VisitorMap({ visitors, events, reduced, hydrated }: { visitors: LiveVisitorPing[]; events: LiveVisitorEvent[]; reduced: boolean; hydrated: boolean }) {
  const land = useMemo(() => getLandPath(), []);
  const firstPings = useFirstIds(visitors.map(v => v.id));
  const firstEvents = useFirstIds(events.map(e => e.id));

  // The newest event with coordinates gets a small label for 2s, so a signup reads on the map and in the list at once.
  const latest = events[0];
  const candidate = latest && !firstEvents.has(latest.id) && latest.lat !== undefined && latest.lon !== undefined ? latest : null;
  const [expired, setExpired] = useState<string | null>(null);
  const candidateId = candidate?.id;
  useEffect(() => {
    if (!candidateId) return;
    const id = window.setTimeout(() => setExpired(candidateId), 2000);
    return () => window.clearTimeout(id);
  }, [candidateId]);
  const labelled = candidate && expired !== candidate.id ? candidate : null;

  const labelPos = labelled?.lat !== undefined && labelled.lon !== undefined ? project(labelled.lat, labelled.lon) : null;
  const labelAlign = labelPos ? (labelPos.x / VB_W > .8 ? "end" : labelPos.x / VB_W < .2 ? "start" : "center") : "center";

  return (
    <div className={styles.map} aria-hidden="true">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} className={styles.mapSvg}>
        <path d={land} className={styles.land} />
        <AnimatePresence initial={false}>
          {visitors.map(v => {
            const { x, y } = project(v.lat, v.lon);
            const event = v.kind === "event";
            const fresh = hydrated && !firstPings.has(v.id) && !reduced;
            return (
              <motion.g key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .4, ease } }}>
                {fresh ? <circle cx={x} cy={y} r={event ? 3.4 : 2.6} className={event ? styles.ringStrong : styles.ring} /> : null}
                <circle cx={x} cy={y} r={event ? 3.4 : 2.6} className={event ? styles.pingStrong : styles.ping} />
              </motion.g>
            );
          })}
        </AnimatePresence>
      </svg>
      <AnimatePresence>
        {labelled && labelPos ? (
          <motion.span
            key={labelled.id}
            className={styles.mapLabel}
            style={{ left: `${labelPos.x / VB_W * 100}%`, top: `${labelPos.y / VB_H * 100}%` } as CSSProperties}
            initial={{ opacity: 0, y: reduced ? 0 : 2 }}
            animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease } }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}
          >
            <span className={styles.mapLabelInner} data-align={labelAlign}>
              {labelled.flag ?? <Flag code={labelled.country} className={styles.flag} />}
              <span>{labelled.city}</span>
            </span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

const skeletonWidths = [88, 72, 60, 44, 36, 28];

function PageList({ pages, max, connecting }: { pages: LivePage[]; max: number; connecting: boolean }) {
  const ranked = useMemo(() => pages.map((p, i) => ({ ...p, i })).sort((a, b) => b.visitors - a.visitors || a.i - b.i), [pages]);
  const first = useFirstIds(ranked.slice(0, max + 1).map(p => p.path));
  const top = ranked[0]?.visitors || 1;
  const height = max * ROW - 4;

  if (connecting) return <Skeleton rows={max} height={height} bars />;
  if (!ranked.length) return <p className={styles.empty} style={{ height }}>No one is browsing right now</p>;

  // Render one row past the limit so a page leaving the top slides out below while the next slides in.
  const rows = ranked.slice(0, max + 1);
  const shownCount = Math.min(max, ranked.length);
  return (
    <ol className={styles.rows} style={{ height }} aria-label={`Top ${shownCount} pages by visitors`}>
      {rows.map((page, rank) => {
        const out = rank >= max;
        return (
          <li key={page.path} className={styles.pageRow} data-enter={first.has(page.path) ? undefined : ""} data-out={out ? "" : undefined} aria-hidden={out ? true : undefined}
            style={{ transform: `translateY(${rank * ROW}px)` }}>
            <span className={styles.bar} style={{ width: `${Math.max(4, page.visitors / top * 100)}%` }} aria-hidden="true" />
            <span className={styles.path} title={page.path}>{page.path}</span>
            <span className={styles.value}>
              <RollingNumber value={page.visitors} reduced={false} />
              <span className={styles.srOnly}>{page.visitors} visitors</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function EventList({ events, max, now, hydrated, connecting }: { events: LiveVisitorEvent[]; max: number; now: number; hydrated: boolean; connecting: boolean }) {
  const first = useFirstIds(events.map(e => e.id));
  const height = max * ROW - 4;
  if (connecting) return <Skeleton rows={max} height={height} />;
  if (!events.length) return <p className={styles.empty} style={{ height }}>Signups and upgrades show up here</p>;

  const rows = events.slice(0, max + 1);
  return (
    <ol className={styles.rows} style={{ height }} aria-label="Recent signups and upgrades">
      {rows.map((event, index) => {
        const out = index >= max;
        const country = hasFlag(event.country.toUpperCase()) ? countryNames[event.country.toUpperCase() as keyof typeof countryNames] : event.country;
        const time = hydrated && now ? ago(now, event.at) : "";
        return (
          <li key={event.id} className={styles.eventRow} data-enter={first.has(event.id) ? undefined : ""} data-out={out ? "" : undefined} aria-hidden={out ? true : undefined}
            style={{ transform: `translateY(${index * ROW}px)` }}>
            {event.flag ?? <Flag code={event.country} className={styles.flag} />}
            <span className={styles.eventText}>
              <span className={styles.eventLabel}>{event.label}</span>
              <span className={styles.eventPlace}>{event.city}</span>
            </span>
            <span className={styles.time} aria-hidden="true">{time}</span>
            <span className={styles.srOnly}>{`${event.label}, ${event.city}, ${country}${time ? `, ${spokenAgo(now, event.at)}` : ""}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Skeleton({ rows, height, bars = false }: { rows: number; height: number; bars?: boolean }) {
  return (
    <div className={styles.rows} style={{ height }} aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className={styles.skeletonRow} style={{ transform: `translateY(${i * ROW}px)` }}>
          {bars ? null : <span className={styles.skeletonFlag} />}
          <span className={styles.skeletonLine} style={{ width: `${skeletonWidths[i % skeletonWidths.length]}%` }} />
        </span>
      ))}
    </div>
  );
}

export default LiveVisitors;
