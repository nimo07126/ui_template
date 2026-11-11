import type { CSSProperties, ReactNode } from "react";

/** Where the suggestion is. thinking and streaming show progress, ready shows the review, error shows a retry. */
export type CodeSuggestionStatus = "thinking" | "streaming" | "ready" | "error";

export type CodeSuggestionDecision = "pending" | "accepted" | "rejected";

/** One change: replaces `remove` lines starting at the zero based line `start` of `code` with `insert`. */
export interface CodeSuggestionHunk {
  /** Stable id, used for decisions and callbacks. */
  id: string;
  /** Zero based line in the original code where the change starts. A value of code.length appends at the end. */
  start: number;
  /** How many original lines the change replaces. 0 inserts before `start`. Defaults to 0. */
  remove?: number;
  /** The new lines. An empty array deletes the removed lines. While streaming, grow this array and new lines fade in. */
  insert?: string[];
  /** A few words on what the change does, shown beside its Accept and Reject. */
  summary?: string;
}

export interface CodeSuggestionModel {
  name: string;
  /** A mark, for example <ClaudeMark aria-hidden />. Mono marks take the header color; set style={{ color }} for a brand color. */
  mark?: ReactNode;
}

export interface CodeSuggestionResult {
  /** The code with accepted changes applied and rejected ones left out. */
  code: string;
  accepted: string[];
  rejected: string[];
}

export interface CodeSuggestionProps {
  /** The original file contents. Defaults to the sample file when `hunks` is not set. */
  code?: string;
  /** The proposed changes. Leave unset to play the built-in simulated suggestion. */
  hunks?: CodeSuggestionHunk[];
  /** Controlled status when you pass `hunks`. Defaults to "ready". */
  status?: CodeSuggestionStatus;
  /** What the person asked for, shown in the header. */
  instruction?: string;
  /** The model that wrote the suggestion. Pass null to hide the model line. */
  model?: CodeSuggestionModel | null;
  /** File name in the tab. */
  fileName?: string;
  /** Folder shown after the file name on wider cards. */
  filePath?: string;
  /** Mark in the tab. Defaults to the TypeScript mark; pass null for none. */
  fileMark?: ReactNode | null;
  /** Message for the error status. */
  error?: string;
  /** Simulated suggestion only: reviews itself (accepting and rejecting changes) and replays while nobody touches it. */
  autoPlay?: boolean;
  /** Cmd or Ctrl + Enter accepts all and Cmd or Ctrl + Backspace rejects all while focus is inside the card. */
  shortcuts?: boolean;
  /** Caps the code area height in pixels; longer files scroll inside it. */
  maxCodeHeight?: number;
  /** Called for each change accepted or rejected, with the code as it now stands. */
  onDecision?: (hunk: CodeSuggestionHunk, decision: Exclude<CodeSuggestionDecision, "pending">, code: string) => void;
  /** Called once every change has a decision. */
  onResolve?: (result: CodeSuggestionResult) => void;
  /** Shows Stop while thinking or streaming. The simulated suggestion stops on its own and keeps the finished changes. */
  onStop?: () => void;
  /** Shows Regenerate when done and Retry on error. The simulated suggestion replays on its own. */
  onRegenerate?: () => void;
  className?: string;
  style?: CSSProperties;
}
