/** Data, beam search and layout for the reasoning tree. Pure functions, no React. */

export interface ReasoningThought {
  /** Stable id. Built from the position in the tree when left out. */
  id?: string;
  /** Short text on the node, about 2 to 4 words. */
  label: string;
  /** The full thought, shown on hover and focus. Defaults to the label. */
  text?: string;
  /** Illustrative score from 0 to 0.99. Drawn from the seed when left out. */
  score?: number;
  /** Next thoughts proposed from this one. The tree is read to a depth of 3. */
  children?: ReasoningThought[];
}

export interface TreeNode {
  id: string;
  label: string;
  text: string;
  score: number;
  depth: number;
  /** Depth first order, used to keep siblings and columns in a stable order. */
  order: number;
  parent: TreeNode | null;
  children: TreeNode[];
}

export interface SearchLevel {
  depth: number;
  /** Every thought proposed at this depth, in tree order. */
  candidates: TreeNode[];
  /** The thoughts that survive: the best `beam` of them, or only the best one at the last depth. */
  kept: TreeNode[];
}

export interface SearchRun {
  beam: number;
  levels: SearchLevel[];
  answer: TreeNode | null;
  /** Root to answer. */
  path: TreeNode[];
  /** Step 0 is the question; every depth then proposes, scores and prunes. */
  finalStep: number;
  candidateIds: Set<string>;
  keptIds: Set<string>;
  pathIds: Set<string>;
}

export const MAX_DEPTH = 3;

export const DEFAULT_QUESTION = "Which release plan ships by Friday?";
export const DEFAULT_QUESTION_DETAIL = "Which release plan gets v2.4 out by Friday, October 23, without putting the billing migration at risk?";

/** Sample planning tree. Scores are illustrative: a greedy search (beam 1) settles for 0.90, a wider beam finds 0.94. */
export const DEFAULT_THOUGHTS: ReasoningThought[] = [
  {
    id: "scope", label: "Cut scope to core", score: 0.82,
    text: "Ship the billing fixes and the new onboarding, and move CSV export to v2.5.",
    children: [
      {
        id: "freeze", label: "Freeze Wednesday", score: 0.86,
        text: "Freeze the release branch Wednesday at 18:00 and give QA all of Thursday.",
        children: [
          { id: "thursday", label: "Ship Thursday", score: 0.9, text: "Tag v2.4 Thursday at 14:00 and keep Friday free for hotfixes." },
          { id: "friday-am", label: "Ship Friday 09:00", score: 0.71, text: "Tag v2.4 Friday at 09:00 after one more QA pass, with no buffer left." },
        ],
      },
      {
        id: "skip-qa", label: "Skip manual QA", score: 0.31,
        text: "Skip manual QA and rely on the automated suite, which covers about 70% of billing.",
        children: [
          { id: "wednesday", label: "Ship Wednesday", score: 0.27, text: "Tag v2.4 Wednesday night and watch error rates through Thursday." },
          { id: "patch", label: "Patch forward", score: 0.22, text: "Ship Thursday and patch anything manual QA would have caught next week." },
        ],
      },
    ],
  },
  {
    id: "staff", label: "Add two engineers", score: 0.38,
    text: "Borrow two engineers from the mobile team to finish every planned feature on time.",
    children: [
      {
        id: "onboard", label: "Onboard on Monday", score: 0.34,
        text: "Spend Monday walking the two engineers through the billing code before they pick up tickets.",
        children: [
          { id: "friday-pm", label: "Ship Friday 17:00", score: 0.3, text: "Ship Friday at 17:00 once the new engineers have closed their tickets." },
          { id: "monday", label: "Slip to Monday", score: 0.41, text: "Accept a Monday release so onboarding does not squeeze QA." },
        ],
      },
      {
        id: "pair", label: "Pair on CSV export", score: 0.49,
        text: "Pair the new engineers on CSV export while the core team finishes the rest.",
        children: [
          { id: "export-thu", label: "Export by Thursday", score: 0.52, text: "Merge CSV export Thursday and ship everything Friday at noon." },
          { id: "drop-export", label: "Drop export if late", score: 0.58, text: "Ship Friday and drop CSV export if the pair has not merged it by Thursday." },
        ],
      },
    ],
  },
  {
    id: "flags", label: "Flag risky features", score: 0.74,
    text: "Ship everything, but keep CSV export and the new editor behind feature flags.",
    children: [
      {
        id: "flags-off", label: "Flags off in prod", score: 0.66,
        text: "Merge both features with their flags off in production and on in staging.",
        children: [
          { id: "next-week", label: "Flags on next week", score: 0.76, text: "Ship Thursday with both flags off and turn them on next week." },
          { id: "staff-first", label: "Staff only first", score: 0.81, text: "Ship Thursday and turn both flags on for internal workspaces only." },
        ],
      },
      {
        id: "rollout", label: "Stage the rollout", score: 0.79,
        text: "Turn the flags on for 10% of workspaces Thursday and for everyone Friday morning.",
        children: [
          { id: "ramp", label: "10% first, all Friday", score: 0.94, text: "Ship Thursday with the flags on for 10% of workspaces, then turn them on for everyone Friday at 10:00 if error rates hold." },
          { id: "rollback", label: "Roll back on errors", score: 0.87, text: "Ship Thursday at 10% and roll the flags back automatically if checkout errors rise above 0.5%." },
        ],
      },
    ],
  },
];

