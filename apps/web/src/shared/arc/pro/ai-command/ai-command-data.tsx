import { Download, KeyRound, Landmark, LayoutGrid, Link2, Plus, Receipt, ScrollText, Send, Settings, SunMoon, Undo2, UserPlus, Users, Webhook } from "lucide-react";
import type { AiCommandAction, AiCommandAnswer, AiCommandAsk, AiCommandItem, AiCommandSource } from "./ai-command-types";
import { GithubMark, LinearMark, NorthwindMark, NotionMark, SlackMark, StripeMark } from "./ai-command-marks";

/*
 * Sample workspace: the billing team at Acme on Tuesday 27 October 2026. Every name, number and link is sample content,
 * and every action is simulated, so nothing reaches Stripe, GitHub, Slack, Notion or Linear.
 */

const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;
const mark = { width: 16, height: 16 } as const;
const chip = { width: 14, height: 14 } as const;

export const aiCommandSampleItems: AiCommandItem[] = [
  { id: "dashboard", group: "Pages", label: "Dashboard", icon: <LayoutGrid {...icon} />, shortcut: ["G", "D"], keywords: ["home", "overview"], suggested: true },
  { id: "invoices", group: "Pages", label: "Invoices", icon: <Receipt {...icon} />, shortcut: ["G", "I"], keywords: ["billing", "unpaid", "overdue"], suggested: true },
  { id: "customers", group: "Pages", label: "Customers", icon: <Users {...icon} />, shortcut: ["G", "C"], keywords: ["accounts", "companies"], suggested: true },
  { id: "payouts", group: "Pages", label: "Payouts", icon: <Landmark {...icon} />, shortcut: ["G", "P"], keywords: ["bank", "transfers"] },
  { id: "webhooks", group: "Pages", label: "Webhooks", meta: "Developers", icon: <Webhook {...icon} />, keywords: ["events", "endpoints"] },
  { id: "api-keys", group: "Pages", label: "API keys", meta: "Developers", icon: <KeyRound {...icon} />, keywords: ["tokens", "secret"] },
  { id: "audit-log", group: "Pages", label: "Audit log", meta: "Settings", icon: <ScrollText {...icon} />, keywords: ["history", "security"] },
  { id: "billing-settings", group: "Pages", label: "Billing settings", meta: "Settings", icon: <Settings {...icon} />, keywords: ["tax", "currency", "plans"] },
  { id: "create-invoice", group: "Actions", label: "Create invoice", icon: <Plus {...icon} />, shortcut: "C", keywords: ["new", "bill"], suggested: true },
  { id: "invite", group: "Actions", label: "Invite teammate", icon: <UserPlus {...icon} />, shortcut: "mod+shift+I", keywords: ["member", "add", "user"], suggested: true },
  { id: "refund", group: "Actions", label: "Refund a payment", icon: <Undo2 {...icon} />, keywords: ["return", "chargeback"] },
  { id: "export", group: "Actions", label: "Export invoices as CSV", icon: <Download {...icon} />, keywords: ["download", "spreadsheet"] },
  { id: "theme", group: "Actions", label: "Switch theme", icon: <SunMoon {...icon} />, shortcut: "mod+shift+L", keywords: ["dark", "light", "appearance"], suggested: true },
  { id: "copy-link", group: "Actions", label: "Copy page link", icon: <Link2 {...icon} />, shortcut: "mod+shift+C", keywords: ["url", "share"] },
  { id: "linear", group: "Connected apps", label: "Search Linear issues", meta: "Billing team", icon: <LinearMark {...mark} />, keywords: ["bugs", "tickets", "eng"], suggested: true },
  { id: "notion", group: "Connected apps", label: "Open Notion", meta: "Acme wiki", icon: <NotionMark {...mark} />, keywords: ["docs", "runbook", "wiki"], suggested: true },
  { id: "github", group: "Connected apps", label: "acme/billing-api", meta: "GitHub", icon: <GithubMark {...mark} />, keywords: ["repo", "code", "pull requests"], suggested: true },
  { id: "slack", group: "Connected apps", label: "#eng-billing", meta: "Slack", icon: <SlackMark {...mark} />, keywords: ["channel", "chat", "message"], suggested: true },
  { id: "stripe", group: "Connected apps", label: "Stripe dashboard", meta: "Live mode", icon: <StripeMark {...mark} />, keywords: ["payments", "charges"] },
];

