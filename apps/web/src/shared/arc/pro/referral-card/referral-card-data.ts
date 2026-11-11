import type { Referral, ReferralStage } from "./referral-card";

/** Sample program for the demo: Emma Collins invites friends to Northwind, October 2026. */
export const sampleLink = "https://northwind.app/r/emma20";

export const sampleReferrals: Referral[] = [
  { id: "ref-ryan", name: "Ryan Sullivan", email: "ryan@ledgerly.com", avatar: "/media/people/ryan-sullivan.svg", stage: "invited", invitedAt: "2026-10-26T09:12:00Z" },
  { id: "ref-chloe", name: "Chloe Nguyen", email: "chloe@parcel.so", avatar: "/media/people/chloe-nguyen.svg", stage: "signed-up", invitedAt: "2026-10-23T15:40:00Z" },
  { id: "ref-priya", name: "Priya Shah", email: "priya@hexwork.io", stage: "invited", invitedAt: "2026-10-21T11:05:00Z" },
  { id: "ref-daniel", name: "Daniel Kim", email: "daniel@fieldnote.studio", avatar: "/media/people/daniel-kim.svg", stage: "earned", invitedAt: "2026-10-17T08:30:00Z" },
  { id: "ref-jasmine", name: "Jasmine Brooks", email: "jasmine@lumen.dev", avatar: "/media/people/jasmine-brooks.svg", stage: "earned", invitedAt: "2026-10-12T17:20:00Z" },
  { id: "ref-marcus", name: "Marcus Johnson", email: "marcus@tidewater.co", avatar: "/media/people/marcus-johnson.svg", stage: "earned", invitedAt: "2026-10-06T10:00:00Z" },
];

/** What happens on its own once the card is on screen: Chloe subscribes, Ryan signs up and subscribes, the milestone unlocks. */
export const sampleScript: { at: number; id: string; stage: ReferralStage }[] = [
  { at: 1400, id: "ref-chloe", stage: "earned" },
  { at: 2900, id: "ref-ryan", stage: "signed-up" },
  { at: 4400, id: "ref-ryan", stage: "earned" },
];
