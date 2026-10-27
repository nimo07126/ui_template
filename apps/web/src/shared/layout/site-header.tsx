"use client";

import { useThemeEditor } from "@/shared/providers/theme-provider";
import { Badge } from "@/shared/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui/breadcrumb";
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
  const pathname = usePathname();
  const title = pageTitles[pathname] ?? "设计主题";
  const { activeId, dirty } = useThemeEditor();
  const theme = themes.find((entry) => entry.id === activeId)!;

  return (
    <header className="z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border/80 bg-surface px-4 md:px-6">
      <SidebarTrigger aria-label="切换导航栏" className="-ml-1" />
      <Separator className="h-4" orientation="vertical" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>设计系统</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <Badge className="ml-auto gap-2 font-normal" variant="outline">
        <span className="size-1.5 rounded-full bg-primary" />
        {theme.name}
        {dirty ? " · 预览" : ""}
      </Badge>
    </header>
  );
}
