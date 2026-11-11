"use client";

import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Check, CircleAlert, CircleCheck, Gift, Mail, UserRoundCheck, X } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { Tooltip } from "../../tooltip/tooltip";
import { LinkedInMark, XMark } from "./referral-card-marks";
import { sampleLink, sampleReferrals, sampleScript } from "./referral-card-data";
import styles from "./referral-card.module.css";

export type ReferralStage = "invited" | "signed-up" | "earned";
export type ReferralChannel = "x" | "linkedin" | "email";

export interface Referral {
  id: string;
  /** Shown as the row title. Leave unset for someone who has not signed up yet; the email is shown instead. */
  name?: string;
  email: string;
  /** Portrait URL. Initials are shown without one. */
  avatar?: string;
  stage: ReferralStage;
  /** ISO date the invite went out. */
  invitedAt: string;
}

export interface ReferralMilestone {
  /** Paid referrals needed to unlock the reward. */
  goal: number;
  /** The reward in a few words, for example "3 months free". */
  reward: string;
  /** One line shown once it is unlocked. */
  detail?: string;
}

export interface ReferralCardProps {
  /** The person's invite link. */
  link?: string;
  /** Credit each side gets, in whole currency units. */
  reward?: number;
  /** ISO currency code for the reward and the earned total. */
  currency?: string;
  /** Heading. Defaults to "Give $20, get $20". */
  title?: string;
  description?: string;
  /** Everyone invited so far, newest first. Leave unset for the simulated demo. */
  referrals?: Referral[];
  milestone?: ReferralMilestone;
  /** Text that goes with the link when it is shared. */
  shareMessage?: string;
  /** Most addresses one send can hold. */
  maxInvites?: number;
  /** Plays the sample program (friends signing up and subscribing). Defaults to true when `referrals` is unset. */
  simulate?: boolean;
  onCopy?: (link: string) => void;
  /** Called with the channel and a ready share URL (X intent, LinkedIn share, mailto). Open it in a new window. Without it, sharing is simulated. */
  onShare?: (channel: ReferralChannel, url: string) => void;
  /** Send the invites. Return a promise to keep the button loading; a rejection keeps the addresses and shows the error. Without it, sending is simulated. */
  onInvite?: (emails: string[], options: { signal: AbortSignal }) => void | Promise<unknown>;
  /** Called once when paid referrals reach the milestone goal. */
  onMilestone?: (milestone: ReferralMilestone) => void;
  className?: string;
}

const defaultMilestone: ReferralMilestone = { goal: 5, reward: "3 months free", detail: "Applied to your next invoice" };
const emailPattern = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const ease = [.22, 1, .36, 1] as const;
const show = { duration: .16, ease } as const;
const hide = { duration: .1, ease } as const;
const instant = { duration: 0 } as const;
/** Row height in px; matches --row in the stylesheet. */
const ROW = 52;
const settle = { type: "spring", visualDuration: .24, bounce: 0 } as const;

