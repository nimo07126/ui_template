import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { tokens } from "@template/design-tokens";
import { AppSidebar } from "@/components/navigation/app-sidebar";
import { SiteHeader } from "@/components/navigation/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "澄序 · 设计主题样板",
  description: "一套清晰、克制而有温度的界面主题规则。",
};

const sidebarStyle = {
  "--sidebar-width": tokens.layout.sidebarWidth,
  "--sidebar-width-icon": tokens.layout.sidebarCollapsedWidth,
} as CSSProperties;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html data-scroll-behavior="smooth" lang="zh-CN">
      <body>
        <TooltipProvider>
          <SidebarProvider style={sidebarStyle}>
            <AppSidebar />
            <SidebarInset className="min-h-svh overflow-hidden">
              <SiteHeader />
              <main className="mx-auto flex w-full max-w-[var(--layout-content-max)] flex-1 flex-col gap-8 px-5 py-8 md:px-8 md:py-10">
                {children}
              </main>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
