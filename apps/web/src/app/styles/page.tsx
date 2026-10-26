import type { Metadata } from "next";
import { StyleAtlas } from "./components/style-atlas";

export const metadata: Metadata = {
  title: "风格预览 · 澄序",
  description: "把界面感觉翻译成可见概念、布局词汇和可复制的 AI 描述。",
};

export default function StylesPage() {
  return <StyleAtlas />;
}
