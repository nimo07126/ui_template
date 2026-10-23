const spacingSamples = [
  { name: "紧凑", token: "space-2", className: "w-2" },
  { name: "常规", token: "space-4", className: "w-4" },
  { name: "宽松", token: "space-6", className: "w-6" },
  { name: "区块", token: "space-10", className: "w-10" },
];

export function SpacingBoard() {
  return (
    <div className="border border-[var(--ds-color-line)] rounded-[var(--ds-radius-xl)] bg-[var(--ds-color-surface)] p-5 max-[36rem]:p-4">
      <div className="flex items-baseline justify-between mb-4 gap-3 max-[36rem]:items-start">
        <strong className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-semibold)]">
          间距阶梯
        </strong>
        <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] max-[36rem]:max-w-36 max-[36rem]:text-right">
          4px 基础单位
        </span>
      </div>
      <div className="grid gap-3">
        {spacingSamples.map((sample) => (
          <div
            className="grid grid-cols-[3rem_minmax(0,_1fr)_3.75rem] items-center gap-3"
            key={sample.token}
          >
            <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
              {sample.name}
            </span>
            <div className="h-5 flex items-center border-l border-l-[var(--ds-color-line-strong)] border-dashed">
              <span
                className={`block h-2.5 rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-accent-soft)] ${sample.className}`}
              />
            </div>
            <code className="text-right">{sample.token}</code>
          </div>
        ))}
      </div>
      <div className="flex items-center mt-4 pt-3 border-t border-t-[var(--ds-color-line)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-2">
        <span className="w-2 h-2 rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-accent)]" />
        相关内容靠近，不相关内容拉开。
      </div>
    </div>
  );
}