function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** A score in 0.18 to 0.94 that depends only on the seed and the thought, so a tree always scores the same way. */
export function seededScore(seed: number, key: string) {
  let t = (hash(`${seed}:${key}`) + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const unit = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return Math.round((0.18 + unit * 0.76) * 100) / 100;
}

const clampScore = (value: number) => Math.round(Math.min(0.99, Math.max(0, value)) * 100) / 100;

export function buildTree(question: string, detail: string, thoughts: ReasoningThought[], seed: number) {
  let order = 0;
  const used = new Set<string>();
  const all: TreeNode[] = [];
  const root: TreeNode = { id: "root", label: question, text: detail, score: 1, depth: 0, order: order++, parent: null, children: [] };
  used.add(root.id);
  all.push(root);
  const walk = (items: ReasoningThought[], parent: TreeNode, path: string) => {
    if (parent.depth >= MAX_DEPTH) return;
    items.forEach((item, index) => {
      const key = `${path}${index}`;
      let id = item.id ?? `t${key}`;
      while (used.has(id)) id = `${id}-${key}`;
      used.add(id);
      const node: TreeNode = {
        id,
        label: item.label,
        text: item.text ?? item.label,
        score: clampScore(item.score ?? seededScore(seed, `${key}:${item.label}`)),
        depth: parent.depth + 1,
        order: order++,
        parent,
        children: [],
      };
      parent.children.push(node);
      all.push(node);
      if (item.children?.length) walk(item.children, node, `${key}.`);
    });
  };
  walk(thoughts, root, "");
  return { root, all };
}

const byScore = (a: TreeNode, b: TreeNode) => b.score - a.score || a.order - b.order;
const byOrder = (a: TreeNode, b: TreeNode) => a.order - b.order;

/** Beam search: each depth proposes the children of the surviving thoughts, keeps the best `beam`, and the last depth keeps one answer. */
export function runSearch(root: TreeNode, beam: number): SearchRun {
  const levels: SearchLevel[] = [];
  let frontier: TreeNode[] = [root];
  for (let depth = 1; depth <= MAX_DEPTH; depth++) {
    const candidates = frontier.flatMap(node => node.children).sort(byOrder);
    if (!candidates.length) break;
    const deeper = candidates.some(node => node.children.length > 0);
    const last = depth === MAX_DEPTH || !deeper;
    const kept = [...candidates].sort(byScore).slice(0, last ? 1 : beam).sort(byOrder);
    levels.push({ depth, candidates, kept });
    frontier = kept;
    if (last) break;
  }
  const answer = levels.length ? levels[levels.length - 1].kept[0] ?? null : null;
  const path: TreeNode[] = [];
  for (let node = answer; node; node = node.parent) path.unshift(node);
  return {
    beam,
    levels,
    answer,
    path,
    finalStep: levels.length * 3,
    candidateIds: new Set(levels.flatMap(level => level.candidates.map(node => node.id))),
    keptIds: new Set(levels.flatMap(level => level.kept.map(node => node.id))),
    pathIds: new Set(path.map(node => node.id)),
  };
}

export type Phase = "question" | "propose" | "score" | "prune" | "answer";

/** What a step does: step 0 shows the question, then each depth takes three steps. The last prune picks the answer. */
export function phaseOf(run: SearchRun, step: number): { phase: Phase; depth: number } {
  if (step <= 0 || !run.levels.length) return { phase: step > 0 ? "answer" : "question", depth: 0 };
  if (step >= run.finalStep) return { phase: "answer", depth: run.levels.length };
  const depth = Math.floor((step - 1) / 3) + 1;
  const kind = (step - 1) % 3;
  return { phase: kind === 0 ? "propose" : kind === 1 ? "score" : "prune", depth };
}

export type NodeStatus = "hidden" | "root" | "candidate" | "kept" | "pruned" | "answer";

export interface NodeView {
  status: NodeStatus;
  shown: boolean;
  scored: boolean;
  onPath: boolean;
}

export function viewOf(run: SearchRun, node: TreeNode, step: number): NodeView {
  const final = step >= run.finalStep && !!run.answer;
  if (node.depth === 0) return { status: "root", shown: true, scored: false, onPath: final };
  if (!run.candidateIds.has(node.id) || step < 3 * (node.depth - 1) + 1) return { status: "hidden", shown: false, scored: false, onPath: false };
  const scored = step >= 3 * (node.depth - 1) + 2;
  const decided = step >= 3 * node.depth;
  const kept = run.keptIds.has(node.id);
  const onPath = final && run.pathIds.has(node.id);
  const status: NodeStatus = !decided ? "candidate" : !kept ? "pruned" : final && node === run.answer ? "answer" : "kept";
  return { status, shown: true, scored, onPath };
}

/* Layout ------------------------------------------------------------------------------------------------------- */

export interface Box { x: number; y: number; w: number; h: number }

export interface TreeLayout {
  mode: "wide" | "narrow";
  width: number;
  height: number;
  boxes: Map<string, Box>;
  /** Column headers on the wide layout: x, width and depth. */
  columns: { x: number; w: number; depth: number }[];
}

/** The stage switches from columns to an indented outline below this width. */
export const WIDE_MIN = 620;
export const WIDE = { head: 30, node: 54, gap: 8, root: 84 } as const;
export const NARROW = { node: 44, gap: 6, root: 62, indent: 16, rail: 9, corner: 4 } as const;

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;

/**
 * Places values in order, at least one apart, as close as possible to their ideal positions, within lo to hi.
 * Neighbours that would overlap merge into a block that sits at the mean of its members' ideals.
 */
export function pack(ideals: number[], lo: number, hi: number) {
  const top = Math.max(hi, lo + ideals.length - 1);
  type Block = { n: number; sum: number; start: number };
  const blocks: Block[] = [];
  const place = (block: Block) => { block.start = clamp(block.sum / block.n, lo, top - block.n + 1); return block; };
  for (const ideal of ideals) {
    let block = place({ n: 1, sum: ideal, start: 0 });
    while (blocks.length) {
      const previous = blocks[blocks.length - 1];
      if (previous.start + previous.n <= block.start + 1e-6) break;
      blocks.pop();
      block = place({ n: previous.n + block.n, sum: previous.sum + block.sum - block.n * previous.n, start: 0 });
    }
    blocks.push(block);
  }
  return blocks.flatMap(block => Array.from({ length: block.n }, (_, k) => block.start + k));
}

/** The most thoughts any one depth shows, across beam widths 1 to 3, so the wide stage never changes height. */
export function reservedRows(runs: SearchRun[]) {
  return Math.max(3, ...runs.flatMap(run => run.levels.map(level => level.candidates.length)));
}

export function wideLayout(root: TreeNode, all: TreeNode[], run: SearchRun, width: number, rows: number): TreeLayout {
  const depthCount = Math.max(1, run.levels.length);
  const gap = clamp(width * 0.045, 24, 40);
  const rootW = clamp(width * 0.19, 112, 148);
  const colW = Math.min(240, (width - rootW - depthCount * gap) / depthCount);
  const columns = [{ x: 0, w: rootW, depth: 0 }];
  for (let d = 1; d <= depthCount; d++) columns.push({ x: rootW + gap + (d - 1) * (colW + gap), w: colW, depth: d });

  const levelNodes = run.levels.map(level => level.candidates);
  const shownKids = (node: TreeNode) => {
    const next = levelNodes[node.depth];
    return next ? node.children.filter(child => run.candidateIds.has(child.id)) : [];
  };
  const row = new Map<string, number>();
  row.set(root.id, (rows - 1) / 2);
  const centered = (node: TreeNode) => {
    const parent = node.parent ?? root;
    const siblings = shownKids(parent);
    return (row.get(parent.id) ?? 0) + siblings.indexOf(node) - (siblings.length - 1) / 2;
  };
  const apply = (nodes: TreeNode[], ideals: number[]) => pack(ideals, 0, rows - 1).forEach((value, i) => row.set(nodes[i].id, value));

  levelNodes.forEach(nodes => apply(nodes, nodes.map(centered)));
  for (let pass = 0; pass < 3; pass++) {
    for (let d = levelNodes.length - 2; d >= 0; d--) {
      const nodes = levelNodes[d];
      apply(nodes, nodes.map(node => {
        const kids = shownKids(node);
        return kids.length ? mean(kids.map(kid => row.get(kid.id) ?? 0)) : row.get(node.id) ?? 0;
      }));
    }
    if (levelNodes[0]?.length) row.set(root.id, clamp(mean(levelNodes[0].map(node => row.get(node.id) ?? 0)), 0, rows - 1));
    levelNodes.forEach(nodes => apply(nodes, nodes.map(node => (shownKids(node).length ? row.get(node.id) ?? 0 : centered(node)))));
  }

  const unit = WIDE.node + WIDE.gap;
  const treeH = rows * unit - WIDE.gap;
  const boxes = new Map<string, Box>();
  const rootRow = row.get(root.id) ?? 0;
  const rootY = clamp(WIDE.head + rootRow * unit + WIDE.node / 2 - WIDE.root / 2, WIDE.head, WIDE.head + treeH - WIDE.root);
  boxes.set(root.id, { x: 0, y: rootY, w: rootW, h: WIDE.root });
  for (const node of all) {
    if (node.depth === 0) continue;
    const column = columns[Math.min(node.depth, columns.length - 1)];
    const r = row.get(node.id) ?? (node.parent ? row.get(node.parent.id) : undefined) ?? rootRow;
    boxes.set(node.id, { x: column.x, y: WIDE.head + r * unit, w: column.w, h: WIDE.node });
  }
  return { mode: "wide", width, height: WIDE.head + treeH, boxes, columns };
}

/** Depth first, so children sit under their parent with an indent. Only the shown thoughts take a row. */
export function narrowLayout(root: TreeNode, all: TreeNode[], shown: (node: TreeNode) => boolean, reserve: (node: TreeNode) => boolean, width: number): TreeLayout {
  const boxes = new Map<string, Box>();
  const place = (include: (node: TreeNode) => boolean, write: boolean) => {
    let y = 0;
    const visit = (node: TreeNode) => {
      if (node.depth > 0 && !include(node)) return;
      const h = node.depth === 0 ? NARROW.root : NARROW.node;
      const x = node.depth * NARROW.indent;
      if (write) boxes.set(node.id, { x, y, w: Math.max(120, width - x), h });
      y += h + NARROW.gap;
      node.children.forEach(visit);
    };
    visit(root);
    return Math.max(0, y - NARROW.gap);
  };
  const height = place(reserve, false);
  place(shown, true);
  /** Thoughts that are not shown yet wait under their parent, where they will appear. */
  for (const node of all) {
    if (boxes.has(node.id)) continue;
    const parent = node.parent ? boxes.get(node.parent.id) : undefined;
    const x = node.depth * NARROW.indent;
    boxes.set(node.id, { x, y: parent ? parent.y + parent.h + NARROW.gap : 0, w: Math.max(120, width - x), h: NARROW.node });
  }
  return { mode: "narrow", width, height, boxes, columns: [] };
}

/* Edges ------------------------------------------------------------------------------------------------------- */

const f = (value: number) => Math.round(value * 10) / 10;

export function edgePath(mode: TreeLayout["mode"], parent: Box, child: Box) {
  if (mode === "wide") {
    const x1 = parent.x + parent.w, y1 = parent.y + parent.h / 2, x2 = child.x, y2 = child.y + child.h / 2, mx = (x1 + x2) / 2;
    return `M${f(x1)} ${f(y1)}C${f(mx)} ${f(y1)} ${f(mx)} ${f(y2)} ${f(x2)} ${f(y2)}`;
  }
  const rail = parent.x + NARROW.rail, top = parent.y + parent.h, cy = child.y + child.h / 2, r = NARROW.corner;
  return `M${f(rail)} ${f(top)}V${f(cy - r)}Q${f(rail)} ${f(cy)} ${f(rail + r)} ${f(cy)}H${f(child.x)}`;
}

/** One continuous line from the question to the answer. Its stretches inside the opaque nodes stay hidden under them. */
export function pathThrough(mode: TreeLayout["mode"], boxes: Box[]) {
  if (boxes.length < 2) return "";
  if (mode === "wide") {
    let d = `M${f(boxes[0].x + boxes[0].w)} ${f(boxes[0].y + boxes[0].h / 2)}`;
    for (let i = 1; i < boxes.length; i++) {
      const a = boxes[i - 1], b = boxes[i];
      const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2, mx = (x1 + x2) / 2;
      d += `C${f(mx)} ${f(y1)} ${f(mx)} ${f(y2)} ${f(x2)} ${f(y2)}`;
      if (i < boxes.length - 1) d += `H${f(b.x + b.w)}`;
    }
    return d;
  }
  const r = NARROW.corner;
  let d = `M${f(boxes[0].x + NARROW.rail)} ${f(boxes[0].y + boxes[0].h)}`;
  for (let i = 1; i < boxes.length; i++) {
    const a = boxes[i - 1], b = boxes[i];
    const rail = a.x + NARROW.rail, cy = b.y + b.h / 2;
    if (i > 1) d += `H${f(rail)}V${f(a.y + a.h)}`;
    d += `V${f(cy - r)}Q${f(rail)} ${f(cy)} ${f(rail + r)} ${f(cy)}H${f(b.x)}`;
  }
  return d;
}
