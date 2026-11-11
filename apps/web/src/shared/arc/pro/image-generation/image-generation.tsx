"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, motionValue, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import type { AnimationPlaybackControls, MotionValue, Transition } from "motion/react";
import { Check, CircleAlert, Download, Maximize2, RotateCcw, Shuffle, Sparkles, Square } from "lucide-react";
import { Button } from "../../button/button";
import { Tooltip } from "../../tooltip/tooltip";
import { motionTokens } from "../../lib/motion-tokens";
import {
  imageGenerationAspects, imageGenerationDefaultPrompt, imageGenerationModels, imageGenerationSuggestions,
  simulateImageGeneration, simulateImageUpscale,
} from "./image-generation-data";
import type { ImageGenerationAspect, ImageGenerationContext, ImageGenerationImage, ImageGenerationModel, ImageGenerationRequest } from "./image-generation-data";
import { DotField, DotSpinner, SWEEP_HALF, UpscaleBand, sweepAt } from "./image-generation-dots";
import type { DotPhase } from "./image-generation-dots";
import styles from "./image-generation.module.css";

export type { ImageGenerationAspect, ImageGenerationContext, ImageGenerationImage, ImageGenerationModel, ImageGenerationRequest } from "./image-generation-data";
export { imageGenerationAspects, imageGenerationModels, imageGenerationSuggestions, simulateImageGeneration, simulateImageUpscale } from "./image-generation-data";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const COUNT = 4;
const MAX_STAGE_HEIGHT = 440;
/** Moves and resizes: critically damped, never overshoots. */
const SPRING: Transition = { type: "spring", visualDuration: .26, bounce: 0 };
const FADE: Transition = { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] };
const SWAP_OUT: Transition = { duration: .1, ease: [...motionTokens.ease.standard] };
const INSTANT: Transition = { duration: 0 };

type TileStatus = "running" | "done" | "error" | "stopped";
interface Tile { key: string; status: TileStatus; progress: MotionValue<number>; preview?: string; image?: ImageGenerationImage; upscaled?: ImageGenerationImage; error?: string; startedAt: number; endedAt?: number }
interface Batch {
  id: number;
  prompt: string;
  model: ImageGenerationModel;
  aspect: ImageGenerationAspect;
  variationOf?: { image: ImageGenerationImage; index: number };
  tiles: Tile[];
  startedAt: number;
  endedAt?: number;
}
const now = () => performance.now();
const newTile = (key: string): Tile => ({ key, status: "running", progress: motionValue(0), startedAt: now() });
type Upscale = { index: number; status: "running" | "error"; message?: string } | null;

const seconds = (ms: number) => `${(Math.max(ms, 100) / 1000).toFixed(1)}s`;
const sizeOf = (image: ImageGenerationImage | undefined, aspect: ImageGenerationAspect) => `${image?.width ?? aspect.width} × ${image?.height ?? aspect.height}`;
const upscaleFactor = (from: ImageGenerationImage, to: ImageGenerationImage) => from.width && to.width ? `${Math.round((to.width / from.width) * 10) / 10}×` : "";
const isAbort = (error: unknown) => error instanceof DOMException && error.name === "AbortError";
const errorText = (error: unknown) => error instanceof Error && error.message ? error.message : "The model did not return an image.";
const fileName = (prompt: string, index: number, image: ImageGenerationImage) => {
  const slug = prompt.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").split("-").slice(0, 5).join("-") || "image";
  const extension = image.src.split("?")[0].match(/\.(png|jpe?g|webp|avif)$/i)?.[1] ?? "png";
  return `${slug}-${index + 1}${image.width && image.height ? `-${image.width}x${image.height}` : ""}.${extension}`;
};
const phaseOf = (status: TileStatus): DotPhase => status === "running" ? "running" : status === "done" ? "done" : "halted";

function useControllable<T>(value: T | undefined, fallback: T, onChange?: (value: T) => void) {
  const [state, setState] = useState(fallback);
  const current = value ?? state;
  const set = useCallback((next: T) => { if (value === undefined) setState(next); onChange?.(next); }, [value, onChange]);
  return [current, set] as const;
}

/* ───────────────────────────── Parts ───────────────────────────── */

/** Every label stacked in one grid cell: the button keeps the width of its longest label, and swaps crossfade. */
function StableLabel({ value, options }: { value: string; options: Record<string, ReactNode> }) {
  return <span className={styles.stable}>
    {Object.entries(options).map(([key, node]) => <span key={key} className={styles.stableItem} data-on={key === value || undefined} aria-hidden={key === value ? undefined : true}>{node}</span>)}
  </span>;
}

