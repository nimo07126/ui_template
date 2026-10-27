"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";
import { SiteHeader } from "./site-header";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import { tokens } from "@template/design-tokens";
import type { CSSProperties } from "react";

const sidebarStyle = {
  "--sidebar-width": tokens.layout.sidebarWidth,
  "--sidebar-width-icon": tokens.layout.sidebarCollapsedWidth,
} as CSSProperties;

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isWorkspace = pathname.startsWith("/orchestratelq");

  if (isWorkspace) {
    return <div className="h-dvh overflow-y-auto bg-[#f4f5f7]">{children}</div>;
  }

  return (
    <SidebarProvider className="h-dvh min-h-0 overflow-clip" style={sidebarStyle}>
      <AppSidebar />
      <SidebarInset className="min-h-0 min-w-0 overflow-clip">
        <SiteHeader />
        <div
          aria-label="页面内容"
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-auto scroll-pt-8 [scrollbar-gutter:stable]"
          data-slot="page-scroll"
          tabIndex={0}
        >
          <div className="mx-auto flex w-full min-w-0 max-w-[var(--layout-content-max)] flex-col gap-8 px-5 py-8 md:px-8 md:py-10">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
