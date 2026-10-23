"use client";

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
} from "@/shared/ui/sidebar";
import { Component, LayoutDashboard, Palette, Ruler, Type } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { version } from "../../../package.json";

const navigation = [
  { title: "主题概览", url: "/", icon: LayoutDashboard },
  { title: "颜色系统", url: "/colors", icon: Palette },
  { title: "字体层级", url: "/typography", icon: Type },
  { title: "间距与形状", url: "/spacing", icon: Ruler },
  { title: "组件预览", url: "/showcase", icon: Component },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="px-4 py-6 group-data-[collapsible=icon]:px-0">
        <Link
          className="flex min-h-10 items-center gap-3 group-data-[collapsible=icon]:justify-center"
          href="/"
          aria-label="澄序设计主题首页"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-foreground text-sm font-semibold text-background">
            澄
          </span>
          <span className="grid min-w-0 gap-0.5 group-data-[collapsible=icon]:hidden">
            <strong className="text-sm font-semibold leading-tight">
              澄序
            </strong>
            <span className="text-xs text-muted-foreground">设计主题样板</span>
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup className="px-3 py-2 group-data-[collapsible=icon]:px-0">
          <SidebarGroupLabel className="mb-2 px-3 group-data-[collapsible=icon]:hidden">
            设计语言
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {navigation.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    className="h-11 gap-3 rounded-lg px-3 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:justify-center"
                    isActive={pathname === item.url}
                    render={
                      <Link
                        aria-current={
                          pathname === item.url ? "page" : undefined
                        }
                        aria-label={item.title}
                        href={item.url}
                      />
                    }
                    tooltip={item.title}
                  >
                    <item.icon aria-hidden="true" />
                    <span className="group-data-[collapsible=icon]:hidden">
                      {item.title}
                    </span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="shrink-0 px-6 py-4 group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:px-0">
        <span
          aria-label={`版本 ${version}`}
          className="text-xs tabular-nums text-muted-foreground"
        >
          v{version}
        </span>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
