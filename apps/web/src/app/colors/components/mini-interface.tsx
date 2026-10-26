"use client";

import { Check } from "lucide-react";

export function MiniInterface() {
  return (
    <div
      className="grid grid-cols-[2rem_1fr] h-[139px] bg-[var(--theme-background)] text-[var(--theme-foreground)] text-[length:.5rem] min-[1600px]:h-[156px] max-[767px]:h-[145px] max-[767px]:grid-cols-[2.5rem_1fr]"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center pt-3 border-r border-r-[var(--theme-border)] bg-[var(--theme-sidebar)] gap-3">
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
        <i className="block w-2 h-2 bg-[var(--theme-muted)] opacity-30 rounded-[2px] first:opacity-100 first:bg-[var(--theme-accent)] first:shadow-[0_0_0_5px_var(--theme-accent-soft)] first:mb-[0.2rem]" />
      </div>
      <div className="min-w-0 bg-[var(--theme-surface)] p-2.5 min-[1600px]:p-3.5 max-[767px]:p-3">
        <div className="flex justify-between items-center text-[length:.5rem] mb-2 text-[var(--theme-muted)]">
          <span>项目空间</span>
          <i className="h-2.5 w-2.5 rounded-full bg-[var(--theme-accent-soft)]" />
        </div>
        <div className="bg-[var(--theme-surface)] text-[var(--theme-surface-foreground)] rounded-[.375rem] border border-[var(--theme-border)] p-2.5 min-[1600px]:p-3.5 max-[767px]:p-3">
          <span className="block font-semibold text-[length:.625rem]">
            让每一步，更清晰。
          </span>
          <small className="block text-[var(--theme-muted)] text-[length:.5rem] mt-0.5 mb-2 mx-0">
            有序的界面，专注于内容。
          </small>
          <div className="flex gap-1.5">
            <b className="inline-block rounded-[.25rem] text-[length:.5rem] font-medium not-italic text-[var(--theme-button-primary-foreground)] bg-[var(--theme-button-primary)] py-0.5 px-1.5">
              主要操作
            </b>
            <em className="inline-block rounded-[.25rem] text-[length:.5rem] font-medium not-italic text-[var(--theme-button-secondary-foreground)] bg-[var(--theme-button-secondary)] py-0.5 px-1.5">
              次要操作
            </em>
          </div>
        </div>
        <div className="flex items-center mt-1.5 text-[var(--theme-success-soft-foreground)] text-[length:.4375rem] whitespace-nowrap gap-0.5">
          <Check size={10} /> 所有更改已同步{" "}
          <span className="ml-auto rounded-[.25rem] bg-[var(--theme-accent-soft)] text-[var(--theme-accent-soft-foreground)] py-0 px-1">
            进行中
          </span>
        </div>
      </div>
    </div>
  );
}
