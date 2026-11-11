"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useReducedMotion } from "motion/react";
import { createMascotEngine, type MascotEngine } from "./pixel-mascot-engine";
import { art, DOTS, GRID, poseAttrs, SPARKS, sparkArt, stillPose, toPath, type PixelMascotStatus } from "./pixel-mascot-sprite";
import styles from "./pixel-mascot.module.css";

export type { PixelMascotStatus } from "./pixel-mascot-sprite";

export interface PixelMascotProps {
  /** What the assistant is doing. Leave it out to play the built in loop through every state. */
  status?: PixelMascotStatus;
  /** Integer pixel scale from 1 to 8. Each sprite pixel is this many CSS pixels, so 1 renders 24px and 4 renders 96px. Defaults to 4. */
  size?: number;
  /** Who the mascot stands for, used in the accessible label ("Arc is thinking"). Defaults to "Assistant". */
  name?: string;
  /** Replaces the generated accessible label. */
  label?: string;
  /** Announces status changes in a polite live region. Defaults to true when status is controlled, false for the built in loop. */
  announce?: boolean;
  /** Freezes the animation on the current frame. It also pauses by itself while off screen. */
  paused?: boolean;
  className?: string;
  style?: CSSProperties;
}

export const pixelMascotStatuses: PixelMascotStatus[] = ["idle", "thinking", "writing", "done", "error"];

const PHRASE: Record<PixelMascotStatus, string> = { idle: "is ready", thinking: "is thinking", writing: "is writing", done: "is done", error: "ran into an error" };

/** The built in loop: each state long enough to read, with an error pass every other round. */
const LOOP: [PixelMascotStatus, number][] = [["idle", 1800], ["thinking", 2400], ["writing", 3200], ["done", 2000], ["idle", 1400], ["thinking", 2000], ["error", 2200]];

/** Plays the built in loop of statuses. Pass false to hold the current one. */
export function usePixelMascotLoop(enabled = true): PixelMascotStatus {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const timer = window.setTimeout(() => setIndex(value => (value + 1) % LOOP.length), LOOP[index][1]);
    return () => window.clearTimeout(timer);
  }, [enabled, index]);
  return LOOP[index][0];
}

export function PixelMascot({ status, size = 4, name = "Assistant", label, announce, paused = false, className, style }: PixelMascotProps) {
  const looping = status === undefined;
  const loopStatus = usePixelMascotLoop(looping && !paused);
  const current = status ?? loopStatus;
  const reduced = useReducedMotion() ?? false;
  const scale = Math.min(8, Math.max(1, Math.round(Number.isFinite(size) ? size : 4)));
  const text = label ?? `${name} ${PHRASE[current]}`;

  const svgRef = useRef<SVGSVGElement>(null);
  const engineRef = useRef<MascotEngine | null>(null);
  const visibleRef = useRef(true);
  const pausedRef = useRef(paused);

  // The first render draws the resting pose for the starting status; after that only the engine writes these attributes.
  const [boot] = useState(() => ({ status: current, attrs: poseAttrs(stillPose(current)) }));

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const engine = createMascotEngine(svg, boot.status);
    engineRef.current = engine;
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(([entry]) => {
      visibleRef.current = entry?.isIntersecting ?? true;
      engine.setRunning(visibleRef.current && !pausedRef.current);
    });
    observer?.observe(svg);
    return () => { observer?.disconnect(); engine.destroy(); engineRef.current = null; };
  }, [boot]);

  useEffect(() => { engineRef.current?.setStatus(current); }, [current]);
  useEffect(() => { engineRef.current?.setStill(reduced); }, [reduced]);
  useEffect(() => {
    pausedRef.current = paused;
    engineRef.current?.setRunning(visibleRef.current && !paused);
  }, [paused]);

  const a = boot.attrs;
  return <span className={`${styles.root} ${className ?? ""}`} style={style}>
    <svg ref={svgRef} className={styles.svg} viewBox={`0 0 ${GRID} ${GRID}`} width={GRID * scale} height={GRID * scale} shapeRendering="crispEdges" role="img" aria-label={text} {...a.root}>
      <rect data-part="shadow" className={styles.shadow} y={22} height={1} {...a.shadow} />

      <path data-part="tailNear" className={styles.ink} d={toPath(art.tailNear)} {...a.tailNear} />
      <path data-part="tailFar" className={styles.ink} d={toPath(art.tailFar)} {...a.tailFar} />
      <g data-part="cloud" {...a.cloud}>
        <path className={styles.body} d={toPath(art.cloudFill)} />
        <path className={styles.ink} d={toPath(art.cloudInk)} />
        {DOTS.map((x, i) => <rect key={x} data-part={`dot${i}`} className={styles.ink} x={x} y={2} width={1} height={1} {...a[`dot${i}`]} />)}
      </g>

      <g data-part="body" {...a.body}>
        {(["L", "R"] as const).map(side => [0, 1, 2].map(i => <rect key={`${side}${i}`} data-part={`arm${side}${i}`} className={styles.ink} width={1} height={1} {...a[`arm${side}${i}`]} />))}
        <path className={styles.tip} d={toPath(art.tip)} />
        <path className={styles.body} d={toPath(art.body)} />
        <path className={styles.shade} d={toPath(art.shade)} />
        <path className={styles.ink} d={toPath(art.ink)} />
        <path className={styles.screen} d={toPath(art.screen)} />
        <rect data-part="eyeL" className={styles.eye} width={2} {...a.eyeL} />
        <rect data-part="eyeR" className={styles.eye} width={2} {...a.eyeR} />
        <path data-part="happy" className={styles.eye} d={toPath(art.happy)} {...a.happy} />
        <path data-part="cross" className={styles.cross} d={toPath(art.cross)} {...a.cross} />
        <path data-part="cheeks" className={styles.cheek} d={toPath(art.cheeks)} {...a.cheeks} />
        <g data-part="keyboard" {...a.keyboard}>
          <path className={styles.body} d={toPath(art.keyboardKeys)} />
          <path className={styles.shade} d={toPath(art.keyboardGaps)} />
          <path className={styles.ink} d={toPath(art.keyboardInk)} />
          <rect data-part="key" className={styles.accent} y={12} width={1} height={1} {...a.key} />
        </g>
      </g>

      {SPARKS.map(({ x, y, reach }, i) => {
        const spark = sparkArt(x, y);
        return <g key={i} className={styles.accent}>
          <path data-part={`spark${i}core`} d={toPath(spark.core)} {...a[`spark${i}core`]} />
          <path data-part={`spark${i}near`} d={toPath(spark.near)} {...a[`spark${i}near`]} />
          {reach === 2 && <path data-part={`spark${i}far`} d={toPath(spark.far)} {...a[`spark${i}far`]} />}
        </g>;
      })}
    </svg>
    {(announce ?? !looping) && <span className={styles.live} aria-live="polite">{text}</span>}
  </span>;
}

export default PixelMascot;