/** A small outline of the output shape, drawn to the ratio inside a 14px box. */
function RatioGlyph({ aspect }: { aspect: ImageGenerationAspect }) {
  const ratio = aspect.width / aspect.height;
  const w = ratio >= 1 ? 12 : Math.round(12 * ratio * 2) / 2;
  const h = ratio >= 1 ? Math.round((12 / ratio) * 2) / 2 : 12;
  return <svg width={14} height={14} viewBox="0 0 14 14" fill="none" aria-hidden="true" className={styles.glyph}>
    <rect x={(14 - w) / 2 + .6} y={(14 - h) / 2 + .6} width={w - 1.2} height={h - 1.2} rx={2} stroke="currentColor" strokeWidth={1.2} />
  </svg>;
}

/** Arrow keys move between options like radios; only the chosen one is a tab stop. */
function radioKeys<T extends { id: string }>(event: ReactKeyboardEvent<HTMLElement>, options: T[], current: string, choose: (id: string) => void) {
  const index = Math.max(0, options.findIndex(option => option.id === current));
  const last = options.length - 1;
  const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
    : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0 : event.key === "End" ? last : -1;
  if (next < 0) return;
  event.preventDefault();
  choose(options[next].id);
  (event.currentTarget.parentElement?.querySelector(`[data-option="${CSS.escape(options[next].id)}"]`) as HTMLElement | null)?.focus();
}

/** The chosen model shows its name; the others collapse to their mark, so three providers fit beside the ratios. */
function ModelChips({ models, value, onChange, reduced }: { models: ImageGenerationModel[]; value: string; onChange: (id: string) => void; reduced: boolean }) {
  return <div className={styles.chips} role="radiogroup" aria-label="Model">
    {models.map(model => {
      const on = model.id === value;
      const chip = <button type="button" role="radio" aria-checked={on} aria-label={model.name} data-option={model.id} tabIndex={on ? 0 : -1}
        className={cx(styles.chip, styles.modelChip)} onClick={() => onChange(model.id)} onKeyDown={event => radioKeys(event, models, value, onChange)}>
        <span className={styles.chipMark} aria-hidden="true">{model.mark ?? <Sparkles size={14} strokeWidth={1.75} />}</span>
        <motion.span className={styles.chipName} aria-hidden="true" initial={false}
          animate={{ width: on ? "auto" : 0, opacity: on ? 1 : 0 }}
          transition={reduced ? INSTANT : { width: SPRING, opacity: { duration: on ? .16 : .1, ease: [...motionTokens.ease.standard], delay: on ? .04 : 0 } }}>
          <span className={styles.chipNameText}>{model.name}</span>
        </motion.span>
      </button>;
      // Always wrapped, so choosing a model never remounts its chip and the name can spring open.
      return <Tooltip key={model.id} content={model.name}>{chip}</Tooltip>;
    })}
  </div>;
}

function AspectChips({ aspects, value, onChange }: { aspects: ImageGenerationAspect[]; value: string; onChange: (id: string) => void }) {
  return <div className={styles.chips} role="radiogroup" aria-label="Aspect ratio">
    {aspects.map(aspect => {
      const on = aspect.id === value;
      return <button key={aspect.id} type="button" role="radio" aria-checked={on} aria-label={`${aspect.label}, ${aspect.width} by ${aspect.height}`} data-option={aspect.id} tabIndex={on ? 0 : -1}
        className={cx(styles.chip, styles.aspectChip)} onClick={() => onChange(aspect.id)} onKeyDown={event => radioKeys(event, aspects, value, onChange)}>
        <RatioGlyph aspect={aspect} />
        <span aria-hidden="true">{aspect.label}</span>
      </button>;
    })}
  </div>;
}

/** A tabular percentage written straight from the motion value, so nothing re-renders per frame. */
function Percent({ progress }: { progress: MotionValue<number> }) {
  const text = useRef<HTMLSpanElement>(null);
  useMotionValueEvent(progress, "change", value => { if (text.current) text.current.textContent = `${Math.round(Math.min(1, value) * 100)}%`; });
  return <span ref={text} className={styles.percent}>{`${Math.round(Math.min(1, progress.get()) * 100)}%`}</span>;
}

/** Floating meta pills on the canvas crossfade by key, so a changing label never resizes one pill in a frame. */
function PillSwap({ id, className, reduced, children }: { id: string | null; className: string; reduced: boolean; children: ReactNode }) {
  return <span className={className}>
    <AnimatePresence initial={false} mode="popLayout">
      {id ? <motion.span key={id} className={styles.pill}
        initial={reduced ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)" }} animate={{ opacity: 1, filter: "blur(0px)" }}
        exit={{ opacity: 0, transition: SWAP_OUT }} transition={{ duration: .18, ease: [...motionTokens.ease.standard] }}>
        {children}
      </motion.span> : null}
    </AnimatePresence>
  </span>;
}

