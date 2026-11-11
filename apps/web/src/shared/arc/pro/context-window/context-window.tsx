"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ChevronDown, CircleCheck, FilePlus2, Info, Send, Shrink, TriangleAlert } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { CATEGORY_NAME, CATEGORY_ORDER, sampleFiles, sampleItems, sampleModels, sampleTurns, type ContextCategory, type ContextItem, type ContextModel, type ContextTurn } from "./context-window-data";
import styles from "./context-window.module.css";

export type { ContextCategory, ContextItem, ContextModel, ContextTurn } from "./context-window-data";
export { sampleFiles, sampleItems, sampleModels, sampleTurns } from "./context-window-data";

const { duration, ease } = motionTokens;
const standard = [...ease.standard] as [number, number, number, number];

const COLUMNS = 20;
const CELLS = 200;
/** Turns kept word for word when a compaction folds the rest into the summary. */
const KEEP_TURNS = 2;
const SUMMARIZE_MS = 720;

type Kind = ContextCategory | "free" | "reserve";
type Tone = "info" | "warning" | "working" | "success";
interface Status { tone: Tone; text: string }

export interface ContextCompaction {
  /** Tokens of messages folded into the summary. */
  folded: number;
  /** Size of the summary after this compaction. */
  summary: number;
  before: number;
  after: number;
  automatic: boolean;
}

