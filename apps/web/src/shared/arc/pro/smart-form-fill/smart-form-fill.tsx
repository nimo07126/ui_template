"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { Building2, Check, CircleAlert, CircleCheck, CircleX, PenLine, RotateCcw, Square } from "lucide-react";
import { Button } from "../../button/button";
import { Kbd } from "../kbd/kbd";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { simulateExtract, smartFormFillDefaultFields, smartFormFillSamples } from "./smart-form-fill-data";
import type { SmartFormFillExtracted, SmartFormFillField, SmartFormFillResult, SmartFormFillSample, SmartFormFillValues } from "./smart-form-fill-data";
import { ClaudeMark, companyMark } from "./smart-form-fill-marks";
import styles from "./smart-form-fill.module.css";

export type { SmartFormFillExtracted, SmartFormFillField, SmartFormFillFieldKind, SmartFormFillResult, SmartFormFillSample, SmartFormFillValues } from "./smart-form-fill-data";
export { parseContact, simulateExtract, smartFormFillDefaultFields, smartFormFillSamples } from "./smart-form-fill-data";

export interface SmartFormFillModel {
  name: string;
  mark?: ReactNode;
}

export interface SmartFormFillProps {
  /** The form. Defaults to a contact: name, title, company, email, phone, address. */
  fields?: SmartFormFillField[];
  /** Starting values, keyed by field id. */
  defaultValues?: SmartFormFillValues;
  /** Called on every change, typed or filled. */
  onValuesChange?: (values: SmartFormFillValues) => void;
  /** Reads the pasted text. Defaults to a simulated read with a local parser. Abort when the signal fires. */
  extract?: (text: string, signal: AbortSignal) => Promise<SmartFormFillResult>;
  /** Fields below this confidence ask for review. Defaults to 0.8. */
  reviewThreshold?: number;
  /** Texts behind "Try sample", cycled in order. Pass [] to hide the button. */
  samples?: SmartFormFillSample[];
  /** Plays the paste, fill, review and undo loop until someone interacts. Defaults to true when `extract` is not set. */
  autoPlay?: boolean;
  /** Called once every field from a read has been filled. */
  onFill?: (result: SmartFormFillResult) => void;
  /** Called after Undo restores the values from before the last fill. */
  onUndo?: (restored: SmartFormFillValues) => void;
  /** Saves the form. Defaults to a simulated save. Fields that still need review are focused first. */
  onSubmit?: (values: SmartFormFillValues) => void | Promise<void>;
  /** Company logo for the company field. Falls back to built-in marks (Stripe, Linear, Vercel, Figma, Notion). */
  resolveLogo?: (company: string) => ReactNode | undefined;
  /** The model shown beside the paste area. Defaults to Claude Haiku 5.5. */
  model?: SmartFormFillModel;
  title?: string;
  description?: string;
  submitLabel?: string;
  className?: string;
}

type Phase = "idle" | "reading" | "filling" | "done" | "error";
type FieldState = "ok" | "review" | "checked" | "edited";
type FieldMeta = SmartFormFillExtracted & { state: FieldState };
type Tone = "neutral" | "success" | "warning" | "danger";
type Status = { text: string; tone: Tone; sr?: string };

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const FILL_STEP = 140;
const defaultModel: SmartFormFillModel = { name: "Claude Haiku 5.5", mark: <ClaudeMark size={14} /> };
const swap: Transition = { duration: 0.16, ease: [0.22, 1, 0.36, 1] };
const swapOut: Transition = { duration: 0.1, ease: [0.22, 1, 0.36, 1] };
const listFormat = (items: string[]) => items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
const lineCount = (text: string) => text.split(/\r?\n/).filter((line) => line.trim()).length;
const emptyValues = (fields: SmartFormFillField[], from?: SmartFormFillValues) => Object.fromEntries(fields.map((field) => [field.id, from?.[field.id] ?? ""]));
const inputType = (kind?: SmartFormFillField["kind"]) => kind === "email" ? "email" : kind === "tel" ? "tel" : kind === "url" ? "url" : "text";
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError" || (error as { name?: string } | undefined)?.name === "AbortError";