/** Seed for each tile's dot wave: stable across retries, different per tile. */
const waveSeed = (batch: Batch, index: number) => (batch.id * 7 + index * 3.1) % 11;

/**
 * One image on the primary canvas: the dot field (forming the photo while it runs, frozen when it halts) with the real
 * <img> above it once done. The <img> lands on the field's last frame, which is the photo itself.
 */
function CanvasImage({ tile, seed, reduced, upscaling, upscaleProgress }: { tile: Tile; seed: number; reduced: boolean; upscaling: boolean; upscaleProgress: MotionValue<number> }) {
  const shown = tile.upscaled ?? tile.image;
  const done = tile.status === "done" && !!shown;
  const sweep = done && upscaling && !reduced;
  const sharpMask = useTransform(upscaleProgress, value => { const at = sweepAt(value) * 100, half = SWEEP_HALF * 100; return `linear-gradient(90deg, #000 ${at - half * 1.1}%, transparent ${at - half * .45}%)`; });
  const softMask = useTransform(upscaleProgress, value => { const at = sweepAt(value) * 100, half = SWEEP_HALF * 100; return `linear-gradient(90deg, transparent ${at + half * .45}%, #000 ${at + half * 1.1}%)`; });
  return <>
    <DotField progress={tile.progress} preview={tile.preview} phase={phaseOf(tile.status)} reduced={reduced} seed={seed} pitch={8}
      className={styles.field} canvasClassName={styles.fieldCanvas} glowClassName={styles.fieldGlow} previewClassName={cx(styles.image, styles.preview)} />
    {done && shown ? <>
      {sweep ? <>
        <motion.img src={shown.src} alt="" className={cx(styles.image, styles.layer, styles.soft)} draggable={false} style={{ maskImage: softMask, WebkitMaskImage: softMask }} />
        <UpscaleBand src={shown.src} progress={upscaleProgress} className={styles.layer} canvasClassName={styles.fieldCanvas} glowClassName={styles.bandGlow} />
      </> : null}
      <motion.img src={shown.src} alt={shown.alt} className={cx(styles.image, styles.layer, styles.final)} data-fade={shown.src !== tile.preview || undefined} draggable={false} decoding="async"
        style={sweep ? { maskImage: sharpMask, WebkitMaskImage: sharpMask } : undefined} />
    </> : null}
  </>;
}

/** A filmstrip thumbnail: its own small dot field while it runs, the photo when done, an icon when it halts. */
function Thumb({ tile, index, seed, active, tabStop, reduced, onChoose, onArrow }: { tile: Tile; index: number; seed: number; active: boolean; tabStop: boolean; reduced: boolean; onChoose: () => void; onArrow: (event: ReactKeyboardEvent<HTMLButtonElement>) => void }) {
  const shown = tile.upscaled ?? tile.image;
  const state = tile.status === "running" ? "generating" : tile.status === "error" ? "failed" : tile.status === "stopped" ? "stopped" : shown?.alt ?? "ready";
  return <button type="button" role="radio" aria-checked={active} tabIndex={tabStop ? 0 : -1} className={styles.thumb} data-thumb={index} data-status={tile.status} data-active={active || undefined}
    aria-label={`Image ${index + 1}, ${state}`} onClick={onChoose} onKeyDown={onArrow}>
    <span className={styles.thumbMedia}>
      <DotField progress={tile.progress} preview={tile.preview} phase={phaseOf(tile.status)} reduced={reduced} seed={seed} pitch={4} glow={false}
        className={styles.field} canvasClassName={styles.fieldCanvas} previewClassName={cx(styles.image, styles.preview)} />
      {/* eslint-disable-next-line @next/next/no-img-element -- framework agnostic registry component */}
      {tile.status === "done" && shown ? <img src={shown.src} alt="" className={cx(styles.image, styles.layer, styles.final)} data-fade={shown.src !== tile.preview || undefined} draggable={false} decoding="async" /> : null}
      {tile.status === "error" || tile.status === "stopped" ? <span className={styles.thumbHalt} data-status={tile.status}>
        {tile.status === "error" ? <CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /> : <Square size={10} strokeWidth={2.25} aria-hidden="true" />}
      </span> : null}
    </span>
  </button>;
}

/* ───────────────────────────── Component ───────────────────────────── */

