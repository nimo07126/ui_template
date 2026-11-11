"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";
import { Check, CircleAlert, CircleCheck, Clock } from "lucide-react";
import { Button } from "../../button/button";
import SegmentedControl from "../../segmented-control/segmented-control";
import { ClaudeMark, OpenaiMark } from "./upgrade-prompt-marks";
import styles from "./upgrade-prompt.module.css";

export type UpgradeInterval = "monthly" | "yearly";

export interface UpgradeFeature {
  id: string;
  /** One short line. Inline marks are welcome; keep it to one line at 360px. */
  label: ReactNode;
}

export interface UpgradeLimit {
  label: string;
  value: ReactNode;
}

export interface UpgradePlan {
  /** Plan name, used in the button and the success title. */
  name: string;
  /** Price per month for each billing interval. The yearly charge is 12 times the yearly figure. */
  price: { monthly: number; yearly: number };
  /** ISO 4217 code. Defaults to USD. */
  currency?: string;
  /** The new limit in the same unit as `limit`. The usage bar settles against it after the upgrade. */
  limit: number;
  /** Exactly what the plan unlocks. Three reads best. */
  features: UpgradeFeature[];
  /** The new limits listed after the upgrade. Three rows reads best. */
  limits: UpgradeLimit[];
}

export interface UpgradeSelection {
  plan: string;
  interval: UpgradeInterval;
  /** The amount charged today: the monthly price, or 12 times the yearly monthly price. */
  amount: number;
  currency: string;
}

export interface UpgradePromptProps {
  /** How much of the limit is used. */
  used?: number;
  /** The current plan's limit. */
  limit?: number;
  /** What is being counted, plural and lowercase after the first word, such as "AI credits". */
  unit?: string;
  /** When the free limit resets, shown in the copy, such as "Nov 1". */
  resetsOn?: string;
  /** The plan being offered. */
  plan?: UpgradePlan;
  /** Billing interval, controlled. */
  interval?: UpgradeInterval;
  /** Billing interval on mount when `interval` is left out. */
  defaultInterval?: UpgradeInterval;
  onIntervalChange?: (interval: UpgradeInterval) => void;
  /** Charges the selection. Resolve when the plan is active; reject with an Error and its message shows under the price. Aborted on unmount. Leave it out to simulate a 1.1s upgrade. */
  onUpgrade?: (selection: UpgradeSelection, signal: AbortSignal) => Promise<void>;
  /** Called once the upgrade succeeded. */
  onUpgraded?: (selection: UpgradeSelection) => void;
  /** Called by Maybe later. The card shows a calm reminder with a way back to the offer. */
  onDismiss?: () => void;
  /** Called by Continue on the success state. Leave it out and Continue resets the demo. */
  onContinue?: () => void;
  /** Replaces the limit title. */
  title?: ReactNode;
  /** Replaces the line under the limit title. */
  description?: ReactNode;
  className?: string;
}

type Phase = "offer" | "processing" | "error" | "upgraded" | "later";

const defaultPlan: UpgradePlan = {
  name: "Pro",
  price: { monthly: 20, yearly: 16 },
  currency: "USD",
  limit: 2000,
  features: [
    { id: "credits", label: <>2,000 AI credits a month</> },
    { id: "models", label: <><span className={styles.nowrap}><ClaudeMark className={styles.claude} aria-hidden="true" width={14} height={14} /> Claude Opus 5.5</span> and <span className={styles.nowrap}><OpenaiMark className={styles.openai} aria-hidden="true" width={14} height={14} /> GPT-6.1 Sol</span></> },
    { id: "queue", label: <>Priority queue with no daily caps</> },
  ],
  limits: [
    { label: "AI credits", value: "2,000 a month" },
    { label: "Models", value: <span className={styles.models}><ClaudeMark className={styles.claude} aria-hidden="true" width={14} height={14} />Opus 5.5<OpenaiMark className={styles.openai} aria-hidden="true" width={14} height={14} />GPT-6.1 Sol</span> },
    { label: "Queue", value: "Priority" },
  ],
};

