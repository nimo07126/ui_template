"use client";

import { Button } from "@/shared/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/input-group";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { componentExamples, componentGroups } from "./component-registry";
import { useShowcase } from "./showcase-context";

export function ShowcaseToolbar() {
  const { query, setQuery, category, setCategory, matchesQuery, visible } =
    useShowcase();
  return (
    <div className="grid border-t border-t-[var(--ds-color-line)] border-b border-b-[var(--ds-color-line)] py-5 px-0 gap-4">
      <div className="flex items-center justify-between gap-4 max-[40rem]:flex-wrap max-[40rem]:gap-2">
        <InputGroup className="max-w-100 bg-[var(--ds-color-surface)] max-[40rem]:max-w-[none]">
          <InputGroupAddon>
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="搜索组件"
            placeholder="搜索组件名称、用途…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <InputGroupAddon align="inline-end">
              <Button
                aria-label="清空搜索"
                size="icon-xs"
                variant="ghost"
                onClick={() => setQuery("")}
              >
                <X />
              </Button>
            </InputGroupAddon>
          )}
        </InputGroup>
        <span
          className="shrink-0 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)] tabular-nums"
          role="status"
          aria-live="polite"
        >
          {visible.length} / {componentExamples.length} 个示例
        </span>
      </div>
      <div
        className="flex flex-wrap items-center gap-2 max-[40rem]:gap-1"
        role="group"
        aria-label="组件分类"
      >
        <Button
          size="sm"
          variant={category === "all" ? "default" : "ghost"}
          aria-pressed={category === "all"}
          onClick={() => setCategory("all")}
        >
          <SlidersHorizontal />
          全部组件
          <span className="text-[length:0.65rem] opacity-65 tabular-nums">
            {componentExamples.filter(matchesQuery).length}
          </span>
        </Button>
        {componentGroups.map((group) => (
          <Button
            key={group.id}
            size="sm"
            variant={category === group.id ? "default" : "ghost"}
            aria-pressed={category === group.id}
            onClick={() => setCategory(group.id)}
          >
            {group.name}
            <span className="text-[length:0.65rem] opacity-65 tabular-nums">
              {
                componentExamples.filter(
                  (example) =>
                    example.group === group.id && matchesQuery(example),
                ).length
              }
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
