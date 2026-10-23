import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { tokens } from "@template/design-tokens";
import { DEFAULT_THEME, themeBootScript, themeStyle } from "@template/design-tokens/themes";
import { ThemeProvider } from "@/components/theme-editor/theme-provider";
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
    <html data-scroll-behavior="smooth" lang="zh-CN" style={themeStyle(DEFAULT_THEME) as CSSProperties} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript() }} />
      </head>
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <SidebarProvider className="h-dvh min-h-0 overflow-clip" style={sidebarStyle}>
              <AppSidebar />
              <SidebarInset className="min-h-0 min-w-0 overflow-clip">
                <SiteHeader />
                <div
                  aria-label="页面内容"
                  className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain scroll-smooth scroll-pt-8 [scrollbar-gutter:stable]"
                  data-slot="page-scroll"
                  tabIndex={0}
                >
                  <div className="mx-auto flex w-full min-w-0 max-w-[var(--layout-content-max)] flex-col gap-8 px-5 py-8 md:px-8 md:py-10">
                    {children}
                  </div>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
