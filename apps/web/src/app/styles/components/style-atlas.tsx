"use client";

import {
  ArrowUpRight,
  Check,
  Copy,
  Layers3,
  Monitor,
  Smartphone,
} from "lucide-react";
import { useMemo, useState } from "react";

type ViewMode = "web" | "mobile";
type StyleKind =
  | "immersive"
  | "focus"
  | "editorial"
  | "waterfall"
  | "poster"
  | "collage"
  | "bento"
  | "glass"
  | "brutalist"
  | "soft"
  | "terminal"
  | "swiss";

type StyleCard = {
  id: string;
  kind: StyleKind;
  index: string;
  title: string;
  english: string;
  eyebrow: string;
  description: string;
  prompt: string;
  traits: string[];
};

const styles: StyleCard[] = [
  {
    id: "immersive",
    kind: "immersive",
    index: "01",
    title: "沉浸式首屏",
    english: "Immersive Hero",
    eyebrow: "氛围先于信息",
    description:
      "让一张大图、视频或渐变成为第一视觉层，内容像从画面里浮出来。顶部常用深色遮罩，标题压在图片下沿，滚动后再逐步展开信息。",
    prompt:
      "沉浸式首屏，满宽背景图，顶部到下方的黑色渐变遮罩，标题悬浮在画面底部，白色大字号，信息密度低，滚动后进入内容区。",
    traits: ["满宽背景", "渐变遮罩", "标题叠图", "低信息密度"],
  },
  {
    id: "focus",
    kind: "focus",
    index: "02",
    title: "聚焦式卡片",
    english: "Focused Cards",
    eyebrow: "少即是重点",
    description:
      "用大字号、宽松留白和明显圆角把内容收束在少数几个重点上。适合产品首页、数据摘要和需要让用户快速做决定的场景。",
    prompt:
      "聚焦式卡片布局，大标题和短句，卡片圆角较大，内容少但层级清晰，留白充足，使用柔和阴影和单一强调色。",
    traits: ["大字号", "大圆角", "宽留白", "单一强调色"],
  },
  {
    id: "editorial",
    kind: "editorial",
    index: "03",
    title: "编辑部叙事",
    english: "Editorial Grid",
    eyebrow: "像杂志一样阅读",
    description:
      "把页面当成一张有节奏的版面：衬线标题、细分隔线、不对称网格与编号导览，让内容有观点、有阅读顺序。",
    prompt:
      "杂志编辑部风格，不对称网格，衬线大标题，细线分隔，编号导航，黑白为主配一个亮色，像高端文化刊物一样克制。",
    traits: ["不对称网格", "衬线标题", "细线分隔", "阅读顺序"],
  },
  {
    id: "waterfall",
    kind: "waterfall",
    index: "04",
    title: "瀑布流画廊",
    english: "Masonry Flow",
    eyebrow: "让内容自然下落",
    description:
      "不同高度的内容块按列排列，像瀑布一样向下延伸。图片尺寸不必统一，重点是让用户在连续浏览中不断发现下一张。",
    prompt:
      "瀑布流画廊，三列不等高图片卡片，卡片间距紧凑但有呼吸，图片保持原始比例，标题简短，适合灵感收藏和作品探索。",
    traits: ["多列布局", "不等高", "原比例图片", "连续浏览"],
  },
  {
    id: "poster",
    kind: "poster",
    index: "05",
    title: "海报式构图",
    english: "Poster Layout",
    eyebrow: "一句话占据舞台",
    description:
      "把一个核心标题当成主视觉来排版，字可以很大、很偏、甚至溢出画布。辅助信息像海报上的日期和署名，围绕主句服务。",
    prompt:
      "海报风网页，大号压缩字体，标题占据画面大部分，强烈的黑白对比，少量红色标注，元素像印刷海报一样错位和出血。",
    traits: ["超大标题", "强对比", "错位排版", "印刷标注"],
  },
  {
    id: "collage",
    kind: "collage",
    index: "06",
    title: "叠图拼贴",
    english: "Layered Collage",
    eyebrow: "画面之间有关系",
    description:
      "让两张或多张图片互相压叠，配合旋转、边框、贴纸和手写标记，制造像剪贴簿或展览墙一样的叙事感。",
    prompt:
      "两张图片叠放的海报质感，一张主图一张偏移小图，带细边框和轻微旋转，加入日期、手写注释与胶带细节，层次丰富但主次分明。",
    traits: ["双图叠放", "轻微旋转", "边框细节", "手写注释"],
  },
  {
    id: "bento",
    kind: "bento",
    index: "07",
    title: "Bento 模块",
    english: "Bento System",
    eyebrow: "信息像积木组合",
    description:
      "用不同尺寸、不同权重的模块拼成一个完整首页。每块都能独立阅读，也能通过颜色和圆角保持整体秩序，适合产品、AI 工具和个人工作台。",
    prompt:
      "Bento 模块化布局，大小不一的圆角卡片组成网格，主卡片突出核心指标，辅卡片承载快捷入口和状态，间距统一，信息密度中等。",
    traits: ["模块化网格", "尺寸对比", "核心指标", "快捷入口"],
  },
  {
    id: "glass",
    kind: "glass",
    index: "08",
    title: "玻璃拟态",
    english: "Glassmorphism",
    eyebrow: "透明层叠出空间",
    description:
      "在有颜色和光源的背景上叠加半透明卡片，用模糊、细边框和柔和阴影做出空间层次。它的重点是透气和层次，不是把所有东西都变成透明。",
    prompt:
      "玻璃拟态界面，深色渐变背景，半透明白色卡片，背景模糊和细描边，柔和光晕，层级悬浮，文字保持高对比和清晰可读。",
    traits: ["半透明", "背景模糊", "柔和光晕", "空间层次"],
  },
  {
    id: "brutalist",
    kind: "brutalist",
    index: "09",
    title: "新粗野主义",
    english: "Neo Brutalism",
    eyebrow: "把规则变成态度",
    description:
      "粗黑边框、硬阴影、亮色块和直白的排版，刻意保留一点不平滑和不对称。适合品牌活动、创意工具和需要强识别度的年轻产品。",
    prompt:
      "新粗野主义网页，纯色背景，粗黑描边，硬朗偏移阴影，超大黑体，亮黄色和蓝色按钮，布局略微错位，直接、活泼、有冲击力。",
    traits: ["粗黑描边", "硬阴影", "亮色块", "刻意错位"],
  },
  {
    id: "soft",
    kind: "soft",
    index: "10",
    title: "柔和拟物",
    english: "Soft Neumorphism",
    eyebrow: "触感来自光影",
    description:
      "让控件像从背景里被轻轻推出来或按下去，依靠同色系明暗、内外阴影和低对比度建立触感。适合健康、专注和设备控制类界面。",
    prompt:
      "柔和拟物风格，浅色同色背景，圆润控件，使用一明一暗的双向阴影表现浮起和按压状态，低对比、安静、触感明确。",
    traits: ["同色背景", "双向阴影", "浮起按压", "低对比"],
  },
  {
    id: "terminal",
    kind: "terminal",
    index: "11",
    title: "深色数据台",
    english: "Dark Data Console",
    eyebrow: "信息密度就是氛围",
    description:
      "以深色底、等宽字体和荧光强调色建立工具感。模块边界清晰，数据、日志和状态同时出现，适合开发者工具、AI 控制台和监控面板。",
    prompt:
      "深色数据控制台，近黑背景，等宽字体，荧光绿色和琥珀色状态色，细网格和分隔线，高信息密度但层级明确，像专业监控仪表盘。",
    traits: ["近黑背景", "等宽字体", "荧光状态色", "高信息密度"],
  },
  {
    id: "swiss",
    kind: "swiss",
    index: "12",
    title: "瑞士网格",
    english: "Swiss International",
    eyebrow: "秩序本身就是视觉",
    description:
      "用严格网格、无衬线字体、少量颜色和明确对齐制造理性秩序。它不靠装饰吸引注意，而是用比例、编号和留白让信息变得可信。",
    prompt:
      "瑞士国际主义网格，白底黑字，严格对齐和清晰编号，无衬线字体，红色作为唯一强调色，留白充足，信息理性、精确、克制。",
    traits: ["严格对齐", "清晰编号", "唯一强调色", "理性留白"],
  },
];

