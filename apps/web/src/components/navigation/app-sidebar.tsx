"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import {
  Component,
  LayoutDashboard,
  Palette,
  Ruler,
  Sparkles,
  Type,
} from "lucide-react";

const navigation = [
  { title: "主题概览", url: "/", icon: LayoutDashboard },
  { title: "颜色系统", url: "/colors", icon: Palette },
  { title: "字体层级", url: "/typography", icon: Type },
  { title: "间距与形状", url: "/spacing", icon: Ruler },
  { title: "常用控件", url: "/components", icon: Component },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="gap-3 px-3 py-4">
        <Link className="flex items-center gap-3 px-1" href="/" aria-label="澄序设计主题首页">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-foreground text-sm font-semibold text-background">
            澄
          </span>
          <span className="grid min-w-0 gap-0.5 group-data-[collapsible=icon]:hidden">
            <strong className="text-sm font-semibold leading-tight">澄序</strong>
            <span className="text-xs text-muted-foreground">设计主题样板</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>设计语言</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    isActive={pathname === item.url}
                    render={<Link aria-current={pathname === item.url ? "page" : undefined} href={item.url} />}
                    tooltip={item.title}
                  >
                    <item.icon aria-hidden="true" />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 group-data-[collapsible=icon]:items-center">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full bg-[var(--ds-color-success)]" />
          <span className="truncate group-data-[collapsible=icon]:hidden">主题变量已同步</span>
          <Badge className="ml-auto group-data-[collapsible=icon]:hidden" variant="secondary">v0.1</Badge>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-sidebar-border bg-background/70 p-3 group-data-[collapsible=icon]:hidden">
          <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-xs leading-relaxed text-muted-foreground">
            把复杂留给系统，<br />把清晰留给使用者。
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
