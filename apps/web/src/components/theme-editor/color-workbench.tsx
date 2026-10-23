"use client";

import { useState, type CSSProperties, type MouseEvent } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  CheckCheck,
  Circle,
  Moon,
  Palette,
  Pencil,
  RotateCcw,
  Search,
  Sun,
} from "lucide-react";
import {
  allTokens,
  getThemeConcepts,
  isEditableColor,
  resolveTheme,
  themes,
  themeStyle,
  tokenGroups,
  type ColorToken,
  type ThemeId,
} from "@template/design-tokens/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useThemeEditor } from "./theme-provider";

type Editing = {
  themeId: ThemeId;
  token: ColorToken;
  previous?: string;
  previousTheme: ThemeId;
  input: string;
  picker: string;
  opacity: number;
};
function colorParts(value: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return {
    hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`,
    opacity: Math.round((a / 255) * 100),
    identity: a === 0 ? "transparent" : `${r},${g},${b},${a}`,
  };
}
function colorWithOpacity(hex: string, opacity: number) {
  if (opacity === 100) return hex.toUpperCase();
  return `${hex}${Math.round((opacity / 100) * 255)
    .toString(16)
    .padStart(2, "0")}`.toUpperCase();
}
function valueLabel(value: string) {
  if (value.startsWith("var(")) return `关联 · ${value.slice(12, -1)}`;
  if (value.startsWith("color-mix")) return "自动派生";
  if (value === "transparent") return "透明";
  return value;
}
function MiniInterface() {
  return (
    <div
      className="grid grid-cols-[2rem_1fr] h-[139px] bg-[var(--theme-background)] text-[var(--theme-foreground)] text-[length:.5rem] min-[1600px]:h-[156px] max-[767px]:h-[145px] max-[767px]:grid-cols-[2.5rem_1fr]"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center pt-3 border-r border-r-[var(--theme-border)] bg-[var(--theme-sidebar)] gap-3">
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
      </div>
      <div className="min-w-0 p-2.5 min-[1600px]:p-3.5 max-[767px]:p-3">
        <div className="flex justify-between items-center text-[length:.5rem] mb-2 text-[var(--theme-muted)]">
          <span>项目空间</span>
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--theme-accent-soft)]" />
        </div>
        <div className="bg-[var(--theme-surface)] text-[var(--theme-surface-foreground)] rounded-[.375rem] border border-[var(--theme-border)] p-2.5 min-[1600px]:p-3.5 max-[767px]:p-3">
          <span className="block font-semibold text-[length:.625rem]">
            让每一步，更清晰。
          </span>
          <small className="block text-[var(--theme-muted)] text-[length:.5rem] mt-0.5 mb-2 mx-0">
            有序的界面，专注于内容。
          </small>
          <div className="flex gap-1.5">
            <b className="inline-block rounded-[.25rem] text-[length:.5rem] font-medium not-italic text-[var(--theme-button-primary-foreground)] bg-[var(--theme-button-primary)] py-0.5 px-1.5">
              主要操作
            </b>
            <em className="inline-block rounded-[.25rem] text-[length:.5rem] font-medium not-italic text-[var(--theme-button-secondary-foreground)] bg-[var(--theme-button-secondary)] py-0.5 px-1.5">
              次要操作
            </em>
          </div>
        </div>
        <div className="flex items-center mt-1.5 text-[var(--theme-success-soft-foreground)] text-[length:.4375rem] whitespace-nowrap gap-0.5">
          <Check size={10} /> 所有更改已同步{" "}
          <span className="ml-auto rounded-[.25rem] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-soft-foreground)] py-0 px-1">
            进行中
          </span>
        </div>
      </div>
    </div>
  );
}
export function ColorWorkbench() {
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
  return (
    <section
      className="[--matrix-line:color-mix(in_oklab,_var(--border)_36%,_transparent)] [--matrix-outline:color-mix(in_oklab,_var(--border)_52%,_transparent)] w-full min-w-0"
      aria-labelledby="colors-title"
    >
      <div className="flex justify-between items-end mb-8 gap-8 max-[767px]:mb-6">
        <div>
          <h1
            className="mt-3.5 mb-3 text-[length:clamp(1.875rem,_3vw,_2.625rem)] leading-[1.3] tracking-[-.055em] font-[650] mx-0"
            id="colors-title"
          >
            让颜色，各司其职。
          </h1>
          <p className="max-w-152 text-[var(--muted-foreground)] text-[length:.875rem] m-0 max-[767px]:text-[length:.8125rem]">
            按功能定义颜色，按场景选择主题。点击任意色块微调，整套界面同步预览。
          </p>
        </div>
        <div className="flex items-center pb-1 whitespace-nowrap text-[var(--muted-foreground)] text-[length:.6875rem] gap-5 max-[1100px]:hidden">
          <span>
            <strong className="text-[var(--foreground)] text-[length:1.25rem] font-medium mr-1 tabular-nums">
              04
            </strong>{" "}
            套主题
          </span>
          <i className="h-6 w-px bg-[var(--border)]" />
          <span>
            <strong className="text-[var(--foreground)] text-[length:1.25rem] font-medium mr-1 tabular-nums">
              {allTokens.length}
            </strong>{" "}
            个功能角色
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 gap-2 max-[767px]:items-start max-[767px]:flex-col max-[767px]:gap-3">
        <div
          className="inline-flex items-center border border-[var(--border)] rounded-[.75rem] bg-[var(--theme-surface-secondary)] p-1 gap-1"
          role="group"
          aria-label="主题明暗模式"
        >
          <button
            className="flex items-center justify-center border-0 bg-transparent rounded-[.5rem] text-[length:.75rem] text-[var(--muted-foreground)] cursor-pointer py-2 px-3 gap-2 aria-pressed:bg-[var(--theme-segment)] aria-pressed:text-[var(--theme-segment-foreground)] aria-pressed:shadow-[var(--shadow-soft)]"
            aria-pressed={!dark}
            onClick={() => chooseTheme(lastLight)}
          >
            <Sun size={15} />
            浅色主题{" "}
            <small className="grid place-items-center min-w-4.5 h-4.5 rounded-[.3rem] bg-[var(--theme-surface-tertiary)] text-[var(--muted-foreground)] text-[length:.625rem]">
              3
            </small>
          </button>
          <button
            className="flex items-center justify-center border-0 bg-transparent rounded-[.5rem] text-[length:.75rem] text-[var(--muted-foreground)] cursor-pointer py-2 px-3 gap-2 aria-pressed:bg-[var(--theme-segment)] aria-pressed:text-[var(--theme-segment-foreground)] aria-pressed:shadow-[var(--shadow-soft)]"
            aria-pressed={dark}
            onClick={() => chooseTheme("night")}
          >
            <Moon size={15} />
            深色主题{" "}
            <small className="grid place-items-center min-w-4.5 h-4.5 rounded-[.3rem] bg-[var(--theme-surface-tertiary)] text-[var(--muted-foreground)] text-[length:.625rem]">
              1
            </small>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="text-[length:.75rem] text-[var(--muted-foreground)]"
            onClick={exportTheme}
            variant="ghost"
            disabled={!ready}
          >
            <ArrowDownToLine />
            导出配置
          </Button>
          <Button
            className="text-[length:.75rem] text-[var(--muted-foreground)]"
            onClick={() => resetTheme(activeId)}
            variant="ghost"
            disabled={!ready || !overrides[activeId]}
          >
            <RotateCcw />
            恢复预设
          </Button>
        </div>
      </div>

      <div
        className="grid grid-cols-3 gap-4 data-[dark=true]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] max-[1100px]:gap-2.5 max-[767px]:grid-cols-1 max-[767px]:gap-3.5 max-[767px]:data-[dark=true]:grid-cols-1"
        data-dark={dark}
      >
        {visibleThemes.map((theme, index) => (
          <article
            key={theme.id}
            className="group/themeCard min-w-0 overflow-hidden border border-[var(--border)] rounded-[1rem] bg-[var(--card)] [transition:border-color_.15s,box-shadow_.15s] data-[active=true]:border-[var(--ring)] data-[active=true]:shadow-[0_0_0_1px_var(--ring)]"
            data-active={activeId === theme.id}
          >
            <button
              className="block w-full pt-4 pb-3 border-0 text-left text-[var(--foreground)] bg-transparent cursor-pointer px-4 max-[1100px]:pt-3 max-[1100px]:pb-2.5 max-[1100px]:px-3 max-[767px]:p-4"
              onClick={() => chooseTheme(theme.id)}
              aria-pressed={activeId === theme.id}
              aria-label={`切换到${theme.name}`}
            >
              <div className="flex items-center mb-4 gap-2.5">
                <span className="text-[var(--muted-foreground)] text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic">
                  {dark ? "04" : `0${index + 1}`}
                </span>
                <strong className="text-[length:.875rem] font-semibold">
                  {theme.name}
                </strong>
                <span className="grid place-items-center ml-auto w-4.5 h-4.5 rounded-full text-[var(--muted-foreground)] group-data-[active=true]/themeCard:bg-[var(--primary)] group-data-[active=true]/themeCard:text-[var(--primary-foreground)]">
                  {activeId === theme.id ? (
                    <Check size={13} />
                  ) : (
                    <Circle size={16} />
                  )}
                </span>
              </div>
              <div
                className="rounded-[.625rem] overflow-hidden border border-[var(--border)]"
                data-theme-scope={theme.id}
                style={
                  themeStyle(theme.id, overrides[theme.id]) as CSSProperties
                }
              >
                <MiniInterface />
              </div>
              <span className="block mt-3 text-[var(--muted-foreground)] text-[length:.6875rem] max-[1100px]:text-[length:.625rem] max-[767px]:text-[length:.6875rem]">
                {theme.subtitle}
              </span>
            </button>
            <div className="flex items-center flex-wrap justify-between border-t border-t-[var(--border)] text-[length:.625rem] text-[var(--muted-foreground)] py-2.5 px-4 gap-1 max-[1100px]:py-2 max-[1100px]:px-3">
              <span>
                {activeId === theme.id ? "当前应用" : "点击应用整套主题"}
                {overrides[theme.id] ? " · 已自定义" : ""}
              </span>
              <a
                className="inline-flex items-center gap-0.5 hover:text-[var(--foreground)]"
                href={theme.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${theme.reference} 设计参考`}
              >
                {theme.reference}
                <ArrowUpRight size={11} />
              </a>
            </div>
          </article>
        ))}
        {dark && (
          <div className="flex flex-col justify-center text-[var(--muted-foreground)] py-4 px-8 max-[767px]:p-4">
            <Moon size={22} />
            <h2 className="text-[length:1.125rem] text-[var(--foreground)] font-medium mt-3 mb-2 mx-0">
              为低光环境，重新建立层次。
            </h2>
            <p className="text-[length:.8125rem] max-w-120 m-0">
              使用独立的近黑画布与逐层提亮的容器，重新配对文字、状态与控件颜色，保留清晰的阅读和操作层级。
            </p>
            <div className="flex mt-6 gap-1.5">
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-background)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-surface)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-surface-secondary)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-surface-tertiary)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-accent)]" />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-5 border border-[var(--border)] rounded-[.75rem] bg-[var(--card)] py-3.5 px-4 gap-4 max-[767px]:items-start max-[767px]:flex-col">
        <div className="flex items-center text-[var(--muted-foreground)] gap-3">
          {dirty ? <Pencil size={14} /> : <CheckCheck size={15} />}
          <div>
            <strong className="block text-[var(--foreground)] font-medium text-[length:.75rem]">
              {dirty
                ? "正在预览 · 尚未保存"
                : savedAt
                  ? "已保存到当前浏览器"
                  : "正在使用预设主题"}
            </strong>
            <span className="block text-[length:.6875rem] mt-0.5 max-[767px]:text-[length:.625rem]">
              {dirty
                ? "切换页面继续预览；刷新将恢复上次保存。"
                : "保存后刷新仍保留，也可以导出为主题配置。"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 max-[767px]:[align-self:flex-end]">
          {dirty && (
            <Button
              className="text-[length:.75rem]"
              onClick={discardPreview}
              variant="ghost"
            >
              放弃预览
            </Button>
          )}
          <Button
            className="text-[length:.75rem]"
            onClick={saveTheme}
            disabled={!ready || (!dirty && !!savedAt)}
          >
            <Check size={14} />
            保存主题
          </Button>
        </div>
      </div>
      <p
        className="min-h-4 mt-1.5 mb-5 text-[length:.6875rem] text-[var(--muted-foreground)] mx-0"
        role="status"
        aria-live="polite"
      >
        {message}
      </p>

      <div className="flex justify-between items-end mb-5 gap-4 max-[1100px]:items-start max-[767px]:flex-col max-[767px]:gap-3.5">
        <div>
          <h2 className="text-[length:1.125rem] font-semibold mt-0 mb-1 tracking-[-.025em] mx-0">
            功能颜色矩阵
          </h2>
          <p className="text-[var(--muted-foreground)] text-[length:.75rem] m-0">
            {conceptView
              ? "每套主题的独立基础色，合并相同颜色与用途，快速了解配色。"
              : "同一功能，跨主题对照。色块均可点击编辑。"}
          </p>
        </div>
        <div className="flex items-center justify-end flex-wrap gap-3.5 max-[1100px]:gap-2 max-[767px]:w-full max-[767px]:justify-between">
          {!conceptView && (
            <span className="text-[var(--muted-foreground)] text-[length:.6875rem] whitespace-nowrap">
              {foundCount} / {allTokens.length} 个角色
            </span>
          )}
          <div
            className="inline-flex shrink-0 items-center border border-[var(--matrix-outline)] rounded-[.625rem] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_55%,_var(--card))] p-0.75 gap-0.5 max-[767px]:ml-auto"
            role="group"
            aria-label="矩阵视图"
          >
            <button
              className="inline-flex items-center justify-center border-0 rounded-[.4375rem] bg-transparent text-[var(--muted-foreground)] text-[length:.6875rem] whitespace-nowrap cursor-pointer py-1.5 px-2.5 gap-1.5 aria-pressed:bg-[var(--card)] aria-pressed:text-[var(--foreground)] aria-pressed:shadow-[0_1px_3px_var(--matrix-line)]"
              aria-pressed={!conceptView}
              onClick={() => setConceptView(false)}
            >
              功能角色
            </button>
            <button
              className="inline-flex items-center justify-center border-0 rounded-[.4375rem] bg-transparent text-[var(--muted-foreground)] text-[length:.6875rem] whitespace-nowrap cursor-pointer py-1.5 px-2.5 gap-1.5 aria-pressed:bg-[var(--card)] aria-pressed:text-[var(--foreground)] aria-pressed:shadow-[0_1px_3px_var(--matrix-line)]"
              aria-pressed={conceptView}
              onClick={() => setConceptView(true)}
            >
              <Palette size={13} />
              颜色概念
            </button>
          </div>
        </div>
      </div>
      {conceptView ? (
        <div
          className="group/conceptGrid grid grid-cols-3 items-start gap-4 data-[dark=true]:grid-cols-1 max-[1100px]:gap-2.5 max-[767px]:grid-cols-1 max-[767px]:gap-4"
          data-view="concepts"
          data-dark={dark}
        >
          {visibleThemes.map((theme) => {
            const concepts = getThemeConcepts(
              theme.id,
              (value) => colorParts(value).identity,
              overrides[theme.id],
            );
            return (
              <section
                className="min-w-0 border border-[var(--matrix-outline)] rounded-[.875rem] bg-[var(--card)] overflow-hidden"
                key={theme.id}
                data-concept-theme={theme.id}
                aria-label={`${theme.name}的颜色概念`}
              >
                <div className="flex items-center flex-wrap justify-between border-b border-b-[var(--matrix-line)] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_35%,_var(--card))] p-4 gap-1.5 max-[1100px]:py-3.5 max-[1100px]:px-3 max-[767px]:p-4">
                  <button
                    className="inline-flex items-center bg-transparent border-0 text-[var(--foreground)] text-[length:.8125rem] font-medium cursor-pointer p-0 gap-2"
                    onClick={() => chooseTheme(theme.id)}
                  >
                    {theme.name}
                    {theme.id === activeId && <Check size={12} />}
                  </button>
                  <span className="text-[var(--muted-foreground)] text-[length:.625rem]">
                    {concepts.length} 个独立颜色
                  </span>
                  <p className="basis-full mt-0.5 mb-0 text-[length:.625rem] text-[var(--muted-foreground)] mx-0">
                    {theme.subtitle}
                  </p>
                </div>
                <div className="grid group-data-[dark=true]/conceptGrid:grid-cols-3 max-[767px]:group-data-[dark=true]/conceptGrid:grid-cols-1">
                  {concepts.map(({ value, roles }) => {
                    const primary = roles[0];
                    const usage = roles.map((role) => role.usage).join("；");
                    return (
                      <button
                        className="group/conceptColor flex items-start w-full min-w-0 border-0 border-b border-b-[var(--matrix-line)] bg-transparent text-[var(--foreground)] text-left cursor-pointer [transition:background_.15s] p-4 gap-3 last:border-b-0 hover:bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_45%,_var(--card))] max-[1100px]:py-3.5 max-[1100px]:px-3 max-[1100px]:gap-2 max-[767px]:p-4 max-[767px]:gap-3"
                        key={primary.key}
                        data-theme-scope={theme.id}
                        style={
                          themeStyle(
                            theme.id,
                            overrides[theme.id],
                          ) as CSSProperties
                        }
                        onClick={(event) =>
                          openEditor(event, theme.id, primary)
                        }
                        aria-label={`编辑${theme.name}的${primary.name}`}
                        title={`${usage}\n${roles.map((role) => role.key).join("、")}`}
                      >
                        <span className="block shrink-0 w-[48px] h-[52px] border border-[var(--matrix-outline)] rounded-[.5rem] overflow-hidden [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_8px_8px] max-[1100px]:w-[38px] max-[1100px]:h-[44px] max-[767px]:w-[48px] max-[767px]:h-[52px]">
                          <span
                            className="block w-full h-full bg-[var(--paint-color)]"
                            data-paint
                            style={{ "--paint-color": value } as CSSProperties}
                          />
                        </span>
                        <span className="flex flex-1 min-w-0 flex-col gap-1">
                          <strong className="flex items-center flex-wrap text-[length:.75rem] font-medium leading-[1.5] gap-1.5">
                            {primary.name}
                            {roles.length > 1 && (
                              <small className="text-[length:.5625rem] font-normal text-[var(--muted-foreground)]">
                                +{roles.length - 1} 用途
                              </small>
                            )}
                          </strong>
                          <code className="overflow-hidden text-ellipsis whitespace-nowrap text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                            {value}
                          </code>
                          <span className="[display:-webkit-box] overflow-hidden [-webkit-line-clamp:2] [-webkit-box-orient:vertical] text-[var(--muted-foreground)] text-[length:.625rem] leading-[1.65]">
                            {usage}
                          </span>
                        </span>
                        <Pencil
                          className="text-[var(--muted-foreground)] ml-auto shrink-0 opacity-0 mt-0.75 group-hover/conceptColor:opacity-100 group-focus-visible/conceptColor:opacity-100"
                          size={12}
                        />
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-3.5 gap-4 max-[1100px]:items-start max-[1100px]:flex-col max-[1100px]:gap-3">
            <div
              className="flex items-center flex-wrap gap-1.5"
              role="group"
              aria-label="颜色功能分类"
            >
              <button
                className="border-0 rounded-[.375rem] bg-transparent text-[var(--muted-foreground)] cursor-pointer text-[length:.6875rem] whitespace-nowrap py-1.5 px-2 hover:text-[var(--foreground)] hover:bg-[var(--theme-surface-tertiary)] aria-pressed:bg-[var(--theme-accent-soft)] aria-pressed:text-[var(--theme-accent-soft-foreground)] aria-pressed:font-medium"
                aria-pressed={group === "all"}
                onClick={() => setGroup("all")}
              >
                全部
              </button>
              {tokenGroups.map((entry) => (
                <button
                  className="border-0 rounded-[.375rem] bg-transparent text-[var(--muted-foreground)] cursor-pointer text-[length:.6875rem] whitespace-nowrap py-1.5 px-2 hover:text-[var(--foreground)] hover:bg-[var(--theme-surface-tertiary)] aria-pressed:bg-[var(--theme-accent-soft)] aria-pressed:text-[var(--theme-accent-soft-foreground)] aria-pressed:font-medium"
                  aria-pressed={group === entry.id}
                  onClick={() => setGroup(entry.id)}
                  key={entry.id}
                >
                  {entry.name}
                </button>
              ))}
            </div>
            <label className="flex items-center min-w-44 text-[var(--muted-foreground)] border border-[var(--border)] rounded-[.5rem] bg-[var(--card)] py-1.5 px-2.5 gap-2 focus-within:[outline:2px_solid_var(--ring)] focus-within:[outline-offset:2px] max-[1100px]:w-full max-[1100px]:max-w-80">
              <Search size={14} />
              <input
                className="w-full min-w-0 bg-transparent border-0 [outline:none] text-[length:.6875rem] text-[var(--foreground)]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索功能或 token…"
                aria-label="搜索颜色功能"
              />
            </label>
          </div>
          <div className="overflow-x-auto border border-[var(--matrix-outline)] rounded-[.875rem] bg-[var(--card)]">
            <table
              className="group/matrix w-full min-w-[740px] border-collapse table-fixed text-left data-[dark=true]:min-w-[500px]"
              data-dark={dark}
            >
              <caption className="sr-only">
                {dark ? "深色" : "三套浅色"}
                主题功能颜色矩阵，点击色块编辑对应功能颜色
              </caption>
              <thead>
                <tr className="group/tr">
                  <th
                    className="border-b border-b-[var(--matrix-line)] h-[64px] text-[length:.6875rem] font-normal text-[var(--muted-foreground)] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_45%,_var(--card))] py-3 px-4 first:w-[27%] group-data-[dark=true]/matrix:first:w-[42%]"
                    scope="col"
                  >
                    功能 / 用途
                  </th>
                  {visibleThemes.map((theme) => (
                    <th
                      className="border-b border-b-[var(--matrix-line)] h-[64px] text-[length:.6875rem] font-normal text-[var(--muted-foreground)] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_45%,_var(--card))] py-3 px-4 first:w-[27%] data-[active=true]:bg-[color-mix(in_oklab,_var(--theme-accent-soft)_45%,_var(--card))] group-data-[dark=true]/matrix:first:w-[42%]"
                      key={theme.id}
                      scope="col"
                      data-active={theme.id === activeId}
                    >
                      <button
                        className="flex items-center border-0 bg-transparent text-[var(--foreground)] text-[length:.75rem] font-medium cursor-pointer p-0 gap-1.5"
                        onClick={() => chooseTheme(theme.id)}
                      >
                        {theme.name}
                        {theme.id === activeId && <Check size={12} />}
                      </button>
                      <small className="block mt-0.5 text-[length:.5rem] tracking-[.125em] text-[var(--muted-foreground)]">
                        {theme.mode === "dark" ? "DARK" : "LIGHT"}
                      </small>
                    </th>
                  ))}
                </tr>
              </thead>
              {groups.map((entry, index) => (
                <tbody className="group/tbody" key={entry.id}>
                  <tr className="group/groupHeading">
                    <th
                      className="border-b border-b-[var(--matrix-line)] h-[44px] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_30%,_var(--card))] text-[length:.75rem] font-normal py-2.5 px-4 group-last/tbody:group-last/groupHeading:border-b-0"
                      colSpan={visibleThemes.length + 1}
                      scope="colgroup"
                    >
                      <span className="mr-2.5 text-[var(--muted-foreground)] text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic">{`0${index + 1}`}</span>
                      <strong className="font-medium">{entry.name}</strong>
                      <small className="ml-3 text-[length:.625rem] text-[var(--muted-foreground)] max-[767px]:hidden">
                        {entry.description}
                      </small>
                      <em className="float-right text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                        {entry.tokens.length}
                      </em>
                    </th>
                  </tr>
                  {entry.tokens.map((entry) => (
                    <tr className="group/tr" key={entry.key}>
                      <th
                        className="border-b border-b-[var(--matrix-line)] font-normal py-3.5 px-4 group-last/tbody:group-last/tr:border-b-0"
                        scope="row"
                      >
                        <strong className="block text-[length:.75rem] font-medium">
                          {entry.name}
                        </strong>
                        <code className="block text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)] wrap-anywhere my-0.5 mx-0">
                          {entry.key}
                        </code>
                        <small className="block text-[length:.625rem] text-[var(--muted-foreground)]">
                          {entry.usage}
                        </small>
                      </th>
                      {visibleThemes.map((theme) => {
                        const value = resolvedPalettes[theme.id][entry.key];
                        const custom =
                          overrides[theme.id]?.[entry.key] !== undefined;
                        return (
                          <td
                            className="border-b border-b-[var(--matrix-line)] border-l border-l-[var(--matrix-line)] py-2.5 px-3 group-last/tbody:group-last/tr:border-b-0"
                            key={theme.id}
                            data-active={theme.id === activeId}
                            data-theme-scope={theme.id}
                            style={
                              themeStyle(
                                theme.id,
                                overrides[theme.id],
                              ) as CSSProperties
                            }
                          >
                            <button
                              className="group/colorCell flex items-center w-full min-w-0 border-0 rounded-[.5rem] bg-transparent text-left cursor-pointer [transition:background_.15s] text-[var(--foreground)] p-1.5 gap-2.5 hover:bg-[var(--theme-surface-secondary)]"
                              onClick={(event) =>
                                openEditor(event, theme.id, entry)
                              }
                              aria-label={`编辑${theme.name}的${entry.name}`}
                              title={value}
                            >
                              <span className="block shrink-0 w-[44px] h-[38px] border border-[var(--matrix-outline)] rounded-[.375rem] overflow-hidden [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_8px_8px] group-data-[dark=true]/matrix:w-[110px]">
                                <span
                                  className="block w-full h-full bg-[var(--paint-color)]"
                                  data-paint
                                  style={
                                    {
                                      "--paint-color": `var(--theme-${entry.key})`,
                                    } as CSSProperties
                                  }
                                />
                              </span>
                              <span className="min-w-0">
                                <code className="block overflow-hidden whitespace-nowrap text-ellipsis max-w-full text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic">
                                  {valueLabel(value)}
                                </code>
                                <small className="block text-[var(--muted-foreground)] mt-1.5 text-[length:.5625rem]">
                                  {custom
                                    ? "自定义"
                                    : value.includes("var(")
                                      ? "跟随语义色"
                                      : "预设颜色"}
                                </small>
                              </span>
                              <Pencil
                                className="text-[var(--muted-foreground)] ml-auto shrink-0 opacity-0 group-hover/colorCell:opacity-100 group-focus-visible/colorCell:opacity-100"
                                size={12}
                              />
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
            {!groups.length && (
              <div className="flex items-center flex-col text-[var(--muted-foreground)] text-[length:.8125rem] py-16 px-4 gap-3">
                <Search size={24} />
                <strong className="font-medium text-[var(--foreground)]">
                  没有匹配的颜色角色
                </strong>
                <span>试试 background、按钮、输入或其他功能名称。</span>
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuery("");
                    setGroup("all");
                  }}
                >
                  清除筛选
                </Button>
              </div>
            )}
          </div>
        </>
      )}
      <div className="flex items-start justify-between text-[var(--muted-foreground)] text-[length:.625rem] mt-3 gap-4 max-[767px]:flex-col max-[767px]:gap-1.5">
        <span className="last:whitespace-nowrap">
          {conceptView
            ? "各主题独立去重，仅展示有实际用途的独立色值；派生色、关联色和完全透明色不重复列出。"
            : "自动派生的颜色跟随上游角色变化；单独修改后，可在编辑面板恢复关联。"}
        </span>
        <span className="last:whitespace-nowrap">
          {activeTheme.name} · {dark ? "深色" : "浅色"}
        </span>
      </div>

      <Sheet
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) cancelEditor();
        }}
      >
        <SheetContent
          className="w-full! overflow-y-auto sm:max-w-[420px]"
          showCloseButton
        >
          <SheetHeader className="px-6 pt-6 pb-2">
            <SheetTitle>编辑功能颜色</SheetTitle>
            <SheetDescription>
              {editing
                ? `${themes.find((theme) => theme.id === editing.themeId)!.name} · ${editing.token.name}`
                : "修改颜色并实时预览"}
            </SheetDescription>
          </SheetHeader>
          {editing && (
            <div className="flex flex-col pt-2 pb-6 px-6 gap-4">
              <div>
                <h2 className="text-[length:1.125rem] font-semibold m-0">
                  {editing.token.name}
                </h2>
                <code className="text-[length:.6875rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                  {editing.token.key}
                </code>
                <p className="text-[length:.75rem] mt-1.5 mb-0 text-[var(--muted-foreground)] mx-0">
                  {editing.token.usage}
                </p>
              </div>
              <div className="h-[128px] rounded-[.75rem] overflow-hidden border border-[var(--border)] [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_12px_12px]">
                <div
                  className="w-full h-full bg-[var(--paint-color)]"
                  style={
                    {
                      "--paint-color": `var(--theme-${editing.token.key})`,
                    } as CSSProperties
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <label className="relative inline-flex items-center border border-[var(--border)] rounded-[.5rem] text-[length:.75rem] cursor-pointer py-1.5 px-2.5 gap-1.5 focus-within:[outline:2px_solid_var(--ring)] focus-within:[outline-offset:2px]">
                  <input
                    className="absolute top-0 right-0 bottom-0 left-0 w-full h-full opacity-0 cursor-pointer"
                    type="color"
                    aria-label="选择颜色"
                    value={editing.picker}
                    onChange={(event) =>
                      changeInput(
                        colorWithOpacity(event.target.value, editing.opacity),
                      )
                    }
                  />
                  <Pencil size={14} />
                  <span>选择颜色</span>
                </label>
                <span className="text-[var(--muted-foreground)] text-[length:.6875rem]">
                  实时作用于整套界面
                </span>
              </div>
              <label className="flex flex-col text-[length:.75rem] font-medium gap-2">
                颜色值
                <Input
                  className="text-[length:.75rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic h-10"
                  aria-label="颜色值"
                  aria-invalid={!validInput}
                  aria-describedby="color-input-hint"
                  value={editing.input}
                  onChange={(event) => changeInput(event.target.value)}
                  spellCheck={false}
                />
              </label>
              <p
                id="color-input-hint"
                className="-mt-2 mb-0 text-[length:.625rem] text-[var(--muted-foreground)] mx-0 data-[invalid=true]:text-[var(--theme-danger-soft-foreground)]"
                data-invalid={!validInput}
              >
                {validInput
                  ? "支持 HEX（含透明度）、RGB、HSL 与 OKLCH。"
                  : "请输入有效颜色，例如 #7669C7 或 oklch(0.6 0.1 280)。"}
              </p>
              <label className="grid grid-cols-[1fr_auto] text-[length:.75rem] gap-2">
                不透明度{" "}
                <span className="text-[length:.6875rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                  {editing.opacity}%
                </span>
                <input
                  className="w-full col-span-full [accent-color:var(--primary)]"
                  aria-label="颜色不透明度"
                  type="range"
                  min="0"
                  max="100"
                  value={editing.opacity}
                  onChange={(event) =>
                    changeInput(
                      colorWithOpacity(
                        editing.picker,
                        Number(event.target.value),
                      ),
                    )
                  }
                />
              </label>
              <div className="flex flex-col border border-[var(--border)] rounded-[.75rem] bg-[var(--theme-background)] p-4 gap-3">
                <span className="text-[length:.625rem] text-[var(--muted-foreground)]">
                  应用预览
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button>主要操作</Button>
                  <Button variant="secondary">次要操作</Button>
                  <Button variant="destructive">删除</Button>
                </div>
                <Input
                  placeholder="输入内容，查看字段效果"
                  aria-label="颜色编辑输入预览"
                />
                <p className="flex items-center text-[var(--theme-success-soft-foreground)] text-[length:.625rem] m-0 gap-1.5">
                  <Check size={13} />
                  状态、文字与容器同步更新
                </p>
              </div>
              <div className="bg-[var(--theme-surface-secondary)] rounded-[.5rem] py-3 px-4">
                <strong className="text-[length:.75rem] font-medium">
                  预览与保存分开
                </strong>
                <p className="mt-1 mb-0 text-[length:.6875rem] text-[var(--muted-foreground)] mx-0">
                  保留预览只影响当前访问。保存主题会保留所有主题的自定义颜色和当前选择，仅存于当前浏览器。
                </p>
              </div>
              <Button
                className="self-start"
                variant="ghost"
                onClick={() => {
                  editToken(editing.themeId, editing.token.key);
                  setEditing(null);
                }}
              >
                <RotateCcw />
                恢复预设 / 自动派生
              </Button>
              <p
                role="status"
                className="text-[length:.6875rem] text-[var(--muted-foreground)] m-0"
              >
                {message}
              </p>
              <div className="flex justify-end flex-wrap pt-3 border-t border-t-[var(--border)] gap-2">
                <Button variant="outline" onClick={cancelEditor}>
                  取消修改
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setEditing(null)}
                  disabled={!validInput}
                >
                  保留预览
                </Button>
                <Button
                  disabled={!validInput}
                  onClick={() => {
                    if (saveTheme()) setEditing(null);
                  }}
                >
                  保存主题
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
}
