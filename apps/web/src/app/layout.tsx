import type { Metadata } from "next";
import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "澄序 · 设计主题样板",
  description: "一套清晰、克制而有温度的界面主题规则。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
