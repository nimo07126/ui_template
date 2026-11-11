import type { ReactNode } from "react";
import type { WorkflowAppId } from "./ai-workflow-marks";

export type { WorkflowAppId } from "./ai-workflow-marks";

/** A built-in app id, or any other app with its own name and mark. */
export type WorkflowApp = WorkflowAppId | { name: string; mark: ReactNode };

export type WorkflowStepKind = "trigger" | "ai" | "action" | "branch";

/** What a step produced, rendered as a compact preview under the step once it has run. */
export type WorkflowOutput =
  | { type: "email"; from: string; address?: string; subject: string; preview: string }
  | { type: "label"; label: string; confidence?: number; reason?: string }
  | { type: "route"; pathId: string; note?: string }
  | { type: "message"; channel: string; author: string; text: string }
  | { type: "record"; id: string; title: string; meta?: string }
  | { type: "text"; text: string };

export interface WorkflowPath {
  id: string;
  label: string;
  steps: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  kind: WorkflowStepKind;
  app: WorkflowApp;
  title: string;
  /** One quiet line under the title: the account, channel or rule. */
  detail?: string;
  /** Replaces the detail line, shimmering, while the step runs. */
  activity?: string;
  /** Sample output the simulated run returns. With `onRunStep`, the output comes from your function instead. */
  output?: WorkflowOutput;
  /** Simulated duration in ms. */
  durationMs?: number;
  /** The simulated run fails here once with this message; Retry then succeeds. */
  error?: string;
  /** Branch steps only. The branch must be the last top-level step; its paths hold the rest of the flow. */
  paths?: WorkflowPath[];
}

/** An entry in the add step menu. Triggers show only while the flow is empty. */
export type WorkflowCatalogItem = Omit<WorkflowStep, "id" | "paths">;

export const workflowSampleSteps: WorkflowStep[] = [
  {
    id: "new-email",
    kind: "trigger",
    app: "gmail",
    title: "New email in Gmail",
    detail: "support@northwind.dev",
    activity: "Fetching the latest email",
    durationMs: 420,
    output: {
      type: "email",
      from: "Maya Chen",
      address: "maya.chen@ledgerline.io",
      subject: "SSO sign-in broken for our whole team since this morning",
      preview: "Since the 2.14 update none of our 42 seats can sign in through Okta. We demo to our board on Thursday, can someone look today?",
    },
  },
  {
    id: "classify",
    kind: "ai",
    app: "claude",
    title: "Classify with Claude Sonnet 5.5",
    detail: "Urgent, billing, question or feedback",
    activity: "Reading the email",
    durationMs: 1050,
    output: {
      type: "label",
      label: "Urgent",
      confidence: 0.96,
      reason: "Full team lockout after the 2.14 release, 42 seats affected and a board demo on Thursday. Route to on-call now.",
    },
  },
  {
    id: "route",
    kind: "branch",
    app: "branch",
    title: "Route by label",
    detail: "If label is Urgent",
    activity: "Checking the rule",
    durationMs: 260,
    output: { type: "route", pathId: "urgent", note: "Label is Urgent, so the email took the Urgent path." },
    paths: [
      {
        id: "urgent",
        label: "Urgent",
        steps: [
          {
            id: "slack",
            kind: "action",
            app: "slack",
            title: "Post to #support in Slack",
            detail: "As Triage bot, mentions @oncall",
            activity: "Posting the message",
            durationMs: 620,
            output: {
              type: "message",
              channel: "#support",
              author: "Triage bot",
              text: "Urgent from Ledgerline: SSO sign-in fails for all 42 seats since 2.14. Maya Chen is waiting on a reply. @oncall",
            },
          },
          {
            id: "linear",
            kind: "action",
            app: "linear",
            title: "Create Linear issue",
            detail: "Support team, priority Urgent",
            activity: "Creating the issue",
            durationMs: 700,
            output: { type: "record", id: "SUP-482", title: "SSO sign-in fails for Ledgerline after 2.14", meta: "Urgent · Assigned to Priya Raman" },
          },
        ],
      },
      {
        id: "other",
        label: "Everything else",
        steps: [
          {
            id: "notion",
            kind: "action",
            app: "notion",
            title: "Add to Support backlog in Notion",
            detail: "Database: Inbound, status Triage",
            activity: "Adding the page",
            durationMs: 560,
            output: { type: "record", id: "Inbound", title: "SSO sign-in broken for our whole team", meta: "Status Triage · Owner unassigned" },
          },
        ],
      },
    ],
  },
];

