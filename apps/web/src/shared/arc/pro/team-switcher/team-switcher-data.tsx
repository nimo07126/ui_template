import type { ReactNode } from "react";
import { FigmaMark, LinearMark, NotionMark, RaycastMark, ResendMark, StripeMark, SupabaseMark, VercelMark } from "./team-switcher-marks";

export interface Workspace {
  id: string;
  name: string;
  /** Plan name shown under the name, such as "Enterprise". */
  plan?: string;
  /** Member count, shown as "214 members". */
  members?: number;
  /** Your role in this workspace, such as "Owner" or "Guest". */
  role?: string;
  /** The mark drawn inside the tile. Size it in em: the tile sets font-size to its own size. Falls back to the first letter. */
  logo?: ReactNode;
  /** Tile background and mark color. Defaults to the foreground color with a background-colored letter. */
  tile?: { background: string; color?: string };
}

const mark = (size: number, extra?: { y?: number }) => ({ width: `${size}em`, height: `${size}em`, transform: extra?.y ? `translateY(${extra.y}em)` : undefined });

/** Sample workspaces. Real brand marks; plans, roles and member counts are illustrative samples. */
export const sampleWorkspaces: Workspace[] = [
  { id: "linear", name: "Linear", plan: "Enterprise", members: 214, role: "Admin", tile: { background: "#5E6AD2", color: "#fff" }, logo: <LinearMark style={mark(.52)} /> },
  { id: "vercel", name: "Vercel", plan: "Pro", members: 38, role: "Owner", tile: { background: "#000", color: "#fff" }, logo: <VercelMark style={mark(.5, { y: -.02 })} /> },
  { id: "stripe", name: "Stripe", plan: "Enterprise", members: 1240, role: "Member", tile: { background: "#635BFF", color: "#fff" }, logo: <StripeMark style={mark(.48)} /> },
  { id: "figma", name: "Figma", plan: "Organization", members: 96, role: "Member", tile: { background: "#1E1E1E" }, logo: <FigmaMark style={{ height: ".56em", width: ".373em" }} /> },
  { id: "supabase", name: "Supabase", plan: "Team", members: 52, role: "Billing", tile: { background: "#1C1C1C", color: "#3ECF8E" }, logo: <SupabaseMark style={mark(.5)} /> },
  { id: "raycast", name: "Raycast", plan: "Pro", members: 24, role: "Guest", tile: { background: "#FF6363", color: "#fff" }, logo: <RaycastMark style={mark(.5)} /> },
];

/** Workspaces the simulated invites resolve to, keyed by invite link. */
export const sampleInvites: { link: string; workspace: Workspace }[] = [
  { link: "https://resend.com/invite/7HK2-QPLM", workspace: { id: "resend", name: "Resend", plan: "Pro", members: 18, role: "Member", tile: { background: "#000", color: "#fff" }, logo: <ResendMark style={mark(.44)} /> } },
  { link: "https://notion.so/invite/a91f-22cd", workspace: { id: "notion", name: "Notion", plan: "Business", members: 410, role: "Member", tile: { background: "#fff", color: "#000" }, logo: <NotionMark style={mark(.54)} /> } },
];
