"use client";

import { Button } from "@/shared/ui/button";
import { Check, CheckCheck, Pencil } from "lucide-react";
import { useColorWorkbench } from "./color-workbench-context";

export function ThemeSaveBar() {
  const { savedAt, dirty, ready, message, saveTheme, discardPreview } =
    useColorWorkbench();
  return (
    <>
      <div className="flex justify-between items-center mt-5 border border-[var(--border)] rounded-[.75rem] bg-[var(--card)] py-3.5 px-4 gap-4 max-[767px]:items-start max-[767px]:flex-col">
        <div className="flex items-center text-[var(--muted-foreground)] gap-3">
          {dirty ? <Pencil size={14} /> : <CheckCheck size={15} />}
          <div>
            <strong className="block text-[var(--foreground)] font-medium text-[length:.75rem]">
              {dirty
                ? "正在预览 · 尚未保存"
                : savedAt
                  ? "已保存到当前浏览器"
                  : "正在使用预设主题"}
            </strong>
            <span className="block text-[length:.6875rem] mt-0.5 max-[767px]:text-[length:.625rem]">
              {dirty
                ? "切换页面继续预览；刷新将恢复上次保存。"
                : "保存后刷新仍保留，也可以导出为主题配置。"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 max-[767px]:[align-self:flex-end]">
          {dirty && (
            <Button
              className="text-[length:.75rem]"
              onClick={discardPreview}
              variant="ghost"
            >
              放弃预览
            </Button>
          )}
          <Button
            className="text-[length:.75rem]"
            onClick={saveTheme}
            disabled={!ready || (!dirty && !!savedAt)}
          >
            <Check size={14} />
            保存主题
          </Button>
        </div>
      </div>
      <p
        className="min-h-4 mt-1.5 mb-5 text-[length:.6875rem] text-[var(--muted-foreground)] mx-0"
        role="status"
        aria-live="polite"
      >
        {message}
      </p>
    </>
  );
}
