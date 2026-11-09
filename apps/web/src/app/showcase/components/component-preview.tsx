"use client";

import { Button } from "@/shared/ui/button";
import { ArrowUpRight, Check, ChevronDown, Copy } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import type { ComponentExample as Example, DemoLoader } from "./example-types";
import { useShowcase } from "./showcase-context";

function LiveDemo({ load }: { load: DemoLoader }) {
  const [Demo, setDemo] = useState<ComponentType>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    load().then(
      ({ default: Component }) => { if (active) setDemo(() => Component); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, [load]);

  if (failed) return <p role="alert">预览加载失败。请收起后重新打开。</p>;
  if (!Demo) return <p role="status">正在加载预览…</p>;
  return <Demo />;
}

export function ComponentPreview({ example }: { example: Example }) {
  const { openExample, toggleExample } = useShowcase();
  const isOpen = openExample === example.id;
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );
  const [showImport, setShowImport] = useState(false);
  const source = example.importStatement;
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
  return (
    <article
      className="flex min-w-0 flex-col border border-[var(--ds-color-line)] rounded-[var(--ds-radius-lg)] bg-[var(--ds-color-surface)] overflow-hidden scroll-mt-8 data-[expanded=true]:col-span-full"
      id={example.id}
      aria-labelledby={`${example.id}-title`}
      data-expanded={isOpen}
      data-source={example.source}
    >
      <header className="flex flex-1 items-start justify-between p-5 gap-3 max-[40rem]:p-4">
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
          <span className="mt-2 inline-block rounded-full border px-2 py-0.5 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)]">
            {example.source === "arc" ? "Arc UI" : "shadcn/ui"}
          </span>
          <p className="mt-2 mb-0 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)] leading-[var(--type-line-body)] mx-0">
            {example.description}
          </p>
        </div>
        <a
          className="grid place-items-center shrink-0 w-6 h-6 rounded-[var(--ds-radius-sm)] text-[var(--ds-color-muted)] hover:bg-[var(--ds-color-accent-soft)] hover:text-[var(--ds-color-accent-ink)]"
          href={example.docs}
          target="_blank"
          rel="noreferrer"
          aria-label={`查看 ${example.name} 官方文档`}
        >
          <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
        </a>
      </header>
      <div id={`${example.id}-demo`} hidden={!isOpen}>
        {isOpen && (
          <div className="relative grid min-h-44 min-w-0 items-center justify-items-center border-t border-dashed py-6 px-5 [&>*]:min-w-0 [&>*]:max-w-full max-[40rem]:py-5 max-[40rem]:px-4" data-live-demo>
            <LiveDemo load={example.loadDemo} />
          </div>
        )}
      </div>
      <footer className="flex flex-wrap items-center border-t border-t-[var(--ds-color-line)] bg-[var(--theme-background-secondary)] py-2 px-4 gap-2">
        <Button
          className="mr-auto"
          size="xs"
          variant="outline"
          aria-expanded={isOpen}
          aria-controls={`${example.id}-demo`}
          onClick={() => toggleExample(example.id)}
        >
          <ChevronDown className={isOpen ? "rotate-180" : undefined} aria-hidden="true" />
          {isOpen ? "收起预览" : "打开预览"}
        </Button>
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
