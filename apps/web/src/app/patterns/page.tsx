import type { Metadata } from "next";
import { UIPatternAtlas } from "./components/ui-pattern-atlas";

export const metadata: Metadata = {
  title: "UI 模式 · 澄序",
  description: "按首屏、内容浏览、数据展示与导航整理页面模块模式。",
};

export default function UIPatternsPage() {
  return <UIPatternAtlas />;
}
