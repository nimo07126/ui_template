import { tokens } from "@template/design-tokens";
import { Icon } from "@/components/theme-showcase/icon";
import styles from "./theme-tokens.module.css";

type SizeKey = keyof typeof tokens.type.size;
type LineKey = keyof typeof tokens.type.line;
type WeightKey = keyof typeof tokens.type.weight;
type TrackingKey = keyof typeof tokens.type.tracking;

type TypeSpecimen = {
  name: string;
  size: SizeKey;
  line: LineKey;
  weight: WeightKey;
  tracking: TrackingKey;
  sample: string;
  className: string;
};

type TypeCategory = {
  title: string;
  description: string;
  specimens: TypeSpecimen[];
};

const weightLabels: Record<WeightKey, string> = {
  regular: "常规",
  medium: "中等",
  semibold: "半粗",
  bold: "粗体",
};

const typeCategories: TypeCategory[] = [
  {
    title: "展示 Display",
    description: "用于品牌时刻与极少量的关键数字。展示字级保持克制，避免与产品内容争夺注意力。",
    specimens: [
      { name: "大号 Large", size: "displayLarge", line: "displayLarge", weight: "bold", tracking: "tight", sample: "澄序设计", className: styles.typeDisplayLarge },
      { name: "中号 Medium", size: "displayMedium", line: "displayMedium", weight: "bold", tracking: "tight", sample: "为内容留白", className: styles.typeDisplayMedium },
      { name: "小号 Small", size: "displaySmall", line: "displaySmall", weight: "bold", tracking: "tight", sample: "让重点浮现", className: styles.typeDisplaySmall },
    ],
  },
  {
    title: "标题 Heading",
    description: "用于页面、区块与卡片标题。按信息层级选用，不跨级跳跃。",
    specimens: [
      { name: "特大 XX Large", size: "headingXxl", line: "headingXxl", weight: "semibold", tracking: "tight", sample: "让信息有清晰层次", className: styles.typeHeadingXxl },
      { name: "超大 X Large", size: "headingXl", line: "headingXl", weight: "semibold", tracking: "tight", sample: "让信息易于理解", className: styles.typeHeadingXl },
      { name: "大号 Large", size: "headingLarge", line: "headingLarge", weight: "semibold", tracking: "tight", sample: "秩序让界面更从容", className: styles.typeHeadingLarge },
      { name: "中号 Medium", size: "headingMedium", line: "headingMedium", weight: "semibold", tracking: "tight", sample: "先看懂，再行动", className: styles.typeHeadingMedium },
      { name: "小号 Small", size: "headingSmall", line: "headingSmall", weight: "semibold", tracking: "tight", sample: "一致，但不单调", className: styles.typeHeadingSmall },
      { name: "特小 X Small", size: "headingXs", line: "headingXs", weight: "semibold", tracking: "normal", sample: "中文标题示例", className: styles.typeHeadingXs },
    ],
  },
  {
    title: "正文 Body",
    description: "用于段落、说明和长内容。正文行高略宽，帮助中文连续阅读。",
    specimens: [
      { name: "大号 Large", size: "bodyLarge", line: "bodyLarge", weight: "regular", tracking: "normal", sample: "清晰的层级，让每一段内容都更容易阅读。", className: styles.typeBodyLarge },
      { name: "中号 Medium", size: "bodyMedium", line: "bodyMedium", weight: "regular", tracking: "normal", sample: "界面保持安静，重要的信息自然浮现。", className: styles.typeBodyMedium },
      { name: "小号 Small", size: "bodySmall", line: "bodySmall", weight: "regular", tracking: "normal", sample: "为日常说明和辅助阅读提供稳定节奏。", className: styles.typeBodySmall },
      { name: "特小 X Small", size: "bodyXs", line: "bodyXs", weight: "regular", tracking: "normal", sample: "适用于简短、次级的补充信息。", className: styles.typeBodyXs },
    ],
  },
  {
    title: "标签 Label",
    description: "用于按钮、表单标签、状态和导航。字级较小，保持清晰、短促。",
    specimens: [
      { name: "大号 Large", size: "labelLarge", line: "labelLarge", weight: "medium", tracking: "normal", sample: "主要操作", className: styles.typeLabelLarge },
      { name: "中号 Medium", size: "labelMedium", line: "labelMedium", weight: "medium", tracking: "normal", sample: "进行中", className: styles.typeLabelMedium },
      { name: "小号 Small", size: "labelSmall", line: "labelSmall", weight: "medium", tracking: "normal", sample: "辅助说明", className: styles.typeLabelSmall },
    ],
  },
];

function toPixels(value: string) {
  const remValue = value.match(/^(\\d+(?:\\.\\d+)?)rem$/);
  if (!remValue) return value === "0" ? "0px" : value;

  const pixels = Number(remValue[1]) * 16;
  return `${Number.isInteger(pixels) ? pixels : pixels.toFixed(1)}px`;
}

function typeToken(category: "size" | "line", key: string) {
  const kebabKey = key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
  return `--type-${category}-${kebabKey}`;
}


const spacingSamples = [
  { name: "紧凑", token: "space-2", className: styles.space2 },
  { name: "常规", token: "space-4", className: styles.space4 },
  { name: "宽松", token: "space-6", className: styles.space6 },
  { name: "区块", token: "space-10", className: styles.space10 },
];

