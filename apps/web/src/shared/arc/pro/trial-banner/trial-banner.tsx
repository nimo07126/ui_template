"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { AlarmClock, AlertCircle, Check, Lock, Users, X } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Button } from "../../button/button";
import { LinearMark, OktaMark, SlackMark } from "./trial-banner-marks";
import styles from "./trial-banner.module.css";

export { LinearMark, OktaMark, SlackMark } from "./trial-banner-marks";

export type TrialBannerVariant = "banner" | "card" | "pill";
/** active: plenty of time. warning: the last `warnAt` days. expired: the trial is over. upgraded: a payment method was added. */
export type TrialTone = "active" | "warning" | "expired" | "upgraded";

export interface TrialFeature {
  id: string;
  /** What the customer keeps by paying, such as "Single sign-on with Okta". */
  label: string;
  /** Short right-aligned meta, such as "12 in use". */
  detail?: string;
  /** A 14px mark or icon. */
  icon?: ReactNode;
}

export interface TrialSnooze {
  id: "tomorrow" | "3-days" | "warning";
  label: string;
  /** Days from now until the banner should come back. */
  days: number;
}

export interface TrialBannerProps {
  /** banner: a slim row for the top of an app. card: a sidebar card with the feature list. pill: a compact header pill that opens the card. */
  variant?: TrialBannerVariant;
  /** The plan being trialed. Defaults to "Pro". */
  plan?: string;
  /** Whole days left. 0 or less shows the expired state. Defaults to 9. */
  daysLeft?: number;
  /** Length of the trial in days, for the ring. Defaults to 14. */
  trialDays?: number;
  /** When the trial ends, for the date copy. Defaults to October 27, 2026 plus daysLeft (a sample date). */
  endsAt?: Date | number | string;
  /** The last N days use the warning tone. Defaults to 3. */
  warnAt?: number;
  /** The workspace name, used in the expired card copy. */
  workspace?: string;
  /** What the customer loses without paying, listed in the card. */
  features?: TrialFeature[];
  /** One short phrase for the banner copy, such as "Okta SSO and 12 seats". */
  lossSummary?: string;
  /** Opens checkout or the billing portal. Resolve when a payment method is on file to show the upgraded state; throw to show the error state. Simulated when left out. */
  onAddPayment?: (signal: AbortSignal) => Promise<void> | void;
  onComparePlans?: () => void;
  /** The secondary action in the upgraded state. */
  onManageBilling?: () => void;
  /** Called when the person dismisses the banner. Persist it so it stays hidden. */
  onDismiss?: () => void;
  /** Called with the chosen snooze. Persist `until` and stop rendering the banner until then. */
  onSnooze?: (snooze: TrialSnooze & { until: Date }) => void;
  /** After dismiss or snooze: collapse to the trial pill (default) or render nothing. */
  collapseTo?: "pill" | "none";
  dismissible?: boolean;
  snoozable?: boolean;
  className?: string;
}

type Phase = "idle" | "adding" | "error" | "added";

const DAY = 86_400_000;
const SAMPLE_NOW = Date.UTC(2026, 9, 27);
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const ring = { type: "spring", visualDuration: .24, bounce: 0 } as const;
const shortDate = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const weekday = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const cx = (...names: (string | false | undefined)[]) => names.filter(Boolean).join(" ");

const defaultFeatures: TrialFeature[] = [
  { id: "sso", label: "Single sign-on with Okta", icon: <OktaMark /> },
  { id: "slack", label: "Slack alerts", detail: "4 channels", icon: <SlackMark /> },
  { id: "linear", label: "Linear issue sync", detail: "148 issues", icon: <LinearMark /> },
  { id: "seats", label: "Team seats", detail: "12 in use", icon: <Users size={14} strokeWidth={1.8} /> },
];

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { window.clearTimeout(id); reject(signal.reason); }, { once: true });
  });
}

/**
 * A trial status banner for SaaS apps: days left with a ring countdown, what the customer loses, and the upgrade path.
 * Three variants (slim banner, sidebar card, header pill), a warning tone for the last days, an expired state, and
 * dismiss and snooze that collapse it into the pill. With no props it shows a simulated 14 day Pro trial.
 */
