import { Icon } from "@/shared/ui/icon";
import Link from "next/link";

export function HomeIntro() {
  return (
    <div className="grid grid-cols-[minmax(0,_1fr)_minmax(13rem,_17rem)] items-center mb-16 gap-12 max-[68rem]:grid-cols-[minmax(0,_1fr)_14rem] max-[68rem]:gap-8 max-[52rem]:grid-cols-[minmax(0,_1fr)_13rem] max-[52rem]:mb-12 max-[52rem]:gap-6 max-[42rem]:block">
      <div className="max-w-168">
        <div className="flex items-center mb-5 text-[var(--ds-color-muted)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] gap-2">
          <span className="w-2 h-2 rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-accent)] shadow-[0_0_0_0.25rem_var(--ds-color-accent-soft)]" />
          一套安静、清晰的界面语言
        </div>
        <h1
          className="text-[var(--ds-color-ink)] text-[length:clamp(var(--type-size-3xl),_5vw,_var(--type-size-display))] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-tight)] m-0 max-[52rem]:text-[length:clamp(var(--type-size-3xl),_7vw,_var(--type-size-display))] max-[30rem]:text-[length:var(--type-size-3xl)]"
          id="overview-title"
        >
          为内容留白，
          <br />
          为重点着色。
        </h1>
        <p className="max-w-140 mt-5 mb-0 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-md)] leading-[var(--type-line-body)] mx-0">
          「澄序」以柔和的灰蓝为底，用低饱和紫靛标记关键时刻。它不抢内容的声音，只让重要的事更容易被看见。
        </p>
        <div className="flex flex-wrap items-center mt-6 gap-5">
          <Link
            className="inline-flex min-h-[var(--layout-control-height)] items-center rounded-[var(--ds-radius-md)] bg-[var(--ds-color-accent)] text-[var(--theme-accent-foreground)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-semibold)] [transition:background-color_160ms_ease,_transform_160ms_ease] py-0 px-4 gap-2 hover:[transform:translateY(-1px)] hover:bg-[var(--ds-color-accent-hover)]"
            href="/colors"
          >
            查看设计规则 <Icon className="w-4" name="chevron" />
          </Link>
          <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
            主题编号{" "}
            <strong className="ml-2 text-[var(--ds-color-ink-soft)] font-[number:var(--type-weight-medium)]">
              CX / 01
            </strong>
          </span>
        </div>
      </div>
      <div className="pr-0 pl-6 border-l border-l-[var(--ds-color-line-strong)] py-2 max-[42rem]:grid max-[42rem]:grid-cols-[auto_1fr] max-[42rem]:items-center max-[42rem]:gap-y-2 max-[42rem]:gap-x-4 max-[42rem]:mt-6 max-[42rem]:pt-3 max-[42rem]:pb-0 max-[42rem]:border-t max-[42rem]:border-t-[var(--ds-color-line)] max-[42rem]:border-l-0 max-[42rem]:px-0">
        <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
          设计取向
        </span>
        <div className="grid mt-4 text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-sm)] font-[number:var(--type-weight-medium)] gap-3 max-[42rem]:flex max-[42rem]:flex-wrap max-[42rem]:gap-y-2 max-[42rem]:gap-x-3 max-[42rem]:mt-0">
          <span className="before:inline-block before:w-1.25 before:h-1.25 before:mt-0 before:mr-2 before:mb-0.5 before:ml-0 before:rounded-[var(--ds-radius-pill)] before:bg-[var(--ds-color-accent)] before:content-[''] max-[42rem]:text-[length:var(--type-size-xs)]">
            中性但不冷淡
          </span>
          <span className="before:inline-block before:w-1.25 before:h-1.25 before:mt-0 before:mr-2 before:mb-0.5 before:ml-0 before:rounded-[var(--ds-radius-pill)] before:bg-[var(--ds-color-accent)] before:content-[''] max-[42rem]:text-[length:var(--type-size-xs)]">
            克制但不单调
          </span>
          <span className="before:inline-block before:w-1.25 before:h-1.25 before:mt-0 before:mr-2 before:mb-0.5 before:ml-0 before:rounded-[var(--ds-radius-pill)] before:bg-[var(--ds-color-accent)] before:content-[''] max-[42rem]:text-[length:var(--type-size-xs)]">
            清晰胜过装饰
          </span>
        </div>
        <div
          className="flex h-2 mt-6 gap-1 max-[42rem]:col-span-full max-[42rem]:mt-1"
          aria-label="主题主色预览"
        >
          <span className="rounded-[var(--ds-radius-pill)] [flex:2] bg-[var(--ds-color-canvas)] shadow-[inset_0_0_0_1px_var(--ds-color-line)]" />
          <span className="rounded-[var(--ds-radius-pill)] flex-1 bg-[var(--ds-color-ink)]" />
          <span className="rounded-[var(--ds-radius-pill)] flex-1 bg-[var(--ds-color-accent)]" />
          <span className="rounded-[var(--ds-radius-pill)] flex-1 bg-[var(--ds-color-accent-soft)]" />
        </div>
      </div>
    </div>
  );
}
