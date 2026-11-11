import type { AgentTimelineRun } from "./agent-timeline-model";

/**
 * Sample run: an orchestrator splits an incident investigation across three subagents, merges their findings, hands the write-up
 * to a fourth, then reviews and publishes it. Rows are ordered so every connector runs through idle rows. Times, tokens, PR numbers
 * and figures are a simulation; prices are blended sample rates (about three input tokens to one output token).
 */
export const sampleRun: AgentTimelineRun = {
  title: "Checkout conversion drop on Oct 14",
  agents: [
    { id: "lead", name: "Orchestrator", model: "Claude Opus 5.5", role: "Plans the run, delegates and merges results", price: 8 },
    { id: "checker", name: "Checker", model: "GPT-6 Luna", role: "Rules out causes outside the codebase", price: .8 },
    { id: "researcher", name: "Researcher", model: "Claude Sonnet 5.5", role: "Finds recent changes to checkout", price: 4 },
    { id: "analyst", name: "Analyst", model: "Claude Haiku 5.5", role: "Measures the drop in the orders database", price: .2 },
    { id: "writer", name: "Writer", model: "Gemini 3.8 Flash", role: "Drafts the incident summary", price: .85 },
  ],
  spans: [
    { agentId: "lead", kind: "thinking", start: 0, end: 2, label: "Split the investigation into three tracks", tokens: 1920 },
    { agentId: "lead", kind: "waiting", start: 2, end: 14.6, label: "Waiting on the analyst, researcher and checker" },
    { agentId: "lead", kind: "thinking", start: 14.6, end: 16.8, label: "Merged findings: PR #4812 broke address autofill in Safari", tokens: 4380 },
    { agentId: "lead", kind: "waiting", start: 16.8, end: 23, label: "Waiting on the writer" },
    { agentId: "lead", kind: "thinking", start: 23, end: 25.2, label: "Reviewed the draft and tightened the timeline", tokens: 3140 },
    { agentId: "lead", kind: "tool", tool: "Notion", start: 25.2, end: 26.4, label: "Published the summary to the incidents page", tokens: 260 },

    { agentId: "checker", kind: "thinking", start: 3.5, end: 4.1, label: "Listed outside causes to rule out", tokens: 480 },
    { agentId: "checker", kind: "tool", tool: "Web search", start: 4.1, end: 5.6, label: "Searched for payment provider incidents on Oct 14", detail: "No matching incidents", tokens: 3920 },
    { agentId: "checker", kind: "thinking", start: 5.6, end: 6.3, label: "Checked browser releases next", tokens: 610 },
    { agentId: "checker", kind: "tool", tool: "Web search", start: 6.3, end: 7.7, label: "Searched browser release notes for autofill changes", tokens: 4460 },
    { agentId: "checker", kind: "thinking", start: 7.7, end: 9.1, label: "Ruled out causes outside the codebase", tokens: 1180 },

    { agentId: "researcher", kind: "thinking", start: 2.9, end: 3.5, label: "Planned the code search", tokens: 620 },
    { agentId: "researcher", kind: "tool", tool: "GitHub", start: 3.5, end: 4.8, label: "Listed 14 merged PRs touching checkout since Oct 10", tokens: 2140 },
    { agentId: "researcher", kind: "thinking", start: 4.8, end: 5.5, label: "Narrowed to 3 PRs shipped Oct 13 and 14", tokens: 980 },
    { agentId: "researcher", kind: "tool", tool: "GitHub", start: 5.5, end: 7.5, label: "Read the diff of PR #4812, an address autofill refactor", tokens: 6850 },
    { agentId: "researcher", kind: "thinking", start: 7.5, end: 8.5, label: "Traced the change to the Safari autofill path", tokens: 1410 },
    { agentId: "researcher", kind: "tool", tool: "GitHub", start: 8.5, end: 9.7, label: "Checked deploys: #4812 shipped Oct 13 at 21:40", tokens: 1760 },
    { agentId: "researcher", kind: "thinking", start: 9.7, end: 11.9, label: "Wrote up the suspect change with evidence", tokens: 2230 },

    { agentId: "analyst", kind: "thinking", start: 2.3, end: 3, label: "Wrote a conversion query for Oct 7 to 15", tokens: 540 },
    { agentId: "analyst", kind: "tool", tool: "PostgreSQL", start: 3, end: 5.1, label: "Conversion query timed out", detail: "Hit the 2s statement timeout on a full scan of orders", status: "failed", tokens: 410 },
    { agentId: "analyst", kind: "thinking", start: 5.1, end: 5.7, label: "Rewrote the query to use the date index", tokens: 380 },
    { agentId: "analyst", kind: "tool", tool: "PostgreSQL", start: 5.7, end: 7.3, label: "Retried: conversion by day and platform", detail: "Succeeded on the second attempt", retry: true, tokens: 1960 },
    { agentId: "analyst", kind: "thinking", start: 7.3, end: 8.3, label: "Found the drop is Safari only, down 9.2%", tokens: 720 },
    { agentId: "analyst", kind: "tool", tool: "PostgreSQL", start: 8.3, end: 9.9, label: "Pulled checkout errors by step for Safari", tokens: 2310 },
    { agentId: "analyst", kind: "thinking", start: 9.9, end: 11.8, label: "Traced the failures to the address step", tokens: 860 },
    { agentId: "analyst", kind: "tool", tool: "PostgreSQL", start: 11.8, end: 13, label: "Counted affected orders: 1,284", tokens: 1140 },
    { agentId: "analyst", kind: "thinking", start: 13, end: 14.3, label: "Summarized the numbers", tokens: 640 },

    { agentId: "writer", kind: "thinking", start: 17.1, end: 17.9, label: "Read the merged findings", tokens: 1850 },
    { agentId: "writer", kind: "tool", tool: "GitHub", start: 17.9, end: 18.8, label: "Pulled the PR #4812 description for context", tokens: 1120 },
    { agentId: "writer", kind: "thinking", start: 18.8, end: 22.7, label: "Drafted the incident summary, 412 words", tokens: 2940 },
  ],
  handoffs: [
    { from: "lead", to: "analyst", at: 2, label: "Measure the drop by day and platform" },
    { from: "lead", to: "researcher", at: 2.6, label: "Find recent changes to checkout" },
    { from: "lead", to: "checker", at: 3.2, label: "Rule out outside causes" },
    { from: "checker", to: "lead", at: 9.4, label: "No outside incident on Oct 14" },
    { from: "researcher", to: "lead", at: 12.2, label: "PR #4812 is the likely cause" },
    { from: "analyst", to: "lead", at: 14.6, label: "Safari only, 1,284 orders affected" },
    { from: "lead", to: "writer", at: 16.8, label: "Draft the incident summary" },
    { from: "writer", to: "lead", at: 23, label: "Draft ready for review" },
  ],
};
