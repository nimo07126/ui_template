import { tokens } from "@template/design-tokens";
import { SectionShared } from "@/components/layout/section-shared";
import { TypeSpecimenRow } from "@/components/theme-showcase/type-specimen-row";

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
    description:
      "用于品牌时刻与极少量的关键数字。展示字级保持克制，避免与产品内容争夺注意力。",
    specimens: [
      {
        name: "大号 Large",
        size: "displayLarge",
        line: "displayLarge",
        weight: "bold",
        tracking: "tight",
        sample: "澄序设计",
        className:
          "font-[number:var(--type-weight-bold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-display-large)] leading-[var(--type-line-display-large)] max-[36rem]:text-[length:var(--type-size-display-medium)] max-[36rem]:leading-[var(--type-line-display-medium)]",
      },
      {
        name: "中号 Medium",
        size: "displayMedium",
        line: "displayMedium",
        weight: "bold",
        tracking: "tight",
        sample: "为内容留白",
        className:
          "font-[number:var(--type-weight-bold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-display-medium)] leading-[var(--type-line-display-medium)] max-[36rem]:text-[length:var(--type-size-display-small)] max-[36rem]:leading-[var(--type-line-display-small)]",
      },
      {
        name: "小号 Small",
        size: "displaySmall",
        line: "displaySmall",
        weight: "bold",
        tracking: "tight",
        sample: "让重点浮现",
        className:
          "font-[number:var(--type-weight-bold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-display-small)] leading-[var(--type-line-display-small)] max-[36rem]:text-[length:var(--type-size-heading-large)] max-[36rem]:leading-[var(--type-line-heading-large)]",
      },
    ],
  },
  {
    title: "标题 Heading",
    description: "用于页面、区块与卡片标题。按信息层级选用，不跨级跳跃。",
    specimens: [
      {
        name: "特大 XX Large",
        size: "headingXxl",
        line: "headingXxl",
        weight: "semibold",
        tracking: "tight",
        sample: "让信息有清晰层次",
        className:
          "font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-heading-xxl)] leading-[var(--type-line-heading-xxl)]",
      },
      {
        name: "超大 X Large",
        size: "headingXl",
        line: "headingXl",
        weight: "semibold",
        tracking: "tight",
        sample: "让信息易于理解",
        className:
          "font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-heading-xl)] leading-[var(--type-line-heading-xl)]",
      },
      {
        name: "大号 Large",
        size: "headingLarge",
        line: "headingLarge",
        weight: "semibold",
        tracking: "tight",
        sample: "秩序让界面更从容",
        className:
          "font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-heading-large)] leading-[var(--type-line-heading-large)]",
      },
      {
        name: "中号 Medium",
        size: "headingMedium",
        line: "headingMedium",
        weight: "semibold",
        tracking: "tight",
        sample: "先看懂，再行动",
        className:
          "font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-heading-medium)] leading-[var(--type-line-heading-medium)]",
      },
      {
        name: "小号 Small",
        size: "headingSmall",
        line: "headingSmall",
        weight: "semibold",
        tracking: "tight",
        sample: "一致，但不单调",
        className:
          "font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] text-[length:var(--type-size-heading-small)] leading-[var(--type-line-heading-small)]",
      },
      {
        name: "特小 X Small",
        size: "headingXs",
        line: "headingXs",
        weight: "semibold",
        tracking: "normal",
        sample: "中文标题示例",
        className:
          "font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-heading-xs)] leading-[var(--type-line-heading-xs)]",
      },
    ],
  },
  {
    title: "正文 Body",
    description: "用于段落、说明和长内容。正文行高略宽，帮助中文连续阅读。",
    specimens: [
      {
        name: "大号 Large",
        size: "bodyLarge",
        line: "bodyLarge",
        weight: "regular",
        tracking: "normal",
        sample: "清晰的层级，让每一段内容都更容易阅读。",
        className:
          "font-[number:var(--type-weight-regular)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-body-large)] leading-[var(--type-line-body-large)]",
      },
      {
        name: "中号 Medium",
        size: "bodyMedium",
        line: "bodyMedium",
        weight: "regular",
        tracking: "normal",
        sample: "界面保持安静，重要的信息自然浮现。",
        className:
          "font-[number:var(--type-weight-regular)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-body-medium)] leading-[var(--type-line-body-medium)]",
      },
      {
        name: "小号 Small",
        size: "bodySmall",
        line: "bodySmall",
        weight: "regular",
        tracking: "normal",
        sample: "为日常说明和辅助阅读提供稳定节奏。",
        className:
          "font-[number:var(--type-weight-regular)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-body-small)] leading-[var(--type-line-body-small)]",
      },
      {
        name: "特小 X Small",
        size: "bodyXs",
        line: "bodyXs",
        weight: "regular",
        tracking: "normal",
        sample: "适用于简短、次级的补充信息。",
        className:
          "font-[number:var(--type-weight-regular)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-body-xs)] leading-[var(--type-line-body-xs)]",
      },
    ],
  },
  {
    title: "标签 Label",
    description: "用于按钮、表单标签、状态和导航。字级较小，保持清晰、短促。",
    specimens: [
      {
        name: "大号 Large",
        size: "labelLarge",
        line: "labelLarge",
        weight: "medium",
        tracking: "normal",
        sample: "主要操作",
        className:
          "font-[number:var(--type-weight-medium)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-label-large)] leading-[var(--type-line-label-large)]",
      },
      {
        name: "中号 Medium",
        size: "labelMedium",
        line: "labelMedium",
        weight: "medium",
        tracking: "normal",
        sample: "进行中",
        className:
          "font-[number:var(--type-weight-medium)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-label-medium)] leading-[var(--type-line-label-medium)]",
      },
      {
        name: "小号 Small",
        size: "labelSmall",
        line: "labelSmall",
        weight: "medium",
        tracking: "normal",
        sample: "辅助说明",
        className:
          "font-[number:var(--type-weight-medium)] tracking-[var(--type-tracking-normal)] text-[length:var(--type-size-label-small)] leading-[var(--type-line-label-small)]",
      },
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
  const kebabKey = key.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
  return `--type-${category}-${kebabKey}`;
}

export default function TypographyPage() {
  return (
    <SectionShared id="typography" aria-labelledby="typography-title">
      <div className="max-w-172 max-[52rem]:max-w-144">
        <h1
          className="text-[length:var(--type-size-2xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-heading)] m-0 max-[52rem]:text-[length:var(--type-size-2xl)] max-[36rem]:text-[length:var(--type-size-xl)]"
          id="typography-title"
        >
          从展示到阅读，
          <br />
          每一级都有依据。
        </h1>
        <p className="mt-4 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] mx-0">
          字体规范不只是几种字号示例。这里定义字体族、字号分类、行高、字重与字距，让不同页面能够使用同一套排版尺度。
        </p>
      </div>

      <dl className="grid grid-cols-3  m-0 py-4 px-0 gap-4 max-[52rem]:gap-3 max-[36rem]:grid-cols-1">
        <div className="min-w-0">
          <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
            字体族 Family
          </dt>
          <dd className="mt-1 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] mx-0">
            系统中文无衬线
          </dd>
          <code className="block wrap-anywhere mt-1 text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)]">
            --type-family-sans
          </code>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
            字重 Weight
          </dt>
          <dd className="mt-1 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] flex flex-wrap gap-y-1 gap-x-3 mx-0">
            {Object.entries(tokens.type.weight).map(([key, value]) => (
              <span className="whitespace-nowrap" key={key}>
                {value} · {weightLabels[key as WeightKey]}
              </span>
            ))}
          </dd>
          <code className="block wrap-anywhere mt-1 text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)]">
            --type-weight-*
          </code>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
            字距 Tracking
          </dt>
          <dd className="mt-1 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] flex flex-wrap gap-y-1 gap-x-3 mx-0">
            {Object.entries(tokens.type.tracking).map(([key, value]) => (
              <span className="whitespace-nowrap" key={key}>
                {key === "tight" ? "紧凑" : "常规"} ·{" "}
                {value === "0" ? "0px" : value}
              </span>
            ))}
          </dd>
          <code className="block wrap-anywhere mt-1 text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)]">
            --type-tracking-*
          </code>
        </div>
      </dl>

      <div className="min-w-0">
        {typeCategories.map((category) => (
          <section
            aria-label={category.title}
            className="not-first:mt-8 max-[36rem]:not-first:mt-6"
            key={category.title}
          >
            <header className="flex items-end justify-between pb-3 border-b border-b-[var(--ds-color-line-strong)] gap-4 max-[36rem]:grid max-[36rem]:gap-1">
              <div>
                <h3 className="text-[var(--ds-color-ink)] text-[length:var(--type-size-lg)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] m-0">
                  {category.title}
                </h3>
                <p className="max-w-168 mt-1 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] leading-[var(--type-line-compact)] mx-0">
                  {category.description}
                </p>
              </div>
              <span className="flex-none text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
                {category.specimens.length} 个规格
              </span>
            </header>
            {category.specimens.map((specimen) => (
              <TypeSpecimenRow
                key={specimen.size}
                size={specimen.size}
                name={specimen.name}
                token={typeToken("size", specimen.size)}
                params={[
                  { label: "字族", value: "系统无衬线" },
                  {
                    label: "字号",
                    value: toPixels(tokens.type.size[specimen.size]),
                  },
                  {
                    label: "行高",
                    value: toPixels(tokens.type.line[specimen.line]),
                  },
                  {
                    label: "字重",
                    value: `${tokens.type.weight[specimen.weight]} · ${weightLabels[specimen.weight]}`,
                  },
                  {
                    label: "字距",
                    value:
                      tokens.type.tracking[specimen.tracking] === "0"
                        ? "0px"
                        : tokens.type.tracking[specimen.tracking],
                  },
                ]}
                sample={specimen.sample}
                sampleClassName={specimen.className}
              />
            ))}
          </section>
        ))}
      </div>
      <div className="flex items-baseline rounded-[var(--ds-radius-md)] bg-[var(--ds-color-surface-subtle)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] p-4 gap-3 max-[36rem]:grid max-[36rem]:gap-1">
        <span>阅读建议</span>
        <strong className="text-[var(--ds-color-ink-soft)] font-[number:var(--type-weight-medium)]">
          正文行宽约 32–40 个汉字；窄屏下展示字号会适度缩小，参数仍展示基础
          token。
        </strong>
      </div>
    </SectionShared>
  );
}
