"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowUpRight, CircleAlert, CircleDashed, Pencil, Play, RotateCcw, Sparkles, Square } from "lucide-react";
import { Button } from "../../button/button";
import { Input } from "../../input/input";
import { Textarea } from "../../textarea/textarea";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { enrichColumnSampleColumn, enrichColumnSampleModel, enrichColumnSampleRows, simulateEnrich } from "./enrich-column-data";
import type { EnrichColumnCell, EnrichColumnDefinition, EnrichColumnEnrich, EnrichColumnModel, EnrichColumnRow, EnrichColumnStatus } from "./enrich-column-types";
import styles from "./enrich-column.module.css";

export type { EnrichColumnCell, EnrichColumnContext, EnrichColumnDefinition, EnrichColumnEnrich, EnrichColumnModel, EnrichColumnResult, EnrichColumnRow, EnrichColumnSource, EnrichColumnStatus } from "./enrich-column-types";
export { enrichColumnSampleColumn, enrichColumnSampleModel, enrichColumnSampleRows, simulateEnrich } from "./enrich-column-data";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const IDLE: EnrichColumnCell = { status: "idle" };
const STAGGER_MS = 140;
const ease = [0.22, 1, 0.36, 1] as const;
const isBusy = (status: EnrichColumnStatus) => status === "queued" || status === "running";

/** Resolves with the task, or rejects as soon as the signal aborts, so a stuck request never holds a slot. */
function raceAbort<T>(task: Promise<T>, signal: AbortSignal) {
  return new Promise<T>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const stop = () => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", stop, { once: true });
    task.then(resolve, reject).finally(() => signal.removeEventListener("abort", stop));
  });
}
const sleep = (ms: number) => new Promise<void>(resolve => window.setTimeout(resolve, ms));

/* Swaps are one crossfade in a shared grid cell: the old content leaves in 100ms, the new arrives in 160ms with a 2px rise. */
const swap = (reduced: boolean) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: 2 },
  animate: { opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease } as Transition },
  exit: { opacity: 0, transition: { duration: reduced ? 0 : .1, ease } as Transition },
});

function Spinner() {
  return <svg className={styles.spinner} width={16} height={16} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".22" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

function DrawnCheck({ reduced }: { reduced: boolean }) {
  return <svg width={16} height={16} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <motion.path d="M3.25 8.5 6.5 11.75 12.75 4.75" initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: .24, ease, delay: .04 }} />
  </svg>;
}

function StatusIcon({ status, reduced }: { status: EnrichColumnStatus; reduced: boolean }) {
  const icon = status === "queued" ? <CircleDashed size={16} strokeWidth={1.75} />
    : status === "running" ? <Spinner />
    : status === "done" ? <DrawnCheck reduced={reduced} />
    : status === "failed" ? <CircleAlert size={16} strokeWidth={1.75} />
    : null;
  return <span className={styles.statusIcon} aria-hidden="true">
    <AnimatePresence initial={false}>
      {icon ? <motion.span key={status} className={styles.stack} data-status={status}
        initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .7 }}
        animate={{ opacity: 1, scale: 1, transition: reduced ? { duration: 0 } : { scale: { type: "spring", visualDuration: .24, bounce: 0 }, opacity: { duration: .12 } } }}
        exit={{ opacity: 0, scale: reduced ? 1 : .7, transition: { duration: reduced ? 0 : .1 } }}>{icon}</motion.span> : null}
    </AnimatePresence>
  </span>;
}

interface CellProps {
  row: EnrichColumnRow;
  cell: EnrichColumnCell;
  reduced: boolean;
  onRun: () => void;
  onRetry: () => void;
}

