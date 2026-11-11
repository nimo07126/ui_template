"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Slider } from "../../slider/slider";
import { Switch } from "../../switch/switch";
import { llmCostPresets, llmCostSampleModels, llmCostStops } from "./llm-cost-calculator-data";
import type { LlmModelPrice, LlmUsage, LlmUsagePreset } from "./llm-cost-calculator-data";
import styles from "./llm-cost-calculator.module.css";

export type { LlmModelPrice, LlmUsage, LlmUsagePreset } from "./llm-cost-calculator-data";
export { llmCostPresets, llmCostSampleModels, llmCostStops } from "./llm-cost-calculator-data";

export interface LlmCostBreakdown {
  /** Monthly dollars for uncached input tokens. */
  input: number;
  /** Monthly dollars for input tokens billed at the cached rate. */
  cachedInput: number;
  /** Monthly dollars for output tokens. */
  output: number;
  /** input + cachedInput + output. */
  total: number;
  /** Dollars for one request. */
  perRequest: number;
}

export interface LlmCostCalculatorProps {
  /** Models to compare, with prices per 1M tokens. Defaults to eight sample models with sample prices. */
  models?: LlmModelPrice[];
  /** Controlled workload. Pair with `onUsageChange`. */
  usage?: LlmUsage;
  /** Starting workload when uncontrolled. Defaults to the RAG preset. */
  defaultUsage?: LlmUsage;
  /** Called on every slider step, preset and cache toggle. */
  onUsageChange?: (usage: LlmUsage) => void;
  /** Controlled selected model id. Pair with `onSelectedChange`. */
  selected?: string;
  /** Starting selection when uncontrolled. Defaults to the second model. */
  defaultSelected?: string;
  /** Called when someone picks a model row. */
  onSelectedChange?: (id: string, model: LlmModelPrice) => void;
  /** Workload shortcuts above the sliders, or false to hide the row. */
  presets?: LlmUsagePreset[] | false;
  /** Share of input tokens billed at the cached rate while Cached input is on, from 0 to 1. */
  cacheHitRate?: number;
  /** Days in a billing month. */
  daysPerMonth?: number;
  /** Shows placeholder rows while prices load. */
  loading?: boolean;
  /** Shows an error in place of the list. Pair with `onRetry`. */
  error?: string;
  onRetry?: () => void;
  title?: string;
  /** Line under the title. Say where the prices come from. */
  description?: string;
  /** Fine print at the bottom. */
  note?: string;
  className?: string;
}

const MONTHLY_DAYS = 30;
const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
/** Positions, bars and numbers share one critically damped spring, so a re-rank lands as one move. */
const glide: Transition = { type: "spring", visualDuration: 0.24, bounce: 0 };
const integer = new Intl.NumberFormat("en-US");
const dollars = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const cents = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });

/** $12.40 under a hundred, $1,842 under a hundred thousand, then $420K and $4.2M so the column never overflows. */
export function formatMonthly(value: number) {
  if (value < 100) return cents.format(value);
  if (value < 100_000) return dollars.format(value);
  return compact.format(value);
}
/** The hero has room for every digit. */
const formatTotal = (value: number) => value < 100 ? cents.format(value) : dollars.format(value);
function formatPerRequest(value: number) {
  const digits = value < 0.001 ? 5 : value < 0.01 ? 4 : value < 1 ? 3 : 2;
  return `$${value.toFixed(digits)}`;
}
const formatPrice = (value: number) => `$${value < 0.1 ? value.toFixed(3) : value.toFixed(2)}`;

/** The monthly bill for one model and workload. */
export function computeLlmCost(model: LlmModelPrice, usage: LlmUsage, options: { cacheHitRate?: number; daysPerMonth?: number } = {}): LlmCostBreakdown {
  const hit = usage.cached ? Math.min(1, Math.max(0, options.cacheHitRate ?? 0.6)) : 0;
  const requests = usage.requestsPerDay * (options.daysPerMonth ?? MONTHLY_DAYS);
  const input = (usage.inputTokens * (1 - hit) * model.input) / 1e6;
  const cachedInput = (usage.inputTokens * hit * (model.cachedInput ?? model.input)) / 1e6;
  const output = (usage.outputTokens * model.output) / 1e6;
  const perRequest = input + cachedInput + output;
  return { input: input * requests, cachedInput: cachedInput * requests, output: output * requests, total: perRequest * requests, perRequest };
}

