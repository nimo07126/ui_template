"use client";

import { Select } from "@/shared/arc/select/select";
import { themes } from "@template/design-tokens/themes";
import { componentExamples } from "./component-registry";
import { useShowcase } from "./showcase-context";

const themeOptions = themes.map((theme) => ({
  value: theme.id,
  label: theme.name,
}));
const baseCount = componentExamples.filter(({ source, tier }) => source === "arc" && !tier).length;
const proCount = componentExamples.filter(({ tier }) => tier === "pro").length;
const shadcnCount = componentExamples.filter(({ source }) => source === "shadcn").length;

export function ShowcaseIntro() {
  const { activeId, selectTheme } = useShowcase();
  return (
    <header className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b border-border/40 pb-5 sm:gap-x-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" id="components-title">
        组件预览
      </h1>
      <div className="col-start-2 row-start-1 w-32 sm:row-span-2 sm:w-40 [&_label]:text-xs! [&_label]:text-muted-foreground">
        <Select
          label="预览主题"
          options={themeOptions}
          value={activeId}
          onValueChange={(value) => {
            const selected = themes.find((theme) => theme.id === value);
            if (selected) selectTheme(selected.id);
          }}
        />
      </div>
      <p className="col-span-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground tabular-nums sm:col-span-1">
        <span>Arc UI 基础 {baseCount}</span>
        <span>Arc Pro {proCount}</span>
        <span>shadcn/ui {shadcnCount}</span>
      </p>
    </header>
  );
}
