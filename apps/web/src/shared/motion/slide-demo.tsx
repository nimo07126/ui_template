"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function SlideDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const distance = Number(params.distance ?? 72);
  const direction = String(params.direction ?? "right");
  const active = isPlaying && !isPaused;
  const axis = direction === "up" || direction === "down" ? "y" : "x";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  const offset = sign * distance;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <motion.div
        animate={
          active
            ? { [axis]: [offset, 0, 0, offset], opacity: [0.2, 1, 1, 0.2] }
            : { [axis]: 0, opacity: 1 }
        }
        className="flex h-20 w-52 items-center gap-3 rounded-2xl bg-background px-4 shadow-[0_18px_45px_-28px_var(--foreground)]"
        initial={false}
        transition={{
          duration: 1.8,
          ease: [0.22, 1, 0.36, 1],
          repeat: active ? Infinity : 0,
          repeatType: "loop",
        }}
      >
        <span className="size-10 rounded-xl bg-[var(--theme-accent-soft)]" />
        <span className="grid gap-2">
          <span className="h-2 w-24 rounded-full bg-foreground/75" />
          <span className="h-2 w-16 rounded-full bg-muted-foreground/30" />
        </span>
      </motion.div>
    </div>
  );
}
