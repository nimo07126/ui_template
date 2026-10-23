"use client";

import { getThemeConcepts, themeStyle } from "@template/design-tokens/themes";
import { Check, Pencil } from "lucide-react";
import { type CSSProperties } from "react";
import { colorParts } from "./color-values";
import { useColorWorkbench } from "./color-workbench-context";

export function ColorConcepts() {
  const { activeId, overrides, dark, visibleThemes, chooseTheme, openEditor } =
    useColorWorkbench();
  return (
    <div
      className="group/conceptGrid grid grid-cols-3 items-start gap-4 data-[dark=true]:grid-cols-1 max-[1100px]:gap-2.5 max-[767px]:grid-cols-1 max-[767px]:gap-4"
      data-view="concepts"
      data-dark={dark}
    >
      {visibleThemes.map((theme) => {
        const concepts = getThemeConcepts(
          theme.id,
          (value) => colorParts(value).identity,
          overrides[theme.id],
        );
        return (
          <section
            className="min-w-0 border border-[var(--matrix-outline)] rounded-[.875rem] bg-[var(--card)] overflow-hidden"
            key={theme.id}
            data-concept-theme={theme.id}
            aria-label={`${theme.name}的颜色概念`}
          >
            <div className="flex items-center flex-wrap justify-between border-b border-b-[var(--matrix-line)] bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_35%,_var(--card))] p-4 gap-1.5 max-[1100px]:py-3.5 max-[1100px]:px-3 max-[767px]:p-4">
              <button
                className="inline-flex items-center bg-transparent border-0 text-[var(--foreground)] text-[length:.8125rem] font-medium cursor-pointer p-0 gap-2"
                onClick={() => chooseTheme(theme.id)}
              >
                {theme.name}
                {theme.id === activeId && <Check size={12} />}
              </button>
              <span className="text-[var(--muted-foreground)] text-[length:.625rem]">
                {concepts.length} 个独立颜色
              </span>
              <p className="basis-full mt-0.5 mb-0 text-[length:.625rem] text-[var(--muted-foreground)] mx-0">
                {theme.subtitle}
              </p>
            </div>
            <div className="grid group-data-[dark=true]/conceptGrid:grid-cols-3 max-[767px]:group-data-[dark=true]/conceptGrid:grid-cols-1">
              {concepts.map(({ value, roles }) => {
                const primary = roles[0];
                const usage = roles.map((role) => role.usage).join("；");
                return (
                  <button
                    className="group/conceptColor flex items-start w-full min-w-0 border-0 border-b border-b-[var(--matrix-line)] bg-transparent text-[var(--foreground)] text-left cursor-pointer [transition:background_.15s] p-4 gap-3 last:border-b-0 hover:bg-[color-mix(in_oklab,_var(--theme-surface-secondary)_45%,_var(--card))] max-[1100px]:py-3.5 max-[1100px]:px-3 max-[1100px]:gap-2 max-[767px]:p-4 max-[767px]:gap-3"
                    key={primary.key}
                    data-theme-scope={theme.id}
                    style={
                      themeStyle(theme.id, overrides[theme.id]) as CSSProperties
                    }
                    onClick={(event) => openEditor(event, theme.id, primary)}
                    aria-label={`编辑${theme.name}的${primary.name}`}
                    title={`${usage}\n${roles.map((role) => role.key).join("、")}`}
                  >
                    <span className="block shrink-0 w-[48px] h-[52px] border border-[var(--matrix-outline)] rounded-[.5rem] overflow-hidden [background:repeating-conic-gradient(var(--border)_0%_25%,var(--card)_0%_50%)_50%_/_8px_8px] max-[1100px]:w-[38px] max-[1100px]:h-[44px] max-[767px]:w-[48px] max-[767px]:h-[52px]">
                      <span
                        className="block w-full h-full bg-[var(--paint-color)]"
                        data-paint
                        style={{ "--paint-color": value } as CSSProperties}
                      />
                    </span>
                    <span className="flex flex-1 min-w-0 flex-col gap-1">
                      <strong className="flex items-center flex-wrap text-[length:.75rem] font-medium leading-[1.5] gap-1.5">
                        {primary.name}
                        {roles.length > 1 && (
                          <small className="text-[length:.5625rem] font-normal text-[var(--muted-foreground)]">
                            +{roles.length - 1} 用途
                          </small>
                        )}
                      </strong>
                      <code className="overflow-hidden text-ellipsis whitespace-nowrap text-[length:.625rem] font-[family-name:ui-monospace,monospace] leading-[normal] font-normal not-italic text-[var(--muted-foreground)]">
                        {value}
                      </code>
                      <span className="[display:-webkit-box] overflow-hidden [-webkit-line-clamp:2] [-webkit-box-orient:vertical] text-[var(--muted-foreground)] text-[length:.625rem] leading-[1.65]">
                        {usage}
                      </span>
                    </span>
                    <Pencil
                      className="text-[var(--muted-foreground)] ml-auto shrink-0 opacity-0 mt-0.75 group-hover/conceptColor:opacity-100 group-focus-visible/conceptColor:opacity-100"
                      size={12}
                    />
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
