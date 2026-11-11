import type { ReactNode } from "react";

export type AiCommandMode = "search" | "ask";

/** One searchable row: a page to open or an action to run. */
export interface AiCommandItem {
  id: string;
  label: string;
  /** Group heading the row sits under. Rows keep the order of the array within each group. */
  group?: string;
  /** A 16px icon or brand mark. */
  icon?: ReactNode;
  /** Quiet text after the label, such as a section or repository. */
  meta?: string;
  /** Keys for the shortcut hint, in Kbd format: "mod+shift+L", or ["G", "I"] for a sequence. */
  shortcut?: string | readonly string[];
  /** Extra words that match this row in search. */
  keywords?: readonly string[];
  /** Shown while the query is empty. Defaults to true when no row sets it. */
  suggested?: boolean;
  /** Runs when the row is chosen, after the palette's own onSelect. */
  onSelect?: () => void;
}

/** A document the answer was grounded in. Numbered in order, cited in the text as [1], [2]. */
export interface AiCommandSource {
  id: string;
  /** Short title on the chip, such as "ENG-2477". */
  title: string;
  /** Longer description, shown as the chip's tooltip and read to screen readers. */
  description?: string;
  /** A 14px brand mark or icon. */
  mark?: ReactNode;
  href?: string;
}

/** A next step the answer suggests, run in place from the palette. */
export interface AiCommandAction {
  id: string;
  label: string;
  meta?: string;
  /** A 16px brand mark or icon. */
  mark?: ReactNode;
  /** Label while running, such as "Creating issue". */
  runningLabel?: string;
  /** Label once done when run returns nothing, such as "Issue created". */
  doneLabel?: string;
  /** Quiet text once done, such as "Simulated, nothing was sent". */
  doneMeta?: string;
  /** Label when run throws, such as "Couldn't create the issue". */
  errorLabel?: string;
  /** Does the work. Resolve with a done label ("Created ENG-2481") or nothing; throw to show the error state. */
  run?: (signal: AbortSignal) => Promise<string | void> | string | void;
}

export interface AiCommandAnswer {
  /** The full answer. Optional when every word arrived through append. Cite sources with [1], [2]. */
  text?: string;
  sources?: readonly AiCommandSource[];
  actions?: readonly AiCommandAction[];
}

export interface AiCommandAskHelpers {
  /** Aborts when the person asks something else, goes back to search or the palette unmounts. */
  signal: AbortSignal;
  /** Streams a piece of the answer. The palette reveals it in short chunks at reading pace. */
  append: (delta: string) => void;
  /** Shows sources before the text arrives, the way search-grounded answers do. */
  setSources: (sources: readonly AiCommandSource[]) => void;
}

/** Answers a question. Stream with append, or resolve with the full text; throw to show the error state. */
export type AiCommandAsk = (question: string, helpers: AiCommandAskHelpers) => Promise<AiCommandAnswer | void>;
