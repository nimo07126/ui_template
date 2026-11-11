"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ChevronDown, CircleAlert, CircleDashed, RotateCcw, Square } from "lucide-react";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { ProviderMark } from "./generation-stats-marks";
import { useGenerationSimulation } from "./generation-stats-sim";
import type { GenerationModel, GenerationPricing, GenerationStatus, GenerationUsage } from "./generation-stats-data";
import styles from "./generation-stats.module.css";

export type { GenerationModel, GenerationPricing, GenerationProvider, GenerationSampleRun, GenerationStatus, GenerationUsage } from "./generation-stats-data";
export { generationSampleRuns } from "./generation-stats-data";
export { useGenerationSimulation } from "./generation-stats-sim";
export type { GenerationFrame, GenerationSimulationOptions } from "./generation-stats-sim";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const DASH = "–";
const SIM_NOTE = "Simulated run with sample rates. Nothing was sent.";
const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** 0ms to 999ms, then 1.42s, 12.4s, 1m 12s. */
export function formatLatency(ms: number) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  if (ms < 10000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
/** Four decimals under $10, so a live cost keeps one width while it counts. */
export function formatCost(usd: number) {
  return `$${usd < 10 ? usd.toFixed(4) : usd.toFixed(2)}`;
}
const formatTokens = (count: number) => integer.format(Math.round(count));
const formatSpeed = (tps: number) => tps < 10 ? tps.toFixed(1) : integer.format(Math.round(tps));
const formatRate = (perMillion: number) => `$${perMillion < 1 ? perMillion.toFixed(3).replace(/0$/, "") : perMillion.toFixed(2)}/M`;

/** Prompt cost from uncached and cached input, plus output and reasoning at the output rate. */
export function generationCost(usage: GenerationUsage, pricing: GenerationPricing) {
  const cached = Math.min(usage.cachedTokens ?? 0, usage.inputTokens ?? 0);
  const fresh = (usage.inputTokens ?? 0) - cached;
  const out = (usage.outputTokens ?? 0) + (usage.reasoningTokens ?? 0);
  return (fresh * pricing.input + cached * (pricing.cachedInput ?? pricing.input) + out * pricing.output) / 1e6;
}

const panelTransition = (reduced: boolean): Transition => reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .26, bounce: 0 }, opacity: { duration: .16, ease: [.22, 1, .36, 1] } };
const swapTransition = (reduced: boolean): Transition => ({ duration: reduced ? 0 : .14, ease: [.22, 1, .36, 1] });

/** A clock for live latency: ticks every animation frame (capped near 60fps) only while `running`. */
function useNow(running: boolean) {
  const [now, setNow] = useState<number | undefined>(undefined);
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return running ? now : undefined;
}

/**
 * A number that glides toward each new value in reserved tabular width. Counting up eases in about 100ms per step, so
 * chunks of tokens read as a smooth count; a drop (a new request) cuts straight to the new value.
 */