function PreviewArt({ kind, view }: { kind: StyleKind; view: ViewMode }) {
  const frameClass = view === "mobile" ? "style-art-frame is-mobile" : "style-art-frame";

  if (kind === "immersive") {
    return (
      <div className={`${frameClass} art-immersive`}>
        <div className="immersive-orb" />
        <div className="immersive-lines" />
        <div className="immersive-content">
          <span>FIELD NOTE · 2026</span>
          <strong>Follow<br />the light.</strong>
          <small>Scroll to explore <ArrowUpRight size={12} /></small>
        </div>
      </div>
    );
  }

  if (kind === "focus") {
    return (
      <div className={`${frameClass} art-focus`}>
        <div className="focus-top"><span>Good morning</span><i>•••</i></div>
        <div className="focus-title">Make room<br /><em>for better.</em></div>
        <div className="focus-card"><div className="focus-icon">✦</div><div><b>Today&apos;s focus</b><small>One clear thing at a time.</small></div><ArrowUpRight size={15} /></div>
        <div className="focus-card muted"><div className="focus-bar" /><div><b>Deep work</b><small>02h 40m remaining</small></div></div>
      </div>
    );
  }

  if (kind === "editorial") {
    return (
      <div className={`${frameClass} art-editorial`}>
        <div className="editorial-meta"><span>VOL. 04</span><span>OBSERVATIONS / CULTURE</span><span>— 26</span></div>
        <div className="editorial-rule" />
        <div className="editorial-title">The quiet<br /><i>between</i><br />things.</div>
        <div className="editorial-foot"><span>01</span><p>A field guide to slower<br />ways of seeing.</p><span>↗</span></div>
      </div>
    );
  }

  if (kind === "waterfall") {
    return (
      <div className={`${frameClass} art-waterfall`}>
        <div className="waterfall-head"><b>Collected / 24</b><span>FILTER ↘</span></div>
        <div className="waterfall-grid">
          <div className="water-block water-a"><span>01</span></div>
          <div className="water-block water-b"><span>02</span></div>
          <div className="water-block water-c"><span>03</span></div>
          <div className="water-block water-d"><span>04</span></div>
          <div className="water-block water-e"><span>05</span></div>
          <div className="water-block water-f"><span>06</span></div>
        </div>
      </div>
    );
  }

  if (kind === "poster") {
    return (
      <div className={`${frameClass} art-poster`}>
        <span className="poster-stamp">STUDIO 26</span>
        <div className="poster-title">MAKE<br /><i>NOISE</i></div>
        <div className="poster-stripe" />
        <span className="poster-note">A visual essay<br />on being seen.</span>
        <span className="poster-index">05 / 12</span>
      </div>
    );
  }

  if (kind === "bento") {
    return (
      <div className={`${frameClass} art-bento`}>
        <div className="bento-head"><span>Good afternoon, Lin</span><i>⌁</i></div>
        <div className="bento-grid">
          <div className="bento-tile bento-primary"><small>WEEKLY PROGRESS</small><strong>78%</strong><span>↑ 12.4% this week</span></div>
          <div className="bento-tile bento-sun"><span>☼</span><small>FOCUS MODE</small><b>02:48</b></div>
          <div className="bento-tile bento-list"><small>QUICK START</small><p>✦ New project</p><p>＋ Invite a friend</p></div>
          <div className="bento-tile bento-note"><span>“</span><p>Make the next<br />step obvious.</p></div>
        </div>
      </div>
    );
  }

  if (kind === "glass") {
    return (
      <div className={`${frameClass} art-glass`}>
        <div className="glass-glow glass-glow-one" /><div className="glass-glow glass-glow-two" />
        <div className="glass-nav"><span>✦ aura</span><i>⌁　•••</i></div>
        <div className="glass-panel"><small>YOUR SPACE</small><strong>Good<br />energy.</strong><span>↗ Explore mood</span></div>
        <div className="glass-dock"><span>◒</span><span>◌</span><span>＋</span></div>
      </div>
    );
  }

  if (kind === "brutalist") {
    return (
      <div className={`${frameClass} art-brutalist`}>
        <div className="brutal-top"><span>NO. 09 / PLAYGROUND</span><b>MENU ☰</b></div>
        <div className="brutal-title">MAKE<br /><i>IT LOUD.</i></div>
        <div className="brutal-box">CLICK<br />TO BEGIN <ArrowUpRight size={18} /></div>
        <span className="brutal-footer">A DIGITAL PLACE FOR BIG IDEAS</span>
      </div>
    );
  }

  if (kind === "soft") {
    return (
      <div className={`${frameClass} art-soft`}>
        <div className="soft-head"><span>☁ breathe</span><i>•••</i></div>
        <div className="soft-orb">72</div>
        <p className="soft-caption">Your calm score<br /><b>↑ 8% this week</b></p>
        <div className="soft-controls"><span>−</span><b>25 min</b><span>＋</span></div>
      </div>
    );
  }

  if (kind === "terminal") {
    return (
      <div className={`${frameClass} art-terminal`}>
        <div className="terminal-bar"><span>●　●　●</span><b>agent / overview</b><i>⌘ K</i></div>
        <div className="terminal-content"><small>LIVE SYSTEMS / 11:42:08</small><strong>98.6<span>%</span></strong><div className="terminal-chart"><i /><i /><i /><i /><i /><i /><i /><i /><i /></div><p><em>●</em> All systems nominal</p></div>
      </div>
    );
  }

  if (kind === "swiss") {
    return (
      <div className={`${frameClass} art-swiss`}>
        <div className="swiss-top"><span>12</span><span>INTERFACE / 2026</span><b>↗</b></div>
        <div className="swiss-rule" />
        <div className="swiss-title">FORM<br /><i>FOLLOWS</i><br />FUNCTION</div>
        <div className="swiss-bottom"><span>01—04</span><p>Designing clarity<br />for complex systems.</p><b>●</b></div>
      </div>
    );
  }

  return (
    <div className={`${frameClass} art-collage`}>
      <div className="collage-back"><span>ARCHIVE<br />OF<br />MOTION</span></div>
      <div className="collage-front"><div className="collage-sun" /><span>STILL<br />LIFE<br />NO. 02</span></div>
      <span className="collage-tape tape-one" /><span className="collage-tape tape-two" />
      <span className="collage-date">OCT 26 — 2026</span>
    </div>
  );
}