const textIn = { duration: 0.16, ease: [0.16, 1, 0.3, 1], delay: 0.06 } as const;
const textOut = { duration: 0.1, ease: [0.7, 0, 0.84, 0] } as const;
const fillSpring = { type: "spring", visualDuration: 0.5, bounce: 0 } as const;
const digitSpring = { type: "spring", visualDuration: 0.28, bounce: 0 } as const;

function money(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 }).format(value);
}
const count = (value: number) => value.toLocaleString("en-US");

/** All variants share one grid cell, so the slot always holds the tallest and widest one and nothing shifts on a swap.
 *  The active one fades in 160ms with a 2px rise; the rest fade out in 100ms and leave the accessibility tree. */
function Swap({ active, items, reduced, className }: { active: string; items: Record<string, ReactNode>; reduced: boolean; className?: string }) {
  return <span className={`${styles.swap} ${className ?? ""}`}>
    {Object.entries(items).map(([key, node]) => {
      const on = key === active;
      return <motion.span key={key} className={styles.swapItem} aria-hidden={!on || undefined} initial={false}
        animate={on ? { opacity: 1, y: 0, visibility: "visible" } : { opacity: 0, y: reduced ? 0 : 2, transitionEnd: { visibility: "hidden" } }}
        transition={on ? (reduced ? { duration: 0.12 } : textIn) : textOut}>{node}</motion.span>;
    })}
  </span>;
}

/** Each digit is one strip of 0 to 9 that rolls to its value; places are keyed from the right so they keep their strip. */
function Rolling({ value, reduced }: { value: string; reduced: boolean }) {
  const chars = value.split("");
  return <span className={styles.rolling} aria-hidden="true">
    {chars.map((char, index) => {
      const place = chars.length - index;
      if (!/\d/.test(char)) return <span key={`c${place}`} className={styles.char}>{char}</span>;
      return <span key={`d${place}`} className={styles.digit}>
        <motion.span className={styles.strip} initial={false} animate={{ y: `${-Number(char) * 10}%` }} transition={reduced ? { duration: 0 } : digitSpring}>
          {Array.from({ length: 10 }, (_, digit) => <span key={digit}>{digit}</span>)}
        </motion.span>
      </span>;
    })}
  </span>;
}

