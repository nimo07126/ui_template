"use client";

import { allTokens } from "@template/design-tokens/themes";

export function ColorsIntro() {
  return (
    <div className="flex justify-between items-end mb-8 gap-8 max-[767px]:mb-6">
      <div>
        <h1
          className="mt-3.5 mb-3 text-[length:clamp(1.875rem,_3vw,_2.625rem)] leading-[1.3] tracking-[-.055em] font-[650] mx-0"
          id="colors-title"
        >
          让颜色，各司其职。
        </h1>
        <p className="max-w-152 text-[var(--muted-foreground)] text-[length:.875rem] m-0 max-[767px]:text-[length:.8125rem]">
          按功能定义颜色，按场景选择主题。点击任意色块微调，整套界面同步预览。
        </p>
      </div>
      <div className="flex items-center pb-1 whitespace-nowrap text-[var(--muted-foreground)] text-[length:.6875rem] gap-5 max-[1100px]:hidden">
        <span>
          <strong className="text-[var(--foreground)] text-[length:1.25rem] font-medium mr-1 tabular-nums">
            04
          </strong>{" "}
          套主题
        </span>
        <i className="h-6 w-px bg-[var(--border)]" />
        <span>
          <strong className="text-[var(--foreground)] text-[length:1.25rem] font-medium mr-1 tabular-nums">
            {allTokens.length}
          </strong>{" "}
          个功能角色
        </span>
      </div>
    </div>
  );
}
