"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CircleCheck, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { Tooltip } from "../../tooltip/tooltip";
import { motionTokens } from "../../lib/motion-tokens";
import { ClaudeMark } from "./reasoning-tree-marks";
import {
  DEFAULT_QUESTION, DEFAULT_QUESTION_DETAIL, DEFAULT_THOUGHTS, WIDE_MIN,
  buildTree, edgePath, narrowLayout, pathThrough, phaseOf, reservedRows, runSearch, viewOf, wideLayout,
} from "./reasoning-tree-model";
import type { Box, NodeView, Phase, ReasoningThought, SearchRun, TreeLayout, TreeNode } from "./reasoning-tree-model";
import styles from "./reasoning-tree.module.css";

export type { ReasoningThought } from "./reasoning-tree-model";

export interface ReasoningTreeModel {
  /** Model name in the header, such as "Claude Opus 5.5". */
  name: string;
  /** A small mark before the name. Color marks keep their own fills. */
  mark?: ReactNode;
}

export interface ReasoningTreeResult {
  /** The thought the search settled on. */
  answer: ReasoningThought & { id: string; score: number };
  /** Every thought from the first depth to the answer. */
  path: (ReasoningThought & { id: string; score: number })[];
  beamWidth: number;
}

/**
 * Tree search over thoughts, step by step. A question proposes candidate thoughts, each gets a score, the weak ones are
 * pruned and the best `beamWidth` expand another depth, up to three. The best path from the question to the answer then
 * lights up. Scores are illustrative. Play, pause, step and restart drive the search; the beam width changes how many
 * branches survive each depth, and the outcome for a given tree and seed is always the same.
 */
export interface ReasoningTreeProps {
  /** Short question on the root node. */
  question?: string;
  /** The full question, shown on hover and focus. Defaults to the question. */
  questionDetail?: string;
  /** Thoughts at the first depth, each with its own children. Read to a depth of 3. */
  thoughts?: ReasoningThought[];
  /** How many thoughts survive each depth, from 1 to 3. Controlled. */
  beamWidth?: number;
  /** Starting beam width when uncontrolled. */
  defaultBeamWidth?: number;
  /** Called with the new width when the beam width control changes. */
  onBeamWidthChange?: (beamWidth: number) => void;
  /** Seeds the scores of thoughts that have none, so a tree always searches the same way. */
  seed?: number;
  /** Starts playing the first time the tree scrolls into view. Off under reduced motion. */
  autoPlay?: boolean;
  /** Starts over a few seconds after the answer is found. */
  loop?: boolean;
  /** Multiplies the pace. At 1 a three depth search takes about 7 seconds. 0 holds still. */
  speed?: number;
  /** Shows play, pause, step, restart and the beam width control. */
  controls?: boolean;
  /** The model in the header. Pass null to show only the title. */
  model?: ReasoningTreeModel | null;
  /** Header title. */
  title?: string;
  /** Color of kept thoughts and the best path. Defaults to the first chart series color. */
  accent?: string;
  /** Called once each time the search reaches its answer. */
  onAnswer?: (result: ReasoningTreeResult) => void;
  className?: string;
  style?: CSSProperties;
}

const DEFAULT_MODEL: ReasoningTreeModel = { name: "Claude Opus 5.5", mark: <ClaudeMark /> };

/** Milliseconds each step holds at speed 1, long enough for its transitions to land. */
const HOLD: Record<Phase, number> = { question: 560, propose: 620, score: 880, prune: 760, answer: 4200 };
const BEAMS = [1, 2, 3] as const;
const SPRING_RATE = 15;

const clampBeam = (value: number) => Math.min(3, Math.max(1, Math.round(value) || 1));
const subscribeNothing = () => () => {};
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const scoreText = (score: number) => score.toFixed(2);

function publicThought(node: TreeNode): ReasoningThought & { id: string; score: number } {
  return { id: node.id, label: node.label, text: node.text, score: node.score };
}

