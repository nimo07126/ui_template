"use client";

import { ArrowUpRight } from "lucide-react";

export function ShowcaseFooter() {
  return (
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
  );
}