function EnrichCell({ row, cell, reduced, onRun, onRetry }: CellProps) {
  const { status } = cell;
  const motionProps = swap(reduced);
  const contentKey = status === "running" ? `running:${cell.activity ?? ""}` : `${status}:${cell.value ?? cell.error ?? ""}`;
  const content: ReactNode = status === "idle" ? <span className={styles.muted}>Not run</span>
    : status === "queued" ? <span className={styles.muted}>Queued</span>
    : status === "running" ? <TextShimmer className={styles.shimmer}>{cell.activity ?? "Working"}</TextShimmer>
    : status === "done" ? <span title={cell.value}>{cell.value}</span>
    : <span className={styles.failText}><span className={styles.failLabel}>Failed</span><span className={styles.failReason}>{cell.error ?? "No result"}</span></span>;

  const asideKey = status === "done" && cell.source ? `source:${cell.source.href}` : status === "failed" ? "retry" : "none";
  const aside: ReactNode = asideKey === "retry"
    ? <Button variant="ghost" size="sm" className={styles.retry} onClick={onRetry} aria-label={`Retry ${row.name}`}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.retryLabel}>Retry</span></Button>
    : status === "done" && cell.source
      ? <a className={styles.source} href={cell.source.href} target="_blank" rel="noreferrer noopener" aria-label={`Source for ${row.name}: ${cell.source.label} (opens in a new tab)`}>
        <span className={styles.sourceLabel}>{cell.source.label}</span><ArrowUpRight size={14} strokeWidth={1.75} aria-hidden="true" className={styles.sourceIcon} />
      </a>
      : null;

  const canRun = status === "idle" || status === "done";
  return <div className={styles.cell}>
    <StatusIcon status={status} reduced={reduced} />
    <span className={styles.content}>
      <AnimatePresence initial={false}>
        <motion.span key={contentKey} className={styles.stack} {...motionProps}>{content}</motion.span>
      </AnimatePresence>
    </span>
    <span className={styles.aside}>
      <AnimatePresence initial={false}>
        {aside ? <motion.span key={asideKey} className={styles.stack} {...motionProps}>{aside}</motion.span> : null}
      </AnimatePresence>
    </span>
    <span className={styles.actionSlot}>
      {canRun ? <Tooltip content={status === "done" ? "Re-run row" : "Run row"}>
        <button type="button" className={cx(styles.iconButton, styles.rowAction)} onClick={onRun} aria-label={`${status === "done" ? "Re-run" : "Run"} ${row.name}`}>
          {status === "done" ? <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> : <Play size={14} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </Tooltip> : null}
    </span>
  </div>;
}

export interface EnrichColumnProps {
  /** The table's name above the rows. */
  title?: string;
  /** The rows to enrich. Defaults to seven sample companies. */
  rows?: EnrichColumnRow[];
  /** The AI column's name and prompt on first render. The person can edit both. */
  defaultColumn?: EnrichColumnDefinition;
  /** Called when the person saves an edited column. */
  onColumnChange?: (column: EnrichColumnDefinition) => void;
  /** The model shown in the footer. Pass null to hide it. */
  model?: EnrichColumnModel | null;
  /** Fills one cell. Reject to mark the cell failed with the error's message. Defaults to a local simulation. */
  enrich?: EnrichColumnEnrich;
  /** Values you already have, keyed by row id, such as cells saved from an earlier run. */
  initialCells?: Record<string, EnrichColumnCell>;
  /** How many cells run at once. Defaults to 2. */
  concurrency?: number;
  /** Runs the column once when it first scrolls into view. Defaults to true with the simulation, false with `enrich`. */
  autoRun?: boolean;
  /** Shows the edit control on the column header. Defaults to true. */
  editable?: boolean;
  /** A short note after the row count. Defaults to "sample data" with the simulation. */
  note?: string;
  /** Called whenever a cell changes state. */
  onCellChange?: (row: EnrichColumnRow, cell: EnrichColumnCell) => void;
  /** Called when a run settles, with every cell. */
  onRunComplete?: (cells: Record<string, EnrichColumnCell>) => void;
  className?: string;
}

/**
 * An AI enrichment column for a data table: one prompt runs down every row, each cell shimmers while it works and
 * settles into a value with its source, or a failure with a retry. With no props it runs a simulated sample.
 */
