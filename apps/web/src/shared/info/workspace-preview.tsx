import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";
import { ProjectList } from "./project-list";

export function WorkspacePreview() {
  return (
    <div className="overflow-hidden border border-[var(--ds-color-line-strong)] rounded-[var(--ds-radius-2xl)] bg-[var(--ds-color-surface)] shadow-[var(--shadow-soft)]">
      <div className="flex h-15 items-center justify-between border-b border-b-[var(--ds-color-line)] bg-[var(--ds-color-surface)] px-5 max-[30rem]:px-3">
        <div className="flex items-center text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-2">
          <span className="[&:nth-child(2)]:text-[var(--ds-color-ink-soft)] [&:nth-child(2)]:font-[number:var(--type-weight-medium)] grid flex-none place-items-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-color-ink)] text-[var(--theme-accent-foreground)] font-[number:var(--type-weight-medium)] w-7 h-7 text-[length:var(--type-size-xs)] max-[30rem]:[&:nth-child(2)]:hidden">
            澄
          </span>
          <span className="[&:nth-child(2)]:text-[var(--ds-color-ink-soft)] [&:nth-child(2)]:font-[number:var(--type-weight-medium)] max-[30rem]:[&:nth-child(2)]:hidden">
            栖云工作室
          </span>
          <Icon
            className="w-3.25 text-[var(--ds-color-muted-soft)] max-[30rem]:hidden"
            name="chevron"
          />
          <strong className="text-[var(--ds-color-ink)] font-[number:var(--type-weight-semibold)]">
            项目空间
          </strong>
        </div>
        <div className="flex items-center gap-3">
          <Button
            aria-label="搜索"
            className="grid place-items-center w-8 h-8 p-0"
            size="icon"
            variant="ghost"
          >
            <Icon name="search" />
          </Button>
          <span className="grid flex-none place-items-center rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-accent-soft)] text-[var(--ds-color-accent-ink)] font-[number:var(--type-weight-medium)] w-8 h-8 [border:2px_solid_var(--ds-color-surface)] text-[length:var(--type-size-xs)]">
            林
          </span>
        </div>
      </div>
      <div className="grid min-h-[var(--layout-preview-min-height)] grid-cols-[11.5rem_minmax(0,_1fr)] max-[52rem]:grid-cols-[9.5rem_minmax(0,_1fr)] max-[42rem]:block">
        <aside
          className="flex flex-col pt-5 pb-3 border-r border-r-[var(--ds-color-line)] bg-[var(--ds-color-preview-rail)] px-3 max-[52rem]:px-2 max-[42rem]:hidden"
          aria-label="工作台示例导航"
        >
          <div className="pt-0 pb-2 text-[var(--ds-color-muted-soft)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] px-2">
            工作空间
          </div>
          <span
            aria-current="page"
            className="flex min-h-9 items-center rounded-[var(--ds-radius-sm)] text-[var(--ds-color-accent-ink)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] bg-[var(--ds-color-preview-selected)] py-0 px-2 gap-2"
          >
            <Icon
              className="text-[var(--ds-color-accent)] w-3.75 h-3.75"
              name="overview"
            />
            总览
          </span>
          <span className="flex min-h-9 items-center rounded-[var(--ds-radius-sm)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] py-0 px-2 gap-2">
            <Icon className="w-3.75 h-3.75" name="components" />
            项目
          </span>
          <span className="flex min-h-9 items-center rounded-[var(--ds-radius-sm)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] py-0 px-2 gap-2">
            <Icon className="w-3.75 h-3.75" name="shape" />
            日程
          </span>
          <div className="h-px bg-[var(--ds-color-line)] my-4 mx-2" />
          <div className="pt-0 pb-2 text-[var(--ds-color-muted-soft)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] px-2">
            协作
          </div>
          <span className="flex min-h-9 items-center rounded-[var(--ds-radius-sm)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] py-0 px-2 gap-2">
            <span className="grid w-3.75 h-3.75 place-items-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-color-surface-muted)] text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
              人
            </span>
            团队成员
          </span>
          <div className="flex items-center mt-auto pt-3 pb-0 border-t border-t-[var(--ds-color-line)] text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] px-1 gap-2">
            <span className="grid flex-none place-items-center rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-accent-soft)] text-[var(--ds-color-accent-ink)] font-[number:var(--type-weight-medium)] w-7 h-7 text-[length:var(--type-size-xs)]">
              林
            </span>
            <span>
              林知遥
              <small className="block mt-0.5 text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-regular)]">
                设计负责人
              </small>
            </span>
            <Icon
              className="w-4 ml-auto text-[var(--ds-color-muted)]"
              name="more"
            />
          </div>
        </aside>
        <div className="min-w-0 bg-[var(--ds-color-preview-canvas)] py-6 px-[clamp(var(--space-4),_3vw,_var(--space-8))] max-[42rem]:p-4">
          <div className="flex items-center justify-between gap-4 max-[30rem]:items-start">
            <div>
              <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
                星期三 · 10 月 21 日
              </span>
              <h3 className="mt-1 mb-0 text-[length:var(--type-size-xl)] font-[number:var(--type-weight-semibold)] tracking-[var(--type-tracking-tight)] leading-[var(--type-line-heading)] mx-0 max-[42rem]:text-[length:var(--type-size-lg)]">
                下午好，知遥
              </h3>
              <p className="mt-1 mb-0 text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] mx-0">
                今天有 3 个项目正在稳步推进。
              </p>
            </div>
            <Button
              className="flex-none max-[30rem]:min-h-8.5 max-[30rem]:text-[length:var(--type-size-xs)] max-[30rem]:px-2"
              size="lg"
            >
              <Icon className="size-3.75" name="plus" />
              新建项目
            </Button>
          </div>
          <div className="flex items-center mt-5 border border-[var(--ds-color-accent-soft)] rounded-[var(--ds-radius-md)] bg-[var(--ds-color-accent-soft)] py-3 px-4 gap-3 max-[42rem]:py-2 max-[42rem]:px-3 max-[42rem]:gap-2">
            <div className="grid w-8 h-8 flex-none place-items-center rounded-[var(--ds-radius-sm)] bg-[var(--ds-color-surface)] text-[var(--ds-color-accent)] max-[42rem]:w-7 max-[42rem]:h-7">
              <Icon className="w-4 h-4" name="spark" />
            </div>
            <div className="grid min-w-0 gap-0.5">
              <strong className="text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-semibold)]">
                本周进展顺利
              </strong>
              <span className="overflow-hidden text-[var(--ds-color-accent-ink)] text-[length:var(--type-size-xs)] text-ellipsis whitespace-nowrap">
                已完成 12 项任务，距离本周目标还差 3 项。
              </span>
            </div>
            <div className="flex w-12 h-1 flex-none overflow-hidden ml-auto rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-surface)] max-[42rem]:hidden">
              <span className="first:w-[80%] first:bg-[var(--ds-color-accent)]" />
              <span className="first:w-[80%] first:bg-[var(--ds-color-accent)]" />
            </div>
            <span className="text-[var(--ds-color-accent-ink)] text-[length:var(--type-size-xs)] tabular-nums font-[number:var(--type-weight-semibold)] max-[42rem]:hidden">
              12 / 15
            </span>
          </div>
          <div className="flex items-center justify-between mt-6 mb-2 gap-3">
            <div className="flex items-baseline gap-2 max-[30rem]:grid max-[30rem]:gap-0">
              <h4 className="text-[length:var(--type-size-sm)] font-[number:var(--type-weight-semibold)] m-0">
                正在推进
              </h4>
              <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] max-[30rem]:text-[length:var(--type-size-xs)]">
                按最近更新排序
              </span>
            </div>
            <Button className="px-1" size="sm" variant="link">
              查看全部 <Icon className="size-3.5 w-3" name="chevron" />
            </Button>
          </div>
          <ProjectList />
          <div className="flex items-center pt-3 text-[var(--ds-color-success)] text-[length:var(--type-size-xs)] gap-2">
            <span className="w-1.5 h-1.5 flex-none rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-success)] last:ml-auto last:text-[var(--ds-color-muted)]" />
            所有项目已同步{" "}
            <span className="last:ml-auto last:text-[var(--ds-color-muted)]">
              刚刚更新
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
