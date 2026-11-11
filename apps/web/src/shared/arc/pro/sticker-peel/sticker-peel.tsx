"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import { motionTokens } from "../../lib/motion-tokens";
import styles from "./sticker-peel.module.css";

export interface StickerPlacement {
  /** Center of the sticker across the board, from 0 to 1. */
  x: number;
  /** Center of the sticker down the board, from 0 to 1. */
  y: number;
  /** Rotation in degrees. */
  rotate: number;
}

export interface StickerPeelItem {
  id: string;
  /** Accessible name, such as "Arc logo sticker". */
  label: string;
  /** The printed face. It sits inside a die cut white border. */
  content: ReactNode;
  /** Starting center across the board, from 0 to 1. */
  x: number;
  /** Starting center down the board, from 0 to 1. */
  y: number;
  /** Starting rotation in degrees. */
  rotate?: number;
  /** Outline of the die cut. Defaults to "rounded". */
  shape?: "circle" | "rounded" | "pill";
}

/**
 * A surface of stickers you can peel. Hovering lifts the nearest corner a few pixels; pressing and pulling folds the
 * sticker back over itself along a real fold, showing its paper backing. Pull far enough and it comes off, rises a touch,
 * and follows the hand; let go and it settles back onto the surface. Released early, it smooths itself flat.
 * Use it for profile pages, launch pages, and anywhere people collect or arrange badges.
 */
