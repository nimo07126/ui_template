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
import styles from "./component-samples.module.css";

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
      className={styles.previewCard}
      id={example.id}
      aria-labelledby={`${example.id}-title`}
    >
      <header className={styles.previewHeader}>
        <div>
          <h3 id={`${example.id}-title`}>
            {example.title}
            <span>{example.name}</span>
          </h3>
          <p>{example.description}</p>
        </div>
        <a
          className={styles.docsLink}
          href={`https://ui.shadcn.com/docs/components/base/${example.id}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看 ${example.name} 官方文档`}
        >
          <ArrowUpRight aria-hidden="true" />
        </a>
      </header>
      <div className={styles.previewStage}>
        <Demo />
      </div>
      <footer className={styles.previewFooter}>
        <Button
          size="xs"
          variant="ghost"
          aria-expanded={showImport}
          aria-controls={`${example.id}-import`}
          onClick={() => setShowImport(!showImport)}
        >
          {showImport ? "收起引用" : "查看引用"}
        </Button>
        <Button size="xs" variant="ghost" onClick={copyImport}>
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
        className={styles.importCode}
      >
        {copyState === "error" && (
          <p role="alert">浏览器暂不支持复制，请手动选择下方引用。</p>
        )}
        <pre>
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
      <section aria-labelledby="components-title" className={styles.library}>
        <header className={styles.intro}>
          <div>
            <div className={styles.eyebrow}>
              <Component aria-hidden="true" />
              <span>澄序 · 组件预览库</span>
              <span className={styles.eyebrowLine} />
            </div>
            <h1 id="components-title">
              熟悉的组件，<span>我们的设计语言。</span>
            </h1>
            <p>
              从基础操作到浮层交互，每一种状态都遵循同一套主题。选择一个组件，直接体验。
            </p>
            <div className={styles.introMeta}>
              <Badge variant="outline">shadcn/ui · Base UI</Badge>
              <span>{componentExamples.length} 个组件示例</span>
              <span>6 个分类区块</span>
            </div>
          </div>
          <div className={styles.themeControl}>
            <label id="component-theme-label">预览主题</label>
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
            <Link href="/colors">
              调整主题颜色
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.searchRow}>
            <InputGroup className={styles.search}>
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
              className={styles.resultCount}
              role="status"
              aria-live="polite"
            >
              {visible.length} / {componentExamples.length} 个示例
            </span>
          </div>
          <div className={styles.categories} role="group" aria-label="组件分类">
            <Button
              size="sm"
              variant={category === "all" ? "default" : "ghost"}
              aria-pressed={category === "all"}
              onClick={() => setCategory("all")}
            >
              <SlidersHorizontal />
              全部组件
              <span className={styles.count}>
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
                <span className={styles.count}>
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

        <div className={styles.groups}>
          {groups.map((group) => (
            <section
              key={group.id}
              aria-labelledby={`${group.id}-heading`}
              className={styles.group}
            >
              <div className={styles.groupHeading}>
                <span className={styles.groupIndex}>{group.icon}</span>
                <div>
                  <h2 id={`${group.id}-heading`}>
                    {group.name}
                    <span>
                      {group.examples.length.toString().padStart(2, "0")}
                    </span>
                  </h2>
                  <p>{group.description}</p>
                </div>
              </div>
              <div className={styles.previewGrid}>
                {group.examples.map((example) => (
                  <ComponentPreview key={example.id} example={example} />
                ))}
              </div>
            </section>
          ))}
          {!visible.length && (
            <div className={styles.noResults}>
              <Search aria-hidden="true" />
              <h2>没有找到匹配的组件</h2>
              <p>试试「按钮」「输入」或英文名称，也可以清除筛选重新浏览。</p>
              <Button variant="outline" onClick={reset}>
                清除筛选
              </Button>
            </div>
          )}
        </div>
        <footer className={styles.libraryFooter}>
          <span>同一套语义颜色，贯穿每个交互细节。</span>
          <a
            href="https://ui.shadcn.com/docs/components"
            target="_blank"
            rel="noreferrer"
          >
            探索 shadcn/ui
            <ArrowUpRight aria-hidden="true" />
          </a>
        </footer>
      </section>
    </Toaster>
  );
}