/** The moment-of-value upgrade nudge: usage at the limit, what the next plan unlocks, the price with a billing toggle, and a success state with the new limits. */
export function UpgradePrompt({
  used = 50,
  limit = 50,
  unit = "AI credits",
  resetsOn = "Nov 1",
  plan = defaultPlan,
  interval: intervalProp,
  defaultInterval = "yearly",
  onIntervalChange,
  onUpgrade,
  onUpgraded,
  onDismiss,
  onContinue,
  title,
  description,
  className,
}: UpgradePromptProps) {
  const reduced = useReducedMotion() ?? false;
  const [phase, setPhase] = useState<Phase>("offer");
  const [error, setError] = useState("");
  const [announce, setAnnounce] = useState("");
  const [ownInterval, setOwnInterval] = useState<UpgradeInterval>(defaultInterval);
  const interval = intervalProp ?? ownInterval;
  const controller = useRef<AbortController | null>(null);
  const meter = useRef<HTMLDivElement>(null);
  const seen = useInView(meter, { once: true, amount: 0.6 });

  useEffect(() => () => controller.current?.abort(), []);

  const currency = plan.currency ?? "USD";
  const monthly = plan.price[interval];
  const amount = interval === "yearly" ? plan.price.yearly * 12 : plan.price.monthly;
  const saving = Math.round((1 - plan.price.yearly / plan.price.monthly) * 100);
  const selection = useMemo<UpgradeSelection>(() => ({ plan: plan.name, interval, amount, currency }), [plan.name, interval, amount, currency]);

  const upgraded = phase === "upgraded";
  const busy = phase === "processing";
  const currentLimit = upgraded ? plan.limit : limit;
  const fraction = Math.min(1, Math.max(0, used / Math.max(1, currentLimit)));
  const atLimit = used >= limit;
  const panel = upgraded ? "upgraded" : phase === "later" ? "later" : "offer";

  const setInterval = (next: string) => {
    const value = next as UpgradeInterval;
    if (intervalProp === undefined) setOwnInterval(value);
    onIntervalChange?.(value);
  };

  const upgrade = async () => {
    if (busy) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setPhase("processing");
    setError("");
    setAnnounce(`Upgrading to ${plan.name}${onUpgrade ? "" : ". Simulated, nothing is charged"}.`);
    try {
      if (onUpgrade) await onUpgrade(selection, abort.signal);
      else await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(resolve, 1100);
        abort.signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
      });
      if (abort.signal.aborted) return;
      setPhase("upgraded");
      setAnnounce(`You're on ${plan.name}. ${count(plan.limit)} ${unit} a month.${onUpgrade ? "" : " Simulated, nothing was charged."}`);
      onUpgraded?.(selection);
    } catch (reason) {
      if (abort.signal.aborted) return;
      const message = reason instanceof Error && reason.message ? reason.message : "The upgrade did not go through. Try again.";
      setError(message);
      setPhase("error");
      setAnnounce(message);
    }
  };

  const later = () => {
    setPhase("later");
    setAnnounce(`Dismissed. Your ${unit} reset ${resetsOn}.`);
    onDismiss?.();
  };
  const back = () => { setPhase("offer"); setAnnounce(""); };
  const finish = () => {
    if (onContinue) { onContinue(); return; }
    setPhase("offer");
    setAnnounce("Demo reset.");
  };

  const fill = !seen && !reduced ? 0 : fraction;
  const left = Math.max(0, currentLimit - used);

  return <section className={`${styles.root} ${className ?? ""}`} aria-label={`Upgrade to ${plan.name}`} data-phase={phase}>
    <header className={styles.header}>
      <h3 className={styles.title}>
        <Swap reduced={reduced} active={upgraded ? "done" : "limit"} items={{
          limit: title ?? (atLimit ? `You've used all ${count(limit)} ${unit}` : `You've used ${count(used)} of ${count(limit)} ${unit}`),
          done: `You're on ${plan.name}`,
        }} />
      </h3>
      <p className={styles.description}>
        <Swap reduced={reduced} active={upgraded ? "done" : "limit"} items={{
          limit: description ?? `Your free ${unit} reset ${resetsOn}. Upgrade to keep going without the wait.`,
          done: "Your new limits are live. Pick up right where you left off.",
        }} />
      </p>
    </header>

    <div ref={meter} className={styles.meter}>
      <div className={styles.meterRow}>
        <Swap reduced={reduced} className={styles.state} active={upgraded ? "done" : atLimit ? "limit" : "near"} items={{
          limit: <span className={styles.stateLabel} data-tone="warning"><CircleAlert size={14} aria-hidden="true" />Limit reached</span>,
          near: <span className={styles.stateLabel} data-tone="warning"><CircleAlert size={14} aria-hidden="true" />{count(Math.max(0, limit - used))} left</span>,
          done: <span className={styles.stateLabel} data-tone="success"><CircleCheck size={14} aria-hidden="true" />{count(left)} {unit} left</span>,
        }} />
        <Swap reduced={reduced} className={styles.count} active={upgraded ? "done" : "limit"} items={{
          limit: <>{count(used)} of {count(limit)}</>,
          done: <>{count(used)} of {count(plan.limit)}</>,
        }} />
      </div>
      <div className={styles.track} role="meter" aria-label={unit} aria-valuemin={0} aria-valuemax={currentLimit} aria-valuenow={used} aria-valuetext={`${count(used)} of ${count(currentLimit)} ${unit} used`}>
        <motion.span className={styles.fill} data-tone={upgraded ? "accent" : "warning"} initial={false} animate={{ x: `${(fill - 1) * 100}%` }} transition={reduced ? { duration: 0 } : fillSpring} />
      </div>
    </div>

    <div className={styles.stage}>
      {/* Offer */}
      <Panel on={panel === "offer"} reduced={reduced}>
        <div className={styles.priceRow}>
          <div className={styles.priceBlock}>
            <div className={styles.price}>
              <span className={styles.amount}>
                <Rolling value={money(monthly, currency)} reduced={reduced} />
                <span className={styles.srOnly}>{money(monthly, currency)}</span>
              </span>
              <span className={styles.per}>/ month</span>
            </div>
            <p className={styles.meta}>
              <Swap reduced={reduced} active={phase === "error" ? "error" : interval} items={{
                monthly: "Billed monthly. Cancel anytime.",
                yearly: `${money(amount, currency)} billed yearly. Cancel anytime.`,
                error: <span className={styles.error}><CircleAlert size={14} aria-hidden="true" /><span className={styles.ellipsis}>{error}</span></span>,
              }} />
            </p>
          </div>
          <div className={styles.toggle} inert={busy || undefined}>
            <SegmentedControl label="Billing interval" value={interval} onValueChange={setInterval} options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly", accessory: saving > 0 ? <span className={styles.save}>{`\u2212${saving}%`}</span> : undefined },
            ]} />
          </div>
        </div>
        <ul className={styles.features} aria-label={`${plan.name} includes`}>
          {plan.features.map(feature => <li key={feature.id} className={styles.feature}>
            <Check className={styles.check} size={14} strokeWidth={2.25} aria-hidden="true" />
            <span className={styles.featureLabel}>{feature.label}</span>
          </li>)}
        </ul>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={later} disabled={busy}>Maybe later</Button>
          <Button className={styles.primary} onClick={upgrade} loading={busy}>{busy ? "Upgrading" : phase === "error" ? "Try again" : `Upgrade to ${plan.name}`}</Button>
        </div>
      </Panel>

      {/* Upgraded */}
      <Panel on={panel === "upgraded"} reduced={reduced}>
        <dl className={styles.limits}>
          {plan.limits.map(row => <div key={row.label} className={styles.limitRow}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>)}
        </dl>
        <p className={styles.meta}>{`${money(amount, currency)} billed today${onUpgrade ? "." : ". Simulated, nothing was charged."}`}</p>
        <div className={styles.actions} data-single>
          <Button className={styles.primary} onClick={finish}>Continue</Button>
        </div>
      </Panel>

      {/* Maybe later */}
      <Panel on={panel === "later"} reduced={reduced}>
        <div className={styles.later}>
          <Clock className={styles.laterIcon} size={16} aria-hidden="true" />
          <div className={styles.laterText}>
            <p className={styles.laterTitle}>{`We'll remind you ${resetsOn}`}</p>
            <p className={styles.laterBody}>{`Your ${unit} come back then, and everything you made stays put. ${plan.name} is here whenever you need more.`}</p>
          </div>
        </div>
        <div className={styles.actions} data-single>
          <Button variant="secondary" onClick={back}>{`See ${plan.name} again`}</Button>
        </div>
      </Panel>
    </div>

    <p className={styles.srOnly} role="status" aria-live="polite">{announce}</p>
  </section>;
}

/** Panels share one grid cell so the card keeps the tallest panel's height in every state. Inactive panels are inert. */
function Panel({ on, reduced, children }: { on: boolean; reduced: boolean; children: ReactNode }) {
  return <motion.div className={styles.panel} inert={!on || undefined} aria-hidden={!on || undefined} initial={false}
    animate={on ? { opacity: 1, y: 0, visibility: "visible" } : { opacity: 0, y: reduced ? 0 : 4, transitionEnd: { visibility: "hidden" } }}
    transition={on ? (reduced ? { duration: 0.12 } : { duration: 0.2, ease: [0.16, 1, 0.3, 1], delay: 0.08 }) : { duration: 0.12, ease: [0.7, 0, 0.84, 0] }}>
    {children}
  </motion.div>;
}

export default UpgradePrompt;
