"use client";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/shared/ui/sheet";
import { themes } from "@template/design-tokens/themes";
import { Check, Pencil, RotateCcw } from "lucide-react";
import { type CSSProperties } from "react";
import { colorWithOpacity } from "./color-values";
import { useColorWorkbench } from "./color-workbench-context";

export function ColorEditor() {
  const {
    message,
    editToken,
    saveTheme,
    editing,
    setEditing,
    validInput,
    changeInput,
    cancelEditor,
  } = useColorWorkbench();
  return (
    <Sheet
      open={!!editing}
      onOpenChange={(open) => {
        if (!open) cancelEditor();
      }}
    >
      <SheetContent
        className="w-full! overflow-y-auto sm:max-w-[420px]"
        showCloseButton
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>编辑功能颜色</SheetTitle>
          <SheetDescription>
            {editing
              ? `${themes.find((theme) => theme.id === editing.themeId)!.name} · ${editing.token.name}`
              : "修改颜色并实时预览"}
          </SheetDescription>
        </SheetHeader>
        {editing && (
          <div className="flex flex-col pt-2 pb-6 px-6 gap-4">
            <div>
              <h2 className="text-[length:1.125rem] font-semibold m-0">
                {editing.token.name}
              </h2>
              <code className="text-[length:.6875rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                {editing.token.key}
              </code>
              <p className="text-[length:.75rem] mt-1.5 mb-0 text-[var(--muted-foreground)] mx-0">
                {editing.token.usage}
              </p>
            </div>
            <div className="h-[128px] rounded-[.75rem] overflow-hidden border border-[var(--border)] [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_12px_12px]">
              <div
                className="w-full h-full bg-[var(--paint-color)]"
                style={
                  {
                    "--paint-color": `var(--theme-${editing.token.key})`,
                  } as CSSProperties
                }
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="relative inline-flex items-center border border-[var(--border)] rounded-[.5rem] text-[length:.75rem] cursor-pointer py-1.5 px-2.5 gap-1.5 focus-within:[outline:2px_solid_var(--ring)] focus-within:[outline-offset:2px]">
                <input
                  className="absolute top-0 right-0 bottom-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  type="color"
                  aria-label="选择颜色"
                  value={editing.picker}
                  onChange={(event) =>
                    changeInput(
                      colorWithOpacity(event.target.value, editing.opacity),
                    )
                  }
                />
                <Pencil size={14} />
                <span>选择颜色</span>
              </label>
              <span className="text-[var(--muted-foreground)] text-[length:.6875rem]">
                实时作用于整套界面
              </span>
            </div>
            <label className="flex flex-col text-[length:.75rem] font-medium gap-2">
              颜色值
              <Input
                className="text-[length:.75rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic h-10"
                aria-label="颜色值"
                aria-invalid={!validInput}
                aria-describedby="color-input-hint"
                value={editing.input}
                onChange={(event) => changeInput(event.target.value)}
                spellCheck={false}
              />
            </label>
            <p
              id="color-input-hint"
              className="-mt-2 mb-0 text-[length:.625rem] text-[var(--muted-foreground)] mx-0 data-[invalid=true]:text-[var(--theme-danger-soft-foreground)]"
              data-invalid={!validInput}
            >
              {validInput
                ? "支持 HEX（含透明度）、RGB、HSL 与 OKLCH。"
                : "请输入有效颜色，例如 #7669C7 或 oklch(0.6 0.1 280)。"}
            </p>
            <label className="grid grid-cols-[1fr_auto] text-[length:.75rem] gap-2">
              不透明度{" "}
              <span className="text-[length:.6875rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                {editing.opacity}%
              </span>
              <input
                className="w-full col-span-full [accent-color:var(--primary)]"
                aria-label="颜色不透明度"
                type="range"
                min="0"
                max="100"
                value={editing.opacity}
                onChange={(event) =>
                  changeInput(
                    colorWithOpacity(
                      editing.picker,
                      Number(event.target.value),
                    ),
                  )
                }
              />
            </label>
            <div className="flex flex-col border border-[var(--border)] rounded-[.75rem] bg-[var(--theme-background)] p-4 gap-3">
              <span className="text-[length:.625rem] text-[var(--muted-foreground)]">
                应用预览
              </span>
              <div className="flex flex-wrap gap-2">
                <Button>主要操作</Button>
                <Button variant="secondary">次要操作</Button>
                <Button variant="destructive">删除</Button>
              </div>
              <Input
                placeholder="输入内容，查看字段效果"
                aria-label="颜色编辑输入预览"
              />
              <p className="flex items-center text-[var(--theme-success-soft-foreground)] text-[length:.625rem] m-0 gap-1.5">
                <Check size={13} />
                状态、文字与容器同步更新
              </p>
            </div>
            <div className="bg-[var(--theme-surface-secondary)] rounded-[.5rem] py-3 px-4">
              <strong className="text-[length:.75rem] font-medium">
                预览与保存分开
              </strong>
              <p className="mt-1 mb-0 text-[length:.6875rem] text-[var(--muted-foreground)] mx-0">
                保留预览只影响当前访问。保存主题会保留所有主题的自定义颜色和当前选择，仅存于当前浏览器。
              </p>
            </div>
            <Button
              className="self-start"
              variant="ghost"
              onClick={() => {
                editToken(editing.themeId, editing.token.key);
                setEditing(null);
              }}
            >
              <RotateCcw />
              恢复预设 / 自动派生
            </Button>
            <p
              role="status"
              className="text-[length:.6875rem] text-[var(--muted-foreground)] m-0"
            >
              {message}
            </p>
            <div className="flex justify-end flex-wrap pt-3 border-t border-t-[var(--border)] gap-2">
              <Button variant="outline" onClick={cancelEditor}>
                取消修改
              </Button>
              <Button
                variant="secondary"
                onClick={() => setEditing(null)}
                disabled={!validInput}
              >
                保留预览
              </Button>
              <Button
                disabled={!validInput}
                onClick={() => {
                  if (saveTheme()) setEditing(null);
                }}
              >
                保存主题
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
