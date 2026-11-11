"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CircleAlert, RotateCcw } from "lucide-react";
import { photo } from "../lib/media";
import type { PhotoId } from "../lib/media";
import { Button } from "../../button/button";
import { RevealEngine, readPalette } from "./image-reveal-engine";
import styles from "./image-reveal.module.css";

export type ImageRevealStatus = "queued" | "generating" | "decoding" | "done" | "error";
export type ImageRevealSize = "sm" | "md" | "lg";

export interface ImageRevealProps {
  /** Final image. Omit to cycle through sample photos in the self-playing demo. */
  src?: string;
  /** Alt text for the final image. */
  alt?: string;
  /** Controlled state. Omit for auto mode: queued, then sampling over `duration`, a short decode, then done. */
  status?: ImageRevealStatus;
  /** Controlled progress, 0 to 1, while `status` is "generating". Coarse updates are smoothed. */
  progress?: number;
  /** Milliseconds the sampling steps take when progress is not controlled. Steps run at a constant rate, like a real sampler. */
  duration?: number;
  /** Milliseconds the decode takes, after the last step. */
  decodeDuration?: number;
  /** Sampling steps, shown as 18 / 30. Each one is a visible denoising step. */
  steps?: number;
  /** Width over height, as a number (1.5) or a CSS ratio ("4 / 5"). */
  aspectRatio?: number | string;
  /** Overlay scale: "sm" for grids and thumbnails, "lg" for a large canvas. */
  size?: ImageRevealSize;
  /** Any CSS color for the progress ring. Defaults to the accent. */
  color?: string;
  /** Shows the progress pill. */
  showProgress?: boolean;
  /** Plays one soft light sheen when the image resolves. */
  sheen?: boolean;
  /** Label while queued. */
  queueLabel?: string;
  /** Message in the error state. */
  errorMessage?: string;
  /** Auto mode only: starts generating on mount. */
  autoPlay?: boolean;
  /** Auto mode only: blurs back out and generates again after `holdDuration`. */
  loop?: boolean;
  /** Auto mode only: extra milliseconds in the queue before the first run, for staggered grids. */
  startDelay?: number;
  /** Auto mode only: milliseconds in the queue before each run. */
  queueDuration?: number;
  /** Auto mode only: milliseconds the finished image holds before a loop restarts. */
  holdDuration?: number;
  /** Auto mode only: change it to blur back out and run again. */
  runKey?: string | number;
  /** Seeds the latent noise, so tiles in a grid differ and a replay of the same seed shows the same noise. */
  seed?: number;
  onStatusChange?: (status: ImageRevealStatus) => void;
  /** Fires once the final image is fully resolved. */
  onComplete?: () => void;
  /** Shows a Retry button in the error state. */
  onRetry?: () => void;
  className?: string;
  style?: CSSProperties;
}

const SAMPLE_PHOTOS: PhotoId[] = ["alpine-lake", "terracotta-waves", "ceramic-lamp", "sea-at-dusk", "lisbon-rooftops"];
const RING_RADIUS = 8;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const resize = { type: "spring", visualDuration: 0.24, bounce: 0 } as const;
const enter = { duration: 0.16, ease: [0.22, 1, 0.36, 1] } as const;
/** Labels come in just after the old one has mostly left, so two words never overlap. */
const labelEnter = { ...enter, delay: 0.06 } as const;
const leave = { duration: 0.1, ease: [0.4, 0, 1, 1] } as const;
const SHEEN_SECONDS = 1.1;

type AutoPhase = "wait" | "generating" | "decoding" | "hold";

function ratio(value: number | string) {
  return typeof value === "number" ? String(value) : value;
}

/** Exponential follow: frame-rate independent, interruptible from any value. */
function follow(value: number, target: number, dt: number, tau: number, snap = 0.0008) {
  const next = value + (target - value) * (1 - Math.exp(-dt / tau));
  return Math.abs(target - next) < snap ? target : next;
}

/** Noise left after a step, as a share of the start: a schedule that drops fast early, so composition shows by a third. */
function sigma(fraction: number) {
  return Math.pow(1 - fraction, 1.6);
}

function formatSeconds(seconds: number) {
  return `${seconds.toFixed(1)}s`;
}

/**
 * Image generation the way a diffusion model samples: pure latent noise, then one denoising step at a time the
 * prediction resolves from color blobs to composition to shapes while the noise falls away, then a tiled decode lands the
 * sharp image. Canvas 2D, paused off screen.
 */
