import source from "../tokens.json" with { type: "json" };

export const THEME_STORAGE_KEY = "chengxu.theme.v1";
export const DEFAULT_THEME = "studio";
export const themes = [
  { id: "studio", name: "专注工作", subtitle: "安静有序，适合日常工作台", mode: "light", reference: "Radix Colors", url: "https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale" },
  { id: "clarity", name: "清晰交互", subtitle: "明确直接，适合通用产品", mode: "light", reference: "HeroUI", url: "https://heroui.com/en/docs/native/getting-started/colors" },
  { id: "reading", name: "温润阅读", subtitle: "柔和舒展，适合内容与阅读", mode: "light", reference: "Material Design 3", url: "https://m3.material.io/styles/color/roles" },
  { id: "night", name: "夜间工作", subtitle: "重新校准层级的独立深色主题", mode: "dark", reference: "HeroUI · Dark", url: "https://heroui.com/en/docs/native/getting-started/theming" },
] as const;
export type ThemeId = typeof themes[number]["id"];
export type ThemeOverrides = Partial<Record<ThemeId, Record<string, string>>>;
export type ColorToken = { key: string; name: string; usage: string; value?: string };
export type TokenGroup = { id: string; name: string; description: string; tokens: ColorToken[] };
const ref = (key: string) => `var(--theme-${key})`;
const mix = (a: string, percent: number, b: string) => `color-mix(in oklab, ${ref(a)} ${percent}%, ${ref(b)})`;
const token = (key: string, name: string, usage: string, value?: string): ColorToken => ({ key, name, usage, value });

