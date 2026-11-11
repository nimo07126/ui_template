import type { StarterPromptApp } from "./starter-prompts-marks";

export type StarterPromptCategoryId = "write" | "code" | "analyze" | "plan" | (string & {});

export interface StarterPrompt {
  id: string;
  /** Matches a category id, such as "write". */
  category: StarterPromptCategoryId;
  /** The card's first line. Short, starts with a verb. */
  title: string;
  /** One quiet line under the title. Truncates with an ellipsis. */
  description?: string;
  /** The full text placed in the composer when the card is picked. */
  prompt: string;
  /** A connected app the prompt uses. Shows its mark on the card and in the composer. */
  app?: StarterPromptApp;
}

/** Sample starters for a product team in late October 2026. Names, repos and numbers are sample content. */
export const starterPromptSamples: StarterPrompt[] = [
  { id: "reply-priya", category: "write", app: "gmail", title: "Reply to Priya about the launch", description: "Confirm the new date from her Gmail thread", prompt: "Draft a reply to Priya Raman's latest Gmail thread confirming we're moving the Halcyon launch to Tuesday, November 10. Keep it warm and under 120 words." },
  { id: "release-notes", category: "write", app: "github", title: "Write release notes for v2.14", description: "Turn this week's merged PRs into a changelog", prompt: "Write customer-facing release notes for v2.14 from the pull requests merged into acme/web this week. Group them into New, Improved and Fixed." },
  { id: "series-a", category: "write", title: "Announce our Series A", description: "Two short versions for LinkedIn and X", prompt: "Write a short announcement of our $18M Series A led by Northwind Ventures for LinkedIn and X. Confident, no buzzwords, two versions." },
  { id: "tighten", category: "write", title: "Tighten a paragraph", description: "Clearer and shorter, same voice", prompt: "Rewrite the paragraph below so it is clearer and about 30% shorter, keeping my voice:\n\n" },
  { id: "follow-up", category: "write", app: "gmail", title: "Follow up with Lumen Health", description: "A nudge on the pilot proposal from October 14", prompt: "Write a short follow-up to Daniel Okafor at Lumen Health about the pilot proposal I sent on October 14. Offer two call slots next week." },
  { id: "job-post", category: "write", app: "notion", title: "Draft a job post", description: "Senior product designer, from the hiring brief", prompt: "Draft a job post for a senior product designer from the hiring brief in Notion. Lead with the work, list the salary range and keep it under 400 words." },

  { id: "review-pr", category: "code", app: "github", title: "Review PR #482 in acme/web", description: "Flag bugs, risky changes and missing tests", prompt: "Review pull request #482 in acme/web. Flag bugs, risky changes and missing tests, and suggest fixes as inline comments." },
  { id: "churn-sql", category: "code", title: "Write a churn query", description: "Monthly logo churn by plan in Postgres", prompt: "Write a Postgres query for monthly logo churn by plan from the subscriptions table, January through October 2026." },
  { id: "flaky-test", category: "code", app: "github", title: "Fix the flaky checkout test", description: "It fails on CI about one run in five", prompt: "checkout.spec.ts in acme/web fails on CI about one run in five. Read the last 10 failed runs, find the cause and propose a fix." },
  { id: "regex", category: "code", title: "Explain a regex", description: "Piece by piece, with examples that pass and fail", prompt: "Explain what this regular expression matches, piece by piece, with two examples that pass and two that fail:\n\n" },
  { id: "migrate-hooks", category: "code", title: "Convert a class to hooks", description: "Keep behavior identical, add types", prompt: "Convert the React class component below to a function component with hooks. Keep the behavior identical and add TypeScript types:\n\n" },
  { id: "issue-triage", category: "code", app: "linear", title: "Triage new bug reports", description: "Label and route the 23 untriaged issues", prompt: "Go through the 23 untriaged issues in Linear. Label each one, set a priority, and route it to the right team with a one-line reason." },

  { id: "interview-themes", category: "analyze", app: "notion", title: "Find themes in user interviews", description: "Summarize the 14 notes in the Research hub", prompt: "Read the 14 user interview notes in the Notion Research hub and give me the five most common themes, each with two direct quotes." },
  { id: "signup-drop", category: "analyze", title: "Explain last week's signup drop", description: "Compare the funnel with the prior four weeks", prompt: "Signups dropped 18% in the week of October 19. Compare each funnel step with the prior four weeks and tell me where the drop starts." },
  { id: "inbox-summary", category: "analyze", app: "gmail", title: "Summarize my unread email", description: "Group threads by who needs a reply", prompt: "Summarize my unread Gmail from the last 48 hours. Group threads by whether they need a reply from me today, this week, or never." },
  { id: "vendor-quotes", category: "analyze", title: "Compare two vendor quotes", description: "Cost, terms and the fine print side by side", prompt: "Compare the two attached vendor quotes side by side: total cost over 24 months, payment terms, cancellation, and anything unusual in the fine print." },
  { id: "pr-velocity", category: "analyze", app: "github", title: "Check review turnaround", description: "Median time to first review, by team", prompt: "Using pull requests in acme/web from September and October 2026, show the median time to first review by team and call out the slowest repos." },
  { id: "nps-comments", category: "analyze", title: "Sort NPS comments", description: "312 responses from the October survey", prompt: "Sort the 312 comments from our October NPS survey into themes, with counts, the average score per theme, and one representative quote each." },

  { id: "sprint", category: "plan", app: "linear", title: "Plan the next sprint", description: "Fit the backlog into 34 points of capacity", prompt: "Plan our next two-week sprint from the Linear backlog. We have 34 points of capacity; prioritize P1 bugs and explain what you left out." },
  { id: "offsite", category: "plan", app: "notion", title: "Draft the Q1 offsite agenda", description: "Two days in Lisbon for 12 people", prompt: "Draft a two-day agenda for our Q1 product offsite in Lisbon for 12 people, and put it in a new Notion page under Team." },
  { id: "focus-time", category: "plan", app: "calendar", title: "Find focus time this week", description: "Two hours a day around existing meetings", prompt: "Look at my Google Calendar for the week of November 2 and block two hours of focus time each day around existing meetings." },
  { id: "launch-checklist", category: "plan", title: "Make a launch checklist", description: "Everything for the November 10 release", prompt: "Make a launch checklist for the Halcyon release on November 10, split into engineering, marketing and support, with an owner for each item." },
  { id: "onboarding", category: "plan", app: "notion", title: "Plan a new hire's first week", description: "Day by day, for Mei joining on November 2", prompt: "Plan Mei Tanaka's first week as a product engineer starting November 2: day by day, who she meets, and what she ships by Friday." },
  { id: "roadmap", category: "plan", title: "Outline the Q1 roadmap", description: "Three bets, with what we will not do", prompt: "Outline a Q1 2027 roadmap with three bets, the metric each one moves, rough sizing, and a short list of what we will not do." },
];
