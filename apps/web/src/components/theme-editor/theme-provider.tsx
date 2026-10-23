"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import {
  DEFAULT_THEME, THEME_STORAGE_KEY, isEditableColor, parseSavedTheme, themeStyle,
  type SavedTheme, type ThemeId, type ThemeOverrides,
} from "@template/design-tokens/themes";

type ThemeState = {
  activeId: ThemeId;
  overrides: ThemeOverrides;
  savedId: ThemeId;
  savedOverrides: ThemeOverrides;
  savedAt: string | null;
  ready: boolean;
  message: string;
};
const initial: ThemeState = { activeId: DEFAULT_THEME, overrides: {}, savedId: DEFAULT_THEME, savedOverrides: {}, savedAt: null, ready: false, message: "" };
let state = initial;
let initialized = false;
const listeners = new Set<() => void>();
function applyTheme() {
  const style = themeStyle(state.activeId, state.overrides[state.activeId]);
  const root = document.documentElement;
  // Clear mode-specific properties before applying a different mode.
  root.style.removeProperty("--shadow-soft");
  root.style.removeProperty("--shadow-float");
  for (const [key, value] of Object.entries(style)) {
    if (key === "colorScheme") root.style.colorScheme = value;
    else root.style.setProperty(key, value);
  }
  root.classList.toggle("dark", state.activeId === "night");
  root.dataset.theme = state.activeId;
}
function update(patch: Partial<ThemeState>) {
  state = { ...state, ...patch };
  applyTheme();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    let saved: SavedTheme | null = null;
    let message = "";
    try {
      saved = parseSavedTheme(localStorage.getItem(THEME_STORAGE_KEY));
    } catch { message = "浏览器存储暂不可用，仍可预览和导出主题。"; }
    update({ ready: true, ...(saved ? { activeId: saved.activeId, savedId: saved.activeId, overrides: saved.overrides, savedOverrides: saved.overrides, savedAt: saved.savedAt } : {}), message });
  }
  return () => { listeners.delete(listener); };
}
function selectTheme(id: ThemeId) { update({ activeId: id, message: "" }); }
function editToken(id: ThemeId, key: string, value?: string) {
  if (value !== undefined && !isEditableColor(value)) return;
  const entries = { ...state.overrides[id] };
  if (value === undefined) delete entries[key];
  else entries[key] = value.trim();
  const overrides = { ...state.overrides };
  if (Object.keys(entries).length) overrides[id] = entries;
  else delete overrides[id];
  update({ overrides, message: "" });
}
function saveTheme(): boolean {
  const savedAt = new Date().toISOString();
  const saved: SavedTheme = { version: 1, activeId: state.activeId, overrides: state.overrides, savedAt };
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(saved));
    update({ savedId: state.activeId, savedOverrides: state.overrides, savedAt, message: "主题已保存到当前浏览器，刷新后仍会保留。" });
    return true;
  } catch {
    update({ message: "保存失败：浏览器存储不可用或空间不足。预览仍然保留，可以导出配置。" });
    return false;
  }
}
function discardPreview() {
  update({ activeId: state.savedId, overrides: state.savedOverrides, message: "已恢复到上次保存的主题。" });
}
function resetTheme(id: ThemeId) {
  const overrides = { ...state.overrides };
  delete overrides[id];
  update({ overrides, message: "已恢复当前主题的预设颜色，保存后生效于下次访问。" });
}
function exportTheme() {
  const data = { version: 1, activeId: state.activeId, overrides: state.overrides, savedAt: new Date().toISOString(), css: themeStyle(state.activeId, state.overrides[state.activeId]) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `chengxu-theme-${state.activeId}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
type ThemeContext = ThemeState & {
  dirty: boolean;
  selectTheme: typeof selectTheme; editToken: typeof editToken; saveTheme: typeof saveTheme;
  discardPreview: typeof discardPreview; resetTheme: typeof resetTheme; exportTheme: typeof exportTheme;
};
const Context = createContext<ThemeContext | null>(null);
function canonical(value: ThemeOverrides) {
  return JSON.stringify(Object.entries(value).sort().map(([id, entries]) => [id, Object.entries(entries ?? {}).sort()]));
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const current = useSyncExternalStore(subscribe, () => state, () => initial);
  const dirty = current.activeId !== current.savedId || canonical(current.overrides) !== canonical(current.savedOverrides);
  return <Context.Provider value={{ ...current, dirty, selectTheme, editToken, saveTheme, discardPreview, resetTheme, exportTheme }}>{children}</Context.Provider>;
}
export function useThemeEditor() {
  const context = useContext(Context);
  if (!context) throw new Error("ThemeProvider is required");
  return context;
}
