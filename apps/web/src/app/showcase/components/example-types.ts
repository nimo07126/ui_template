import type { ComponentType } from "react";

export type ComponentGroupId =
  | "actions"
  | "forms"
  | "navigation"
  | "data"
  | "feedback"
  | "overlays";

export type DemoLoader = () => Promise<{ default: ComponentType }>;

export type ComponentExample = {
  id: string;
  slug?: string;
  name: string;
  title: string;
  description: string;
  group: ComponentGroupId;
  source: "arc" | "shadcn";
  docs: string;
  importStatement: string;
  loadDemo: DemoLoader;
};
