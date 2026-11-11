"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { BadgeCheck, X } from "lucide-react";
import { sampleSocialProofEvents } from "./social-proof-toast-data";
import type { SocialProofEvent } from "./social-proof-toast-data";
import styles from "./social-proof-toast.module.css";

export type { SocialProofEvent } from "./social-proof-toast-data";
export { sampleSocialProofEvents } from "./social-proof-toast-data";

export type SocialProofPosition = "inline" | "bottom-left" | "bottom-right" | "top-left" | "top-right";

export interface SocialProofToastProps {
  /** The feed to cycle through, oldest first. Defaults to a sample SaaS feed. */
  events?: SocialProofEvent[];
  /** Milliseconds between toasts. Defaults to 4000. */
  interval?: number;
  /** Milliseconds before the first toast. Defaults to 800. */
  initialDelay?: number;
  /** How many toasts stack at once. Older ones leave from the back. Defaults to 3. */
  maxVisible?: number;
  /** How many toasts are already showing on mount, without an entrance. Defaults to 0. */
  prefill?: number;
  /** Inline sits in the layout; the corners pin the stack to the viewport. Defaults to inline. */
  position?: SocialProofPosition;
  /** Fans the stack out while it is hovered or focused. Defaults to true. */
  expandOnHover?: boolean;
  /** Starts the feed over when it ends. Defaults to true. */
  loop?: boolean;
  /** Stops after this many toasts in a session, so the page stays calm. */
  limit?: number;
  /** Pauses the cycle from outside, for example while a modal is open. */
  paused?: boolean;
  /** Called each time a toast appears. */
  onShow?: (event: SocialProofEvent) => void;
  /** Called when a visitor dismisses a toast. */
  onDismiss?: (event: SocialProofEvent) => void;
  /** Makes each toast a button, for example to open pricing or a customer story. */
  onSelect?: (event: SocialProofEvent) => void;
  /** Accessible name of the region. Defaults to "Recent activity". */
  label?: string;
  className?: string;
}

type Shown = { key: string; event: SocialProofEvent };

const HEIGHT = 64;
const GAP = 8;
const PEEK = 10;
const SCALE_STEP = .05;
const MIN_RESUME = 1200;
const spring = { type: "spring", visualDuration: .24, bounce: 0 } as const;
const exitEase = [.22, 1, .36, 1] as const;

function formatTime(time: SocialProofEvent["time"]) {
  if (time === undefined || typeof time === "string") return time;
  const seconds = Math.max(0, (Date.now() - (time instanceof Date ? time.getTime() : time)) / 1000);
  if (seconds < 45) return "Just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.round(hours / 24)} d ago`;
}

const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join("").slice(0, 2).toUpperCase();

/**
 * Social proof notifications for a landing or pricing page: small toasts in a corner ("Sofia started a Pro trial ·
 * 2 min ago") with a portrait or company mark and an optional verified badge. They stack, cycle on an interval,
 * pause and fan out on hover or focus, and can be dismissed. With no props it plays a sample SaaS feed.
 */
