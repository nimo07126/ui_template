"use client";

import { Button } from "@/shared/ui/button";
import { Search } from "lucide-react";
import { ComponentPreview } from "./component-preview";
import { useShowcase } from "./showcase-context";

export function ShowcaseGroups() {
  const { visible, groups, reset } = useShowcase();
  return (
    <div className="@container grid min-w-0 gap-14 md:gap-20">
      {groups.map((group) => (
        <section
          key={group.id}
          aria-labelledby={`${group.id}-heading`}
          className="grid min-w-0 gap-8 not-first:border-t not-first:border-[var(--ds-color-line)] not-first:pt-10 md:gap-10 md:not-first:pt-14"
        >
          <header>
            <h2
              className="text-xl leading-snug font-semibold tracking-tight md:text-2xl"
              id={`${group.id}-heading`}
              tabIndex={-1}
            >
              {group.name}
            </h2>
            <p className="mt-2 text-sm text-[var(--ds-color-muted)]">{group.description}</p>
          </header>
          <div className="grid min-w-0 grid-cols-1 items-start gap-x-8 gap-y-10 @min-[39rem]:grid-cols-2 @min-[58rem]:grid-cols-6 @min-[58rem]:gap-y-12">
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
