import type { ComponentType } from "react";

export type MotionParameter = {
  id: string;
  label: string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  type?: "range" | "select" | "toggle";
  options?: { label: string; value: string }[];
  defaultValue: number | string | boolean;
};

export type MotionDemoProps = {
  isPlaying: boolean;
  isPaused: boolean;
  params: Record<string, number | string | boolean>;
};

export type MotionDemoComponent = ComponentType<MotionDemoProps>;
