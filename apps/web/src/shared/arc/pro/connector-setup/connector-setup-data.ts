import type { ReactNode } from "react";
import type { ConnectorMarkId } from "./connector-setup-marks";

/** One app the assistant can connect to. Everything but id, name and mark is optional. */
export interface Connector {
  id: string;
  name: string;
  /** One line under the name: what the assistant can do there. */
  description: string;
  /** A built-in mark id or your own 20px node. */
  mark: ConnectorMarkId | ReactNode;
  /** Shown while redirecting, for example "slack.com". */
  host?: string;
  /** The workspace or account the connection lands in, shown once connected. */
  account?: string;
  /** Plain-language scopes, shown after the connection is granted. */
  scopes?: string[];
  /** What the first sync pulls in: "Syncing 1,204 messages". */
  sync?: { count: number; noun: string };
  /** Extra search terms, for example "crm" or "docs". */
  keywords?: string[];
}

export const connectorSamples: Connector[] = [
  {
    id: "slack", name: "Slack", mark: "slack", host: "slack.com", account: "northwind.slack.com",
    description: "Search channels and threads, post replies",
    scopes: ["Read messages in public channels", "Search message history", "Post replies as Claude"],
    sync: { count: 1204, noun: "messages" }, keywords: ["chat", "messages"],
  },
  {
    id: "github", name: "GitHub", mark: "github", host: "github.com", account: "northwind-labs",
    description: "Read code, issues and pull requests",
    scopes: ["Read code in 12 repositories", "Read and write issues", "Comment on pull requests"],
    sync: { count: 342, noun: "pull requests" }, keywords: ["code", "git", "repos"],
  },
  {
    id: "notion", name: "Notion", mark: "notion", host: "notion.so", account: "Northwind HQ",
    description: "Search pages, docs and databases",
    scopes: ["Read pages shared with Claude", "Search workspace content", "Create pages in Drafts"],
    sync: { count: 2318, noun: "pages" }, keywords: ["docs", "wiki"],
  },
  {
    id: "google-drive", name: "Google Drive", mark: "google-drive", host: "accounts.google.com", account: "maya@northwind.co",
    description: "Find docs, sheets and slides",
    scopes: ["View files you open or share", "Search file names and content", "Export files to PDF"],
    sync: { count: 5612, noun: "files" }, keywords: ["docs", "sheets", "files", "google"],
  },
  {
    id: "linear", name: "Linear", mark: "linear", host: "linear.app", account: "Northwind · NOR",
    description: "Create, triage and update issues",
    scopes: ["Read issues and projects", "Create and update issues", "Comment on issues"],
    sync: { count: 864, noun: "issues" }, keywords: ["issues", "tickets", "projects"],
  },
  {
    id: "jira", name: "Jira", mark: "jira", host: "id.atlassian.com", account: "northwind.atlassian.net",
    description: "Track tickets across Atlassian projects",
    scopes: ["Read issues in 4 projects", "Transition issue status", "Add comments and worklogs"],
    sync: { count: 1977, noun: "issues" }, keywords: ["atlassian", "tickets"],
  },
  {
    id: "salesforce", name: "Salesforce", mark: "salesforce", host: "login.salesforce.com", account: "Northwind Traders",
    description: "Look up accounts and opportunities",
    scopes: ["Read accounts and contacts", "Read opportunities", "Log activity on records"],
    sync: { count: 428, noun: "opportunities" }, keywords: ["crm", "sales"],
  },
  {
    id: "hubspot", name: "HubSpot", mark: "hubspot", host: "app.hubspot.com", account: "Portal 24019837",
    description: "Read contacts, deals and notes",
    scopes: ["Read contacts and companies", "Read deals and pipelines", "Create notes on records"],
    sync: { count: 3140, noun: "contacts" }, keywords: ["crm", "marketing"],
  },
];

/** The sample's one scripted failure: Salesforce asks for admin approval on the first try, then connects on retry. */
export const sampleFirstAttemptErrors: Record<string, string> = {
  salesforce: "Needs admin approval",
};