/** The same flow, set up so the Linear step fails once. Retry succeeds. */
export const workflowFailingSteps: WorkflowStep[] = workflowSampleSteps.map(step => step.kind !== "branch" ? step : {
  ...step,
  paths: step.paths?.map(path => ({
    ...path,
    steps: path.steps.map(child => child.id === "linear" ? { ...child, error: "Linear rejected the request: the Support team needs a project for Urgent issues." } : child),
  })),
});

export const workflowSampleCatalog: WorkflowCatalogItem[] = [
  { kind: "trigger", app: "gmail", title: "New email in Gmail", detail: "support@northwind.dev", activity: "Fetching the latest email", durationMs: 420, output: workflowSampleSteps[0].output },
  { kind: "trigger", app: "zendesk", title: "New ticket in Zendesk", detail: "Group: Tier 1", activity: "Fetching the latest ticket", durationMs: 460, output: { type: "record", id: "#90412", title: "Export to CSV times out on large workspaces", meta: "Opened by Tomás Silva · Normal" } },
  { kind: "trigger", app: "stripe", title: "Failed payment in Stripe", detail: "Live mode, all products", activity: "Fetching the latest event", durationMs: 400, output: { type: "record", id: "in_1QZ8", title: "Ledgerline · $1,260.00 declined", meta: "Card expired · Retry scheduled Oct 29" } },
  { kind: "trigger", app: "github", title: "New issue in GitHub", detail: "northwind/app", activity: "Fetching the latest issue", durationMs: 440, output: { type: "record", id: "#2291", title: "Okta callback returns 500 after 2.14", meta: "Opened by jkowalski · bug" } },
  { kind: "ai", app: "claude", title: "Draft reply with Claude Sonnet 5.5", detail: "Tone: calm, specific, no promises", activity: "Writing the draft", durationMs: 980, output: { type: "text", text: "Hi Maya, thanks for the detail. We reproduced the Okta sign-in failure from 2.14 and a fix is rolling out now. I will confirm here the moment your team can sign in again." } },
  { kind: "action", app: "slack", title: "Message the account owner in Slack", detail: "Direct message to the owner", activity: "Sending the message", durationMs: 560, output: { type: "message", channel: "Direct message", author: "Triage bot", text: "Heads up: Ledgerline reported an SSO lockout. On-call is on it, issue SUP-482." } },
  { kind: "action", app: "linear", title: "Create Linear issue", detail: "Support team, priority High", activity: "Creating the issue", durationMs: 680, output: { type: "record", id: "SUP-483", title: "Follow up with Ledgerline after the SSO fix", meta: "High · Unassigned" } },
  { kind: "action", app: "hubspot", title: "Update company in HubSpot", detail: "Property: health score", activity: "Updating the record", durationMs: 600, output: { type: "record", id: "Ledgerline", title: "Health score set to At risk", meta: "Renewal Dec 14 · Owner Jonah Park" } },
  { kind: "action", app: "sheets", title: "Append row to Support log", detail: "Sheet: Q4 inbound", activity: "Appending the row", durationMs: 520, output: { type: "record", id: "Row 1,284", title: "Ledgerline · Urgent · SSO", meta: "Added to Q4 inbound" } },
  { kind: "action", app: "notion", title: "Add page to Incidents in Notion", detail: "Database: Incidents", activity: "Adding the page", durationMs: 560, output: { type: "record", id: "INC-61", title: "SSO sign-in failures after 2.14", meta: "Severity 2 · Investigating" } },
];