function describe(node: TreeNode, view: NodeView) {
  if (node.depth === 0) return "Question";
  if (!view.scored) return "Not scored yet";
  const word = view.status === "answer" ? "Answer" : view.status === "kept" ? (view.onPath ? "On the best path" : "Kept") : view.status === "pruned" ? "Pruned" : "Scored";
  return `Score ${scoreText(node.score)} · ${word}`;
}

interface Status { key: string; text: string; icon: "done" | "paused" | null; active: boolean }

function statusOf(run: SearchRun, step: number, running: boolean): Status {
  const { phase, depth } = phaseOf(run, step);
  const level = run.levels[depth - 1];
  const n = level?.candidates.length ?? 0;
  const k = level?.kept.length ?? 0;
  const icon = running ? null : "paused";
  if (phase === "answer") return { key: "answer", text: run.answer ? "Answer found" : "Nothing to search", icon: "done", active: false };
  if (phase === "question") return running ? { key: "q", text: "Reading the question", icon: null, active: true } : { key: "ready", text: "Ready", icon: null, active: false };
  if (phase === "propose") return { key: `${step}-${running}`, text: `${running ? "Proposing" : "Proposed"} ${plural(n, "thought")}`, icon, active: running };
  if (phase === "score") return { key: `${step}-${running}`, text: `${running ? "Scoring" : "Scored"} ${plural(n, "thought")}`, icon, active: running };
  return { key: `${step}-${running}`, text: `${running ? "Keeping" : "Kept"} the best ${k === 1 ? "one" : k}`, icon, active: running };
}

function announcement(run: SearchRun, step: number) {
  const { phase, depth } = phaseOf(run, step);
  const level = run.levels[depth - 1];
  if (phase === "question") return "Ready. Play or step to start the search.";
  if (phase === "answer") return run.answer ? `Answer found with a score of ${scoreText(run.answer.score)}: ${run.answer.text}` : "There are no thoughts to search.";
  if (!level) return "";
  const best = [...level.candidates].sort((a, b) => b.score - a.score)[0];
  if (phase === "propose") return `Depth ${depth}: proposed ${plural(level.candidates.length, "thought")}.`;
  if (phase === "score") return `Depth ${depth}: scored ${plural(level.candidates.length, "thought")}. Best is ${best.label}, ${scoreText(best.score)}.`;
  return `Depth ${depth}: kept ${level.kept.length} of ${level.candidates.length}, pruned ${level.candidates.length - level.kept.length}.`;
}

function StatusLine({ status, reduced }: { status: Status; reduced: boolean }) {
  return <span className={styles.status}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={status.key}
        className={styles.statusItem}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease: [...motionTokens.ease.standard] } }}
        transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease: [...motionTokens.ease.standard] }}
      >
        {status.icon === "done" && <CircleCheck className={styles.statusDone} size={14} strokeWidth={1.75} aria-hidden="true" />}
        {status.icon === "paused" && <Pause className={styles.statusIcon} size={12} strokeWidth={1.75} aria-hidden="true" />}
        <span className={styles.statusText} data-active={status.active && !reduced ? true : undefined}>{status.text}</span>
      </motion.span>
    </AnimatePresence>
  </span>;
}

type Pos = { x: number; y: number; vx: number; vy: number };

