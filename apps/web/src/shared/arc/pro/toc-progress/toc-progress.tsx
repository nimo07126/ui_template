"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, RefObject } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "motion/react";
import type { Transition } from "motion/react";
import { Check } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./toc-progress.module.css";

/** One heading in the article. */
export interface TocProgressItem {
  /** Id of the heading element in the article. */
  id: string;
  label: string;
  /** Nesting depth, 1 for sections and 2 or 3 for their subsections. Defaults to 1. */
  level?: 1 | 2 | 3;
}

/**
 * A table of contents that reads along with you. A line runs down the headings and bends through their indentation;
 * the part you have read fills in as you scroll, and a marker rides its tip, lighting each heading as it arrives. Clicking a
 * heading scrolls there smoothly while the line traces the way. The time left counts down as you read.
 */
export interface TocProgressProps {
  /** Headings in document order. */
  items: TocProgressItem[];
  /** The element that scrolls the article. Defaults to the nearest scrolling ancestor of the first heading, or the page. */
  scrollContainer?: RefObject<HTMLElement | null> | HTMLElement | null;
  /** Distance in px from the top of the scroll viewport at which a heading counts as reached, for example the height of a sticky header. */
  offset?: number;
  /** The current heading, controlled. By default it follows the scroll position. */
  activeId?: string;
  /** Called when the current heading changes while reading or navigating. */
  onActiveChange?: (id: string) => void;
  /** Called when a heading in the list is chosen, before the article scrolls. */
  onNavigate?: (id: string) => void;
  /** Reading time of the whole article in minutes. Defaults to an estimate from the words in the scroll container. */
  readingTime?: number;
  /** Heading above the list, also the accessible name of the navigation. Pass an empty string to hide it. */
  title?: string;
  /** Shows the time left beside the title. */
  showTimeLeft?: boolean;
  /** Accessible name of the navigation. Defaults to the title. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

/** Horizontal position of the line for each level, in px from the left edge of the list. Keep in step with the label indent in CSS. */
const LANE = { 1: 5, 2: 17, 3: 29 } as const;
/** Half the height of a bend between levels. */
const BEND = 7;
const WORDS_PER_MINUTE = 230;
/** The marker settles onto the scroll position without overshooting, so it never points past the heading you are on. */
const FOLLOW: Transition = { type: "spring", visualDuration: .28, bounce: 0 };

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

type Pt = { x: number; y: number };
type Geometry = { d: string; points: Pt[]; cumulative: number[]; anchors: number[]; total: number; height: number };

/** The line as a dense polyline, so the drawn path, its length and the marker position all come from the same points. */
function buildGeometry(rows: { top: number; height: number; lane: number }[]): Geometry | null {
  if (!rows.length) return null;
  const points: Pt[] = [];
  const anchorsY: number[] = [];
  const push = (x: number, y: number) => {
    const last = points[points.length - 1];
    if (!last || last.x !== x || last.y !== y) points.push({ x, y });
  };
  rows.forEach((row, index) => {
    const center = row.top + row.height / 2;
    if (index === 0) push(row.lane, center);
    anchorsY.push(center);
    const next = rows[index + 1];
    if (!next) { push(row.lane, row.top + row.height - 4); return; }
    const nextCenter = next.top + next.height / 2;
    if (next.lane === row.lane) { push(row.lane, nextCenter); return; }
    const boundary = (row.top + row.height + next.top) / 2;
    const bend = Math.min(BEND, (nextCenter - center) / 2 - 1);
    push(row.lane, boundary - bend);
    // A smooth S between the two lanes: a cubic with vertical tangents at both ends.
    for (let step = 1; step <= 14; step++) {
      const t = step / 14, u = 1 - t;
      const x = u * u * u * row.lane + 3 * u * u * t * row.lane + 3 * u * t * t * next.lane + t * t * t * next.lane;
      const y = u * u * u * (boundary - bend) + 3 * u * u * t * boundary + 3 * u * t * t * boundary + t * t * t * (boundary + bend);
      push(x, y);
    }
    push(next.lane, nextCenter);
  });
  const cumulative = [0];
  for (let index = 1; index < points.length; index++) {
    const a = points[index - 1], b = points[index];
    cumulative.push(cumulative[index - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  const total = cumulative[cumulative.length - 1];
  // Length along the line at each heading's center; the last section runs to the end of the line.
  const anchors = anchorsY.map(y => {
    const index = points.findIndex(point => Math.abs(point.y - y) < .01);
    return index >= 0 ? cumulative[index] : 0;
  });
  anchors.push(total);
  const d = points.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join("");
  const last = rows[rows.length - 1];
  return { d, points, cumulative, anchors, total, height: last.top + last.height };
}

function pointAt(geometry: Geometry, length: number): Pt {
  const { points, cumulative } = geometry;
  if (length <= 0) return points[0];
  let low = 0, high = cumulative.length - 1;
  while (low < high) { const mid = (low + high) >> 1; if (cumulative[mid] < length) low = mid + 1; else high = mid; }
  const index = Math.max(1, low);
  const a = points[index - 1], b = points[index];
  const span = cumulative[index] - cumulative[index - 1] || 1;
  const t = Math.min(1, Math.max(0, (length - cumulative[index - 1]) / span));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Length along the line for a reading position: each section fills the stretch from its heading to the next. */
function lengthFor(g: Geometry | null, value: number) {
  if (!g) return 0;
  const index = Math.min(Math.floor(value), g.anchors.length - 2);
  if (index < 0) return 0;
  const t = Math.min(1, value - index);
  return g.anchors[index] + (g.anchors[index + 1] - g.anchors[index]) * t;
}

function scrollParent(node: HTMLElement | null): HTMLElement | null {
  for (let element = node?.parentElement ?? null; element; element = element.parentElement) {
    const overflow = getComputedStyle(element).overflowY;
    if ((overflow === "auto" || overflow === "scroll" || overflow === "overlay") && element.scrollHeight > element.clientHeight) return element;
  }
  return null;
}

function resolve(container: TocProgressProps["scrollContainer"]) {
  if (!container) return null;
  return "current" in container ? container.current : container;
}

export function TocProgress({
  items, scrollContainer, offset = 96, activeId, onActiveChange, onNavigate, readingTime, title = "On this page", showTimeLeft = true,
  label, className, style,
}: TocProgressProps) {
  const reduced = useReducedFlag();
  const titleId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const rowRefs = useRef<(HTMLLIElement | null)[]>([]);
  const markerRef = useRef<SVGGElement>(null);
  const knockoutRef = useRef<SVGCircleElement>(null);
  const maskId = `toc-knockout-${useId().replace(/[^\w-]/g, "")}`;
  const tops = useRef<number[]>([]);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const [geometry, setGeometry] = useState<Geometry | null>(null);
  const [scrolledIndex, setScrolledIndex] = useState(0);
  const [minutes, setMinutes] = useState<number | null>(readingTime ?? null);
  const [fraction, setFraction] = useState(0);
  const pinned = useRef<number | null>(null);
  const updateRef = useRef<() => void>(() => {});

  /** Reading position: section index plus how far through it you are, from 0 to the number of headings. */
  const position = useMotionValue(0);
  const geometryRef = useRef<Geometry | null>(null);
  const length = useTransform(position, value => lengthFor(geometryRef.current, value));
  const dash = useTransform(length, value => `${value.toFixed(2)} 100000`);
  const fill = useTransform(position, value => value > .001 ? 1 : 0);

  const count = items.length;
  const levels = useMemo(() => items.map(item => item.level ?? 1), [items]);
  const current = activeId !== undefined ? Math.max(0, items.findIndex(item => item.id === activeId)) : scrolledIndex;

  /* Measure the list rows and build the line through them. */
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const rows = rowRefs.current.slice(0, count).map((row, index) => ({ top: row?.offsetTop ?? 0, height: row?.offsetHeight ?? 0, lane: LANE[levels[index]] }));
      const next = buildGeometry(rows);
      geometryRef.current = next;
      setGeometry(next);
      position.set(position.get());
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [count, levels, position]);

  /* Follow the scroll position of the article. */
  useEffect(() => {
    const first = items[0] ? document.getElementById(items[0].id) : null;
    const element = resolve(scrollContainer) ?? scrollParent(first);
    scrollerRef.current = element;
    const viewport = () => element
      ? { top: element.scrollTop, height: element.clientHeight, max: element.scrollHeight - element.clientHeight, end: element.scrollHeight }
      : { top: window.scrollY, height: window.innerHeight, max: document.documentElement.scrollHeight - window.innerHeight, end: document.documentElement.scrollHeight };

    const measure = () => {
      const base = element ? element.getBoundingClientRect().top - element.scrollTop + element.clientTop : -window.scrollY;
      let previous = 0;
      tops.current = items.map(item => {
        const heading = document.getElementById(item.id);
        previous = heading ? heading.getBoundingClientRect().top - base : previous;
        return previous;
      });
      if (readingTime === undefined) {
        const words = ((element ?? document.body).textContent ?? "").trim().split(/\s+/).length;
        setMinutes(Math.max(1, Math.round(words / WORDS_PER_MINUTE)));
      }
      update(true);
    };

    const update = (immediate = false) => {
      const { top, height, max, end } = viewport();
      const edges = tops.current;
      if (!edges.length) return;
      // Near the end the reading line slides from the offset down to the bottom edge, so the last short sections still get reached.
      const remaining = Math.max(0, max - top);
      const reach = Math.max(0, height - offset);
      const ramp = reach > 0 && remaining < reach ? 1 - remaining / reach : 0;
      const line = top + offset + reach * ramp * ramp;
      let value = 0;
      if (line >= edges[0]) {
        let index = edges.length - 1;
        while (index > 0 && edges[index] > line) index--;
        const from = edges[index], to = index + 1 < edges.length ? edges[index + 1] : end;
        value = Math.min(edges.length, index + Math.min(1, Math.max(0, (line - from) / Math.max(1, to - from))));
      }
      // A chosen heading near the end may be out of reach of the scroll; it stays current until the reader scrolls on.
      const pin = pinned.current;
      if (pin !== null && value > pin + 1) value = pin;
      if (immediate || reduced) { position.stop(); position.set(value); }
      else animate(position, value, FOLLOW);
    };

    const onScroll = () => update();
    const unpin = () => { if (pinned.current !== null) { pinned.current = null; update(); } };
    const scrollTarget: HTMLElement | Window = element ?? window;
    scrollTarget.addEventListener("scroll", onScroll, { passive: true });
    const inputs = ["wheel", "touchstart", "pointerdown", "keydown"] as const;
    for (const type of inputs) scrollTarget.addEventListener(type, unpin, { passive: true });
    updateRef.current = update;
    window.addEventListener("resize", measure);
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(measure);
      const content = element?.firstElementChild ?? document.body;
      observer.observe(content);
      if (element) observer.observe(element);
    }
    measure();
    return () => {
      scrollTarget.removeEventListener("scroll", onScroll);
      for (const type of inputs) scrollTarget.removeEventListener(type, unpin);
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, [items, scrollContainer, offset, readingTime, reduced, position]);

  /* The marker rides the tip of the line, and a heading lights up when the marker reaches it. */
  const onActive = useRef(onActiveChange);
  const lastIndex = useRef(0);
  useLayoutEffect(() => { onActive.current = onActiveChange; });
  const placeMarker = useCallback((value: number) => {
    const g = geometryRef.current, marker = markerRef.current;
    if (!g || !marker) return;
    const point = pointAt(g, lengthFor(g, value));
    const transform = `translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`;
    marker.setAttribute("transform", transform);
    knockoutRef.current?.setAttribute("transform", transform);
  }, []);
  const place = useCallback((value: number) => {
    placeMarker(value);
    const index = Math.min(count - 1, Math.max(0, Math.floor(value + .002)));
    if (lastIndex.current !== index) {
      lastIndex.current = index;
      setScrolledIndex(index);
      onActive.current?.(items[index]?.id ?? "");
    }
    setFraction(count ? Math.min(1, value / count) : 0);
  }, [count, items, placeMarker]);
  useMotionValueEvent(position, "change", place);
  useLayoutEffect(() => { placeMarker(position.get()); }, [geometry, placeMarker, position]);

  const go = (event: ReactMouseEvent, item: TocProgressItem, index: number) => {
    event.preventDefault();
    onNavigate?.(item.id);
    const heading = document.getElementById(item.id);
    if (!heading) return;
    const element = scrollerRef.current;
    pinned.current = index;
    const top = (tops.current[index] ?? 0) - offset + 1;
    const behavior: ScrollBehavior = reduced ? "auto" : "smooth";
    if (element) element.scrollTo({ top, behavior }); else window.scrollTo({ top, behavior });
    updateRef.current();
    // Reading continues at the heading: focus it without a second scroll jump.
    if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLOListElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const links = Array.from(listRef.current?.querySelectorAll<HTMLAnchorElement>("a") ?? []);
    const index = links.indexOf(document.activeElement as HTMLAnchorElement);
    if (index < 0) return;
    event.preventDefault();
    const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1 : index + (event.key === "ArrowDown" ? 1 : -1);
    links[Math.min(links.length - 1, Math.max(0, next))]?.focus();
  };

  const left = minutes === null ? null : fraction >= .999 ? 0 : Math.max(1, Math.ceil(minutes * (1 - fraction)));
  const status = left === null ? "" : left === 0 ? "Finished" : `${left} min left`;

  return <nav className={[styles.root, className].filter(Boolean).join(" ")} style={style} aria-label={title ? undefined : label ?? "On this page"} aria-labelledby={title ? titleId : undefined}>
    {title || showTimeLeft ? <div className={styles.head}>
      {title ? <p id={titleId} className={styles.title}>{title}</p> : null}
      {showTimeLeft && left !== null ? <span className={styles.time} data-done={left === 0 || undefined}>
        <AnimatePresence initial={false}>
          <motion.span key={status} className={styles.timeText}
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 7, filter: `blur(${motionTokens.blur.subtle}px)` }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: -7, filter: `blur(${motionTokens.blur.subtle}px)` }}
            transition={reduced ? { duration: .12 } : motionTokens.spring.snappy}>
            {left === 0 ? <Check aria-hidden="true" /> : null}{status}
          </motion.span>
        </AnimatePresence>
      </span> : null}
    </div> : null}
    <div className={styles.body}>
      {geometry ? <svg className={styles.line} width={40} height={geometry.height} viewBox={`0 0 40 ${geometry.height}`} aria-hidden="true">
        {/* The line breaks around the marker through a mask, so the gap shows whatever surface the list sits on. */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-8} y={-8} width={56} height={geometry.height + 16}>
          <rect x={-8} y={-8} width={56} height={geometry.height + 16} fill="#fff" />
          <circle ref={knockoutRef} r={5.5} fill="#000" />
        </mask>
        <g mask={`url(#${maskId})`}>
          <path className={styles.track} d={geometry.d} />
          <motion.path className={styles.progress} d={geometry.d} style={{ strokeDasharray: dash, opacity: fill }} />
        </g>
        <g ref={markerRef} className={styles.marker}>
          <circle r={3.5} className={styles.markerDot} />
        </g>
      </svg> : null}
      <ol ref={listRef} className={styles.list} onKeyDown={onKeyDown}>
        {items.map((item, index) => <li key={item.id} ref={node => { rowRefs.current[index] = node; }} className={styles.row} data-level={levels[index]}
          data-state={index < current ? "read" : index === current ? "current" : "ahead"}>
          <a href={`#${item.id}`} className={styles.link} aria-current={index === current ? "location" : undefined} onClick={event => go(event, item, index)}>
            {item.label}
          </a>
        </li>)}
      </ol>
    </div>
  </nav>;
}

export default TocProgress;
