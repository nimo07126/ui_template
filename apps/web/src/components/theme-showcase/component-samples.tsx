"use client";

import { useState } from "react";
import Link from "next/link";
import { themes } from "@template/design-tokens/themes";
import {
  ArrowUpRight,
  Check,
  Component,
  Copy,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useThemeEditor } from "@/components/theme-editor/theme-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Toaster } from "@/components/ui/toast";
import { componentExamples, componentGroups } from "./component-demos";

type Example = (typeof componentExamples)[number];
const themeOptions = themes.map((theme) => ({
  value: theme.id,
  label: theme.name,
}));

function ComponentPreview({ example }: { example: Example }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [showImport, setShowImport] = useState(false);
  const source = `import { ${example.imports} } from "@/components/ui/${example.id}";`;
  const copyImport = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("error");
      setShowImport(true);
    }
  };
  const Demo = example.demo;

  return (
    <article
      className="flex min-w-0 flex-col border border-[var(--ds-color-line)] rounded-[var(--ds-radius-lg)] bg-[var(--ds-color-surface)] overflow-hidden scroll-mt-8 min-[78rem]:first:last:max-w-[calc(50%_-_var(--space-2))]"
      id={example.id}
      aria-labelledby={`${example.id}-title`}
    >
      <header className="flex items-start justify-between p-5 gap-3 max-[40rem]:p-4">
        <div className="min-w-0">
          <h3
            className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[length:var(--type-size-sm)] font-[number:var(--type-weight-semibold)] m-0"
            id={`${example.id}-title`}
          >
            {example.title}
            <span className="text-[length:var(--type-size-xs)] font-[number:var(--type-weight-regular)] text-[var(--ds-color-muted)]">
              {example.name}
            </span>
          </h3>
          <p className="mt-2 mb-0 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)] leading-[var(--type-line-body)] mx-0">
            {example.description}
          </p>
        </div>
        <a
          className="grid place-items-center shrink-0 w-6 h-6 rounded-[var(--ds-radius-sm)] text-[var(--ds-color-muted)] hover:bg-[var(--ds-color-accent-soft)] hover:text-[var(--ds-color-accent-ink)]"
          href={`https://ui.shadcn.com/docs/components/base/${example.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看 ${example.name} 官方文档`}
        >
          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
        </a>
      </header>
      <div className="flex min-h-44 flex-1 items-center justify-center min-w-0 border-t border-t-[var(--ds-color-line)] border-dashed py-6 px-5 [&>*]:min-w-0 [&>*]:max-w-full max-[40rem]:py-5 max-[40rem]:px-4">
        <Demo />
      </div>
      <footer className="flex items-center justify-between border-t border-t-[var(--ds-color-line)] bg-[var(--theme-background-secondary)] py-2 px-4 gap-2">
        <Button
          className="text-[var(--ds-color-muted)]"
          size="xs"
          variant="ghost"
          aria-expanded={showImport}
          aria-controls={`${example.id}-import`}
          onClick={() => setShowImport(!showImport)}
        >
          {showImport ? "收起引用" : "查看引用"}
        </Button>
        <Button
          className="text-[var(--ds-color-muted)]"
          size="xs"
          variant="ghost"
          onClick={copyImport}
        >
          {copyState === "copied" ? <Check /> : <Copy />}
          {copyState === "copied" ? "已复制" : "复制引用"}
        </Button>
        <span className="sr-only" role="status">
          {copyState === "copied"
            ? `${example.name} 引用已复制`
            : copyState === "error"
              ? "复制失败，请展开引用后手动复制。"
              : ""}
        </span>
      </footer>
      <div
        id={`${example.id}-import`}
        hidden={!showImport}
        className="border-t border-t-[var(--ds-color-line)] bg-[var(--theme-background-secondary)] p-4"
      >
        {copyState === "error" && (
          <p
            className="mt-0 mb-2 text-[var(--ds-color-danger)] text-[length:var(--type-size-xs)] mx-0"
            role="alert"
          >
            浏览器暂不支持复制，请手动选择下方引用。
          </p>
        )}
        <pre className="overflow-x-auto text-[length:0.7rem] leading-[1.8] m-0">
          <code>{source}</code>
        </pre>
      </div>
    </article>
  );
}

export function ComponentSamples() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { activeId, selectTheme } = useThemeEditor();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (example: Example) =>
    `${example.title} ${example.name} ${example.id} ${example.description} ${componentGroups.find((group) => group.id === example.group)?.name}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  const visible = componentExamples.filter(
    (example) =>
      (category === "all" || example.group === category) &&
      matchesQuery(example),
  );
  const groups = componentGroups
    .map((group) => ({
      ...group,
      examples: visible.filter((example) => example.group === group.id),
    }))
    .filter((group) => group.examples.length);
  const reset = () => {
    setQuery("");
    setCategory("all");
  };

  return (
    <Toaster>
      <section
        aria-labelledby="components-title"
        className="grid min-w-0 gap-8 max-[40rem]:gap-6"
      >
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
        <footer className="flex flex-wrap justify-between border-t border-t-[var(--ds-color-line)] pt-5 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)] gap-3">
          <span>同一套语义颜色，贯穿每个交互细节。</span>
          <a
            className="inline-flex items-center gap-1"
            href="https://ui.shadcn.com/docs/components"
            target="_blank"
            rel="noreferrer"
          >
            探索 shadcn/ui
            <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </footer>
      </section>
    </Toaster>
  );
}
