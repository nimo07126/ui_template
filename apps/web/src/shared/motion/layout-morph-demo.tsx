"use client";

import { LayoutGroup, motion } from "motion/react";
import { useEffect, useState } from "react";
import type { MotionDemoProps } from "./types";

export function LayoutMorphDemo({ isPlaying, isPaused, params }: MotionDemoProps) {
  const [expanded, setExpanded] = useState(false);
  const radius = Number(params.radius ?? 24);
  const active = isPlaying && !isPaused;

  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => setExpanded((value) => !value), 1400);
    return () => window.clearInterval(interval);
  }, [active]);

  return (
    <div className="grid min-h-60 w-full place-items-center overflow-hidden rounded-3xl bg-[var(--theme-background-secondary)]">
      <LayoutGroup>
        <motion.button
          animate={{ width: active && expanded ? 232 : 136, height: active && expanded ? 112 : 72 }}
          className="relative overflow-hidden bg-foreground text-left text-background"
          initial={false}
          disabled={!active}
          onClick={() => setExpanded((value) => !value)}
          style={{ borderRadius: radius }}
          transition={{ type: "spring", stiffness: 160, damping: 20 }}
          type="button"
        >
          <motion.span layout className="absolute left-4 top-4 text-xs font-medium">
            Layout
          </motion.span>
          {active && expanded && (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-4 left-4 text-2xl font-semibold"
              initial={{ opacity: 0, y: 8 }}
            >
              morph
            </motion.span>
          )}
        </motion.button>
      </LayoutGroup>
    </div>
  );
}