export function TrialBanner({
  variant = "banner", plan = "Pro", daysLeft = 9, trialDays = 14, endsAt, warnAt = 3, workspace = "Northwind",
  features = defaultFeatures, lossSummary = "Okta SSO and 12 seats", onAddPayment, onComparePlans, onManageBilling,
  onDismiss, onSnooze, collapseTo = "pill", dismissible = true, snoozable = true, className,
}: TrialBannerProps) {
  const reduced = !!useReducedMotion();
  const [phase, setPhase] = useState<Phase>("idle");
  const [collapsed, setCollapsed] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const abort = useRef<AbortController | null>(null);
  const flashTimer = useRef(0);
  const pillRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const focusAfter = useRef<"pill" | "primary" | null>(null);

  useEffect(() => () => { abort.current?.abort(); window.clearTimeout(flashTimer.current); }, []);

  const days = Math.max(0, Math.ceil(daysLeft));
  const end = endsAt !== undefined ? new Date(endsAt) : new Date(SAMPLE_NOW + days * DAY);
  const tone: TrialTone = phase === "added" ? "upgraded" : days <= 0 ? "expired" : days <= warnAt ? "warning" : "active";
  const progress = tone === "upgraded" ? 1 : tone === "expired" ? 0 : Math.min(1, days / Math.max(1, trialDays));
  const endShort = shortDate.format(end), endDate = monthDay.format(end), endDay = weekday.format(end);

  const copy = {
    active: { title: `${plural(days, "day")} left in your ${plan} trial`, sub: `Keep ${lossSummary} after ${endDate}.`, meta: `Trial ends ${endShort}`, list: "Add a card to keep", pill: `${plural(days, "day")} left` },
    warning: { title: days === 1 ? `Your ${plan} trial ends tomorrow` : `Your ${plan} trial ends in ${plural(days, "day")}`, sub: `On ${endDay} you lose ${lossSummary}.`, meta: `Ends ${endShort}`, list: `You lose these on ${endDay}`, pill: `${plural(days, "day")} left` },
    expired: { title: `Your ${plan} trial has ended`, sub: `${lossSummary[0]?.toUpperCase() ?? ""}${lossSummary.slice(1)} are paused on Free.`, meta: `Ended ${endShort}`, list: `Paused while ${workspace} is on Free`, pill: "Trial ended" },
    upgraded: { title: `You're all set on ${plan}`, sub: `Payment method added. Billing starts ${endDate}.`, meta: `Billing starts ${endShort}`, list: `Staying on ${plan}`, pill: `${plan} active` },
  }[tone];
  const error = phase === "error" ? "Billing didn't open. Check your connection and try again." : null;
  const sub = flash ?? error ?? copy.sub;
  const primaryLabel = tone === "upgraded" ? "Done" : phase === "error" ? "Try again" : tone === "expired" ? `Upgrade to ${plan}` : "Add payment method";
  const secondaryLabel = tone === "upgraded" ? "Manage billing" : "Compare plans";

  const snoozes: TrialSnooze[] = [{ id: "tomorrow", label: "Remind me tomorrow", days: 1 }];
  if (tone === "active" && days > 3) snoozes.push({ id: "3-days", label: "Remind me in 3 days", days: 3 });
  if (tone === "active" && days > warnAt + 1) snoozes.push({ id: "warning", label: `Remind me when ${plural(warnAt, "day")} are left`, days: days - warnAt });

  useLayoutEffect(() => {
    const target = focusAfter.current;
    if (!target) return;
    focusAfter.current = null;
    (target === "pill" ? pillRef : primaryRef).current?.focus();
  });

  const showFlash = useCallback((text: string) => {
    window.clearTimeout(flashTimer.current);
    setFlash(text);
    flashTimer.current = window.setTimeout(() => setFlash(null), 2200);
  }, []);

  const collapse = (message: string) => {
    setPopoverOpen(false);
    setFlash(null);
    setNotice(message);
    if (variant !== "pill") { setCollapsed(true); focusAfter.current = collapseTo === "pill" ? "pill" : null; }
  };

  const dismiss = () => {
    onDismiss?.();
    collapse(onDismiss ? "Trial banner hidden." : "Trial banner hidden. Simulated, nothing was saved.");
  };

  const snooze = (option: TrialSnooze) => {
    const until = new Date(SAMPLE_NOW + option.days * DAY);
    onSnooze?.({ ...option, until });
    collapse(`Snoozed until ${shortDate.format(until)}.${onSnooze ? "" : " Simulated, nothing was saved."}`);
  };

  const addPayment = async () => {
    if (phase === "adding") return;
    if (tone === "upgraded") { dismiss(); return; }
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setFlash(null);
    setPhase("adding");
    setNotice(onAddPayment ? "Opening billing." : "Opening billing. Simulated, no card is charged.");
    try {
      if (onAddPayment) await onAddPayment(controller.signal);
      else await wait(900, controller.signal);
      if (controller.signal.aborted) return;
      setPhase("added");
      setNotice(onAddPayment ? `Payment method added. You stay on ${plan}.` : `Payment method added. You stay on ${plan}. Simulated, no card was charged.`);
    } catch {
      if (controller.signal.aborted) return;
      setPhase("error");
      setNotice("Billing didn't open. Try again.");
    }
  };

  const secondary = () => {
    if (tone === "upgraded") {
      if (onManageBilling) onManageBilling();
      else showFlash("Simulated: this opens your billing settings.");
      return;
    }
    if (onComparePlans) onComparePlans();
    else showFlash("Simulated: this opens your plans page.");
  };

  const expand = () => { setCollapsed(false); setNotice(""); focusAfter.current = "primary"; };

  const ringNode = (size: number, stroke: number, centered: boolean) => <Ring size={size} stroke={stroke} progress={progress} tone={tone} reduced={reduced}>
    {centered && <Swap id={tone === "upgraded" ? "check" : tone === "expired" ? "lock" : String(days)} reduced={reduced} className={styles.ringCenter}>
      {tone === "upgraded" ? <Check size={14} strokeWidth={2} /> : tone === "expired" ? <Lock size={14} strokeWidth={1.8} /> : <span className={styles.ringDays}>{days}</span>}
    </Swap>}
  </Ring>;

  const iconControls = <span className={styles.icons}>
    {snoozable && <SnoozeMenu options={snoozes} onSelect={snooze} />}
    {dismissible && <button type="button" className={styles.iconButton} aria-label="Dismiss" onClick={dismiss}><X size={16} strokeWidth={1.8} aria-hidden="true" /></button>}
  </span>;

  const subLine = (className: string) => <Swap id={sub} reduced={reduced} className={className}>
    <span className={styles.subInner}>{error && !flash && <AlertCircle className={styles.errorIcon} size={14} strokeWidth={1.8} aria-hidden="true" />}<span className={styles.subText}>{sub}</span></span>
  </Swap>;

  const secondaryButton = (size: "sm" | "md") => <Button variant="ghost" size={size} onClick={secondary}>{secondaryLabel}</Button>;
  const primaryButton = (size: "sm" | "md") => <Button ref={primaryRef as Ref<HTMLButtonElement>} variant="primary" size={size} loading={phase === "adding"} onClick={addPayment}>{primaryLabel}</Button>;

  const card = (inPopover: boolean) => <div className={cx(styles.card, inPopover && styles.cardFloating)} data-tone={tone}>
    <div className={styles.cardHead}>
      {ringNode(40, 3, true)}
      {!inPopover && iconControls}
      {inPopover && <span className={styles.icons}>{snoozable && <SnoozeMenu options={snoozes} onSelect={snooze} />}<PopoverPrimitive.Close className={styles.iconButton} aria-label="Close"><X size={16} strokeWidth={1.8} aria-hidden="true" /></PopoverPrimitive.Close></span>}
    </div>
    <Swap id={copy.title} reduced={reduced} className={styles.cardTitle}><span className={styles.truncate}>{copy.title}</span></Swap>
    {flash || error ? subLine(styles.cardMeta) : <Swap id={copy.meta} reduced={reduced} className={styles.cardMeta}><span className={styles.truncate}>{copy.meta}</span></Swap>}
    <div className={styles.list}>
      <Swap id={copy.list} reduced={reduced} className={styles.listLabel}><span className={styles.truncate}>{copy.list}</span></Swap>
      <ul className={styles.rows}>
        {features.map(feature => <li key={feature.id} className={styles.row}>
          <span className={styles.rowIcon} aria-hidden="true">{feature.icon}</span>
          <span className={styles.rowLabel}>{feature.label}</span>
          {feature.detail && <span className={styles.rowDetail}>{feature.detail}</span>}
          <Swap id={tone} reduced={reduced} className={styles.rowState}>
            {tone === "expired" ? <Lock size={14} strokeWidth={1.8} aria-label="Paused" /> : tone === "upgraded" ? <Check size={14} strokeWidth={2} aria-label="Kept" /> : <span />}
          </Swap>
        </li>)}
      </ul>
    </div>
    <div className={styles.cardActions}>{primaryButton("md")}{secondaryButton("md")}</div>
  </div>;

  const pillButton = (props: Record<string, unknown> = {}) => <button ref={pillRef} type="button" className={styles.pill} data-tone={tone} {...props}
    aria-label={`${plan} trial: ${copy.pill}${collapsed ? ". Show details" : ""}`}>
    <Swap id={tone === "expired" ? "lock" : tone === "upgraded" ? "check" : "ring"} reduced={reduced} className={styles.pillLead}>
      {tone === "expired" ? <Lock size={14} strokeWidth={1.8} /> : tone === "upgraded" ? <Check size={14} strokeWidth={2} /> : <Ring size={16} stroke={2} progress={progress} tone={tone} reduced={reduced} />}
    </Swap>
    <MorphText text={copy.pill} reduced={reduced} />
  </button>;

  let view: ReactNode;
  let viewKey: string = variant;
  if (variant === "pill") {
    view = <PopoverPrimitive.Root open={popoverOpen} onOpenChange={setPopoverOpen}>
      <PopoverPrimitive.Trigger asChild>{pillButton()}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className={styles.popover} side="bottom" align="start" sideOffset={8} collisionPadding={12} aria-label={`${plan} trial`}>{card(true)}</PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>;
  } else if (collapsed) {
    viewKey = "collapsed";
    view = collapseTo === "pill" ? pillButton({ onClick: expand }) : null;
  } else if (variant === "card") {
    view = <section aria-label={`${plan} trial`}>{card(false)}</section>;
  } else {
    view = <section className={styles.banner} data-tone={tone} aria-label={`${plan} trial`}>
      <span className={styles.bannerRing}>{ringNode(28, 2.5, true)}</span>
      <div className={styles.bannerText}>
        <Swap id={copy.title} reduced={reduced} className={styles.bannerTitle}><span className={styles.truncate}>{copy.title}</span></Swap>
        {subLine(styles.bannerSub)}
      </div>
      <div className={styles.bannerActions}>{secondaryButton("sm")}{primaryButton("sm")}</div>
      {iconControls}
    </section>;
  }

  return <div className={cx(styles.root, variant === "pill" ? styles.isPill : variant === "card" ? styles.isCard : styles.isBanner, className)}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={viewKey} className={styles.view} initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1, transition: { duration: reduced ? 0 : .16, ease } }} exit={{ opacity: 0, transition: { duration: reduced ? 0 : .1, ease } }}>
        {view}
      </motion.div>
    </AnimatePresence>
    <span className={styles.srOnly} role="status" aria-live="polite">{notice}</span>
  </div>;
}

