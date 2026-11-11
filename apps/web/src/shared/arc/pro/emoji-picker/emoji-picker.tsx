"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Clock, Coffee, Flag, Lightbulb, PawPrint, Plane, Search, Shapes, Smile, Volleyball, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { emojiCategoryData } from "./emoji-data";
import styles from "./emoji-picker.module.css";

/**
 * A full emoji picker for composers, comments, and status fields. Search filters every emoji as you type, the category bar follows your
 * scroll, skin tones apply across the set, and recently used emoji are remembered on the device. The grid is virtualized, so the whole
 * Unicode set scrolls smoothly, and it is fully usable from the keyboard.
 */

export type SkinTone = 0 | 1 | 2 | 3 | 4 | 5;

export interface EmojiSelection {
  /** The emoji to insert, with the skin tone applied when the emoji supports one. */
  emoji: string;
  /** The emoji without a skin tone. */
  base: string;
  /** Its name in sentence case, such as "Waving hand". */
  name: string;
  /** The skin tone that was applied, 0 when none. */
  skinTone: SkinTone;
}

export interface EmojiPickerProps {
  /** Called when an emoji is chosen by click, Enter, or Space. The event tells you whether Shift was held, for example to keep a popover open. */
  onSelect?: (selection: EmojiSelection, event: ReactMouseEvent | ReactKeyboardEvent) => void;
  /** Controlled skin tone: 0 is the default yellow, 1 to 5 are light to dark. */
  skinTone?: SkinTone;
  defaultSkinTone?: SkinTone;
  onSkinToneChange?: (tone: SkinTone) => void;
  /** Where recent emoji and the skin tone are remembered in localStorage. Pass null to keep them in memory for this page only. */
  storageKey?: string | null;
  /** How many recently used emoji to keep. */
  recentLimit?: number;
  /** Shown in the recent section before anything has been picked. */
  defaultRecent?: string[];
  /** Emoji per row. Defaults to as many 36px cells as fit. */
  columns?: number;
  /** Moves focus to the search field when the picker mounts. Popovers and dialogs usually do this already. */
  autoFocus?: boolean;
  /** Placeholder of the search field. */
  searchPlaceholder?: string;
  /** Accessible name of the picker. */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

interface Emoji { emoji: string; name: string; label: string; keywords: string[]; search: string; tones?: number[]; order: number }
interface Section { id: string; label: string; emojis: Emoji[] }
type Row =
  | { kind: "header"; section: number; label: string; top: number; height: number }
  | { kind: "emojis"; section: number; items: Emoji[]; first: number; top: number; height: number };

const TONE_MODIFIERS = ["", "\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"];
const TONE_NAMES = ["Default", "Light", "Medium light", "Medium", "Medium dark", "Dark"];
const HEADER_HEIGHT = 30;
const MIN_CELL = 36;
const OVERSCAN = 160;
const POPULAR = ["👍", "❤️", "😂", "🎉", "🙏", "🔥", "😊", "👀", "✅", "🙌", "💯", "😍", "🤔", "👏", "🚀", "😅", "🥳", "👋"];
const CATEGORY_ICONS: Record<string, LucideIcon> = { recent: Clock, people: Smile, nature: PawPrint, food: Coffee, activity: Volleyball, travel: Plane, objects: Lightbulb, symbols: Shapes, flags: Flag };

/* ---------- Data ---------- */

let dataset: { categories: Section[]; byEmoji: Map<string, Emoji>; all: Emoji[] } | null = null;
/** Parsed once, on first use, from the compact strings in emoji-data.ts. */
function getDataset() {
  if (dataset) return dataset;
  const byEmoji = new Map<string, Emoji>();
  const all: Emoji[] = [];
  const categories = emojiCategoryData.map(category => ({
    id: category.id,
    label: category.label,
    emojis: category.data.split("|").map(entry => {
      const [emoji, name, keywords = "", tones = ""] = entry.split("~");
      const item: Emoji = {
        emoji,
        name,
        label: name.charAt(0).toUpperCase() + name.slice(1),
        keywords: keywords ? keywords.split(",") : [],
        search: `${name.toLowerCase()} ${keywords.replaceAll(",", " ")}`,
        tones: tones ? tones.split(".").map(Number) : undefined,
        order: all.length,
      };
      all.push(item);
      byEmoji.set(emoji, item);
      byEmoji.set(emoji.replaceAll("️", ""), item);
      return item;
    }),
  }));
  dataset = { categories, byEmoji, all };
  return dataset;
}

/** Inserts the tone modifier after each code point that takes one, dropping a variation selector that would follow it. */
function applyTone(item: Emoji, tone: SkinTone) {
  if (!tone || !item.tones) return item.emoji;
  const points = Array.from(item.emoji);
  let out = "";
  for (let index = 0; index < points.length; index++) {
    out += points[index];
    if (item.tones.includes(index)) { out += TONE_MODIFIERS[tone]; if (points[index + 1] === "️") index++; }
  }
  return out;
}

/** Every word of the query must match the name or a keyword. Names that start with the query rank first, then word starts, then the rest. */
function searchEmoji(all: Emoji[], query: string) {
  const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const whole = terms.join(" ");
  const scored: { item: Emoji; score: number }[] = [];
  for (const item of all) {
    if (!terms.every(term => item.search.includes(term))) continue;
    const name = item.name.toLowerCase();
    const score = name === whole ? 0
      : name.startsWith(whole) ? 1
      : name.includes(` ${whole}`) ? 2
      : item.keywords.some(word => word.startsWith(whole)) ? 3
      : name.includes(whole) ? 4 : 5;
    scored.push({ item, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.item.order - b.item.order).map(entry => entry.item);
}

/* ---------- Storage: localStorage when it works, memory when it does not ---------- */

const memoryStore = new Map<string, string>();
const storeListeners = new Set<() => void>();
const MEMORY_KEY = "\u0000arc-emoji-picker";
function readStore(key: string) {
  if (key !== MEMORY_KEY) { try { const value = window.localStorage.getItem(key); if (value !== null) return value; } catch { /* Private mode or blocked storage: fall back to memory. */ } }
  return memoryStore.get(key) ?? null;
}
function writeStore(key: string, value: string) {
  memoryStore.set(key, value);
  if (key !== MEMORY_KEY) { try { window.localStorage.setItem(key, value); } catch { /* Keep the in-memory copy. */ } }
  storeListeners.forEach(listener => listener());
}
function subscribeStore(listener: () => void) {
  storeListeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { storeListeners.delete(listener); window.removeEventListener("storage", listener); };
}
interface Stored { recent: string[]; tone: SkinTone }
function parseStored(raw: string | null): Stored {
  try {
    const value = raw ? JSON.parse(raw) as Partial<Stored> : {};
    const recent = Array.isArray(value.recent) ? value.recent.filter((item): item is string => typeof item === "string") : [];
    const tone = typeof value.tone === "number" && value.tone >= 0 && value.tone <= 5 ? value.tone as SkinTone : 0;
    return { recent, tone };
  } catch { return { recent: [], tone: 0 }; }
}

function ToneHand({ value }: { value: SkinTone }) {
  return <span className={styles.emojiGlyph}>{`✋${TONE_MODIFIERS[value]}`}</span>;
}

const noop = () => () => {};
function useReduced() {
  const hydrated = useSyncExternalStore(noop, () => true, () => false);
  const reduced = useReducedMotion() ?? false;
  return hydrated && reduced;
}

/* ---------- Component ---------- */

export function EmojiPicker({ onSelect, skinTone: toneProp, defaultSkinTone, onSkinToneChange, storageKey = "arc-emoji-picker", recentLimit = 27, defaultRecent = POPULAR, columns: columnsProp, autoFocus = false, searchPlaceholder = "Search emoji", label = "Emoji picker", className, style }: EmojiPickerProps) {
  const id = useId();
  const reduced = useReduced();
  const data = getDataset();
  const key = storageKey ?? MEMORY_KEY;
  const raw = useSyncExternalStore(subscribeStore, () => readStore(key), () => null);
  const stored = useMemo(() => parseStored(raw), [raw]);
  const tone: SkinTone = toneProp ?? (raw === null && defaultSkinTone !== undefined ? defaultSkinTone : stored.tone);

  const [query, setQuery] = useState("");
  const [active, setActive] = useState<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [size, setSize] = useState({ width: 336, height: 280 });
  const [pendingSection, setPendingSection] = useState<number | null>(null);
  const [toneOpen, setToneOpen] = useState(false);
  const [gridFocused, setGridFocused] = useState(false);

  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const toneButton = useRef<HTMLButtonElement>(null);
  const toneGroup = useRef<HTMLDivElement>(null);
  const jumpAfterRender = useRef<number | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);

  /* Sections: recent plus the eight categories, or a single list of results while searching. */
  const recentItems = useMemo(() => {
    const source = stored.recent.length ? stored.recent : defaultRecent;
    return source.map(emoji => data.byEmoji.get(emoji) ?? data.byEmoji.get(emoji.replaceAll("️", ""))).filter((item): item is Emoji => !!item);
  }, [stored.recent, defaultRecent, data]);
  const recentLabel = stored.recent.length ? "Recently used" : "Popular";
  const browseSections = useMemo<Section[]>(() => [{ id: "recent", label: recentLabel, emojis: recentItems }, ...data.categories], [recentItems, recentLabel, data]);
  const searching = query.trim().length > 0;
  const results = useMemo(() => searching ? searchEmoji(data.all, query) : [], [searching, query, data]);
  const sections = useMemo<Section[]>(() => searching ? (results.length ? [{ id: "results", label: "Search results", emojis: results }] : []) : browseSections, [searching, results, browseSections]);

  /* Layout: rows of equal cells, with a short header above each section. */
  const columns = Math.max(1, columnsProp ?? Math.max(6, Math.floor(size.width / MIN_CELL)));
  const cell = size.width / columns;
  const { rows, flat, total } = useMemo(() => {
    const rows: Row[] = [];
    const flat: { item: Emoji; row: number; col: number }[] = [];
    let top = 0;
    sections.forEach((section, sectionIndex) => {
      rows.push({ kind: "header", section: sectionIndex, label: section.label, top, height: HEADER_HEIGHT });
      top += HEADER_HEIGHT;
      for (let start = 0; start < section.emojis.length; start += columns) {
        const items = section.emojis.slice(start, start + columns);
        const rowIndex = rows.length;
        rows.push({ kind: "emojis", section: sectionIndex, items, first: flat.length, top, height: cell });
        items.forEach((item, col) => flat.push({ item, row: rowIndex, col }));
        top += cell;
      }
    });
    return { rows, flat, total: top + 8 };
  }, [sections, columns, cell]);
  const sectionTops = useMemo(() => rows.filter(row => row.kind === "header").map(row => row.top), [rows]);

  /* Measure the grid area. */
  useLayoutEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const measure = () => {
      const styles = getComputedStyle(node);
      const width = node.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      setSize(current => current.width === width && current.height === node.clientHeight ? current : { width, height: node.clientHeight });
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { if (autoFocus) input.current?.focus({ preventScroll: true }); }, [autoFocus]);

  /* A new query starts from the top with the best match ready for Enter. */
  const changeQuery = (value: string) => {
    setQuery(value);
    if (scroller.current) scroller.current.scrollTop = 0;
    setScrollTop(0);
    setActive(value.trim() ? 0 : null);
  };

  /* The category under the top edge, unless a tab jump is still scrolling there. */
  const scrolledSection = useMemo(() => {
    if (searching || !sectionTops.length) return -1;
    if (scrollTop + size.height >= total - 4) return sectionTops.length - 1;
    let current = 0;
    for (let index = 0; index < sectionTops.length; index++) if (sectionTops[index] <= scrollTop + 12) current = index;
    return current;
  }, [searching, sectionTops, scrollTop, size.height, total]);
  const currentSection = pendingSection ?? scrolledSection;

  const scrollToSection = useCallback((index: number) => {
    const node = scroller.current;
    if (!node) return;
    const top = Math.min(sectionTops[index] ?? 0, Math.max(0, total - node.clientHeight));
    setPendingSection(index);
    window.clearTimeout(settleTimer.current);
    // The indicator goes straight to the chosen tab and waits there while the list scrolls to it.
    settleTimer.current = window.setTimeout(() => setPendingSection(null), reduced ? 50 : 1600);
    node.scrollTo({ top, behavior: reduced ? "auto" : "smooth" });
  }, [sectionTops, total, reduced]);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  /* After a tab clears the search, jump once the category rows exist again. */
  useLayoutEffect(() => {
    if (jumpAfterRender.current === null || searching) return;
    const target = jumpAfterRender.current;
    jumpAfterRender.current = null;
    scrollToSection(target);
  }, [searching, scrollToSection]);

  const onTab = (index: number) => {
    setActive(null);
    if (searching) { jumpAfterRender.current = index; changeQuery(""); return; }
    scrollToSection(index);
  };

  /* Selection */
  const choose = (item: Emoji, event: ReactMouseEvent | ReactKeyboardEvent) => {
    const recent = [item.emoji, ...stored.recent.filter(emoji => emoji !== item.emoji)].slice(0, recentLimit);
    writeStore(key, JSON.stringify({ recent, tone: stored.tone }));
    onSelect?.({ emoji: applyTone(item, tone), base: item.emoji, name: item.label, skinTone: item.tones ? tone : 0 }, event);
  };
  const setTone = (next: SkinTone) => {
    if (toneProp === undefined) writeStore(key, JSON.stringify({ recent: stored.recent, tone: next }));
    onSkinToneChange?.(next);
  };

  /* Keyboard */
  const reveal = useCallback((index: number) => {
    const node = scroller.current, target = flat[index];
    if (!node || !target) return;
    const row = rows[target.row];
    // Keep the section header in view when moving onto a section's first row.
    const top = rows[target.row - 1]?.kind === "header" ? row.top - HEADER_HEIGHT : row.top;
    if (top < node.scrollTop) node.scrollTop = top;
    else if (row.top + row.height > node.scrollTop + node.clientHeight) node.scrollTop = row.top + row.height - node.clientHeight + 4;
  }, [flat, rows]);
  const move = (index: number) => { const next = Math.min(Math.max(index, 0), flat.length - 1); setActive(next); reveal(next); };
  const verticalTarget = (from: number, direction: 1 | -1) => {
    const origin = flat[from];
    for (let rowIndex = origin.row + direction; rowIndex >= 0 && rowIndex < rows.length; rowIndex += direction) {
      const row = rows[rowIndex];
      if (row.kind === "emojis") return row.first + Math.min(origin.col, row.items.length - 1);
    }
    return null;
  };

  const onGridKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!flat.length) return;
    const current = active ?? 0;
    const pageRows = Math.max(1, Math.floor(size.height / cell) - 1);
    const handled = () => event.preventDefault();
    switch (event.key) {
      case "ArrowRight": handled(); move(active === null ? 0 : current + 1); return;
      case "ArrowLeft": handled(); move(active === null ? 0 : current - 1); return;
      case "ArrowDown": { handled(); if (active === null) return move(0); const next = verticalTarget(current, 1); if (next !== null) move(next); return; }
      case "ArrowUp": { handled(); const next = active === null ? null : verticalTarget(current, -1); if (next === null) { input.current?.focus(); } else move(next); return; }
      case "PageDown": case "PageUp": {
        handled();
        let next: number | null = current;
        for (let step = 0; step < pageRows; step++) { const candidate = verticalTarget(next, event.key === "PageDown" ? 1 : -1); if (candidate === null) break; next = candidate; }
        move(next);
        return;
      }
      case "Home": { handled(); if (event.ctrlKey || event.metaKey) return move(0); const row = rows[flat[current].row]; if (row.kind === "emojis") move(row.first); return; }
      case "End": { handled(); if (event.ctrlKey || event.metaKey) return move(flat.length - 1); const row = rows[flat[current].row]; if (row.kind === "emojis") move(row.first + row.items.length - 1); return; }
      case "Enter": case " ": handled(); if (active !== null && flat[active]) choose(flat[active].item, event); return;
    }
    // Typing while the grid has focus goes straight to the search field.
    if ((event.key.length === 1 || event.key === "Backspace") && !event.ctrlKey && !event.metaKey && !event.altKey) input.current?.focus();
  };

