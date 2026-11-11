"use client";

import { ArrowUpRight } from "lucide-react";

export function ShowcaseFooter() {
  return (
    <footer className="border-t border-border/40 pt-4 text-xs text-muted-foreground">
      <a
        className="inline-flex items-center gap-1"
        href="https://uiarc.dev/components/button"
        target="_blank"
        rel="noreferrer"
      >
        探索 Arc UI
        <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
      </a>
    </footer>
  );
}
