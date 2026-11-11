import type { ReactNode } from "react";
import { MessageSquareText } from "lucide-react";
import { ClaudeMark, GithubMark, LinearMark, PostgresqlMark, SlackColorMark } from "./agent-loop-marks";

export interface AgentLoopContextBlock {
  /** Short name of what was read into context, such as "Issue #312". */
  label: string;
  /** One line about it, shown under the label. */
  detail?: string;
  /** Tokens it adds. Summed in the context header. */
  tokens: number;
  /** A mark or icon for the source. Defaults to a document icon. */
  mark?: ReactNode;
}

export interface AgentLoopToolCall {
  /** Tool or service name, such as "GitHub". */
  tool: string;
  /** The tool's mark. Brand marks are sample content. */
  mark?: ReactNode;
  /** What the call does, such as "Read issue #312". */
  action: string;
  /** The short result it comes back with. */
  result: string;
  /** "error" shows a failed call with its message in result. Defaults to "success". */
  status?: "success" | "error";
}

export interface AgentLoopCheck {
  /** True when the check passes. A failed check reads as a retry note and the loop goes round again. */
  passed: boolean;
  /** One short line, such as "No root cause yet". */
  note: string;
}

export interface AgentLoopIteration {
  /** The block this loop adds to the context at Gather context. */
  gather: AgentLoopContextBlock;
  /** One to three tool calls made at Take action, shown one after another. */
  calls: AgentLoopToolCall[];
  /** The result of Verify. */
  verify: AgentLoopCheck;
}

export interface AgentLoopModel {
  name: string;
  mark?: ReactNode;
}

const markStyle = (color?: string) => (color ? { color } : undefined);

export const DEFAULT_MODEL: AgentLoopModel = {
  name: "Claude Opus 5.5",
  mark: <ClaudeMark aria-hidden style={markStyle("#D97757")} />,
};

export const DEFAULT_TASK = "Find out why EU cards are declined at checkout, then update the team.";

export const DEFAULT_SUMMARY = "EU declines come from 3DS checks timing out after 5 seconds. PAY-118 is in progress and the plan is posted in #payments.";

/** Sample run: names, numbers and results are illustrative. */
export const DEFAULT_ITERATIONS: AgentLoopIteration[] = [
  {
    gather: { label: "Task from Maya", detail: "EU card declines at checkout", tokens: 1200, mark: <MessageSquareText aria-hidden strokeWidth={1.75} /> },
    calls: [{ tool: "GitHub", mark: <GithubMark aria-hidden />, action: "Read issue #312", result: "EU cards, since Oct 18" }],
    verify: { passed: false, note: "No root cause yet" },
  },
  {
    gather: { label: "Issue #312", detail: "14 comments, opened Oct 18", tokens: 6400, mark: <GithubMark aria-hidden /> },
    calls: [
      { tool: "PostgreSQL", mark: <PostgresqlMark aria-hidden style={markStyle("#4169E1")} />, action: "Run query", result: "Timed out after 30s", status: "error" },
      { tool: "PostgreSQL", mark: <PostgresqlMark aria-hidden style={markStyle("#4169E1")} />, action: "Narrow to 72 hours", result: "1,284 declines, all 3DS" },
    ],
    verify: { passed: true, note: "3DS times out at 5s" },
  },
  {
    gather: { label: "Query result", detail: "1,284 declined orders", tokens: 9800, mark: <PostgresqlMark aria-hidden style={markStyle("#4169E1")} /> },
    calls: [
      { tool: "Linear", mark: <LinearMark aria-hidden style={markStyle("#5E6AD2")} />, action: "Update status", result: "PAY-118 now in progress" },
      { tool: "Slack", mark: <SlackColorMark aria-hidden />, action: "Post update", result: "Posted in #payments" },
    ],
    verify: { passed: true, note: "Ticket and team updated" },
  },
];
