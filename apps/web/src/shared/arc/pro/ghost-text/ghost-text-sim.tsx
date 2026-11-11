"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { avatar } from "../lib/media";
import { Button } from "../../button/button";
import { GhostTextField } from "./ghost-text-field";
import type { GhostTextHandle, GhostTextModel, GhostTextProps, GhostTextSuggest } from "./ghost-text-field";
import { ClaudeMark, GithubMark } from "./ghost-text-marks";
import styles from "./ghost-text.module.css";

const ease = [...motionTokens.ease.standard] as [number, number, number, number];

/** The model shown in the demo. Haiku is the fast tier, which is what inline autocomplete runs on. */
export const ghostTextDemoModel: GhostTextModel = {
  name: "Claude Haiku 5.5",
  mark: <ClaudeMark style={{ color: "#D97757" }} />,
};

/** Contexts the autoplay script writes into, with the continuation the simulated model returns for each. */
const scripted: Array<[string, string]> = [
  ["Customers who upgraded mid-cycle were ", "charged twice for the days left in their billing period."],
  ["used the invoice date instead of the ", "date the plan changed."],
  ["## Changes\n- ", "Compute proration from `changed_at` in `invoice.ts`"],
  ["share one helper\n- ", "Add a regression test for upgrades on the 31st"],
  ["Tested against ", "1,240 October invoices from the staging snapshot. Totals match to the cent outside the affected accounts."],
];

const bullets = [
  "Backfill credits for the 214 affected invoices",
  "Log the old and new plan on every proration",
  "Remove the unused `legacyProrate` helper",
];
const sentences = [
  "The fix only touches accounts that changed plans after October 1.",
  "No migration is needed, and existing invoices keep their totals.",
  "I'll watch the billing error rate for a day after the deploy.",
];
const vocabulary = [
  "proration", "prorated", "invoice", "invoices", "customer", "customers", "regression", "subscription", "subscriptions",
  "downgrade", "downgrades", "upgrade", "upgrades", "billing", "migration", "staging", "accounts", "calculated", "changed",
  "credit", "credits", "Stripe", "webhook", "webhooks", "deploy", "rollout", "snapshot", "helper", "October", "because",
];