export interface StickerPeelProps {
  stickers: StickerPeelItem[];
  /** Controlled placements by sticker id. */
  positions?: Record<string, StickerPlacement>;
  /** Called once a sticker is stuck down somewhere new, with every placement. */
  onPositionsChange?: (positions: Record<string, StickerPlacement>) => void;
  /** Accessible name of the surface. Defaults to "Stickers". */
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

type Point = [number, number];
/** Where the peel starts and the direction that points into the sticker from there. */
type Anchor = { point: Point; dir: Point; corner: number };

/** Every spring is critically damped: the paper trails the finger a touch and settles without overshoot. */
const PAPER = { stiffness: 420, damping: 36, mass: .7 };
/** A carried sticker glides into the hand the moment it comes free. */
const FOLLOW = { stiffness: 380, damping: 40, mass: .9 };
const TURN = { stiffness: 300, damping: 36 };
/** Lifting off and settling back use the shared standard curve: up on the standard duration, down a touch quicker. */
const LIFT = { duration: motionTokens.duration.standard, ease: motionTokens.ease.standard };
const SETTLE = { duration: motionTokens.duration.exit, ease: motionTokens.ease.standard };
/** The pull may lean this far from straight into the sticker, so a sideways drag never folds half of it over. */
const MAX_LEAN = 35 * Math.PI / 180;
/** Fast pulls come off sooner, the way a quick tug releases a sticker. */
const FLICK_SPEED = 1100;

const subscribe = () => () => {};
function useReducedFlag() {
  const hydrated = useSyncExternalStore(subscribe, () => true, () => false);
  return !!useReducedMotion() && hydrated;
}

/** Keeps the part of a polygon where side(point) is zero or more. */
function clip(polygon: Point[], side: (point: Point) => number): Point[] {
  const out: Point[] = [];
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length];
    const sa = side(a), sb = side(b);
    if (sa >= 0) out.push(a);
    if ((sa >= 0) !== (sb >= 0)) {
      const t = sa / (sa - sb);
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}
const polygonCss = (polygon: Point[]) => `polygon(${polygon.map(([x, y]) => `${x.toFixed(2)}px ${y.toFixed(2)}px`).join(", ")})`;

/** Signed distance to a rounded box centered at the origin. */
function roundedBox(x: number, y: number, halfW: number, halfH: number, radius: number) {
  const qx = Math.abs(x) - halfW + radius, qy = Math.abs(y) - halfH + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

function cornerRadius(shape: NonNullable<StickerPeelItem["shape"]>, w: number, h: number) {
  return shape === "rounded" ? Math.min(18, w / 2, h / 2) : Math.min(w, h) / 2;
}

/** How far along `dir` from `from` the visible die cut begins. Corners of rounded shapes sit outside the outline. */
function insetAlong(from: Point, dir: Point, w: number, h: number, radius: number) {
  const inside = (t: number) => roundedBox(from[0] + dir[0] * t - w / 2, from[1] + dir[1] * t - h / 2, w / 2, h / 2, radius) <= 0;
  if (inside(0)) return 0;
  // March to the first point inside (a long thin shape can be entered and left again), then refine.
  const limit = Math.min(w, h), step = 1;
  let t = step;
  while (t <= limit && !inside(t)) t += step;
  if (t > limit) return 0;
  let lo = t - step, hi = t;
  for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (inside(mid)) hi = mid; else lo = mid; }
  return hi;
}

/**
 * Circles peel from the point of the rim nearest the pointer. Rounded shapes and pills peel from a corner, always along
 * its diagonal, because that is how a real sticker lets go and it keeps the fold short and clean.
 */
function anchorFor(shape: NonNullable<StickerPeelItem["shape"]>, w: number, h: number, lx: number, ly: number): Anchor {
  if (shape === "circle") {
    let dx = lx - w / 2, dy = ly - h / 2;
    const length = Math.hypot(dx, dy);
    if (length < 1) { dx = .7071; dy = .7071; } else { dx /= length; dy /= length; }
    const r = Math.min(w, h) / 2;
    return { point: [w / 2 + dx * r, h / 2 + dy * r], dir: [-dx, -dy], corner: -1 };
  }
  const right = lx >= w / 2, bottom = ly >= h / 2;
  const s = Math.SQRT1_2;
  return { point: [right ? w : 0, bottom ? h : 0], dir: [right ? -s : s, bottom ? -s : s], corner: (right ? 1 : 0) + (bottom ? 2 : 0) };
}

function rubber(value: number, min: number, max: number) {
  if (value < min) return min - (min - value) * 40 / (40 + (min - value));
  if (value > max) return max + (value - max) * 40 / (40 + (value - max));
  return value;
}

/** Positions a long gradient strip so its left edge lies on the fold and it runs away from it along `direction`. */
function strip(node: HTMLElement, mx: number, my: number, dx: number, dy: number, reach: number, image: string) {
  node.style.width = `${reach}px`;
  node.style.height = `${reach * 2}px`;
  node.style.transform = `translate(${mx}px, ${my}px) rotate(${Math.atan2(dy, dx)}rad) translateY(-50%)`;
  node.style.backgroundImage = image;
}

interface StickerProps {
  item: StickerPeelItem;
  placement: StickerPlacement;
  board: RefObject<HTMLDivElement | null>;
  z: number;
  reduced: boolean;
  describedBy: string;
  onFront: (id: string) => void;
  onPlace: (id: string, placement: StickerPlacement) => void;
  announce: (message: string) => void;
}

interface Drag {
  id: number;
  startX: number;
  startY: number;
  fromX: number;
  fromY: number;
  mode: "peel" | "held";
  grabX: number;
  grabY: number;
  lastX: number;
  lastY: number;
  lastT: number;
  pullSpeed: number;
}

function Sticker({ item, placement, board, z, reduced, describedBy, onFront, onPlace, announce }: StickerProps) {
  const shape = item.shape ?? "rounded";
  const rootRef = useRef<HTMLButtonElement>(null);
  const frontRef = useRef<HTMLSpanElement>(null);
  const flapRef = useRef<HTMLSpanElement>(null);
  const backRef = useRef<HTMLSpanElement>(null);
  const curlRef = useRef<HTMLSpanElement>(null);
  const [held, setHeld] = useState(false);

  // Placement is written through motion values together with the offsets, so a new placement and the offset that cancels
  // it land in the same frame and nothing jumps.
  const left = useMotionValue(`${placement.x * 100}%`), top = useMotionValue(`${placement.y * 100}%`);
  const offsetX = useMotionValue(0), offsetY = useMotionValue(0);
  const x = useSpring(offsetX, FOLLOW), y = useSpring(offsetY, FOLLOW);
  const tilt = useMotionValue(placement.rotate);
  const rotate = useSpring(tilt, TURN);
  const lift = useMotionValue(0);
  const scale = useTransform(lift, [0, 1], [1, 1.03]);

  // The peel: how far the anchor point has been pulled, in the sticker's own space. Targets are set directly and the
  // displayed peel follows on the paper spring.
  const peelTX = useMotionValue(0), peelTY = useMotionValue(0);
  const peelX = useSpring(peelTX, PAPER), peelY = useSpring(peelTY, PAPER);
  const anchor = useRef<Anchor>({ point: [0, 0], dir: [Math.SQRT1_2, Math.SQRT1_2], corner: 0 });
  const pendingAnchor = useRef<Anchor | null>(null);
  const drag = useRef<Drag | null>(null);
  const keyboardOrigin = useRef<{ x: number; y: number } | null>(null);
  const committed = useRef<StickerPlacement | null>(null);

  const size = () => ({ w: frontRef.current?.offsetWidth ?? 0, h: frontRef.current?.offsetHeight ?? 0 });
  const boardSize = () => ({ W: board.current?.clientWidth ?? 0, H: board.current?.clientHeight ?? 0 });

  const setPeel = (px: number, py: number, instant = false) => {
    peelTX.set(px); peelTY.set(py);
    if (instant || reduced) { peelX.jump(px); peelY.jump(py); }
  };

  /** A short lift that always clears the rounded corner, so the hint reads on every shape. */
  const hintFor = (next: Anchor): Point => {
    const { w, h } = size();
    const gap = insetAlong(next.point, next.dir, w, h, cornerRadius(shape, w, h));
    const length = gap * 2 + 9;
    return [next.dir[0] * length, next.dir[1] * length];
  };

  const render = () => {
    const front = frontRef.current, flap = flapRef.current, back = backRef.current, curl = curlRef.current;
    if (!front || !flap || !back || !curl) return;
    // Only ever draw a fold that points into the sticker within the allowed lean. A spring passing through an odd angle,
    // or a peel left over from another corner, can then never produce a fold across the whole sticker.
    const [ux, uy] = anchor.current.dir;
    const rawX = peelX.get(), rawY = peelY.get();
    const along = rawX * ux + rawY * uy;
    const across = Math.max(-Math.abs(along) * Math.tan(MAX_LEAN), Math.min(Math.abs(along) * Math.tan(MAX_LEAN), rawX * -uy + rawY * ux));
    const dx = along > 0 ? ux * along - uy * across : 0, dy = along > 0 ? uy * along + ux * across : 0;
    const length = Math.hypot(rawX, rawY);
    // Swap to a waiting corner only once the old one has settled flat, so the fold never jumps across the sticker.
    if (pendingAnchor.current && length < .5) {
      anchor.current = pendingAnchor.current;
      pendingAnchor.current = null;
      if (!drag.current) { const [hx, hy] = hintFor(anchor.current); setPeel(hx, hy); }
    }
    if (length < .5 || Math.hypot(dx, dy) < .5) {
      front.style.clipPath = "";
      flap.style.visibility = "hidden";
      return;
    }
    const w = front.offsetWidth, h = front.offsetHeight;
    const [ax, ay] = anchor.current.point;
    const drawn = Math.hypot(dx, dy);
    const nx = dx / drawn, ny = dy / drawn, mx = ax + dx / 2, my = ay + dy / 2;
    const rect: Point[] = [[0, 0], [w, 0], [w, h], [0, h]];
    const side = ([px, py]: Point) => (px - mx) * nx + (py - my) * ny;
    const stuck = clip(rect, side), folded = clip(rect, point => -side(point));
    front.style.clipPath = stuck.length > 2 ? polygonCss(stuck) : "inset(50%)";
    if (folded.length < 3) { flap.style.visibility = "hidden"; return; }
    flap.style.visibility = "visible";

    // The flap is mirrored over the fold and foreshortened a touch, so it reads as paper standing off the surface.
    const raise = Math.min(1, drawn / 80);
    const k = 1 - raise * .06;
    const dot = mx * nx + my * ny;
    const a = 1 - (1 + k) * nx * nx, b = -(1 + k) * nx * ny, d = 1 - (1 + k) * ny * ny;
    back.style.transform = `matrix(${a}, ${b}, ${b}, ${d}, ${(1 + k) * dot * nx}, ${(1 + k) * dot * ny})`;
    back.style.clipPath = polygonCss(folded);

    // A soft shadow that always falls downward on screen, whatever the sticker's angle.
    const turn = -rotate.get() * Math.PI / 180, drop = .8 + raise * 2;
    const sx = -Math.sin(turn) * drop, sy = Math.cos(turn) * drop;
    flap.style.filter = `drop-shadow(${sx.toFixed(2)}px ${sy.toFixed(2)}px ${(1.5 + raise * 3).toFixed(2)}px oklch(0% 0 0 / ${(.1 + raise * .06).toFixed(3)}))`;

    // One quiet tone on the backing: a little shade at the bend, fading out.
    const diagonal = Math.hypot(w, h) * 2;
    strip(curl, mx, my, -nx, -ny, diagonal, `linear-gradient(90deg, oklch(0% 0 0 / .07) 0px, oklch(0% 0 0 / 0) ${Math.max(6, Math.min(18, drawn * .25))}px)`);
  };

  const renderRef = useRef(render);
  useEffect(() => { renderRef.current = render; });
  useEffect(() => {
    const draw = () => renderRef.current();
    const a = peelX.on("change", draw), b = peelY.on("change", draw);
    return () => { a(); b(); };
  }, [peelX, peelY]);

  // A new placement: re-base in the same frame. If it is not the one this sticker just committed, glide there.
  const lastPlacement = useRef(placement);
  useLayoutEffect(() => {
    const before = lastPlacement.current;
    lastPlacement.current = placement;
    if (before.x === placement.x && before.y === placement.y && before.rotate === placement.rotate) return;
    const { W, H } = boardSize();
    const shiftX = (placement.x - before.x) * W, shiftY = (placement.y - before.y) * H;
    left.set(`${placement.x * 100}%`); top.set(`${placement.y * 100}%`);
    offsetX.jump(offsetX.get() - shiftX); offsetY.jump(offsetY.get() - shiftY);
    x.jump(x.get() - shiftX); y.jump(y.get() - shiftY);
    const mine = committed.current;
    committed.current = null;
    if (mine && Math.abs(mine.x - placement.x) < 1e-6 && Math.abs(mine.y - placement.y) < 1e-6) return;
    if (drag.current || keyboardOrigin.current) return;
    if (reduced) { offsetX.jump(0); offsetY.jump(0); x.jump(0); y.jump(0); tilt.jump(placement.rotate); rotate.jump(placement.rotate); return; }
    offsetX.set(0); offsetY.set(0); tilt.set(placement.rotate);
  });

  const toLocal = (clientX: number, clientY: number): Point => {
    const rect = rootRef.current!.getBoundingClientRect();
    const { w, h } = size();
    const angle = -rotate.get() * Math.PI / 180, scaleNow = scale.get() || 1;
    const vx = (clientX - (rect.left + rect.width / 2)) / scaleNow, vy = (clientY - (rect.top + rect.height / 2)) / scaleNow;
    return [w / 2 + vx * Math.cos(angle) - vy * Math.sin(angle), h / 2 + vx * Math.sin(angle) + vy * Math.cos(angle)];
  };
  const rotateDelta = (dx: number, dy: number): Point => {
    const angle = -rotate.get() * Math.PI / 180;
    return [dx * Math.cos(angle) - dy * Math.sin(angle), dx * Math.sin(angle) + dy * Math.cos(angle)];
  };

  /** Offsets that keep the whole sticker, at the given angle, inside the surface. */
  const bounds = (angle = rotate.get()) => {
    const { w, h } = size(), { W, H } = boardSize();
    const rad = angle * Math.PI / 180, cos = Math.abs(Math.cos(rad)), sin = Math.abs(Math.sin(rad));
    const halfW = (w * cos + h * sin) / 2 + 4, halfH = (w * sin + h * cos) / 2 + 4;
    const baseX = placement.x * W, baseY = placement.y * H;
    return { minX: Math.min(0, halfW - baseX), maxX: Math.max(0, W - halfW - baseX), minY: Math.min(0, halfH - baseY), maxY: Math.max(0, H - halfH - baseY) };
  };

  const commit = (atX: number, atY: number, angle: number) => {
    const { W, H } = boardSize();
    if (!W || !H) return;
    const next = { x: placement.x + atX / W, y: placement.y + atY / H, rotate: Math.round(angle * 10) / 10 };
    committed.current = next;
    onPlace(item.id, next);
  };

  const pickUp = () => {
    setPeel(0, 0);
    if (reduced) lift.jump(1); else animate(lift, 1, LIFT);
    setHeld(true);
  };

  const stickDown = () => {
    setHeld(false);
    // Land where the sticker is on screen now, not where the chasing spring was heading.
    const angle = placement.rotate;
    const { minX, maxX, minY, maxY } = bounds(angle);
    const atX = Math.min(maxX, Math.max(minX, x.get())), atY = Math.min(maxY, Math.max(minY, y.get()));
    const clamped = Math.abs(atX - x.get()) + Math.abs(atY - y.get()) > .5;
    offsetX.jump(atX); offsetY.jump(atY);
    // Inside the surface it lands exactly where it is; pushed past an edge it slides back in.
    if (!clamped || reduced) { x.jump(atX); y.jump(atY); }
    if (reduced) lift.jump(0); else animate(lift, 0, SETTLE);
    commit(atX, atY, angle);
  };

  const hover = (event: ReactPointerEvent) => {
    if (drag.current || event.pointerType !== "mouse" || reduced || held || keyboardOrigin.current) return;
    const { w, h } = size();
    const [lx, ly] = toLocal(event.clientX, event.clientY);
    const next = anchorFor(shape, w, h, lx, ly);
    const current = anchor.current;
    const lifted = Math.hypot(peelX.get(), peelY.get()) > .5;
    if (shape !== "circle" && lifted && next.corner !== current.corner) {
      // Lay the old corner down first; render() lifts the new one once it is flat.
      pendingAnchor.current = next;
      setPeel(0, 0);
      return;
    }
    // Circles slide the lift along the rim; move it only a little at a time so it glides instead of jumping.
    if (shape === "circle" && lifted) {
      const turnBy = Math.atan2(current.dir[0] * next.dir[1] - current.dir[1] * next.dir[0], current.dir[0] * next.dir[0] + current.dir[1] * next.dir[1]);
      if (Math.abs(turnBy) > .6) { pendingAnchor.current = next; setPeel(0, 0); return; }
    }
    pendingAnchor.current = null;
    anchor.current = next;
    if (shape === "circle" && lifted) {
      // Carry the current lift around the rim so the fold stays square to the edge as it slides.
      const now = Math.hypot(peelX.get(), peelY.get());
      peelX.jump(next.dir[0] * now); peelY.jump(next.dir[1] * now);
    }
    const [hx, hy] = hintFor(next);
    setPeel(hx, hy);
    render();
  };
  const onPointerMove = (event: ReactPointerEvent) => {
    if (drag.current) onDragMove(event); else hover(event);
  };
  const onPointerLeave = (event: ReactPointerEvent) => {
    if (drag.current || event.pointerType !== "mouse" || held) return;
    pendingAnchor.current = null;
    setPeel(0, 0);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button > 0 || drag.current) return;
    event.preventDefault();
    rootRef.current?.focus({ preventScroll: true });
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* the pointer is already gone */ }
    onFront(item.id);
    const { w, h } = size();
    const [lx, ly] = toLocal(event.clientX, event.clientY);
    pendingAnchor.current = null;
    const lifted = Math.hypot(peelX.get(), peelY.get()) > 1.5;
    const next = anchorFor(shape, w, h, lx, ly);
    if (!lifted || (shape !== "circle" && next.corner !== anchor.current.corner)) {
      anchor.current = next;
      setPeel(0, 0, true);
    }
    // Continue from the peel on screen, so grabbing a lifting corner never snaps.
    peelTX.set(peelX.get()); peelTY.set(peelY.get());
    const rect = rootRef.current!.getBoundingClientRect();
    drag.current = {
      id: event.pointerId, startX: event.clientX, startY: event.clientY, fromX: peelX.get(), fromY: peelY.get(), mode: "peel",
      grabX: event.clientX - (rect.left + rect.width / 2), grabY: event.clientY - (rect.top + rect.height / 2),
      lastX: event.clientX, lastY: event.clientY, lastT: event.timeStamp, pullSpeed: 0,
    };
    if (reduced) { drag.current.mode = "held"; pickUp(); }
    else {
      const [hx, hy] = hintFor(anchor.current);
      const now = Math.hypot(peelX.get(), peelY.get());
      // A press alone lifts the corner a touch, so the finger feels it catch.
      if (now < Math.hypot(hx, hy)) { peelTX.set(hx); peelTY.set(hy); drag.current.fromX = hx; drag.current.fromY = hy; }
    }
  };

  const onDragMove = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    const dt = Math.max(1, event.timeStamp - state.lastT);
    const [vx, vy] = rotateDelta(event.clientX - state.lastX, event.clientY - state.lastY);
    const [ux, uy] = anchor.current.dir;
    state.pullSpeed = state.pullSpeed * .6 + (vx * ux + vy * uy) / dt * 1000 * .4;
    state.lastX = event.clientX; state.lastY = event.clientY; state.lastT = event.timeStamp;

    if (state.mode === "held") { moveHeld(event.clientX, event.clientY); return; }

    const { w, h } = size();
    const [ldx, ldy] = rotateDelta(event.clientX - state.startX, event.clientY - state.startY);
    const rawX = state.fromX + ldx, rawY = state.fromY + ldy;
    const along = rawX * ux + rawY * uy, across = rawX * -uy + rawY * ux;
    const [hx, hy] = hintFor(anchor.current);
    const minimum = Math.hypot(hx, hy);
    // Tugging outward past the lifted edge pulls the whole sticker off.
    if (along < minimum && Math.hypot(ldx, ldy) > 36 && ldx * ux + ldy * uy < 0) { becomeHeld(event); return; }
    const pull = Math.max(minimum, along);
    const lean = Math.max(-pull * Math.tan(MAX_LEAN), Math.min(pull * Math.tan(MAX_LEAN), across));
    peelTX.set(ux * pull - uy * lean);
    peelTY.set(uy * pull + ux * lean);
    // Comes off once the fold passes the middle, or sooner on a quick pull.
    const [ax, ay] = anchor.current.point;
    const reach = Math.max(...([[0, 0], [w, 0], [w, h], [0, h]] as Point[]).map(([cx, cy]) => (cx - ax) * ux + (cy - ay) * uy));
    // Or once the hand has clearly carried it away in any direction.
    if (pull > reach * .95 || (pull > reach * .45 && state.pullSpeed > FLICK_SPEED) || Math.hypot(ldx, ldy) > Math.max(90, reach * 1.15)) becomeHeld(event);
  };

  const becomeHeld = (event: ReactPointerEvent) => {
    const state = drag.current!;
    state.mode = "held";
    // Hold it by the lifted edge: that point comes back under the finger as the sticker flattens.
    const { w, h } = size();
    const [ax, ay] = anchor.current.point;
    const angle = rotate.get() * Math.PI / 180, cos = Math.cos(angle), sin = Math.sin(angle);
    const ox = ax - w / 2, oy = ay - h / 2;
    const edgeX = (ox * cos - oy * sin) * .8, edgeY = (ox * sin + oy * cos) * .8;
    state.grabX = edgeX; state.grabY = edgeY;
    pickUp();
    announce(`${item.label} peeled off.`);
    moveHeld(event.clientX, event.clientY);
  };

  const moveHeld = (clientX: number, clientY: number) => {
    const state = drag.current;
    if (!state) return;
    const rect = board.current!.getBoundingClientRect();
    const { W, H } = boardSize();
    const { minX, maxX, minY, maxY } = bounds();
    offsetX.set(rubber(clientX - state.grabX - rect.left - placement.x * W, minX, maxX));
    offsetY.set(rubber(clientY - state.grabY - rect.top - placement.y * H, minY, maxY));
    // Reduced motion: the sticker sits under the hand instead of trailing it on a spring.
    if (reduced) { x.jump(offsetX.get()); y.jump(offsetY.get()); }
  };

  const release = (event: ReactPointerEvent) => {
    const state = drag.current;
    if (!state || event.pointerId !== state.id) return;
    drag.current = null;
    if (state.mode === "held") {
      stickDown();
      announce(`${item.label} stuck down.`);
      return;
    }
    // Let go early and the paper smooths itself flat with one small rebound.
    setPeel(0, 0);
  };

  const onKeyDown = (event: ReactKeyboardEvent) => {
    const isHeld = keyboardOrigin.current !== null;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (event.repeat || drag.current) return;
      if (!isHeld) {
        onFront(item.id);
        keyboardOrigin.current = { x: offsetX.get(), y: offsetY.get() };
        pickUp();
        announce(`${item.label} picked up. Move with the arrow keys, press Enter to stick it down, or Escape to put it back.`);
      } else {
        keyboardOrigin.current = null;
        stickDown();
        announce(`${item.label} stuck down.`);
      }
      return;
    }
    if (!isHeld) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") {
        event.preventDefault();
        offsetX.set(keyboardOrigin.current!.x); offsetY.set(keyboardOrigin.current!.y);
        if (reduced) { x.jump(offsetX.get()); y.jump(offsetY.get()); }
      }
      const back = event.key === "Escape" ? keyboardOrigin.current! : null;
      keyboardOrigin.current = null;
      if (back) {
        // Put back exactly where it was: land at the origin rather than wherever the glide is.
        setHeld(false);
        if (reduced) lift.jump(0); else animate(lift, 0, SETTLE);
      } else stickDown();
      announce(back ? `${item.label} put back.` : `${item.label} stuck down.`);
      return;
    }
    const step = event.shiftKey ? 40 : 10;
    const moves: Record<string, Point> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const { minX, maxX, minY, maxY } = bounds();
    offsetX.set(Math.min(maxX, Math.max(minX, offsetX.get() + move[0])));
    offsetY.set(Math.min(maxY, Math.max(minY, offsetY.get() + move[1])));
    if (reduced) { x.jump(offsetX.get()); y.jump(offsetY.get()); }
  };

  return <motion.button ref={rootRef} type="button" className={styles.sticker} data-shape={shape} data-held={held || undefined}
    aria-label={item.label} aria-roledescription="sticker" aria-pressed={held} aria-describedby={describedBy}
    style={{ left, top, x, y, rotate, scale, zIndex: held ? 1000 : z }}
    onPointerEnter={hover} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave}
    onPointerDown={onPointerDown} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
    onKeyDown={onKeyDown} onContextMenu={event => event.preventDefault()}
    onBlur={() => { if (keyboardOrigin.current) { keyboardOrigin.current = null; stickDown(); } }}>
    <motion.span className={styles.liftShadow} aria-hidden="true" style={{ opacity: lift }} />
    <span ref={frontRef} className={styles.front} aria-hidden="true">
      <span className={styles.face}>{item.content}</span>
    </span>
    <span ref={flapRef} className={styles.flap} aria-hidden="true">
      <span ref={backRef} className={styles.back}><span ref={curlRef} className={styles.curl} /></span>
    </span>
  </motion.button>;
}

