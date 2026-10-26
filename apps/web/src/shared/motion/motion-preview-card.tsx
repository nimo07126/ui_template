"use client";

import { Button } from "@/shared/ui/button";
import { Slider } from "@/shared/ui/slider";
import { Check, ChevronDown, Copy, Pause, Play, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { MotionCatalogItem } from "./motion-catalog";

function formatValue(value: number | string | boolean, unit?: string) {
  if (typeof value === "boolean") return value ? "开" : "关";
  return `${value}${unit ? ` ${unit}` : ""}`;
}

export function MotionPreviewCard({ item }: { item: MotionCatalogItem }) {
  const [params, setParams] = useState<Record<string, number | string | boolean>>(
    Object.fromEntries(item.parameters.map((parameter) => [parameter.id, parameter.defaultValue])),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [showCode, setShowCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const Demo = item.demo;

  const reset = () => {
    setParams(Object.fromEntries(item.parameters.map((parameter) => [parameter.id, parameter.defaultValue])));
    setIsPlaying(false);
    setIsPaused(false);
    setResetKey((value) => value + 1);
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className="grid gap-6 rounded-[2rem] bg-[var(--theme-background-secondary)] p-5 md:grid-cols-[minmax(13rem,0.72fr)_minmax(0,1.45fr)] md:gap-8 md:p-7" id={item.id}>
      <div className="flex min-w-0 flex-col justify-between gap-7">
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)]">
            <span className="rounded-full bg-background px-2.5 py-1">{item.category}</span>
            <span>{item.api}</span>
          </div>
          <h2 className="m-0 text-[length:var(--type-size-xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)]">
            {item.name}
          </h2>
          <p className="mt-2 mb-0 text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] text-[var(--ds-color-muted)]">
            {item.englishName}
          </p>
          <p className="mt-4 mb-0 text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] text-foreground/75">
            {item.description}
          </p>
        </div>

        <div className="grid gap-4">
          <div className="grid gap-3">
            {item.parameters.map((parameter) => {
              const value = params[parameter.id];
              if (parameter.type === "select") {
                return (
                  <label className="grid gap-2" key={parameter.id}>
                    <span className="flex items-center justify-between text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)]">
                      <span>{parameter.label}</span>
                      <span>{String(value)}</span>
                    </span>
                    <select
                      className="h-9 rounded-xl bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      value={String(value)}
                      onChange={(event) => setParams((current) => ({ ...current, [parameter.id]: event.target.value }))}
                    >
                      {parameter.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                );
              }

              if (parameter.type === "toggle") {
                return (
                  <Button
                    aria-pressed={Boolean(value)}
                    className="justify-between bg-background text-xs"
                    key={parameter.id}
                    onClick={() => setParams((current) => ({ ...current, [parameter.id]: !Boolean(value) }))}
                    variant="ghost"
                  >
                    {parameter.label}
                    <span>{formatValue(value)}</span>
                  </Button>
                );
              }

              const numericValue = Number(value);
              return (
                <label className="grid gap-2" key={parameter.id}>
                  <span className="flex items-center justify-between text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)]">
                    <span>{parameter.label}</span>
                    <span className="tabular-nums">{formatValue(numericValue, parameter.unit)}</span>
                  </span>
                  <Slider
                    aria-label={parameter.label}
                    max={parameter.max}
                    min={parameter.min}
                    onValueChange={(nextValue) => {
                      const next = Array.isArray(nextValue) ? nextValue[0] : nextValue;
                      if (typeof next === "number") setParams((current) => ({ ...current, [parameter.id]: next }));
                    }}
                    step={parameter.step}
                    value={[numericValue]}
                  />
                </label>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              aria-label={isPlaying && !isPaused ? `暂停${item.name}` : `播放${item.name}`}
              onClick={() => {
                setIsPlaying(true);
                setIsPaused((current) => (isPlaying ? !current : false));
              }}
              size="sm"
            >
              {isPlaying && !isPaused ? <Pause /> : <Play />}
              {isPlaying && !isPaused ? "暂停预览" : "播放预览"}
            </Button>
            <Button aria-label={`重置${item.name}`} onClick={reset} size="sm" variant="ghost">
              <RotateCcw />
              重置
            </Button>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-3">
        <div className="min-w-0">
          <Demo isPaused={isPaused} isPlaying={isPlaying} key={`${item.id}-${resetKey}`} params={params} />
        </div>
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[length:var(--type-size-xs)] text-[var(--ds-color-muted)]">
            {isPlaying ? (isPaused ? "已暂停 · 点击继续" : "预览播放中") : "点击播放，启动动效"}
          </span>
          <Button aria-expanded={showCode} onClick={() => setShowCode((value) => !value)} size="xs" variant="ghost">
            <ChevronDown className={showCode ? "rotate-180 transition-transform" : "transition-transform"} />
            {showCode ? "收起代码" : "查看代码"}
          </Button>
        </div>
        {showCode && (
          <div className="relative rounded-2xl bg-background p-4">
            <Button aria-label="复制代码" className="absolute right-2 top-2" onClick={copyCode} size="icon-xs" variant="ghost">
              {copied ? <Check /> : <Copy />}
            </Button>
            <pre className="m-0 overflow-x-auto pr-8 text-[length:0.7rem] leading-[1.8] text-foreground/80"><code>{item.code}</code></pre>
          </div>
        )}
      </div>
    </article>
  );
}