/** A tiny rule based stand in for a model: scripted contexts first, then a few PR writing patterns. Null means no suggestion. */
function complete(text: string, scriptedOnly: boolean): string | null {
  for (const [ending, continuation] of scripted) if (text.endsWith(ending)) return continuation;
  if (scriptedOnly) return null;
  if (/timeout/i.test(text)) throw new Error("The model timed out after 4 seconds");
  const line = text.slice(text.lastIndexOf("\n") + 1);
  if (/^[-*] $/.test(line)) return bullets.find((bullet) => !text.includes(bullet)) ?? null;
  if (/^#{1,3} $/.test(line)) return text.includes("## Testing") ? "Rollout" : "Testing";
  if (/\bfix(es|ed)? $/i.test(text)) return "the double charge on mid-cycle plan changes.";
  if (/\bcloses $/i.test(text)) return "#4119 and BILL-882.";
  if (/\btested $/i.test(text)) return "against 1,240 October invoices from the staging snapshot.";
  if (/\bthis (pr|change) $/i.test(text)) return "moves all proration math into one helper, so upgrades and downgrades share a code path.";
  if (/[.!?](\s|\n)+$/.test(text) || /\n\n$/.test(text)) return sentences.find((sentence) => !text.includes(sentence)) ?? null;
  const partial = text.match(/([A-Za-z]{3,})$/)?.[1];
  if (partial) {
    const word = vocabulary.find((candidate) => candidate.length > partial.length && candidate.toLowerCase().startsWith(partial.toLowerCase()));
    if (word) return word.slice(partial.length);
  }
  return null;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const id = window.setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { window.clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});

/** Streams a continuation the way Claude does: a short think, then 3 to 6 words every 34ms. */
async function* stream(continuation: string, signal: AbortSignal): AsyncGenerator<string> {
  await wait(480, signal);
  const words = continuation.match(/\s*\S+/g) ?? [continuation];
  for (let index = 0, size = 3; index < words.length; index += size, size = 3 + ((index * 7) % 4)) {
    if (index > 0) await wait(34, signal);
    yield words.slice(index, index + size).join("");
  }
}

/** The simulated model behind the demo. Returns null synchronously when it has nothing, so no loading state flashes. */
export function createDemoSuggest(options: { scriptedOnly?: boolean } = {}): GhostTextSuggest {
  return (text, signal) => {
    if (/timeout/i.test(text) && !options.scriptedOnly) {
      return (async function* failing() { await wait(900, signal); complete(text, false); yield ""; })();
    }
    const continuation = complete(text, options.scriptedOnly ?? false);
    return continuation ? stream(continuation, signal) : null;
  };
}

const autoSuggest = createDemoSuggest({ scriptedOnly: true });
const freeSuggest = createDemoSuggest();

type Step =
  | { kind: "type"; text: string }
  | { kind: "pause"; ms: number }
  | { kind: "ready"; hold: number }
  | { kind: "tab" | "word" | "esc" };

const script: Step[] = [
  { kind: "pause", ms: 500 },
  { kind: "type", text: "Customers who upgraded mid-cycle were " },
  { kind: "ready", hold: 700 },
  { kind: "tab" },
  { kind: "pause", ms: 220 },
  { kind: "type", text: " The credit for the old plan used the invoice date instead of the " },
  { kind: "ready", hold: 420 },
  { kind: "type", text: "date the" },
  { kind: "pause", ms: 320 },
  { kind: "tab" },
  { kind: "pause", ms: 220 },
  { kind: "type", text: "\n\n## Changes\n- " },
  { kind: "ready", hold: 520 },
  { kind: "word" }, { kind: "pause", ms: 260 },
  { kind: "word" }, { kind: "pause", ms: 210 },
  { kind: "word" }, { kind: "pause", ms: 280 },
  { kind: "word" }, { kind: "pause", ms: 460 },
  { kind: "esc" },
  { kind: "pause", ms: 260 },
  { kind: "type", text: " so upgrades and downgrades share one helper\n- " },
  { kind: "ready", hold: 620 },
  { kind: "tab" },
  { kind: "pause", ms: 220 },
  { kind: "type", text: "\n\nTested against " },
  { kind: "ready", hold: 760 },
  { kind: "tab" },
];

/**
 * A human typing rhythm, deterministic per loop: letters land in quick uneven bursts, spaces are a touch slower with the odd
 * beat to think of the next word, and punctuation and line breaks get a real pause.
 */
function createRhythm(seed: number) {
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (char: string, previous: string) => {
    if (char === "\n") return 170 + random() * 110;
    if (previous === "\n") return 120 + random() * 80;
    if (/[.,;:!?]/.test(previous)) return 150 + random() * 120;
    if (char === " ") return 46 + random() * 50 + (random() < 0.14 ? 150 : 0);
    return 26 + random() * 46;
  };
}

class Cancelled extends Error {}

/** The no-props preview: an autoplaying pull request description that hands the field to you on the first click or key. */
export function SimulatedGhostText(props: GhostTextProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [caret, setCaret] = useState<"typing" | "idle">("idle");
  const [fading, setFading] = useState(false);
  const [run, setRun] = useState(0);
  const reduced = useReducedMotion() ?? false;
  const handle = useRef<GhostTextHandle>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef("");
  const visible = useRef(true);
  const modeRef = useRef(mode);
  useEffect(() => { modeRef.current = mode; }, [mode]);

  const write = useCallback((next: string) => {
    valueRef.current = next;
    setValue(next);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { visible.current = entry.isIntersecting; }, { threshold: 0.1 });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mode !== "auto") return;
    let cancelled = false;
    const sleep = async (ms: number) => {
      let left = ms;
      while (left > 0) {
        if (cancelled) throw new Cancelled();
        const step = Math.min(left, 40);
        await new Promise((resolve) => window.setTimeout(resolve, step));
        if (cancelled) throw new Cancelled();
        if (visible.current && !document.hidden) left -= step;
      }
    };
    const until = async (check: () => boolean, timeout = 5000) => {
      let spent = 0;
      while (!check() && spent < timeout) { await sleep(40); spent += 40; }
    };

    const play = async () => {
      write("");
      await sleep(reduced ? 300 : 0);
      for (let loop = 0; ; loop += 1) {
        const delayFor = createRhythm(4127 + loop);
        for (const step of script) {
          if (step.kind === "pause") await sleep(step.ms);
          else if (step.kind === "type") {
            setCaret("typing");
            for (const char of step.text) {
              await sleep(delayFor(char, valueRef.current.slice(-1)));
              write(valueRef.current + char);
            }
            setCaret("idle");
          } else if (step.kind === "ready") {
            await until(() => { const state = handle.current?.getState(); return state?.status === "ready" && !state.streaming; });
            await sleep(step.hold);
          } else if (step.kind === "tab") handle.current?.acceptAll();
          else if (step.kind === "word") handle.current?.acceptWord();
          else if (step.kind === "esc") handle.current?.dismiss();
        }
        // Reduced motion plays the description once and leaves it finished; otherwise it rests, fades and starts over.
        if (reduced) { setCaret("idle"); return; }
        await sleep(2400);
        setFading(true);
        await sleep(180);
        write("");
        setFading(false);
        await sleep(520);
      }
    };
    play().catch((error) => { if (!(error instanceof Cancelled)) throw error; });
    return () => { cancelled = true; };
  }, [mode, run, reduced, write]);

  const takeOver = useCallback(() => {
    if (modeRef.current !== "auto") return;
    modeRef.current = "manual";
    setMode("manual");
    setFading(false);
  }, []);

  const replay = () => {
    write("");
    setFading(false);
    setMode("auto");
    setRun((count) => count + 1);
  };

  const footer = (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={mode}
        className={styles.simNote}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16, delay: reduced ? 0 : 0.04, ease } }}
        exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1, ease } }}
      >
        {mode === "auto" ? (
          <span className={styles.simText}>Autoplay. Click to type.</span>
        ) : (
          <>
            <span className={styles.simText}>Simulated, nothing is sent</span>
            <Button variant="ghost" size="sm" className={styles.replay} onClick={replay}>
              <RotateCcw aria-hidden="true" />Replay
            </Button>
          </>
        )}
      </motion.span>
    </AnimatePresence>
  );

  return (
    <div ref={hostRef} className={styles.host}>
      <article className={styles.card} aria-label="Pull request #4127">
        <header className={styles.cardHead}>
          <GithubMark className={styles.prMark} aria-hidden="true" />
          <div className={styles.prText}>
            <div className={styles.prTitleRow}>
              <span className={styles.prTitle}>Fix double charge on mid-cycle upgrades</span>
              <span className={styles.prNumber}>#4127</span>
            </div>
            <div className={styles.prMeta}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className={styles.prAvatar} src={avatar("daniel-kim")} alt="" width={16} height={16} />
              <span className={styles.prMetaText}>
                Daniel Kim wants to merge <span className={styles.prBranch}>fix/proration</span> into <span className={styles.prBranch}>main</span>
              </span>
            </div>
          </div>
        </header>
        <GhostTextField
          variant="plain"
          rows={9}
          maxRows={14}
          placeholder="Describe what changed and why"
          aria-label="Pull request description"
          footer={footer}
          model={ghostTextDemoModel}
          {...props}
          ref={handle}
          value={value}
          onValueChange={(next) => { write(next); props.onValueChange?.(next); }}
          suggest={mode === "auto" ? autoSuggest : freeSuggest}
          delay={mode === "auto" ? 400 : props.delay ?? 450}
          demoCaret={mode === "auto" ? caret : false}
          demoFading={fading}
          onUserIntent={takeOver}
          notice={mode === "manual" ? "Simulated suggestions, nothing was sent." : undefined}
        />
      </article>
    </div>
  );
}