export function SocialProofToast({
  events = sampleSocialProofEvents, interval = 4000, initialDelay = 800, maxVisible = 3, prefill = 0, position = "inline",
  expandOnHover = true, loop = true, limit, paused = false, onShow, onDismiss, onSelect, label = "Recent activity", className,
}: SocialProofToastProps) {
  const reduced = useReducedMotion() ?? false;
  const depth = Math.max(1, Math.floor(maxVisible));
  const rootRef = useRef<HTMLElement>(null);
  const eventsRef = useRef(events);
  const onShowRef = useRef(onShow);
  useEffect(() => { eventsRef.current = events; onShowRef.current = onShow; });

  const seeded = Math.min(Math.max(0, Math.floor(prefill)), events.length, depth, limit ?? Infinity);
  const [shown, setShown] = useState<Shown[]>(() => events.slice(0, seeded).map((event, i) => ({ key: `${event.id}-p${i}`, event })).reverse());
  const cursorRef = useRef(seeded);
  const countRef = useRef(seeded);
  const seqRef = useRef(0);
  const [done, setDone] = useState(false);
  const [tick, setTick] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const [notice, setNotice] = useState("");

  const advance = useCallback(() => {
    const list = eventsRef.current;
    if (!list.length) return;
    if ((!loop && cursorRef.current >= list.length) || (limit !== undefined && countRef.current >= limit)) {
      setDone(true);
      return;
    }
    const event = list[cursorRef.current % list.length];
    cursorRef.current += 1;
    countRef.current += 1;
    const key = `${event.id}-${seqRef.current++}`;
    // Keep one extra toast so the oldest can fade out from the back of the stack.
    setShown(prev => [{ key, event }, ...prev].slice(0, depth + 1));
    onShowRef.current?.(event);
  }, [loop, limit, depth]);

  // Pause off screen and in background tabs.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const sync = () => setPageVisible(document.visibilityState !== "hidden");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);

  // The countdown keeps its remaining time across pauses, so hovering never skips or doubles a toast.
  const remainingRef = useRef(seeded > 0 ? interval : initialDelay);
  const hold = hovered || focused;
  const running = !done && !paused && !hold && inView && pageVisible && events.length > 0;
  useEffect(() => {
    if (!running) return;
    const started = performance.now();
    let fired = false;
    const id = window.setTimeout(() => {
      fired = true;
      remainingRef.current = interval;
      advance();
      setTick(t => t + 1);
    }, remainingRef.current);
    return () => {
      window.clearTimeout(id);
      if (!fired) remainingRef.current = Math.max(MIN_RESUME, remainingRef.current - (performance.now() - started));
    };
  }, [running, tick, interval, advance]);

  const dismiss = useCallback((key: string) => {
    const index = shown.findIndex(item => item.key === key);
    if (index < 0) return;
    const item = shown[index];
    const root = rootRef.current;
    const hadFocus = !!root?.querySelector(`[data-key="${CSS.escape(key)}"]`)?.contains(document.activeElement);
    setShown(prev => prev.filter(entry => entry.key !== key));
    setNotice(`Dismissed: ${item.event.name} ${item.event.action}`);
    onDismiss?.(item.event);
    if (hadFocus && root) {
      const next = shown.slice(0, depth).find(entry => entry.key !== key);
      const target = next ? root.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"] [data-dismiss]`) : null;
      (target ?? root).focus({ preventScroll: true });
    }
  }, [shown, depth, onDismiss]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Escape" || !shown.length) return;
    const focusedItem = (event.target as HTMLElement).closest<HTMLElement>("[data-key]")?.dataset.key;
    event.preventDefault();
    dismiss(focusedItem ?? shown[0].key);
  };
  const onPointerEnter = (event: PointerEvent<HTMLElement>) => { if (event.pointerType !== "touch") setHovered(true); };
  const onPointerLeave = () => setHovered(false);
  const onBlur = (event: FocusEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  const expanded = expandOnHover && hold && shown.length > 1;
  const top = position === "top-left" || position === "top-right";
  const dir = top ? 1 : -1;
  const rootStyle = { "--toast-h": `${HEIGHT}px`, "--toast-gap": `${GAP}px`, height: HEIGHT + PEEK * (depth - 1) } as CSSProperties;
  const moveTransition = reduced ? { duration: .16, y: { duration: 0 }, scale: { duration: 0 } } : { ...spring, opacity: { duration: .16, ease: exitEase } };

  return (
    <section
      ref={rootRef}
      aria-label={label}
      tabIndex={-1}
      className={[styles.root, className].filter(Boolean).join(" ")}
      data-position={position}
      data-anchor={top ? "top" : "bottom"}
      data-expanded={expanded || undefined}
      style={rootStyle}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
    >
      <ol className={styles.list}>
        <AnimatePresence initial={false}>
          {shown.map((item, i) => {
            const visible = i < depth;
            const y = expanded ? dir * i * (HEIGHT + GAP) : dir * i * PEEK;
            const scale = expanded ? 1 : 1 - Math.min(i, depth) * SCALE_STEP;
            return (
              <motion.li
                key={item.key}
                data-key={item.key}
                className={styles.item}
                data-front={i === 0 || undefined}
                data-dim={(!expanded && i > 0) || undefined}
                aria-hidden={!visible || undefined}
                inert={!visible}
                initial={{ opacity: 0, y: reduced ? 0 : -dir * 16, scale: 1 }}
                animate={{ opacity: visible ? 1 : 0, y, scale }}
                exit={{ opacity: 0, scale: reduced ? scale : scale - .04, transition: { duration: reduced ? .12 : .16, ease: exitEase } }}
                transition={moveTransition}
                style={{ zIndex: 100 - i, transformOrigin: top ? "50% 100%" : "50% 0%" }}
              >
                <ToastCard event={item.event} onDismiss={() => dismiss(item.key)} onSelect={onSelect} />
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>
      <span className={styles.srOnly} role="status" aria-live="polite">{notice}</span>
    </section>
  );
}

function ToastCard({ event, onDismiss, onSelect }: { event: SocialProofEvent; onDismiss: () => void; onSelect?: (event: SocialProofEvent) => void }) {
  const time = formatTime(event.time);
  const meta = [event.meta, time].filter(Boolean).join(" · ");
  const verified = event.verified ? (typeof event.verified === "string" ? event.verified : "Verified") : null;
  const sentence = `${event.name} ${event.action}`;
  return (
    <div className={styles.card} data-selectable={onSelect ? true : undefined}>
      <div className={styles.content}>
        <span className={styles.visual}>
          {event.avatar
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={event.avatar} alt="" width={36} height={36} draggable={false} />
            : event.logo ?? <span className={styles.initials}>{initials(event.name)}</span>}
        </span>
        <span className={styles.text}>
          <span className={styles.title}><span className={styles.name}>{event.name}</span> {event.action}</span>
          <span className={styles.meta}>
            {event.meta && <span className={styles.metaText}>{event.meta}</span>}
            {event.meta && time && <span className={styles.dot} aria-hidden>·</span>}
            {time && <span className={styles.time} suppressHydrationWarning>{time}</span>}
            {meta && verified && <span className={styles.dot} aria-hidden>·</span>}
            {verified && <span className={styles.verified}><BadgeCheck size={14} strokeWidth={1.75} aria-hidden />{verified}</span>}
          </span>
        </span>
      </div>
      {onSelect && <button type="button" className={styles.hit} aria-label={`${sentence}${meta ? `, ${meta}` : ""}`} onClick={() => onSelect(event)} />}
      <button type="button" className={styles.dismiss} data-dismiss aria-label={`Dismiss: ${sentence}`} onClick={onDismiss}>
        <X size={14} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

export default SocialProofToast;
