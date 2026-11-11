import { advance, poseAttrs, STEP, stillPose, targetPose, type Attrs, type PixelMascotStatus, type Pose } from "./pixel-mascot-sprite";

export interface MascotEngine {
  setStatus(status: PixelMascotStatus): void;
  /** Visible on screen and not paused. */
  setRunning(running: boolean): void;
  /** Reduced motion: hold the resting pose for each status, no loops. */
  setStill(still: boolean): void;
  destroy(): void;
}

/**
 * Drives one mascot's SVG without React renders. A requestAnimationFrame loop advances the sprite on a fixed 40ms
 * clock and writes only the attributes that changed (transforms, visibility, x and y), so it never touches layout.
 */
export function createMascotEngine(svg: SVGSVGElement, initial: PixelMascotStatus): MascotEngine {
  const parts = new Map<string, Element>([["root", svg]]);
  svg.querySelectorAll("[data-part]").forEach(node => parts.set(node.getAttribute("data-part") ?? "", node));

  let status = initial;
  // A mascot that mounts mid status starts settled: no jump or shake replays on mount.
  let enteredAt = performance.now() - 10_000;
  let pose: Pose = stillPose(initial);
  let written: Record<string, Attrs> = {};
  let running = false, still = false, raf = 0, clock = 0;

  const write = () => {
    const next = poseAttrs(pose);
    for (const part in next) {
      const node = parts.get(part);
      if (!node) continue;
      const before = written[part], attrs = next[part];
      for (const name in attrs) if (before?.[name] !== attrs[name]) node.setAttribute(name, attrs[name]);
    }
    written = next;
  };
  // Write everything once, so the DOM matches this engine's pose even if a previous engine touched it.
  write();

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    // After a dropped stretch (tab switch, long task), take one step instead of fast forwarding.
    if (now - clock > STEP * 5) clock = now - STEP;
    if (now - clock < STEP) return;
    while (now - clock >= STEP) {
      clock += STEP;
      pose = advance(pose, targetPose(status, Math.max(0, clock - enteredAt), false));
    }
    write();
  };

  const sync = () => {
    const active = running && !still;
    if (active && !raf) { clock = performance.now() - STEP; raf = requestAnimationFrame(tick); }
    if (!active && raf) { cancelAnimationFrame(raf); raf = 0; }
  };

  return {
    setStatus(next) {
      if (next === status) return;
      status = next;
      if (raf) {
        // Start the new status on the next sprite step, so its timeline lands exactly on the clock.
        enteredAt = clock + STEP;
      } else {
        enteredAt = performance.now();
        pose = stillPose(next);
        write();
      }
    },
    setRunning(next) { running = next; sync(); },
    setStill(next) {
      still = next;
      if (still) { pose = stillPose(status); write(); }
      sync();
    },
    destroy() { if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
}
