import { tokens } from "@template/design-tokens";
import { weightLabels, type WeightKey } from "./typography-data";

export function TypographyFoundation() {
  return (
    <dl className="grid grid-cols-3  m-0 py-4 px-0 gap-4 max-[52rem]:gap-3 max-[36rem]:grid-cols-1">
      <div className="min-w-0">
        <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
          字体族 Family
        </dt>
        <dd className="mt-1 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] mx-0">
          系统中文无衬线
        </dd>
        <code className="block wrap-anywhere mt-1 text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)]">
          --type-family-sans
        </code>
      </div>
      <div className="min-w-0">
        <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
          字重 Weight
        </dt>
        <dd className="mt-1 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] flex flex-wrap gap-y-1 gap-x-3 mx-0">
          {Object.entries(tokens.type.weight).map(([key, value]) => (
            <span className="whitespace-nowrap" key={key}>
              {value} · {weightLabels[key as WeightKey]}
            </span>
          ))}
        </dd>
        <code className="block wrap-anywhere mt-1 text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)]">
          --type-weight-*
        </code>
      </div>
      <div className="min-w-0">
        <dt className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
          字距 Tracking
        </dt>
        <dd className="mt-1 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] flex flex-wrap gap-y-1 gap-x-3 mx-0">
          {Object.entries(tokens.type.tracking).map(([key, value]) => (
            <span className="whitespace-nowrap" key={key}>
              {key === "tight" ? "紧凑" : "常规"} ·{" "}
              {value === "0" ? "0px" : value}
            </span>
          ))}
        </dd>
        <code className="block wrap-anywhere mt-1 text-[var(--ds-color-muted)] font-[family-name:var(--type-family-sans)] text-[length:var(--type-size-xs)]">
          --type-tracking-*
        </code>
      </div>
    </dl>
  );
}