export function ImageReveal({
  src,
  alt,
  status,
  progress,
  duration = 4600,
  decodeDuration = 560,
  steps = 30,
  aspectRatio = 1,
  size = "md",
  color,
  showProgress = true,
  sheen = true,
  queueLabel = "Queued",
  errorMessage = "Generation failed",
  autoPlay = true,
  loop = true,
  startDelay = 0,
  queueDuration = 900,
  holdDuration = 2600,
  runKey,
  seed = 1,
  onStatusChange,
  onComplete,
  onRetry,
  className,
  style,
}: ImageRevealProps) {
  const reduced = useReducedMotion() ?? false;
  const auto = status === undefined;
  const [autoStatus, setAutoStatus] = useState<ImageRevealStatus>("queued");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [doneSettled, setDoneSettled] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [chipWidth, setChipWidth] = useState<number>();
  const current = auto ? autoStatus : status;

  const sample = photo(SAMPLE_PHOTOS[photoIndex % SAMPLE_PHOTOS.length]);
  const imageSrc = src ?? sample.src;
  const imageAlt = alt ?? (src ? "Generated image" : sample.alt);

  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const engineRef = useRef<RevealEngine | null>(null);

  /** Latest props for the frame loop, which runs outside React renders. */
  const latest = useRef({ current, auto, progress, duration, decodeDuration, steps, autoPlay, loop, startDelay, queueDuration, holdDuration, runKey, reduced, sheen, hasSrc: src !== undefined, onComplete });
  useLayoutEffect(() => {
    latest.current = { current, auto, progress, duration, decodeDuration, steps, autoPlay, loop, startDelay, queueDuration, holdDuration, runKey, reduced, sheen, hasSrc: src !== undefined, onComplete };
  });

  // Engine lifetime, sizing, and the frame loop.
  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;
    const engine = new RevealEngine(canvas, seed);
    engineRef.current = engine;

    const sim = {
      bloom: 0,
      shown: 0,
      detail: 0,
      noise: 1,
      noiseMix: 1,
      decode: 0,
      hide: 0,
      shimmer: 1,
      error: 0,
      time: 0,
      speed: 1,
      sheen: -1,
      generated: 0,
      elapsed: 0,
      lastStatus: latest.current.current,
      phase: "wait" as AutoPhase,
      phaseTime: 0,
      runKey: latest.current.runKey,
      wasAuto: latest.current.auto,
      firstRun: true,
      completed: false,
      doneTime: 0,
      settled: false,
      step: 0,
      drawn: "",
    };

    const restartAuto = () => {
      sim.phase = "wait";
      sim.phaseTime = sim.firstRun ? 0 : latest.current.startDelay;
      setAutoStatus("queued");
    };

    const tickAuto = (dt: number) => {
      const p = latest.current;
      if (p.runKey !== sim.runKey || (p.auto && !sim.wasAuto)) {
        sim.runKey = p.runKey;
        sim.firstRun = true;
        restartAuto();
      }
      sim.wasAuto = p.auto;
      if (!p.auto || !p.autoPlay) return;
      sim.phaseTime += dt * 1000;
      if (sim.phase === "wait" && sim.phaseTime >= p.startDelay + p.queueDuration && engine.hasImage && !engine.hasPending && sim.bloom < 0.02) {
        sim.phase = "generating";
        sim.phaseTime = 0;
        sim.generated = 0;
        setAutoStatus("generating");
      } else if (sim.phase === "generating" && sim.generated >= p.duration && sim.shown > 0.995) {
        sim.phase = "decoding";
        sim.phaseTime = 0;
        setAutoStatus("decoding");
      } else if (sim.phase === "decoding" && sim.decode >= 1) {
        sim.phase = "hold";
        sim.phaseTime = 0;
        setAutoStatus("done");
      } else if (sim.phase === "hold" && p.loop && sim.completed && sim.phaseTime >= p.holdDuration) {
        sim.firstRun = false;
        restartAuto();
        if (!p.hasSrc) setPhotoIndex(index => index + 1);
      }
    };

    const frame = (dt: number) => {
      const p = latest.current;
      tickAuto(dt);
      const now = p.current;
      if (now !== sim.lastStatus) {
        if (now === "generating" && sim.lastStatus !== "decoding") {
          sim.generated = 0;
          sim.elapsed = 0;
        }
        if (now !== "done") sim.completed = false;
        sim.lastStatus = now;
      }
      const finishing = now === "decoding" || now === "done";

      // Steps run at a constant rate, like a real sampler. Controlled progress is smoothed so coarse updates still glide.
      let target = sim.shown;
      if (now === "queued") target = 0;
      else if (now === "generating") {
        if (p.progress !== undefined) target = Math.min(1, Math.max(0, p.progress));
        else {
          sim.generated += dt * 1000;
          target = Math.min(1, sim.generated / p.duration);
        }
      } else if (finishing) target = 1;
      if (now === "generating" || now === "decoding") sim.elapsed += dt;

      // Starting over or swapping the photo clears the decoded image first, then resets underneath.
      const swapping = engine.hasPending && engine.hasImage;
      const rewinding = target < sim.shown - 0.02;
      sim.hide = follow(sim.hide, rewinding || swapping || now === "error" ? 1 : 0, dt, p.reduced ? 0.08 : now === "error" ? 0.2 : 0.1, 0.004);
      if (sim.hide > 0.97) {
        if (engine.hasPending) engine.swap(sim.bloom > 0.02);
        if (rewinding) sim.shown = target;
      }
      if (engine.hasPending && !engine.hasImage) engine.swap(false);
      if (!rewinding) sim.shown = p.auto && now === "generating" ? target : follow(sim.shown, target, dt, p.reduced ? 0.12 : 0.16);

      // The visible step: what the sampler has finished. The prediction and the noise move per step, not per frame.
      const nextStep = finishing ? p.steps : now === "queued" ? 0 : Math.min(p.steps, Math.max(1, Math.ceil(sim.shown * p.steps - 0.001)));
      if (nextStep !== sim.step) {
        sim.step = nextStep;
        setStep(nextStep);
        if (nextStep > 0 && !p.reduced) {
          engine.setNoiseStep(nextStep);
          sim.noiseMix = 0;
        }
      }
      if (p.reduced) engine.setNoiseStep(1);
      const fraction = p.steps > 0 ? sim.step / p.steps : 0;

      const sampling = now === "generating" || finishing || now === "error";
      const bloomTarget = !engine.hasImage || !sampling ? 0 : 1;
      sim.bloom = follow(sim.bloom, bloomTarget, dt, now === "queued" ? 0.16 : 0.12, 0.002);
      sim.detail = follow(sim.detail, now === "queued" ? 0 : finishing ? 1 : Math.pow(fraction, 0.55), dt, now === "queued" ? 0.2 : 0.07, 0.001);
      // While a run clears, the noise holds still so the old image fades straight back to the surface; it resets once hidden.
      if (now === "queued") sim.noise = sim.bloom < 0.02 ? 1 : sim.noise;
      else sim.noise = follow(sim.noise, finishing ? 0 : sigma(fraction), dt, 0.06, 0.001);
      sim.noiseMix = follow(sim.noiseMix, 1, dt, 0.035, 0.002);
      // The decode runs at a fixed pace once sampling is finished, and clears quickly if the run is reset.
      if (finishing && sim.noise < 0.05 && sim.hide < 0.05) sim.decode = Math.min(1, sim.decode + dt / Math.max(0.05, p.decodeDuration / 1000));
      else if (!finishing) sim.decode = follow(sim.decode, 0, dt, 0.1, 0.002);
      sim.shimmer = follow(sim.shimmer, now === "queued" || !engine.hasImage ? 1 : 0, dt, 0.3, 0.002);
      sim.error = follow(sim.error, now === "error" ? 1 : 0, dt, 0.14, 0.002);
      engine.snapshotAlpha = follow(engine.snapshotAlpha, 0, dt, 0.16, 0.003);

      const speedTarget = p.reduced || now === "error" ? 0 : 1;
      sim.speed = follow(sim.speed, speedTarget, dt, 0.4, 0.002);
      sim.time += dt * sim.speed;

      const resolved = now === "done" && sim.decode >= 1 && sim.hide === 0 && engine.hasImage && !engine.hasPending;
      if (resolved && !sim.completed) {
        sim.completed = true;
        sim.sheen = p.sheen && !p.reduced ? 0 : -1;
        setElapsed(sim.elapsed);
        p.onComplete?.();
      }
      if (sim.sheen >= 0) {
        sim.sheen += dt / SHEEN_SECONDS;
        if (sim.sheen >= 1 || !resolved) sim.sheen = -1;
      }

      // Draw only when something visible can change: moving values or the queued shimmer.
      const living = sim.speed > 0.01 && sim.shimmer > 0.002 && sim.bloom < 0.999;
      const key = `${sim.bloom}|${sim.detail}|${sim.noise}|${sim.noiseMix}|${sim.decode}|${sim.hide}|${sim.shimmer}|${sim.error}|${sim.sheen}|${engine.snapshotAlpha}|${p.reduced}`;
      if (engine.ready && (engine.dirty || living || key !== sim.drawn)) {
        engine.render({ bloom: sim.bloom, detail: sim.detail, noise: sim.noise, noiseMix: sim.noiseMix, decode: sim.decode, hide: sim.hide, shimmer: sim.shimmer, time: sim.time, sheen: sim.sheen, error: sim.error, reduced: p.reduced });
        sim.drawn = key;
      }

      if (ringRef.current) ringRef.current.style.strokeDashoffset = String(RING_LENGTH * (1 - sim.shown));

      sim.doneTime = resolved ? sim.doneTime + dt : 0;
      const settled = sim.doneTime > 1.6;
      if (settled !== sim.settled) {
        sim.settled = settled;
        setDoneSettled(settled);
      }
    };

    let raf = 0;
    let last = 0;
    let onScreen = true;
    const loopFrame = (time: number) => {
      const dt = last ? Math.min(0.05, (time - last) / 1000) : 1 / 60;
      last = time;
      frame(dt);
      raf = requestAnimationFrame(loopFrame);
    };
    const start = () => {
      if (raf || !onScreen || document.hidden) return;
      last = 0;
      raf = requestAnimationFrame(loopFrame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const sizeObserver = new ResizeObserver(entries => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      engine.resize(Math.round(box.width), Math.round(box.height), Math.min(2, window.devicePixelRatio || 1));
    });
    sizeObserver.observe(root);
    const viewObserver = new IntersectionObserver(entries => {
      onScreen = entries[0]?.isIntersecting ?? true;
      if (onScreen) start();
      else stop();
    });
    viewObserver.observe(root);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      sizeObserver.disconnect();
      viewObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
      engineRef.current = null;
    };
    // The engine is created once; seed changes are applied below without tearing it down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setSeed(seed);
  }, [seed]);

  // Theme: resolve tokens now and again whenever the theme attribute, class or color scheme changes.
  useEffect(() => {
    const probe = probeRef.current;
    if (!probe) return;
    const apply = () => engineRef.current?.setPalette(readPalette(probe));
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme", "style"] });
    const scheme = window.matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", apply);
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", apply);
    };
  }, []);

  // Load and decode off the main thread before the engine sees the image.
  useEffect(() => {
    let cancelled = false;
    const image = new Image();
    image.decoding = "async";
    image.src = imageSrc;
    image
      .decode()
      .catch(() => undefined)
      .then(() => {
        if (!cancelled && image.naturalWidth) engineRef.current?.setImage(image);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const reportedStatus = useRef(current);
  useEffect(() => {
    if (reportedStatus.current === current) return;
    reportedStatus.current = current;
    onStatusChange?.(current);
  }, [current, onStatusChange]);

  // The pill animates to its content's measured width (plus its 1px border on each side).
  const chipObserver = useRef<ResizeObserver | null>(null);
  const measureChip = useCallback((element: HTMLSpanElement | null) => {
    chipObserver.current?.disconnect();
    chipObserver.current = null;
    if (!element) return;
    const observer = new ResizeObserver(() => setChipWidth(element.offsetWidth + 2));
    observer.observe(element);
    chipObserver.current = observer;
  }, []);

  const compact = size === "sm";
  const chipVisible = showProgress && current !== "error" && !(current === "done" && doneSettled);
  const simulated = auto ? ", simulated" : "";
  const announcement = current === "queued" ? queueLabel : current === "generating" ? "Generating image" : current === "decoding" ? "Decoding image" : current === "done" ? "Image ready" : errorMessage;
  const doneLabel = elapsed > 0.05 ? (compact ? formatSeconds(elapsed) : `Done in ${formatSeconds(elapsed)}`) : "Done";
  const canvasLabel = current === "done" ? imageAlt : `${announcement}${imageAlt ? `: ${imageAlt}` : ""}`;
  const phase = (present: boolean) => (reduced ? { duration: 0.12 } : present ? labelEnter : leave);
  const label = { initial: { opacity: 0, y: 2 }, animate: { opacity: 1, y: 0, transition: phase(true) }, exit: { opacity: 0, y: -2, transition: phase(false) } };

  return (
    <div
      ref={rootRef}
      className={[styles.root, styles[size], className].filter(Boolean).join(" ")}
      style={{ aspectRatio: ratio(aspectRatio), ...(color ? { ["--ir-accent" as string]: color } : null), ...style }}
      data-status={current}
    >
      <canvas ref={canvasRef} className={styles.canvas} role="img" aria-label={canvasLabel} />
      <span ref={probeRef} className={styles.probe} aria-hidden="true" />

      <AnimatePresence initial={false}>
        {chipVisible ? (
          <motion.div
            key="chip"
            className={styles.chip}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0, width: chipWidth }}
            exit={{ opacity: 0, y: 2, transition: reduced ? { duration: 0.12 } : { duration: 0.22, ease: [0.4, 0, 1, 1] } }}
            transition={reduced ? { duration: 0 } : { opacity: enter, y: enter, width: resize }}
          >
            <span ref={measureChip} className={styles.chipContent}>
              <AnimatePresence mode="popLayout" initial={false}>
                {current === "queued" ? (
                  <motion.span key="queued" className={styles.phase} {...label}>
                    <svg className={`${styles.ring} ${styles.spin}`} viewBox="0 0 20 20" aria-hidden="true">
                      <circle className={styles.ringTrack} cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.5" />
                      <circle className={styles.ringArc} cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.5" strokeDasharray={`${RING_LENGTH * 0.22} ${RING_LENGTH}`} />
                    </svg>
                    <span className={styles.text}>{queueLabel}</span>
                  </motion.span>
                ) : current === "generating" ? (
                  <motion.span
                    key="generating"
                    className={styles.phase}
                    role="progressbar"
                    aria-label="Generation progress"
                    aria-valuemin={0}
                    aria-valuemax={steps}
                    aria-valuenow={step}
                    aria-valuetext={`Step ${step} of ${steps}`}
                    {...label}
                  >
                    <svg className={styles.ring} viewBox="0 0 20 20" aria-hidden="true">
                      <circle className={styles.ringTrack} cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.5" />
                      <circle ref={ringRef} className={styles.ringArc} cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.5" strokeDasharray={RING_LENGTH} strokeDashoffset={RING_LENGTH} />
                    </svg>
                    {compact ? null : <span className={styles.text}>Denoising</span>}
                    <span className={`${styles.reserve} ${compact ? "" : styles.count}`}>
                      <span className={styles.ghost} aria-hidden="true">{`${steps} / ${steps}`}</span>
                      <span>{`${step} / ${steps}`}</span>
                    </span>
                  </motion.span>
                ) : current === "decoding" ? (
                  <motion.span key="decoding" className={styles.phase} {...label}>
                    <svg className={`${styles.ring} ${styles.spin}`} viewBox="0 0 20 20" aria-hidden="true">
                      <circle className={styles.ringTrack} cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.5" />
                      <circle className={styles.ringArc} cx="10" cy="10" r={RING_RADIUS} fill="none" strokeWidth="2.5" strokeDasharray={`${RING_LENGTH * 0.3} ${RING_LENGTH}`} />
                    </svg>
                    <span className={styles.text}>Decoding</span>
                  </motion.span>
                ) : (
                  <motion.span key="done" className={styles.phase} {...label}>
                    <Check className={styles.doneIcon} aria-hidden="true" strokeWidth={2.25} />
                    <span className={styles.text}>{doneLabel}</span>
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {current === "error" ? (
          <motion.div key="error" className={styles.errorLayer} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={reduced ? { duration: 0.12 } : { duration: 0.2 }}>
            <motion.div className={styles.errorBody} initial={reduced ? false : { y: 3 }} animate={{ y: 0 }} transition={reduced ? { duration: 0 } : resize}>
              <span className={styles.errorTitle}>
                <CircleAlert className={styles.errorIcon} aria-hidden="true" strokeWidth={2} />
                <span>{compact ? "Failed" : errorMessage}</span>
              </span>
              {onRetry ? (
                <Button variant="secondary" size="sm" onClick={onRetry} aria-label={compact ? "Retry generation" : undefined}>
                  <RotateCcw aria-hidden="true" />
                  Retry
                </Button>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <span className={styles.srOnly} role="status" aria-live="polite">
        {`${announcement}${simulated}`}
      </span>
    </div>
  );
}

export default ImageReveal;
