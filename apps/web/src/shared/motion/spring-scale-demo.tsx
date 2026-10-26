"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function SpringScaleDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const bounce = Number(params.bounce ?? 0.45);
  const duration = Number(params.duration ?? 1.4);
  const active = isPlaying && !isPaused;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <motion.div
        animate={active ? { scale: [0.72, 1.12] } : { scale: 1 }}
        className="size-28 rounded-full bg-[var(--theme-accent)] shadow-[0_18px_45px_-18px_var(--theme-accent)]"
        initial={false}
        transition={{
          type: "spring",
          bounce,
          duration,
          repeat: active ? Infinity : 0,
          repeatType: "mirror",
        }}
      />
    </div>
  );
}
