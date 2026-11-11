"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/arc/popover/popover";
import { Button } from "@/shared/ui/button";
import { BookOpen, Check, CodeXml, Copy } from "lucide-react";
import { useEffect, useRef, useState, type ComponentType } from "react";
import type { ComponentExample, DemoLoader } from "./example-types";

const observers = new WeakMap<Element | Document, IntersectionObserver>();
const pendingDemos = new WeakMap<Element, () => void>();

function loadNearViewport(target: Element, load: () => void) {
  if (typeof IntersectionObserver === "undefined") {
    load();
    return () => {};
  }

  const root = target.closest('[data-slot="page-scroll"]');
  const key = root ?? target.ownerDocument;
  let observer = observers.get(key);
  if (!observer) {
    observer = new IntersectionObserver((entries, currentObserver) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        currentObserver.unobserve(entry.target);
        const start = pendingDemos.get(entry.target);
        pendingDemos.delete(entry.target);
        start?.();
      }
    }, { root, rootMargin: "400px 0px" });
    observers.set(key, observer);
  }

  pendingDemos.set(target, load);
  observer.observe(target);
  return () => {
    observer.unobserve(target);
    pendingDemos.delete(target);
  };
}

function LiveDemo({ load }: { load: DemoLoader }) {
  const targetRef = useRef<HTMLDivElement>(null);
  const [Demo, setDemo] = useState<ComponentType | "failed">();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const target = targetRef.current;
    if (!target) return;

    let active = true;
    const stop = loadNearViewport(target, () => {
      load().then(
        ({ default: Component }) => { if (active) setDemo(() => Component); },
        () => { if (active) setDemo("failed"); },
      );
    });

    return () => {
      active = false;
      stop();
    };
  }, [load, attempt]);

  return (
    <div
      ref={targetRef}
      className="relative grid min-h-16 min-w-0 content-start items-start justify-items-start [&>*]:min-w-0 [&>*]:max-w-full"
      data-live-demo={Demo && Demo !== "failed" ? "ready" : Demo ?? "pending"}
    >
      {Demo === "failed" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ds-color-muted)]">
          <p role="alert">预览加载失败。</p>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => {
              setDemo(undefined);
              setAttempt((current) => current + 1);
            }}
          >
            重试
          </Button>
        </div>
      ) : Demo ? (
        <Demo />
      ) : (
        <p className="text-xs text-[var(--ds-color-muted)]">正在加载预览…</p>
      )}
    </div>
  );
}

const sizeClasses = {
  compact: "@min-[58rem]:col-span-2",
  wide: "@min-[39rem]:col-span-2 @min-[58rem]:col-span-3",
  full: "col-span-full",
};

const actionClassName = "inline-grid size-8 place-items-center rounded-md text-[var(--ds-color-muted)] hover:bg-[var(--ds-color-accent-soft)] hover:text-[var(--ds-color-accent-ink)]";

export function ComponentPreview({ example }: { example: ComponentExample }) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [showImport, setShowImport] = useState(false);
  const source = example.source === "shadcn" ? "shadcn/ui" : example.tier ? "Arc Pro" : "Arc UI";

  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 2000);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function copyImport() {
    try {
      await navigator.clipboard.writeText(example.importStatement);
      setCopyState("copied");
    } catch {
      setCopyState("error");
      setShowImport(true);
    }
  }

  return (
    <article
      className={`grid min-w-0 content-start gap-6 ${sizeClasses[example.size ?? "compact"]}`}
      id={example.id}
      tabIndex={-1}
      aria-labelledby={`${example.id}-title`}
      data-source={example.source}
    >
      <header className="flex min-w-0 items-start justify-between gap-2 rounded-lg bg-muted px-3 py-2.5">
        <div className="min-w-0">
          <h3 id={`${example.id}-title`} className="text-base leading-snug font-semibold">
            {example.title}
          </h3>
          <p className="mt-1 text-xs text-[var(--ds-color-muted)]">
            {example.name} <span aria-hidden="true">·</span> {source}
          </p>
        </div>
        <div className="-mt-1 flex shrink-0 items-center gap-0.5">
          <a
            className={actionClassName}
            href={example.docs}
            target="_blank"
            rel="noreferrer"
            title="官方文档"
            aria-label={`查看 ${example.name} 官方文档`}
          >
            <BookOpen className="size-4" aria-hidden="true" />
          </a>
          <Popover open={showImport} onOpenChange={setShowImport}>
            <PopoverTrigger
              className={`${actionClassName} aria-expanded:bg-[var(--ds-color-accent-soft)] aria-expanded:text-[var(--ds-color-accent-ink)]`}
              title="查看引用"
              aria-label="查看引用"
            >
              <CodeXml className="size-4" aria-hidden="true" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80" aria-label={`${example.name} 引用`}>
              {copyState === "error" && (
                <p className="mb-2 text-xs text-[var(--ds-color-danger)]" role="alert">
                  复制失败，请手动选择下方引用。
                </p>
              )}
              <pre className="text-xs leading-relaxed wrap-break-word whitespace-pre-wrap">
                <code>{example.importStatement}</code>
              </pre>
            </PopoverContent>
          </Popover>
          <button
            className={actionClassName}
            type="button"
            title={copyState === "copied" ? "已复制" : "复制引用"}
            aria-label="复制引用"
            onClick={copyImport}
          >
            {copyState === "copied" ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Copy className="size-4" aria-hidden="true" />
            )}
          </button>
          <span className="sr-only" role="status">
            {copyState === "copied" ? `${example.name} 引用已复制` : ""}
          </span>
        </div>
      </header>

      <LiveDemo load={example.loadDemo} />
    </article>
  );
}
