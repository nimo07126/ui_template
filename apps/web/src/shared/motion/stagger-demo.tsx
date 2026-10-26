"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function StaggerDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const stagger = Number(params.stagger ?? 0.12);
  const count = Number(params.count ?? 5);
  const active = isPlaying && !isPaused;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <div className="flex items-end gap-2">
        {Array.from({ length: count }, (_, index) => (
          <motion.span
            animate={
              active
                ? { height: [24, 72 + index * 10, 36, 24], opacity: [0.45, 1, 0.6, 0.45] }
                : { height: 24 + index * 7, opacity: 0.85 }
            }
            className="w-5 rounded-full bg-foreground/80"
            initial={false}
            key={index}
            transition={{
              delay: index * stagger,
              duration: 1.3,
              ease: "easeInOut",
              repeat: active ? Infinity : 0,
              repeatType: "loop",
            }}
          />
        ))}
      </div>
    </div>
  );
}
