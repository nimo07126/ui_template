"use client";

import { Button } from "@/shared/ui/button";
import { Search } from "lucide-react";
import { ComponentPreview } from "./component-preview";
import { useShowcase } from "./showcase-context";

export function ShowcaseGroups() {
  const { visible, groups, reset } = useShowcase();
  return (
    <div className="grid min-w-0 gap-10">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="grid min-w-0 gap-5"
        >
          <div className="flex items-start gap-3">
            <span className="grid place-items-center w-8 h-8 shrink-0 border border-[var(--ds-color-line)] rounded-[var(--ds-radius-sm)] bg-[var(--ds-color-surface)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] tabular-nums">
              {group.icon}
            </span>
            <div>
              <h2
                className="flex items-center text-[length:var(--type-size-md)] font-[number:var(--type-weight-semibold)] leading-[1.4] m-0 gap-3"
                id={`${group.id}-heading`}
              >
                {group.name}
                <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-regular)]">
                  {group.examples.length.toString().padStart(2, "0")}
                </span>
              </h2>
              <p className="mt-1 mb-0 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)] mx-0">
                {group.description}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 items-stretch gap-4 max-[64rem]:grid-cols-1">
            {group.examples.map((example) => (
              <ComponentPreview key={example.id} example={example} />
            ))}
          </div>
        </section>
      ))}
      {!visible.length && (
        <div className="grid justify-items-center text-center border border-[var(--ds-color-line)] border-dashed rounded-[var(--ds-radius-lg)] py-12 px-5 gap-3">
          <Search
            className="w-6 h-6 text-[var(--ds-color-muted)]"
            aria-hidden="true"
          />
          <h2 className="text-[length:var(--type-size-md)] font-[number:var(--type-weight-medium)]">
            没有找到匹配的组件
          </h2>
          <p className="mt-0 mb-2 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] mx-0">
            试试「按钮」「输入」或英文名称，也可以清除筛选重新浏览。
          </p>
          <Button variant="outline" onClick={reset}>
            清除筛选
          </Button>
        </div>
      )}
    </div>
  );
}
