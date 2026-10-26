"use client";

import { motion } from "motion/react";
import type { MotionDemoProps } from "./types";

export function DragElasticDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const elasticity = Number(params.elasticity ?? 0.65);
  const distance = Number(params.distance ?? 42);
  const active = isPlaying && !isPaused;
  const offset = active ? distance : 0;

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <div className="relative flex h-28 w-72 items-center justify-center rounded-2xl bg-background/70">
        <span className="absolute inset-x-6 h-px bg-muted-foreground/20" />
        <motion.div
          animate={active ? { x: [offset, -offset, offset] } : { x: 0 }}
          className="relative z-10 size-16 cursor-grab rounded-full bg-foreground shadow-[0_16px_35px_-20px_var(--foreground)] active:cursor-grabbing"
          drag={isPlaying ? "x" : false}
          dragConstraints={{ left: -distance * 2, right: distance * 2 }}
          dragElastic={elasticity}
          initial={false}
          transition={{
            duration: 1.8,
            ease: "easeInOut",
            repeat: active ? Infinity : 0,
            repeatType: "mirror",
          }}
        />
      </div>
    </div>
  );
}
