import { Icon } from "@/shared/ui/icon";

export function RadiusBoard() {
  return (
    <div className="border border-[var(--ds-color-line)] rounded-[var(--ds-radius-xl)] bg-[var(--ds-color-surface)] p-5 max-[36rem]:p-4">
      <div className="flex items-baseline justify-between mb-4 gap-3 max-[36rem]:items-start">
        <strong className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-semibold)]">
          圆角层级
        </strong>
        <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] max-[36rem]:max-w-36 max-[36rem]:text-right">
          结构清晰，不做过度柔化
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 max-[36rem]:gap-1">
        <div className="grid justify-items-center text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-2">
          <span className="last:grid last:text-center last:gap-0.5 block w-16 h-12 border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface-subtle)] rounded-[var(--ds-radius-sm)] max-[36rem]:w-13 max-[36rem]:h-10" />
          <span className="last:grid last:text-center last:gap-0.5">
            小型控件{" "}
            <code className="text-[var(--ds-color-muted-soft)]">8</code>
          </span>
        </div>
        <div className="grid justify-items-center text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-2">
          <span className="last:grid last:text-center last:gap-0.5 block w-16 h-12 border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface-subtle)] rounded-[var(--ds-radius-md)] max-[36rem]:w-13 max-[36rem]:h-10" />
          <span className="last:grid last:text-center last:gap-0.5">
            常用容器{" "}
            <code className="text-[var(--ds-color-muted-soft)]">12</code>
          </span>
        </div>
        <div className="grid justify-items-center text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-2">
          <span className="last:grid last:text-center last:gap-0.5 block w-16 h-12 border border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface-subtle)] rounded-[var(--ds-radius-xl)] max-[36rem]:w-13 max-[36rem]:h-10" />
          <span className="last:grid last:text-center last:gap-0.5">
            展示面板{" "}
            <code className="text-[var(--ds-color-muted-soft)]">22</code>
          </span>
        </div>
      </div>
      <div className="flex items-center mt-5 pt-4 border-t border-t-[var(--ds-color-line)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-3">
        <span className="grid w-10 h-10 flex-none place-items-center border border-[var(--ds-color-line)] rounded-[var(--ds-radius-md)] bg-[var(--ds-color-surface)] shadow-[var(--shadow-soft)] text-[var(--ds-color-accent)]">
          <Icon className="w-4" name="spark" />
        </span>
        <span>轻柔阴影只用于浮层和预览边界</span>
      </div>
    </div>
  );
}