export const aiCommandSampleQuestions = [
  "Why did EU invoices fail last night?",
  "Which invoices are overdue?",
  "Who owns the webhooks service?",
];

const simulated = "Simulated, nothing was sent";

type Sample = { match: (question: string) => boolean; sources: AiCommandSource[]; text: string; actions: AiCommandAction[] };

const samples: Sample[] = [
  {
    match: q => /invoice|renewal|charge/.test(q) && /fail|declin|error|why/.test(q),
    sources: [
      { id: "stripe-events", title: "212 declines", description: "Stripe events, 27 Oct 02:00 to 02:40 CET, authentication_required", mark: <StripeMark {...chip} /> },
      { id: "pr-1893", title: "billing-api #1893", description: "GitHub pull request: Skip 3-D Secure for saved cards, merged 26 Oct", mark: <GithubMark {...chip} /> },
      { id: "slack-maya", title: "#eng-billing", description: "Slack, Maya Chen at 08:15: flag off, retry queued for 14:00", mark: <SlackMark {...chip} /> },
      { id: "runbook", title: "Failed renewals", description: "Notion runbook: Failed renewals and dunning", mark: <NotionMark {...chip} /> },
    ],
    text: "Stripe declined 212 of 1,348 EU renewals between 02:00 and 02:40 CET, all with authentication_required [1]. billing-api v4.12 started skipping 3-D Secure for saved cards, which EU issuers still require under SCA, so the nightly retry charged those cards without a challenge [2]. Maya Chen turned the flag off at 08:15 and queued the 212 invoices for another attempt at 14:00 today [3]. Dunning emails are paused, so no customer has been told yet [4].",
    actions: [
      { id: "linear-issue", label: "Create issue in Linear", meta: "Billing team, links 4 sources", mark: <LinearMark {...mark} />, runningLabel: "Creating issue", errorLabel: "Couldn't create the issue", doneMeta: simulated, run: signal => wait(950, signal).then(() => "Created ENG-2481") },
      { id: "notion-doc", label: "Open doc in Notion", meta: "Failed renewals runbook", mark: <NotionMark {...mark} />, runningLabel: "Opening runbook", errorLabel: "Couldn't open the runbook", doneLabel: "Opened the runbook", doneMeta: "Simulated, no page was opened", run: signal => wait(650, signal) },
      { id: "slack-post", label: "Post summary to #eng-billing", meta: "As you, with sources", mark: <SlackMark {...mark} />, runningLabel: "Posting summary", errorLabel: "Couldn't post to Slack", doneLabel: "Posted to #eng-billing", doneMeta: simulated, run: signal => wait(800, signal) },
    ],
  },
  {
    match: q => /overdue|unpaid|outstanding|owe/.test(q),
    sources: [
      { id: "aging", title: "Aging report", description: "Invoices, open and past due, as of 09:30 today", mark: <Receipt {...chip} /> },
      { id: "northwind", title: "Northwind Logistics", description: "Customer: 3 open invoices, last payment 6 October", mark: <NorthwindMark {...chip} /> },
    ],
    text: "41 invoices worth $63,920 are past due as of 09:30 today [1]. The 212 EU renewals queued for 14:00 are not due yet, so they are not in that count. Northwind Logistics owes the most: $8,400 across 3 invoices, the oldest 21 days late [2].",
    actions: [
      { id: "remind", label: "Send reminders to 41 customers", meta: "Uses the friendly reminder template", mark: <Send {...icon} />, runningLabel: "Sending reminders", errorLabel: "Couldn't send reminders", doneLabel: "Queued 41 reminders", doneMeta: simulated, run: signal => wait(900, signal) },
      { id: "export-overdue", label: "Export overdue invoices as CSV", meta: "41 rows", mark: <Download {...icon} />, runningLabel: "Preparing export", errorLabel: "Couldn't export", doneLabel: "Export ready", doneMeta: "Simulated, no file was created", run: signal => wait(600, signal) },
    ],
  },
  {
    match: q => /webhook|owner|owns|codeowners|on call/.test(q),
    sources: [
      { id: "codeowners", title: "CODEOWNERS", description: "acme/billing-api: services/webhooks/ @priya-r @tomas-k", mark: <GithubMark {...chip} /> },
      { id: "rota", title: "On-call rota", description: "Notion: Payments platform on call, week 44", mark: <NotionMark {...chip} /> },
    ],
    text: "The Payments platform team owns the webhooks service. CODEOWNERS lists Priya Raman and Tomás Kovač for everything under services/webhooks [1]. Priya is on call this week, through Sunday 1 November [2].",
    actions: [
      { id: "slack-dm", label: "Message Priya Raman in Slack", meta: "Direct message", mark: <SlackMark {...mark} />, runningLabel: "Opening conversation", errorLabel: "Couldn't reach Slack", doneLabel: "Draft opened for Priya", doneMeta: simulated, run: signal => wait(600, signal) },
      { id: "codeowners-open", label: "Open CODEOWNERS on GitHub", meta: "acme/billing-api", mark: <GithubMark {...mark} />, runningLabel: "Opening file", errorLabel: "Couldn't open GitHub", doneLabel: "Opened CODEOWNERS", doneMeta: "Simulated, no page was opened", run: signal => wait(500, signal) },
    ],
  },
];