const nearest = (stops: number[], value: number) => stops.reduce((best, stop, index) => Math.abs(stop - value) < Math.abs(stops[best]! - value) ? index : best, 0);
const sameUsage = (a: LlmUsage, b: LlmUsage) => a.inputTokens === b.inputTokens && a.outputTokens === b.outputTokens && a.requestsPerDay === b.requestsPerDay && a.cached === b.cached;
const defaultFallback = llmCostPresets[1]!.usage;

/**
 * A number that counts to its new value on a short ease-out instead of jumping. The text is written straight to the
 * node on each frame, so eight rows can roll during a drag without re-rendering anything.
 */
function Rolling({ value, format, className }: { value: number; format: (value: number) => string; className?: string }) {
  const reduced = useReducedMotion();
  const node = useRef<HTMLSpanElement>(null);
  const shown = useMotionValue(value);
  // React renders the first value only; later values are written by the motion value, so a re-render never snaps the text.
  const [initial] = useState(() => format(value));
  useMotionValueEvent(shown, "change", latest => { if (node.current) node.current.textContent = format(latest); });
  useEffect(() => {
    if (reduced) { shown.jump(value); if (node.current) node.current.textContent = format(value); return; }
    const controls = animate(shown, value, { duration: 0.24, ease: ease });
    return () => controls.stop();
  }, [value, reduced, shown, format]);
  return <span ref={node} className={cx(styles.num, className)}>{initial}</span>;
}

/** One crossfade for a text swap: the old line fades out over 100ms while the new one fades in over 160ms in the same cell. */
function Swap({ text, className }: { text: string; className?: string }) {
  const reduced = useReducedMotion();
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <motion.span key={text} className={styles.swapItem} initial={{ opacity: 0, y: reduced ? 0 : 2 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : 0.16, ease: ease } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}>{text}</motion.span>
    </AnimatePresence>
  </span>;
}

/**
 * A pricing calculator for LLM workloads. Sliders set tokens per request and requests per day, a switch bills part of
 * the input at the cached rate, and every model re-ranks by monthly cost as the numbers change.
 */
