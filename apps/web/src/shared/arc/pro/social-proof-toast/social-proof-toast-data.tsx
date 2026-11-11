import type { ReactNode } from "react";
import { avatar } from "../lib/media";
import { LinearMark, RaycastMark, ResendMark, SupabaseMark, VercelMark } from "./social-proof-toast-marks";

export interface SocialProofEvent {
  /** Stable id, used for keys and callbacks. */
  id: string;
  /** Who did it: a first name ("Sofia") or a company ("Linear"). Shown in medium weight. */
  name: string;
  /** What they did, read after the name: "started a Pro trial". */
  action: string;
  /** Short context before the time, such as a city or a seat count. */
  meta?: string;
  /** When it happened. A Date or timestamp renders as relative time; a string renders as is. */
  time?: Date | number | string;
  /** Portrait URL for a person. */
  avatar?: string;
  /** A 18px mark for a company, drawn in currentColor. Used when there is no avatar. */
  logo?: ReactNode;
  /** Shows a verified badge. Pass a string to change its label, such as "Verified by Stripe". */
  verified?: boolean | string;
}

/** Sample feed for a SaaS landing page. Times are sample strings so the loop reads naturally. */
export const sampleSocialProofEvents: SocialProofEvent[] = [
  { id: "sofia", name: "Sofia", action: "started a Pro trial", meta: "Madrid", time: "2 min ago", avatar: avatar("sofia-ramirez") },
  { id: "linear", name: "Linear", action: "upgraded to Business", meta: "48 seats", time: "4 min ago", logo: <LinearMark />, verified: true },
  { id: "daniel", name: "Daniel", action: "subscribed to Pro yearly", meta: "Seoul", time: "7 min ago", avatar: avatar("daniel-kim"), verified: true },
  { id: "vercel", name: "Vercel", action: "added 12 seats to Team", meta: "San Francisco", time: "11 min ago", logo: <VercelMark />, verified: true },
  { id: "chloe", name: "Chloe", action: "booked a product demo", meta: "Melbourne", time: "14 min ago", avatar: avatar("chloe-nguyen") },
  { id: "supabase", name: "Supabase", action: "moved to annual billing", meta: "Enterprise", time: "18 min ago", logo: <SupabaseMark />, verified: true },
  { id: "hannah", name: "Hannah", action: "started a Pro trial", meta: "Dublin", time: "21 min ago", avatar: avatar("hannah-walsh") },
  { id: "raycast", name: "Raycast", action: "upgraded to Business", meta: "32 seats", time: "26 min ago", logo: <RaycastMark />, verified: true },
  { id: "mateo", name: "Mateo", action: "invited 6 teammates", meta: "Buenos Aires", time: "30 min ago", avatar: avatar("mateo-alvarez") },
  { id: "resend", name: "Resend", action: "renewed Enterprise", meta: "Annual plan", time: "34 min ago", logo: <ResendMark />, verified: true },
];
