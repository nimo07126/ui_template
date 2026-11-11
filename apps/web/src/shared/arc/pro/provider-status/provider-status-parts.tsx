"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRight, CircleCheck, CircleX, TriangleAlert } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import type { IncidentStage, IncidentUpdate, ProviderDay, ProviderHealth, ProviderIncident } from "./provider-status-types";
import styles from "./provider-status.module.css";

export const ease = [...motionTokens.ease.standard] as [number, number, number, number];
export const sizeSpring = { type: "spring", visualDuration: .24, bounce: 0 } as const;

export const healthLabel: Record<ProviderHealth, string> = { operational: "Operational", degraded: "Degraded", outage: "Outage" };
export const HealthIcon = { operational: CircleCheck, degraded: TriangleAlert, outage: CircleX } as const;
const stageLabel: Record<IncidentStage, string> = { investigating: "Investigating", identified: "Identified", monitoring: "Monitoring", resolved: "Resolved" };

const dayFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "UTC" });

export function dayHealth(day: ProviderDay): ProviderHealth | null {
  if (day.status) return day.status;
  if (day.uptime == null) return null;
  return day.uptime < 99 ? "outage" : day.uptime < 99.9 ? "degraded" : "operational";
}

export function formatLatency(ms: number | null | undefined) {
  if (ms == null || !Number.isFinite(ms)) return "–";
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`;
}

export function uptimeOf(days: ProviderDay[]) {
  const known = days.filter(day => day.uptime != null);
  if (!known.length) return null;
  return known.reduce((sum, day) => sum + (day.uptime ?? 0), 0) / known.length;
}

export const formatPct = (value: number | null) => value == null ? "–" : `${value >= 99.995 ? "100" : value.toFixed(2)}%`;

export function formatDay(day: ProviderDay, isLast: boolean) {
  if (isLast) return "Today";
  if (!day.date) return "No data";
  const date = new Date(`${day.date}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? day.date : dayFormat.format(date);
}

export function formatAt(at: IncidentUpdate["at"]) {
  if (typeof at === "string") return at;
  const date = at instanceof Date ? at : new Date(at);
  return Number.isNaN(date.getTime()) ? "" : `${timeFormat.format(date)} UTC`;
}

/** A single crossfade for text that changes in place. Every version shares one grid cell, so nothing reflows. */
export function Swap({ text, reduced, className }: { text: string; reduced: boolean; className?: string }) {
  return (
    <span className={[styles.swap, className].filter(Boolean).join(" ")}>
      <AnimatePresence initial={false}>
        <motion.span key={text} className={styles.swapItem}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>{text}</motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Icon and label for a health state. Both crossfade together when the state changes. */
export function HealthLabel({ health, reduced }: { health: ProviderHealth; reduced: boolean }) {
  const Icon = HealthIcon[health];
  return (
    <span className={styles.swap}>
      <AnimatePresence initial={false}>
        <motion.span key={health} className={styles.health} data-health={health}
          initial={{ opacity: 0, y: reduced ? 0 : 2 }}
          animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease } }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>
          <Icon className={styles.healthIcon} aria-hidden="true" />
          <span className={styles.healthText}>{healthLabel[health]}</span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Pads the history to 30 days, oldest first, so every bar has the same ticks. */
export function lastDays(days: ProviderDay[] | undefined, count = 30): ProviderDay[] {
  const list = (days ?? []).slice(-count);
  const pad = Array.from({ length: count - list.length }, () => ({ date: "", uptime: null }));
  return [...pad, ...list];
}

export interface UptimeBarProps {
  id: string;
  name: string;
  days: ProviderDay[];
  active: number | null;
  onInspect: (index: number | null, bar: HTMLElement, via: "pointer" | "keyboard") => void;
}

/** Thirty small ticks, one per day. One shared tooltip, owned by the card, follows the pointer or the arrow keys. */
export function UptimeBar({ name, days, active, onInspect }: UptimeBarProps) {
  const count = days.length;
  const pct = formatPct(uptimeOf(days));
  const outages = days.filter(day => dayHealth(day) === "outage").length;
  const degraded = days.filter(day => dayHealth(day) === "degraded").length;
  const summary = [outages ? `${outages} ${outages === 1 ? "day" : "days"} with an outage` : "", degraded ? `${degraded} degraded` : ""].filter(Boolean).join(", ") || "no incidents";

  const indexAt = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width - 1);
    return Math.min(count - 1, Math.floor((x / rect.width) * count));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = active ?? count - 1;
    let next: number | null = current;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(0, current - 1);
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(count - 1, current + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === "Escape" && active != null) next = null;
    else return;
    event.preventDefault();
    onInspect(next, event.currentTarget, "keyboard");
  };

  return (
    <div className={styles.bar} tabIndex={0} role="group" data-scrub={active != null || undefined}
      aria-label={`${name} uptime over the last 30 days: ${pct}, ${summary}. Use the arrow keys to inspect each day.`}
      onPointerMove={event => { if (event.pointerType === "mouse" || event.buttons) onInspect(indexAt(event), event.currentTarget, "pointer"); }}
      onPointerDown={event => onInspect(indexAt(event), event.currentTarget, "pointer")}
      onPointerLeave={event => { if (event.pointerType === "mouse") onInspect(null, event.currentTarget, "pointer"); }}
      onFocus={event => { if (event.currentTarget.matches(":focus-visible")) onInspect(count - 1, event.currentTarget, "keyboard"); }}
      onBlur={event => onInspect(null, event.currentTarget, "keyboard")}
      onKeyDown={onKeyDown}>
      {days.map((day, index) => (
        <span key={day.date || `pad-${index}`} className={styles.tick} data-health={dayHealth(day) ?? "none"} data-active={index === active || undefined} />
      ))}
    </div>
  );
}