/** A countdown ring. The arc springs to its new length without overshoot; color follows the tone. */
function Ring({ size, stroke, progress, tone, reduced, children }: { size: number; stroke: number; progress: number; tone: TrialTone; reduced: boolean; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = size / 2;
  return <span className={styles.ring} data-tone={tone} style={{ width: size, height: size }} aria-hidden="true">
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.ringSvg}>
      <circle className={styles.ringTrack} cx={c} cy={c} r={r} strokeWidth={stroke} fill="none" />
      <motion.circle className={styles.ringValue} cx={c} cy={c} r={r} strokeWidth={stroke} fill="none" pathLength={1} strokeDasharray="1 1" strokeLinecap="round"
        initial={false} animate={{ strokeDashoffset: 1 - progress, opacity: progress > 0 ? 1 : 0 }} transition={reduced ? { duration: 0 } : { strokeDashoffset: ring, opacity: { duration: .16, ease } }} />
    </svg>
    {children}
  </span>;
}

/** One crossfade per change: the old content leaves in 100ms, the new one fades in over 160ms with a 2px rise. Both share one grid cell, so nothing shifts. */
function Swap({ id, children, className, reduced }: { id: string; children: ReactNode; className?: string; reduced: boolean }) {
  return <span className={cx(styles.swap, className)}>
    <AnimatePresence initial={false}>
      <motion.span key={id} className={styles.swapItem} initial={reduced ? false : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : .16, ease } }} exit={{ opacity: 0, y: 0, transition: { duration: reduced ? 0 : .1, ease } }}>
        {children}
      </motion.span>
    </AnimatePresence>
  </span>;
}