/** Builds the share URL for one channel: an X post intent, a LinkedIn share, or a mailto with subject and body. */
export function referralShareUrl(channel: ReferralChannel, link: string, message: string) {
  const text = encodeURIComponent(message);
  const url = encodeURIComponent(link);
  if (channel === "x") return `https://x.com/intent/post?text=${text}&url=${url}`;
  if (channel === "linkedin") return `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
  return `mailto:?subject=${encodeURIComponent("An invite for you")}&body=${encodeURIComponent(`${message}\n\n${link}`)}`;
}

const channels: { id: ReferralChannel; label: string; done: string; icon: ReactNode }[] = [
  { id: "x", label: "Post on X", done: "Opened an X post draft", icon: <XMark size={14} /> },
  { id: "linkedin", label: "Share on LinkedIn", done: "Opened a LinkedIn share", icon: <LinkedInMark size={15} /> },
  { id: "email", label: "Share by email", done: "Opened an email draft", icon: <Mail size={16} strokeWidth={1.75} /> },
];

const stageMeta: Record<ReferralStage, { label: (amount: string) => string; icon: ReactNode }> = {
  invited: { label: () => "Invited", icon: <Mail size={14} strokeWidth={1.75} /> },
  "signed-up": { label: () => "Signed up", icon: <UserRoundCheck size={14} strokeWidth={1.75} /> },
  earned: { label: amount => `Earned ${amount}`, icon: <CircleCheck size={14} strokeWidth={1.75} /> },
};

function formatDate(iso: string) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  // Invites sent from this card read "just now" rather than a date that can roll over in UTC.
  if (typeof window !== "undefined" && Date.now() - time >= 0 && Date.now() - time < 3_600_000) return "just now";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(time);
}

/** A number that rolls to its new value in tabular numerals. Motion writes the text, so React never fights the tween. */
function Rolling({ value, format, reduced }: { value: number; format: (value: number) => string; reduced: boolean }) {
  const count = useMotionValue(value);
  const text = useTransform(count, latest => format(Math.round(latest)));
  useEffect(() => {
    if (reduced) { count.set(value); return; }
    const controls = animate(count, value, { duration: .6, ease });
    return () => controls.stop();
  }, [count, value, reduced]);
  return <motion.span>{text}</motion.span>;
}

/** One crossfade per swap: old out fast, new in with a 2px rise. Both sit in the same grid cell, so nothing shifts. */
function Swap({ id, reduced, className, children }: { id: string; reduced: boolean; className?: string; children: ReactNode }) {
  return <span className={[styles.swap, className].filter(Boolean).join(" ")}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem} initial={reduced ? { opacity: 0 } : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>{children}</motion.span>
    </AnimatePresence>
  </span>;
}

type Hint = { tone: "idle" | "error" | "success"; text: string };
const idleHint: Hint = { tone: "idle", text: "Press Enter after each address" };

export function ReferralCard({
  link = sampleLink,
  reward = 20,
  currency = "USD",
  title,
  description,
  referrals,
  milestone = defaultMilestone,
  shareMessage = "I use Northwind to run our team's planning. Here is $20 off your first month.",
  maxInvites = 10,
  simulate,
  onCopy,
  onShare,
  onInvite,
  onMilestone,
  className,
}: ReferralCardProps) {
  const reduced = useReducedMotion() ?? false;
  const simulating = simulate ?? referrals === undefined;
  const money = useCallback((value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value), [currency]);
  const amount = money(reward);
  const heading = title ?? `Give ${amount}, get ${amount}`;
  const body = description ?? `Friends get ${amount} off their first month. You get ${amount} in credit for each friend who subscribes.`;

  // The list follows the prop when it changes; local sends and the simulation add to it in between.
  const [list, setList] = useState<Referral[]>(referrals ?? sampleReferrals);
  const [source, setSource] = useState(referrals);
  if (referrals !== source) { setSource(referrals); if (referrals) setList(referrals); }

  const invited = list.length;
  const signedUp = list.filter(item => item.stage !== "invited").length;
  const paid = list.filter(item => item.stage === "earned").length;
  const goal = Math.max(1, milestone.goal);
  const unlocked = paid >= goal;
  const remaining = Math.max(0, goal - paid);

  const root = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);
  const advance = useCallback((id: string, stage: ReferralStage, delay: number) => {
    timers.current.push(window.setTimeout(() => setList(current => current.map(item => item.id === id ? { ...item, stage } : item)), delay));
  }, []);
  useEffect(() => () => { timers.current.forEach(window.clearTimeout); timers.current = []; }, []);

  // The sample program plays once, starting the first time the card is on screen.
  const started = useRef(false);
  useEffect(() => {
    if (!simulating || referrals !== undefined || started.current) return;
    const node = root.current;
    const start = () => { if (started.current) return; started.current = true; sampleScript.forEach(step => advance(step.id, step.stage, reduced ? step.at / 2 : step.at)); };
    if (!node || typeof IntersectionObserver === "undefined") { start(); return; }
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { start(); observer.disconnect(); } }, { threshold: .4 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [simulating, referrals, advance, reduced]);

  const fired = useRef(unlocked);
  useEffect(() => {
    if (unlocked && !fired.current) { fired.current = true; onMilestone?.(milestone); }
    if (!unlocked) fired.current = false;
  }, [unlocked, milestone, onMilestone]);

  // Share: the button's icon turns into a check for a moment; the live region says what happened.
  const [shared, setShared] = useState<ReferralChannel | null>(null);
  const [announce, setAnnounce] = useState("");
  const shareTimer = useRef<number>(undefined);
  function share(channel: ReferralChannel) {
    const entry = channels.find(item => item.id === channel)!;
    const url = referralShareUrl(channel, link, shareMessage);
    if (onShare) { onShare(channel, url); setAnnounce(`${entry.done}.`); }
    else setAnnounce(`${entry.done}. Simulated, nothing was posted.`);
    setShared(channel);
    window.clearTimeout(shareTimer.current);
    shareTimer.current = window.setTimeout(() => setShared(null), 1600);
  }
  useEffect(() => () => window.clearTimeout(shareTimer.current), []);

  // Invite by email.
  const [chips, setChips] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [hint, setHint] = useState<Hint>(idleHint);
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const hintTimer = useRef<number>(undefined);
  useEffect(() => () => { abort.current?.abort(); window.clearTimeout(hintTimer.current); }, []);
  const hintId = useId();

  function flash(next: Hint, ms = 0) {
    window.clearTimeout(hintTimer.current);
    setHint(next);
    if (ms) hintTimer.current = window.setTimeout(() => setHint(idleHint), ms);
  }

  /** Adds every valid address in `raw`. Returns the chips after adding, or null when something was refused. */
  function commit(raw: string): string[] | null {
    const parts = raw.split(/[\s,;]+/).map(part => part.trim().toLowerCase()).filter(Boolean);
    if (!parts.length) return chips;
    const next = [...chips];
    for (const part of parts) {
      if (!emailPattern.test(part)) { setDraft(part); flash({ tone: "error", text: `${part} is not a full email address` }); return null; }
      if (next.includes(part)) continue;
      if (list.some(item => item.email.toLowerCase() === part)) { setDraft(part); flash({ tone: "error", text: `${part} was already invited` }); return null; }
      if (next.length >= maxInvites) { setDraft(""); setChips(next); flash({ tone: "error", text: `Up to ${maxInvites} addresses per send` }); return null; }
      next.push(part);
    }
    setChips(next);
    setDraft("");
    if (hint.tone === "error") flash(idleHint);
    requestAnimationFrame(() => { const node = track.current; if (node) node.scrollLeft = node.scrollWidth; });
    return next;
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === "," || event.key === ";" || (event.key === " " && draft) || (event.key === "Tab" && draft.trim() && !event.shiftKey)) {
      if (event.key === "Enter" && !draft.trim()) { event.preventDefault(); if (chips.length) void send(); return; }
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && !draft && chips.length) {
      event.preventDefault();
      setChips(chips.slice(0, -1));
    }
  }

  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    const text = event.clipboardData.getData("text");
    if (!/[\s,;]/.test(text.trim())) return;
    event.preventDefault();
    commit(`${draft} ${text}`);
  }

  function remove(email: string) {
    setChips(current => current.filter(item => item !== email));
    input.current?.focus();
  }

  async function send() {
    if (sending) return;
    const emails = draft.trim() ? commit(draft) : chips;
    if (!emails) return;
    if (!emails.length) { flash({ tone: "error", text: "Add at least one email address" }); input.current?.focus(); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setSending(true);
    flash(idleHint);
    try {
      if (onInvite) await onInvite(emails, { signal: controller.signal });
      else await new Promise(resolve => setTimeout(resolve, 700));
      if (controller.signal.aborted) return;
      const now = new Date().toISOString();
      const added = emails.map((email, index) => ({ id: `invite-${Date.now()}-${index}`, email, stage: "invited" as const, invitedAt: now }));
      setList(current => [...added, ...current]);
      setChips([]);
      const count = `${emails.length} invite${emails.length === 1 ? "" : "s"}`;
      flash({ tone: "success", text: onInvite ? `Sent ${count}` : `Sent ${count}. Simulated, nothing was sent.` }, 4200);
      if (simulating) { advance(added[0].id, "signed-up", 2600); advance(added[0].id, "earned", 4600); }
    } catch (error) {
      if (controller.signal.aborted) return;
      flash({ tone: "error", text: error instanceof Error && error.message ? error.message : "Could not send the invites. Try again." });
    } finally {
      if (!controller.signal.aborted) setSending(false);
    }
  }

  const display = link.replace(/^https?:\/\//, "");
  const cut = display.lastIndexOf("/") + 1;
  const segments = Math.min(goal, 12);
  const filled = Math.min(paid, goal) / goal * segments;

  return <div ref={root} className={[styles.root, className].filter(Boolean).join(" ")}>
    <div className={styles.card}>
      <header className={styles.header}>
        <h3 className={styles.title}>{heading}</h3>
        <p className={styles.description}>{body}</p>
      </header>

      <div className={styles.actions}>
        <div className={styles.linkRow}>
          <div className={styles.linkField}>
            <span className={styles.linkText} title={link}><span className={styles.linkBase}>{display.slice(0, cut)}</span>{display.slice(cut)}</span>
            <CopyButton value={link} label="Copy" variant="plain" className={styles.copy} onCopied={() => onCopy?.(link)} />
          </div>
          <div className={styles.shareGroup} role="group" aria-label="Share your link">
            {channels.map(channel => <Tooltip key={channel.id} content={channel.label}>
              <button type="button" className={styles.share} aria-label={channel.label} onClick={() => share(channel.id)} data-done={shared === channel.id || undefined}>
                <Swap id={shared === channel.id ? "done" : "idle"} reduced={reduced} className={styles.shareIcon}>
                  {shared === channel.id ? <Check size={16} strokeWidth={1.75} /> : channel.icon}
                </Swap>
              </button>
            </Tooltip>)}
          </div>
        </div>

        <div className={styles.inviteRow}>
          <div className={styles.chipField} data-invalid={hint.tone === "error" || undefined} onMouseDown={event => { if (event.target === event.currentTarget || event.target === track.current) { event.preventDefault(); input.current?.focus(); } }}>
            <div ref={track} className={styles.chipTrack}>
              <AnimatePresence initial={false}>
                {chips.map(email => <motion.span key={email} className={styles.chip}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: .94 }} animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, transition: reduced ? instant : hide }} transition={reduced ? instant : show}>
                  <span className={styles.chipText}>{email}</span>
                  <button type="button" className={styles.chipRemove} aria-label={`Remove ${email}`} onClick={() => remove(email)} disabled={sending}><X size={12} strokeWidth={2} /></button>
                </motion.span>)}
              </AnimatePresence>
              <input
                ref={input}
                className={styles.chipInput}
                type="email"
                inputMode="email"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                placeholder={chips.length ? "" : "Invite by email"}
                aria-label="Invite by email"
                aria-describedby={hintId}
                aria-invalid={hint.tone === "error" || undefined}
                readOnly={sending}
                onChange={event => { setDraft(event.target.value); if (hint.tone === "error") flash(idleHint); }}
                onKeyDown={onKeyDown}
                onPaste={onPaste}
                onBlur={() => { if (draft.trim() && emailPattern.test(draft.trim())) commit(draft); }}
              />
            </div>
          </div>
          <Button size="md" className={styles.send} loading={sending} onClick={() => void send()}>Send</Button>
        </div>
        <p id={hintId} className={styles.hint} data-tone={hint.tone} role="status" aria-live="polite">
          <Swap id={`${hint.tone}:${hint.text}`} reduced={reduced}>
            {hint.tone !== "idle" && <span className={styles.hintIcon}>{hint.tone === "error" ? <CircleAlert size={14} strokeWidth={1.75} /> : <CircleCheck size={14} strokeWidth={1.75} />}</span>}
            <span className={styles.hintText}>{hint.text}</span>
          </Swap>
        </p>
      </div>

      <div className={styles.progress}>
        <dl className={styles.stats}>
          <div className={styles.stat}><dt>Invited</dt><dd><Rolling value={invited} format={String} reduced={reduced} /></dd></div>
          <div className={styles.stat}><dt>Signed up</dt><dd><Rolling value={signedUp} format={String} reduced={reduced} /></dd></div>
          <div className={styles.stat}><dt>Earned</dt><dd><Rolling value={paid * reward} format={money} reduced={reduced} /></dd></div>
        </dl>

        <div className={styles.milestone} data-unlocked={unlocked || undefined}>
          <div className={styles.milestoneHead}>
            <Swap id={unlocked ? "unlocked" : `left-${remaining}`} reduced={reduced} className={styles.milestoneText}>
              <span className={styles.milestoneIcon}>{unlocked ? <CircleCheck size={16} strokeWidth={1.75} /> : <Gift size={16} strokeWidth={1.75} />}</span>
              <span className={styles.milestoneCopy}>
                {unlocked
                  ? <><span className={styles.milestoneStrong}>{milestone.reward} unlocked</span>{milestone.detail && <span className={styles.milestoneDetail}>{milestone.detail}</span>}</>
                  : <span>{remaining} more paid referral{remaining === 1 ? "" : "s"} to unlock {milestone.reward}</span>}
              </span>
            </Swap>
            <span className={styles.milestoneCount}><Rolling value={Math.min(paid, goal)} format={String} reduced={reduced} /> of {goal}</span>
          </div>
          <div className={styles.segments} role="progressbar" aria-label="Milestone progress" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={Math.min(paid, goal)} aria-valuetext={unlocked ? `${milestone.reward} unlocked` : `${paid} of ${goal} paid referrals`}>
            {Array.from({ length: segments }, (_, index) => <span key={index} className={styles.segment}>
              <span className={styles.segmentFill} style={{ transform: `scaleX(${Math.max(0, Math.min(1, filled - index))})` }} />
            </span>)}
          </div>
        </div>

        <ul className={styles.list} aria-label="Referrals">
          {list.length === 0 && <li className={styles.empty}>No invites yet. Share your link or invite someone by email.</li>}
          <AnimatePresence initial={false}>
            {list.map(item => {
              const meta = stageMeta[item.stage];
              return <motion.li key={item.id} className={styles.item}
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: ROW }}
                exit={{ opacity: 0, height: 0 }} transition={reduced ? instant : { height: settle, opacity: show }}>
                <div className={styles.row}>
                  <Avatar name={item.name ?? item.email} src={item.avatar} size="sm" />
                  <div className={styles.who}>
                    <span className={styles.name}>{item.name ?? item.email}</span>
                    <span className={styles.meta}>{item.name ? <span className={styles.metaEmail}>{item.email}</span> : <span>Invited</span>}<span className={styles.metaDate}>{item.name ? "· " : ""}{formatDate(item.invitedAt)}</span></span>
                  </div>
                  <Swap id={item.stage} reduced={reduced} className={styles.stage}>
                    <span className={styles.stageInner} data-stage={item.stage}>{meta.icon}<span>{meta.label(amount)}</span></span>
                  </Swap>
                </div>
              </motion.li>;
            })}
          </AnimatePresence>
        </ul>
      </div>
    </div>
    <span className={styles.srOnly} role="status" aria-live="polite">{announce}</span>
  </div>;
}

export default ReferralCard;
