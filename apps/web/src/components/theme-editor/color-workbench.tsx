"use client";

import { useState, type MouseEvent } from "react";
import { ArrowDownToLine, ArrowUpRight, Check, CheckCheck, Circle, Moon, Palette, Pencil, RotateCcw, Search, Sun } from "lucide-react";
import { allTokens, isEditableColor, resolveTheme, themes, themeStyle, tokenGroups, type ColorToken, type ThemeId } from "@template/design-tokens/themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useThemeEditor } from "./theme-provider";
import styles from "./color-workbench.module.css";

type Editing = {
  themeId: ThemeId; token: ColorToken; previous?: string; previousTheme: ThemeId;
  input: string; picker: string; opacity: number;
};
function colorParts(value: string) {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d")!;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
  return { hex: `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`, opacity: Math.round(a / 255 * 100) };
}
function colorWithOpacity(hex: string, opacity: number) {
  if (opacity === 100) return hex.toUpperCase();
  return `${hex}${Math.round(opacity / 100 * 255).toString(16).padStart(2, "0")}`.toUpperCase();
}
function valueLabel(value: string) {
  if (value.startsWith("var(")) return `关联 · ${value.slice(12, -1)}`;
  if (value.startsWith("color-mix")) return "自动派生";
  if (value === "transparent") return "透明";
  return value;
}
function MiniInterface() {
  return <div className={styles.mini} aria-hidden="true">
    <div className={styles.miniRail}><i /><i /><i /><i /></div>
    <div className={styles.miniBody}>
      <div className={styles.miniTop}><span>项目空间</span><i /></div>
      <div className={styles.miniCard}><span>让每一步，更清晰。</span><small>有序的界面，专注于内容。</small><div><b>主要操作</b><em>次要操作</em></div></div>
      <div className={styles.miniBottom}><Check size={10} /> 所有更改已同步 <span>进行中</span></div>
    </div>
  </div>;
}
export function ColorWorkbench() {
  const { activeId, overrides, savedAt, dirty, ready, message, selectTheme, editToken, saveTheme, discardPreview, resetTheme, exportTheme } = useThemeEditor();
  const [group, setGroup] = useState("all");
  const [query, setQuery] = useState("");
  const [lastLight, setLastLight] = useState<ThemeId>("studio");
  const [editing, setEditing] = useState<Editing | null>(null);
  const dark = activeId === "night";
  const activeTheme = themes.find((theme) => theme.id === activeId)!;
  const visibleThemes = themes.filter((theme) => theme.mode === (dark ? "dark" : "light"));
  const search = query.trim().toLowerCase();
  const groups = tokenGroups.filter((entry) => group === "all" || entry.id === group).map((entry) => ({
    ...entry, tokens: entry.tokens.filter((entry) => `${entry.name} ${entry.key} ${entry.usage}`.toLowerCase().includes(search)),
  })).filter((entry) => entry.tokens.length);
  const foundCount = groups.reduce((total, entry) => total + entry.tokens.length, 0);
  const validInput = !editing || (isEditableColor(editing.input) && typeof CSS !== "undefined" && CSS.supports("color", editing.input));
  function chooseTheme(id: ThemeId) {
    if (id !== "night") setLastLight(id);
    else if (activeId !== "night") setLastLight(activeId);
    selectTheme(id);
  }
  function openEditor(event: MouseEvent<HTMLButtonElement>, themeId: ThemeId, entry: ColorToken) {
    const computed = getComputedStyle(event.currentTarget.querySelector("[data-paint]")!).backgroundColor;
    const parts = colorParts(computed);
    const value = resolveTheme(themeId, overrides[themeId])[entry.key];
    setEditing({ themeId, token: entry, previous: overrides[themeId]?.[entry.key], previousTheme: activeId, input: isEditableColor(value) ? value : computed, picker: parts.hex, opacity: parts.opacity });
    chooseTheme(themeId);
  }
  function changeInput(value: string) {
    if (!editing) return;
    const valid = isEditableColor(value) && CSS.supports("color", value);
    setEditing({ ...editing, input: value, ...(valid ? (() => { const p = colorParts(value); return { picker: p.hex, opacity: p.opacity }; })() : {}) });
    if (valid) editToken(editing.themeId, editing.token.key, value);
  }
  function cancelEditor() {
    if (!editing) return;
    editToken(editing.themeId, editing.token.key, editing.previous);
    selectTheme(editing.previousTheme);
    setEditing(null);
  }
  const resolvedPalettes = Object.fromEntries(themes.map((theme) => [theme.id, resolveTheme(theme.id, overrides[theme.id])]));
  const scopedStyles = themes.map((theme) => `[data-theme-scope="${theme.id}"]{${Object.entries(themeStyle(theme.id, overrides[theme.id])).map(([key, value]) => `${key === "colorScheme" ? "color-scheme" : key}:${value}`).join(";")}}`).join("\n");
  return <section className={styles.workbench} aria-labelledby="colors-title">
    <style>{scopedStyles}</style>
    <div className={styles.intro}>
      <div>
        <div className={styles.eyebrow}><Palette size={15} /><span>设计语言 / 颜色与主题</span></div>
        <h1 id="colors-title">让颜色，各司其职。</h1>
        <p>按功能定义颜色，按场景选择主题。点击任意色块微调，整套界面同步预览。</p>
      </div>
      <div className={styles.introMeta}><span><strong>04</strong> 套主题</span><i /><span><strong>{allTokens.length}</strong> 个功能角色</span></div>
    </div>

    <div className={styles.themeToolbar}>
      <div className={styles.modeSwitch} role="group" aria-label="主题明暗模式">
        <button aria-pressed={!dark} onClick={() => chooseTheme(lastLight)}><Sun size={15} />浅色主题 <small>3</small></button>
        <button aria-pressed={dark} onClick={() => chooseTheme("night")}><Moon size={15} />深色主题 <small>1</small></button>
      </div>
      <div className={styles.toolbarActions}>
        <Button onClick={exportTheme} variant="ghost" disabled={!ready}><ArrowDownToLine />导出配置</Button>
        <Button onClick={() => resetTheme(activeId)} variant="ghost" disabled={!ready || !overrides[activeId]}><RotateCcw />恢复预设</Button>
      </div>
    </div>

    <div className={styles.themeGrid} data-dark={dark}>
      {visibleThemes.map((theme, index) => <article key={theme.id} className={styles.themeCard} data-active={activeId === theme.id}>
        <button className={styles.themeChoice} onClick={() => chooseTheme(theme.id)} aria-pressed={activeId === theme.id} aria-label={`切换到${theme.name}`}>
          <div className={styles.themeCardHeading}><span className={styles.themeNumber}>{dark ? "04" : `0${index + 1}`}</span><strong>{theme.name}</strong><span className={styles.selectedMark}>{activeId === theme.id ? <Check size={13} /> : <Circle size={16} />}</span></div>
          <div className={styles.previewScope} data-theme-scope={theme.id}><MiniInterface /></div>
          <span className={styles.themeDescription}>{theme.subtitle}</span>
        </button>
        <div className={styles.themeCardFooter}><span>{activeId === theme.id ? "当前应用" : "点击应用整套主题"}{overrides[theme.id] ? " · 已自定义" : ""}</span><a href={theme.url} target="_blank" rel="noreferrer" aria-label={`${theme.reference} 设计参考`}>{theme.reference}<ArrowUpRight size={11} /></a></div>
      </article>)}
      {dark && <div className={styles.darkNote}><Moon size={22} /><h2>为低光环境，重新建立层次。</h2><p>使用独立的近黑画布与逐层提亮的容器，重新配对文字、状态与控件颜色，保留清晰的阅读和操作层级。</p><div><span style={{ background: "var(--theme-background)" }} /><span style={{ background: "var(--theme-surface)" }} /><span style={{ background: "var(--theme-surface-secondary)" }} /><span style={{ background: "var(--theme-surface-tertiary)" }} /><span style={{ background: "var(--theme-accent)" }} /></div></div>}
    </div>

    <div className={styles.saveBar}>
      <div className={styles.saveStatus}>{dirty ? <Pencil size={14} /> : <CheckCheck size={15} />}<div><strong>{dirty ? "正在预览 · 尚未保存" : savedAt ? "已保存到当前浏览器" : "正在使用预设主题"}</strong><span>{dirty ? "切换页面继续预览；刷新将恢复上次保存。" : "保存后刷新仍保留，也可以导出为主题配置。"}</span></div></div>
      <div className={styles.saveActions}>{dirty && <Button onClick={discardPreview} variant="ghost">放弃预览</Button>}<Button onClick={saveTheme} disabled={!ready || (!dirty && !!savedAt)}><Check size={14} />保存主题</Button></div>
    </div>
    <p className={styles.feedback} role="status" aria-live="polite">{message}</p>

    <div className={styles.matrixHeading}><div><h2>功能颜色矩阵</h2><p>同一功能，跨主题对照。色块均可点击编辑。</p></div><span>{foundCount} / {allTokens.length} 个角色</span></div>
    <div className={styles.filters}>
      <div className={styles.groupFilters} role="group" aria-label="颜色功能分类">
        <button aria-pressed={group === "all"} onClick={() => setGroup("all")}>全部</button>
        {tokenGroups.map((entry) => <button aria-pressed={group === entry.id} onClick={() => setGroup(entry.id)} key={entry.id}>{entry.name}</button>)}
      </div>
      <label className={styles.search}><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索功能或 token…" aria-label="搜索颜色功能" /></label>
    </div>
    <div className={styles.matrixScroll}>
      <table className={styles.matrix} data-dark={dark}>
        <caption className="sr-only">{dark ? "深色" : "三套浅色"}主题功能颜色矩阵，点击色块编辑对应功能颜色</caption>
        <thead><tr><th scope="col">功能 / 用途</th>{visibleThemes.map((theme) => <th key={theme.id} scope="col" data-active={theme.id === activeId}><button onClick={() => chooseTheme(theme.id)}>{theme.name}{theme.id === activeId && <Check size={12} />}</button><small>{theme.mode === "dark" ? "DARK" : "LIGHT"}</small></th>)}</tr></thead>
        {groups.map((entry, index) => <tbody key={entry.id}>
          <tr className={styles.groupHeading}><th colSpan={visibleThemes.length + 1} scope="colgroup"><span>{`0${index + 1}`}</span><strong>{entry.name}</strong><small>{entry.description}</small><em>{entry.tokens.length}</em></th></tr>
          {entry.tokens.map((entry) => <tr key={entry.key}>
            <th scope="row"><strong>{entry.name}</strong><code>{entry.key}</code><small>{entry.usage}</small></th>
            {visibleThemes.map((theme) => {
              const value = resolvedPalettes[theme.id][entry.key];
              const custom = overrides[theme.id]?.[entry.key] !== undefined;
              return <td key={theme.id} data-active={theme.id === activeId} data-theme-scope={theme.id}>
                <button className={styles.colorCell} onClick={(event) => openEditor(event, theme.id, entry)} aria-label={`编辑${theme.name}的${entry.name}`} title={value}>
                  <span className={styles.paintChecker}><span data-paint style={{ background: `var(--theme-${entry.key})` }} /></span>
                  <span className={styles.value}><code>{valueLabel(value)}</code><small>{custom ? "自定义" : value.includes("var(") ? "跟随语义色" : "预设颜色"}</small></span>
                  <Pencil className={styles.editIcon} size={12} />
                </button>
              </td>;
            })}
          </tr>)}
        </tbody>)}
      </table>
      {!groups.length && <div className={styles.empty}><Search size={24} /><strong>没有匹配的颜色角色</strong><span>试试 background、按钮、输入或其他功能名称。</span><Button variant="outline" onClick={() => { setQuery(""); setGroup("all"); }}>清除筛选</Button></div>}
    </div>
    <div className={styles.matrixFootnote}><span>自动派生的颜色跟随上游角色变化；单独修改后，可在编辑面板恢复关联。</span><span>{activeTheme.name} · {dark ? "深色" : "浅色"}</span></div>

    <Sheet open={!!editing} onOpenChange={(open) => { if (!open) cancelEditor(); }}>
      <SheetContent className="w-full! overflow-y-auto sm:max-w-[420px]" showCloseButton>
        <SheetHeader className="px-6 pt-6 pb-2"><SheetTitle>编辑功能颜色</SheetTitle><SheetDescription>{editing ? `${themes.find((theme) => theme.id === editing.themeId)!.name} · ${editing.token.name}` : "修改颜色并实时预览"}</SheetDescription></SheetHeader>
        {editing && <div className={styles.editor}>
          <div className={styles.editorToken}><h2>{editing.token.name}</h2><code>{editing.token.key}</code><p>{editing.token.usage}</p></div>
          <div className={styles.editorSwatchChecker}><div style={{ background: `var(--theme-${editing.token.key})` }} /></div>
          <div className={styles.pickerRow}><label className={styles.nativePicker}><input type="color" aria-label="选择颜色" value={editing.picker} onChange={(event) => changeInput(colorWithOpacity(event.target.value, editing.opacity))} /><Pencil size={14} /><span>选择颜色</span></label><span>实时作用于整套界面</span></div>
          <label className={styles.editorLabel}>颜色值<Input aria-label="颜色值" aria-invalid={!validInput} aria-describedby="color-input-hint" value={editing.input} onChange={(event) => changeInput(event.target.value)} spellCheck={false} /></label>
          <p id="color-input-hint" className={styles.inputHint} data-invalid={!validInput}>{validInput ? "支持 HEX（含透明度）、RGB、HSL 与 OKLCH。" : "请输入有效颜色，例如 #7669C7 或 oklch(0.6 0.1 280)。"}</p>
          <label className={styles.opacityLabel}>不透明度 <span>{editing.opacity}%</span><input aria-label="颜色不透明度" type="range" min="0" max="100" value={editing.opacity} onChange={(event) => changeInput(colorWithOpacity(editing.picker, Number(event.target.value)))} /></label>
          <div className={styles.editorPreview}><span>应用预览</span><div><Button>主要操作</Button><Button variant="secondary">次要操作</Button><Button variant="destructive">删除</Button></div><Input placeholder="输入内容，查看字段效果" aria-label="颜色编辑输入预览" /><p><Check size={13} />状态、文字与容器同步更新</p></div>
          <div className={styles.editorNote}><strong>预览与保存分开</strong><p>保留预览只影响当前访问。保存主题会保留所有主题的自定义颜色和当前选择，仅存于当前浏览器。</p></div>
          <Button className="self-start" variant="ghost" onClick={() => { editToken(editing.themeId, editing.token.key); setEditing(null); }}><RotateCcw />恢复预设 / 自动派生</Button>
          <p role="status" className={styles.editorMessage}>{message}</p>
          <div className={styles.editorActions}><Button variant="outline" onClick={cancelEditor}>取消修改</Button><Button variant="secondary" onClick={() => setEditing(null)} disabled={!validInput}>保留预览</Button><Button disabled={!validInput} onClick={() => { if (saveTheme()) setEditing(null); }}>保存主题</Button></div>
        </div>}
      </SheetContent>
    </Sheet>
  </section>;
}
