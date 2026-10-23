import { WorkspacePreview } from "./workspace-preview";

export function HomePreview() {
  return (
    <div className="pt-8 border-t border-t-[var(--ds-color-line)]">
      <div className="flex items-end justify-between mb-5 gap-4 max-[42rem]:items-start">
        <div>
          <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
            落在真实界面里
          </span>
          <h2 className="mt-1 mb-0 text-[length:var(--type-size-xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-heading)] mx-0 max-[42rem]:text-[length:var(--type-size-lg)]">
            一眼看见规则如何协作
          </h2>
        </div>
        <span className="inline-flex flex-none items-center border border-[var(--ds-color-line)] rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-surface)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] py-2 px-3 gap-2 max-[42rem]:text-[length:0] max-[42rem]:p-2">
          <span className="w-1.5 h-1.5 bg-[var(--ds-color-success)] max-[42rem]:w-2 max-[42rem]:h-2" />
          主题实时预览
        </span>
      </div>
      <WorkspacePreview />
      <div className="flex justify-between mt-3 text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-3 max-[30rem]:text-[length:var(--type-size-xs)]">
        <span>主题应用示例</span>
        <span>颜色 · 字体 · 间距 · 状态</span>
      </div>
    </div>
  );
}
