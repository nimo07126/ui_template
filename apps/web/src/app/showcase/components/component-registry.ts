import { arcCatalog } from "./arc-catalog";
import { arcDemoLoaders } from "./arc-demos/loaders";
import type { ComponentExample } from "./example-types";
import { migratedExamples, retainedExamples } from "./legacy-catalog";

export const componentGroups = [
  {
    id: "actions",
    name: "基础操作",
    description: "用清晰的层级表达操作优先级。",
    icon: "01",
  },
  {
    id: "forms",
    name: "表单输入",
    description: "从填写到选择，覆盖完整的输入状态。",
    icon: "02",
  },
  {
    id: "navigation",
    name: "导航切换",
    description: "组织内容，帮助用户找到当前位置。",
    icon: "03",
  },
  {
    id: "data",
    name: "数据展示",
    description: "让信息有层次，让状态一目了然。",
    icon: "04",
  },
  {
    id: "feedback",
    name: "反馈状态",
    description: "及时回应操作，照顾等待与空白时刻。",
    icon: "05",
  },
  {
    id: "overlays",
    name: "浮层交互",
    description: "在需要的时候，展开更多信息与操作。",
    icon: "06",
  },
] as const;

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
      docs: `https://uiarc.dev/components/${slug}`,
      importStatement,
      loadDemo: migrated?.loadDemo ?? arcDemoLoaders[slug],
    };
  }),
  ...retainedExamples,
];
