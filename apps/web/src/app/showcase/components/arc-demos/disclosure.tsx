"use client";

import { BottomSheet, BottomSheetClose } from "@/shared/arc/bottom-sheet/bottom-sheet";
import { Button } from "@/shared/arc/button/button";
import { ExpandableCard } from "@/shared/arc/expandable-card/expandable-card";
import { HoverCard, HoverCardProfile } from "@/shared/arc/hover-card/hover-card";
import { ResizablePanel, ResizablePanels } from "@/shared/arc/resizable-panels/resizable-panels";
import { ScrollArea } from "@/shared/arc/scroll-area/scroll-area";
import { ThemeSwitch, type Theme, type ThemeSwitchVariant } from "@/shared/arc/theme-switch/theme-switch";
import Toast from "@/shared/arc/toast/toast";
import { UserMenu } from "@/shared/arc/user-menu/user-menu";
import { DEFAULT_THEME, themeStyle } from "@template/design-tokens/themes";
import { Settings, UserRound } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useState, type CSSProperties } from "react";
import { DemoColumn, DemoResult } from "./fixtures";

const sampleThemes = { light: themeStyle(DEFAULT_THEME), dark: themeStyle("night") };
const themeWipes = {
  reveal: ["circle(0% at 50% 50%)", "circle(100% at 50% 50%)"],
  eclipse: ["circle(0% at 0% 50%)", "circle(150% at 0% 50%)"],
  split: ["inset(0 50% 0 50%)", "inset(0 0 0 0)"],
  rise: ["inset(100% 0 0 0)", "inset(0 0 0 0)"],
} satisfies Record<ThemeSwitchVariant, [string, string]>;

function AppearanceDemo({ variant }: { variant: ThemeSwitchVariant }) {
  const [theme, setTheme] = useState<Theme>("light");
  const reduced = useReducedMotion();
  const previous = theme === "light" ? "dark" : "light";
  const [from, to] = themeWipes[variant];
  return (
    <DemoColumn>
      <div className="flex items-center gap-3">
        <ThemeSwitch theme={theme} variant={variant} label="切换示例明暗外观" onThemeChange={setTheme} iconOnly />
        <span className="text-sm">{theme === "light" ? "浅色外观" : "深色外观"}</span>
      </div>
      <div
        className="relative h-20 overflow-hidden rounded-xl border bg-background"
        style={sampleThemes[previous] as CSSProperties}
      >
        <motion.div
          key={theme}
          className="absolute inset-0 grid place-items-center bg-background text-sm text-foreground"
          style={sampleThemes[theme] as CSSProperties}
          initial={reduced ? false : { clipPath: from }}
          animate={{ clipPath: to }}
          transition={{ duration: reduced ? 0 : 0.4 }}
        >
          <span className="rounded-md bg-accent px-3 py-2 text-accent-foreground">澄序 · 主题预览</span>
        </motion.div>
      </div>
    </DemoColumn>
  );
}

export function ThemeSwitchDemo() {
  return <AppearanceDemo variant="reveal" />;
}

export function EclipseDemo() {
  return <AppearanceDemo variant="eclipse" />;
}

export function SplitDemo() {
  return <AppearanceDemo variant="split" />;
}

export function RiseDemo() {
  return <AppearanceDemo variant="rise" />;
}

export function ExpandableCardDemo() {
  return (
    <ExpandableCard title="设计交付" description="查看当前项目的交付清单" width={260} expandedWidth={420}>
      <ul className="grid list-disc gap-2 pl-5 text-sm">
        <li>澄序主题色与排版</li>
        <li>Web 组件和使用示例</li>
        <li>交互走查记录</li>
      </ul>
    </ExpandableCard>
  );
}

export function ToastDemo() {
  const [open, setOpen] = useState(false);
  return (
    <DemoColumn>
      <Button onClick={() => setOpen(true)}>显示提示</Button>
      <Toast open={open} onOpenChange={setOpen} title="已保存示例" description="更改仅在此演示中生效。" />
    </DemoColumn>
  );
}

export function BottomSheetDemo() {
  return (
    <BottomSheet
      trigger={<Button>打开底部面板</Button>}
      title="项目概况"
      description="可拖动手柄切换面板高度"
      detents={[0.45, 0.85]}
    >
      <p className="mb-4 text-sm">本周新增了三项交付物。可在此查看项目概要。</p>
      <BottomSheetClose asChild>
        <Button variant="secondary">完成</Button>
      </BottomSheetClose>
    </BottomSheet>
  );
}

export function HoverCardDemo() {
  return (
    <HoverCard content={<HoverCardProfile name="陈晓" role="产品设计师" stats={[{ label: "项目", value: 12 }]} />}>
      <button type="button" className="rounded-md border px-3 py-2 text-sm">
        @陈晓
      </button>
    </HoverCard>
  );
}

export function ResizablePanelsDemo() {
  return (
    <div className="h-32 w-full max-w-sm rounded-lg border">
      <ResizablePanels label="双栏编辑器">
        <ResizablePanel id="list" label="目录" defaultSize={40} minSize={64}>
          <p className="p-3 text-xs">项目目录</p>
        </ResizablePanel>
        <ResizablePanel id="detail" label="内容" defaultSize={60} minSize={80}>
          <p className="p-3 text-xs">拖动中间的分隔线调整宽度。</p>
        </ResizablePanel>
      </ResizablePanels>
    </div>
  );
}

export function UserMenuDemo() {
  const [result, setResult] = useState("");
  return (
    <DemoColumn>
      <UserMenu
        user={{ name: "陈晓", email: "preview@example.invalid", plan: "演示账户" }}
        showName
        onThemeChange={(theme) => setResult(`示例偏好：${theme}`)}
        items={[
          { label: "个人资料", icon: <UserRound size={16} />, onSelect: () => setResult("已选择个人资料") },
          { label: "设置", icon: <Settings size={16} />, onSelect: () => setResult("已选择设置") },
        ]}
        onSignOut={() => setResult("已模拟退出")}
      />
      <DemoResult>{result}</DemoResult>
    </DemoColumn>
  );
}

export function ScrollAreaDemo() {
  return (
    <DemoColumn>
      <ScrollArea maxHeight={120} label="最近活动">
        <ol className="divide-y px-3 text-sm">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="py-2">
              设计稿更新记录 #{index + 1}
            </li>
          ))}
        </ol>
      </ScrollArea>
    </DemoColumn>
  );
}