/** The pill label: width springs to the measured text (no bounce) while the text crossfades. First paint and font swaps settle instantly. */
function MorphText({ text, reduced }: { text: string; reduced: boolean }) {
  const measure = useRef<HTMLSpanElement>(null);
  const last = useRef<string | null>(null);
  const [size, setSize] = useState<{ width: number | "auto"; animate: boolean }>({ width: "auto", animate: false });
  useLayoutEffect(() => {
    const node = measure.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const current = node.textContent;
      const animate = last.current !== null && last.current !== current;
      last.current = current;
      setSize({ width: Math.ceil(node.getBoundingClientRect().width), animate });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <motion.span className={styles.pillLabel} initial={false} animate={{ width: size.width }} transition={size.animate && !reduced ? ring : { duration: 0 }}>
    <span ref={measure} className={styles.pillMeasure} aria-hidden="true">{text}</span>
    <Swap id={text} reduced={reduced}><span className={styles.truncate}>{text}</span></Swap>
  </motion.span>;
}

function SnoozeMenu({ options, onSelect }: { options: TrialSnooze[]; onSelect: (option: TrialSnooze) => void }) {
  return <DropdownPrimitive.Root modal={false}>
    <DropdownPrimitive.Trigger className={styles.iconButton} aria-label="Snooze"><AlarmClock size={16} strokeWidth={1.8} aria-hidden="true" /></DropdownPrimitive.Trigger>
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content className={styles.menu} align="end" sideOffset={6} collisionPadding={12} loop>
        {options.map(option => <DropdownPrimitive.Item key={option.id} className={styles.menuItem} onSelect={() => onSelect(option)}>{option.label}</DropdownPrimitive.Item>)}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  </DropdownPrimitive.Root>;
}

export default TrialBanner;
