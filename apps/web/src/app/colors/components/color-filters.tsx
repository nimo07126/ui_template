"use client";

import { tokenGroups } from "@template/design-tokens/themes";
import { Search } from "lucide-react";
import { useColorWorkbench } from "./color-workbench-context";

export function ColorFilters() {
  const { group, setGroup, query, setQuery } = useColorWorkbench();
  return (
    <div className="flex items-center justify-between mb-3.5 gap-4 max-[1100px]:items-start max-[1100px]:flex-col max-[1100px]:gap-3">
      <div
        className="flex items-center flex-wrap gap-1.5"
        role="group"
        aria-label="颜色功能分类"
      >
        <button
          className="border-0 rounded-[.375rem] bg-transparent text-[var(--muted-foreground)] cursor-pointer text-[length:.6875rem] whitespace-nowrap py-1.5 px-2 hover:text-[var(--foreground)] hover:bg-[var(--theme-surface-tertiary)] aria-pressed:bg-[var(--theme-accent-soft)] aria-pressed:text-[var(--theme-accent-soft-foreground)] aria-pressed:font-medium"
          aria-pressed={group === "all"}
          onClick={() => setGroup("all")}
        >
          全部
        </button>
        {tokenGroups.map((entry) => (
          <button
            className="border-0 rounded-[.375rem] bg-transparent text-[var(--muted-foreground)] cursor-pointer text-[length:.6875rem] whitespace-nowrap py-1.5 px-2 hover:text-[var(--foreground)] hover:bg-[var(--theme-surface-tertiary)] aria-pressed:bg-[var(--theme-accent-soft)] aria-pressed:text-[var(--theme-accent-soft-foreground)] aria-pressed:font-medium"
            aria-pressed={group === entry.id}
            onClick={() => setGroup(entry.id)}
            key={entry.id}
          >
            {entry.name}
          </button>
        ))}
      </div>
      <label className="flex items-center min-w-44 text-[var(--muted-foreground)] border border-[var(--border)] rounded-[.5rem] bg-[var(--card)] py-1.5 px-2.5 gap-2 focus-within:[outline:2px_solid_var(--ring)] focus-within:[outline-offset:2px] max-[1100px]:w-full max-[1100px]:max-w-80">
        <Search size={14} />
        <input
          className="w-full min-w-0 bg-transparent border-0 [outline:none] text-[length:.6875rem] text-[var(--foreground)]"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索功能或 token…"
          aria-label="搜索颜色功能"
        />
      </label>
    </div>
  );
}