export interface ContextWindowProps {
  /** Models to switch between. Defaults to Claude Opus 5.5 (1M), Kimi K3 and GPT-6 Luna (sample settings). */
  models?: ContextModel[];
  defaultModelId?: string;
  onModelChange?: (model: ContextModel) => void;
  /** What is in the window, in any order. Each item belongs to a category: system, tools, files, summary or messages. */
  items?: ContextItem[];
  /** Fraction of the window at which compaction runs on its own. Defaults to 0.8. */
  threshold?: number;
  /** Turns that Send message adds, in order. Each is a message plus the tool results and reply it produced. */
  turns?: ContextTurn[];
  /** Files that Attach file adds, in order. */
  files?: ContextTurn[];
  /** Returns the summary size for the folded messages. Defaults to about 6% of them, between 4K and 24K tokens. */
  summarize?: (folded: ContextItem[]) => number;
  onCompact?: (compaction: ContextCompaction) => void;
  onItemsChange?: (items: ContextItem[]) => void;
  className?: string;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------------------------------------------- */

export function formatTokens(value: number) {
  if (value >= 1_000_000) return `${+(value / 1_000_000).toFixed(value % 1_000_000 ? 2 : 0)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (value >= 1_000) return `${+(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

const formatPercent = (fraction: number) => fraction > 0 && fraction < .095 ? `${(fraction * 100).toFixed(1)}%` : `${Math.round(fraction * 100)}%`;

const totalsOf = (items: ContextItem[]) => {
  const totals: Record<ContextCategory, number> = { system: 0, tools: 0, files: 0, summary: 0, messages: 0 };
  for (const item of items) totals[item.category] += item.tokens;
  return totals;
};

const sum = (items: ContextItem[]) => items.reduce((total, item) => total + item.tokens, 0);

/** Fills cells in reading order: each category in turn, then free space, with the output reserve as the last cells. */
function layoutCells(totals: Record<ContextCategory, number>, model: ContextModel): Kind[] {
  const perCell = model.window / CELLS;
  const reserveCells = Math.max(1, Math.round(model.reserve / perCell));
  const usable = CELLS - reserveCells;
  const cells: Kind[] = [];
  let running = 0;
  for (const category of CATEGORY_ORDER) {
    const tokens = totals[category];
    if (!tokens) continue;
    running += tokens;
    // Every category that holds tokens keeps at least one cell, so nothing in the legend is invisible in the grid.
    const end = Math.min(usable, Math.max(cells.length + 1, Math.round(running / perCell)));
    while (cells.length < end) cells.push(category);
  }
  while (cells.length < usable) cells.push("free");
  while (cells.length < CELLS) cells.push("reserve");
  return cells;
}

const defaultSummarize = (folded: ContextItem[]) => Math.min(24_000, Math.max(4_000, Math.round(sum(folded) * .06 / 100) * 100));

/** Counts from the value on screen to the new one, so a number in flight retargets instead of restarting. */
function useRolling(value: number, reduced: boolean) {
  const [shown, setShown] = useState(value);
  const shownRef = useRef(value);
  useEffect(() => {
    if (reduced) { shownRef.current = value; return; }
    const from = shownRef.current;
    if (from === value) return;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      const next = from + (value - from) * (1 - Math.pow(1 - t, 3));
      shownRef.current = next;
      setShown(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, reduced]);
  return reduced ? value : shown;
}

/* ---------------------------------------------------------------------------------------------------------------
 * Parts
 * ------------------------------------------------------------------------------------------------------------- */

function ModelMenu({ models, model, onChange, disabled }: { models: ContextModel[]; model: ContextModel; onChange: (id: string) => void; disabled: boolean }) {
  const Mark = model.mark;
  return <Menu.Root>
    <Menu.Trigger className={styles.modelTrigger} disabled={disabled} aria-label={`Model: ${model.name}, ${formatTokens(model.window)} context. Change model`}>
      <Mark className={styles.modelMark} style={model.color ? { color: model.color } : undefined} aria-hidden="true" focusable="false" />
      <span className={styles.modelName}>{model.name}</span>
      <span className={styles.modelWindow}>{formatTokens(model.window)}</span>
      <ChevronDown className={styles.modelChevron} aria-hidden="true" />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={12} loop>
        <Menu.RadioGroup value={model.id} onValueChange={onChange}>
          {models.map(item => {
            const ItemMark = item.mark;
            return <Menu.RadioItem key={item.id} value={item.id} textValue={item.name} className={styles.menuItem}>
              <ItemMark className={styles.modelMark} style={item.color ? { color: item.color } : undefined} aria-hidden="true" focusable="false" />
              <span className={styles.menuName}>{item.name}</span>
              <span className={styles.menuWindow}>{formatTokens(item.window)}</span>
              <span className={styles.menuCheck}><Menu.ItemIndicator><Check aria-hidden="true" /></Menu.ItemIndicator></span>
            </Menu.RadioItem>;
          })}
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Portal>
  </Menu.Root>;
}

function LegendRow({ kind, tokens, window, reduced, empty, onHover }: { kind: Kind; tokens: number; window: number; reduced: boolean; empty?: string; onHover: (kind: Kind | null) => void }) {
  const shown = useRolling(tokens, reduced);
  return <li className={styles.legendRow} data-kind={kind} data-empty={!tokens || undefined}
    onPointerEnter={() => onHover(kind)} onPointerLeave={() => onHover(null)}>
    <span className={styles.swatch} data-kind={kind} aria-hidden="true" />
    <span className={styles.legendName}>{CATEGORY_NAME[kind]}</span>
    <span className={styles.legendTokens}>{tokens ? formatTokens(shown) : empty ?? "0"}</span>
    <span className={styles.legendPercent}>{tokens ? formatPercent(shown / window) : ""}</span>
  </li>;
}

const TONE_ICON = { info: Info, warning: TriangleAlert, success: CircleCheck, working: Shrink } as const;

/* ---------------------------------------------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------------------------------------------- */

/**
 * A model's context window as a fixed budget that fills in reading order: system prompt, tools, files, a summary and
 * the conversation, then free space, with the output reserve held at the end. Sending messages fills it; at the
 * threshold the older messages fold into a short summary and the space comes back.
 */
export function ContextWindow({
  models = sampleModels, defaultModelId, onModelChange, items: itemsProp, threshold = .8,
  turns = sampleTurns, files = sampleFiles, summarize = defaultSummarize, onCompact, onItemsChange, className,
}: ContextWindowProps) {
  const reduced = !!useReducedMotion();
  const [modelId, setModelId] = useState(defaultModelId ?? models[0]?.id ?? "");
  const model = models.find(item => item.id === modelId) ?? models[0]!;
  const [items, setItemsState] = useState<ContextItem[]>(() => itemsProp ?? sampleItems);
  const [phase, setPhase] = useState<"idle" | "summarizing">("idle");
  const [wave, setWave] = useState({ from: 0, step: 4 });
  const [hover, setHover] = useState<Kind | null>(null);
  const [status, setStatus] = useState<Status>({ tone: "info", text: `Compacts on its own at ${Math.round(threshold * 100)}%` });
  const turnIndex = useRef(0);
  const fileIndex = useRef(0);
  const sent = useRef(0);
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const setItems = useCallback((next: ContextItem[]) => { setItemsState(next); onItemsChange?.(next); }, [onItemsChange]);

  const totals = useMemo(() => totalsOf(items), [items]);
  const used = sum(items);
  const cells = useMemo(() => layoutCells(totals, model), [totals, model]);
  const thresholdCell = Math.round(threshold * CELLS);
  const free = Math.max(0, model.window - model.reserve - used);
  const usedShown = useRolling(used, reduced);
  const perCell = model.window / CELLS;
  const cellAt = (tokens: number) => Math.min(CELLS - 1, Math.floor(tokens / perCell));
  const busy = phase === "summarizing";
  const messageCount = items.filter(item => item.category === "messages").length;

  /* Compaction ---------------------------------------------------------------------------------------------------- */
  const compact = useCallback((current: ContextItem[], activeModel: ContextModel, automatic: boolean, reason?: string) => {
    const messages = current.filter(item => item.category === "messages");
    const folded = messages.slice(0, Math.max(0, messages.length - KEEP_TURNS));
    if (!folded.length) { setStatus({ tone: "info", text: "Nothing to compact yet" }); return; }
    setPhase("summarizing");
    setStatus({ tone: "working", text: `${reason ? `${reason}. ` : ""}Summarizing ${folded.length} older messages` });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const previous = current.find(item => item.category === "summary");
      const summaryTokens = (previous?.tokens ?? 0) + summarize(folded);
      const foldedIds = new Set(folded.map(item => item.id));
      const kept = current.filter(item => !foldedIds.has(item.id) && item.category !== "summary");
      const summary: ContextItem = { id: "summary", category: "summary", label: "Summary of earlier turns", tokens: summaryTokens };
      const next = [...kept.filter(item => item.category !== "messages"), summary, ...kept.filter(item => item.category === "messages")];
      const before = sum(current), after = sum(next);
      const preamble = sum(next.filter(item => item.category !== "summary" && item.category !== "messages"));
      setWave({ from: Math.floor(preamble / (activeModel.window / CELLS)), step: 3 });
      setItems(next);
      setPhase("idle");
      const foldedTokens = sum(folded);
      setStatus(after >= threshold * activeModel.window
        ? { tone: "warning", text: `Compacted ${formatTokens(foldedTokens)}, still above ${Math.round(threshold * 100)}%. Remove files to make room` }
        : { tone: "success", text: `Compacted ${formatTokens(foldedTokens)} of messages into a ${formatTokens(summaryTokens - (previous?.tokens ?? 0))} summary` });
      onCompact?.({ folded: foldedTokens, summary: summaryTokens, before, after, automatic });
    }, reduced ? 0 : SUMMARIZE_MS);
  }, [onCompact, reduced, setItems, summarize, threshold]);

  /** Runs compaction on its own once a change crosses the threshold, after a beat so the crossing is visible. */
  const afterChange = (next: ContextItem[], activeModel: ContextModel, text: string) => {
    const limit = threshold * activeModel.window, total = sum(next);
    if (total < limit) {
      setStatus(total > limit * .85 ? { tone: "warning", text: `${text}. Compaction runs at ${Math.round(threshold * 100)}%` } : { tone: "info", text });
      return;
    }
    setStatus({ tone: "warning", text: `${text}. Crossed ${Math.round(threshold * 100)}%` });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => compact(next, activeModel, true, `Crossed ${Math.round(threshold * 100)}%`), reduced ? 0 : 520);
  };

  /* Actions -------------------------------------------------------------------------------------------------------- */
  const send = () => {
    if (busy || !turns.length) return;
    const turn = turns[turnIndex.current++ % turns.length]!;
    const next = [...items, { id: `sent-${++sent.current}`, category: "messages" as const, label: turn.label, tokens: turn.tokens }];
    setWave({ from: cellAt(used), step: 9 });
    setItems(next);
    afterChange(next, model, `Sent "${turn.label}" · +${formatTokens(turn.tokens)}`);
  };

  const attach = () => {
    if (busy || !files.length) return;
    const file = files[fileIndex.current++ % files.length]!;
    const lastFile = items.reduce((index, item, i) => item.category === "files" ? i : index, -1);
    const filesEnd = totals.system + totals.tools + totals.files;
    const added: ContextItem = { id: `file-${fileIndex.current}-${file.label}`, category: "files", label: file.label, tokens: file.tokens };
    const next = [...items.slice(0, lastFile + 1), added, ...items.slice(lastFile + 1)];
    setWave({ from: cellAt(filesEnd), step: 3 });
    setItems(next);
    afterChange(next, model, `Attached ${file.label} · +${formatTokens(file.tokens)}`);
  };

  const switchModel = (id: string) => {
    const nextModel = models.find(item => item.id === id);
    if (!nextModel || nextModel.id === model.id || busy) return;
    setModelId(id);
    onModelChange?.(nextModel);
    setWave({ from: 0, step: 1.4 });
    const fits = used < threshold * nextModel.window;
    if (fits) { setStatus({ tone: "info", text: `Switched to ${nextModel.name} · ${formatTokens(nextModel.window)} window` }); return; }
    setStatus({ tone: "warning", text: `${formatTokens(used)} is over ${Math.round(threshold * 100)}% of ${nextModel.name}'s window` });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => compact(items, nextModel, true, `Too full for ${nextModel.name}`), reduced ? 0 : 640);
  };

  /* Render --------------------------------------------------------------------------------------------------------- */
  const firstMessage = cells.indexOf("messages");
  const lastMessage = cells.lastIndexOf("messages");
  const StatusIcon = TONE_ICON[status.tone];
  const legend: Kind[] = ["system", "tools", "files", "summary", "messages", "free", "reserve"];
  const tokensOf = (kind: Kind) => kind === "free" ? free : kind === "reserve" ? model.reserve : totals[kind];
  const description = `${model.name} context window, ${formatTokens(used)} of ${formatTokens(model.window)} tokens used. ` +
    legend.map(kind => `${CATEGORY_NAME[kind]} ${formatTokens(tokensOf(kind))}`).join(", ") + `. Compaction runs at ${Math.round(threshold * 100)}%.`;

  return <section className={[styles.root, className].filter(Boolean).join(" ")} data-phase={phase} data-hover={hover ?? undefined} aria-label="Context window">
    <header className={styles.header}>
      <div className={styles.readout}>
        <p className={styles.used}><span className={styles.usedValue}>{formatTokens(usedShown)}</span><span className={styles.usedOf}>of {formatTokens(model.window)} tokens</span></p>
        <p className={styles.usedMeta}>
          <span className={styles.tabular}>{formatPercent(usedShown / model.window)}</span> used
          <span className={styles.dot} aria-hidden="true" />
          {formatTokens(free)} free
        </p>
      </div>
      <ModelMenu models={models} model={model} onChange={switchModel} disabled={busy} />
    </header>

    <div className={styles.body}>
      <div className={styles.gridWrap}>
        <div className={styles.grid} role="img" aria-label={description} style={{ "--columns": COLUMNS } as CSSProperties}>
          {cells.map((kind, index) => {
            const delay = index >= wave.from ? Math.min((index - wave.from) * wave.step, 360) : 0;
            const sweep = busy && kind === "messages" ? (index - firstMessage) * Math.min(6, 420 / Math.max(1, lastMessage - firstMessage)) : undefined;
            return [
              index === thresholdCell ? <div key="threshold" className={styles.threshold} aria-hidden="true" /> : null,
              <span key={index} className={styles.cell} data-kind={kind} data-after={index >= thresholdCell && kind === "free" ? "" : undefined}
                style={{ "--delay": `${reduced ? 0 : delay}ms`, "--sweep": sweep === undefined ? undefined : `${sweep}ms` } as CSSProperties} />,
            ];
          })}
        </div>
        <p className={styles.gridNote}>
          <span>Each cell is {formatTokens(model.window / CELLS)} tokens</span>
          <span className={styles.thresholdKey}><span className={styles.thresholdSwatch} aria-hidden="true" />Compacts at {Math.round(threshold * 100)}%</span>
        </p>
      </div>

      <ul className={styles.legend} aria-label="What fills the window">
        {legend.map(kind => <LegendRow key={kind} kind={kind} tokens={tokensOf(kind)} window={model.window} reduced={reduced}
          empty={kind === "summary" ? "None yet" : undefined} onHover={setHover} />)}
      </ul>
    </div>

    <footer className={styles.footer}>
      <div className={styles.actions}>
        <Button variant="primary" size="sm" onClick={send} disabled={busy}><Send aria-hidden="true" />Send message</Button>
        <Button variant="secondary" size="sm" onClick={attach} disabled={busy}><FilePlus2 aria-hidden="true" />Attach file</Button>
        <Button variant="ghost" size="sm" className={styles.compact} onClick={() => compact(items, model, false)} disabled={busy || messageCount <= KEEP_TURNS}><Shrink aria-hidden="true" />Compact now</Button>
      </div>
      <div className={styles.statusSlot} role="status" aria-live="polite">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.p key={`${status.tone}-${status.text}`} className={styles.status} data-tone={status.tone}
            initial={reduced ? false : { opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease: standard } }}
            transition={{ duration: reduced ? 0 : duration.fast, ease: standard }}>
            <StatusIcon className={styles.statusIcon} aria-hidden="true" />
            {status.tone === "working" ? <TextShimmer>{status.text}</TextShimmer> : <span>{status.text}</span>}
          </motion.p>
        </AnimatePresence>
      </div>
    </footer>
  </section>;
}

export default ContextWindow;
