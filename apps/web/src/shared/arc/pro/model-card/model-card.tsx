"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useInView, useIsPresent, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { AudioLines, Brain, Check, CircleAlert, FileTextIcon, Image as ImageIcon, RotateCcw, Type, Video, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { DropdownMenu } from "../../dropdown-menu/dropdown-menu";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Slider } from "../../slider/slider";
import { Switch } from "../../switch/switch";
import { motionTokens } from "../../lib/motion-tokens";
import { modelCardBenchmarks, modelCardModels, modelCardRivals } from "./model-card-data";
import type { ModelCardBenchmark, ModelCardModality, ModelCardModel, ModelCardProps, ModelCardView } from "./model-card-types";
import styles from "./model-card.module.css";

export type { ModelCardBenchmark, ModelCardModality, ModelCardModel, ModelCardPricing, ModelCardProps, ModelCardView } from "./model-card-types";
export { modelCardBenchmarks, modelCardModels, modelCardRivals } from "./model-card-data";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/*
 * Layout rule: the card never changes size. Details, compare, loading and error are panels stacked in one grid cell,
 * so the cell is always as tall as the tallest panel and switching only crossfades. Inside a panel every slot is
 * reserved: the summary holds two lines, all seven modality chips always render, every spec and price cell renders
 * (Not listed when missing), the benchmark list always has the same rows and the readout holds its lines.
 * Motion: one crossfade per text swap, one critically damped spring for bars. Nothing bounces.
 */
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const show: Transition = { duration: .16, ease };
const hide: Transition = { duration: .1, ease };
const instant: Transition = { duration: 0 };
const settle: Transition = { type: "spring", visualDuration: .24, bounce: 0 };

const modalityOrder: ModelCardModality[] = ["text", "image", "pdf", "audio", "video", "tools", "reasoning"];
const modalityMeta: Record<ModelCardModality, { label: string; icon: LucideIcon }> = {
  text: { label: "Text", icon: Type },
  image: { label: "Image", icon: ImageIcon },
  pdf: { label: "PDF", icon: FileTextIcon },
  audio: { label: "Audio", icon: AudioLines },
  video: { label: "Video", icon: Video },
  tools: { label: "Tools", icon: Wrench },
  reasoning: { label: "Reasoning", icon: Brain },
};

/** Estimator stops, tokens per month. */
const volumes = [1e6, 5e6, 10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 1e9];
/** About 0.75 words per token and 500 words per page. */
const pagesFor = (tokens: number) => Math.round(tokens * .75 / 500);

/* ---------- Formatting ---------- */

const trim = (value: number) => String(Number(value.toFixed(2)));

/** 1_000_000 → "1M", 128_000 → "128K", 1_050_000 → "1.05M", 1e9 → "1B". */
export function formatTokens(tokens?: number) {
  if (tokens === undefined || !Number.isFinite(tokens)) return undefined;
  if (tokens >= 1e9) return `${trim(tokens / 1e9)}B`;
  if (tokens >= 1e6) return `${trim(tokens / 1e6)}M`;
  if (tokens >= 1e3) return `${trim(tokens / 1e3)}K`;
  return String(tokens);
}

const isoMonth = /^(\d{4})-(\d{2})$/;

/** "2026-03" → "Mar 2026". Any other string is returned unchanged. */
export function formatCutoff(value?: string) {
  if (!value) return undefined;
  const match = isoMonth.exec(value);
  if (!match) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function money(value: number, currency: string, digits?: number) {
  const fraction = digits ?? (Math.abs(value) >= 100 ? 0 : 2);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: fraction, maximumFractionDigits: fraction }).format(value);
  } catch {
    return value.toFixed(fraction);
  }
}