function CopyPrompt({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button className="style-prompt" onClick={copy} type="button" title="复制这段描述">
      <span><small>可直接交给 AI</small>{text}</span>
      {copied ? <Check aria-hidden="true" size={15} /> : <Copy aria-hidden="true" size={15} />}
    </button>
  );
}

export function StyleAtlas() {
  const [view, setView] = useState<ViewMode>("web");
  const [activeId, setActiveId] = useState("immersive");
  const active = useMemo(() => styles.find((item) => item.id === activeId) ?? styles[0], [activeId]);

  return (
    <main className="style-atlas" aria-labelledby="styles-title">
      <div className="style-atlas-hero">
        <div>
          <div className="style-kicker"><Layers3 size={14} /> STYLE ATLAS <span>／</span> 12 PATTERNS</div>
          <h1 id="styles-title">把“感觉”说清楚，<br /><em>再开始做界面。</em></h1>
          <p>先选一种视觉叙事，再把它翻译成布局、比例和语气。这里收集常见的界面风格，也给出可以直接交给 AI 的准确描述。</p>
        </div>
        <div className="style-atlas-stats" aria-label="风格预览统计">
          <strong>12</strong><span>主流<br />风格</span>
          <i />
          <strong>02</strong><span>终端<br />视图</span>
        </div>
      </div>

      <div className="style-toolbar">
        <div className="style-filter-label">浏览视图 <span>选择画框比例，理解同一套风格在不同终端的变化</span></div>
        <div className="style-view-toggle" role="group" aria-label="选择预览设备">
          <button className={view === "web" ? "active" : ""} onClick={() => setView("web")} type="button"><Monitor size={15} /> Web</button>
          <button className={view === "mobile" ? "active" : ""} onClick={() => setView("mobile")} type="button"><Smartphone size={15} /> Mobile</button>
        </div>
      </div>

      <div className="style-atlas-grid">
        {styles.map((item) => (
          <article className={`style-card ${activeId === item.id ? "is-active" : ""}`} key={item.id} onClick={() => setActiveId(item.id)}>
            <PreviewArt kind={item.kind} view={view} />
            <div className="style-card-body">
              <div className="style-card-heading"><span className="style-index">{item.index}</span><div><span className="style-eyebrow">{item.eyebrow}</span><h2>{item.title}</h2><p>{item.english}</p></div><ArrowUpRight className="style-arrow" size={18} /></div>
              <p className="style-description">{item.description}</p>
              <div className="style-traits">{item.traits.map((trait) => <span key={trait}>{trait}</span>)}</div>
              <CopyPrompt text={item.prompt} />
            </div>
          </article>
        ))}
      </div>

      <section className="style-translation" aria-labelledby="translation-title">
        <div className="translation-heading"><span>ACTIVE VOCABULARY / {active.index}</span><h2 id="translation-title">描述一套风格时，<br /><em>把这四件事说出来。</em></h2><p>“好看”太宽泛。用下面四个维度给 AI 一个可以执行的画面。</p></div>
        <div className="translation-list">
          <div><span>01</span><strong>主视觉</strong><p>画面里最先被看到的东西：背景图、标题、单色块或一组图片。</p></div>
          <div><span>02</span><strong>布局结构</strong><p>内容怎么走：网格、瀑布流、单列聚焦，还是不对称的编辑部版式。</p></div>
          <div><span>03</span><strong>材质语气</strong><p>圆角大小、阴影、边框、噪点、纸张感，以及整体是克制还是热闹。</p></div>
          <div><span>04</span><strong>终端变化</strong><p>说明移动端是保留叠图、改成单列，还是把桌面端的留白压缩成滚动节奏。</p></div>
        </div>
      </section>
    </main>
  );
}