  const onInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!flat.length) return;
      if (active === null) move(0);
      scroller.current?.focus({ preventScroll: true });
    } else if (event.key === "Enter") {
      if (active !== null && flat[active]) { event.preventDefault(); choose(flat[active].item, event); }
    }
  };

  /* Escape closes the skin tone menu, then clears the search, and only then reaches a surrounding popover or dialog.
     This runs in the capture phase on window, ahead of the document listener a Radix layer uses, and marks the event handled. */
  const escapeState = useRef({ toneOpen, searching, clear: () => {} });
  useEffect(() => { escapeState.current = { toneOpen, searching, clear: () => changeQuery("") }; });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !root.current?.contains(document.activeElement)) return;
      const state = escapeState.current;
      if (state.toneOpen) { event.preventDefault(); setToneOpen(false); toneButton.current?.focus(); }
      else if (state.searching) { event.preventDefault(); state.clear(); input.current?.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  /* Skin tone menu: focus the chosen tone on open; close when focus leaves it. */
  useEffect(() => {
    if (!toneOpen) return;
    const radio = toneGroup.current?.querySelector<HTMLButtonElement>("[aria-checked='true']");
    radio?.focus({ preventScroll: true });
  }, [toneOpen]);
  const onToneKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const radios = Array.from(toneGroup.current?.querySelectorAll<HTMLButtonElement>("[role='radio']") ?? []);
    const index = radios.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (step) { event.preventDefault(); radios[(index + step + radios.length) % radios.length]?.focus(); }
    else if (event.key === "Home" || event.key === "End") { event.preventDefault(); radios[event.key === "Home" ? 0 : radios.length - 1]?.focus(); }
    else if (event.key === "Tab") setToneOpen(false);
  };

  /* Virtual window: the rows that intersect the viewport, plus the active row so aria-activedescendant always points at a real element. */
  const visible = useMemo(() => {
    const from = scrollTop - OVERSCAN, to = scrollTop + size.height + OVERSCAN;
    const out: number[] = [];
    let low = 0, high = rows.length - 1, start = rows.length;
    while (low <= high) { const mid = (low + high) >> 1; if (rows[mid].top + rows[mid].height >= from) { start = mid; high = mid - 1; } else low = mid + 1; }
    for (let index = start; index < rows.length && rows[index].top <= to; index++) out.push(index);
    const activeRow = active !== null ? flat[active]?.row : undefined;
    if (activeRow !== undefined && !out.includes(activeRow)) out.push(activeRow);
    return out;
  }, [rows, scrollTop, size.height, active, flat]);

  const activeItem = active !== null ? flat[active]?.item : undefined;
  const cellId = (index: number) => `${id}-cell-${index}`;
  const activeId = activeItem && active !== null ? cellId(active) : undefined;

  return <div ref={root} className={[styles.picker, className].filter(Boolean).join(" ")} style={{ ...style, "--emoji-cell": `${cell}px` } as CSSProperties} role="group" aria-label={label}>
    <div className={styles.header}>
      <label className={styles.search}>
        <Search className={styles.searchIcon} width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
        <input
          ref={input}
          type="text"
          role="searchbox"
          value={query}
          onChange={event => changeQuery(event.target.value)}
          onKeyDown={onInputKeyDown}
          placeholder={searchPlaceholder}
          aria-label="Search emoji"
          aria-controls={`${id}-grid`}
          aria-activedescendant={searching ? activeId : undefined}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="done"
        />
        {query && <button type="button" className={styles.clear} onClick={() => { changeQuery(""); input.current?.focus(); }} aria-label="Clear search"><X width={14} height={14} strokeWidth={1.75} aria-hidden="true" /></button>}
      </label>
      <button ref={toneButton} type="button" className={styles.toneButton} onClick={() => setToneOpen(true)} aria-haspopup="true" aria-expanded={toneOpen} aria-label={`Skin tone: ${TONE_NAMES[tone]}`}>
        <ToneHand value={tone} />
      </button>
      {/* The row unrolls leftward out of the tone button it covers, and rolls back into it. It stays mounted so the reveal can reverse mid-way. */}
      <div ref={toneGroup} className={styles.tones} data-open={toneOpen || undefined} role="radiogroup" aria-label="Skin tone" onKeyDown={onToneKeyDown}
        onBlur={event => { if (toneOpen && !event.currentTarget.contains(event.relatedTarget as Node | null)) setToneOpen(false); }}>
        {TONE_NAMES.map((name, value) => <button
          key={name}
          type="button"
          role="radio"
          aria-checked={tone === value}
          aria-label={name}
          tabIndex={tone === value ? 0 : -1}
          className={styles.tone}
          onClick={() => { setTone(value as SkinTone); setToneOpen(false); toneButton.current?.focus(); }}
        >
          <ToneHand value={value as SkinTone} />
        </button>)}
      </div>
    </div>

    <div className={styles.tabs} role="toolbar" aria-label="Categories" style={{ "--emoji-tabs": browseSections.length } as CSSProperties}
      onKeyDown={event => {
        const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (!step || index < 0) return;
        event.preventDefault();
        buttons[(index + step + buttons.length) % buttons.length]?.focus();
      }}>
      {browseSections.map((section, index) => {
        const Icon = CATEGORY_ICONS[section.id] ?? Smile;
        const isCurrent = currentSection === index;
        return <button key={section.id} type="button" className={styles.tab} data-current={isCurrent || undefined} aria-current={isCurrent || undefined} aria-label={section.label}
          tabIndex={index === Math.max(currentSection, 0) ? 0 : -1} onClick={() => onTab(index)}>
          <Icon width={16} height={16} strokeWidth={1.75} aria-hidden="true" />
        </button>;
      })}
      <motion.span className={styles.indicator} aria-hidden="true" initial={false}
        animate={{ x: `${Math.max(currentSection, 0) * 100}%`, opacity: currentSection < 0 ? 0 : 1 }}
        transition={reduced ? { duration: 0 } : { x: motionTokens.spring.morph, opacity: { duration: motionTokens.duration.fast } }} />
    </div>

    <div
      ref={scroller}
      id={`${id}-grid`}
      className={styles.scroller}
      role="grid"
      aria-label={searching ? "Search results" : "Emoji"}
      aria-rowcount={rows.length}
      aria-colcount={columns}
      aria-activedescendant={gridFocused ? activeId : undefined}
      tabIndex={flat.length ? 0 : -1}
      onKeyDown={onGridKeyDown}
      onFocus={event => { if (event.target === event.currentTarget) { setGridFocused(true); if (active === null && flat.length) setActive(0); } }}
      onBlur={event => { if (event.target === event.currentTarget) setGridFocused(false); }}
      onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
      onScrollEnd={() => { if (pendingSection !== null) { window.clearTimeout(settleTimer.current); setPendingSection(null); } }}
      onWheel={() => { if (pendingSection !== null) setPendingSection(null); }}
      onTouchStart={() => { if (pendingSection !== null) setPendingSection(null); }}
      onPointerLeave={() => { if (!gridFocused && !searching) setActive(null); }}
    >
      {flat.length ? <div className={styles.canvas} style={{ height: total }}>
        {visible.map(rowIndex => {
          const row = rows[rowIndex];
          if (row.kind === "header") return <div key={`h${rowIndex}`} role="row" aria-rowindex={rowIndex + 1} className={styles.sectionRow} style={{ transform: `translateY(${row.top}px)`, height: row.height }}>
            <span role="columnheader" aria-colspan={columns} className={styles.sectionLabel}>{row.label}</span>
          </div>;
          return <div key={`r${rowIndex}`} role="row" aria-rowindex={rowIndex + 1} className={styles.row} style={{ transform: `translateY(${row.top}px)`, height: row.height, gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
            {row.items.map((item, col) => {
              const index = row.first + col;
              return <button
                key={item.emoji}
                id={cellId(index)}
                type="button"
                role="gridcell"
                tabIndex={-1}
                aria-label={item.label}
                aria-selected={active === index}
                data-active={active === index || undefined}
                className={styles.cell}
                onPointerMove={event => { if (event.pointerType === "mouse" && active !== index) setActive(index); }}
                onMouseDown={event => event.preventDefault()}
                onClick={event => { setActive(index); choose(item, event); }}
              >
                <span className={styles.emojiGlyph}>{applyTone(item, tone)}</span>
              </button>;
            })}
          </div>;
        })}
      </div> : <div className={styles.empty}>
        <p className={styles.emptyTitle}>No emoji match “{query.trim()}”</p>
        <p className={styles.emptyHint}>Try a shorter or different word</p>
      </div>}
    </div>

    <div className={styles.preview} aria-hidden="true">
      {activeItem ? <>
        <span key={activeItem.emoji} className={[styles.previewGlyph, styles.emojiGlyph].join(" ")}>{applyTone(activeItem, tone)}</span>
        <span className={styles.previewText}>
          <span className={styles.previewName}>{activeItem.label}</span>
          {activeItem.keywords.length > 0 && <span className={styles.previewKeywords}>{activeItem.keywords.slice(0, 3).join(", ")}</span>}
        </span>
      </> : <>
        <span className={[styles.previewGlyph, styles.previewIdle, styles.emojiGlyph].join(" ")}>{applyTone(data.byEmoji.get("👋")!, tone)}</span>
        <span className={styles.previewText}><span className={styles.previewHint}>Pick an emoji</span></span>
      </>}
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{searching ? results.length ? `${results.length} emoji found` : "No emoji found" : ""}</span>
  </div>;
}

export default EmojiPicker;