export function EnrichColumn({
  title = "Target accounts",
  rows = enrichColumnSampleRows,
  defaultColumn = enrichColumnSampleColumn,
  onColumnChange,
  model = enrichColumnSampleModel,
  enrich,
  initialCells,
  concurrency = 2,
  autoRun,
  editable = true,
  note,
  onCellChange,
  onRunComplete,
  className,
}: EnrichColumnProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const simulated = !enrich;
  const [column, setColumn] = useState(defaultColumn);
  const [cells, setCells] = useState<Record<string, EnrichColumnCell>>(() => ({ ...initialCells }));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(defaultColumn);
  const [live, setLive] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const inView = useInView(rootRef, { once: true, amount: .35 });

  // Workers read the latest props and state through refs, so a long run never acts on a stale closure.
  const cellsRef = useRef(cells);
  const latest = useRef({ rows, column, enrich: enrich ?? simulateEnrich, concurrency, onCellChange, onRunComplete, simulated });
  useEffect(() => { latest.current = { rows, column, enrich: enrich ?? simulateEnrich, concurrency, onCellChange, onRunComplete, simulated }; });
  const queue = useRef<string[]>([]);
  const workers = useRef(0);
  const controllers = useRef(new Map<string, AbortController>());
  const attempts = useRef(new Map<string, number>());
  const settled = useRef(new Map<string, EnrichColumnCell>());
  const runActive = useRef(false);
  const autoStarted = useRef(false);

  const commit = (next: Record<string, EnrichColumnCell>, changed: string[]) => {
    cellsRef.current = next;
    setCells(next);
    const { rows: currentRows, onCellChange: notify } = latest.current;
    if (notify) for (const rowId of changed) {
      const row = currentRows.find(item => item.id === rowId);
      if (row) notify(row, next[rowId]);
    }
  };
  const patch = (rowId: string, cell: EnrichColumnCell) => commit({ ...cellsRef.current, [rowId]: cell }, [rowId]);

  const summarize = (all: Record<string, EnrichColumnCell>) => {
    const list = latest.current.rows.map(row => all[row.id] ?? IDLE);
    const done = list.filter(cell => cell.status === "done").length;
    const failed = list.filter(cell => cell.status === "failed").length;
    return `${done} of ${list.length} rows enriched${failed ? `, ${failed} failed` : ""}.`;
  };

  const finish = () => {
    if (!runActive.current) return;
    runActive.current = false;
    setLive(summarize(cellsRef.current));
    latest.current.onRunComplete?.(cellsRef.current);
  };

  const runOne = async (rowId: string) => {
    const row = latest.current.rows.find(item => item.id === rowId);
    if (!row) return;
    const controller = new AbortController();
    const { signal } = controller;
    controllers.current.set(rowId, controller);
    const attempt = (attempts.current.get(rowId) ?? 0) + 1;
    attempts.current.set(rowId, attempt);
    const { column: current, enrich: run } = latest.current;
    patch(rowId, { status: "running", activity: "Searching the web" });
    const setActivity = (text: string) => {
      if (!signal.aborted && cellsRef.current[rowId]?.status === "running") patch(rowId, { status: "running", activity: text });
    };
    try {
      const result = await raceAbort(run(row, { prompt: current.prompt, column: current, signal, attempt, setActivity }), signal);
      if (signal.aborted) return;
      const cell: EnrichColumnCell = { status: "done", value: result.value, source: result.source };
      settled.current.set(rowId, cell);
      patch(rowId, cell);
    } catch (error) {
      if (signal.aborted) return;
      const cell: EnrichColumnCell = { status: "failed", error: error instanceof Error && error.message ? error.message : "No result" };
      settled.current.set(rowId, cell);
      patch(rowId, cell);
    } finally {
      if (controllers.current.get(rowId) === controller) controllers.current.delete(rowId);
    }
  };

  const worker = async (delay: number) => {
    if (delay) await sleep(delay);
    while (queue.current.length) {
      const rowId = queue.current.shift();
      if (rowId) await runOne(rowId);
    }
    workers.current -= 1;
    if (workers.current === 0) finish();
  };

  /** Queues rows and tops the worker pool up to the concurrency limit. `fresh` resets retry counts. */
  const runRows = (ids: string[], fresh: boolean) => {
    if (!ids.length) return;
    const next = { ...cellsRef.current };
    for (const rowId of ids) {
      controllers.current.get(rowId)?.abort();
      if (fresh) attempts.current.delete(rowId);
      const previous = next[rowId] ?? IDLE;
      if (!isBusy(previous.status)) settled.current.set(rowId, previous);
      next[rowId] = { status: "queued" };
    }
    queue.current = [...queue.current.filter(rowId => !ids.includes(rowId)), ...ids];
    commit(next, ids);
    runActive.current = true;
    const { column: current, simulated: sim, rows: all } = latest.current;
    const scope = ids.length === all.length ? `all ${all.length} rows` : ids.length === 1 ? all.find(row => row.id === ids[0])?.name ?? "1 row" : `${ids.length} rows`;
    setLive(`Running ${current.name} on ${scope}.${sim ? " Simulated with sample values, nothing was sent." : ""}`);
    const room = Math.min(Math.max(1, latest.current.concurrency) - workers.current, queue.current.length);
    for (let index = 0; index < room; index += 1) {
      workers.current += 1;
      void worker(index * STAGGER_MS);
    }
  };

  const runAll = () => runRows(latest.current.rows.map(row => row.id), true);

  const stop = (announce = true) => {
    queue.current = [];
    const next = { ...cellsRef.current };
    const changed: string[] = [];
    for (const row of latest.current.rows) {
      const cell = next[row.id];
      if (cell && isBusy(cell.status)) {
        controllers.current.get(row.id)?.abort();
        next[row.id] = settled.current.get(row.id) ?? IDLE;
        changed.push(row.id);
      }
    }
    runActive.current = false;
    if (changed.length) commit(next, changed);
    if (announce) setLive(`Stopped. ${summarize(next)}`);
  };

  useEffect(() => {
    const active = controllers.current;
    return () => { queue.current = []; active.forEach(controller => controller.abort()); };
  }, []);

  // The sample runs itself once, shortly after it scrolls into view.
  const shouldAutoRun = autoRun ?? simulated;
  useEffect(() => {
    if (!shouldAutoRun || !inView || autoStarted.current) return;
    const timer = window.setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      const untouched = latest.current.rows.every(row => (cellsRef.current[row.id] ?? IDLE).status === "idle");
      if (untouched) runAll();
    }, 450);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoRun, inView]);

  useEffect(() => {
    if (!editing) return;
    const field = promptRef.current;
    if (!field) return;
    field.focus();
    field.setSelectionRange(field.value.length, field.value.length);
  }, [editing]);

  const openEditor = () => { setDraft(column); setEditing(true); };
  const closeEditor = () => { setEditing(false); window.requestAnimationFrame(() => editRef.current?.focus()); };
  const draftValid = draft.name.trim().length > 0 && draft.prompt.trim().length > 0;
  const save = (event?: FormEvent) => {
    event?.preventDefault();
    if (!draftValid) return;
    const next = { name: draft.name.trim(), prompt: draft.prompt.trim() };
    autoStarted.current = true;
    stop(false);
    setColumn(next);
    latest.current.column = next;
    onColumnChange?.(next);
    closeEditor();
    runAll();
  };
  const editorKeys = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.key === "Escape") { event.preventDefault(); closeEditor(); }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) save(event);
  };

  const list = rows.map(row => cells[row.id] ?? IDLE);
  const busy = list.some(cell => isBusy(cell.status));
  const doneCount = list.filter(cell => cell.status === "done").length;
  const failedCount = list.filter(cell => cell.status === "failed").length;
  const hasRun = doneCount + failedCount > 0;
  const noteText = note ?? (simulated ? "sample data" : undefined);
  const progress: ReactNode = busy || hasRun ? <><span className={styles.num}><span className={styles.numGhost} aria-hidden="true">{rows.length}</span><span>{doneCount}</span></span> of {rows.length} done</> : "Not run yet";
  const runLabel = busy ? "Stop" : hasRun ? "Re-run column" : "Run column";
  const panelId = `${id}-editor`;
  const heightSpring: Transition = reduced ? { duration: 0 } : { height: { type: "spring", visualDuration: .24, bounce: 0 }, opacity: { duration: .16, ease } };

  return <div ref={rootRef} className={cx(styles.root, className)}>
    <div className={styles.card}>
      <div className={styles.top}>
        <div className={styles.heading}>
          <span className={styles.title}>{title}</span>
          <span className={styles.count}>{rows.length} {rows.length === 1 ? "row" : "rows"}{noteText ? ` · ${noteText}` : ""}</span>
        </div>
        <Button variant={busy ? "secondary" : "primary"} size="sm" className={styles.run} disabled={!rows.length}
          onClick={() => busy ? stop() : runAll()} aria-label={busy ? "Stop the run" : `${hasRun ? "Re-run" : "Run"} ${column.name} on every row`}>
          {busy ? <Square size={14} strokeWidth={1.75} fill="currentColor" aria-hidden="true" /> : hasRun ? <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" /> : <Play size={14} strokeWidth={1.75} fill="currentColor" aria-hidden="true" />}
          {runLabel}
        </Button>
      </div>

      <AnimatePresence initial={false}>
        {editing ? <motion.div key="editor" id={panelId} className={styles.editorClip} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={heightSpring}>
          <form className={styles.editor} onSubmit={save} onKeyDown={editorKeys} aria-label="Edit AI column">
            <Input label="Column name" value={draft.name} onChange={event => setDraft(value => ({ ...value, name: event.target.value }))} maxLength={48} autoComplete="off" />
            <Textarea ref={promptRef} label="Prompt" value={draft.prompt} rows={2} onChange={event => setDraft(value => ({ ...value, prompt: event.target.value }))} maxLength={280} />
            <div className={styles.editorActions}>
              <span className={styles.hint}>Saving re-runs every row</span>
              <Button type="button" variant="secondary" size="sm" onClick={closeEditor}>Cancel</Button>
              <Button type="submit" variant="primary" size="sm" disabled={!draftValid}>Save and run</Button>
            </div>
          </form>
        </motion.div> : null}
      </AnimatePresence>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <colgroup><col className={styles.colCompany} /><col /></colgroup>
          <thead>
            <tr>
              <th scope="col" className={styles.headCompany}>Company</th>
              <th scope="col" className={styles.headAi}>
                <div className={styles.aiHead}>
                  <Sparkles size={16} strokeWidth={1.75} className={styles.aiIcon} aria-hidden="true" />
                  <span className={styles.aiText}>
                    <AnimatePresence initial={false}>
                      <motion.span key={`${column.name}\n${column.prompt}`} className={cx(styles.stack, styles.aiTextInner)} {...swap(reduced)}>
                        <span className={styles.aiName}>{column.name}</span>
                        <span className={styles.aiPrompt} title={column.prompt}>{column.prompt}</span>
                      </motion.span>
                    </AnimatePresence>
                  </span>
                  {editable ? <Tooltip content="Edit column">
                    <button ref={editRef} type="button" className={styles.iconButton} onClick={() => editing ? closeEditor() : openEditor()}
                      aria-label={`Edit column: ${column.name}`} aria-expanded={editing} aria-controls={editing ? panelId : undefined} data-active={editing || undefined}>
                      <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                    </button>
                  </Tooltip> : null}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.length ? rows.map(row => {
              const cell = cells[row.id] ?? IDLE;
              return <tr key={row.id}>
                <th scope="row" className={styles.companyCell}>
                  <span className={styles.company}>
                    {row.logo ? <span className={styles.logo} aria-hidden="true">{row.logo}</span> : <span className={styles.logoFallback} aria-hidden="true">{row.name.slice(0, 1)}</span>}
                    <span className={styles.companyText}>
                      <span className={styles.name}>{row.name}</span>
                      {row.domain ? <span className={styles.domain}>{row.domain}</span> : null}
                    </span>
                  </span>
                </th>
                <td className={styles.aiCell} data-status={cell.status}>
                  <EnrichCell row={row} cell={cell} reduced={reduced} onRun={() => runRows([row.id], true)} onRetry={() => runRows([row.id], false)} />
                </td>
              </tr>;
            }) : <tr><td colSpan={2} className={styles.empty}>No rows yet. Add rows to run this column.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className={styles.foot}>
        {model ? <span className={styles.model}>
          {model.mark ? <span className={styles.modelMark} aria-hidden="true">{model.mark}</span> : null}
          <span className={styles.modelName}>{model.name}{model.detail ? <span className={styles.modelDetail}> · {model.detail}</span> : null}</span>
        </span> : <span />}
        <span className={styles.progress}>
          <span>{progress}</span>
          {failedCount ? <span className={styles.progressFailed}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" />{failedCount} failed</span> : null}
        </span>
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{live}</span>
  </div>;
}

export default EnrichColumn;