export function ReasoningTree({
  question = DEFAULT_QUESTION,
  questionDetail,
  thoughts = DEFAULT_THOUGHTS,
  beamWidth,
  defaultBeamWidth = 2,
  onBeamWidthChange,
  seed = 7,
  autoPlay = true,
  loop = false,
  speed = 1,
  controls = true,
  model = DEFAULT_MODEL,
  title = "Tree of thoughts",
  accent,
  onAnswer,
  className,
  style,
}: ReasoningTreeProps) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const prefersReduced = useReducedMotion();
  const reduced = hydrated && Boolean(prefersReduced);

  const detail = questionDetail ?? (question === DEFAULT_QUESTION ? DEFAULT_QUESTION_DETAIL : question);
  const tree = useMemo(() => buildTree(question, detail, thoughts, seed), [question, detail, thoughts, seed]);
  const runs = useMemo(() => BEAMS.map(beam => runSearch(tree.root, beam)), [tree]);
  const rows = useMemo(() => reservedRows(runs), [runs]);

  const [innerBeam, setInnerBeam] = useState(() => clampBeam(defaultBeamWidth));
  const beam = clampBeam(beamWidth ?? innerBeam);
  const run = runs[beam - 1];
  const lastDepth = run.levels.length;

  /** Progress belongs to one beam width; a new width starts the search over. Untouched, reduced motion rests on the answer. */
  const [progress, setProgress] = useState({ beam, step: 0, touched: false });
  const own = progress.beam === beam;
  const touched = own && progress.touched;
  const step = Math.min(run.finalStep, reduced && !touched ? run.finalStep : own ? progress.step : 0);
  const [playing, setPlaying] = useState(false);
  const pace = Math.max(0, speed);
  const atEnd = step >= run.finalStep;
  const running = playing && pace > 0 && !(reduced && !touched) && (!atEnd || loop);
  const final = atEnd && Boolean(run.answer);

  const views = useMemo(() => new Map(tree.all.map(node => [node.id, viewOf(run, node, step)])), [tree, run, step]);
  const viewFor = (node: TreeNode) => views.get(node.id) ?? { status: "hidden" as const, shown: false, scored: false, onPath: false };

  /* Playback ------------------------------------------------------------------------------------------------- */

  useEffect(() => {
    if (!playing || pace === 0 || (reduced && !touched)) return;
    if (step >= run.finalStep) {
      if (!loop) return;
      const id = window.setTimeout(() => setProgress({ beam, step: 0, touched: true }), HOLD.answer / pace);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => setProgress({ beam, step: step + 1, touched: true }), HOLD[phaseOf(run, step).phase] / pace);
    return () => window.clearTimeout(id);
  }, [playing, pace, reduced, touched, step, run, beam, loop]);

  const rootRef = useRef<HTMLDivElement>(null);
  const auto = useRef({ autoPlay, reduced, started: false });
  useEffect(() => { auto.current.autoPlay = autoPlay; auto.current.reduced = reduced; }, [autoPlay, reduced]);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      const state = auto.current;
      if (!entry?.isIntersecting || state.started) return;
      state.started = true;
      observer.disconnect();
      if (state.autoPlay && !state.reduced) setPlaying(true);
    }, { threshold: 0.3 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const answered = useRef<string | null>(null);
  useEffect(() => {
    if (!final || !run.answer) { answered.current = null; return; }
    const key = `${beam}:${run.answer.id}`;
    if (answered.current === key) return;
    answered.current = key;
    onAnswer?.({ answer: publicThought(run.answer), path: run.path.slice(1).map(publicThought), beamWidth: beam });
  }, [final, run, beam, onAnswer]);

  /** What the status region says belongs to one step of one search, so it never repeats after the search moves on. */
  const [said, setSaid] = useState({ text: "", beam: 0, step: -1 });
  const togglePlay = () => {
    if (running) { setPlaying(false); setSaid({ text: announcement(run, step), beam, step }); return; }
    if (atEnd || !touched) setProgress({ beam, step: atEnd ? 0 : step, touched: true });
    setPlaying(true);
  };
  const stepOnce = () => {
    if (atEnd) return;
    setPlaying(false);
    setProgress({ beam, step: step + 1, touched: true });
    setSaid({ text: announcement(run, step + 1), beam, step: step + 1 });
  };
  const restart = () => {
    setProgress({ beam, step: 0, touched: true });
    setPlaying(!reduced && pace > 0);
    setSaid({ text: announcement(run, 0), beam, step: 0 });
  };
  const changeBeam = (next: number) => {
    const value = clampBeam(next);
    if (value === beam) return;
    onBeamWidthChange?.(value);
    if (beamWidth === undefined) setInnerBeam(value);
    setProgress({ beam: value, step: 0, touched: !reduced });
    setPlaying(!reduced && pace > 0);
    const target = runs[value - 1];
    if (reduced) setSaid({ text: `Beam width ${value}. ${announcement(target, target.finalStep)}`, beam: value, step: target.finalStep });
  };
  const live = running ? "" : said.beam === beam && said.step === step ? said.text : final ? announcement(run, step) : "";

  /* Layout and the position spring ------------------------------------------------------------------------------ */

  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const measure = () => setWidth(Math.floor(node.clientWidth));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const mode: TreeLayout["mode"] = width >= WIDE_MIN ? "wide" : "narrow";
  const layout = useMemo<TreeLayout | null>(() => {
    if (!width) return null;
    if (mode === "wide") return wideLayout(tree.root, tree.all, run, width, rows);
    return narrowLayout(tree.root, tree.all, node => node.depth === 0 || (views.get(node.id)?.shown ?? false), node => run.candidateIds.has(node.id), width);
  }, [width, mode, tree, run, rows, views]);

  const slotEls = useRef(new Map<string, HTMLDivElement>());
  const edgeEls = useRef(new Map<string, SVGPathElement>());
  const pathEl = useRef<SVGPathElement>(null);
  const sheenEl = useRef<SVGPathElement>(null);
  const sim = useRef({ pos: new Map<string, Pos>(), shown: new Set<string>(), mode: "", width: 0, frame: 0, last: 0 });
  const latest = useRef<{ layout: TreeLayout | null; paint: () => void }>({ layout: null, paint: () => {} });
  const tick = useRef<(now: number) => void>(() => {});

  /** Writes positions and edges straight to the DOM, so a glide never re-renders React. */
  const paint = useCallback(() => {
    if (!layout) return;
    const { pos } = sim.current;
    const boxOf = (id: string): Box | undefined => {
      const target = layout.boxes.get(id);
      const at = pos.get(id);
      return target && at ? { x: at.x, y: at.y, w: target.w, h: target.h } : target;
    };
    for (const node of tree.all) {
      const box = boxOf(node.id);
      const slot = slotEls.current.get(node.id);
      if (slot && box) slot.style.transform = `translate3d(${box.x}px, ${box.y}px, 0)`;
      if (!node.parent) continue;
      const parent = boxOf(node.parent.id);
      const edge = edgeEls.current.get(node.id);
      if (edge && box && parent) edge.setAttribute("d", edgePath(layout.mode, parent, box));
    }
    const d = pathThrough(layout.mode, run.path.map(node => boxOf(node.id)).filter((box): box is Box => Boolean(box)));
    pathEl.current?.setAttribute("d", d);
    sheenEl.current?.setAttribute("d", d);
  }, [layout, tree, run]);

  useLayoutEffect(() => {
    latest.current = { layout, paint };
    tick.current = (now: number) => {
      const state = sim.current;
      const target = latest.current.layout;
      const dt = Math.min(0.05, Math.max(0, (now - state.last) / 1000));
      state.last = now;
      let moving = false;
      if (target) for (const [id, p] of state.pos) {
        const goal = target.boxes.get(id);
        if (!goal || !state.shown.has(id)) continue;
        /** Critically damped: glides into place and never overshoots. */
        for (let left = dt; left > 0; left -= 1 / 240) {
          const h = Math.min(left, 1 / 240);
          p.vx += (-SPRING_RATE * SPRING_RATE * (p.x - goal.x) - 2 * SPRING_RATE * p.vx) * h;
          p.vy += (-SPRING_RATE * SPRING_RATE * (p.y - goal.y) - 2 * SPRING_RATE * p.vy) * h;
          p.x += p.vx * h;
          p.y += p.vy * h;
        }
        if (Math.abs(p.x - goal.x) < 0.05 && Math.abs(p.y - goal.y) < 0.05 && Math.abs(p.vx) < 0.5 && Math.abs(p.vy) < 0.5) {
          p.x = goal.x; p.y = goal.y; p.vx = 0; p.vy = 0;
        } else moving = true;
      }
      latest.current.paint();
      state.frame = moving ? requestAnimationFrame(t => tick.current(t)) : 0;
    };
  });

  useLayoutEffect(() => {
    if (!layout) return;
    const state = sim.current;
    const snapAll = reduced || state.mode !== layout.mode || state.width !== layout.width;
    let moving = false;
    for (const node of tree.all) {
      const goal = layout.boxes.get(node.id);
      if (!goal) continue;
      const shown = node.depth === 0 || (views.get(node.id)?.shown ?? false);
      const p = state.pos.get(node.id);
      if (!p) { state.pos.set(node.id, { x: goal.x, y: goal.y, vx: 0, vy: 0 }); continue; }
      /** A thought that just appeared starts in place; one that is fading out stays where it was. */
      if (snapAll || (shown && !state.shown.has(node.id))) { p.x = goal.x; p.y = goal.y; p.vx = 0; p.vy = 0; continue; }
      if (!shown) continue;
      if (Math.abs(p.x - goal.x) > 0.01 || Math.abs(p.y - goal.y) > 0.01) moving = true;
    }
    state.mode = layout.mode;
    state.width = layout.width;
    state.shown = new Set(tree.all.filter(node => node.depth === 0 || views.get(node.id)?.shown).map(node => node.id));
    paint();
    if (moving && !state.frame) {
      state.last = performance.now();
      state.frame = requestAnimationFrame(t => tick.current(t));
    }
  }, [layout, views, tree, reduced, paint]);

  useEffect(() => {
    const state = sim.current;
    return () => { cancelAnimationFrame(state.frame); state.frame = 0; };
  }, []);

  /* Focus, hover and keyboard ----------------------------------------------------------------------------------- */

  const [focusId, setFocusId] = useState("root");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const tabId = viewFor(tree.all.find(node => node.id === focusId) ?? tree.root).shown || focusId === "root" ? focusId : "root";
  const activeId = hoverId ?? focusedId;

  const onTreeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!layout) return;
    const current = tree.all.find(node => node.id === tabId) ?? tree.root;
    const shown = tree.all.filter(node => node.depth === 0 || viewFor(node).shown);
    const y = (node: TreeNode) => layout.boxes.get(node.id)?.y ?? 0;
    const line = (layout.mode === "wide" ? shown.filter(node => node.depth === current.depth) : shown).sort((a, b) => y(a) - y(b) || a.order - b.order);
    const at = line.indexOf(current);
    let next: TreeNode | undefined;
    if (event.key === "ArrowDown") next = line[at + 1];
    else if (event.key === "ArrowUp") next = line[at - 1];
    else if (event.key === "ArrowRight") {
      const kids = current.children.filter(kid => viewFor(kid).shown);
      next = kids.find(kid => viewFor(kid).onPath) ?? kids.find(kid => viewFor(kid).status !== "pruned") ?? kids[0];
    } else if (event.key === "ArrowLeft") next = current.parent ?? undefined;
    else if (event.key === "Home") next = tree.root;
    else if (event.key === "End") next = (final && run.answer) || [...shown].sort((a, b) => b.depth - a.depth || y(a) - y(b))[0];
    if (!next || next === current && event.key !== "Home") return;
    event.preventDefault();
    setFocusId(next.id);
    slotEls.current.get(next.id)?.focus({ preventScroll: false });
  };

  /* Render ------------------------------------------------------------------------------------------------------ */

  const status = statusOf(run, step, running);
  const { phase, depth: phaseDepth } = phaseOf(run, step);
  const pathIndex = new Map(run.path.map((node, i) => [node.id, i]));
  const rootStyle = { ...style, ...(accent ? { "--rt-accent": accent } : null), "--rt-path-steps": Math.max(1, run.path.length - 1) } as CSSProperties;

  const siblingIndex = (node: TreeNode) => {
    if (!node.parent) return 0;
    return node.parent.children.filter(kid => run.candidateIds.has(kid.id)).indexOf(node);
  };
  const ariaFor = (node: TreeNode, view: NodeView) => {
    if (node.depth === 0) return `Question: ${node.text}`;
    return `${node.text} ${describe(node, view)}.`;
  };

  return <div
    ref={rootRef}
    className={[styles.root, className].filter(Boolean).join(" ")}
    style={rootStyle}
    data-mode={layout?.mode}
    data-ready={layout ? true : undefined}
    data-final={final ? true : undefined}
  ><div className={styles.card}>
    <div className={styles.header}>
      <div className={styles.title}>
        {model ? <>
          {model.mark && <span className={styles.mark} aria-hidden="true">{model.mark}</span>}
          <span className={styles.modelName}>{model.name}</span>
          <span className={styles.method}>{title}</span>
        </> : <span className={styles.modelName}>{title}</span>}
      </div>
      <StatusLine status={status} reduced={reduced} />
    </div>

    <div ref={stageRef} className={styles.stage} style={layout ? { height: layout.height } : undefined}>
      {layout && <>
        {layout.mode === "wide" && layout.columns.map(column => {
          const level = run.levels[column.depth - 1];
          const decided = column.depth > 0 && step >= 3 * column.depth;
          const count = !level ? "" : column.depth === lastDepth ? `Best of ${level.candidates.length}` : `${level.kept.length} of ${level.candidates.length} kept`;
          return <div key={column.depth} className={styles.column} style={{ left: column.x, width: column.w }} data-active={(phase === "question" ? 0 : phaseDepth) === column.depth && !final ? true : undefined} aria-hidden="true">
            <span className={styles.columnName}>{column.depth === 0 ? "Question" : `Depth ${column.depth}`}</span>
            {column.depth > 0 && <span className={styles.columnCount} data-on={decided ? true : undefined}>{count}</span>}
          </div>;
        })}

        <svg className={styles.edges} width={layout.width} height={layout.height} aria-hidden="true">
          {tree.all.map(node => {
            if (!node.parent) return null;
            const view = viewFor(node);
            const parentBox = layout.boxes.get(node.parent.id), box = layout.boxes.get(node.id);
            if (!parentBox || !box) return null;
            return <path
              key={node.id}
              ref={el => { if (el) edgeEls.current.set(node.id, el); else edgeEls.current.delete(node.id); }}
              className={styles.edge}
              d={edgePath(layout.mode, parentBox, box)}
              pathLength={1}
              data-on={view.shown && view.status !== "pruned" ? true : undefined}
              style={{ "--i": siblingIndex(node) } as CSSProperties}
            />;
          })}
          <path ref={pathEl} className={styles.pathLine} pathLength={1} d={pathThrough(layout.mode, run.path.map(node => layout.boxes.get(node.id)).filter((box): box is Box => Boolean(box)))} />
          <path ref={sheenEl} className={styles.sheen} pathLength={1} d={pathThrough(layout.mode, run.path.map(node => layout.boxes.get(node.id)).filter((box): box is Box => Boolean(box)))} />
        </svg>

        <div className={styles.tree} role="tree" aria-label={`Thought tree for: ${tree.root.text}`} onKeyDown={onTreeKeyDown}>
          {tree.all.map(node => {
            const view = viewFor(node);
            const box = layout.boxes.get(node.id);
            if (!box) return null;
            const shownSiblings = node.parent ? node.parent.children.filter(kid => viewFor(kid).shown) : [node];
            const active = activeId === node.id && view.shown;
            const side = box.y < 96 ? "bottom" : "top";
            const align = layout.mode === "narrow" || node.depth === 0 ? "start" : node.depth === lastDepth ? "end" : "center";
            return <div
              key={node.id}
              ref={el => { if (el) slotEls.current.set(node.id, el); else slotEls.current.delete(node.id); }}
              role="treeitem"
              aria-level={node.depth + 1}
              aria-setsize={shownSiblings.length}
              aria-posinset={Math.max(1, shownSiblings.indexOf(node) + 1)}
              aria-selected={view.shown && tabId === node.id}
              aria-label={ariaFor(node, view)}
              aria-hidden={view.shown ? undefined : true}
              tabIndex={view.shown && tabId === node.id ? 0 : -1}
              className={styles.slot}
              data-depth={node.depth}
              data-last={node.depth > 0 && node.depth === lastDepth ? true : undefined}
              data-shown={view.shown}
              data-status={view.status}
              data-scored={view.scored ? true : undefined}
              data-path={view.onPath ? true : undefined}
              data-active={active ? true : undefined}
              style={{
                width: box.w,
                height: box.h,
                transform: `translate3d(${box.x}px, ${box.y}px, 0)`,
                "--i": siblingIndex(node),
                "--s": node.score,
                "--n": Math.round(node.score * 100),
                "--p": pathIndex.get(node.id) ?? 0,
              } as CSSProperties}
              onPointerEnter={event => { if (event.pointerType === "mouse") setHoverId(node.id); }}
              onPointerLeave={() => setHoverId(current => (current === node.id ? null : current))}
              onFocus={() => { setFocusId(node.id); setFocusedId(node.id); }}
              onBlur={() => setFocusedId(current => (current === node.id ? null : current))}
            >
              <div className={styles.node}>
                {node.depth === 0 ? <span className={styles.question}>{node.label}</span> : <>
                  <span className={styles.labelRow}>
                    <span className={styles.label}>{node.label}</span>
                    {node.depth === lastDepth && <CircleCheck className={styles.check} size={14} strokeWidth={1.75} aria-hidden="true" />}
                  </span>
                  <span className={styles.score} aria-hidden="true">
                    <span className={styles.track}><span className={styles.fill} /></span>
                    <span className={styles.num} />
                  </span>
                </>}
              </div>
              {active && <span className={styles.tag} data-side={side} data-align={align} aria-hidden="true">
                <span className={styles.tagText}>{node.text}</span>
                <span className={styles.tagMeta}>{describe(node, view)}</span>
              </span>}
            </div>;
          })}
        </div>
      </>}
    </div>

    {controls && <div className={styles.footer} data-frame-keep="">
      <div className={styles.transport} role="group" aria-label="Playback">
        <Tooltip content={running ? "Pause" : atEnd ? "Replay" : "Play"}>
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label={running ? "Pause" : atEnd ? "Replay" : "Play"} onClick={togglePlay}>
            <span className={styles.playIcon} data-playing={running ? true : undefined}>
              <Play size={16} strokeWidth={1.75} aria-hidden="true" />
              <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
          </Button>
        </Tooltip>
        <Tooltip content="Step">
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label="Step" aria-disabled={atEnd || undefined} onClick={stepOnce}>
            <SkipForward size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip content="Restart">
          <Button variant="secondary" size="sm" className={styles.iconButton} aria-label="Restart" onClick={restart}>
            <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>
      <div className={styles.beam}>
        <span className={styles.beamLabel} aria-hidden="true"><span className={styles.beamLong}>Beam width</span><span className={styles.beamShort}>Beam</span></span>
        <SegmentedControl label="Beam width" options={BEAMS.map(value => ({ value: String(value), label: String(value) }))} value={String(beam)} onValueChange={value => changeBeam(Number(value))} />
      </div>
    </div>}

    <span className={styles.srOnly} role="status" aria-live="polite">{live}</span>
  </div></div>;
}

export default ReasoningTree;
