import { Button } from "@/shared/ui/button";
import { Icon } from "@/shared/ui/icon";

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

export function ProjectList() {
  return (
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
  );
}