function Num({ value, format, reduced }: { value?: number; format: (n: number) => string; reduced: boolean }) {
  const [shown, setShown] = useState(value);
  const current = useRef(value);
  const formatRef = useRef(format);
  useEffect(() => { formatRef.current = format; });
  useEffect(() => {
    if (value === undefined || current.current === undefined || reduced || value < current.current) {
      current.current = value;
      setShown(value);
      return;
    }
    let raf = 0, last = performance.now();
    const step = (time: number) => {
      const from = current.current ?? value;
      let next = from + (value - from) * (1 - Math.exp(-(time - last) / 90));
      last = time;
      if (formatRef.current(next) === formatRef.current(value)) next = value;
      current.current = next;
      setShown(next);
      if (next !== value) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced]);
  return <span className={styles.num}>{shown === undefined ? DASH : format(shown)}</span>;
}

/** Keeps the whole run's shape: past 48 readings, neighbours merge in pairs. */
const compress = (points: number[]) => points.length <= 48 ? points : points.reduce<number[]>((out, point, index) => index % 2 ? (out[out.length - 1] = (out[out.length - 1] + point) / 2, out) : [...out, point], []);

/** Reads output speed every 160ms while streaming, smoothed, for the sparkline. Clears when a new request starts. */
function useSpeedSeries(status: GenerationStatus, outputTokens: number | undefined, reset: unknown) {
  const [series, setSeries] = useState<number[]>([]);
  const [seen, setSeen] = useState({ status, reset });
  const tokens = useRef(outputTokens ?? 0);
  useEffect(() => { tokens.current = outputTokens ?? 0; }, [outputTokens]);
  if (seen.status !== status || seen.reset !== reset) {
    setSeen({ status, reset });
    if (status === "waiting" || status === "idle" || seen.reset !== reset) setSeries([]);
  }
  useEffect(() => {
    if (status !== "streaming") return;
    let lastTime = performance.now(), lastTokens = tokens.current;
    let ema: number | undefined;
    const id = window.setInterval(() => {
      const time = performance.now(), count = tokens.current;
      const rate = (count - lastTokens) / ((time - lastTime) / 1000);
      lastTime = time; lastTokens = count;
      ema = ema === undefined ? rate : ema + .45 * (rate - ema);
      const reading = Math.max(0, ema);
      setSeries(points => compress([...points, reading]));
    }, 160);
    return () => window.clearInterval(id);
  }, [status]);
  return series;
}

function Sparkline({ points, live }: { points: number[]; live: boolean }) {
  const width = 56, height = 20, pad = 2.5;
  const max = Math.max(1, ...points) * 1.1;
  const span = Math.max(points.length - 1, 23);
  const coords = points.map((point, index) => [pad + (index / span) * (width - pad * 2), height - pad - (point / max) * (height - pad * 2)] as const);
  const d = coords.map(([x, y], index) => `${index ? "L" : "M"}${x.toFixed(2)} ${y.toFixed(2)}`).join("");
  const end = coords[coords.length - 1];
  return <svg className={styles.spark} width={width} height={height} viewBox={`0 0 ${width} ${height}`} fill="none" aria-hidden="true">
    <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} className={styles.sparkBase} />
    {coords.length > 1 ? <path d={d} className={styles.sparkLine} /> : null}
    {end ? <circle cx={end[0]} cy={end[1]} r={2} className={styles.sparkDot} data-live={live || undefined} /> : null}
  </svg>;
}

function Spinner() {
  return <svg className={styles.spinner} width={14} height={14} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="2" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>;
}

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return <svg width={14} height={14} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M3.25 8.5 6.5 11.75 12.75 4.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .28, ease: [.22, 1, .36, 1], delay: .04 }} />
  </svg>;
}

function statusText(status: GenerationStatus, total?: number) {
  if (status === "idle") return "Not started";
  if (status === "waiting") return "Waiting";
  if (status === "streaming") return "Streaming";
  if (status === "done") return total !== undefined ? `Done in ${formatLatency(total)}` : "Done";
  if (status === "stopped") return total !== undefined ? `Stopped at ${formatLatency(total)}` : "Stopped";
  return "Failed";
}

function StatusIcon({ status, reduced }: { status: GenerationStatus; reduced: boolean }) {
  if (status === "waiting" || status === "streaming") return <Spinner />;
  if (status === "done") return <DrawnCheck reduced={reduced} />;
  if (status === "error") return <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />;
  if (status === "stopped") return <Square size={12} strokeWidth={2.25} aria-hidden="true" />;
  return <CircleDashed size={14} strokeWidth={2} aria-hidden="true" />;
}

export interface GenerationStatsProps {
  /** The model that answered. Leave `status` unset for the self-playing preview. */
  model?: GenerationModel;
  /** Where the response is. Without it the component plays sample runs on its own. */
  status?: GenerationStatus;
  /** Epoch ms when the request was sent. Drives the live time to first token and total latency. */
  startedAt?: number;
  /** Token counts and timings. Update outputTokens as chunks arrive; speed and cost follow. */
  usage?: GenerationUsage;
  /** USD per million tokens. Without it, cost shows only when usage.costUsd is set. */
  pricing?: GenerationPricing;
  /** Speed readings in tokens per second, oldest first. Defaults to readings taken while outputTokens grows. */
  speedSamples?: number[];
  /** Shown with status "error". */
  error?: string;
  /** "card" for dev panels, "inline" for one quiet line under a chat message. */
  variant?: "card" | "inline";
  /** Controls the breakdown. Pair with onExpandedChange. */
  expanded?: boolean;
  defaultExpanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  /** Adds a Retry button to a failed response. */
  onRetry?: () => void;
  /** A footnote under the breakdown, for example where the rates come from. */
  note?: ReactNode;
  className?: string;
}

