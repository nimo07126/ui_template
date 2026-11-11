"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Check, ChevronDown, CircleAlert, Lock, Search, X } from "lucide-react";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { connectorSamples, sampleFirstAttemptErrors } from "./connector-setup-data";
import type { Connector } from "./connector-setup-data";
import { ConnectorMark } from "./connector-setup-marks";
import styles from "./connector-setup.module.css";

export type { Connector } from "./connector-setup-data";
export type { ConnectorMarkId } from "./connector-setup-marks";
export { connectorSamples } from "./connector-setup-data";
export { ConnectorMark, connectorMarks } from "./connector-setup-marks";

/** The three steps of an OAuth handshake, in order. */
export type ConnectorPhase = "redirecting" | "authorizing" | "syncing";
export type ConnectorStatus = "available" | "connecting" | "connected" | "error";

/** What a finished connection reports back. Anything left out falls back to the connector's own fields. */
export interface ConnectResult {
  account?: string;
  scopes?: string[];
  /** Items pulled in by the first sync. */
  synced?: number;
}

export interface ConnectContext {
  /** Aborts when the person presses Cancel or the component unmounts. */
  signal: AbortSignal;
  /** Move the row to the next step, and optionally report sync progress. */
  report: (update: { phase?: ConnectorPhase; synced?: number }) => void;
}

export interface ConnectorSetupProps {
  /** The apps to list. Defaults to eight sample apps (Slack, GitHub, Notion, Google Drive, Linear, Jira, Salesforce, HubSpot). */
  connectors?: Connector[];
  /** Controlled list of connected ids. */
  connected?: string[];
  /** Ids connected on mount when uncontrolled. Defaults to GitHub and Google Drive for the samples, none otherwise. */
  defaultConnected?: string[];
  onConnectedChange?: (ids: string[]) => void;
  /** Runs the real OAuth flow. Report each phase as it happens; throw to show an error, return to finish. Simulated when omitted. */
  connect?: (connector: Connector, context: ConnectContext) => Promise<ConnectResult | void>;
  /** Revokes access. Simulated when omitted. */
  disconnect?: (connector: Connector, context: { signal: AbortSignal }) => Promise<void>;
  onConnect?: (connector: Connector, result: ConnectResult) => void;
  onDisconnect?: (connector: Connector) => void;
  /** Name of the assistant in copy and scopes. Defaults to "Claude". */
  assistantName?: string;
  title?: ReactNode;
  description?: ReactNode;
  /** Show the search field. Defaults to true. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Plays a short scripted run (connect Slack, then a Salesforce retry) once on screen. Defaults to true for the samples only. Stops at the first interaction. */
  autoPlay?: boolean;
  /** Footer line under the list. Pass null to hide it. */
  footer?: ReactNode;
  className?: string;
}

type Runtime =
  | { status: "connecting"; phase: ConnectorPhase; synced: number }
  | { status: "error"; message: string };

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const fmt = (value: number) => Math.round(value).toLocaleString("en-US");
const ease = [0.22, 1, 0.36, 1] as const;
const SIMULATED = "Simulated, nothing was sent.";

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const timer = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

/** Counts the sync up with an ease-out over `ms`, reporting every frame. */
function rollSync(total: number, ms: number, signal: AbortSignal, report: ConnectContext["report"]) {
  return new Promise<void>((resolve, reject) => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
      const t = Math.min(1, (now - start) / ms);
      report({ synced: Math.round(total * (1 - Math.pow(1 - t, 3))) });
      if (t < 1) frame = requestAnimationFrame(tick); else resolve();
    };
    frame = requestAnimationFrame(tick);
    signal.addEventListener("abort", () => { cancelAnimationFrame(frame); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
  });
}

function phaseProgress(phase: ConnectorPhase, synced: number, total: number) {
  if (phase === "redirecting") return .16;
  if (phase === "authorizing") return .4;
  return .4 + .6 * (total > 0 ? Math.min(1, synced / total) : .5);
}

/** A single crossfade between keyed contents stacked in one grid cell: the old one leaves in 100ms, the new one rises 2px in 160ms. */
function Swap({ swapKey, children, className, reduced }: { swapKey: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <SwapItem key={swapKey} reduced={reduced}>{children}</SwapItem>
    </AnimatePresence>
  </span>;
}

/** The leaving copy stops taking clicks and drops out of the accessibility tree the moment it starts to fade. */
function SwapItem({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const present = useIsPresent();
  return <motion.span className={styles.swapItem} data-leaving={present ? undefined : ""} aria-hidden={present ? undefined : true}
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
    animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease } }}
    exit={{ opacity: 0, y: 0, transition: { duration: reduced ? 0 : .1, ease } }}>{children}</motion.span>;
}