export const tokenGroups: TokenGroup[] = [
  { id: "foundation", name: "背景与内容", description: "从页面画布到正文，先建立阅读层次。", tokens: [
    token("background", "页面背景", "应用底层画布、侧栏与主内容背后的背景"),
    token("foreground", "主要内容", "正文、标题与主要图标"),
    token("background-secondary", "二级背景", "弱区分的背景区域", mix("background", 96, "foreground")),
    token("background-tertiary", "三级背景", "更深一层的背景区域", mix("background", 92, "foreground")),
    token("background-inverse", "反向背景", "深浅反向的信息提示", ref("foreground")),
    token("foreground-inverse", "反向内容", "反向背景上的文字", ref("background")),
    token("muted", "辅助内容", "描述、时间与元数据"),
    token("link", "文字链接", "可跳转的正文与操作", ref("accent-soft-foreground")),
    token("selection", "文本选择背景", "选中文本的高亮底色", ref("accent-soft")),
    token("selection-foreground", "文本选择前景", "选中文本的文字", ref("accent-soft-foreground")),
  ] },
  { id: "surface", name: "容器与浮层", description: "表面通过亮度表达层级，浮层有独立的颜色角色。", tokens: [
    token("surface", "基础表面", "主内容区域、卡片与独立面板"),
    token("surface-foreground", "表面内容", "基础表面上的文字与图标", ref("foreground")),
    token("surface-secondary", "二级表面", "嵌套面板与中性分组"),
    token("surface-secondary-foreground", "二级表面内容", "嵌套面板上的内容", ref("foreground")),
    token("surface-tertiary", "三级表面", "深层嵌套与按下区域"),
    token("surface-tertiary-foreground", "三级表面内容", "三级容器上的内容", ref("foreground")),
    token("surface-hover", "表面悬停", "可交互卡片的悬停底色", mix("surface", 92, "surface-foreground")),
    token("overlay", "浮层背景", "Dialog、Popover、Menu 与 Sheet", ref("surface")),
    token("overlay-foreground", "浮层内容", "浮层中的主文字", ref("foreground")),
    token("backdrop", "浮层遮罩", "降低浮层后方内容的干扰", "rgb(0 0 0 / 32%)"),
  ] },
  { id: "action", name: "强调与中性控件", description: "主行动、选中与焦点使用强调色，普通控件使用中性色。", tokens: [
    token("accent", "主要强调", "品牌强调、主行动与选中"),
    token("accent-foreground", "强调内容", "强调实色上的文字与图标"),
    token("accent-hover", "强调悬停", "主行动的悬停状态", mix("accent", 90, "accent-foreground")),
    token("accent-soft", "轻量强调", "选中与轻量提示背景", `color-mix(in oklab, ${ref("accent")} 15%, transparent)`),
    token("accent-soft-hover", "轻量强调悬停", "轻量强调的悬停背景", `color-mix(in oklab, ${ref("accent")} 20%, transparent)`),
    token("accent-soft-foreground", "轻量强调内容", "轻量强调上的文字", mix("accent", 80, "foreground")),
    token("default", "中性控件", "普通按钮与 Tabs 轨道"),
    token("default-foreground", "中性控件内容", "中性控件的文字与图标", ref("foreground")),
    token("default-hover", "中性控件悬停", "普通控件的悬停背景", mix("default", 96, "default-foreground")),
    token("default-soft", "轻量中性控件", "低强调按钮的背景", `color-mix(in oklab, ${ref("default")} 50%, transparent)`),
    token("default-soft-hover", "轻量中性悬停", "低强调按钮的悬停背景", `color-mix(in oklab, ${ref("default")} 60%, transparent)`),
    token("default-soft-foreground", "轻量中性内容", "低强调控件上的内容", ref("default-foreground")),
  ] },
  { id: "status", name: "状态与反馈", description: "状态同时配合文字和图标，避免只依靠颜色传递信息。", tokens: [
    ...([ ["success", "成功", "完成、通过与有效", 70], ["warning", "警告", "需注意、需复核", 65], ["danger", "危险", "错误、删除与破坏性操作", 80] ] as const).flatMap(([key, name, usage, percent]) => [
      token(key, `${name}状态`, usage),
      token(`${key}-foreground`, `${name}实色内容`, `${name}实色底上的文字与图标`),
      token(`${key}-hover`, `${name}悬停`, `${name}实色控件悬停`, mix(key, 90, `${key}-foreground`)),
      token(`${key}-soft`, `${name}轻量背景`, `Chip、Alert 等${name}提示`, `color-mix(in oklab, ${ref(key)} 15%, transparent)`),
      token(`${key}-soft-hover`, `${name}轻量悬停`, `轻量${name}提示的悬停`, `color-mix(in oklab, ${ref(key)} 20%, transparent)`),
      token(`${key}-soft-foreground`, `${name}轻量内容`, `轻量${name}提示上的文字`, mix(key, percent, "foreground")),
    ]),
  ] },
  { id: "field", name: "输入与边界", description: "从默认到悬停、聚焦与错误，输入状态始终完整。", tokens: [
    token("field-background", "输入背景", "Input、Textarea 与 Select"),
    token("field-foreground", "输入内容", "已填写的字段值", ref("foreground")),
    token("field-placeholder", "输入占位", "空字段的占位文字", ref("muted")),
    token("field-border", "输入边框", "输入字段的默认描边"),
    token("field-hover", "输入悬停", "字段悬停时的背景", `color-mix(in oklab, ${ref("field-background")} 90%, ${ref("field-foreground")} 2%)`),
    token("field-focus", "输入聚焦", "字段聚焦时的背景", ref("field-background")),
    token("field-border-hover", "输入悬停边框", "字段悬停时的描边", `color-mix(in oklab, ${ref("field-border")} 88%, ${ref("field-foreground")} 10%)`),
    token("field-border-focus", "输入聚焦边框", "字段聚焦时的描边", `color-mix(in oklab, ${ref("field-border")} 74%, ${ref("field-foreground")} 22%)`),
    token("field-invalid", "输入错误边框", "字段校验失败时的描边", ref("danger")),
    token("border", "基础边框", "容器与控件外边界"),
    token("border-secondary", "二级边框", "较强的控件边界", mix("surface", 78, "surface-foreground")),
    token("border-tertiary", "三级边框", "高强调边界", mix("surface", 66, "surface-foreground")),
    token("separator", "基础分隔", "区块分隔线与拖拽柄"),
    token("separator-secondary", "二级分隔", "轻量内容分隔", mix("surface", 85, "surface-foreground")),
    token("separator-tertiary", "三级分隔", "更强的内部内容分隔", mix("surface", 81, "surface-foreground")),
    token("focus", "焦点环", "键盘聚焦时的外圈", ref("accent")),
  ] },
  { id: "button", name: "按钮与选择控件", description: "组件槽位默认跟随语义色，也可以单独覆盖。", tokens: [
    token("button-primary", "主按钮背景", "提交、新建等主要行动", ref("accent")),
    token("button-primary-foreground", "主按钮内容", "主按钮上的文字与图标", ref("accent-foreground")),
    token("button-primary-hover", "主按钮悬停", "主按钮悬停时的背景", ref("accent-hover")),
    token("button-secondary", "次按钮背景", "保存草稿等次要行动", ref("default")),
    token("button-secondary-foreground", "次按钮内容", "次按钮上的文字与图标", ref("default-foreground")),
    token("button-secondary-hover", "次按钮悬停", "次按钮悬停时的背景", ref("default-hover")),
    token("button-ghost", "轻量按钮背景", "低强调、取消与工具操作", "transparent"),
    token("button-ghost-foreground", "轻量按钮内容", "低强调按钮上的内容", ref("foreground")),
    token("button-ghost-hover", "轻量按钮悬停", "低强调操作的悬停底色", ref("surface-secondary")),
    token("button-danger", "危险按钮背景", "删除等危险操作", ref("danger-soft")),
    token("button-danger-foreground", "危险按钮内容", "危险操作的文字与图标", ref("danger-soft-foreground")),
    token("button-danger-hover", "危险按钮悬停", "危险按钮的悬停背景", ref("danger-soft-hover")),
    token("disabled", "禁用控件背景", "不可用的按钮与字段", ref("surface-secondary")),
    token("disabled-foreground", "禁用控件内容", "仍需可读的不可用内容", ref("muted")),
    token("segment", "选中分段背景", "分段 Tabs 的选中块"),
    token("segment-foreground", "选中分段内容", "选中分段上的文字", ref("foreground")),
    token("control", "选择控件背景", "Checkbox、Switch 的未选中底", ref("default")),
    token("control-selected", "选择控件选中", "Checkbox、Switch 的选中底", ref("accent")),
    token("control-foreground", "选择控件标记", "选中勾选标记或滑块", ref("accent-foreground")),
    token("progress-track", "进度轨道", "进度条的未完成部分", ref("surface-tertiary")),
    token("progress-indicator", "进度指示", "进度条的已完成部分", ref("accent")),
  ] },
  { id: "navigation", name: "导航与数据", description: "侧栏、菜单和图表也遵循同一套主题。", tokens: [
    token("sidebar", "侧栏背景", "应用的固定侧栏，与底层画布一致", ref("background")),
    token("sidebar-foreground", "侧栏内容", "普通导航条目的文字", ref("foreground")),
    token("sidebar-selected", "导航选中背景", "当前页面的导航底色", ref("accent-soft")),
    token("sidebar-selected-foreground", "导航选中内容", "当前页面的导航文字", ref("accent-soft-foreground")),
    token("sidebar-border", "侧栏边界", "侧栏分隔与描边", ref("border")),
    token("chart-1", "数据系列一", "主要数据系列", ref("accent")),
    token("chart-2", "数据系列二", "辅助数据系列", ref("success")),
    token("chart-3", "数据系列三", "对比数据系列", ref("warning")),
    token("chart-4", "数据系列四", "中性数据系列", ref("muted")),
    token("chart-5", "数据系列五", "异常数据系列", ref("danger")),
  ] },
  { id: "primitive", name: "基础原色", description: "模式无关的底层原色；组件优先使用上面的功能角色。", tokens: [
    token("white", "绝对白", "白色原始基准", "oklch(100% 0 0)"),
    token("black", "绝对黑", "黑色原始基准与遮罩", "oklch(0% 0 0)"),
    token("snow", "明亮前景原色", "深底上的原始前景", "oklch(0.9911 0 0)"),
    token("eclipse", "深沉前景原色", "浅底上的原始前景", "oklch(0.2103 0.0059 285.89)"),
  ] },
];
export const allTokens = tokenGroups.flatMap((group) => group.tokens);
const tokenKeys = new Set(allTokens.map((entry) => entry.key));
const c = source.color;
const studio: Record<string, string> = {
  background: c.canvas, foreground: c.ink, surface: c.surface,
  "surface-secondary": c.surfaceSubtle, "surface-tertiary": c.surfaceMuted,
  muted: c.muted, default: c.surfaceMuted, accent: c.accent,
  "accent-foreground": c.surface,
  success: c.success, "success-foreground": c.surface,
  warning: c.warning, "warning-foreground": c.surface,
  danger: c.danger, "danger-foreground": c.surface,
  border: c.line, separator: c.lineStrong,
  "field-background": c.surface, "field-border": c.lineStrong, segment: c.surface,
};
export function isThemeId(value: unknown): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}
export function isEditableColor(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 200 || /var\(|url\(|env\(/i.test(value)) return false;
  return /^(?:#[\da-f]{3}|#[\da-f]{4}|#[\da-f]{6}|#[\da-f]{8}|(?:oklch|oklab|rgba?|hsla?|color)\([\d\w.%+,/\s-]+\)|transparent)$/i.test(value.trim());
}
export function resolveTheme(id: ThemeId, overrides: Record<string, string> = {}) {
  const palette: Record<string, string> = id === "studio" ? studio : source.themes[id];
  const values: Record<string, string> = {};
  for (const entry of allTokens) values[entry.key] = overrides[entry.key] ?? palette[entry.key] ?? entry.value ?? "transparent";
  return values;
}

export type ColorConcept = { value: string; roles: ColorToken[] };
export function getThemeConcepts(id: ThemeId, colorIdentity: (value: string) => string, overrides: Record<string, string> = {}): ColorConcept[] {
  const values = resolveTheme(id, overrides);
  const concepts = new Map<string, ColorConcept>();
  for (const group of tokenGroups) {
    if (group.id === "primitive") continue;
    for (const role of group.tokens) {
      const value = values[role.key];
      if (!isEditableColor(value)) continue;
      const identity = colorIdentity(value);
      if (identity === "transparent") continue;
      const existing = concepts.get(identity);
      if (existing) existing.roles.push(role);
      else concepts.set(identity, { value, roles: [role] });
    }
  }
  return [...concepts.values()];
}

// Bridge the semantic palette to both shadcn slots and the original showcase tokens.
const aliases: Record<string, string> = {
  background: "background", foreground: "foreground", card: "surface", "card-foreground": "surface-foreground",
  popover: "overlay", "popover-foreground": "overlay-foreground", primary: "button-primary", "primary-foreground": "button-primary-foreground",
  secondary: "button-secondary", "secondary-foreground": "button-secondary-foreground", muted: "surface-secondary", "muted-foreground": "muted",
  accent: "accent-soft", "accent-foreground": "accent-soft-foreground", destructive: "danger", border: "border", input: "field-border", ring: "focus",
  sidebar: "sidebar", "sidebar-foreground": "sidebar-foreground", "sidebar-primary": "accent", "sidebar-primary-foreground": "accent-foreground",
  "sidebar-accent": "sidebar-selected", "sidebar-accent-foreground": "sidebar-selected-foreground", "sidebar-border": "sidebar-border", "sidebar-ring": "focus",
  "ds-color-canvas": "background", "ds-color-surface": "surface", "ds-color-surface-subtle": "surface-secondary", "ds-color-surface-muted": "surface-tertiary",
  "ds-color-ink": "foreground", "ds-color-ink-soft": "foreground", "ds-color-muted": "muted", "ds-color-muted-soft": "muted",
  "ds-color-line": "border", "ds-color-line-strong": "border-secondary", "ds-color-accent": "accent", "ds-color-accent-hover": "accent-hover",
  "ds-color-accent-soft": "accent-soft", "ds-color-accent-ink": "accent-soft-foreground", "ds-color-focus-ring": "focus",
  "ds-color-success": "success", "ds-color-success-soft": "success-soft", "ds-color-warning": "warning", "ds-color-warning-soft": "warning-soft",
  "ds-color-danger": "danger", "ds-color-danger-soft": "danger-soft", "ds-color-preview-canvas": "background", "ds-color-preview-rail": "surface-secondary", "ds-color-preview-selected": "accent-soft",
  "chart-1": "chart-1", "chart-2": "chart-2", "chart-3": "chart-3", "chart-4": "chart-4", "chart-5": "chart-5",
};
export function themeStyle(id: ThemeId, overrides: Record<string, string> = {}): Record<string, string> {
  const values = resolveTheme(id, overrides);
  const style: Record<string, string> = {
    colorScheme: id === "night" ? "dark" : "light",
    "--shadow-soft": source.shadow.soft,
    "--shadow-float": source.shadow.float,
  };
  for (const [key, value] of Object.entries(values)) style[`--theme-${key}`] = value;
  for (const [key, value] of Object.entries(aliases)) style[`--${key}`] = ref(value);
  if (id === "night") {
    style["--shadow-soft"] = "none";
    style["--shadow-float"] = "0 0 0 1px rgb(255 255 255 / 15%)";
  }
  return style;
}
export type SavedTheme = { version: 1; activeId: ThemeId; overrides: ThemeOverrides; savedAt: string };
export function parseSavedTheme(raw: string | null): SavedTheme | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (data?.version !== 1 || !isThemeId(data.activeId) || !data.overrides || typeof data.overrides !== "object" || Array.isArray(data.overrides) || typeof data.savedAt !== "string") return null;
    if (!Number.isFinite(Date.parse(data.savedAt))) return null;
    const overrides: ThemeOverrides = {};
    for (const [id, entries] of Object.entries(data.overrides)) {
      if (!isThemeId(id) || !entries || typeof entries !== "object" || Array.isArray(entries)) return null;
      const cleaned: Record<string, string> = {};
      for (const [key, value] of Object.entries(entries)) {
        if (!tokenKeys.has(key) || !isEditableColor(value)) return null;
        cleaned[key] = value.trim();
      }
      if (Object.keys(cleaned).length) overrides[id] = cleaned;
    }
    return { version: 1, activeId: data.activeId, overrides, savedAt: data.savedAt };
  } catch { return null; }
}
export function themeBootScript() {
  const defaults = JSON.stringify(Object.fromEntries(themes.map((theme) => [theme.id, themeStyle(theme.id)])));
  const validKeys = JSON.stringify(allTokens.map((entry) => entry.key));
  return `(()=>{try{const s=JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}));const p=${defaults};if(s?.version!==1||!Object.hasOwn(p,s.activeId))return;const root=document.documentElement;for(const [k,v]of Object.entries(p[s.activeId])){if(k==='colorScheme')root.style.colorScheme=v;else root.style.setProperty(k,v)}const allowed=new Set(${validKeys});for(const[k,v]of Object.entries(s.overrides?.[s.activeId]??{})){if(allowed.has(k)&&typeof v==='string'&&v.length<=200&&!/var\\(|url\\(|env\\(/i.test(v)&&CSS.supports('color',v))root.style.setProperty('--theme-'+k,v)}root.classList.toggle('dark',s.activeId==='night');root.dataset.theme=s.activeId}catch{}})();`;
}
