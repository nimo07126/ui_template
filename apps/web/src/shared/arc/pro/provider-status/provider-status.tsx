"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronDown, CircleAlert, RotateCw } from "lucide-react";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { SAMPLE_FAILING_STEP, SAMPLE_STEPS, sampleProviders } from "./provider-status-data";
import { DayTip, HealthIcon, HealthLabel, IncidentPanel, Swap, UptimeBar, dayHealth, ease, formatLatency, formatPct, healthLabel, lastDays, speakDay, uptimeOf } from "./provider-status-parts";
import type { ProviderDay, ProviderHealth, ProviderIncident, ProviderStatusItem } from "./provider-status-types";
import styles from "./provider-status.module.css";

export type { IncidentStage, IncidentUpdate, ProviderDay, ProviderHealth, ProviderIncident, ProviderStatusItem } from "./provider-status-types";
export { sampleProviders } from "./provider-status-data";
export { AnthropicMark, AwsMark, GeminiColorMark, MistralColorMark, OpenaiMark, XaiMark } from "./provider-status-marks";

export interface ProviderStatusProps {
  /** The providers to show. Leave it out to play the built in sample: six providers, a live incident story and simulated checks. */
  providers?: ProviderStatusItem[];
  /** Fetches fresh status. Return the new providers, or update the providers prop yourself and return nothing. Throw to show the error state. */
  onRefresh?: (signal: AbortSignal) => Promise<ProviderStatusItem[] | void>;
  /** Milliseconds between automatic checks. Null turns auto refresh off but keeps the refresh button. Defaults to 30000 (8000 in the sample). */
  refreshInterval?: number | null;
  /** Shows skeleton rows, for the first load. */
  loading?: boolean;
  /** An error to show in the header, such as a failed first load. Refresh errors thrown by onRefresh show on their own. */
  error?: string | null;
  /** Card title. Defaults to "AI providers". */
  title?: string;
  /** Which provider's incident is open. Pair with onExpandedChange. */
  expandedId?: string | null;
  defaultExpandedId?: string | null;
  onExpandedChange?: (id: string | null) => void;
  /** Called by the "Status page" link in an open incident. Without it, the link opens incident.url in a new tab. */
  onOpenIncident?: (provider: ProviderStatusItem, incident: ProviderIncident) => void;
  /** A quiet line under the list. Defaults to a sample data note in the sample. */
  footnote?: ReactNode;
  /** A one-off message for screen readers, such as the result of an action. */
  notice?: string;
  className?: string;
}

const MIN_CHECK = 450;
const RETRY_CAP = 10_000;

/**
 * A status card for the AI providers a product depends on. Each row shows the provider's mark, its health with an icon and
 * label, median latency and a 30 day uptime bar with a tooltip per day. A row with an incident expands into its updates,
 * and the card checks again on a visible countdown. With no props it plays a sample incident story on simulated checks.
 */
