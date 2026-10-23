import type { ComponentType } from "react";

export type ComponentGroupId =
  | "actions"
  | "forms"
  | "navigation"
  | "data"
  | "feedback"
  | "overlays";

export type ComponentExample = {
  id: string;
  name: string;
  title: string;
  description: string;
  group: ComponentGroupId;
  imports: string;
  demo: ComponentType;
};