/** One text in, the next text out: a single crossfade (out 100ms, in 160ms with a 2px rise), never a size change. */
function Swap({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  return (
    <span className={cx(styles.swap, className)}>
      <AnimatePresence initial={false}>
        <motion.span
          key={id}
          className={styles.swapItem}
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0, transition: swap }}
          exit={{ opacity: 0, transition: swapOut }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** Splits the pasted text into plain runs and highlighted spans for every field that has a source. */
function segmentsFor(text: string, meta: Record<string, FieldMeta>, order: string[]) {
  const ranges: { id: string; start: number; end: number }[] = [];
  for (const id of order) {
    const source = meta[id]?.source;
    if (!source) continue;
    let from = 0, start = text.indexOf(source, from);
    while (start !== -1 && ranges.some((range) => start < range.end && start + source.length > range.start)) {
      from = start + 1;
      start = text.indexOf(source, from);
    }
    if (start !== -1) ranges.push({ id, start, end: start + source.length });
  }
  ranges.sort((a, b) => a.start - b.start);
  const parts: { text: string; id?: string }[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) parts.push({ text: text.slice(cursor, range.start) });
    parts.push({ text: text.slice(range.start, range.end), id: range.id });
    cursor = range.end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor) });
  return parts;
}

export function SmartFormFill({
  fields = smartFormFillDefaultFields,
  defaultValues,
  onValuesChange,
  extract,
  reviewThreshold = 0.8,
  samples = smartFormFillSamples,
  autoPlay,
  onFill,
  onUndo,
  onSubmit,
  resolveLogo,
  model = defaultModel,
  title = "New contact",
  description = "Paste a signature, an email or rough notes. AI fills the fields and flags anything to check.",
  submitLabel = "Save contact",
  className,
}: SmartFormFillProps) {
  const uid = useId();
  const reduced = useReducedMotion() ?? false;
  const simulated = !extract;
  const read = extract ?? simulateExtract;
  const order = useMemo(() => fields.map((field) => field.id), [fields]);
  const labelOf = useCallback((id: string) => fields.find((field) => field.id === id)?.label ?? id, [fields]);

  const [text, setText] = useState("");
  const [view, setView] = useState<"edit" | "source">("edit");
  const [phase, setPhase] = useState<Phase>("idle");
  const [values, setValues] = useState<SmartFormFillValues>(() => emptyValues(fields, defaultValues));
  const [meta, setMeta] = useState<Record<string, FieldMeta>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [filling, setFilling] = useState<{ id: string | null; done: number; total: number }>({ id: null, done: 0, total: 0 });
  const [snapshot, setSnapshot] = useState<SmartFormFillValues | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ text: "Paste text to fill the form", tone: "neutral" });
  const [saving, setSaving] = useState(false);
  const [sampleIndex, setSampleIndex] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const controllerRef = useRef<AbortController | null>(null);
  const timersRef = useRef<number[]>([]);
  const valuesRef = useRef(values);
  const metaRef = useRef(meta);
  const startedAt = useRef(0);
  const settleRef = useRef<(() => void) | null>(null);
  useLayoutEffect(() => {
    valuesRef.current = values;
    metaRef.current = meta;
  });

  const commitValues = useCallback((next: SmartFormFillValues) => {
    valuesRef.current = next;
    setValues(next);
    onValuesChange?.(next);
  }, [onValuesChange]);

  const clearTimers = () => { timersRef.current.forEach((timer) => window.clearTimeout(timer)); timersRef.current = []; };
  useEffect(() => () => { clearTimers(); controllerRef.current?.abort(); }, []);

  const pending = order.filter((id) => meta[id]?.state === "review");

  /** Reads the text, then fills each field in form order, one beat apart, each with a quick highlight. */
  const run = useCallback(async (source: string) => {
    const input = source.trim();
    if (!input) return;
    controllerRef.current?.abort();
    clearTimers();
    const controller = new AbortController();
    controllerRef.current = controller;
    startedAt.current = performance.now();
    setView("source");
    setPhase("reading");
    setMeta({});
    setActive(null);
    setFilling({ id: null, done: 0, total: 0 });
    setStatus({ text: `Reading ${lineCount(input)} lines`, tone: "neutral" });

    let result: SmartFormFillResult;
    try {
      result = await read(source, controller.signal);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      setPhase("error");
      setStatus({ text: "Couldn't read that text. Try again.", tone: "danger" });
      settleRef.current?.();
      return;
    }
    if (controller.signal.aborted) return;

    const ids = order.filter((id) => result[id]?.value);
    if (!ids.length) {
      setPhase("error");
      setStatus({ text: "No contact details found in that text.", tone: "danger" });
      settleRef.current?.();
      return;
    }

    const before = { ...valuesRef.current };
    setSnapshot(before);
    setPhase("filling");
    setFilling({ id: null, done: 0, total: ids.length });

    const fillOne = (id: string, index: number) => {
      const found = result[id]!;
      const next = { ...valuesRef.current, [id]: found.value };
      commitValues(next);
      setMeta((current) => ({ ...current, [id]: { ...found, state: found.confidence < reviewThreshold ? "review" : "ok" } }));
      setFlash((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
      setFilling({ id, done: index + 1, total: ids.length });
    };

    const finish = () => {
      const review = ids.filter((id) => result[id]!.confidence < reviewThreshold).map((id) => labelOf(id).toLowerCase());
      const seconds = ((performance.now() - startedAt.current) / 1000).toFixed(1);
      setPhase("done");
      setFilling({ id: null, done: ids.length, total: ids.length });
      setStatus(review.length
        ? { text: `Filled ${ids.length} fields. Check the ${listFormat(review)}.`, tone: "warning", sr: simulated ? "Simulated, nothing was sent." : undefined }
        : { text: `Filled ${ids.length} fields in ${seconds}s.`, tone: "success", sr: simulated ? "Simulated, nothing was sent." : undefined });
      onFill?.(result);
      settleRef.current?.();
    };

    if (reduced) {
      ids.forEach(fillOne);
      finish();
      return;
    }
    ids.forEach((id, index) => { timersRef.current.push(window.setTimeout(() => fillOne(id, index), index * FILL_STEP)); });
    timersRef.current.push(window.setTimeout(finish, ids.length * FILL_STEP + 120));
  }, [commitValues, labelOf, onFill, order, read, reduced, reviewThreshold, simulated]);

  const stop = useCallback(() => {
    if (phase !== "reading") return;
    controllerRef.current?.abort();
    setPhase("idle");
    setView("edit");
    setStatus({ text: "Stopped. Nothing changed.", tone: "neutral" });
  }, [phase]);

  const undo = useCallback(() => {
    if (!snapshot) return;
    controllerRef.current?.abort();
    clearTimers();
    commitValues(snapshot);
    onUndo?.(snapshot);
    setSnapshot(null);
    setMeta({});
    setActive(null);
    setPhase("idle");
    setView("edit");
    setFilling({ id: null, done: 0, total: 0 });
    setStatus({ text: "Restored the previous values.", tone: "neutral" });
  }, [commitValues, onUndo, snapshot]);

  const confirm = useCallback((id: string) => {
    setMeta((current) => current[id] ? { ...current, [id]: { ...current[id], state: "checked" } } : current);
    const left = order.filter((key) => key !== id && metaRef.current[key]?.state === "review");
    setStatus(left.length
      ? { text: `${labelOf(id)} checked. ${left.length} left to review.`, tone: "warning" }
      : { text: "All fields checked.", tone: "success" });
  }, [labelOf, order]);

  const edit = (id: string, value: string) => {
    commitValues({ ...valuesRef.current, [id]: value });
    if (metaRef.current[id] && metaRef.current[id].state !== "edited") setMeta((current) => ({ ...current, [id]: { ...current[id], state: "edited" } }));
  };

  const save = async () => {
    if (pending.length) {
      inputRefs.current[pending[0]]?.focus();
      setStatus({ text: `Check the ${listFormat(pending.map((id) => labelOf(id).toLowerCase()))} before saving.`, tone: "warning" });
      return;
    }
    const current = valuesRef.current;
    if (!Object.values(current).some((value) => value.trim())) {
      setStatus({ text: "Nothing to save yet. Paste some text first.", tone: "neutral" });
      return;
    }
    setSaving(true);
    try {
      if (onSubmit) await onSubmit(current);
      else await new Promise((resolve) => window.setTimeout(resolve, 650));
      const who = current[order[0]]?.trim();
      setStatus({ text: `Saved${who ? ` ${who}` : ""}.${onSubmit ? "" : " Simulated, nothing was sent."}`, tone: "success" });
    } catch {
      setStatus({ text: "Couldn't save. Try again.", tone: "danger" });
    } finally {
      setSaving(false);
    }
  };

  const nextSample = () => samples[sampleIndex % samples.length];
  const pasteSample = () => {
    if (!samples.length) return;
    const sample = nextSample();
    setSampleIndex((index) => index + 1);
    setText(sample.text);
    void run(sample.text);
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = event.clipboardData.getData("text/plain");
    if (!pasted.trim()) return;
    event.preventDefault();
    const area = event.currentTarget;
    const next = text.slice(0, area.selectionStart) + pasted + text.slice(area.selectionEnd);
    setText(next);
    void run(next);
  };

  const onAreaKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void run(text); }
  };

  const editText = () => {
    setView("edit");
    if (phase === "error") setPhase("idle");
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  /* The source span for the hovered or focused field, or the field being filled right now. */
  const highlighted = phase === "filling" ? filling.id : active;
  const segments = useMemo(() => segmentsFor(text, meta, order), [text, meta, order]);

  useEffect(() => {
    const box = sourceRef.current;
    if (!box || !highlighted) return;
    const span = box.querySelector<HTMLElement>(`[data-field="${CSS.escape(highlighted)}"]`);
    if (!span) return;
    const top = span.offsetTop - box.offsetTop, bottom = top + span.offsetHeight;
    if (top < box.scrollTop + 8) box.scrollTo({ top: Math.max(0, top - 12), behavior: reduced ? "auto" : "smooth" });
    else if (bottom > box.scrollTop + box.clientHeight - 8) box.scrollTo({ top: bottom - box.clientHeight + 12, behavior: reduced ? "auto" : "smooth" });
  }, [highlighted, reduced]);

  /* ---------- Autoplay: paste, fill, check one field, undo, next sample. Stops for good on any interaction. ---------- */
  const playing = autoPlay ?? !extract;
  const stoppedRef = useRef(false);
  const visibleRef = useRef(true);
  const latest = useRef({ run, confirm, undo, samples, order });
  useLayoutEffect(() => { latest.current = { run, confirm, undo, samples, order }; });

  useEffect(() => {
    const root = rootRef.current;
    if (!playing || !root || !latest.current.samples.length) return;
    const timers: number[] = [];
    stoppedRef.current = false;
    const halt = () => { stoppedRef.current = true; };
    root.addEventListener("pointerdown", halt);
    root.addEventListener("keydown", halt);
    let observer: IntersectionObserver | undefined;
    let wake: (() => void) | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(([entry]) => { visibleRef.current = entry.isIntersecting; if (entry.isIntersecting) wake?.(); }, { threshold: 0.35 });
      observer.observe(root);
    }
    let cancelled = false;
    const gone = () => cancelled || stoppedRef.current;
    const sleep = (ms: number) => new Promise<void>((resolve) => {
      const tick = () => {
        if (gone()) return resolve();
        if (!visibleRef.current) { wake = () => { wake = null; tick(); }; return; }
        timers.push(window.setTimeout(resolve, ms));
      };
      tick();
    });
    const settled = () => new Promise<void>((resolve) => { settleRef.current = () => { settleRef.current = null; resolve(); }; });

    (async () => {
      for (let round = 0; !gone(); round++) {
        await sleep(round === 0 ? 700 : 600);
        if (gone()) break;
        const { samples: list } = latest.current;
        const sample = list[round % list.length];
        setSampleIndex(round + 1);
        setText(sample.text);
        const done = settled();
        void latest.current.run(sample.text);
        await done;
        if (gone() || reduced) break;
        await sleep(1500);
        if (gone()) break;
        const first = latest.current.order.find((id) => metaRef.current[id]?.state === "review");
        if (first) {
          setActive(first);
          await sleep(900);
          if (gone()) break;
          latest.current.confirm(first);
          setActive(null);
        }
        await sleep(1800);
        if (gone()) break;
        latest.current.undo();
      }
    })();

    return () => {
      cancelled = true;
      wake?.();
      timers.forEach((timer) => window.clearTimeout(timer));
      settleRef.current = null;
      observer?.disconnect();
      root.removeEventListener("pointerdown", halt);
      root.removeEventListener("keydown", halt);
    };
  }, [playing, reduced]);

  const onRootKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape" && phase === "reading") { event.preventDefault(); stop(); }
  };

  /* ---------- Copy for the bar under the paste area ---------- */
  const lines = lineCount(text);
  const barKey = view === "edit" ? (text.trim() ? "ready" : "empty") : phase;
  const barText = view === "edit"
    ? (text.trim() ? `to read ${lines} ${lines === 1 ? "line" : "lines"}` : "Paste anything to fill the form")
    : phase === "reading" ? `Reading with ${model.name}`
      : phase === "filling" ? `Filling ${filling.done} of ${filling.total}`
        : `Read by ${model.name}`;

  const StatusIcon = status.tone === "success" ? CircleCheck : status.tone === "warning" ? CircleAlert : status.tone === "danger" ? CircleX : null;
  const focusNote = active ? meta[active]?.state === "review" ? meta[active]?.note : undefined : undefined;
  const shown: Status = focusNote && active ? { text: `${labelOf(active)}: ${focusNote}.`, tone: "warning" } : status;
  const ShownIcon = focusNote ? CircleAlert : StatusIcon;
  const busy = phase === "reading" || phase === "filling";

  return (
    <div ref={rootRef} className={cx(styles.root, className)} data-phase={phase} onKeyDown={onRootKey}>
      <header className={styles.head}>
        <h3 className={styles.title} id={`${uid}-title`}>{title}</h3>
        {description ? <p className={styles.description}>{description}</p> : null}
      </header>

      <div className={styles.body}>
        <div className={styles.well} data-view={view}>
          <div className={styles.editor}>
            <AnimatePresence initial={false}>
              {view === "edit" ? (
                <motion.div key="edit" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: swap }} exit={{ opacity: 0, transition: swapOut }}>
                  <textarea
                    ref={textareaRef}
                    className={styles.textarea}
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    onPaste={onPaste}
                    onKeyDown={onAreaKey}
                    placeholder={"Paste an email signature, a business card or any messy text.\n\nMaya Okafor\nHead of Partnerships, Stripe\nmaya.okafor@stripe.com"}
                    aria-label="Paste anything"
                    aria-describedby={`${uid}-bar`}
                    spellCheck={false}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="source"
                  ref={sourceRef}
                  className={cx(styles.layer, styles.source)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1, transition: swap }}
                  exit={{ opacity: 0, transition: swapOut }}
                  tabIndex={0}
                  role="region"
                  aria-label="Pasted text"
                >
                  {segments.map((part, index) => part.id ? (
                    <mark
                      key={`${part.id}-${index}`}
                      data-field={part.id}
                      data-review={meta[part.id]?.state === "review" || undefined}
                      data-active={highlighted === part.id || undefined}
                      className={styles.span}
                    >
                      {part.text}
                    </mark>
                  ) : <span key={index}>{part.text}</span>)}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.bar} id={`${uid}-bar`}>
            <span className={styles.model}>
              <span className={styles.modelMark} aria-hidden="true">{model.mark ?? <ClaudeMark size={14} />}</span>
              <Swap id={barKey} className={styles.barText}>
                {phase === "reading" && view === "source" ? <TextShimmer>{barText}</TextShimmer>
                  : barKey === "ready" ? <span><Kbd keys={["mod", "enter"]} size="sm" className={styles.hintKey} />{barText}</span>
                    : barKey === "filling" ? <span>Filling <span className={styles.barNum}><span className={styles.barGhost} aria-hidden="true">{filling.total}</span><span>{filling.done}</span></span> of {filling.total}</span>
                      : <span>{barText}</span>}
              </Swap>
            </span>
            <span className={styles.barActions}>
              {view === "edit" ? (
                <>
                  {samples.length ? (
                    <Button variant="ghost" size="sm" className={styles.barButton} onClick={pasteSample} title={`Paste the ${nextSample().label.toLowerCase()} sample`}>
                      Try sample
                    </Button>
                  ) : null}
                  <Button variant="primary" size="sm" className={styles.barButton} onClick={() => void run(text)} disabled={!text.trim()} aria-keyshortcuts="Meta+Enter Control+Enter">
                    Fill
                  </Button>
                </>
              ) : phase === "reading" ? (
                <Button variant="ghost" size="sm" className={styles.barButton} onClick={stop} aria-keyshortcuts="Escape">
                  <Square size={12} aria-hidden="true" className={styles.stopIcon} />
                  Stop
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className={styles.barButton} onClick={editText} disabled={phase === "filling"}>
                  <PenLine size={14} aria-hidden="true" />
                  Edit text
                </Button>
              )}
            </span>
          </div>
        </div>

        <div className={styles.form} role="group" aria-labelledby={`${uid}-title`}>
          {fields.map((field) => {
            const info = meta[field.id];
            const value = values[field.id] ?? "";
            const count = flash[field.id] ?? 0;
            const inputId = `${uid}-${field.id}`;
            const pct = info ? Math.round(info.confidence * 100) : 0;
            const badge = !info ? null
              : info.state === "review" ? { key: "review", label: `${pct}% · Review`, tone: "warning" }
                : info.state === "checked" ? { key: "checked", label: "Checked", tone: "success" }
                  : info.state === "edited" ? { key: "edited", label: "Edited", tone: "neutral" }
                    : { key: "ok", label: `${pct}%`, tone: "success" };
            const logo = field.kind === "company" && value.trim() ? (resolveLogo?.(value) ?? companyMark(value)) : undefined;
            return (
              <div
                key={field.id}
                className={styles.field}
                data-span={field.span ?? 1}
                data-state={info?.state}
                onPointerEnter={() => info && setActive(field.id)}
                onPointerLeave={() => setActive((current) => current === field.id && document.activeElement !== inputRefs.current[field.id] ? null : current)}
              >
                <div className={styles.labelRow}>
                  <label className={styles.label} htmlFor={inputId}>{field.label}</label>
                  <span className={styles.badgeSlot} aria-hidden="true">
                    <AnimatePresence initial={false}>
                      {badge ? (
                        <motion.span
                          key={badge.key}
                          className={styles.badge}
                          data-tone={badge.tone}
                          title={info ? `Confidence ${pct}%` : undefined}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1, transition: swap }}
                          exit={{ opacity: 0, transition: swapOut }}
                        >
                          <span className={styles.dot} />
                          {badge.label}
                        </motion.span>
                      ) : null}
                    </AnimatePresence>
                  </span>
                </div>
                <div className={styles.control} data-company={field.kind === "company" || undefined}>
                  {field.kind === "company" ? (
                    <span className={styles.logo} aria-hidden="true">
                      <AnimatePresence initial={false}>
                        <motion.span
                          key={logo ? value.trim().toLowerCase() : "none"}
                          className={styles.logoItem}
                          data-empty={!logo || undefined}
                          initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
                          animate={{ opacity: 1, scale: 1, transition: swap }}
                          exit={{ opacity: 0, transition: swapOut }}
                        >
                          {logo ?? <Building2 size={16} strokeWidth={1.75} />}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                  ) : null}
                  <input
                    ref={(node) => { inputRefs.current[field.id] = node; }}
                    id={inputId}
                    className={styles.input}
                    type={inputType(field.kind)}
                    inputMode={field.kind === "tel" ? "tel" : field.kind === "email" ? "email" : undefined}
                    autoComplete={field.autoComplete}
                    placeholder={field.placeholder}
                    value={value}
                    data-flash={count ? (count % 2 ? "a" : "b") : undefined}
                    aria-invalid={info?.state === "review" || undefined}
                    aria-description={info ? info.state === "review" ? `Filled by AI with ${pct}% confidence, needs review${info.note ? `: ${info.note}` : ""}` : info.state === "edited" ? "Edited after filling" : `Filled by AI with ${pct}% confidence` : undefined}
                    onChange={(event) => edit(field.id, event.target.value)}
                    onFocus={() => info && setActive(field.id)}
                    onBlur={() => setActive((current) => current === field.id ? null : current)}
                  />
                  <AnimatePresence initial={false}>
                    {info?.state === "review" ? (
                      <motion.button
                        key="confirm"
                        type="button"
                        className={styles.confirm}
                        onClick={() => confirm(field.id)}
                        aria-label={`Mark ${field.label.toLowerCase()} as correct`}
                        title="Looks right"
                        initial={{ opacity: 0, scale: reduced ? 1 : 0.9 }}
                        animate={{ opacity: 1, scale: 1, transition: swap }}
                        exit={{ opacity: 0, scale: reduced ? 1 : 0.9, transition: swapOut }}
                        whileTap={reduced ? undefined : { scale: 0.92 }}
                      >
                        <Check size={14} strokeWidth={2} aria-hidden="true" />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <footer className={styles.foot}>
        <p className={styles.status} data-tone={shown.tone}>
          <Swap id={shown.text} className={styles.statusSwap}>
            {ShownIcon ? <ShownIcon size={14} className={styles.statusIcon} aria-hidden="true" /> : null}
            <span className={styles.statusText}>{shown.text}</span>
          </Swap>
        </p>
        <span className={styles.srOnly} role="status" aria-live="polite">{[status.text, status.sr].filter(Boolean).join(" ")}</span>
        <div className={styles.actions}>
          <Button variant="ghost" size="sm" onClick={undo} disabled={!snapshot || busy} className={styles.footButton}>
            <RotateCcw size={14} aria-hidden="true" />
            Undo
          </Button>
          <Button variant="primary" size="sm" onClick={() => void save()} loading={saving} disabled={busy} className={styles.footButton}>
            {submitLabel}
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default SmartFormFill;
