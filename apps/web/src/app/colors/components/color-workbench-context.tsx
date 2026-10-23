"use client";

import { useThemeEditor } from "@/shared/providers/theme-provider";
import {
  isEditableColor,
  resolveTheme,
  themes,
  tokenGroups,
  type ColorToken,
  type ThemeId,
} from "@template/design-tokens/themes";
import {
  createContext,
  useContext,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { colorParts, type Editing } from "./color-values";

function useWorkbenchState() {
  const {
    activeId,
    overrides,
    savedAt,
    dirty,
    ready,
    message,
    selectTheme,
    editToken,
    saveTheme,
    discardPreview,
    resetTheme,
    exportTheme,
  } = useThemeEditor();
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [conceptView, setConceptView] = useState(false);
  const [lastLight, setLastLight] = useState<ThemeId>("studio");
  const [editing, setEditing] = useState<Editing | null>(null);
  const dark = activeId === "night";
  const activeTheme = themes.find((theme) => theme.id === activeId)!;
  const visibleThemes = themes.filter(
    (theme) => theme.mode === (dark ? "dark" : "light"),
  );
  const search = query.trim().toLowerCase();
  const groups = tokenGroups
    .filter((entry) => group === "all" || entry.id === group)
    .map((entry) => ({
      ...entry,
      tokens: entry.tokens.filter((entry) =>
        `${entry.name} ${entry.key} ${entry.usage}`
          .toLowerCase()
          .includes(search),
      ),
    }))
    .filter((entry) => entry.tokens.length);
  const foundCount = groups.reduce(
    (total, entry) => total + entry.tokens.length,
    0,
  );
  const validInput =
    !editing ||
    (isEditableColor(editing.input) &&
      typeof CSS !== "undefined" &&
      CSS.supports("color", editing.input));
  function chooseTheme(id: ThemeId) {
    if (id !== "night") setLastLight(id);
    else if (activeId !== "night") setLastLight(activeId);
    selectTheme(id);
  }
  function openEditor(
    event: MouseEvent<HTMLButtonElement>,
    themeId: ThemeId,
    entry: ColorToken,
  ) {
    const computed = getComputedStyle(
      event.currentTarget.querySelector("[data-paint]")!,
    ).backgroundColor;
    const parts = colorParts(computed);
    const value = resolveTheme(themeId, overrides[themeId])[entry.key];
    setEditing({
      themeId,
      token: entry,
      previous: overrides[themeId]?.[entry.key],
      previousTheme: activeId,
      input: isEditableColor(value) ? value : computed,
      picker: parts.hex,
      opacity: parts.opacity,
    });
    chooseTheme(themeId);
  }
  function changeInput(value: string) {
    if (!editing) return;
    const valid = isEditableColor(value) && CSS.supports("color", value);
    setEditing({
      ...editing,
      input: value,
      ...(valid
        ? (() => {
            const p = colorParts(value);
            return { picker: p.hex, opacity: p.opacity };
          })()
        : {}),
    });
    if (valid) editToken(editing.themeId, editing.token.key, value);
  }
  function cancelEditor() {
    if (!editing) return;
    editToken(editing.themeId, editing.token.key, editing.previous);
    selectTheme(editing.previousTheme);
    setEditing(null);
  }
  const resolvedPalettes = Object.fromEntries(
    themes.map((theme) => [
      theme.id,
      resolveTheme(theme.id, overrides[theme.id]),
    ]),
  );
  return {
    activeId,
    overrides,
    savedAt,
    dirty,
    ready,
    message,
    selectTheme,
    editToken,
    saveTheme,
    discardPreview,
    resetTheme,
    exportTheme,
    group,
    setGroup,
    query,
    setQuery,
    conceptView,
    setConceptView,
    lastLight,
    setLastLight,
    editing,
    setEditing,
    dark,
    activeTheme,
    visibleThemes,
    search,
    groups,
    foundCount,
    validInput,
    chooseTheme,
    openEditor,
    changeInput,
    cancelEditor,
    resolvedPalettes,
  };
}

const Context = createContext<ReturnType<typeof useWorkbenchState> | null>(
  null,
);

export function ColorWorkbenchProvider({ children }: { children: ReactNode }) {
  const value = useWorkbenchState();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useColorWorkbench() {
  const value = useContext(Context);
  if (!value) throw new Error("ColorWorkbenchProvider is required");
  return value;
}
