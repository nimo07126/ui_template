import { tokens } from "@template/design-tokens";

export type SizeKey = keyof typeof tokens.type.size;

export type LineKey = keyof typeof tokens.type.line;

export type WeightKey = keyof typeof tokens.type.weight;

export type TrackingKey = keyof typeof tokens.type.tracking;

export type TypeSpecimen = {
  name: string;
  size: SizeKey;
  line: LineKey;
  weight: WeightKey;
  tracking: TrackingKey;
  sample: string;
  className: string;
};

export type TypeCategory = {
  title: string;
  description: string;
  specimens: TypeSpecimen[];
};

export const weightLabels: Record<WeightKey, string> = {
  regular: "常规",
  medium: "中等",
  semibold: "半粗",
  bold: "粗体",
};

export const typeCategories: TypeCategory[] = [
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

export function toPixels(value: string) {
  const remValue = value.match(/^(\\d+(?:\\.\\d+)?)rem$/);
  if (!remValue) return value === "0" ? "0px" : value;

  const pixels = Number(remValue[1]) * 16;
  return `${Number.isInteger(pixels) ? pixels : pixels.toFixed(1)}px`;
}

export function typeToken(category: "size" | "line", key: string) {
  const kebabKey = key.replace(
    /[A-Z]/g,
    (letter) => `-${letter.toLowerCase()}`,
  );
  return `--type-${category}-${kebabKey}`;
}
