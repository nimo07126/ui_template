import type { Metadata } from "next";
import { ComponentSamples } from "@/components/theme-showcase/component-samples";

export const metadata: Metadata = {
  title: "组件预览 · 澄序",
  description: "33 个 shadcn/ui 组件示例，六类区块，共用澄序主题。",
};

export default function ComponentsPage() {
  return <ComponentSamples />;
}
