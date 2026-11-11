import type { ComponentType } from "react";

export type ComponentGroupId =
  | "actions"
  | "forms"
  | "navigation"
  | "data"
  | "feedback"
  | "overlays";

export type DemoLoader = () => Promise<{ default: ComponentType }>;
export type DemoSize = "compact" | "wide" | "full";

export type ComponentExample = {
  id: string;
  slug?: string;
  name: string;
  title: string;
  description: string;
  group: ComponentGroupId;
  source: "arc" | "shadcn";
  tier?: "pro";
  size?: DemoSize;
  docs: string;
  importStatement: string;
  loadDemo: DemoLoader;
};
