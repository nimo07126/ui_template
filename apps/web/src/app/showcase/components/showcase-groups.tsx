"use client";

import { Button } from "@/shared/ui/button";
import { Search } from "lucide-react";
import { ComponentPreview } from "./component-preview";
import { useShowcase } from "./showcase-context";

export function ShowcaseGroups() {
  const { visible, groups, reset } = useShowcase();
  return (
    <div className="@container grid min-w-0 gap-12 md:gap-16">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="grid min-w-0 gap-4 md:gap-5"
        >
          <header className="flex items-baseline justify-between gap-4">
            <h2
              className="text-xl leading-snug font-semibold tracking-tight"
              id={`${group.id}-heading`}
              tabIndex={-1}
            >
              {group.name}
            </h2>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{group.examples.length} 个示例</span>
          </header>
          <div className="grid min-w-0 grid-cols-1 gap-x-8 gap-y-6 @min-[39rem]:grid-cols-2 @min-[39rem]:gap-y-7 @min-[64rem]:grid-cols-6">
            {group.examples.map((example) => (
              <ComponentPreview key={example.id} example={example} />
            ))}
          </div>
        </section>
      ))}
      {!visible.length && (
        <div className="grid justify-items-center gap-3 px-5 py-12 text-center">
          <Search
            className="w-6 h-6 text-[var(--ds-color-muted)]"
            aria-hidden="true"
          />
          <h2 className="text-[length:var(--type-size-md)] font-[number:var(--type-weight-medium)]">
            没有找到匹配的组件
          </h2>
          <p className="mt-0 mb-2 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] mx-0">
            试试「按钮」或组件的英文名称。
          </p>
          <Button variant="outline" onClick={reset}>
            清除筛选
          </Button>
        </div>
      )}
    </div>
  );
}