export function ProviderStatus(props: ProviderStatusProps) {
  if (props.providers === undefined) return <SampleProviderStatus {...props} />;
  return <ProviderStatusView {...props} providers={props.providers} />;
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

const severity: Record<ProviderHealth, number> = { operational: 0, degraded: 1, outage: 2 };
const isOpen = (incident?: ProviderIncident) => !!incident && incident.updates.length > 0 && !incident.updates.some(update => update.stage === "resolved");

/** The incident worth showing first: an open one on the worst provider, then any incident. */
function pickIncident(providers: ProviderStatusItem[]) {
  const open = providers.filter(provider => isOpen(provider.incident)).sort((a, b) => severity[b.status] - severity[a.status]);
  return open[0]?.id ?? providers.find(provider => provider.incident)?.id ?? null;
}

function SampleProviderStatus(props: ProviderStatusProps) {
  const [check, setCheck] = useState(0);
  const checkRef = useRef(0);
  const failedRef = useRef(-1);
  const providers = useMemo(() => sampleProviders(check), [check]);
  const [notice, setNotice] = useState("");

  // Until someone opens or closes a row, the open row follows the story: it stays on an incident until it leaves, then moves on.
  const [touched, setTouched] = useState(false);
  const [own, setOwn] = useState<string | null>(null);
  const [follow, setFollow] = useState<string | null>(() => pickIncident(providers));
  if (!providers.find(provider => provider.id === follow)?.incident) {
    const next = pickIncident(providers);
    if (next !== follow) setFollow(next);
  }

  const onRefresh = useCallback(async (signal: AbortSignal) => {
    await wait(650, signal);
    const next = checkRef.current + 1;
    if (next % SAMPLE_STEPS === SAMPLE_FAILING_STEP && failedRef.current !== next) {
      failedRef.current = next;
      throw new Error("Couldn’t reach the status feeds. Showing the last results.");
    }
    checkRef.current = next;
    setCheck(next);
  }, []);

  const { onExpandedChange } = props;
  const onExpanded = useCallback((id: string | null) => { setTouched(true); setOwn(id); onExpandedChange?.(id); }, [onExpandedChange]);
  const onOpenIncident = useCallback((provider: ProviderStatusItem) => setNotice(`Sample incident for ${provider.name}. Simulated, no status page was opened.`), []);

  return (
    <ProviderStatusView refreshInterval={8000} footnote="Sample data. Latency is the median over the last 5 minutes; uptime counts degraded time at 30%." onOpenIncident={onOpenIncident} notice={notice} {...props}
      providers={providers} onRefresh={props.onRefresh ?? onRefresh} simulated={!props.onRefresh}
      expandedId={props.expandedId !== undefined ? props.expandedId : touched ? own : follow} onExpandedChange={onExpanded} />
  );
}

type Phase = "idle" | "checking" | "error";
type Tip = { id: string; index: number; x: number; y: number; via: "pointer" | "keyboard"; open: boolean; width: number };

function summarize(list: ProviderStatusItem[]) {
  const outage = list.filter(provider => provider.status === "outage").length;
  const degraded = list.filter(provider => provider.status === "degraded").length;
  const worst: ProviderHealth = outage ? "outage" : degraded ? "degraded" : "operational";
  if (worst === "operational") return { worst, text: "All systems operational" };
  const parts = [outage ? `${outage} ${outage === 1 ? "outage" : "outages"}` : "", degraded ? `${degraded} degraded` : "", `${list.length - outage - degraded} operational`];
  return { worst, text: parts.filter(Boolean).join(" · ") };
}

function ProviderStatusView({
  providers, onRefresh, refreshInterval = 30_000, loading = false, error = null, title = "AI providers", expandedId: expandedProp, defaultExpandedId = null,
  onExpandedChange, onOpenIncident, footnote, notice, className, simulated = false,
}: ProviderStatusProps & { providers: ProviderStatusItem[]; simulated?: boolean }) {
  const reduced = useReducedMotion() ?? false;
  const baseId = useId();
  const rootRef = useRef<HTMLElement>(null);

  // Data: a refresh may return new providers; a new providers prop replaces them.
  const [fetched, setFetched] = useState<{ from: ProviderStatusItem[]; list: ProviderStatusItem[] } | null>(null);
  const list = fetched && fetched.from === providers ? fetched.list : providers;

  const [ownExpanded, setOwnExpanded] = useState<string | null>(defaultExpandedId);
  const expanded = expandedProp !== undefined ? expandedProp : ownExpanded;
  const toggle = (id: string) => {
    const next = expanded === id ? null : id;
    if (expandedProp === undefined) setOwnExpanded(next);
    onExpandedChange?.(next);
  };

  // Visibility: the countdown pauses off screen and in a background tab.
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry?.isIntersecting ?? true));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // Refresh: one check at a time, abortable, with a short floor so "Checking" never flashes.
  const [phase, setPhase] = useState<Phase>("idle");
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const [cycle, setCycle] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const providersRef = useRef(providers);
  useEffect(() => { providersRef.current = providers; }, [providers]);
  const canRefresh = !!onRefresh;
  const interval = refreshInterval;
  const cycleLength = phase === "error" && interval != null ? Math.min(interval, RETRY_CAP) : interval;

  const refresh = useCallback(async (manual = false) => {
    if (!onRefresh) return;
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setPhase("checking");
    const started = performance.now();
    try {
      const result = await onRefresh(ctrl.signal);
      const rest = MIN_CHECK - (performance.now() - started);
      if (rest > 0) await wait(rest, ctrl.signal);
      if (ctrl.signal.aborted) return;
      if (Array.isArray(result)) setFetched({ from: providersRef.current, list: result });
      setRefreshError(null);
      setPhase("idle");
      if (manual) setAnnounce(simulated ? "Checked every provider. Simulated, no requests were sent." : "Checked every provider.");
    } catch (reason) {
      if (ctrl.signal.aborted) return;
      const message = reason instanceof Error && reason.message ? reason.message : "Couldn’t refresh provider status.";
      setRefreshError(message);
      setPhase("error");
      setAnnounce(message);
    } finally {
      if (controller.current === ctrl) { controller.current = null; setCycle(value => value + 1); }
    }
  }, [onRefresh, simulated]);
  useEffect(() => () => controller.current?.abort(), []);

  // Countdown: counts only while the card is on screen and idle; the ring is a CSS animation paused in step with it.
  const active = canRefresh && cycleLength != null && onScreen && pageVisible && phase !== "checking" && !loading;
  const cycleKey = `${cycle}:${cycleLength}`;
  const [spent, setSpent] = useState({ key: cycleKey, ms: 0 });
  const spentMs = spent.key === cycleKey ? spent.ms : 0;
  const refreshRef = useRef(refresh);
  useEffect(() => { refreshRef.current = refresh; }, [refresh]);
  useEffect(() => {
    if (!active || cycleLength == null) return;
    let last = performance.now();
    let total = spentMs;
    let shown = Math.ceil((cycleLength - total) / 1000);
    const id = window.setInterval(() => {
      const now = performance.now();
      total += now - last;
      last = now;
      // Re-render only when the visible second changes; the ring animates on its own.
      const second = Math.ceil((cycleLength - total) / 1000);
      if (second !== shown) { shown = second; setSpent({ key: cycleKey, ms: total }); }
      if (total >= cycleLength) { window.clearInterval(id); void refreshRef.current(); }
    }, 100);
    return () => { window.clearInterval(id); setSpent(current => current.key === cycleKey ? { key: cycleKey, ms: total } : current); };
    // spentMs is read once when counting resumes; the interval owns it from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, cycleKey, cycleLength]);
  const remaining = cycleLength == null ? 0 : Math.max(0, cycleLength - spentMs);

  // Tooltip: one per card, positioned against the hovered bar.
  // Tooltip: one per card, positioned against the hovered bar. Hiding keeps the last day and place, so it only fades.
  const [tip, setTip] = useState<Tip | null>(null);
  const [tipText, setTipText] = useState("");
  const inspect = (id: string, days: ProviderDay[]) => (index: number | null, bar: HTMLElement, via: "pointer" | "keyboard") => {
    const root = rootRef.current;
    if (index == null || !root) { setTip(current => current && current.id === id && current.open ? { ...current, open: false } : current); return; }
    const rootRect = root.getBoundingClientRect(), barRect = bar.getBoundingClientRect();
    const gap = 2, count = days.length;
    const tick = (barRect.width - gap * (count - 1)) / count;
    setTip({ id, index, via, open: true, width: rootRect.width, x: barRect.left - rootRect.left + index * (tick + gap) + tick / 2, y: barRect.top - rootRect.top - 8 });
    if (via === "keyboard") setTipText(speakDay(days[index], index === count - 1));
  };

  const rows = useMemo(() => list.map(provider => ({ provider, days: lastDays(provider.days) })), [list]);
  const tipRow = tip ? rows.find(row => row.provider.id === tip.id) : undefined;
  const tipDay = tip && tipRow ? tipRow.days[tip.index] ?? null : null;
  const tipOpen = !!tip?.open && !!tipDay;

  const summary = summarize(list);
  // Automatic checks speak only when the overall picture changes, so a screen reader is not interrupted every few seconds.
  const [spoken, setSpoken] = useState(summary.text);
  if (spoken !== summary.text) {
    setSpoken(summary.text);
    setAnnounce(`${summary.text}.${simulated ? " Simulated, no requests were sent." : ""}`);
  }
  const shownError = refreshError ?? error;
  const SummaryIcon = shownError ? CircleAlert : HealthIcon[summary.worst];
  const summaryKey = loading ? "loading" : shownError ? `error:${shownError}` : `ok:${summary.text}`;
  const seconds = Math.max(1, Math.ceil(remaining / 1000));
  const empty = !loading && list.length === 0;

  const openIncident = (provider: ProviderStatusItem, incident: ProviderIncident) => {
    if (onOpenIncident) onOpenIncident(provider, incident);
    else if (incident.url) window.open(incident.url, "_blank", "noopener,noreferrer");
  };

  return (
    <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} aria-labelledby={`${baseId}-title`} aria-busy={loading || phase === "checking" || undefined}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={`${baseId}-title`} className={styles.title}>{title}</h3>
          <div className={styles.summary}>
            <AnimatePresence initial={false}>
              <motion.span key={summaryKey} className={styles.summaryItem} data-tone={shownError ? "error" : loading ? "loading" : summary.worst}
                initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>
                {loading ? <TextShimmer className={styles.summaryText}>Loading provider status</TextShimmer> : <>
                  <SummaryIcon className={styles.summaryIcon} aria-hidden="true" />
                  <span className={styles.summaryText}>{shownError ?? summary.text}</span>
                </>}
              </motion.span>
            </AnimatePresence>
          </div>
        </div>
        {canRefresh ? (
          <div className={styles.refresh}>
            <span className={styles.countdown} data-phase={phase}>
              <svg className={styles.ring} viewBox="0 0 16 16" aria-hidden="true" data-phase={phase}>
                <circle className={styles.ringTrack} cx="8" cy="8" r="6.25" />
                {cycleLength != null && phase !== "checking" ? (
                  <circle key={`${cycle}-${cycleLength}`} className={styles.ringFill} cx="8" cy="8" r="6.25" pathLength={100}
                    style={{ animationDuration: `${cycleLength}ms`, animationPlayState: active ? "running" : "paused" } as CSSProperties} />
                ) : null}
                {phase === "checking" ? <circle className={styles.ringSpin} cx="8" cy="8" r="6.25" pathLength={100} /> : null}
              </svg>
              <span className={styles.countdownText}>
                {phase === "checking" ? <TextShimmer className={styles.countdownLabel}>Checking</TextShimmer>
                  : loading ? <span className={styles.countdownLabel}>Waiting</span>
                  : cycleLength == null ? <span className={styles.countdownLabel}>{phase === "error" ? "Not updated" : "Up to date"}</span>
                  : <span className={styles.countdownLabel}>{phase === "error" ? "Retry" : "Refresh"} in <span className={styles.num}><span className={styles.numGhost} aria-hidden="true">{Math.max(1, Math.ceil(cycleLength / 1000))}s</span><span>{seconds}s</span></span></span>}
              </span>
            </span>
            <button type="button" className={styles.refreshButton} onClick={() => void refresh(true)} disabled={loading} aria-label={phase === "error" ? "Retry now" : "Refresh now"} data-phase={phase}>
              <RotateCw aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </header>

      {empty ? (
        <div className={styles.empty}>
          <span className={styles.emptyTitle}>No providers yet</span>
          <span className={styles.emptyText}>Add a provider to track its health, latency and uptime here.</span>
        </div>
      ) : (
        <>
          <div className={styles.columns} aria-hidden="true">
            <span className={styles.colName}>Provider</span>
            <span className={styles.colStatus}>Status</span>
            <span className={styles.colLatency}>p50</span>
            <span className={styles.colBar}>Last 30 days</span>
          </div>
          <ul className={styles.list} role="list">
            {loading ? Array.from({ length: Math.max(list.length, 6) }, (_, index) => (
              <li key={`skeleton-${index}`} className={styles.item} data-skeleton="">
                <div className={styles.line}>
                  <span className={`${styles.mark} ${styles.bone}`} />
                  <span className={styles.name}><span className={styles.bone} style={{ width: 88 + (index % 3) * 18 }} /><span className={styles.bone} style={{ width: 120 + (index % 2) * 24 }} /></span>
                  <span className={styles.status}><span className={styles.bone} style={{ width: 84 }} /></span>
                  <span className={styles.latency}><span className={styles.bone} style={{ width: 44 }} /></span>
                  <span className={`${styles.bar} ${styles.barBone}`}>{Array.from({ length: 30 }, (_, tick) => <span key={tick} className={styles.tick} data-health="none" />)}</span>
                  <span className={styles.pct}><span className={styles.bone} style={{ width: 40 }} /></span>
                  <span className={styles.chev} />
                </div>
              </li>
            )) : rows.map(({ provider, days }) => {
              const incident = provider.incident;
              const open = !!incident && expanded === provider.id;
              const panelId = `${baseId}-${provider.id}-incident`;
              const pct = formatPct(uptimeOf(days));
              return (
                <li key={provider.id} className={styles.item} data-open={open || undefined} data-interactive={incident ? "" : undefined} data-health={provider.status}>
                  <div className={styles.line}>
                    {incident ? (
                      <button type="button" className={styles.hit} aria-expanded={open} aria-controls={open ? panelId : undefined} onClick={() => toggle(provider.id)}
                        aria-label={`${provider.name}, ${healthLabel[provider.status]}. ${open ? "Hide" : "Show"} incident: ${incident.title}`} />
                    ) : null}
                    <span className={styles.mark} aria-hidden="true">{provider.mark}</span>
                    <span className={styles.name}>
                      <span className={styles.nameText}>{provider.name}</span>
                      <span className={styles.meta}>
                        {provider.detail ? <span className={styles.detail}>{provider.detail}</span> : null}
                      </span>
                    </span>
                    <span className={styles.status}><HealthLabel health={provider.status} reduced={reduced} /></span>
                    <span className={styles.latency} aria-label={`Median latency ${formatLatency(provider.latencyMs)}`}><Swap reduced={reduced} text={formatLatency(provider.latencyMs)} /></span>
                    <UptimeBar id={provider.id} name={provider.name} days={days} active={tipOpen && tip?.id === provider.id ? tip.index : null} onInspect={inspect(provider.id, days)} />
                    <span className={styles.pct}><Swap reduced={reduced} text={pct} /></span>
                    <span className={styles.chev} aria-hidden="true">{incident ? <ChevronDown /> : null}</span>
                  </div>
                  <AnimatePresence initial={false}>
                    {open && incident ? <IncidentPanel key={incident.id} id={panelId} incident={incident} reduced={reduced}
                      onOpen={onOpenIncident || incident.url ? () => openIncident(provider, incident) : undefined} /> : null}
                  </AnimatePresence>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {footnote ? <p className={styles.footnote}>{footnote}</p> : null}

      <DayTip day={tipDay} isLast={!!tipRow && tip?.index === tipRow.days.length - 1} open={tipOpen} x={tip?.x ?? 0} y={tip?.y ?? 0} boundary={tip?.width ?? 0} />
      <span className={styles.srOnly} aria-live="polite">{tipOpen && tip?.via === "keyboard" ? tipText : ""}</span>
      <span className={styles.srOnly} aria-live="polite">{notice || announce}</span>
    </section>
  );
}

export default ProviderStatus;

/** Exposed for tests and custom layouts. */
export { dayHealth };
