import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/theme-showcase/icon";

const projects = [
  {
    name: "澄光品牌焕新",
    category: "品牌设计",
    progress: "78%",
    progressClassName: "w-[78%]",
    className: "bg-[var(--ds-color-accent)]",
    due: "10 月 28 日",
  },
  {
    name: "春日会员计划",
    category: "产品体验",
    progress: "52%",
    progressClassName: "w-[52%]",
    className: "bg-[var(--ds-color-muted)]",
    due: "11 月 04 日",
  },
  {
    name: "客户旅程梳理",
    category: "研究与策略",
    progress: "34%",
    progressClassName: "w-[34%]",
    className: "bg-[var(--ds-color-success)]",
    due: "11 月 12 日",
  },
];

export function ThemeOverview() {
  return (
    <section aria-labelledby="overview-title" className="mb-24" id="overview">
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
              <div className="border-t border-t-[var(--ds-color-line)]">
                {projects.map((project) => (
                  <div
                    className="grid min-h-15 grid-cols-[0.5rem_minmax(8rem,_1fr)_minmax(6rem,_0.7fr)_auto_1.25rem] items-center border-b border-b-[var(--ds-color-line)] gap-3 max-[68rem]:grid-cols-[0.5rem_minmax(7rem,_1fr)_minmax(5rem,_0.65fr)_auto_1.25rem] max-[68rem]:gap-2 max-[52rem]:grid-cols-[0.5rem_minmax(7rem,_1fr)_minmax(5rem,_0.65fr)_1.25rem] max-[42rem]:grid-cols-[0.375rem_minmax(0,_1fr)_minmax(4rem,_0.5fr)_1rem] max-[42rem]:gap-2 max-[30rem]:grid-cols-[0.375rem_minmax(0,_1fr)_1rem]"
                    key={project.name}
                  >
                    <span
                      className={`w-2 h-7 rounded-[var(--ds-radius-pill)] ${project.className}`}
                    />
                    <div className="grid min-w-0 gap-0.5">
                      <strong className="overflow-hidden text-[var(--ds-color-ink-soft)] text-[length:var(--type-size-xs)] font-[number:var(--type-weight-medium)] text-ellipsis whitespace-nowrap">
                        {project.name}
                      </strong>
                      <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)]">
                        {project.category}
                      </span>
                    </div>
                    <div className="flex items-center text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] tabular-nums gap-2 max-[42rem]:gap-1 max-[30rem]:hidden">
                      <div className="h-1.25 flex-1 overflow-hidden rounded-[var(--ds-radius-pill)] bg-[var(--ds-color-surface-muted)]">
                        <span
                          className={`block h-full rounded-[inherit] bg-[var(--ds-color-accent)] ${project.progressClassName}`}
                        />
                      </div>
                      <span className="max-[42rem]:text-[length:var(--type-size-xs)]">
                        {project.progress}
                      </span>
                    </div>
                    <span className="text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] whitespace-nowrap max-[52rem]:hidden">
                      截止 {project.due}
                    </span>
                    <Button
                      aria-label={`更多：${project.name}`}
                      className="grid place-items-center w-6 h-6 rounded-[var(--ds-radius-sm)] p-0 max-[42rem]:w-4"
                      size="icon-sm"
                      variant="ghost"
                    >
                      <Icon className="w-4" name="more" />
                    </Button>
                  </div>
                ))}
              </div>

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
        <div className="flex justify-between mt-3 text-[var(--ds-color-muted)] text-[length:var(--type-size-xs)] gap-3 max-[30rem]:text-[length:var(--type-size-xs)]">
          <span>主题应用示例</span>
          <span>颜色 · 字体 · 间距 · 状态</span>
        </div>
      </div>
    </section>
  );
}