/** Tabular number whose width is reserved for its final value, so the words after it never move while it counts. */
function RollingNumber({ value, final }: { value: number; final: number }) {
  return <span className={styles.num}>
    <span className={styles.numGhost} aria-hidden="true">{fmt(final)}</span>
    <span className={styles.numLive}>{fmt(value)}</span>
  </span>;
}

/**
 * A "Connect your tools" card for an AI assistant. Each app connects inline through a short OAuth flow
 * (redirect, authorize, first sync) with a progress line, then shows the scopes it granted and a Disconnect option.
 */
export function ConnectorSetup({
  connectors: connectorsProp,
  connected: connectedProp,
  defaultConnected,
  onConnectedChange,
  connect,
  disconnect,
  onConnect,
  onDisconnect,
  assistantName = "Claude",
  title = "Connect your tools",
  description,
  searchable = true,
  searchPlaceholder = "Search apps",
  autoPlay,
  footer,
  className,
}: ConnectorSetupProps) {
  const isSample = connectorsProp === undefined;
  const connectors = connectorsProp ?? connectorSamples;
  const reduced = Boolean(useReducedMotion());
  const uid = useId();

  const [innerConnected, setInnerConnected] = useState<string[]>(() => defaultConnected ?? (isSample ? ["github", "google-drive"] : []));
  const connectedIds = connectedProp ?? innerConnected;
  const connectedRef = useRef(connectedIds);
  useEffect(() => { connectedRef.current = connectedIds; }, [connectedIds]);

  const [runtime, setRuntime] = useState<Record<string, Runtime | undefined>>({});
  const [results, setResults] = useState<Record<string, ConnectResult>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [announcement, setAnnouncement] = useState("");

  const controllers = useRef(new Map<string, AbortController>());
  const attempts = useRef(new Map<string, number>());
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { controllers.current.forEach(c => c.abort()); }, []);

  const setConnected = useCallback((next: string[]) => {
    connectedRef.current = next;
    if (connectedProp === undefined) setInnerConnected(next);
    onConnectedChange?.(next);
  }, [connectedProp, onConnectedChange]);

  const patch = useCallback((id: string, value: Runtime | undefined) => setRuntime(prev => ({ ...prev, [id]: value })), []);
  const announce = useCallback((text: string, simulated: boolean) => setAnnouncement(simulated ? `${text} ${SIMULATED}` : text), []);

  const simulateConnect = useCallback(async (connector: Connector, { signal, report }: ConnectContext): Promise<ConnectResult> => {
    const attempt = attempts.current.get(connector.id) ?? 1;
    await sleep(560, signal);
    report({ phase: "authorizing" });
    await sleep(680, signal);
    const scripted = isSample ? sampleFirstAttemptErrors[connector.id] : undefined;
    if (scripted && attempt === 1) throw new Error(scripted);
    report({ phase: "syncing", synced: 0 });
    const total = connector.sync?.count ?? 0;
    if (total > 0) await rollSync(total, 960, signal, report); else await sleep(640, signal);
    await sleep(180, signal);
    return { account: connector.account, scopes: connector.scopes, synced: total };
  }, [isSample]);

  const runConnect = useCallback(async (connector: Connector) => {
    controllers.current.get(connector.id)?.abort();
    const controller = new AbortController();
    controllers.current.set(connector.id, controller);
    attempts.current.set(connector.id, (attempts.current.get(connector.id) ?? 0) + 1);
    const simulated = !connect;
    patch(connector.id, { status: "connecting", phase: "redirecting", synced: 0 });
    announce(`Connecting ${connector.name}.`, simulated);
    const report: ConnectContext["report"] = update => {
      if (controller.signal.aborted) return;
      setRuntime(prev => {
        const current = prev[connector.id];
        if (!current || current.status !== "connecting") return prev;
        return { ...prev, [connector.id]: { status: "connecting", phase: update.phase ?? current.phase, synced: update.synced ?? current.synced } };
      });
    };
    try {
      const result = (await (connect ?? simulateConnect)(connector, { signal: controller.signal, report })) ?? {};
      if (controller.signal.aborted) return;
      const final: ConnectResult = { account: result.account ?? connector.account, scopes: result.scopes ?? connector.scopes, synced: result.synced ?? connector.sync?.count };
      setResults(prev => ({ ...prev, [connector.id]: final }));
      patch(connector.id, undefined);
      if (!connectedRef.current.includes(connector.id)) setConnected([...connectedRef.current, connector.id]);
      setConfirming(null);
      setOpen(connector.id);
      onConnect?.(connector, final);
      const synced = final.synced && connector.sync ? ` ${fmt(final.synced)} ${connector.sync.noun} synced.` : "";
      announce(`${connector.name} connected.${synced}`, simulated);
    } catch (error) {
      if (controller.signal.aborted) {
        patch(connector.id, undefined);
        announce(`${connector.name} connection cancelled.`, false);
        return;
      }
      const message = error instanceof Error && error.message ? error.message : `Could not connect ${connector.name}`;
      patch(connector.id, { status: "error", message });
      announce(`${connector.name} failed to connect: ${message}.`, simulated);
    } finally {
      if (controllers.current.get(connector.id) === controller) controllers.current.delete(connector.id);
    }
  }, [announce, connect, onConnect, patch, setConnected, simulateConnect]);

  const cancelConnect = useCallback((connector: Connector) => { controllers.current.get(connector.id)?.abort(); }, []);

  const runDisconnect = useCallback(async (connector: Connector) => {
    const controller = new AbortController();
    controllers.current.set(connector.id, controller);
    setDisconnecting(connector.id);
    try {
      if (disconnect) await disconnect(connector, { signal: controller.signal }); else await sleep(420, controller.signal);
      setConnected(connectedRef.current.filter(id => id !== connector.id));
      setResults(prev => { const next = { ...prev }; delete next[connector.id]; return next; });
      setOpen(current => current === connector.id ? null : current);
      setConfirming(null);
      onDisconnect?.(connector);
      announce(`${connector.name} disconnected. ${assistantName} no longer has access.`, !disconnect);
    } catch (error) {
      if (!controller.signal.aborted) announce(`Could not disconnect ${connector.name}. ${error instanceof Error ? error.message : ""}`.trim(), !disconnect);
    } finally {
      setDisconnecting(null);
      if (controllers.current.get(connector.id) === controller) controllers.current.delete(connector.id);
    }
  }, [announce, assistantName, disconnect, onDisconnect, setConnected]);

  const statusOf = (id: string): ConnectorStatus => {
    const r = runtime[id];
    if (r) return r.status;
    return connectedIds.includes(id) ? "connected" : "available";
  };

  /* Scripted first run for the samples: connect Slack, then show a Salesforce failure and its retry. Any interaction hands control over. */
  const play = autoPlay ?? (isSample && !connect);
  const scriptRef = useRef({ stopped: false });
  useEffect(() => {
    const root = rootRef.current;
    if (!play || !root) return;
    const script = scriptRef.current;
    script.stopped = false;
    const stop = () => { script.stopped = true; };
    root.addEventListener("pointerdown", stop);
    root.addEventListener("keydown", stop);
    const controller = new AbortController();
    const byId = (id: string) => connectors.find(c => c.id === id);
    let started = false;
    const run = async () => {
      const slack = byId("slack"), salesforce = byId("salesforce");
      try {
        await sleep(600, controller.signal);
        if (script.stopped || !slack || connectedRef.current.includes("slack")) return;
        await runConnect(slack);
        await sleep(2600, controller.signal);
        if (script.stopped || !salesforce || connectedRef.current.includes("salesforce")) return;
        setOpen(null);
        await sleep(240, controller.signal);
        if (script.stopped) return;
        await runConnect(salesforce);
        await sleep(1500, controller.signal);
        if (script.stopped) return;
        await runConnect(salesforce);
      } catch { /* aborted on unmount */ }
    };
    const observer = new IntersectionObserver(entries => {
      if (started || !entries.some(e => e.isIntersecting)) return;
      started = true;
      observer.disconnect();
      void run();
    }, { threshold: .35 });
    observer.observe(root);
    return () => { observer.disconnect(); controller.abort(); root.removeEventListener("pointerdown", stop); root.removeEventListener("keydown", stop); };
    // The script runs once per mount; later prop changes must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play]);

  const normalized = query.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!normalized) return connectors;
    return connectors.filter(c => [c.name, c.description, c.account ?? "", ...(c.keywords ?? [])].some(text => text.toLowerCase().includes(normalized)));
  }, [connectors, normalized]);

  const connectedCount = connectors.filter(c => connectedIds.includes(c.id)).length;
  const heightTransition: Transition = reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .24, bounce: 0 }, opacity: { duration: .16, ease } };
  const footerContent = footer === undefined ? <><Lock size={14} strokeWidth={1.75} aria-hidden="true" /><span>{assistantName} only sees what you grant.</span></> : footer;

  return <div ref={rootRef} className={cx(styles.root, className)} role="group" aria-labelledby={`${uid}-title`}>
    <div className={styles.header}>
      <div className={styles.headText}>
        <h3 id={`${uid}-title`} className={styles.title}>{title}</h3>
        <p className={styles.description}>{description ?? `Let ${assistantName} search and act in the apps your team uses.`}</p>
      </div>
      <span className={styles.count}>
        <span className={styles.srOnly}>{connectedCount} of {connectors.length} connected</span>
        <span className={styles.countVisual} aria-hidden="true">
          <Swap swapKey={String(connectedCount)} reduced={reduced} className={styles.countNum}>{connectedCount}</Swap>
          <span>of {connectors.length} connected</span>
        </span>
      </span>
    </div>

    {searchable ? <div className={styles.search}>
      <Search className={styles.searchIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
      <input ref={searchRef} className={styles.searchInput} type="search" value={query} placeholder={searchPlaceholder} aria-label="Search apps" aria-controls={`${uid}-list`}
        autoComplete="off" spellCheck={false} onChange={e => setQuery(e.target.value)}
        onKeyDown={e => { if (e.key === "Escape" && query) { e.preventDefault(); setQuery(""); } }} />
      <AnimatePresence initial={false}>
        {query ? <motion.button key="clear" type="button" className={styles.clear} aria-label="Clear search"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .12 }}
          onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={16} strokeWidth={1.75} aria-hidden="true" /></motion.button> : null}
      </AnimatePresence>
    </div> : null}

    {visible.length ? <ul id={`${uid}-list`} className={styles.list} aria-label="Apps">
      {visible.map(connector => {
        const status = statusOf(connector.id);
        const r = runtime[connector.id];
        const result = results[connector.id];
        const isOpen = status === "connected" && open === connector.id;
        const total = connector.sync?.count ?? 0;
        const detailsId = `${uid}-${connector.id}-details`;
        const account = result?.account ?? connector.account;
        const syncedTotal = result?.synced ?? total;

        let lineKey: string = status;
        let line: ReactNode = connector.description;
        if (r?.status === "connecting") {
          lineKey = r.phase;
          if (r.phase === "redirecting") line = <TextShimmer>{`Redirecting to ${connector.host ?? connector.name}`}</TextShimmer>;
          else if (r.phase === "authorizing") line = <TextShimmer>{`Authorizing ${account ?? connector.name}`}</TextShimmer>;
          else line = connector.sync
            ? <span className={styles.syncLine}>Syncing <RollingNumber value={r.synced} final={total} /> {connector.sync.noun}</span>
            : <TextShimmer>Syncing</TextShimmer>;
        } else if (r?.status === "error") {
          lineKey = `error-${r.message}`;
          line = <span className={styles.errorLine}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.ellipsis}>{r.message}</span></span>;
        } else if (status === "connected") {
          line = [account, connector.sync && syncedTotal ? `${fmt(syncedTotal)} ${connector.sync.noun}` : null].filter(Boolean).join(" · ") || connector.description;
        }

        const action = status === "available"
          ? <Button size="sm" variant="secondary" className={cx(styles.action, styles.connect)} onClick={() => void runConnect(connector)} aria-label={`Connect ${connector.name}`}>Connect</Button>
          : status === "connecting"
          ? <Button size="sm" variant="ghost" className={styles.action} onClick={() => cancelConnect(connector)} aria-label={`Cancel connecting ${connector.name}`}>Cancel</Button>
          : status === "error"
          ? <Button size="sm" variant="secondary" className={cx(styles.action, styles.connect)} onClick={() => void runConnect(connector)} aria-label={`Retry connecting ${connector.name}`}>Retry</Button>
          : <Button size="sm" variant="ghost" className={cx(styles.action, styles.connectedBtn)} aria-expanded={isOpen} aria-controls={detailsId}
              aria-label={`${connector.name} connected. ${isOpen ? "Hide" : "Show"} access details`}
              onClick={() => { setConfirming(null); setOpen(isOpen ? null : connector.id); }}>
              <Check className={styles.ok} size={16} strokeWidth={2} aria-hidden="true" />
              <span className={styles.connectedLabel}>Connected</span>
              <ChevronDown className={styles.chevron} data-open={isOpen || undefined} size={16} strokeWidth={1.75} aria-hidden="true" />
            </Button>;

        const confirmingThis = confirming === connector.id;
        return <li key={connector.id} className={styles.row} data-status={status} data-active={(status === "connecting" || isOpen) || undefined}>
          <div className={styles.rowMain}>
            <span className={styles.mark} data-mark={typeof connector.mark === "string" ? connector.mark : undefined}><ConnectorMark mark={connector.mark} /></span>
            <span className={styles.text}>
              <span className={styles.name}>{connector.name}</span>
              <Swap swapKey={lineKey} reduced={reduced} className={cx(styles.line, status === "connecting" && styles.lineLive, status === "error" && styles.lineError)}>
                {typeof line === "string" ? <span className={styles.ellipsis}>{line}</span> : line}
              </Swap>
            </span>
            <span className={styles.actionSlot}><Swap swapKey={status} reduced={reduced} className={styles.actionSwap}>{action}</Swap></span>
          </div>

          <AnimatePresence initial={false}>
            {r?.status === "connecting" ? <motion.span key="progress" className={styles.track} aria-hidden="true"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .2, delay: reduced ? 0 : .08 } }} transition={{ duration: reduced ? 0 : .16 }}>
              <motion.span className={styles.fill} initial={{ scaleX: 0 }} animate={{ scaleX: phaseProgress(r.phase, r.synced, total) }}
                transition={reduced ? { duration: 0 } : r.phase === "syncing" ? { duration: .12, ease: "linear" } : { duration: .24, ease }} />
            </motion.span> : null}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {isOpen ? <motion.div key="details" id={detailsId} className={styles.detailsClip} role="region" aria-label={`${connector.name} access`}
              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={heightTransition}>
              <div className={styles.details}>
                <span className={styles.detailsLabel}>{assistantName} can</span>
                <ul className={styles.scopes}>
                  {(result?.scopes ?? connector.scopes ?? []).map(scope => <li key={scope} className={styles.scope}>
                    <Check size={16} strokeWidth={1.75} aria-hidden="true" /><span className={styles.scopeText}>{scope}</span>
                  </li>)}
                </ul>
                <div className={styles.detailsFoot}>
                  <Swap swapKey={confirmingThis ? "confirm" : "idle"} reduced={reduced} className={styles.footSwap}>
                    {confirmingThis
                      ? <span className={styles.footRow} onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); setConfirming(null); } }}>
                          <span className={cx(styles.footText, styles.confirmText, styles.ellipsis)}>Remove access?</span>
                          <span className={styles.footActions}>
                            <Button size="sm" variant="ghost" className={cx(styles.action, styles.keep)} onClick={() => setConfirming(null)} disabled={disconnecting === connector.id}>Keep</Button>
                            <Button size="sm" variant="danger" className={styles.action} aria-label={`Disconnect ${connector.name} and remove ${assistantName}'s access`} loading={disconnecting === connector.id} onClick={() => void runDisconnect(connector)} autoFocus>Disconnect</Button>
                          </span>
                        </span>
                      : <span className={styles.footRow}>
                          <span className={cx(styles.footText, styles.ellipsis)}>{result ? "Synced just now" : "Synced 12 min ago"}</span>
                          <span className={styles.footActions}>
                            <Button size="sm" variant="secondary" className={styles.action} onClick={() => setConfirming(connector.id)}>Disconnect</Button>
                          </span>
                        </span>}
                  </Swap>
                </div>
              </div>
            </motion.div> : null}
          </AnimatePresence>
        </li>;
      })}
    </ul> : <div id={`${uid}-list`} className={styles.empty}>
      <p className={styles.emptyTitle}>No apps match “{query.trim()}”</p>
      <p className={styles.emptyCopy}>Try a product name or a category like crm or docs.</p>
      <Button size="sm" variant="secondary" className={styles.action} onClick={() => { setQuery(""); searchRef.current?.focus(); }}>Clear search</Button>
    </div>}

    {footerContent ? <div className={styles.footer}>{footerContent}</div> : null}
    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </div>;
}

export default ConnectorSetup;
