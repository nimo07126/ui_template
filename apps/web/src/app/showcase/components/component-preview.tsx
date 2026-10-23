"use client";

import { Button } from "@/shared/ui/button";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import { useState } from "react";
import type { ComponentExample as Example } from "./example-types";

export function ComponentPreview({ example }: { example: Example }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [showImport, setShowImport] = useState(false);
  const source = `import { ${example.imports} } from "@/shared/ui/${example.id}";`;
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
