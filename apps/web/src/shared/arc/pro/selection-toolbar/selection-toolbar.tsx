"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { TargetAndTransition, Variants } from "motion/react";
import { X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./selection-toolbar.module.css";

export type SelectionAction = { label: string; icon?: ReactNode; onClick: () => void; destructive?: boolean };

const instant = { duration: motionTokens.duration.instant } as const;
/** Digits roll in the direction of the change: a larger count rises from below, a smaller one drops from above. */
const digit: Variants = {
  enter: (dir: number) => ({ opacity: 0, y: dir > 0 ? "0.6em" : "-0.6em", filter: `blur(${motionTokens.blur.subtle}px)` }),
  rest: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: (dir: number) => ({ opacity: 0, y: dir > 0 ? "-0.6em" : "0.6em", filter: `blur(${motionTokens.blur.subtle}px)`, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } }),
};
const fade: Variants = { enter: { opacity: 0 }, rest: { opacity: 1 }, exit: { opacity: 0, transition: instant } };
const pluralIn: TargetAndTransition = { opacity: 0, filter: `blur(${motionTokens.blur.subtle}px)` };
const pluralOut: TargetAndTransition = { ...pluralIn, transition: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.standard] } };
const textIn = { duration: motionTokens.duration.standard, ease: [...motionTokens.ease.enter] } as const;

/** Springs the count's width to its content when the count changes, so the bar grows and shrinks instead of snapping its actions sideways.
 *  Other resizes (a late web font) jump straight to the new width. */
function useMorphWidth(content: RefObject<HTMLElement | null>, key: number, reduced: boolean) {
  const width = useMotionValue<number | "auto">("auto");
  const lastKey = useRef(key), armedUntil = useRef(0);
  useLayoutEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    armedUntil.current = performance.now() + 700;
  }, [key]);
  useEffect(() => {
    const node = content.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let measured = false;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (!next || !measured || reduced || performance.now() > armedUntil.current) { measured = next > 0; width.jump(next || "auto"); return; }
      animate(width, next, motionTokens.spring.morph);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [content, reduced, width]);
  return width;
}

/** "3 projects selected": the number rolls, the plural s fades in place, and the words after it glide instead of jumping. */
function SelectionCount({ count, noun, reduced }: { count: number; noun: string; reduced: boolean }) {
  const [prev, setPrev] = useState({ count, dir: 1 });
  if (prev.count !== count) setPrev({ count, dir: count > prev.count ? 1 : -1 });
  const rowRef = useRef<HTMLSpanElement>(null);
  const width = useMorphWidth(rowRef, count, reduced);
  const glide = reduced ? false : "position";
  return <motion.span className={styles.countSlot} style={{ width }} aria-hidden="true">
    <span ref={rowRef} className={styles.countRow}>
      <span className={styles.countNumber}>
        <AnimatePresence mode="popLayout" initial={false} custom={prev.dir}>
          <motion.span key={count} className={styles.digits} custom={prev.dir} variants={reduced ? fade : digit} initial="enter" animate="rest" exit="exit" transition={reduced ? instant : { ...motionTokens.spring.snappy, opacity: textIn, filter: textIn }}>{count}</motion.span>
        </AnimatePresence>
      </span>
      <motion.span className={styles.words} layout={glide} layoutDependency={count} transition={motionTokens.spring.morph}>
        {` ${noun}`}
        <AnimatePresence mode="popLayout" initial={false}>
          {count !== 1 && <motion.span key="plural" className={styles.plural} initial={reduced ? { opacity: 0 } : pluralIn} animate={{ opacity: 1, filter: "blur(0px)" }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : pluralOut} transition={reduced ? instant : textIn}>s</motion.span>}
        </AnimatePresence>
        <motion.span className={styles.selected} layout={glide} layoutDependency={count} transition={motionTokens.spring.morph}>{" selected"}</motion.span>
      </motion.span>
    </span>
  </motion.span>;
}

export function SelectionToolbar({ count, actions, onClear, noun = "item" }: { count: number; actions: SelectionAction[]; onClear: () => void; noun?: string }) {
  const reduced = useReducedMotion() ?? false;
  // The bar rises from where it rests and sinks back, faster, when the selection clears.
  return <AnimatePresence initial={false}>
    {count > 0 && <motion.div key="selection-toolbar" className={styles.bar} role="toolbar" aria-label="Selection actions"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 10, scale: .97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={reduced ? { opacity: 0, transition: instant } : { opacity: 0, y: 6, scale: .98, transition: { duration: motionTokens.duration.exit, ease: [...motionTokens.ease.standard] } }}
      transition={reduced ? instant : { ...motionTokens.spring.smooth, opacity: { duration: motionTokens.duration.fast, ease: [...motionTokens.ease.enter] } }}>
      <span className={styles.count}>
        <SelectionCount count={count} noun={noun} reduced={reduced} />
        <span className={styles.srOnly} aria-live="polite">{`${count} ${noun}${count === 1 ? "" : "s"} selected`}</span>
      </span>
      {actions.length > 0 && <><span className={styles.divider} aria-hidden="true" /><div className={styles.actions}>{actions.map(action => <button type="button" key={action.label} className={action.destructive ? styles.destructive : ""} onClick={action.onClick}>{action.icon && <span className={styles.actionIcon} aria-hidden="true">{action.icon}</span>}{action.label}</button>)}</div></>}
      <button type="button" className={styles.clear} aria-label="Clear selection" onClick={onClear}><X size={15} aria-hidden="true" /></button>
    </motion.div>}
  </AnimatePresence>;
}
