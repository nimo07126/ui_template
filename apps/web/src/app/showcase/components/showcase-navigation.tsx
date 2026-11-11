"use client";

import { ChevronRight } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { componentExamples, componentGroups } from "./component-registry";
import { useShowcase } from "./showcase-context";

const catalog = componentGroups.map((group) => ({
  ...group,
  examples: componentExamples.filter((example) => example.group === group.id),
}));

const linkClassName = "block rounded-md px-2 py-1.5 leading-normal text-[var(--ds-color-muted)] hover:bg-[var(--ds-color-accent-soft)] hover:text-[var(--ds-color-accent-ink)] aria-[current=location]:bg-[var(--ds-color-accent-soft)] aria-[current=location]:text-[var(--ds-color-accent-ink)]";

export function ShowcaseNavigation() {
  const { reset } = useShowcase();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [navigation, setNavigation] = useState<{ id: string } | null>(null);

  useEffect(() => {
    if (!navigation) return;
    const target = document.getElementById(navigation.id);
    if (!target) return;

    const hash = `#${navigation.id}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);

    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", behavior: "instant" });
  }, [navigation]);

  function navigate(event: MouseEvent<HTMLAnchorElement>, id: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();

    if (!document.getElementById(id)) reset();
    setNavigation({ id });
  }

  return (
    <nav
      aria-labelledby="showcase-navigation-title"
      className="min-w-0 text-sm xl:sticky xl:top-8 xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:flex xl:max-h-[calc(100dvh-7rem)] xl:flex-col xl:border-l xl:border-[var(--ds-color-line)] xl:pl-3"
    >
      <h2 id="showcase-navigation-title" className="m-0 mb-2 px-2 text-xs font-medium text-[var(--ds-color-muted)] xl:shrink-0">
        组件目录
      </h2>
      <ul className="m-0 grid list-none grid-cols-2 gap-1 p-0 min-[24rem]:grid-cols-3 lg:grid-cols-6 xl:shrink-0 xl:grid-cols-1">
        {catalog.map((group) => {
          const isExpanded = expandedGroup === group.id;

          return (
            <li key={group.id}>
              <button
                type="button"
                id={`showcase-navigation-toggle-${group.id}`}
                className="group flex min-h-9 w-full items-center justify-between gap-1 rounded-md px-2 text-start font-medium hover:bg-[var(--ds-color-accent-soft)] aria-expanded:bg-[var(--ds-color-accent-soft)] aria-expanded:text-[var(--ds-color-accent-ink)]"
                aria-expanded={isExpanded}
                aria-controls={`showcase-navigation-list-${group.id}`}
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                {group.name}
                <ChevronRight aria-hidden="true" className="size-3.5 shrink-0 text-[var(--ds-color-muted)] group-aria-expanded:rotate-90" />
              </button>
            </li>
          );
        })}
      </ul>
      {catalog.map((group) => {
        const groupTarget = `${group.id}-heading`;

        return (
          <ul
            key={group.id}
            id={`showcase-navigation-list-${group.id}`}
            aria-labelledby={`showcase-navigation-toggle-${group.id}`}
            className="m-0 mt-3 min-h-0 max-h-[min(18rem,42dvh)] list-none overflow-y-auto overscroll-contain border-t border-[var(--ds-color-line)] p-1 pt-2 xl:max-h-96"
            hidden={expandedGroup !== group.id}
          >
            <li>
              <a
                className={linkClassName}
                href={`#${groupTarget}`}
                aria-current={navigation?.id === groupTarget ? "location" : undefined}
                onClick={(event) => navigate(event, groupTarget)}
              >
                定位到本组
              </a>
            </li>
            {group.examples.map((example) => (
              <li key={example.id}>
                <a
                  className={linkClassName}
                  href={`#${example.id}`}
                  aria-current={navigation?.id === example.id ? "location" : undefined}
                  onClick={(event) => navigate(event, example.id)}
                >
                  <span className="block text-foreground">{example.title}</span>
                  <span className="block break-words text-xs">{example.name}</span>
                </a>
              </li>
            ))}
          </ul>
        );
      })}
    </nav>
  );
}
