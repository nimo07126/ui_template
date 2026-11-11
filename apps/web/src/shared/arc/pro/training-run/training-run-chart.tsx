"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode } from "react";
import { useMotionValue, useMotionValueEvent, useTransform, motion } from "motion/react";
import type { MotionValue } from "motion/react";
import type { LossPoint } from "./training-run-types";
import styles from "./training-run.module.css";

const PAD_L = 32;
const PAD_R = 6;
const PAD_T = 8;
const PAD_B = 6;
const HEIGHT = 156;
const EMA = .3;

type Series = { step: number; v: number }[];

/** Eases a number toward its target every frame, so a curve fed in bursts still draws at an even pace. Drops back instantly. */
export function useSmoothed(target: number, reduced: boolean, tau = 120): MotionValue<number> {
  const value = useMotionValue(target);
  const targetRef = useRef(target);
  const frame = useRef(0);
  const stop = () => { cancelAnimationFrame(frame.current); frame.current = 0; };
  useEffect(() => {
    targetRef.current = target;
    if (reduced || target < value.get() - .5) { stop(); value.jump(target); return; }
    if (frame.current) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      const goal = targetRef.current, current = value.get();
      const next = current + (goal - current) * (1 - Math.exp(-dt / tau));
      if (Math.abs(goal - next) < .05) { value.set(goal); frame.current = 0; return; }
      value.set(next);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, [target, reduced, tau, value]);
  // Strict mode and unmounts cancel the loop and clear the handle, so the next target starts a fresh one.
  useEffect(() => stop, []);
  return value;
}

/** Exponential moving average of the train loss, the way training dashboards smooth a noisy curve. */
export function smoothTrain(loss: LossPoint[]): Series {
  const out: Series = [];
  let ema: number | undefined;
  for (const p of loss) {
    if (p.train === undefined) continue;
    ema = ema === undefined ? p.train : EMA * p.train + (1 - EMA) * ema;
    out.push({ step: p.step, v: ema });
  }
  return out;
}

/** The value of a series at a step, interpolated between samples. */
export function valueAt(series: Series, step: number): number | undefined {
  if (!series.length || step < series[0].step) return undefined;
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1], b = series[i];
    if (b.step >= step) return a.v + (b.v - a.v) * ((step - a.step) / (b.step - a.step || 1));
  }
  return series.at(-1)!.v;
}

function niceMax(max: number) {
  const padded = max * 1.06;
  const unit = padded > 4 ? 1 : padded > 1.2 ? .5 : padded > .5 ? .25 : .1;
  return Math.max(unit, Math.ceil(padded / unit) * unit);
}
function tickStep(top: number) {
  for (const s of [.1, .25, .5, 1, 2, 5]) if (top / s <= 3.01) return s;
  return 10;
}

export interface LossChartProps {
  loss: LossPoint[];
  totalSteps: number;
  epochs: number;
  /** The step the curve is drawn up to, eased. */
  shown: MotionValue<number>;
  /** The step the epoch bar is filled to, eased. */
  progress: MotionValue<number>;
  tone: "live" | "quiet" | "danger" | "done";
  hover: number | null;
  onHover: (step: number | null) => void;
  overlay?: ReactNode;
  label: string;
}