const grouped = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const ordinal = (n: number) => { const tail = n % 100; if (tail >= 11 && tail <= 13) return `${n}th`; return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`; };
const monthIndex = (value?: string) => { const match = value ? isoMonth.exec(value) : null; return match ? Number(match[1]) * 12 + Number(match[2]) : undefined; };

/** 1 when a is better, -1 when b is better, 0 for a tie or a missing value. */
function rank(a: number | undefined, b: number | undefined, prefer: "higher" | "lower") {
  if (a === undefined || b === undefined || a === b) return 0;
  return (a > b) === (prefer === "higher") ? 1 : -1;
}

function monthlyCost(model: ModelCardModel, tokens: number, inputShare: number) {
  const pricing = model.pricing;
  if (!pricing) return undefined;
  return tokens / 1e6 * (pricing.input * inputShare + pricing.output * (1 - inputShare));
}

/* ---------- Motion helpers ---------- */

function SwapItem({ as, className, reduced, children }: { as: "span" | "div"; className?: string; reduced: boolean; children: ReactNode }) {
  const present = useIsPresent();
  const Tag = as === "div" ? motion.div : motion.span;
  return <Tag className={cx(styles.swapItem, className)} aria-hidden={present ? undefined : true}
    initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>{children}</Tag>;
}

/** A text swap: the old value fades out in 100ms while the new one fades in over 160ms, in the same grid cell, so nothing reflows. */
function Swap({ k, children, as = "span", className, itemClassName }: { k: string; children: ReactNode; as?: "span" | "div"; className?: string; itemClassName?: string }) {
  const reduced = useReducedMotion() ?? false;
  const Outer = as;
  return <Outer className={cx(as === "div" ? styles.swapBlock : styles.swap, className)}>
    <AnimatePresence initial={false}>
      <SwapItem key={k} as={as} className={itemClassName} reduced={reduced}>{children}</SwapItem>
    </AnimatePresence>
  </Outer>;
}

/**
 * Rolls a number to its new value in tabular numerals inside a reserved width. React renders the first value only;
 * later values are written in place, so it never flashes the end value and never re-renders per frame.
 */
function Rolling({ value, format, reduced, className }: { value: number; format: (value: number) => string; reduced: boolean; className?: string }) {
  const node = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const formatRef = useRef(format);
  useLayoutEffect(() => { formatRef.current = format; });
  const [first] = useState(() => format(value));
  useEffect(() => {
    const element = node.current;
    if (!element) return;
    const from = shown.current;
    if (reduced || from === value) { shown.current = value; element.textContent = formatRef.current(value); return; }
    const controls = animate(from, value, { duration: .32, ease, onUpdate: latest => { shown.current = latest; element.textContent = formatRef.current(latest); } });
    return () => controls.stop();
  }, [value, reduced]);
  /* A format change (a new currency) with the same value still repaints. */
  useEffect(() => { if (node.current && shown.current === value) node.current.textContent = format(value); }, [format, value]);
  return <span ref={node} className={cx(styles.number, className)}>{first}</span>;
}

/* ---------- Parts ---------- */

function Mark({ children, className }: { children?: ReactNode; className?: string }) {
  return <span className={cx(styles.mark, className)} aria-hidden="true">{children}</span>;
}

/** All seven modalities always render, so chips never reflow between models. Unsupported ones are dashed and muted, and say so to screen readers. */
function Modalities({ items }: { items: ModelCardModality[] }) {
  return <ul className={styles.chips} aria-label="Modalities">
    {modalityOrder.map(item => {
      const { label, icon: Icon } = modalityMeta[item];
      const on = items.includes(item);
      return <li key={item} className={styles.chip} data-off={on ? undefined : ""} title={on ? undefined : `${label} not supported`}>
        <Icon size={14} strokeWidth={1.75} aria-hidden="true" />{label}<span className={styles.srOnly}>{on ? ", supported" : ", not supported"}</span>
      </li>;
    })}
  </ul>;
}

/** Compact modality row for the compare table: seven fixed icons, unsupported ones faded. */
function ModalityIcons({ items }: { items: ModelCardModality[] }) {
  const supported = modalityOrder.filter(item => items.includes(item));
  return <span className={styles.modIcons}>
    {modalityOrder.map(item => { const Icon = modalityMeta[item].icon; return <Icon key={item} size={14} strokeWidth={1.75} aria-hidden="true" data-off={items.includes(item) ? undefined : ""} />; })}
    <span className={styles.srOnly}>{supported.length ? supported.map(item => modalityMeta[item].label).join(", ") : "Not listed"}</span>
  </span>;
}

function Spec({ label, children }: { label: string; children: ReactNode }) {
  return <div className={styles.spec}>
    <dt className={styles.specLabel}>{label}</dt>
    <dd className={styles.specValue}>{children}</dd>
  </div>;
}

const notListed = <span className={styles.missing}>Not listed</span>;

function Bar({ value, primary, reduced, delay = 0, className }: { value: number; primary?: boolean; reduced: boolean; delay?: number; className?: string }) {
  return <span className={cx(styles.track, className)} data-primary={primary || undefined} aria-hidden="true">
    <motion.span className={styles.fill} initial={false} animate={{ scaleX: Math.min(1, Math.max(0, value)) }} transition={reduced ? instant : { ...settle, delay }} />
  </span>;
}

interface BenchRow { model: ModelCardModel; score?: number; rank?: number }

function benchReadout(row: BenchRow, rows: BenchRow[], pool: number, benchmark: ModelCardBenchmark) {
  const unit = benchmark.unit ?? "%";
  if (row.score === undefined || row.rank === undefined) return `${row.model.name} has no ${benchmark.name} score listed.`;
  const ranked = rows.filter(entry => entry.score !== undefined && entry.model.id !== row.model.id).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const head = `${row.model.name} scores ${row.score.toFixed(1)}${unit}, ${ordinal(row.rank)} of ${pool}.`;
  if (!ranked.length) return head;
  const target = row.rank === 1 ? ranked[0] : rows.find(entry => entry.rank === 1) ?? ranked[0];
  const gap = Math.abs(row.score - (target.score ?? 0)).toFixed(1);
  return row.rank === 1 ? `${head} ${gap} points ahead of ${target.model.name}.` : `${head} ${gap} points behind ${target.model.name}.`;
}

function Benchmarks({ model, others, benchmarks, benchmark, onBenchmark, sample, active, reduced }: {
  model: ModelCardModel; others: ModelCardModel[]; benchmarks: ModelCardBenchmark[]; benchmark: ModelCardBenchmark; onBenchmark: (id: string) => void;
  sample: boolean; active: boolean; reduced: boolean;
}) {
  const list = useRef<HTMLUListElement>(null);
  const inView = useInView(list, { once: true, amount: .5 });
  const revealed = (inView && active) || reduced;
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!revealed) return;
    const frame = requestAnimationFrame(() => setSeen(true));
    return () => cancelAnimationFrame(frame);
  }, [revealed]);
  const [hover, setHover] = useState<number | null>(null);
  const max = benchmark.max ?? 100;
  const unit = benchmark.unit ?? "%";
  /* Rank among the model and every rival with a score; the list shows the model and the first two rivals. */
  const scoredPool = [model, ...others].map(entry => entry.scores?.[benchmark.id]).filter((score): score is number => score !== undefined).sort((a, b) => b - a);
  const rows: BenchRow[] = [model, ...others.slice(0, 2)].map(entry => {
    const score = entry.scores?.[benchmark.id];
    return { model: entry, score, rank: score === undefined ? undefined : scoredPool.indexOf(score) + 1 };
  });
  const hovered = hover !== null ? rows[hover] : undefined;
  const readout = hovered ? benchReadout(hovered, rows, scoredPool.length, benchmark) : `${benchmark.name}${benchmark.description ? `, ${benchmark.description}` : ""}.${sample ? " Prices and scores are samples, not official." : ""}`;

  return <section className={styles.section} aria-label="Benchmarks">
    <div className={styles.sectionHead}>
      <h4 className={styles.sectionTitle}>Benchmarks</h4>
      {benchmarks.length > 1 && <SegmentedControl label="Benchmark" className={styles.benchTabs} value={benchmark.id} onValueChange={onBenchmark}
        options={benchmarks.map(entry => ({ value: entry.id, label: entry.shortName ?? entry.name }))} />}
    </div>
    <ul ref={list} className={styles.bars} data-hovering={hovered ? "" : undefined} onPointerLeave={() => setHover(null)}>
      {rows.map((row, index) => {
        const primary = index === 0;
        const text = benchReadout(row, rows, scoredPool.length, benchmark);
        return <li key={index} className={styles.barRow} data-primary={primary || undefined} data-active={hover === index || undefined} tabIndex={active ? 0 : -1} aria-label={text}
          onPointerEnter={() => setHover(index)} onFocus={() => setHover(index)} onBlur={() => setHover(current => current === index ? null : current)}>
          <Mark className={styles.barMark}><Swap k={row.model.id}>{row.model.mark}</Swap></Mark>
          <span className={styles.barName}><Swap k={row.model.name} itemClassName={styles.ellipsis}>{row.model.name}</Swap></span>
          <Bar value={revealed && row.score !== undefined ? row.score / max : 0} primary={primary} reduced={reduced} delay={seen ? 0 : index * .04} />
          <span className={styles.score}>
            {row.score === undefined ? <span className={styles.missing}>None</span>
              : <><Rolling value={revealed ? row.score : 0} format={value => value.toFixed(1)} reduced={reduced} /><span className={styles.unit}>{unit}</span></>}
          </span>
        </li>;
      })}
    </ul>
    <Swap as="div" k={readout} className={styles.readout}>{readout}</Swap>
  </section>;
}

function Pricing({ model, currency, sample, volumeIndex, onVolume, inputShare, reduced, active }: {
  model: ModelCardModel; currency: string; sample: boolean; volumeIndex: number; onVolume: (index: number) => void; inputShare: number; reduced: boolean; active: boolean;
}) {
  const pricing = model.pricing;
  const tokens = volumes[volumeIndex];
  const cost = monthlyCost(model, tokens, inputShare);
  const price = (value?: number) => value === undefined ? notListed : <><Rolling value={value} format={latest => money(latest, currency, 2)} reduced={reduced} /></>;
  return <section className={styles.section} aria-label="Pricing">
    <dl className={styles.specs}>
      <Spec label="Input per 1M">{price(pricing?.input)}</Spec>
      <Spec label="Output per 1M">{price(pricing?.output)}</Spec>
      <Spec label="Cached per 1M">{price(pricing?.cachedInput)}</Spec>
    </dl>
    <div className={styles.estimator}>
      <Slider className={styles.slider} label="Monthly volume" min={0} max={volumes.length - 1} step={1} value={volumeIndex} onValueChange={onVolume}
        format={index => `${formatTokens(volumes[Math.round(index)])} tokens`} showValue disabled={!active || !pricing} />
      <div className={styles.estimate}>
        <span className={styles.estimateLabel}>Estimated cost</span>
        <span className={styles.estimateValue}>
          {cost === undefined ? notListed : <><Rolling value={cost} format={latest => money(latest, currency)} reduced={reduced} className={styles.costNumber} /><span className={styles.unit}>/mo</span></>}
        </span>
      </div>
    </div>
  </section>;
}

function DetailsView({ model, others, benchmarks, benchmark, onBenchmark, currency, sample, volumeIndex, onVolume, inputShare, active, reduced }: {
  model: ModelCardModel; others: ModelCardModel[]; benchmarks: ModelCardBenchmark[]; benchmark?: ModelCardBenchmark; onBenchmark: (id: string) => void;
  currency: string; sample: boolean; volumeIndex: number; onVolume: (index: number) => void; inputShare: number; active: boolean; reduced: boolean;
}) {
  const contexts = [model, ...others].map(entry => entry.contextWindow ?? 0);
  const scale = Math.max(...contexts, 1);
  const context = model.contextWindow;
  const contextText = formatTokens(context);
  return <div className={styles.details}>
    <Swap as="div" k={model.id} className={styles.summary}>{model.summary ?? <span className={styles.missing}>No summary listed.</span>}</Swap>
    <Modalities items={model.modalities ?? []} />
    <div className={styles.limits}>
      <dl className={styles.specs}>
        <Spec label="Context window"><Swap k={contextText ?? "none"}>{contextText ? <>{contextText}<span className={styles.unit}> tokens</span></> : notListed}</Swap></Spec>
        <Spec label="Max output"><Swap k={formatTokens(model.maxOutput) ?? "none"}>{model.maxOutput ? <>{formatTokens(model.maxOutput)}<span className={styles.unit}> tokens</span></> : notListed}</Swap></Spec>
        <Spec label="Knowledge cutoff"><Swap k={model.knowledgeCutoff ?? "none"}>{formatCutoff(model.knowledgeCutoff) ?? notListed}</Swap></Spec>
      </dl>
      <div className={styles.contextRow}>
        <Bar value={context ? context / scale : 0} primary reduced={reduced} className={styles.contextTrack} />
        <span className={styles.pages}>{context ? <>Fits about <Rolling value={pagesFor(context)} format={value => grouped.format(value)} reduced={reduced} /> pages</> : notListed}</span>
      </div>
    </div>
    <Pricing model={model} currency={currency} sample={sample} volumeIndex={volumeIndex} onVolume={onVolume} inputShare={inputShare} reduced={reduced} active={active} />
    {benchmark && <Benchmarks model={model} others={others} benchmarks={benchmarks} benchmark={benchmark} onBenchmark={onBenchmark} sample={sample} active={active} reduced={reduced} />}
  </div>;
}

interface CompareRow { id: string; label: string; a: ReactNode; b: ReactNode; aKey: string; bKey: string; better: number; delta?: string }

/** How much better the winning value is, short enough for a table cell: "2x", "+2.3", "−20%", "+3 mo". */
function deltaText(a: number | undefined, b: number | undefined, kind: "ratio" | "points" | "cheaper" | "months") {
  if (a === undefined || b === undefined || a === b) return undefined;
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (kind === "ratio") return lo > 0 && hi / lo >= 1.5 ? `${trim(hi / lo)}x` : `+${formatTokens(hi - lo)}`;
  if (kind === "points") return `+${(hi - lo).toFixed(1)}`;
  if (kind === "months") return `+${hi - lo} mo`;
  return hi > 0 ? `−${Math.round((hi - lo) / hi * 100)}%` : undefined;
}

function Better({ show: visible, delta, reduced }: { show: boolean; delta?: string; reduced: boolean }) {
  return <span className={styles.betterSlot}>
    <AnimatePresence initial={false}>
      {visible && <motion.span key={`better-${delta ?? ""}`} className={styles.better} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>
        <Check size={14} strokeWidth={2} aria-hidden="true" />{delta && <span className={styles.delta}>{delta}</span>}<span className={styles.srOnly}>, better{delta ? ` by ${delta.replace("−", "")}` : ""}</span>
      </motion.span>}
    </AnimatePresence>
  </span>;
}

function CompareView({ model, other, others, benchmarks, currency, sample, onPick, tokens, inputShare, active, reduced }: {
  model: ModelCardModel; other: ModelCardModel; others: ModelCardModel[]; benchmarks: ModelCardBenchmark[]; currency: string; sample: boolean;
  onPick: (id: string) => void; tokens: number; inputShare: number; active: boolean; reduced: boolean;
}) {
  const tokenCell = (value?: number) => { const text = formatTokens(value); return text ? <>{text}<span className={styles.unit}> tokens</span></> : notListed; };
  const price = (value?: number) => value === undefined ? notListed : money(value, currency, 2);
  const costA = monthlyCost(model, tokens, inputShare), costB = monthlyCost(other, tokens, inputShare);
  const rows: CompareRow[] = [
    { id: "context", label: "Context window", a: tokenCell(model.contextWindow), b: tokenCell(other.contextWindow), aKey: `${model.contextWindow}`, bKey: `${other.contextWindow}`, better: rank(model.contextWindow, other.contextWindow, "higher"), delta: deltaText(model.contextWindow, other.contextWindow, "ratio") },
    { id: "output", label: "Max output", a: tokenCell(model.maxOutput), b: tokenCell(other.maxOutput), aKey: `${model.maxOutput}`, bKey: `${other.maxOutput}`, better: rank(model.maxOutput, other.maxOutput, "higher"), delta: deltaText(model.maxOutput, other.maxOutput, "ratio") },
    { id: "cutoff", label: "Knowledge cutoff", a: formatCutoff(model.knowledgeCutoff) ?? notListed, b: formatCutoff(other.knowledgeCutoff) ?? notListed, aKey: `${model.knowledgeCutoff}`, bKey: `${other.knowledgeCutoff}`, better: rank(monthIndex(model.knowledgeCutoff), monthIndex(other.knowledgeCutoff), "higher"), delta: deltaText(monthIndex(model.knowledgeCutoff), monthIndex(other.knowledgeCutoff), "months") },
    { id: "input", label: "Input price", a: price(model.pricing?.input), b: price(other.pricing?.input), aKey: `${model.pricing?.input}`, bKey: `${other.pricing?.input}`, better: rank(model.pricing?.input, other.pricing?.input, "lower"), delta: deltaText(model.pricing?.input, other.pricing?.input, "cheaper") },
    { id: "output-price", label: "Output price", a: price(model.pricing?.output), b: price(other.pricing?.output), aKey: `${model.pricing?.output}`, bKey: `${other.pricing?.output}`, better: rank(model.pricing?.output, other.pricing?.output, "lower"), delta: deltaText(model.pricing?.output, other.pricing?.output, "cheaper") },
    { id: "cost", label: `Cost at ${formatTokens(tokens)}/mo`, a: costA === undefined ? notListed : money(costA, currency), b: costB === undefined ? notListed : money(costB, currency), aKey: `${costA}`, bKey: `${costB}`, better: rank(costA, costB, "lower"), delta: deltaText(costA, costB, "cheaper") },
  ];
  for (const bench of benchmarks) {
    const a = model.scores?.[bench.id], b = other.scores?.[bench.id];
    const max = bench.max ?? 100, unit = bench.unit ?? "%";
    const cell = (value: number | undefined, primary: boolean) => value === undefined ? notListed
      : <span className={styles.cmpScore}><span className={styles.number}>{value.toFixed(1)}<span className={styles.unit}>{unit}</span></span><Bar value={value / max} primary={primary} reduced={reduced} className={styles.miniTrack} /></span>;
    rows.push({ id: bench.id, label: bench.shortName ?? bench.name, a: cell(a, true), b: cell(b, false), aKey: `${a}`, bKey: `${b}`, better: rank(a, b, "higher"), delta: deltaText(a, b, "points") });
  }

  const wins = rows.filter(row => row.better > 0).length, losses = rows.filter(row => row.better < 0).length;
  const tally = wins === losses ? `Even: each model leads on ${wins} of ${rows.length}.`
    : `${wins > losses ? model.name : other.name} leads on ${Math.max(wins, losses)} of ${rows.length}, ${wins > losses ? other.name : model.name} on ${Math.min(wins, losses)}.`;

  return <div className={styles.compare}>
    <div className={styles.cmpTable} role="table" aria-label={`${model.name} compared with ${other.name}`}>
      <div className={cx(styles.cmpRow, styles.cmpHead)} role="row">
        <span className={styles.cmpCorner} role="columnheader"><span className={styles.srOnly}>Spec</span></span>
        <div className={styles.cmpModel} role="columnheader">
          <Mark className={styles.cmpMark}><Swap k={model.id}>{model.mark}</Swap></Mark><Swap k={model.name} itemClassName={styles.ellipsis}>{model.name}</Swap>
        </div>
        <div className={styles.cmpModel} role="columnheader">
          {others.length > 1
            ? <span className={styles.picker} inert={!active}><DropdownMenu label={other.name} icon={<Mark className={styles.cmpMark}>{other.mark}</Mark>}
                items={others.map(entry => ({ label: entry.name, icon: <Mark className={styles.cmpMark}>{entry.mark}</Mark>, onSelect: () => onPick(entry.id) }))} /></span>
            : <><Mark className={styles.cmpMark}>{other.mark}</Mark><span className={styles.ellipsis}>{other.name}</span></>}
        </div>
      </div>
      <div className={styles.cmpRow} role="row">
        <span className={styles.cmpLabel} role="rowheader">Modalities</span>
        <span className={styles.cmpCell} role="cell"><ModalityIcons items={model.modalities ?? []} /></span>
        <span className={styles.cmpCell} role="cell"><ModalityIcons items={other.modalities ?? []} /></span>
      </div>
      {rows.map(row => (
        <div key={row.id} className={styles.cmpRow} role="row">
          <span className={styles.cmpLabel} role="rowheader">{row.label}</span>
          <span className={styles.cmpCell} role="cell" data-better={row.better > 0 || undefined}>
            <Swap k={`${model.id}-${row.aKey}`} className={styles.cmpValue}>{row.a}</Swap><Better show={row.better > 0} delta={row.delta} reduced={reduced} />
          </span>
          <span className={styles.cmpCell} role="cell" data-better={row.better < 0 || undefined}>
            <Swap k={`${other.id}-${row.bKey}`} className={styles.cmpValue}>{row.b}</Swap><Better show={row.better < 0} delta={row.delta} reduced={reduced} />
          </span>
        </div>
      ))}
    </div>
    <Swap as="div" k={tally} className={styles.tally}>{tally}</Swap>
    <p className={styles.caption}>Prices per 1M tokens. Cost assumes {Math.round(inputShare * 100)}% input. A check marks the better value.{sample ? " Sample figures, not official." : ""}</p>
  </div>;
}

function SkeletonBody() {
  const cells = <span className={styles.boneGrid}>{[0, 1, 2].map(cell => <span key={cell} className={styles.boneCell}><span className={styles.bone} style={{ width: "56%", height: 10 }} /><span className={styles.bone} style={{ width: "44%", height: 14 }} /></span>)}</span>;
  return <div className={styles.skeleton} aria-hidden="true">
    <span className={styles.boneLines}><span className={styles.bone} style={{ width: "94%", height: 12 }} /><span className={styles.bone} style={{ width: "62%", height: 12 }} /></span>
    <span className={styles.boneRow}>{[56, 64, 52, 64, 60, 60, 84].map((width, index) => <span key={index} className={styles.bone} style={{ width, height: 28, borderRadius: 999 }} />)}</span>
    {cells}
    {cells}
    {[0, 1, 2, 3].map(row => <span key={row} className={styles.boneBar}><span className={styles.bone} style={{ width: 16, height: 16, borderRadius: 999 }} /><span className={styles.bone} style={{ width: 96, height: 10 }} /><span className={styles.bone} style={{ flex: 1, height: 6 }} /><span className={styles.bone} style={{ width: 36, height: 10 }} /></span>)}
  </div>;
}

/** One stacked panel. Inactive panels fade out, go inert and keep holding their space, so the card never resizes. */
function Panel({ active, reduced, className, children }: { active: boolean; reduced: boolean; className?: string; children: ReactNode }) {
  return <motion.div className={cx(styles.panel, className)} data-active={active || undefined} inert={!active} aria-hidden={active ? undefined : true}
    initial={false} animate={{ opacity: active ? 1 : 0 }} transition={reduced ? instant : active ? { ...show, delay: .04 } : hide}>
    {children}
  </motion.div>;
}

/**
 * A model details card for model pickers, docs and marketplaces: provider mark, name and summary, modality chips,
 * limits with a context window gauge, prices per million tokens with a live monthly cost estimator, and benchmark
 * bars against rivals with score and rank on hover. The compare switch crossfades to a side by side table against any
 * rival with the better value marked. The card keeps one size in every state. Ships with sample data for Claude Opus 5.5.
 */
export function ModelCard({
  model = modelCardModels.opus,
  rivals = modelCardRivals,
  benchmarks = modelCardBenchmarks,
  view: viewProp,
  defaultView = "details",
  onViewChange,
  compareWith,
  defaultCompareWith,
  onCompareWithChange,
  defaultBenchmark,
  onBenchmarkChange,
  defaultMonthlyTokens = 100e6,
  onMonthlyTokensChange,
  inputShare: inputShareProp = .75,
  currency = "USD",
  sample = true,
  loading = false,
  error,
  onRetry,
  onCopyId,
  onSelect,
  selected = false,
  selectLabel = "Use model",
  className,
  style,
}: ModelCardProps) {
  const reduced = useReducedMotion() ?? false;
  const titleId = useId();
  const others = rivals.filter(entry => entry.id !== model.id);
  const [viewState, setViewState] = useState<ModelCardView>(defaultView);
  const view: ModelCardView = others.length ? viewProp ?? viewState : "details";
  const [compareState, setCompareState] = useState(defaultCompareWith);
  const other = others.find(entry => entry.id === (compareWith ?? compareState)) ?? others[0];
  const scored = benchmarks.filter(entry => model.scores?.[entry.id] !== undefined);
  const [benchState, setBenchState] = useState(defaultBenchmark);
  const benchmark = scored.find(entry => entry.id === benchState) ?? scored[0];
  const [volumeIndex, setVolumeIndex] = useState(() => volumes.reduce((best, tokens, index) => Math.abs(Math.log(tokens / defaultMonthlyTokens)) < Math.abs(Math.log(volumes[best] / defaultMonthlyTokens)) ? index : best, 0));
  const inputShare = Math.min(1, Math.max(0, inputShareProp));
  const [status, setStatus] = useState("");
  const ready = !loading && !error;
  const showCompare = ready && view === "compare" && !!other;
  const showDetails = ready && !showCompare;

  function changeView(next: ModelCardView) {
    if (viewProp === undefined) setViewState(next);
    onViewChange?.(next);
    setStatus(next === "compare" && other ? `Comparing ${model.name} with ${other.name}` : `Showing ${model.name} details`);
  }
  function pick(id: string) {
    if (compareWith === undefined) setCompareState(id);
    onCompareWithChange?.(id);
    const next = others.find(entry => entry.id === id);
    if (next) setStatus(`Comparing ${model.name} with ${next.name}`);
  }
  function chooseBenchmark(id: string) {
    setBenchState(id);
    onBenchmarkChange?.(id);
    const next = scored.find(entry => entry.id === id);
    if (next) setStatus(`Showing ${next.name} scores`);
  }
  function changeVolume(index: number) {
    const next = Math.round(index);
    if (next === volumeIndex) return;
    setVolumeIndex(next);
    onMonthlyTokensChange?.(volumes[next]);
  }

  return <article className={cx(styles.root, className)} style={style} aria-labelledby={titleId} aria-busy={loading || undefined} data-view={view}>
    <header className={styles.header}>
      <div className={styles.identitySlot}>
        <Panel active={!loading} reduced={reduced} className={styles.identity}>
          <Mark className={styles.headMark}><Swap k={model.id}>{model.mark}</Swap></Mark>
          <div className={styles.titles}>
            <h3 id={titleId} className={styles.name}><Swap k={model.name} itemClassName={styles.ellipsis}>{model.name}</Swap></h3>
            <p className={styles.provider}><Swap k={model.provider} itemClassName={styles.ellipsis}>{model.provider}</Swap></p>
          </div>
        </Panel>
        <Panel active={loading} reduced={reduced} className={styles.identity}>
          <span className={styles.bone} style={{ width: 28, height: 28, borderRadius: 999 }} />
          <div className={styles.titles}><span className={styles.bone} style={{ width: 132, height: 14 }} /><span className={styles.bone} style={{ width: 72, height: 10 }} /></div>
        </Panel>
      </div>
      {others.length > 0 && <Switch className={styles.compareSwitch} label="Compare" checked={view === "compare"} disabled={!ready} onCheckedChange={checked => changeView(checked ? "compare" : "details")} />}
    </header>

    <div className={styles.stage}>
      <Panel active={showDetails} reduced={reduced}>
        <DetailsView model={model} others={others} benchmarks={scored} benchmark={benchmark} onBenchmark={chooseBenchmark} currency={currency} sample={sample}
          volumeIndex={volumeIndex} onVolume={changeVolume} inputShare={inputShare} active={showDetails} reduced={reduced} />
      </Panel>
      {other && <Panel active={showCompare} reduced={reduced}>
        <CompareView model={model} other={other} others={others} benchmarks={scored.length ? scored : benchmarks} currency={currency} sample={sample} onPick={pick}
          tokens={volumes[volumeIndex]} inputShare={inputShare} active={showCompare} reduced={reduced} />
      </Panel>}
      <Panel active={loading} reduced={reduced}><SkeletonBody /></Panel>
      <Panel active={!loading && !!error} reduced={reduced}>
        <div className={styles.error} role={!loading && error ? "alert" : undefined}>
          <CircleAlert className={styles.errorIcon} size={16} strokeWidth={1.75} aria-hidden="true" />
          <div className={styles.errorText}>
            <p className={styles.errorTitle}>Couldn&apos;t load model details</p>
            <p className={styles.errorMessage}>{error}</p>
          </div>
          {onRetry && <Button size="sm" variant="secondary" onClick={onRetry}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry</Button>}
        </div>
      </Panel>
    </div>

    <footer className={styles.footer}>
      <div className={styles.footerSlot}>
        <Panel active={!loading} reduced={reduced} className={styles.footerRow}>
          <code className={styles.modelId} title={model.id}><Swap k={model.id} itemClassName={styles.ellipsis}>{model.id}</Swap></code>
          <span className={styles.actions}>
            <CopyButton value={model.id} label="Copy model id" onCopied={() => onCopyId?.(model.id)} />
            {onSelect && <Button size="sm" variant="primary" aria-pressed={selected} onClick={() => onSelect(model)}>
              <span className={styles.selectSlot}>
                <span data-on={!selected || undefined}>{selectLabel}</span>
                <span data-on={selected || undefined}><Check size={14} strokeWidth={2} aria-hidden="true" />Selected</span>
              </span>
            </Button>}
          </span>
        </Panel>
        <Panel active={loading} reduced={reduced} className={styles.footerRow}>
          <span className={styles.bone} style={{ width: 120, height: 12 }} /><span className={styles.bone} style={{ width: 132, height: 32, borderRadius: 999 }} />
        </Panel>
      </div>
    </footer>
    <span className={styles.srOnly} role="status" aria-live="polite">{loading ? "Loading model details" : status}</span>
  </article>;
}

export default ModelCard;
