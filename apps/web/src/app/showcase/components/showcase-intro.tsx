"use client";

import { Badge } from "@/shared/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { themes } from "@template/design-tokens/themes";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { componentExamples } from "./component-registry";
import { useShowcase } from "./showcase-context";

const themeOptions = themes.map((theme) => ({
  value: theme.id,
  label: theme.name,
}));

export function ShowcaseIntro() {
  const { activeId, selectTheme } = useShowcase();
  return (
    <header className="flex items-center justify-between pt-3 pb-2 px-0 gap-8 max-[64rem]:items-start max-[40rem]:flex-col max-[40rem]:gap-5">
      <div>
        <h1
          className="text-[length:clamp(1.65rem,_2.6vw,_2.4rem)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[1.4] m-0"
          id="components-title"
        >
          熟悉的组件，
          <span className="text-[var(--ds-color-muted)] max-[64rem]:block max-[40rem]:block">
            我们的设计语言。
          </span>
        </h1>
        <p className="max-w-160 mt-3 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] mx-0">
          从基础操作到浮层交互，每一种状态都遵循同一套主题。选择一个组件，直接体验。
        </p>
        <div className="flex flex-wrap items-center mt-5 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)] gap-3">
          <Badge variant="outline">shadcn/ui · Base UI</Badge>
          <span>{componentExamples.length} 个组件示例</span>
          <span>6 个分类区块</span>
        </div>
      </div>
      <div className="grid w-44 shrink-0 border-l border-l-[var(--ds-color-line)] pl-6 gap-2 max-[40rem]:w-full max-[40rem]:max-w-72 max-[40rem]:border-l-0 max-[40rem]:pl-0">
        <label
          className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]"
          id="component-theme-label"
        >
          预览主题
        </label>
        <Select
          items={themeOptions}
          value={activeId}
          onValueChange={(value) => {
            const selected = themes.find((theme) => theme.id === value);
            if (selected) selectTheme(selected.id);
          }}
        >
          <SelectTrigger
            aria-labelledby="component-theme-label"
            className="w-full"
          >
            <span className="size-2 shrink-0 rounded-full bg-primary" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {themes.map((theme) => (
              <SelectItem key={theme.id} value={theme.id}>
                {theme.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Link
          className="inline-flex items-center w-[fit-content] mt-1 text-[length:var(--type-size-xs)] text-[var(--ds-color-accent-ink)] gap-1"
          href="/colors"
        >
          调整主题颜色
          <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}
