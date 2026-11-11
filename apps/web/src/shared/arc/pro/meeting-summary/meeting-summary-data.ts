import { avatar } from "../lib/media";

export type MeetingPlatform = "google-meet" | "zoom" | "other";
export type MeetingSendTarget = "linear" | "notion";
export type MeetingSummaryStatus = "summarizing" | "ready" | "error";

export interface MeetingPerson {
  id: string;
  name: string;
  /** Portrait URL. Initials show when it is missing or fails to load. */
  avatar?: string;
}

/** The transcript line a point was drawn from. `at` is seconds from the start of the recording. */
export interface MeetingQuote {
  speakerId: string;
  at: number;
  text: string;
}

export interface MeetingPoint {
  id: string;
  text: string;
  quote?: MeetingQuote;
}

export interface MeetingActionItem extends MeetingPoint {
  /** An attendee id. */
  ownerId?: string;
  /** ISO date, for example "2026-10-30". */
  due?: string;
  /** Initial checked state. */
  done?: boolean;
}

export interface MeetingSummaryData {
  title: string;
  platform: MeetingPlatform;
  /** Local start time as an ISO string without a zone, for example "2026-10-27T10:00". */
  startsAt: string;
  durationMinutes: number;
  transcriptWords?: number;
  attendees: MeetingPerson[];
  summary: MeetingPoint[];
  decisions: MeetingPoint[];
  actionItems: MeetingActionItem[];
}

export interface MeetingSendResult {
  /** Short label for the created record, such as "PRC-142". */
  reference?: string;
  /** Opens the created record in a new tab. */
  url?: string;
}

/** Sample content: a pricing review on Google Meet, Tuesday October 27 2026. */
export const meetingSummarySample: MeetingSummaryData = {
  title: "Annual billing launch review",
  platform: "google-meet",
  startsAt: "2026-10-27T10:00",
  durationMinutes: 42,
  transcriptWords: 6214,
  attendees: [
    { id: "diane", name: "Diane Foster", avatar: avatar("diane-foster") },
    { id: "nathan", name: "Nathan Cole", avatar: avatar("nathan-cole") },
    { id: "jasmine", name: "Jasmine Brooks", avatar: avatar("jasmine-brooks") },
    { id: "marcus", name: "Marcus Johnson", avatar: avatar("marcus-johnson") },
    { id: "andre", name: "Andre Williams", avatar: avatar("andre-williams") },
    { id: "chloe", name: "Chloe Nguyen", avatar: avatar("chloe-nguyen") },
    { id: "ava", name: "Ava Mitchell", avatar: avatar("ava-mitchell") },
  ],
  summary: [
    { id: "s1", text: "Annual plans converted at 31% in the pricing test, against 22% for monthly, with trial starts flat.", quote: { speakerId: "chloe", at: 252, text: "Across 11,400 visitors the annual arm converts at 31 percent. Trial starts are flat, so we're not scaring anyone off." } },
    { id: "s2", text: "Annual churn can't be read until next year, so 60-day refunds will stand in as the signal.", quote: { speakerId: "andre", at: 698, text: "We won't see real annual churn until next October. Refunds in the first 60 days are the best proxy we have." } },
    { id: "s3", text: "The new billing toggle tested well, but the savings label read like a coupon on mobile.", quote: { speakerId: "jasmine", at: 1085, text: "Four of the six people on mobile read 'save 20%' as a coupon code, not as the annual discount." } },
    { id: "s4", text: "Engineering can ship behind the pricing-v3 flag by November 4 if price IDs land this week.", quote: { speakerId: "nathan", at: 1607, text: "If finance gets us the new price IDs by Friday, Marcus can have it behind the flag by the fourth." } },
  ],
  decisions: [
    { id: "d1", text: "Launch annual billing at 20% off, worded as two months free.", quote: { speakerId: "diane", at: 1880, text: "Let's go with two months free. Same discount, and nobody reads it as a coupon." } },
    { id: "d2", text: "Roll out to half of new visitors first, then everyone after two clean weeks.", quote: { speakerId: "diane", at: 2042, text: "Fifty percent of new traffic first. If refunds look normal for two weeks, we open it up." } },
    { id: "d3", text: "Existing monthly customers get an in-app offer instead of an email blast.", quote: { speakerId: "ava", at: 2235, text: "An in-app banner on the billing page will convert better than another email, and it's easier to target." } },
  ],
  actionItems: [
    { id: "a1", text: "Create annual price IDs in Stripe for all three tiers", ownerId: "andre", due: "2026-10-30", quote: { speakerId: "andre", at: 1652, text: "I'll set up the three annual prices in Stripe and send the IDs over by Friday." } },
    { id: "a2", text: "Ship the billing toggle behind the pricing-v3 flag", ownerId: "marcus", due: "2026-11-04", quote: { speakerId: "marcus", at: 1694, text: "Once I have the IDs it's a day of work. I'll keep it behind pricing-v3 until we flip it." } },
    { id: "a3", text: "Rewrite the savings label as two months free on mobile", ownerId: "jasmine", due: "2026-10-29", quote: { speakerId: "jasmine", at: 1931, text: "I'll update the label in the toggle and the mobile sheet today or tomorrow." } },
    { id: "a4", text: "Build a 60-day refund dashboard for annual plans", ownerId: "chloe", due: "2026-11-06", quote: { speakerId: "chloe", at: 2310, text: "I can have a refund view for annual cohorts in Metabase by next Friday." } },
  ],
};

/** The same meeting with recording turned off: nothing to summarize. */
export const meetingSummaryEmptySample: MeetingSummaryData = { ...meetingSummarySample, transcriptWords: 0, summary: [], decisions: [], actionItems: [] };
