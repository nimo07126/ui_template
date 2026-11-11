"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { componentExamples, componentGroups } from "./component-registry";
import type { ComponentGroupId } from "./example-types";
import { useShowcase } from "./showcase-context";

const catalog = componentGroups.map((group) => ({
  ...group,
  examples: componentExamples.filter((example) => example.group === group.id),
}));

export function ShowcaseNavigation() {
  const { reset } = useShowcase();
  const [expandedGroup, setExpandedGroup] = useState<ComponentGroupId | null>(null);
  const [navigation, setNavigation] = useState<{ id: string; group: ComponentGroupId } | null>(null);

  useEffect(() => {
    if (!navigation) return;
    const target = document.getElementById(navigation.id);
    if (!target) return;

    const hash = `#${navigation.id}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);

    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }, [navigation]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string, group: ComponentGroupId) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    if (!document.getElementById(id)) reset();
    setExpandedGroup((expanded) => expanded === group ? expanded : null);
    setNavigation({ id, group });
  }

  return (
    <nav
      aria-labelledby="showcase-navigation-title"
      className="min-w-0 text-sm xl:sticky xl:top-8 xl:col-start-2 xl:row-start-1 xl:flex xl:max-h-[calc(100dvh-7rem)] xl:flex-col xl:self-start xl:border-l xl:border-border/40 xl:pl-4"
    >
      <h2 id="showcase-navigation-title" className="mb-2 px-2 text-xs font-medium text-[var(--ds-color-muted)] xl:shrink-0">
        组件目录
      </h2>
      <ul className="grid list-none grid-cols-2 gap-1 min-[24rem]:grid-cols-3 lg:grid-cols-6 xl:shrink-0 xl:grid-cols-1">
        {catalog.map((group) => {
          const isExpanded = expandedGroup === group.id;
          const target = `${group.id}-heading`;

          return (
            <li
              key={group.id}
              data-active={navigation?.group === group.id || undefined}
              className="flex items-center rounded-md text-[var(--ds-color-muted)] hover:bg-muted data-active:bg-[var(--ds-color-accent-soft)] data-active:text-[var(--ds-color-accent-ink)]"
            >
              <a
                id={`showcase-navigation-group-${group.id}`}
                className="min-w-0 flex-1 rounded-md py-2 pl-2 leading-5 hover:text-foreground aria-[current=location]:font-semibold"
                href={`#${target}`}
                aria-current={navigation?.id === target ? "location" : undefined}
                onClick={(event) => navigate(event, target, group.id)}
              >
                {group.name}
              </a>
              <button
                type="button"
                className="group grid size-9 shrink-0 cursor-pointer place-items-center rounded-md hover:bg-[var(--ds-color-accent-soft)] hover:text-[var(--ds-color-accent-ink)] aria-expanded:text-[var(--ds-color-accent-ink)]"
                aria-expanded={isExpanded}
                aria-controls={`showcase-navigation-list-${group.id}`}
                aria-label={`${isExpanded ? "收起" : "展开"}${group.name}组件`}
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                <ChevronRight aria-hidden="true" className="size-3.5 group-aria-expanded:rotate-90" />
              </button>
            </li>
          );
        })}
      </ul>
      {catalog.map((group) => (
        <ul
          key={group.id}
          id={`showcase-navigation-list-${group.id}`}
          aria-labelledby={`showcase-navigation-group-${group.id}`}
          className="mt-3 min-h-0 max-h-[min(16rem,40dvh)] list-none overflow-y-auto overscroll-contain border-t border-border/40 pt-2 xl:max-h-none"
          hidden={expandedGroup !== group.id}
        >
          {expandedGroup === group.id && group.examples.map((example) => (
            <li key={example.id}>
              <a
                className="block rounded-md px-2 py-1.5 leading-normal text-[var(--ds-color-muted)] hover:bg-muted hover:text-foreground aria-[current=location]:bg-[var(--ds-color-accent-soft)] aria-[current=location]:text-[var(--ds-color-accent-ink)]"
                href={`#${example.id}`}
                aria-current={navigation?.id === example.id ? "location" : undefined}
                onClick={(event) => navigate(event, example.id, group.id)}
              >
                {example.title}
              </a>
            </li>
          ))}
        </ul>
      ))}
    </nav>
  );
}
