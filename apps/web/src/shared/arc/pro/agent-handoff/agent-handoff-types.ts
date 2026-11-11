import type { ReactNode } from "react";

/**
 * Where the conversation is.
 * - `assistant`: the AI assistant is answering.
 * - `transferring`: the summary is with the team and the customer waits for a person.
 * - `connected`: a person joined and owns the conversation.
 * - `resolved`: the person closed the conversation.
 * - `unavailable`: nobody picked the transfer up. Pair with `onRetry`.
 */
export type HandoffStage = "assistant" | "transferring" | "connected" | "resolved" | "unavailable";

export type HandoffSender = "customer" | "assistant" | "agent";

export interface HandoffMessage {
  id: string;
  from: HandoffSender;
  text: string;
  /** Display time, such as "14:02". The first message's time shows on the assistant step. */
  time?: string;
  /** True while the text is still arriving. Each new chunk fades in. */
  streaming?: boolean;
}

export interface HandoffAssistant {
  /** Shown on the first step. Defaults to "Assistant". */
  name?: string;
  /** The model behind it, shown as meta, such as "Claude Sonnet 5.5". */
  model?: string;
  /** A 14px mark for the timeline. Defaults to the Claude mark. */
  mark?: ReactNode;
}

export interface HandoffAgent {
  name: string;
  /** Shown under the join step, such as "Support specialist". */
  role?: string;
  /** Avatar photo URL. Initials show when it is missing or fails. */
  avatar?: string;
  /** Display time of the join, such as "14:05". */
  joinedAt?: string;
}

export interface HandoffSummaryField {
  label: string;
  value: string;
}

/** What the assistant passes to the person, shown to the customer so they know they won't have to repeat it. */
export interface HandoffSummary {
  /** One or two sentences: what happened and what the customer wants. */
  issue: string;
  /** Short facts, such as the order number or payment method. Three or four read best. */
  fields?: HandoffSummaryField[];
}

/** The help desk the conversation moves to. Pass `{ name, mark }` for another one. */
export type HandoffProvider = "intercom" | "zendesk" | { name: string; mark: ReactNode };

/** Who is typing. The assistant shows a short thinking line, a person shows typing dots. */
export type HandoffTyping = "assistant" | "agent" | null;
