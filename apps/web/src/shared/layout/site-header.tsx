"use client";

import { useThemeEditor } from "@/shared/providers/theme-provider";
import { Badge } from "@/shared/arc/badge/badge";
import { Breadcrumb } from "@/shared/arc/breadcrumb/breadcrumb";
import { ArcProvider } from "@/shared/arc/lib/arc-provider";
import { Separator } from "@/shared/ui/separator";
import { SidebarTrigger } from "@/shared/ui/sidebar";
import { themes } from "@template/design-tokens/themes";
import Link from "next/link";
import { usePathname } from "next/navigation";

const pageTitles: Record<string, string> = {
  "/": "主题概览",
  "/colors": "颜色系统",
  "/typography": "字体层级",
  "/spacing": "间距与形状",
  "/showcase": "组件预览",
  "/motion": "动效预览",
  "/styles": "风格预览",
  "/patterns": "UI 模式",
  "/orchestratelq": "系统工作台",
};

export function SiteHeader() {
  const pathname = usePathname().replace(/\/$/, "") || "/";
  const title = pageTitles[pathname] ?? "设计主题";
  const { activeId, dirty } = useThemeEditor();
  const theme = themes.find((entry) => entry.id === activeId)!;

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-surface px-4 md:px-6">
      <SidebarTrigger aria-label="切换导航栏" className="-ml-1" />
      <Separator className="h-4" orientation="vertical" />
      <ArcProvider link={Link}>
        <Breadcrumb ariaLabel="当前位置" items={[{ label: "设计系统", href: "/" }, { label: title }]} />
      </ArcProvider>
      <Badge className="ml-auto shrink-0" size="sm" tone="info" outline dot>
        {theme.name}
        {dirty ? " · 预览" : ""}
      </Badge>
    </header>
  );
}
