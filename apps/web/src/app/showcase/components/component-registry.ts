import { arcCatalog } from "./arc-catalog";
import { arcDemoLoaders } from "./arc-demos/loaders";
import type { ComponentExample, DemoSize } from "./example-types";
import { migratedExamples, retainedExamples } from "./legacy-catalog";

export const componentGroups = [
  {
    id: "actions",
    name: "基础操作",
    description: "用清晰的层级表达操作优先级。",
  },
  {
    id: "forms",
    name: "表单输入",
    description: "从填写到选择，覆盖完整的输入状态。",
  },
  {
    id: "navigation",
    name: "导航切换",
    description: "组织内容，帮助用户找到当前位置。",
  },
  {
    id: "overlays",
    name: "浮层交互",
    description: "在需要的时候，展开更多信息与操作。",
  },
  {
    id: "feedback",
    name: "反馈状态",
    description: "及时回应操作，照顾等待与空白时刻。",
  },
  {
    id: "data",
    name: "数据展示",
    description: "让信息有层次，让状态一目了然。",
  },
] as const;

const demoSizes: Readonly<Partial<Record<string, DemoSize>>> = {
  "activity-heatmap": "full",
  "agent-loop": "full",
  "brush-chart": "full",
  "chat-thread": "full",
  "mixture-of-experts": "full",
  "prompt-cache": "full",
  "reasoning-tree": "full",
  "resizable-panels": "full",
  "sortable-data-table": "full",
  "speculative-decoding": "full",
  "tree-table": "full",
  "accordion": "wide",
  "alert": "wide",
  "announcement-bar": "wide",
  "bar-chart": "wide",
  "button": "wide",
  "calendar": "wide",
  "carousel": "wide",
  "code-block": "wide",
  "comment-thread": "wide",
  "cookie-consent": "wide",
  "date-range-picker": "wide",
  "file-upload": "wide",
  "filter-toolbar": "wide",
  "gradient-mesh": "wide",
  "icon-morph": "wide",
  "image-compare": "wide",
  "input": "wide",
  "json-viewer": "wide",
  "line-chart": "wide",
  "multi-step-form": "wide",
  "range-histogram-slider": "wide",
  "rich-text-editor": "wide",
  "ridgeline": "wide",
  "selection-toolbar": "wide",
  "shortcut-recorder": "wide",
  "signature-pad": "wide",
  "slope-chart": "wide",
  "streamgraph": "wide",
  "timeline": "wide",
  "treemap": "wide",
};

const sizeOrder = { compact: 0, wide: 1, full: 2 } as const;

export const componentExamples: ComponentExample[] = [
  ...arcCatalog.map(([slug, group, title, name, description, importStatement]): ComponentExample => {
    const migrated = migratedExamples[slug];
    return {
      id: migrated?.id ?? (slug === "toast" ? "arc-toast" : slug),
      slug,
      group,
      title,
      name,
      description,
      source: "arc",
      tier: importStatement.includes("@/shared/arc/pro/") ? "pro" : undefined,
      size: demoSizes[slug],
      docs: `https://uiarc.dev/components/${slug}`,
      importStatement,
      loadDemo: migrated?.loadDemo ?? arcDemoLoaders[slug],
    };
  }),
  ...retainedExamples,
].sort((first, second) => sizeOrder[first.size ?? "compact"] - sizeOrder[second.size ?? "compact"]);
