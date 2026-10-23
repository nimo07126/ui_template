import { SectionShared } from "@/components/layout/section-shared";
import { Icon } from "@/components/theme-showcase/icon";

const spacingSamples = [
  { name: "紧凑", token: "space-2", className: "w-2" },
  { name: "常规", token: "space-4", className: "w-4" },
  { name: "宽松", token: "space-6", className: "w-6" },
  { name: "区块", token: "space-10", className: "w-10" },
];

export default function SpacingPage() {
  return (
    <SectionShared id="spacing" aria-labelledby="spacing-title">
      <div className="max-w-92 max-[52rem]:max-w-144">
        <h1
          className="text-[length:var(--type-size-2xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-heading)] m-0 max-[52rem]:text-[length:var(--type-size-2xl)] max-[36rem]:text-[length:var(--type-size-xl)]"
          id="spacing-title"
        >
          节奏来自距离，
          <br />
          而不是更多装饰。
        </h1>
        <p className="mt-4 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] leading-[var(--type-line-body)] mx-0">
          间距以 4px
          为基础递增；圆角随元素层级变化。尺寸有规律，界面就会显得从容。
        </p>
      </div>

      <div className="grid gap-5">
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
      </div>
    </SectionShared>
  );
}
