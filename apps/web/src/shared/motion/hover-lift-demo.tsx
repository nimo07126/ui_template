"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function HoverLiftDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const lift = Number(params.lift ?? 12);
  const scale = Number(params.scale ?? 1.04);
  const hovered = isPlaying && !isPaused;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <motion.div
        animate={hovered ? { y: -lift, scale } : { y: 0, scale: 1 }}
        className="grid h-28 w-52 place-items-center rounded-2xl bg-background shadow-[0_18px_45px_-28px_var(--foreground)]"
        initial={false}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        whileHover={isPlaying ? { y: -lift, scale } : undefined}
      >
        <span className="text-sm font-medium">Hover / tap</span>
      </motion.div>
    </div>
  );
}
