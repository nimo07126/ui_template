"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function FadeScaleDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const duration = Number(params.duration ?? 1.2);
  const distance = Number(params.distance ?? 18);
  const active = isPlaying && !isPaused;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <motion.div
        animate={
          active
            ? { opacity: [0.18, 1, 1, 0.18], y: [distance, 0, 0, distance] }
            : { opacity: 1, y: 0 }
        }
        className="grid size-24 place-items-center rounded-[2rem] bg-foreground text-background shadow-[0_20px_50px_-24px_var(--foreground)]"
        initial={false}
        transition={{
          duration,
          ease: "easeInOut",
          repeat: active ? Infinity : 0,
          repeatType: "loop",
        }}
      >
        <span className="text-2xl font-semibold">Aa</span>
      </motion.div>
    </div>
  );
}