export function LlmCostCalculator({
  models = llmCostSampleModels,
  usage: usageProp,
  defaultUsage = defaultFallback,
  onUsageChange,
  selected: selectedProp,
  defaultSelected,
  onSelectedChange,
  presets = llmCostPresets,
  cacheHitRate = 0.6,
  daysPerMonth = MONTHLY_DAYS,
  loading = false,
  error,
  onRetry,
  title = "Estimated monthly cost",
  description = "Sample list prices per 1M tokens, October 2026",
  note = "Sample prices for illustration, not a quote. Calculated in your browser, nothing was sent.",
  className,
}: LlmCostCalculatorProps) {
  const id = useId();
  const reduced = useReducedMotion();
  const [usageState, setUsageState] = useState(defaultUsage);
  const usage = usageProp ?? usageState;
  const [selectedState, setSelectedState] = useState(defaultSelected ?? models[1]?.id ?? models[0]?.id ?? "");
  const listRef = useRef<HTMLDivElement>(null);

  const setUsage = (next: LlmUsage) => {
    if (!usageProp) setUsageState(next);
    onUsageChange?.(next);
  };

  const ranked = useMemo(() => models
    .map((model, index) => ({ model, index, cost: computeLlmCost(model, usage, { cacheHitRate, daysPerMonth }) }))
    .sort((a, b) => a.cost.total - b.cost.total || a.index - b.index), [models, usage, cacheHitRate, daysPerMonth]);
  const highest = ranked.reduce((max, row) => Math.max(max, row.cost.total), 0);
  const selectedId = ranked.some(row => row.model.id === (selectedProp ?? selectedState)) ? (selectedProp ?? selectedState) : ranked[0]?.model.id;
  const selectedRank = ranked.findIndex(row => row.model.id === selectedId);
  const current = ranked[selectedRank];

  const select = (row: (typeof ranked)[number]) => {
    if (selectedProp === undefined) setSelectedState(row.model.id);
    onSelectedChange?.(row.model.id, row.model);
  };

  const ready = !loading && !error && ranked.length > 0;
  const view = loading ? "loading" : error ? "error" : ranked.length === 0 ? "empty" : "list";
  const slots = Math.max(models.length, 4);

  // One polite announcement once the numbers settle, never on every drag frame.
  const [announcement, setAnnouncement] = useState("");
  const mounted = useRef(false);
  const spoken = loading ? "Loading prices." : error ? `Prices did not load. ${error}` : current
    ? `${current.model.name}, ${formatTotal(current.cost.total)} per month, ${selectedRank === 0 ? "the lowest cost" : `rank ${selectedRank + 1} of ${ranked.length}`}. Sample prices, calculated in your browser, nothing was sent.`
    : "No models to compare.";
  useEffect(() => {
    if (!mounted.current) { mounted.current = true; return; }
    const timer = window.setTimeout(() => setAnnouncement(spoken), 450);
    return () => window.clearTimeout(timer);
  }, [spoken]);

  const onRowKey = (event: KeyboardEvent<HTMLButtonElement>, rank: number) => {
    const last = ranked.length - 1;
    const target = event.key === "ArrowDown" || event.key === "ArrowRight" ? Math.min(last, rank + 1)
      : event.key === "ArrowUp" || event.key === "ArrowLeft" ? Math.max(0, rank - 1)
        : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
    if (target < 0) return;
    event.preventDefault();
    const row = ranked[target]!;
    select(row);
    listRef.current?.querySelector<HTMLElement>(`[data-model="${CSS.escape(row.model.id)}"]`)?.focus();
  };

  const matched = presets ? presets.find(preset => sameUsage(preset.usage, usage))?.id ?? "custom" : "custom";
  const stopIndex = {
    inputTokens: nearest(llmCostStops.inputTokens, usage.inputTokens),
    outputTokens: nearest(llmCostStops.outputTokens, usage.outputTokens),
    requestsPerDay: nearest(llmCostStops.requestsPerDay, usage.requestsPerDay),
  };
  const slider = (key: keyof typeof llmCostStops, label: string) => (
    <Slider
      label={label}
      min={0}
      max={llmCostStops[key].length - 1}
      step={1}
      largeStep={2}
      value={stopIndex[key]}
      format={index => integer.format(llmCostStops[key][Math.round(index)] ?? 0)}
      onValueChange={index => setUsage({ ...usage, [key]: llmCostStops[key][index] ?? usage[key] })}
      disabled={!ready}
    />
  );

  const fade = { initial: { opacity: 0 }, animate: { opacity: 1, transition: { duration: reduced ? 0 : 0.16, ease: ease } }, exit: { opacity: 0, transition: { duration: reduced ? 0 : 0.1 } } };
  const hitPercent = Math.round(Math.min(1, Math.max(0, cacheHitRate)) * 100);

  return (
    <section className={cx(styles.root, className)} aria-labelledby={`${id}-title`} aria-busy={loading || undefined}>
      <header className={styles.header}>
        <div className={styles.heading}>
          <h3 id={`${id}-title`} className={styles.title}>{title}</h3>
          {description && <p className={styles.meta}>{description}</p>}
        </div>
        <div className={styles.hero} aria-hidden="true">
          {ready && current ? <>
            <Rolling value={current.cost.total} format={formatTotal} className={styles.total} />
            <span className={styles.heroMeta}><Swap text={`${current.model.name} per month`} /></span>
          </> : <>
            <span className={cx(styles.total, styles.totalIdle)}>{loading ? <span className={cx(styles.skeleton, styles.skeletonTotal)} /> : "$0.00"}</span>
            <span className={styles.heroMeta}>{loading ? "Loading prices" : error ? "Prices unavailable" : "No model selected"}</span>
          </>}
        </div>
      </header>

      {presets && presets.length > 0 && (
        <SegmentedControl
          className={styles.presets}
          label="Workload"
          value={matched}
          onValueChange={value => { const preset = presets.find(item => item.id === value); if (preset) setUsage(preset.usage); }}
          options={[...presets.map(preset => ({ value: preset.id, label: preset.label })), { value: "custom", label: "Custom" }]}
        />
      )}

      <div className={styles.controls}>
      <div className={styles.sliders}>
        {slider("inputTokens", "Input tokens")}
        {slider("outputTokens", "Output tokens")}
        {slider("requestsPerDay", "Requests per day")}
      </div>

      <div className={styles.cache}>
        <Switch label="Cached input" checked={usage.cached} onCheckedChange={cached => setUsage({ ...usage, cached })} disabled={!ready} />
        <span className={styles.meta}><Swap text={usage.cached ? `${hitPercent}% of input billed at the cache read rate` : "All input billed at the full rate"} /></span>
      </div>
      </div>

      <div className={styles.ranking}>

      <div className={styles.listHead} aria-hidden="true">
        <span>Model</span>
        <span>Per month</span>
      </div>

      <div className={styles.stage} style={{ "--slots": slots } as CSSProperties}>
        <AnimatePresence initial={false} mode="wait">
          {view === "list" && (
            <motion.div key="list" ref={listRef} className={styles.list} role="radiogroup" aria-label="Models ranked by monthly cost, lowest first" style={{ "--rows": ranked.length } as CSSProperties} {...fade}>
              {ranked.map((_, rank) => <span key={rank} className={styles.rankSlot} style={{ transform: `translateY(calc(var(--row) * ${rank}))` }} aria-hidden="true">{rank + 1}</span>)}
              {ranked.map((row, rank) => {
                const on = row.model.id === selectedId;
                const share = highest > 0 ? row.cost.total / highest : 0;
                return (
                  <motion.button
                    key={row.model.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${row.model.name} by ${row.model.provider}, rank ${rank + 1}, ${formatMonthly(row.cost.total)} per month`}
                    tabIndex={on ? 0 : -1}
                    data-model={row.model.id}
                    data-on={on || undefined}
                    className={styles.row}
                    initial={false}
                    animate={{ y: `${rank * 100}%` }}
                    transition={reduced ? { duration: 0 } : glide}
                    onClick={() => select(row)}
                    onKeyDown={event => onRowKey(event, rank)}
                  >
                    <span className={styles.rank} />
                    <span className={styles.mark} aria-hidden="true">{row.model.mark}</span>
                    <span className={styles.name}>{row.model.name}</span>
                    <span className={styles.track} aria-hidden="true">
                      <motion.span className={styles.bar} initial={false} animate={{ width: `${Math.max(1.5, share * 100)}%` }} transition={reduced ? { duration: 0 } : glide} />
                    </span>
                    <Rolling value={row.cost.total} format={formatMonthly} className={styles.cost} />
                  </motion.button>
                );
              })}
            </motion.div>
          )}
          {view === "loading" && (
            <motion.div key="loading" className={styles.list} aria-hidden="true" style={{ "--rows": slots } as CSSProperties} {...fade}>
              {Array.from({ length: slots }, (_, index) => (
                <div key={index} className={cx(styles.row, styles.ghost)} style={{ transform: `translateY(${index * 100}%)` }}>
                  <span className={styles.rank}>{index + 1}</span>
                  <span className={cx(styles.skeleton, styles.skeletonMark)} />
                  <span className={cx(styles.skeleton, styles.skeletonName)} style={{ width: `${62 + ((index * 23) % 30)}%` }} />
                  <span className={styles.track} />
                  <span className={cx(styles.skeleton, styles.skeletonCost)} />
                </div>
              ))}
            </motion.div>
          )}
          {(view === "error" || view === "empty") && (
            <motion.div key={view} className={styles.message} {...fade}>
              {view === "error" ? <>
                <span className={styles.messageTitle}><CircleAlert size={16} aria-hidden="true" className={styles.messageIcon} />Prices did not load</span>
                <span className={styles.meta}>{error}</span>
                {onRetry && <Button size="sm" variant="secondary" onClick={onRetry} className={styles.retry}><RotateCcw size={14} aria-hidden="true" />Try again</Button>}
              </> : <>
                <span className={styles.messageTitle}>No models to compare</span>
                <span className={styles.meta}>Add models with input and output prices to rank them.</span>
              </>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>

      <footer className={styles.footer}>
        <dl className={styles.breakdown} aria-label={current ? `${current.model.name} breakdown` : "Breakdown"}>
          <div className={styles.stat}>
            <dt className={styles.meta}>Input</dt>
            <dd>{ready && current ? <Rolling value={current.cost.input} format={formatMonthly} /> : <span className={styles.num}>$0.00</span>}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.meta}>Cached</dt>
            <dd>{ready && current ? <Rolling value={current.cost.cachedInput} format={formatMonthly} /> : <span className={styles.num}>$0.00</span>}</dd>
          </div>
          <div className={styles.stat}>
            <dt className={styles.meta}>Output</dt>
            <dd>{ready && current ? <Rolling value={current.cost.output} format={formatMonthly} /> : <span className={styles.num}>$0.00</span>}</dd>
          </div>
          <div className={cx(styles.stat, styles.statEnd)}>
            <dt className={styles.meta}>Per request</dt>
            <dd>{ready && current ? <Rolling value={current.cost.perRequest} format={formatPerRequest} /> : <span className={styles.num}>$0.0000</span>}</dd>
          </div>
        </dl>
        <p className={styles.note}>
          {current && ready ? <Swap text={`${current.model.name}: ${formatPrice(current.model.input)} in, ${formatPrice(current.model.cachedInput ?? current.model.input)} cached, ${formatPrice(current.model.output)} out per 1M tokens.`} /> : <span>&nbsp;</span>}
          <span className={styles.fine}>{note}</span>
        </p>
      </footer>

      <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
    </section>
  );
}

export default LlmCostCalculator;
