"use client";

import { ArrowUpRight, Check, Copy, Layers3, Monitor, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";

type PatternCategory = "首屏" | "内容浏览" | "数据展示" | "导航与转场";
type PatternKind =
  | "immersive"
  | "split"
  | "search"
  | "waterfall"
  | "rail"
  | "feed"
  | "focus"
  | "bento"
  | "compare"
  | "timeline"
  | "sticky"
  | "bottom";
type ViewMode = "web" | "mobile";

type Pattern = {
  id: string;
  kind: PatternKind;
  category: PatternCategory;
  index: string;
  title: string;
  english: string;
  summary: string;
  prompt: string;
  traits: string[];
};

const categories: Array<"全部" | PatternCategory> = ["全部", "首屏", "内容浏览", "数据展示", "导航与转场"];

const patterns: Pattern[] = [
  { id: "immersive", kind: "immersive", category: "首屏", index: "01", title: "沉浸式首屏", english: "Immersive Hero", summary: "让背景图或视频占据第一视觉层，标题贴着画面底部浮现，先建立氛围，再引导滚动。", prompt: "沉浸式首屏模块，满宽背景图，顶部到下方的渐变遮罩，标题悬浮在画面底部，保留一个向下探索的动作。", traits: ["满宽背景", "遮罩叠字", "低密度", "滚动引导"] },
  { id: "split", kind: "split", category: "首屏", index: "02", title: "分栏式首屏", english: "Split Hero", summary: "把一句核心价值和一个产品画面并置，让用户同时理解“它是什么”和“它长什么样”。", prompt: "分栏式首屏，左侧是大标题和一句价值主张，右侧是产品界面预览，桌面端左右并置，移动端上下堆叠。", traits: ["左右分栏", "价值主张", "产品预览", "响应式堆叠"] },
  { id: "search", kind: "search", category: "首屏", index: "03", title: "搜索入口首屏", english: "Search-led Hero", summary: "把搜索框作为页面主角，用一个动作直接开始任务，适合知识库、资源库和工具型产品。", prompt: "搜索入口首屏，页面中央放大搜索框，标题说明可以找到什么，下方给出热门建议和最近访问，视觉保持极简。", traits: ["单一入口", "大搜索框", "建议词", "任务导向"] },
  { id: "waterfall", kind: "waterfall", category: "内容浏览", index: "04", title: "瀑布流画廊", english: "Masonry Gallery", summary: "不同高度的内容块按列自然下落，用户在连续滚动中不断发现下一张图或下一件作品。", prompt: "瀑布流内容模块，多列不等高卡片，图片保持原始比例，间距紧凑但有呼吸，适合灵感、作品和收藏。", traits: ["多列布局", "不等高", "原比例", "连续发现"] },
  { id: "rail", kind: "rail", category: "内容浏览", index: "05", title: "横向滑轨", english: "Horizontal Rail", summary: "用一条横向内容带承载同类项目，露出下一张卡片边缘，暗示这里可以继续探索。", prompt: "横向滑轨模块，一行横向卡片，首尾露出下一项，配左右切换按钮和当前进度，移动端支持手势滑动。", traits: ["横向滚动", "露出下一项", "进度提示", "手势友好"] },
  { id: "feed", kind: "feed", category: "内容浏览", index: "06", title: "编辑流列表", english: "Editorial Feed", summary: "用编号、日期、作者和标题组成有阅读顺序的内容列表，适合文章、日志和活动日程。", prompt: "编辑流内容列表，编号和日期固定在左侧，标题和摘要形成清晰阅读列，细分隔线控制节奏，支持按时间浏览。", traits: ["编号导航", "元数据", "细分隔线", "阅读顺序"] },
  { id: "focus", kind: "focus", category: "数据展示", index: "07", title: "聚焦式卡片", english: "Focused Metric", summary: "用一张大卡片突出一个最重要的指标或动作，辅助信息降级处理，适合首页摘要。", prompt: "聚焦式数据卡片，大数字突出一个核心指标，配短标题、趋势和一个动作，圆角较大，留白充足，信息少但重点明确。", traits: ["单一指标", "大数字", "趋势辅助", "低认知负担"] },
  { id: "bento", kind: "bento", category: "数据展示", index: "08", title: "Bento 摘要", english: "Bento Summary", summary: "用大小不同的模块把总览、快捷操作和状态放在同一屏，适合工作台和 AI 产品首页。", prompt: "Bento 数据摘要模块，大小不一的圆角卡片组成网格，主卡片突出核心指标，辅卡片放快捷入口、状态和小图表。", traits: ["模块网格", "主次尺寸", "快捷操作", "同屏总览"] },
  { id: "compare", kind: "compare", category: "数据展示", index: "09", title: "对比矩阵", english: "Comparison Matrix", summary: "把多个选项放进同一套维度里比较，减少来回跳转，适合方案、套餐和功能评估。", prompt: "对比矩阵模块，列是不同方案，行是比较维度，首列固定，重点差异用强调色和图标标出，移动端改为横向滑动。", traits: ["固定首列", "维度对齐", "差异强调", "方案决策"] },
  { id: "timeline", kind: "timeline", category: "数据展示", index: "10", title: "时间线进度", english: "Timeline Progress", summary: "用一条时间轴把状态、节点和下一步串起来，适合订单、项目、流程和成长记录。", prompt: "时间线进度模块，垂直节点连接已完成、当前和待处理状态，每个节点有日期、标题和一句说明，当前节点高亮。", traits: ["节点连接", "状态层级", "当前高亮", "下一步明确"] },
  { id: "sticky", kind: "sticky", category: "导航与转场", index: "11", title: "吸顶分段导航", english: "Sticky Section Nav", summary: "随着内容滚动保持当前章节和关键动作可见，让长页面始终有方向感。", prompt: "吸顶分段导航，滚动后固定在顶部，显示当前章节、章节切换和一个主要动作，背景加轻微模糊和底部边界。", traits: ["滚动吸顶", "当前章节", "快速跳转", "持续动作"] },
  { id: "bottom", kind: "bottom", category: "导航与转场", index: "12", title: "移动端底部导航", english: "Mobile Bottom Nav", summary: "把高频入口放在拇指可达区域，用 3 到 5 个目的地保持移动端的稳定方向感。", prompt: "移动端底部导航，固定在屏幕底部，3 到 5 个主要入口，当前项使用强调色和图标状态，带安全区留白。", traits: ["拇指可达", "固定底部", "3—5 入口", "当前状态"] },
];

function PatternArt({ kind, view }: { kind: PatternKind; view: ViewMode }) {
  const frame = `pattern-art ${view === "mobile" ? "is-mobile" : ""}`;
  if (kind === "immersive") return <div className={`${frame} pattern-immersive`}><span>FIELD NOTE / 01</span><strong>Follow<br /><i>the light.</i></strong><small>Scroll to explore　↘</small></div>;
  if (kind === "split") return <div className={`${frame} pattern-split`}><div><small>NEW RELEASE</small><strong>Build a<br /><i>better flow.</i></strong><button>Explore product　↗</button></div><div className="split-screen"><b>◒</b><span>Workspace<br />overview</span><i /></div></div>;
  if (kind === "search") return <div className={`${frame} pattern-search`}><small>WHAT ARE YOU LOOKING FOR?</small><strong>Find your<br /><i>next idea.</i></strong><div className="search-field"><span>⌕　Search anything</span><b>↵</b></div><p>Recent　·　Popular topics　·　Saved</p></div>;
  if (kind === "waterfall") return <div className={`${frame} pattern-waterfall`}><div className="pattern-mini-head">COLLECTED / 24 <span>FILTER ↘</span></div><div className="pattern-water-grid"><i /><i /><i /><i /><i /><i /></div></div>;
  if (kind === "rail") return <div className={`${frame} pattern-rail`}><div className="pattern-mini-head">CURATED FOR YOU <span>01 / 08　↗</span></div><div className="rail-track"><i><b>01</b><span>Quiet<br />morning</span></i><i><b>02</b><span>Soft<br />signals</span></i><i><b>03</b><span>New<br />rituals</span></i></div><div className="rail-line"><i /></div></div>;
  if (kind === "feed") return <div className={`${frame} pattern-feed`}><div className="pattern-mini-head">JOURNAL / 2026 <span>READ ALL ↗</span></div>{["The quiet between things.", "A field guide to slower ways.", "Notes from the open studio."].map((item, index) => <div className="feed-row" key={item}><span>0{index + 1}</span><strong>{item}</strong><small>OCT {26 - index * 3}</small><b>↗</b></div>)}</div>;
  if (kind === "focus") return <div className={`${frame} pattern-focus`}><small>TODAY&apos;S FOCUS</small><strong>78<span>%</span></strong><p>Weekly progress　↗ 12.4%</p><div className="focus-progress"><i /></div></div>;
  if (kind === "bento") return <div className={`${frame} pattern-bento`}><div className="bento-summary-main"><small>WEEKLY PROGRESS</small><strong>78%</strong><span>↑ 12.4%</span></div><div className="bento-summary-side"><i>☼<small>FOCUS</small><b>02:48</b></i><i>✦<small>QUICK START</small><b>＋ New</b></i></div></div>;
  if (kind === "compare") return <div className={`${frame} pattern-compare`}><div className="compare-head"><span>FEATURE</span><b>STARTER</b><b>PRO</b></div>{["Projects", "Automation", "Team seats", "Support"].map((item, index) => <div className="compare-row" key={item}><span>{item}</span><i>{index === 2 ? "1" : "✓"}</i><b>{index === 2 ? "∞" : "✓"}</b></div>)}</div>;
  if (kind === "timeline") return <div className={`${frame} pattern-timeline`}><small>PROJECT / LAUNCH PLAN</small>{["Research", "Prototype", "Ship"].map((item, index) => <div className={`timeline-row ${index === 1 ? "current" : index === 2 ? "next" : ""}`} key={item}><i /><span><b>{item}</b><small>{index === 0 ? "Complete · Oct 12" : index === 1 ? "In progress · Today" : "Coming next"}</small></span></div>)}</div>;
  if (kind === "sticky") return <div className={`${frame} pattern-sticky`}><div className="sticky-browser"><span>01 Overview</span><span>02 Details</span><span className="active">03 Notes</span><b>Get started ↗</b></div><strong>Long-form<br /><i>storytelling.</i></strong><div className="sticky-lines"><i /><i /><i /></div></div>;
  return <div className={`${frame} pattern-bottom`}><div className="bottom-content"><small>PROFILE</small><strong>Your space<br /><i>is ready.</i></strong><div className="bottom-card" /></div><div className="bottom-nav"><i>⌂<small>Home</small></i><i>◌<small>Explore</small></i><i className="active">＋<small>Create</small></i><i>◒<small>Profile</small></i></div></div>;
}

function CopyPattern({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { setCopied(false); }
  }
  return <button className="pattern-prompt" onClick={copy} type="button" title="复制这段描述"><span><small>可直接交给 AI</small>{text}</span>{copied ? <Check size={15} /> : <Copy size={15} />}</button>;
}

export function UIPatternAtlas() {
  const [view, setView] = useState<ViewMode>("web");
  const [category, setCategory] = useState<(typeof categories)[number]>("全部");
  const [activeId, setActiveId] = useState("immersive");
  const filtered = useMemo(() => category === "全部" ? patterns : patterns.filter((pattern) => pattern.category === category), [category]);
  const active = filtered.find((pattern) => pattern.id === activeId) ?? filtered[0] ?? patterns[0];

  return (
    <main className="pattern-atlas" aria-labelledby="patterns-title">
      <div className="pattern-hero">
        <div><div className="pattern-kicker"><Layers3 size={14} /> UI PATTERN ATLAS <span>／</span> 12 SECTIONS</div><h1 id="patterns-title">先决定内容<br /><em>怎样被组织。</em></h1><p>风格回答“看起来是什么气质”，模式回答“这一块内容如何出现”。从一个页面区域出发，选择它的结构、重点和行动路径。</p></div>
        <div className="pattern-hero-note"><span>STYLE</span><strong>气质</strong><i>→</i><span>PATTERN</span><strong>结构</strong><small>先定结构，再选风格</small></div>
      </div>
      <div className="pattern-toolbar"><div className="pattern-category-tabs" role="tablist" aria-label="UI 模式分类">{categories.map((item) => <button className={category === item ? "active" : ""} key={item} onClick={() => setCategory(item)} role="tab" type="button" aria-selected={category === item}>{item}</button>)}</div><div className="pattern-view-toggle" role="group" aria-label="选择预览设备"><button className={view === "web" ? "active" : ""} onClick={() => setView("web")} type="button"><Monitor size={15} /> Web</button><button className={view === "mobile" ? "active" : ""} onClick={() => setView("mobile")} type="button"><Smartphone size={15} /> Mobile</button></div></div>
      <div className="pattern-grid">{filtered.map((pattern) => <article className={`pattern-card ${active.id === pattern.id ? "is-active" : ""}`} key={pattern.id} onClick={() => setActiveId(pattern.id)}><PatternArt kind={pattern.kind} view={view} /><div className="pattern-card-body"><div className="pattern-card-heading"><span className="pattern-index">{pattern.index}</span><div><span className="pattern-category">{pattern.category}</span><h2>{pattern.title}</h2><p>{pattern.english}</p></div><ArrowUpRight className="pattern-arrow" size={18} /></div><p className="pattern-summary">{pattern.summary}</p><div className="pattern-traits">{pattern.traits.map((trait) => <span key={trait}>{trait}</span>)}</div><CopyPattern text={pattern.prompt} /></div></article>)}</div>
      <section className="pattern-explainer" aria-labelledby="pattern-explainer-title"><div><span>ACTIVE PATTERN / {active.index} · {active.title}</span><h2 id="pattern-explainer-title">模块模式先回答，<br /><em>用户下一步要做什么。</em></h2><p>同一种视觉风格，可以套在不同模式上。先选结构，再决定它使用什么颜色、字体和材质。</p></div><div className="pattern-explainer-list"><div><span>01</span><strong>目标</strong><p>这个区域让用户发现、阅读、比较，还是立即行动？</p></div><div><span>02</span><strong>层级</strong><p>什么内容必须先看到，哪些信息可以滚动后再出现？</p></div><div><span>03</span><strong>路径</strong><p>用户完成当前任务后，下一步应该跳转、继续浏览还是提交？</p></div><div><span>04</span><strong>响应式</strong><p>同一结构在移动端是堆叠、滑动、折叠，还是固定在底部？</p></div></div></section>
      <section className="pattern-bridge"><div><span>STYLE × PATTERN</span><h2>把两句话合在一起，<br /><em>AI 才能真正理解你的界面。</em></h2></div><div className="pattern-bridge-example"><small>示例描述</small><p>使用“<b>安静的编辑式设计系统</b>”，搭配“<b>分栏式首屏</b>”：左侧大标题和价值主张，右侧产品预览，浅色画布、细边界、宽松留白，移动端上下堆叠。</p><CopyPattern text="安静的编辑式设计系统，搭配分栏式首屏：左侧大标题和价值主张，右侧产品预览，浅色画布、细边界、宽松留白，移动端上下堆叠。" /></div></section>
    </main>
  );
}
