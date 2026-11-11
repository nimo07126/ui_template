"use client";

import { GhostTextField } from "./ghost-text-field";
import type { GhostTextProps } from "./ghost-text-field";
import { SimulatedGhostText } from "./ghost-text-sim";

export type {
  GhostTextAcceptMode,
  GhostTextHandle,
  GhostTextModel,
  GhostTextProps,
  GhostTextState,
  GhostTextStatus,
  GhostTextSuggest,
  GhostTextSuggestion,
} from "./ghost-text-field";
export { createDemoSuggest, ghostTextDemoModel } from "./ghost-text-sim";
export { ClaudeMark, GithubMark } from "./ghost-text-marks";

/**
 * Inline AI autocomplete for a textarea or a single-line input. When the person pauses, muted ghost text continues their
 * sentence from suggest(text, signal). Tab accepts it, Cmd+Right (Ctrl+Right) accepts one word, Escape dismisses it, and
 * a small chip with the model's mark says what will happen. Works controlled (value, onValueChange) or uncontrolled
 * (defaultValue). With no props it plays a simulated pull request description you can take over.
 */
export function GhostText(props: GhostTextProps) {
  const demo = props.suggest === undefined && props.value === undefined && props.defaultValue === undefined;
  if (demo) return <SimulatedGhostText {...props} />;
  return <GhostTextField {...props} />;
}

export default GhostText;
