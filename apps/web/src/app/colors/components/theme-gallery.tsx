"use client";

import { Button } from "@/shared/ui/button";
import { themeStyle } from "@template/design-tokens/themes";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  Circle,
  Moon,
  RotateCcw,
  Sun,
} from "lucide-react";
import { type CSSProperties } from "react";
import { useColorWorkbench } from "./color-workbench-context";
import { MiniInterface } from "./mini-interface";

export function ThemeGallery() {
  const {
    activeId,
    overrides,
    ready,
    resetTheme,
    exportTheme,
    lastLight,
    dark,
    visibleThemes,
    chooseTheme,
  } = useColorWorkbench();
  return (
    <>
      <div className="flex items-center justify-between mb-4 gap-2 max-[767px]:items-start max-[767px]:flex-col max-[767px]:gap-3">
        <div
          className="inline-flex items-center border border-[var(--border)] rounded-[.75rem] bg-[var(--theme-surface-secondary)] p-1 gap-1"
          role="group"
          aria-label="主题明暗模式"
        >
          <button
            className="flex items-center justify-center border-0 bg-transparent rounded-[.5rem] text-[length:.75rem] text-[var(--muted-foreground)] cursor-pointer py-2 px-3 gap-2 aria-pressed:bg-[var(--theme-segment)] aria-pressed:text-[var(--theme-segment-foreground)] aria-pressed:shadow-[var(--shadow-soft)]"
            aria-pressed={!dark}
            onClick={() => chooseTheme(lastLight)}
          >
            <Sun size={15} />
            浅色主题{" "}
            <small className="grid place-items-center min-w-4.5 h-4.5 rounded-[.3rem] bg-[var(--theme-surface-tertiary)] text-[var(--muted-foreground)] text-[length:.625rem]">
              3
            </small>
          </button>
          <button
            className="flex items-center justify-center border-0 bg-transparent rounded-[.5rem] text-[length:.75rem] text-[var(--muted-foreground)] cursor-pointer py-2 px-3 gap-2 aria-pressed:bg-[var(--theme-segment)] aria-pressed:text-[var(--theme-segment-foreground)] aria-pressed:shadow-[var(--shadow-soft)]"
            aria-pressed={dark}
            onClick={() => chooseTheme("night")}
          >
            <Moon size={15} />
            深色主题{" "}
            <small className="grid place-items-center min-w-4.5 h-4.5 rounded-[.3rem] bg-[var(--theme-surface-tertiary)] text-[var(--muted-foreground)] text-[length:.625rem]">
              1
            </small>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="text-[length:.75rem] text-[var(--muted-foreground)]"
            onClick={exportTheme}
            variant="ghost"
            disabled={!ready}
          >
            <ArrowDownToLine />
            导出配置
          </Button>
          <Button
            className="text-[length:.75rem] text-[var(--muted-foreground)]"
            onClick={() => resetTheme(activeId)}
            variant="ghost"
            disabled={!ready || !overrides[activeId]}
          >
            <RotateCcw />
            恢复预设
          </Button>
        </div>
      </div>
      <div
        className="grid grid-cols-3 gap-4 data-[dark=true]:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] max-[1100px]:gap-2.5 max-[767px]:grid-cols-1 max-[767px]:gap-3.5 max-[767px]:data-[dark=true]:grid-cols-1"
        data-dark={dark}
      >
        {visibleThemes.map((theme, index) => (
          <article
            key={theme.id}
            className="group/themeCard min-w-0 overflow-hidden border border-[var(--border)] rounded-[1rem] bg-[var(--card)] [transition:border-color_.15s,box-shadow_.15s] data-[active=true]:border-[var(--ring)] data-[active=true]:shadow-[0_0_0_1px_var(--ring)]"
            data-active={activeId === theme.id}
          >
            <button
              className="block w-full pt-4 pb-3 border-0 text-left text-[var(--foreground)] bg-transparent cursor-pointer px-4 max-[1100px]:pt-3 max-[1100px]:pb-2.5 max-[1100px]:px-3 max-[767px]:p-4"
              onClick={() => chooseTheme(theme.id)}
              aria-pressed={activeId === theme.id}
              aria-label={`切换到${theme.name}`}
            >
              <div className="flex items-center mb-4 gap-2.5">
                <span className="text-[var(--muted-foreground)] text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic">
                  {dark ? "04" : `0${index + 1}`}
                </span>
                <strong className="text-[length:.875rem] font-semibold">
                  {theme.name}
                </strong>
                <span className="grid place-items-center ml-auto w-4.5 h-4.5 rounded-full text-[var(--muted-foreground)] group-data-[active=true]/themeCard:bg-[var(--primary)] group-data-[active=true]/themeCard:text-[var(--primary-foreground)]">
                  {activeId === theme.id ? (
                    <Check size={13} />
                  ) : (
                    <Circle size={16} />
                  )}
                </span>
              </div>
              <div
                className="rounded-[.625rem] overflow-hidden border border-[var(--border)]"
                data-theme-scope={theme.id}
                style={
                  themeStyle(theme.id, overrides[theme.id]) as CSSProperties
                }
              >
                <MiniInterface />
              </div>
              <span className="block mt-3 text-[var(--muted-foreground)] text-[length:.6875rem] max-[1100px]:text-[length:.625rem] max-[767px]:text-[length:.6875rem]">
                {theme.subtitle}
              </span>
            </button>
            <div className="flex items-center flex-wrap justify-between border-t border-t-[var(--border)] text-[length:.625rem] text-[var(--muted-foreground)] py-2.5 px-4 gap-1 max-[1100px]:py-2 max-[1100px]:px-3">
              <span>
                {activeId === theme.id ? "当前应用" : "点击应用整套主题"}
                {overrides[theme.id] ? " · 已自定义" : ""}
              </span>
              <a
                className="inline-flex items-center gap-0.5 hover:text-[var(--foreground)]"
                href={theme.url}
                target="_blank"
                rel="noreferrer"
                aria-label={`${theme.reference} 设计参考`}
              >
                {theme.reference}
                <ArrowUpRight size={11} />
              </a>
            </div>
          </article>
        ))}
        {dark && (
          <div className="flex flex-col justify-center text-[var(--muted-foreground)] py-4 px-8 max-[767px]:p-4">
            <Moon size={22} />
            <h2 className="text-[length:1.125rem] text-[var(--foreground)] font-medium mt-3 mb-2 mx-0">
              为低光环境，重新建立层次。
            </h2>
            <p className="text-[length:.8125rem] max-w-120 m-0">
              使用独立的近黑画布与逐层提亮的容器，重新配对文字、状态与控件颜色，保留清晰的阅读和操作层级。
            </p>
            <div className="flex mt-6 gap-1.5">
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-background)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-surface)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-surface-secondary)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-surface-tertiary)]" />
              <span className="block h-3 w-12 rounded-[.25rem] border border-[var(--border)] bg-[var(--theme-accent)]" />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
