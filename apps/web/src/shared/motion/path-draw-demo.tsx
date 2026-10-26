"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function PathDrawDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const duration = Number(params.duration ?? 1.8);
  const active = isPlaying && !isPaused;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <svg aria-label="路径绘制预览" className="size-44" fill="none" viewBox="0 0 160 160">
        <motion.path
          animate={active ? { pathLength: [0, 1, 1, 0] } : { pathLength: 1 }}
          className="stroke-foreground"
          d="M80 18 99 58l43 6-31 31 8 44-39-21-39 21 8-44-31-31 43-6 19-40Z"
          initial={false}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="6"
          transition={{
            duration,
            ease: "easeInOut",
            repeat: active ? Infinity : 0,
            repeatType: "loop",
          }}
        />
      </svg>
    </div>
  );
}