/** Resolves after ms, or rejects as soon as the signal aborts. */
export function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const timer = setTimeout(() => { signal?.removeEventListener("abort", stop); resolve(); }, ms);
    function stop() { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }
    signal?.addEventListener("abort", stop, { once: true });
  });
}

function fallback(question: string): AiCommandAnswer {
  const short = question.length > 48 ? `${question.slice(0, 47).trimEnd()}…` : question;
  return {
    text: `Nothing in Stripe, GitHub, Slack or Notion mentions “${short}” yet. Try naming a customer, an invoice number or a date, or ask the billing team.`,
    actions: [{ id: "ask-team", label: "Ask in #eng-billing", meta: "Posts your question as you", mark: <SlackMark {...mark} />, runningLabel: "Posting question", errorLabel: "Couldn't post to Slack", doneLabel: "Asked in #eng-billing", doneMeta: simulated, run: signal => wait(700, signal) }],
  };
}

/**
 * The simulated answer engine behind the sample. It searches for about 0.8s, shows its sources, then hands back the text
 * for the palette to stream. With failures on, the first answer and the first run of each action fail once, so the
 * error and retry states can be seen.
 */
export function createSampleAsk({ failures = false }: { failures?: boolean } = {}): AiCommandAsk {
  let failNextAnswer = failures;
  const failed = new Set<string>();
  return async (question, { signal, setSources }) => {
    const q = question.toLowerCase();
    const sample = samples.find(s => s.match(q));
    await wait(sample ? 820 : 640, signal);
    if (failNextAnswer) {
      failNextAnswer = false;
      throw new Error("The model didn't respond within 30s. Simulated failure, try again.");
    }
    if (!sample) return fallback(question);
    setSources(sample.sources);
    await wait(260, signal);
    const actions = failures ? sample.actions.map(action => ({
      ...action,
      run: async (actionSignal: AbortSignal) => {
        if (!failed.has(action.id)) { failed.add(action.id); await wait(700, actionSignal); throw new Error("Simulated failure"); }
        return action.run?.(actionSignal);
      },
    })) : sample.actions;
    return { text: sample.text, actions };
  };
}

export const aiCommandSampleAsk = createSampleAsk();
