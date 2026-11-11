import { avatar } from "../lib/media";

/** Where a message came from. Each channel draws its real mark. */
export type TicketChannel = "email" | "intercom" | "slack" | "zendesk";
export type TicketIntent = "billing" | "bug" | "feature" | "refund";
export type TicketSentiment = "positive" | "neutral" | "negative";

export interface TicketClassification {
  intent: TicketIntent;
  sentiment: TicketSentiment;
  /** 0 to 1. Below `reviewThreshold` the ticket goes to the review lane. */
  confidence: number;
}

export interface TicketMessage {
  id: string;
  channel: TicketChannel;
  customer: string;
  company?: string;
  subject: string;
  preview: string;
  /** Short received label, for example "9:41" or "2m". */
  receivedAt?: string;
  /** Used by the built in simulated classifier only. Real classifiers ignore it. */
  sample?: TicketClassification & { failOnce?: boolean };
}

export interface TicketAssignee {
  name: string;
  avatar?: string;
}

export interface TicketLane {
  id: string;
  label: string;
  /** Tickets in this lane are assigned round robin. Leave empty for an unassigned queue. */
  assignees?: TicketAssignee[];
  /** Marks the lane that collects low confidence tickets. */
  review?: boolean;
  /** Tickets routed before this session, shown in the counter. */
  count?: number;
}

export interface RoutedTicket extends TicketMessage {
  /** Missing when a ticket was sent to review after the classifier failed. */
  classification?: TicketClassification;
  lane: string;
  assignee?: TicketAssignee;
  /** For review tickets: the lane the classifier would have picked. */
  suggestedLane?: string;
}

export const intentLabels: Record<TicketIntent, string> = { billing: "Billing", bug: "Bug", feature: "Feature request", refund: "Refund" };
export const sentimentLabels: Record<TicketSentiment, string> = { positive: "Positive", neutral: "Neutral", negative: "Frustrated" };
export const channelLabels: Record<TicketChannel, string> = { email: "Gmail", intercom: "Intercom", slack: "Slack", zendesk: "Zendesk" };

export const ticketRouterLanes: TicketLane[] = [
  { id: "billing", label: "Billing", count: 14, assignees: [{ name: "Andre Williams", avatar: avatar("andre-williams") }, { name: "Sofia Ramirez", avatar: avatar("sofia-ramirez") }] },
  { id: "engineering", label: "Engineering", count: 9, assignees: [{ name: "Daniel Kim", avatar: avatar("daniel-kim") }, { name: "Olivia Bennett", avatar: avatar("olivia-bennett") }] },
  { id: "success", label: "Success", count: 6, assignees: [{ name: "Hannah Walsh", avatar: avatar("hannah-walsh") }, { name: "Jordan Reyes", avatar: avatar("jordan-reyes") }] },
  { id: "review", label: "Needs review", count: 1, review: true },
];

