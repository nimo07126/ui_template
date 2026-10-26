import { MotionGallery } from "@/shared/motion/motion-gallery";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "动效预览 · 澄序",
  description: "Motion for React 动效词典与可调参数预览。",
};

export default function MotionPage() {
  return <MotionGallery />;
}