/** Train (smoothed over raw) and validation loss on a fixed step axis, so the curve only ever grows rightward and never rescales mid-run. */
export function LossChart({ loss, totalSteps, epochs, shown, progress, tone, hover, onHover, overlay, label }: LossChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const rawRef = useRef<SVGPathElement>(null);
  const trainRef = useRef<SVGPathElement>(null);
  const valRef = useRef<SVGPathElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    setWidth(Math.round(node.getBoundingClientRect().width));
    const observer = new ResizeObserver(([entry]) => { if (entry) setWidth(Math.round(entry.contentRect.width)); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const raw = useMemo<Series>(() => loss.flatMap(p => p.train === undefined ? [] : [{ step: p.step, v: p.train }]), [loss]);
  const train = useMemo(() => smoothTrain(loss), [loss]);
  const val = useMemo<Series>(() => loss.flatMap(p => p.val === undefined ? [] : [{ step: p.step, v: p.val }]), [loss]);
  const peak = useMemo(() => loss.reduce((m, p) => Math.max(m, p.train ?? 0, p.val ?? 0), 0), [loss]);
  const top = peak > 0 ? niceMax(peak) : 2.5;
  const ticks = useMemo(() => { const s = tickStep(top), out: number[] = []; for (let v = 0; v <= top + 1e-9; v += s) out.push(+v.toFixed(2)); return out; }, [top]);

  const plotW = Math.max(1, width - PAD_L - PAD_R), plotH = HEIGHT - PAD_T - PAD_B;
  const x = useCallback((step: number) => PAD_L + (step / totalSteps) * plotW, [plotW, totalSteps]);
  const y = useCallback((v: number) => PAD_T + (1 - Math.min(v, top) / top) * plotH, [plotH, top]);

  const draw = useCallback((at: number) => {
    const path = (series: Series) => {
      let d = "", lx = 0, ly = 0;
      for (let i = 0; i < series.length; i++) {
        const p = series[i];
        if (p.step > at) {
          const a = series[i - 1];
          if (!a) break;
          const t = (at - a.step) / (p.step - a.step || 1);
          lx = x(at); ly = y(a.v + (p.v - a.v) * t);
          d += `L${lx.toFixed(1)} ${ly.toFixed(1)}`;
          break;
        }
        lx = x(p.step); ly = y(p.v);
        d += `${d ? "L" : "M"}${lx.toFixed(1)} ${ly.toFixed(1)}`;
      }
      return { d, lx, ly };
    };
    rawRef.current?.setAttribute("d", path(raw).d);
    valRef.current?.setAttribute("d", path(val).d);
    const head = path(train);
    trainRef.current?.setAttribute("d", head.d);
    if (headRef.current) {
      headRef.current.style.opacity = head.d ? "1" : "0";
      headRef.current.setAttribute("transform", `translate(${head.lx.toFixed(1)} 0)`);
      headRef.current.querySelector("circle")?.setAttribute("cy", head.ly.toFixed(1));
    }
  }, [raw, train, val, x, y]);

  useLayoutEffect(() => { if (width) draw(shown.get()); }, [draw, shown, width]);
  useMotionValueEvent(shown, "change", at => { if (width) draw(at); });

  // Inspect: pointer or arrow keys snap to the nearest train sample.
  const steps = useMemo(() => raw.map(p => p.step), [raw]);
  const nearest = (step: number) => {
    let best = steps[0], gap = Infinity;
    for (const s of steps) { const g = Math.abs(s - step); if (g < gap) { gap = g; best = s; } }
    return best;
  };
  const onPointer = (event: PointerEvent<HTMLDivElement>) => {
    if (!steps.length || !width) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const step = ((event.clientX - rect.left - PAD_L) / plotW) * totalSteps;
    onHover(nearest(Math.max(0, Math.min(steps.at(-1)!, step))));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!steps.length) return;
    const index = hover === null ? steps.length - 1 : steps.indexOf(nearest(hover));
    const jump = event.shiftKey ? 10 : 1;
    let next: number | null | undefined;
    if (event.key === "ArrowLeft") next = steps[Math.max(0, index - (hover === null ? 0 : jump))];
    else if (event.key === "ArrowRight") next = steps[Math.min(steps.length - 1, index + (hover === null ? 0 : jump))];
    else if (event.key === "Home") next = steps[0];
    else if (event.key === "End") next = steps.at(-1);
    else if (event.key === "Escape" && hover !== null) next = null;
    else return;
    event.preventDefault();
    onHover(next ?? null);
  };

  const hoverTrain = hover === null ? undefined : valueAt(train, hover);
  const hoverVal = hover === null ? undefined : valueAt(val, Math.min(hover, val.at(-1)?.step ?? -1));
  const bands = Array.from({ length: epochs }, (_, i) => i);
  const per = totalSteps / epochs;

  return <div className={styles.chart} data-tone={tone}>
    <div ref={wrapRef} className={styles.plot} style={{ height: HEIGHT }} tabIndex={loss.length ? 0 : -1} role="group" aria-label={label}
      onPointerMove={onPointer} onPointerDown={onPointer} onPointerLeave={() => onHover(null)} onKeyDown={onKeyDown} onBlur={() => onHover(null)}>
      {width ? <svg className={styles.svg} width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
        {ticks.map(t => <g key={t}>
          <line className={styles.grid} x1={PAD_L} x2={width - PAD_R} y1={y(t)} y2={y(t)} />
          <text className={styles.tick} x={PAD_L - 8} y={y(t)} dy=".34em" textAnchor="end">{t.toFixed(1)}</text>
        </g>)}
        {bands.slice(1).map(i => <line key={i} className={styles.boundary} x1={x(i * per)} x2={x(i * per)} y1={PAD_T} y2={HEIGHT - PAD_B} />)}
        <path ref={rawRef} className={styles.raw} />
        <path ref={valRef} className={styles.val} />
        <path ref={trainRef} className={styles.train} />
        <g ref={headRef} className={styles.head} style={{ opacity: 0 }}>
          <line x1={0} x2={0} y1={PAD_T} y2={HEIGHT - PAD_B} />
          <circle cx={0} cy={0} r={3.5} />
        </g>
        {hover !== null ? <g className={styles.cursor} transform={`translate(${x(hover).toFixed(1)} 0)`}>
          <line x1={0} x2={0} y1={PAD_T} y2={HEIGHT - PAD_B} />
          {hoverVal !== undefined ? <circle className={styles.cursorVal} cx={0} cy={y(hoverVal)} r={3} /> : null}
          {hoverTrain !== undefined ? <circle className={styles.cursorTrain} cx={0} cy={y(hoverTrain)} r={3} /> : null}
        </g> : null}
      </svg> : null}
      {overlay ? <div className={styles.overlay} style={{ left: PAD_L }}>{overlay}</div> : null}
    </div>
    <div className={styles.epochs} style={{ paddingLeft: PAD_L, paddingRight: PAD_R }} aria-hidden="true">
      {bands.map(i => <EpochSegment key={i} index={i} per={per} progress={progress} />)}
    </div>
  </div>;
}

function EpochSegment({ index, per, progress }: { index: number; per: number; progress: MotionValue<number> }) {
  const scaleX = useTransform(progress, p => Math.max(0, Math.min(1, (p - index * per) / per)));
  return <span className={styles.epoch}>
    <span className={styles.epochTrack}><motion.span className={styles.epochFill} style={{ scaleX }} /></span>
    <span className={styles.epochLabel}>Epoch {index + 1}</span>
  </span>;
}