/** Sample inbox for October 28, 2026. Customers and companies are fictional. */
export const ticketRouterSamples: TicketMessage[] = [
  { id: "t-4821", channel: "email", customer: "Priya Raman", company: "Northwind Logistics", receivedAt: "9:41", subject: "Charged twice for the October invoice", preview: "Hi team, our Visa ending 4417 was billed $1,240 twice on Oct 24 for the Growth plan. Could you reverse the duplicate charge?", sample: { intent: "billing", sentiment: "negative", confidence: .97 } },
  { id: "t-4822", channel: "intercom", customer: "Lukas Meyer", company: "Fernhill", receivedAt: "9:42", subject: "CSV export fails above 10,000 rows", preview: "Exporting the Q3 deals view returns a 504 after about 30 seconds. Smaller views export fine. It started after Tuesday's release.", sample: { intent: "bug", sentiment: "negative", confidence: .94 } },
  { id: "t-4823", channel: "slack", customer: "Aiko Tanaka", company: "Brightline", receivedAt: "9:42", subject: "Group provisioning through Okta", preview: "We are adding 140 seats in November and would love SCIM group sync with Okta so new hires land in the right workspace.", sample: { intent: "feature", sentiment: "positive", confidence: .91 } },
  { id: "t-4824", channel: "email", customer: "Marco Bellini", company: "Atelier Nove", receivedAt: "9:43", subject: "Refund for unused seats", preview: "We went from 25 to 12 seats on Oct 3 but were charged for the full month. Requesting a prorated refund of $312.", sample: { intent: "refund", sentiment: "neutral", confidence: .89 } },
  { id: "t-4825", channel: "intercom", customer: "Grace Okafor", company: "Lumen Health", receivedAt: "9:44", subject: "Something feels off with reminders", preview: "A few patients said reminders arrived late yesterday. Not sure if it is on our side or yours, can someone take a look?", sample: { intent: "bug", sentiment: "neutral", confidence: .54 } },
  { id: "t-4826", channel: "slack", customer: "Tom Becker", company: "Parcelwise", receivedAt: "9:44", subject: "Webhooks arrive twice", preview: "Since Oct 25 every order.updated webhook arrives twice, about 200ms apart, with the same event id.", sample: { intent: "bug", sentiment: "negative", confidence: .95, failOnce: true } },
  { id: "t-4827", channel: "zendesk", customer: "Elena Petrova", company: "Quill & Co", receivedAt: "9:45", subject: "Weekly PDF of the new dashboard", preview: "The new reporting dashboard is great. Could we schedule it as a weekly PDF for our leadership team on Mondays?", sample: { intent: "feature", sentiment: "positive", confidence: .88 } },
  { id: "t-4828", channel: "intercom", customer: "Sam Whitfield", company: "Harbor Labs", receivedAt: "9:46", subject: "Invoice shows our old VAT number", preview: "Our October invoice lists the old VAT ID. Please reissue it with GB 293 4471 09 before month end.", sample: { intent: "billing", sentiment: "neutral", confidence: .93 } },
  { id: "t-4829", channel: "email", customer: "Nina Alvarez", company: "Orbital", receivedAt: "9:46", subject: "Wrong plan, can we switch?", preview: "We picked the annual plan on Oct 20 by mistake and meant monthly. Can you switch us and sort out the difference?", sample: { intent: "refund", sentiment: "neutral", confidence: .62 } },
];

const lane = (id: string) => ticketRouterLanes.find(entry => entry.id === id)!;

/** Already routed this morning, so the lanes are not empty on first paint. Counts above include them. */
export const ticketRouterSeed: RoutedTicket[] = [
  { id: "t-4814", channel: "intercom", customer: "Ravi Shah", company: "Kitebird", receivedAt: "9:31", subject: "Update the card on file", preview: "", classification: { intent: "billing", sentiment: "neutral", confidence: .96 }, lane: "billing", assignee: lane("billing").assignees![1] },
  { id: "t-4816", channel: "email", customer: "Helen Price", company: "Daybreak", receivedAt: "9:34", subject: "Receipt is missing our address", preview: "", classification: { intent: "billing", sentiment: "neutral", confidence: .92 }, lane: "billing", assignee: lane("billing").assignees![0] },
  { id: "t-4815", channel: "slack", customer: "Owen Hart", company: "Relay", receivedAt: "9:32", subject: "SAML login loops on Safari 19", preview: "", classification: { intent: "bug", sentiment: "negative", confidence: .95 }, lane: "engineering", assignee: lane("engineering").assignees![1] },
  { id: "t-4818", channel: "zendesk", customer: "Mia Larsen", company: "Fjord", receivedAt: "9:37", subject: "API returns 429 since 14:00 UTC", preview: "", classification: { intent: "bug", sentiment: "negative", confidence: .93 }, lane: "engineering", assignee: lane("engineering").assignees![0] },
  { id: "t-4817", channel: "intercom", customer: "Leo Grant", company: "Plainsight", receivedAt: "9:35", subject: "Dark mode for the mobile app", preview: "", classification: { intent: "feature", sentiment: "positive", confidence: .9 }, lane: "success", assignee: lane("success").assignees![1] },
  { id: "t-4819", channel: "email", customer: "Ines Duarte", company: "Mareva", receivedAt: "9:38", subject: "Question about our account", preview: "", classification: { intent: "feature", sentiment: "neutral", confidence: .48 }, lane: "review", suggestedLane: "success" },
];