/**
 * A live stats strip for a streaming LLM response: time to first token, speed with a sparkline, output tokens and cost,
 * next to the model's mark. It counts up while the response streams, settles when it ends, and opens into a breakdown
 * of latency and token costs. With no props it plays sample runs.
 */
export function GenerationStats({ model: modelProp, status: statusProp, startedAt: startedAtProp, usage: usageProp, pricing: pricingProp, speedSamples: samplesProp, error: errorProp, variant = "card", expanded: expandedProp, defaultExpanded = false, onExpandedChange, onRetry, note: noteProp, className }: GenerationStatsProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const simulated = statusProp === undefined;
  const [visible, setVisible] = useState(false);
  const [expandedState, setExpandedState] = useState(defaultExpanded);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const node = root.current;
    if (!simulated || !node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: .1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [simulated]);

  const userOpen = expandedProp ?? expandedState;
  const sim = useGenerationSimulation({ active: simulated && visible && !reduced, hold: touched && userOpen });
  const frame = simulated ? sim.frame : undefined;

  const model = frame?.model ?? modelProp;
  const status = frame?.status ?? statusProp ?? "idle";
  const startedAt = frame?.startedAt ?? startedAtProp;
  const usage = frame?.usage ?? usageProp ?? {};
  const pricing = frame?.pricing ?? pricingProp;
  const error = frame?.error ?? errorProp;
  const note = noteProp ?? (simulated ? SIM_NOTE : undefined);
  const retry = simulated ? sim.retry : onRetry;
  const expanded = simulated && !touched && expandedProp === undefined && !defaultExpanded ? sim.cueOpen : userOpen;

  const live = status === "waiting" || status === "streaming";
  const now = useNow(live && startedAt !== undefined);
  const elapsed = live && startedAt !== undefined ? Math.max(0, (now ?? startedAt) - startedAt) : undefined;
  const ttft = usage.ttftMs ?? (status === "waiting" ? elapsed : undefined);
  const total = usage.durationMs ?? (live ? elapsed : undefined);
  const generation = status !== "waiting" && total !== undefined && ttft !== undefined ? Math.max(0, total - ttft) : undefined;
  const output = usage.outputTokens;
  // While streaming, speed is read at the moment the last chunk landed, so it holds still between chunks instead of sagging.
  const [stamp, setStamp] = useState<{ output?: number; elapsed?: number }>({});
  if (stamp.output !== output) setStamp({ output, elapsed });
  const speedWindow = status === "streaming" && usage.durationMs === undefined && stamp.elapsed !== undefined && ttft !== undefined ? stamp.elapsed - ttft : generation;
  const speed = usage.tokensPerSecond ?? (output && speedWindow && speedWindow >= 240 ? output / (speedWindow / 1000) : undefined);
  const cost = usage.costUsd ?? (pricing && usage.inputTokens !== undefined ? generationCost(usage, pricing) : undefined);
  const series = useSpeedSeries(status, output, frame?.runKey);
  const points = samplesProp ?? frame?.speedSamples ?? series;

  const toggle = () => {
    const next = !expanded;
    setTouched(true);
    if (expandedProp === undefined) setExpandedState(next);
    onExpandedChange?.(next);
  };

  // Announce settled outcomes, not every tick. The self-playing preview stays quiet until someone interacts with it.
  const [announcement, setAnnouncement] = useState("");
  const [seenStatus, setSeenStatus] = useState(status);
  if (seenStatus !== status) {
    setSeenStatus(status);
    const name = model?.name ?? "The model";
    const message = status === "done" ? `${name} done in ${total !== undefined ? formatLatency(total) : "time unknown"}${output !== undefined ? `, ${formatTokens(output)} output tokens` : ""}${speed ? ` at ${formatSpeed(speed)} tokens per second` : ""}${cost !== undefined ? `, ${formatCost(cost)}` : ""}.`
      : status === "error" ? `${name} failed. ${error ?? ""}`.trim()
      : status === "stopped" ? `${name} stopped.`
      : status === "waiting" && touched ? `Request sent to ${name}.` : "";
    if (!simulated || touched) setAnnouncement(message);
  }

  const cached = Math.min(usage.cachedTokens ?? 0, usage.inputTokens ?? 0);
  const rows = [
    { key: "input", label: "Input", tokens: usage.inputTokens !== undefined ? usage.inputTokens - cached : undefined, rate: pricing?.input },
    { key: "cached", label: "Cached input", tokens: usage.inputTokens !== undefined ? cached : undefined, rate: pricing ? pricing.cachedInput ?? pricing.input : undefined },
    { key: "output", label: "Output", tokens: output, rate: pricing?.output },
    ...(usage.reasoningTokens ? [{ key: "reasoning", label: "Reasoning", tokens: usage.reasoningTokens, rate: pricing?.output }] : []),
  ];
  const totalTokens = rows.reduce((sum, row) => sum + (row.tokens ?? 0), 0);
  const showCost = cost !== undefined;
  const showRates = !!pricing && usage.costUsd === undefined;

  const copyValue = JSON.stringify({
    model: model?.id ?? model?.name, status, ttftMs: ttft !== undefined ? Math.round(ttft) : undefined, durationMs: total !== undefined ? Math.round(total) : undefined,
    tokensPerSecond: speed !== undefined ? Math.round(speed * 10) / 10 : undefined, inputTokens: usage.inputTokens, cachedTokens: usage.cachedTokens,
    outputTokens: output, reasoningTokens: usage.reasoningTokens, costUsd: cost !== undefined ? Math.round(cost * 1e6) / 1e6 : undefined,
  }, null, 2);

  const ids = { panel: `${id}-panel`, label: `${id}-label` };
  const inline = variant === "inline";
  const ttftShare = ttft !== undefined && total ? Math.min(1, ttft / total) : status === "waiting" ? 1 : 0;

  return <div ref={root} className={cx(styles.root, inline ? styles.inline : styles.card, className)} data-status={status} data-open={expanded || undefined} role="group" aria-labelledby={ids.label}>
    <div className={styles.head}>
      {model ? <ProviderMark provider={model.provider} size={inline ? 14 : 16} className={styles.mark} /> : null}
      <span id={ids.label} className={styles.model}>{model ? model.name : "Generation"}<span className={styles.srOnly}> stats</span></span>
      <span className={styles.status}>
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span key={statusText(status, status === "done" || status === "stopped" ? total : undefined)} className={styles.statusInner}
            initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: { ...swapTransition(reduced), duration: reduced ? 0 : .16 } }} exit={{ opacity: 0, transition: { ...swapTransition(reduced), duration: reduced ? 0 : .1 } }}>
            <span className={styles.statusIcon} data-status={status}><StatusIcon status={status} reduced={reduced} /></span>
            {status === "waiting" ? <TextShimmer className={styles.statusLabel}>Waiting</TextShimmer> : <span className={styles.statusLabel}>{statusText(status, total)}</span>}
          </motion.span>
        </AnimatePresence>
      </span>
    </div>

    <dl className={styles.stats}>
      <div className={styles.cell}>
        <dt className={styles.label}>First token</dt>
        <dd className={styles.value}><Num value={ttft} format={formatLatency} reduced={reduced} /><span className={styles.unitInline}>to first token</span></dd>
      </div>
      <div className={styles.cell}>
        <dt className={styles.label}>Speed</dt>
        <dd className={styles.value}>
          <Num value={speed} format={formatSpeed} reduced={reduced} /><span className={styles.unit}>tok/s</span>
          <Sparkline points={points} live={status === "streaming"} />
        </dd>
      </div>
      <div className={styles.cell}>
        <dt className={styles.label}>Output tokens</dt>
        <dd className={styles.value}><Num value={output} format={formatTokens} reduced={reduced} /><span className={styles.unitInline}>tokens</span></dd>
      </div>
      <div className={styles.cell}>
        <dt className={styles.label}>Cost</dt>
        <dd className={styles.value}><Num value={cost} format={formatCost} reduced={reduced} /></dd>
      </div>
    </dl>

    <Button variant="ghost" size="sm" className={styles.toggle} onClick={toggle} disabled={status === "idle"} aria-expanded={expanded} aria-controls={ids.panel} aria-label={expanded ? "Hide details" : "Show details"}>
      <span className={styles.toggleLabel}>Details</span>
      <ChevronDown size={16} strokeWidth={1.75} className={styles.chevron} aria-hidden="true" />
    </Button>

    <AnimatePresence initial={false}>
      {status === "error" ? <motion.div key="error" className={styles.errorClip} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={panelTransition(reduced)}>
        <div className={styles.error}>
          <CircleAlert size={16} strokeWidth={1.75} className={styles.errorIcon} aria-hidden="true" />
          <p className={styles.errorText}>{error ?? "The request failed before it finished."}</p>
          {retry ? <Button variant="secondary" size="sm" className={styles.retry} onClick={() => { setTouched(true); retry(); }}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry</Button> : null}
        </div>
      </motion.div> : null}
    </AnimatePresence>

    <AnimatePresence initial={false}>
      {expanded ? <motion.div key="panel" id={ids.panel} className={styles.panelClip} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={panelTransition(reduced)}>
        <div className={styles.panel}>
          <section className={styles.latency} aria-label="Latency">
            <div className={styles.bar} aria-hidden="true">
              <span className={styles.segTtft} style={{ flexGrow: Math.max(ttftShare, .015) }} />
              {generation !== undefined ? <span className={styles.segGen} style={{ flexGrow: Math.max(1 - ttftShare, 0) }} /> : null}
            </div>
            <dl className={styles.legend}>
              <div className={styles.legendItem}><dt><span className={styles.swatchTtft} aria-hidden="true" />First token</dt><dd><Num value={ttft} format={formatLatency} reduced={reduced} /></dd></div>
              <div className={styles.legendItem}><dt><span className={styles.swatchGen} aria-hidden="true" />Generation</dt><dd><Num value={generation} format={formatLatency} reduced={reduced} /></dd></div>
              <div className={styles.legendItem}><dt>Total</dt><dd><Num value={total} format={formatLatency} reduced={reduced} /></dd></div>
            </dl>
          </section>

          <table className={styles.table} data-rates={showRates || undefined} data-cost={showCost || undefined}>
            <caption className={styles.srOnly}>Token usage{showCost ? " and cost" : ""}</caption>
            <thead><tr>
              <th scope="col">Type</th>
              <th scope="col">Tokens</th>
              {showRates ? <th scope="col" className={styles.rateCol}>Rate</th> : null}
              {showCost ? <th scope="col">Cost</th> : null}
            </tr></thead>
            <tbody>
              {rows.map(row => <tr key={row.key}>
                <th scope="row">{row.label}</th>
                <td><Num value={row.tokens} format={formatTokens} reduced={reduced} /></td>
                {showRates ? <td className={styles.rateCol}>{row.rate !== undefined ? formatRate(row.rate) : DASH}</td> : null}
                {showCost ? <td>{showRates && row.tokens !== undefined && row.rate !== undefined ? <Num value={row.tokens * row.rate / 1e6} format={formatCost} reduced={reduced} /> : DASH}</td> : null}
              </tr>)}
            </tbody>
            <tfoot><tr>
              <th scope="row">Total</th>
              <td><Num value={totalTokens} format={formatTokens} reduced={reduced} /></td>
              {showRates ? <td className={styles.rateCol} /> : null}
              {showCost ? <td><Num value={cost} format={formatCost} reduced={reduced} /></td> : null}
            </tr></tfoot>
          </table>

          <div className={styles.foot}>
            <p className={styles.note}>{note}</p>
            <CopyButton value={copyValue} label="Copy stats as JSON" iconOnly variant="plain" className={styles.copy} />
          </div>
        </div>
      </motion.div> : null}
    </AnimatePresence>

    <span className={styles.srOnly} role="status" aria-live="polite">{simulated && !touched ? SIM_NOTE : `${announcement}${simulated && announcement ? " Simulated, nothing was sent." : ""}`}</span>
  </div>;
}

export default GenerationStats;