export interface ImageGenerationProps {
  /** Controlled prompt. Pair with onPromptChange. */
  prompt?: string;
  /** Starting prompt when uncontrolled. Defaults to a sample golden hour landscape prompt. */
  defaultPrompt?: string;
  onPromptChange?: (prompt: string) => void;
  /** Models offered as chips. Defaults to three generic names with provider marks. */
  models?: ImageGenerationModel[];
  model?: string;
  defaultModel?: string;
  onModelChange?: (id: string) => void;
  /** Output shapes offered as chips. Defaults to 1:1, 4:5 and 16:9. */
  aspectRatios?: ImageGenerationAspect[];
  aspectRatio?: string;
  defaultAspectRatio?: string;
  onAspectRatioChange?: (id: string) => void;
  /** Produces one image. Called once per variation, in parallel, for Generate, Vary and Retry. Defaults to a local simulation. */
  onGenerate?: (request: ImageGenerationRequest, context: ImageGenerationContext) => Promise<ImageGenerationImage>;
  /** Upscales the chosen image. Defaults to a local simulation that doubles the size. */
  onUpscale?: (image: ImageGenerationImage, context: ImageGenerationContext) => Promise<ImageGenerationImage>;
  /** Replaces the built in download, which saves the image's src with a file name from the prompt. */
  onDownload?: (image: ImageGenerationImage) => void;
  /** Fires when the image on the canvas changes: a pick, the shown image finishing or upscaling, or null for a new batch. */
  onSelect?: (image: ImageGenerationImage | null) => void;
  /** Prompts offered before the first generation. */
  suggestions?: string[];
  /** Generates once when the card first scrolls into view. Defaults to true with the built in simulation. */
  autoGenerate?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * An image studio: one large canvas shows the chosen variation, a filmstrip of four sits under it with the actions,
 * and the prompt bar closes the card. Each image forms on a dot matrix: a soft halftone wave breathes across the grid,
 * the dots take on the colours of the coming photo and grow into a coloured halftone, then blur away into the sharp
 * photo. With no props it runs a local simulation on sample photos.
 */
export function ImageGeneration({
  prompt: promptProp, defaultPrompt = imageGenerationDefaultPrompt, onPromptChange,
  models = imageGenerationModels, model: modelProp, defaultModel, onModelChange,
  aspectRatios = imageGenerationAspects, aspectRatio: aspectProp, defaultAspectRatio, onAspectRatioChange,
  onGenerate, onUpscale, onDownload, onSelect, suggestions = imageGenerationSuggestions,
  autoGenerate, placeholder = "Describe the image you want", className,
}: ImageGenerationProps) {
  const reduced = useReducedMotion() ?? false;
  const simulated = !onGenerate;
  const [prompt, setPrompt] = useControllable(promptProp, defaultPrompt, onPromptChange);
  const [modelId, setModelId] = useControllable(modelProp, defaultModel ?? models[0]?.id ?? "", onModelChange);
  const [aspectId, setAspectId] = useControllable(aspectProp, defaultAspectRatio ?? aspectRatios[0]?.id ?? "", onAspectRatioChange);
  const model = models.find(entry => entry.id === modelId) ?? models[0];
  const aspect = aspectRatios.find(entry => entry.id === aspectId) ?? aspectRatios[0];

  const [batch, setBatch] = useState<Batch | null>(null);
  const [active, setActive] = useState(0);
  const [upscale, setUpscale] = useState<Upscale>(null);
  const [saved, setSaved] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const root = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const batchRef = useRef<Batch | null>(null);
  const activeRef = useRef(0);
  const tally = useRef(new Map<number, { pending: number; done: number; failed: number }>());
  const runs = useRef(new Map<string, AnimationPlaybackControls>());
  const controllers = useRef(new Map<string, AbortController>());
  const previewed = useRef(new Set<string>());
  const upscaleProgress = useMotionValue(0);
  const upscaleRun = useRef<AnimationPlaybackControls | undefined>(undefined);
  const upscaleController = useRef<AbortController | null>(null);
  const touched = useRef(false);
  const autoRan = useRef(false);
  const savedTimer = useRef<number | undefined>(undefined);

  const announce = (text: string) => setAnnouncement(text);

  /** Fine reports (every frame) are set directly; coarse ones (a real API's steps) glide. Progress never runs backwards. */
  const push = (value: MotionValue<number>, next: number, runKey: string | null) => {
    const target = Math.max(value.get(), Math.min(1, Math.max(0, next)));
    const run = runKey ? runs.current.get(runKey) : upscaleRun.current;
    run?.stop();
    const store = (controls?: AnimationPlaybackControls) => { if (runKey) { if (controls) runs.current.set(runKey, controls); else runs.current.delete(runKey); } else upscaleRun.current = controls; };
    if (reduced || target - value.get() < .06) { value.set(target); store(); return; }
    store(animate(value, target, { duration: .32, ease: [...motionTokens.ease.standard] }));
  };
  /** Without reports, progress creeps toward 90% so a slow model still shows life. */
  const estimate = (value: MotionValue<number>, runKey: string) => {
    runs.current.get(runKey)?.stop();
    runs.current.set(runKey, animate(value, .9, { duration: 9, ease: [.1, .7, .3, 1] }));
  };

  const updateTile = useCallback((batchId: number, index: number, patch: Partial<Tile>) => {
    setBatch(current => current && current.id === batchId ? { ...current, tiles: current.tiles.map((tile, i) => i === index ? { ...tile, ...patch } : tile) } : current);
  }, []);

  /** Records one outcome; when the last running image settles, the batch ends and its summary is announced. */
  const settle = (batchId: number, outcome: "done" | "failed" | "stopped") => {
    const count = tally.current.get(batchId);
    if (!count || batchId !== seq.current) return;
    count.pending -= 1;
    if (outcome === "done") count.done += 1;
    if (outcome === "failed") count.failed += 1;
    if (count.pending > 0) return;
    const endedAt = now();
    setBatch(current => current && current.id === batchId ? { ...current, endedAt } : current);
    announce(count.done === COUNT ? `${COUNT} images ready. Pick one to upscale, vary or download.` : `${count.done} of ${COUNT} images ready${count.failed ? `, ${count.failed} failed` : ""}.`);
  };

  const runTile = (source: Batch, index: number, tile: Tile) => {
    const { key, progress: value } = tile;
    const controller = new AbortController();
    controllers.current.set(key, controller);
    value.set(0);
    estimate(value, key);
    const request: ImageGenerationRequest = { prompt: source.prompt, model: source.model, aspect: source.aspect, index, count: COUNT, variationOf: source.variationOf?.image };
    const generate = onGenerate ?? simulateImageGeneration;
    generate(request, {
      signal: controller.signal,
      onProgress: (next, preview) => {
        if (controller.signal.aborted) return;
        if (preview && !previewed.current.has(key)) { previewed.current.add(key); updateTile(source.id, index, { preview }); }
        push(value, next, key);
      },
    }).then(image => {
      if (controller.signal.aborted) return;
      controllers.current.delete(key);
      runs.current.get(key)?.stop();
      const finish = () => {
        updateTile(source.id, index, { status: "done", image, endedAt: now() });
        if (index === activeRef.current && source.id === seq.current) onSelect?.(image);
        settle(source.id, "done");
      };
      if (reduced || value.get() > .98) { value.set(1); finish(); return; }
      runs.current.set(key, animate(value, 1, { duration: .36, ease: [...motionTokens.ease.standard], onComplete: finish }));
    }, error => {
      controllers.current.delete(key);
      runs.current.get(key)?.stop();
      if (controller.signal.aborted || isAbort(error)) { updateTile(source.id, index, { status: "stopped" }); settle(source.id, "stopped"); return; }
      updateTile(source.id, index, { status: "error", error: errorText(error) });
      announce(`Image ${index + 1} failed. ${errorText(error)}`);
      settle(source.id, "failed");
    });
  };

  const stopUpscale = () => { upscaleController.current?.abort(); upscaleRun.current?.stop(); };
  const stopAll = () => {
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    runs.current.forEach(run => run.stop());
    stopUpscale();
  };
  useEffect(() => () => {
    controllers.current.forEach(controller => controller.abort());
    runs.current.forEach(run => run.stop());
    upscaleController.current?.abort();
    window.clearTimeout(savedTimer.current);
  }, []);

  const start = (variation?: { image: ImageGenerationImage; index: number }) => {
    const text = (variation ? batch?.prompt : prompt)?.trim();
    if (!text || !model || !aspect) return;
    stopAll();
    const id = ++seq.current;
    const next: Batch = {
      id, prompt: text, model, aspect: variation && batch ? batch.aspect : aspect, variationOf: variation,
      tiles: Array.from({ length: COUNT }, (_, index) => newTile(`${id}-${index}-0`)), startedAt: now(),
    };
    runs.current.clear();
    tally.current.set(id, { pending: COUNT, done: 0, failed: 0 });
    setBatch(next);
    setActive(0);
    activeRef.current = 0;
    setUpscale(null);
    setSaved(false);
    onSelect?.(null);
    announce(`${variation ? `Generating variations of image ${variation.index + 1}` : `Generating ${COUNT} images`} with ${model.name}, ${next.aspect.label}.${simulated ? " Simulated, nothing was sent." : ""}`);
    next.tiles.forEach((tile, index) => runTile(next, index, tile));
  };

  const stop = () => {
    controllers.current.forEach(controller => controller.abort());
    announce("Stopped. Finished images are kept.");
  };

  const retry = (index: number) => {
    const current = batch;
    const previous = current?.tiles[index];
    const count = current ? tally.current.get(current.id) : undefined;
    if (!current || !previous || !count || previous.status === "running" || previous.status === "done") return;
    count.pending += 1;
    if (previous.status === "error") count.failed -= 1;
    const tile = newTile(`${current.id}-${index}-${Number(previous.key.split("-")[2] ?? 0) + 1}`);
    setBatch({ ...current, endedAt: undefined, tiles: current.tiles.map((entry, i) => i === index ? tile : entry) });
    announce(`Retrying image ${index + 1}.${simulated ? " Simulated, nothing was sent." : ""}`);
    runTile(current, index, tile);
  };

  const choose = (index: number) => {
    const tile = batch?.tiles[index];
    if (!tile || index === active) return;
    if (upscale) { stopUpscale(); setUpscale(null); }
    setActive(index);
    activeRef.current = index;
    setSaved(false);
    const image = tile.upscaled ?? tile.image;
    if (image) onSelect?.(image);
    announce(`Image ${index + 1}${tile.status === "running" ? ", generating" : tile.status === "error" ? ", failed" : tile.status === "stopped" ? ", stopped" : ""}.`);
  };

  // The demo plays itself once: generate when it scrolls into view, unless someone got there first.
  const auto = autoGenerate ?? simulated;
  const startRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    const node = root.current;
    if (!auto || autoRan.current || !node || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting || autoRan.current) return;
      autoRan.current = true;
      observer.disconnect();
      timer = window.setTimeout(() => { if (!batchRef.current && !touched.current) startRef.current(); }, 450);
    }, { threshold: .35 });
    observer.observe(node);
    return () => { observer.disconnect(); window.clearTimeout(timer); };
  }, [auto]);
  useLayoutEffect(() => { startRef.current = () => start(); batchRef.current = batch; });

  const runUpscale = async () => {
    const current = batch;
    const index = active;
    const tile = current?.tiles[index];
    if (!current || !tile?.image || tile.upscaled) return;
    upscaleController.current?.abort();
    const controller = new AbortController();
    upscaleController.current = controller;
    upscaleRun.current?.stop();
    upscaleProgress.set(0);
    setUpscale({ index, status: "running" });
    announce(`Upscaling image ${index + 1}.${onUpscale ? "" : " Simulated, nothing was sent."}`);
    try {
      const result = await (onUpscale ?? simulateImageUpscale)(tile.image, { signal: controller.signal, onProgress: next => { if (!controller.signal.aborted) push(upscaleProgress, next, null); } });
      if (controller.signal.aborted) return;
      upscaleRun.current?.stop();
      upscaleProgress.set(1);
      updateTile(current.id, index, { upscaled: result });
      setUpscale(null);
      onSelect?.(result);
      announce(`Upscaled image ${index + 1} to ${sizeOf(result, current.aspect)}.`);
    } catch (error) {
      if (controller.signal.aborted || isAbort(error)) return;
      setUpscale({ index, status: "error", message: errorText(error) });
      announce(`Upscale failed. ${errorText(error)}`);
    }
  };

  const download = () => {
    const current = batch;
    const tile = current?.tiles[active];
    const image = tile?.upscaled ?? tile?.image;
    if (!current || !image) return;
    const name = fileName(current.prompt, active, image);
    if (onDownload) onDownload(image);
    else {
      const link = document.createElement("a");
      link.href = image.src;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    setSaved(true);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(false), 1600);
    announce(onDownload ? `Image ${active + 1} sent to download.` : `Downloaded ${name}.`);
  };

  /* Stage size: the canvas keeps the batch's ratio, capped in height so portrait shapes stay compact. */
  const [frameWidth, setFrameWidth] = useState<number | null>(null);
  const widthChanged = useRef(false);
  useLayoutEffect(() => {
    const node = frame.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const width = Math.round(entry?.contentRect.width ?? node.offsetWidth);
      setFrameWidth(previous => { if (previous !== width) widthChanged.current = true; return width; });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const shape = batch?.aspect ?? aspect;
  const ratio = shape ? shape.width / shape.height : 1;
  const stageW = frameWidth ? Math.round(Math.min(frameWidth, MAX_STAGE_HEIGHT * ratio)) : 0;
  const stageH = Math.round(stageW / ratio);
  // Width and height are motion values: a ratio change springs, a container resize or the first measure cuts.
  const stageWidth = useMotionValue(0);
  const stageHeight = useMotionValue(0);
  const stageReady = useRef(false);
  useLayoutEffect(() => {
    if (!stageW) return;
    const cut = !stageReady.current || widthChanged.current || reduced;
    stageReady.current = true;
    widthChanged.current = false;
    if (cut) { stageWidth.stop(); stageHeight.stop(); stageWidth.set(stageW); stageHeight.set(stageH); return; }
    const a = animate(stageWidth, stageW, SPRING), b = animate(stageHeight, stageH, SPRING);
    return () => { a.stop(); b.stop(); };
  }, [stageW, stageH, reduced, stageWidth, stageHeight]);

  const running = batch?.tiles.some(tile => tile.status === "running") ?? false;
  const tile = batch?.tiles[active];
  const shown = tile?.upscaled ?? tile?.image;
  const upscaling = upscale?.status === "running" && upscale.index === active;
  const readyCount = batch?.tiles.filter(entry => entry.status === "done").length ?? 0;
  const canAct = tile?.status === "done" && !!shown && !upscaling;

  const onArrow = (index: number) => (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const next = event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % COUNT
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index + COUNT - 1) % COUNT
        : event.key === "Home" ? 0 : event.key === "End" ? COUNT - 1 : -1;
    if (next < 0) return;
    event.preventDefault();
    choose(next);
    root.current?.querySelector<HTMLElement>(`[data-thumb="${next}"]`)?.focus();
  };

  // Top left pill: what the canvas is doing.
  const status: { id: string; node: ReactNode } | null = !batch || !tile ? null
    : upscaling ? { id: `up-${tile.key}`, node: <><DotSpinner className={styles.spinner} dotClassName={styles.spinDot} /><span>Upscaling</span><Percent progress={upscaleProgress} /></> }
    : upscale?.status === "error" && upscale.index === active ? { id: `upfail-${tile.key}`, node: <><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" className={styles.danger} /><span>Upscale failed</span></> }
    : tile.status === "running" ? { id: `run-${tile.key}`, node: <><DotSpinner className={styles.spinner} dotClassName={styles.spinDot} /><span>{batch.variationOf ? "Varying" : "Generating"}</span><Percent progress={tile.progress} /></> }
    : tile.status === "done" && tile.upscaled && tile.image ? { id: `upd-${tile.key}`, node: <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span>Upscaled</span><span className={styles.mono}>{upscaleFactor(tile.image, tile.upscaled)}</span></> }
    : tile.status === "done" && shown ? { id: `done-${tile.key}`, node: <span className={styles.mono}>{[shown.seed ? `seed ${shown.seed}` : null, tile.endedAt ? seconds(tile.endedAt - tile.startedAt) : null].filter(Boolean).join(" · ") || `image ${active + 1}`}</span> }
    : null;
  const dims = sizeOf(tile?.status === "done" ? shown : undefined, shape ?? { id: "", label: "", width: 1024, height: 1024 });

  return <div ref={root} className={cx(styles.root, className)}
    onPointerDownCapture={() => { touched.current = true; }}
    onKeyDownCapture={event => { touched.current = true; if (event.key === "Escape" && running) { event.preventDefault(); stop(); } }}>
    <div ref={frame} className={styles.frame}>
      <motion.div className={styles.stage} data-status={tile?.status ?? "empty"}
        style={stageW ? { width: stageWidth, height: stageHeight } : { width: "100%", aspectRatio: `${ratio}`, maxWidth: `${MAX_STAGE_HEIGHT * ratio}px` }}>
        <AnimatePresence initial={false}>
          {!batch || !tile ? <motion.div key="empty" className={styles.layer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: SWAP_OUT }} transition={FADE}>
            <DotField phase="idle" reduced={reduced} pitch={8} className={styles.field} canvasClassName={styles.fieldCanvas} glowClassName={styles.fieldGlow} />
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Describe an image, then generate</p>
              <div className={styles.suggestions}>
                {suggestions.slice(0, 3).map(text => <button key={text} type="button" className={styles.suggestion} onClick={() => { setPrompt(text); field.current?.focus(); }}>{text}</button>)}
              </div>
            </div>
          </motion.div> : <motion.div key={tile.key} className={styles.layer} role="img" aria-label={tile.status === "done" && shown ? shown.alt : `Image ${active + 1}, ${tile.status === "running" ? "generating" : tile.status === "error" ? "failed" : "stopped"}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: .16 } }} transition={reduced ? INSTANT : { duration: .2, ease: [...motionTokens.ease.standard] }}>
            <CanvasImage tile={tile} seed={waveSeed(batch, active)} reduced={reduced} upscaling={upscaling} upscaleProgress={upscaleProgress} />
          </motion.div>}
        </AnimatePresence>

        <AnimatePresence>
          {tile && (tile.status === "error" || tile.status === "stopped") ? <motion.div key={`halt-${tile.key}`} className={styles.halt} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={FADE}>
            <span className={styles.haltLabel} data-status={tile.status}>
              {tile.status === "error" ? <CircleAlert size={16} strokeWidth={1.75} aria-hidden="true" /> : <Square size={12} strokeWidth={2.25} aria-hidden="true" />}
              {tile.status === "error" ? "Failed" : "Stopped"}
            </span>
            {tile.status === "error" && tile.error ? <span className={styles.haltMessage}>{tile.error}</span> : null}
            <Button variant="secondary" size="sm" className={styles.retry} onClick={() => retry(active)} aria-label={`Retry image ${active + 1}`}>
              <RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry
            </Button>
          </motion.div> : null}
        </AnimatePresence>

        <PillSwap id={status?.id ?? null} className={styles.statusSlot} reduced={reduced}>{status?.node}</PillSwap>
        <PillSwap id={`dims-${dims}`} className={styles.dimsSlot} reduced={reduced}><span className={styles.mono}>{dims}</span></PillSwap>
      </motion.div>
    </div>

    <div className={styles.bar}>
      <div className={styles.strip} role="radiogroup" aria-label={batch ? `Variations for: ${batch.prompt}` : "Variations"} data-empty={!batch || undefined}>
        {batch ? batch.tiles.map((entry, index) => <Thumb key={entry.key} tile={entry} index={index} seed={waveSeed(batch, index) + 5} active={index === active} tabStop={index === active} reduced={reduced}
          onChoose={() => choose(index)} onArrow={onArrow(index)} />)
          : Array.from({ length: COUNT }, (_, index) => <span key={index} className={styles.thumbPlaceholder} aria-hidden="true" />)}
      </div>
      <div className={styles.actions}>
        <Button variant="secondary" size="sm" className={styles.action} aria-label={tile?.upscaled ? "Upscaled" : upscaling ? "Upscaling" : "Upscale"} disabled={!canAct || !!tile?.upscaled} onClick={runUpscale}>
          <StableLabel value={tile?.upscaled ? "upscaled" : upscaling ? "upscaling" : "upscale"} options={{
            upscale: <><Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscale</span></>,
            upscaling: <><Maximize2 size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscaling</span></>,
            upscaled: <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Upscaled</span></>,
          }} />
        </Button>
        <Button variant="secondary" size="sm" className={styles.action} aria-label="Vary" disabled={!canAct} onClick={() => tile?.image && start({ image: tile.image, index: active })}>
          <Shuffle size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Vary</span>
        </Button>
        <Button variant="secondary" size="sm" className={styles.action} aria-label={saved ? "Saved" : "Download"} disabled={!canAct} onClick={download}>
          <StableLabel value={saved ? "saved" : "download"} options={{
            download: <><Download size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Download</span></>,
            saved: <><Check size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.actionLabel}>Saved</span></>,
          }} />
        </Button>
      </div>
    </div>

    <form className={styles.composer} onSubmit={event => { event.preventDefault(); if (running) stop(); else start(); }}>
      <textarea ref={field} className={styles.prompt} value={prompt} placeholder={placeholder} rows={2} aria-label="Prompt" aria-keyshortcuts="Meta+Enter Control+Enter"
        onChange={event => setPrompt(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); if (!running) start(); } }} />
      <div className={styles.toolbar}>
        <div className={styles.options}>
          <ModelChips models={models} value={model?.id ?? ""} onChange={setModelId} reduced={reduced} />
          <AspectChips aspects={aspectRatios} value={aspect?.id ?? ""} onChange={setAspectId} />
        </div>
        <Button type="submit" size="sm" variant={running ? "secondary" : "primary"} className={cx(styles.generate, !running && styles.generatePrimary)} disabled={!running && !prompt.trim()}>
          <StableLabel value={running ? "stop" : "generate"} options={{
            generate: <><Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />Generate</>,
            stop: <><Square size={12} strokeWidth={2.25} aria-hidden="true" />Stop<span className={styles.count}>{readyCount}/{COUNT}</span></>,
          }} />
        </Button>
      </div>
    </form>
    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </div>;
}

export default ImageGeneration;
