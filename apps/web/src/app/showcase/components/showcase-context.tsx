"use client";

import { useThemeEditor } from "@/shared/providers/theme-provider";
import { Toaster } from "@/shared/ui/toast";
import { createContext, useContext, useState, type ReactNode } from "react";
import { componentExamples, componentGroups } from "./component-registry";
import type { ComponentExample as Example } from "./example-types";

function useShowcaseState() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const { activeId, selectTheme } = useThemeEditor();
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchesQuery = (example: Example) =>
    `${example.title} ${example.name} ${example.id} ${example.description} ${componentGroups.find((group) => group.id === example.group)?.name}`
      .toLocaleLowerCase()
      .includes(normalizedQuery);
  const visible = componentExamples.filter(
    (example) =>
      (category === "all" || example.group === category) &&
      matchesQuery(example),
  );
  const groups = componentGroups
    .map((group) => ({
      ...group,
      examples: visible.filter((example) => example.group === group.id),
    }))
    .filter((group) => group.examples.length);
  const reset = () => {
    setQuery("");
    setCategory("all");
  };
  return {
    query,
    setQuery,
    category,
    setCategory,
    activeId,
    selectTheme,
    normalizedQuery,
    matchesQuery,
    visible,
    groups,
    reset,
  };
}

const Context = createContext<ReturnType<typeof useShowcaseState> | null>(null);

export function ShowcaseProvider({ children }: { children: ReactNode }) {
  const value = useShowcaseState();
  return (
    <Context.Provider value={value}>
      <Toaster>{children}</Toaster>
    </Context.Provider>
  );
}

export function useShowcase() {
  const value = useContext(Context);
  if (!value) throw new Error("ShowcaseProvider is required");
  return value;
}