export function ThemeTokens({ section }: { section: "typography" | "spacing" }) {
  return (
    <>
      {section === "typography" && (
        <section aria-labelledby="type-title" className={`${styles.tokenSection} ${styles.typeSection}`} id="type">
        <div className={styles.sectionIntro}>
          <div className={styles.sectionIndex}><Icon name="type" /><span>字体层级</span></div>
          <h1 id="type-title">从展示到阅读，<br />每一级都有依据。</h1>
          <p>字体规范不只是几种字号示例。这里定义字体族、字号分类、行高、字重与字距，让不同页面能够使用同一套排版尺度。</p>
        </div>

        <dl className={styles.typeFoundation}>
          <div>
            <dt>字体族 Family</dt>
            <dd>系统中文无衬线</dd>
            <code>--type-family-sans</code>
          </div>
          <div>
            <dt>字重 Weight</dt>
            <dd className={styles.foundationValues}>
              {Object.entries(tokens.type.weight).map(([key, value]) => (
                <span key={key}>{value} · {weightLabels[key as WeightKey]}</span>
              ))}
            </dd>
            <code>--type-weight-*</code>
          </div>
          <div>
            <dt>字距 Tracking</dt>
            <dd className={styles.foundationValues}>
              {Object.entries(tokens.type.tracking).map(([key, value]) => (
                <span key={key}>{key === "tight" ? "紧凑" : "常规"} · {value === "0" ? "0px" : value}</span>
              ))}
            </dd>
            <code>--type-tracking-*</code>
          </div>
        </dl>

        <div className={styles.typeSpecimen}>
          {typeCategories.map((category) => (
            <section aria-label={category.title} className={styles.typeCategory} key={category.title}>
              <header className={styles.typeCategoryHeading}>
                <div><h3>{category.title}</h3><p>{category.description}</p></div>
                <span>{category.specimens.length} 个规格</span>
              </header>
              {category.specimens.map((specimen) => (
                <div className={styles.typeRow} key={specimen.size}>
                  <div className={styles.typeDetails}>
                    <div className={styles.typeMeta}>
                      <strong>{specimen.name}</strong>
                      <code>{typeToken("size", specimen.size)}</code>
                    </div>
                    <dl className={styles.typeParams}>
                      <div><dt>字族</dt><dd>系统无衬线</dd></div>
                      <div><dt>字号</dt><dd>{toPixels(tokens.type.size[specimen.size])}</dd></div>
                      <div><dt>行高</dt><dd>{toPixels(tokens.type.line[specimen.line])}</dd></div>
                      <div><dt>字重</dt><dd>{tokens.type.weight[specimen.weight]} · {weightLabels[specimen.weight]}</dd></div>
                      <div><dt>字距</dt><dd>{tokens.type.tracking[specimen.tracking] === "0" ? "0px" : tokens.type.tracking[specimen.tracking]}</dd></div>
                    </dl>
                  </div>
                  <div className={styles.typeSampleWrap}>
                    <p className={`${styles.typeSample} ${specimen.className}`}>{specimen.sample}</p>
                    <div className={styles.typeTokenPair}>
                      <code>{typeToken("size", specimen.size)}</code>
                      <code>{typeToken("line", specimen.line)}</code>
                    </div>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
        <div className={styles.typeFooter}><span>阅读建议</span><strong>正文行宽约 32–40 个汉字；窄屏下展示字号会适度缩小，参数仍展示基础 token。</strong></div>
      </section>
      )}

      {section === "spacing" && (
        <section aria-labelledby="shape-title" className={`${styles.tokenSection} ${styles.shapeSection}`} id="shape">
        <div className={styles.sectionIntro}>
          <div className={styles.sectionIndex}><Icon name="shape" /><span>间距与形状</span></div>
          <h1 id="shape-title">节奏来自距离，<br />而不是更多装饰。</h1>
          <p>间距以 4px 为基础递增；圆角随元素层级变化。尺寸有规律，界面就会显得从容。</p>
        </div>

        <div className={styles.shapeContent}>
          <div className={styles.spacingBoard}>
            <div className={styles.subsectionHeading}><strong>间距阶梯</strong><span>4px 基础单位</span></div>
            <div className={styles.spacingList}>
              {spacingSamples.map((sample) => (
                <div className={styles.spacingRow} key={sample.token}>
                  <span>{sample.name}</span>
                  <div className={styles.spacingTrack}><span className={sample.className} /></div>
                  <code>{sample.token}</code>
                </div>
              ))}
            </div>
            <div className={styles.spacingRule}><span />相关内容靠近，不相关内容拉开。</div>
          </div>

          <div className={styles.radiusBoard}>
            <div className={styles.subsectionHeading}><strong>圆角层级</strong><span>结构清晰，不做过度柔化</span></div>
            <div className={styles.radiusSamples}>
              <div className={styles.radiusSample}><span className={styles.radiusSmall} /><span>小型控件 <code>8</code></span></div>
              <div className={styles.radiusSample}><span className={styles.radiusMedium} /><span>常用容器 <code>12</code></span></div>
              <div className={styles.radiusSample}><span className={styles.radiusLarge} /><span>展示面板 <code>22</code></span></div>
            </div>
            <div className={styles.shadowSample}><span className={styles.shadowSurface}><Icon name="spark" /></span><span>轻柔阴影只用于浮层和预览边界</span></div>
          </div>
        </div>
      </section>
      )}
    </>
  );
}
