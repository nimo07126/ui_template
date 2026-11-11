"use client";

import { Button } from "@/shared/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/shared/ui/input-group";
import { ChevronDown, Search, X } from "lucide-react";
import { componentGroups } from "./component-registry";
import { useShowcase } from "./showcase-context";

export function ShowcaseToolbar() {
  const { query, setQuery, category, setCategory, visible } = useShowcase();
  const filtering = query.trim() !== "" || category !== "all";

  return (
    <div role="search" aria-label="搜索与筛选组件" className="grid min-w-0 max-w-xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-2">
      <InputGroup className="h-10">
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="搜索组件"
          placeholder="搜索组件…"
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
              <X aria-hidden="true" />
            </Button>
          </InputGroupAddon>
        )}
      </InputGroup>
      <div className="relative">
        <select
          aria-label="按分类筛选"
          className="h-10 appearance-none rounded-lg border border-input bg-[var(--theme-field-background)] py-0 pr-8 pl-3 text-sm text-foreground"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          <option value="all">全部分类</option>
          {componentGroups.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
      </div>
      <span className={filtering ? "col-span-full text-xs text-muted-foreground tabular-nums" : "sr-only"} role="status">
        {filtering ? `${visible.length} 个匹配示例` : ""}
      </span>
    </div>
  );
}