export function StickerPeel({ stickers, positions, onPositionsChange, label = "Stickers", children, className, style }: StickerPeelProps) {
  const reduced = useReducedFlag();
  const uid = useId();
  const boardRef = useRef<HTMLDivElement>(null);
  const [local, setLocal] = useState<Record<string, StickerPlacement>>({});
  const [order, setOrder] = useState(() => stickers.map(item => item.id));
  const [message, setMessage] = useState("");

  const placements = useMemo(() => stickers.map(item => positions?.[item.id] ?? local[item.id] ?? { x: item.x, y: item.y, rotate: item.rotate ?? 0 }), [stickers, positions, local]);

  const onFront = useCallback((id: string) => setOrder(list => [...list.filter(entry => entry !== id), id]), []);
  const onPlace = (id: string, placement: StickerPlacement) => {
    const all = Object.fromEntries(stickers.map((item, index) => [item.id, item.id === id ? placement : placements[index]]));
    if (positions === undefined) setLocal(all);
    onPositionsChange?.(all);
  };

  return <div ref={boardRef} className={[styles.board, className].filter(Boolean).join(" ")} style={style} role="group" aria-label={label}>
    {children}
    {stickers.map((item, index) => <Sticker key={item.id} item={item} placement={placements[index]} board={boardRef}
      z={Math.max(0, order.indexOf(item.id)) + 1} reduced={reduced} describedBy={`${uid}-help`}
      onFront={onFront} onPlace={onPlace} announce={setMessage} />)}
    <span id={`${uid}-help`} className={styles.srOnly}>Drag to peel and move. With the keyboard, press Enter to pick up, arrow keys to move, and Enter to stick down.</span>
    <span className={styles.srOnly} role="status">{message}</span>
  </div>;
}