/** The shared day tooltip. It stays mounted, so showing it never flashes; it moves instantly and only fades in and out. */
export function DayTip({ day, isLast, open, x, y, boundary }: { day: ProviderDay | null; isLast: boolean; open: boolean; x: number; y: number; boundary: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const width = node.offsetWidth;
    const left = Math.min(Math.max(x - width / 2, 8), Math.max(8, boundary - width - 8));
    node.style.transform = `translate(${Math.round(left)}px, ${Math.round(y)}px) translateY(-100%)`;
  }, [x, y, boundary, day, isLast]);
  const health = day ? dayHealth(day) : null;
  const Icon = health ? HealthIcon[health] : null;
  return (
    <div ref={ref} className={styles.tip} data-open={open || undefined} aria-hidden="true">
      {day ? <>
        <span className={styles.tipHead}>
          <span className={styles.tipDate}>{formatDay(day, isLast)}</span>
          <span className={styles.tipPct}>{day.uptime == null ? "No data" : formatPct(day.uptime)}</span>
        </span>
        <span className={styles.tipBody}>
          {Icon && health ? <span className={styles.health} data-health={health}><Icon className={styles.healthIcon} aria-hidden="true" /><span className={styles.healthText}>{health === "operational" ? "No incidents" : healthLabel[health]}</span></span> : <span className={styles.tipNote}>No checks recorded</span>}
          {day.note ? <span className={styles.tipNote}>{day.note}</span> : null}
        </span>
      </> : null}
    </div>
  );
}

/** Spoken text for a day, for the live region while the arrow keys move along the bar. */
export function speakDay(day: ProviderDay, isLast: boolean) {
  const health = dayHealth(day);
  const parts = [formatDay(day, isLast), day.uptime == null ? "no data" : `${formatPct(day.uptime)} uptime`];
  if (health && health !== "operational") parts.push(healthLabel[health]);
  if (day.note) parts.push(day.note);
  return parts.join(", ");
}

/** The incident's updates, newest first. Height follows the measured content, so new updates grow the panel smoothly. */
export function IncidentPanel({ id, incident, reduced, onOpen }: { id: string; incident: ProviderIncident; reduced: boolean; onOpen?: () => void }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    setHeight(node.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const updates = [...incident.updates].map((update, order) => ({ ...update, order }));
  updates.sort((a, b) => {
    const ta = typeof a.at === "string" ? NaN : +new Date(a.at), tb = typeof b.at === "string" ? NaN : +new Date(b.at);
    return Number.isFinite(ta) && Number.isFinite(tb) ? tb - ta : b.order - a.order;
  });
  const first = incident.updates[0];
  const latest = updates[0];
  const resolved = latest?.stage === "resolved";
  const span = reduced ? { duration: 0 } : sizeSpring;

  return (
    <motion.div id={id} className={styles.panel} role="region" aria-label={incident.title}
      initial={{ height: 0, opacity: 0 }}
      animate={{ height, opacity: 1, transition: { height: span, opacity: { duration: reduced ? 0 : .16, ease } } }}
      exit={{ height: 0, opacity: 0, transition: { height: span, opacity: { duration: reduced ? 0 : .1, ease } } }}>
      <div ref={inner} className={styles.panelInner}>
        <div className={styles.panelHead}>
          <div className={styles.panelTitleWrap}>
            <span className={styles.panelTitle}>{incident.title}</span>
            <Swap reduced={reduced} className={styles.panelMeta} text={[first ? `Started ${formatAt(first.at)}` : "", latest && latest !== updates[updates.length - 1] ? `${resolved ? "Resolved" : "Updated"} ${formatAt(latest.at)}` : ""].filter(Boolean).join(" · ")} />
          </div>
        </div>
        {onOpen ? <Button variant="ghost" size="sm" className={styles.panelLink} onClick={onOpen}>Status page<ArrowUpRight aria-hidden="true" /></Button> : null}
        <ol className={styles.updates}>
          <AnimatePresence initial={false}>
            {updates.map((update, index) => (
              <motion.li key={`${update.stage}-${update.order}`} className={styles.update} data-latest={index === 0 || undefined} data-stage={update.stage}
                initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : .16, ease, delay: reduced ? 0 : .06 } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1 } }}>
                <span className={styles.updateDot} aria-hidden="true" />
                <span className={styles.updateHead}>
                  <span className={styles.updateStage}>{stageLabel[update.stage]}</span>
                  <span className={styles.updateTime}>{formatAt(update.at)}</span>
                </span>
                <span className={styles.updateText}>{update.message}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </motion.div>
  );
}
