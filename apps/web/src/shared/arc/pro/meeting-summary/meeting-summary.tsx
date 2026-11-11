"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, animate, motion, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { CalendarDays, Check, CircleAlert, MicOff, RotateCcw } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { CopyButton } from "../../copy-button/copy-button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { Tooltip } from "../../tooltip/tooltip";
import { meetingSummarySample } from "./meeting-summary-data";
import type { MeetingActionItem, MeetingPerson, MeetingPlatform, MeetingPoint, MeetingQuote, MeetingSendResult, MeetingSendTarget, MeetingSummaryData, MeetingSummaryStatus } from "./meeting-summary-data";
import { ClaudeMark, GoogleMeetMark, LinearMark, NotionMark, ZoomMark } from "./meeting-summary-marks";
import styles from "./meeting-summary.module.css";

export type { MeetingActionItem, MeetingPerson, MeetingPlatform, MeetingPoint, MeetingQuote, MeetingSendResult, MeetingSendTarget, MeetingSummaryData, MeetingSummaryStatus } from "./meeting-summary-data";
export { meetingSummaryEmptySample, meetingSummarySample } from "./meeting-summary-data";
export { ClaudeMark, GoogleMeetMark, LinearMark, NotionMark, ZoomMark } from "./meeting-summary-marks";

export interface MeetingSummaryModel {
  name: string;
  icon?: ReactNode;
}

export interface MeetingSummaryProps {
  /** The meeting and its generated notes. Defaults to a sample pricing review. */
  meeting?: MeetingSummaryData;
  /** Controlled status. Leave it out and the card plays its own summarizing pass when it scrolls into view. */
  status?: MeetingSummaryStatus;
  /** Message shown with status="error". */
  error?: string;
  /** Uncontrolled only: start in the summarizing state and play the pass. Default true. */
  autoPlay?: boolean;
  /** Stream the notes in when status moves from summarizing to ready. Default true. */
  streamIn?: boolean;
  /** The model credited in the footer. Pass null to hide it. */
  model?: MeetingSummaryModel | null;
  /** Where action items can be sent. Default ["linear", "notion"]. Pass [] to hide the send buttons. */
  sendTargets?: MeetingSendTarget[];
  /** Creates the record. Resolve with a reference to show it, reject to show a retry. Without it, sending is simulated. */
  onSend?: (item: MeetingActionItem, target: MeetingSendTarget, signal: AbortSignal) => Promise<MeetingSendResult | void>;
  /** An action item was checked or unchecked. */
  onActionItemChange?: (item: MeetingActionItem, done: boolean) => void;
  /** Regenerate and Try again. In uncontrolled mode the card also replays its own pass. */
  onRegenerate?: () => void;
  className?: string;
}

type Section = "summary" | "decisions" | "actions";
type Chunk = { text: string; tick: number };
type Plan = { chunks: Map<string, Chunk[]>; sectionTick: Partial<Record<Section, number>>; total: number };
type SendState = { status: "sending" | "sent" | "failed"; result?: MeetingSendResult };

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const DEFAULT_MODEL: MeetingSummaryModel = { name: "Claude Sonnet 5.5", icon: <ClaudeMark width={14} height={14} aria-hidden="true" /> };
const DEFAULT_TARGETS: MeetingSendTarget[] = ["linear", "notion"];
const TARGET_NAME: Record<MeetingSendTarget, string> = { linear: "Linear", notion: "Notion" };
const PLATFORM_NAME: Record<MeetingPlatform, string> = { "google-meet": "Google Meet", zoom: "Zoom", other: "Meeting" };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/* Fast chunked streaming: 3 to 8 words per tick, a tick every 34ms, a short beat between sections. */
const CHUNK_SIZES = [4, 6, 3, 5, 7, 4, 5, 8, 3, 6];
const TICK_MS = 34;
const SECTION_PAUSE = 3;
const SUMMARIZE_MS = 1000;
const SIMULATED_SEND_MS = 820;
const SIZE_SPRING = { type: "spring", visualDuration: .24, bounce: 0 } as const;
const FADE_IN = { duration: .16, ease: [.22, 1, .36, 1] } as const;
const FADE_OUT = { duration: .1, ease: [.22, 1, .36, 1] } as const;
const EASE_OUT = [.22, 1, .36, 1] as const;
/* The check draws from the short leg to the tip on a 16px grid. */
const CHECK_PATH = "M4.25 8.25 L6.75 10.75 L11.75 5.5";

const pad = (value: number) => String(value).padStart(2, "0");
/** 252 seconds reads 04:12; past an hour, 1:04:12. */
export function formatTimestamp(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${pad(m)}:${pad(s % 60)}`;
}
/* Dates are parsed by hand and formatted in UTC so the server and the browser always print the same string. */
function formatDue(iso: string) {
  const [, m, d] = iso.split("-").map(Number);
  return m && d ? `${MONTHS[m - 1]} ${d}` : iso;
}
function formatWhen(startsAt: string, minutes: number) {
  const [date, time = "00:00"] = startsAt.split("T");
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const end = (hh * 60 + mm + minutes) % 1440;
  return { day: `${weekday}, ${MONTHS[m - 1]} ${d}`, range: `${pad(hh)}:${pad(mm)} to ${pad(Math.floor(end / 60))}:${pad(end % 60)}` };
}

function buildPlan(meeting: MeetingSummaryData): Plan {
  const chunks = new Map<string, Chunk[]>();
  const sectionTick: Plan["sectionTick"] = {};
  let tick = 0, size = 0;
  const sections: [Section, MeetingPoint[]][] = [["summary", meeting.summary], ["decisions", meeting.decisions], ["actions", meeting.actionItems]];
  for (const [section, points] of sections) {
    if (!points.length) continue;
    if (tick > 0) tick += SECTION_PAUSE;
    sectionTick[section] = tick++;
    for (const point of points) {
      const words = point.text.split(/\s+/).filter(Boolean);
      const list: Chunk[] = [];
      for (let i = 0; i < words.length;) {
        const n = CHUNK_SIZES[size++ % CHUNK_SIZES.length];
        list.push({ text: words.slice(i, i + n).join(" ") + (i + n < words.length ? " " : ""), tick: tick++ });
        i += n;
      }
      chunks.set(point.id, list);
    }
  }
  return { chunks, sectionTick, total: tick };
}

function toMarkdown(meeting: MeetingSummaryData, done: Record<string, boolean>, people: Map<string, MeetingPerson>) {
  const when = formatWhen(meeting.startsAt, meeting.durationMinutes);
  const lines = [`# ${meeting.title}`, `${when.day}, ${when.range} (${meeting.durationMinutes} min)`];
  if (meeting.summary.length) lines.push("", "## Summary", ...meeting.summary.map(point => `- ${point.text}`));
  if (meeting.decisions.length) lines.push("", "## Decisions", ...meeting.decisions.map(point => `- ${point.text}`));
  if (meeting.actionItems.length) lines.push("", "## Action items", ...meeting.actionItems.map(item => {
    const meta = [item.ownerId ? people.get(item.ownerId)?.name : undefined, item.due ? `due ${formatDue(item.due)}` : undefined].filter(Boolean).join(", ");
    return `- [${done[item.id] ? "x" : " "}] ${item.text}${meta ? ` (${meta})` : ""}`;
  }));
  return lines.join("\n");
}

/**
 * Springs an element to the size of its content whenever that content grows or shrinks, so the card glides between
 * states instead of jumping. A change on the cross axis (the window resizing) cuts straight to the new size.
 */
function useAutoSize(axis: "height" | "width", reduced: boolean) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = outer.current, content = inner.current;
    if (!box || !content || typeof ResizeObserver === "undefined") return;
    const main = () => axis === "height" ? content.offsetHeight : content.offsetWidth;
    const cross = () => axis === "height" ? content.offsetWidth : content.offsetHeight;
    let size = main(), other = cross();
    let controls: AnimationPlaybackControls | undefined;
    const release = () => { box.style[axis] = ""; box.style.overflow = ""; controls = undefined; };
    const observer = new ResizeObserver(() => {
      const next = main(), nextOther = cross();
      const resized = axis === "height" && nextOther !== other;
      other = nextOther;
      if (next === size) return;
      const from = controls ? box.getBoundingClientRect()[axis] : size;
      size = next;
      controls?.stop();
      if (reduced || resized) { release(); return; }
      box.style.overflow = "hidden";
      controls = animate(box, { [axis]: [from, next] }, { ...SIZE_SPRING, onComplete: release });
    });
    observer.observe(content);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [axis, reduced]);
  return { outer, inner };
}

function Spinner({ size = 14 }: { size?: number }) {
  return <svg className={styles.spinner} width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity=".2" strokeWidth="1.75" />
    <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>;
}

/**
 * The action item checkbox: Arc's Checkbox geometry at 16px. A crisp square with a 5px radius, an accent fill that
 * grows in and a check that draws on, a 32px hit area from a pseudo element so the focus ring still hugs the square.
 * A native button with role="checkbox", so Space and Enter both toggle.
 */
function ActionCheck({ checked, onCheckedChange, label, reduced }: { checked: boolean; onCheckedChange: (next: boolean) => void; label: string; reduced: boolean }) {
  const none = { duration: 0 };
  return <button type="button" role="checkbox" aria-checked={checked} aria-label={label} className={styles.checkbox} data-checked={checked || undefined} onClick={() => onCheckedChange(!checked)}>
    <motion.span className={styles.checkFill} aria-hidden="true" initial={false} animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : .6 }}
      transition={reduced ? none : { duration: checked ? .16 : .12, ease: EASE_OUT }} />
    <svg className={styles.checkMark} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <motion.path d={CHECK_PATH} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" initial={false}
        animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
        transition={reduced ? none : { pathLength: { duration: checked ? .2 : .1, delay: checked ? .04 : 0, ease: EASE_OUT }, opacity: { duration: checked ? .04 : .1, delay: checked ? .04 : 0 } }} />
    </svg>
  </button>;
}

function PlatformMark({ platform }: { platform: MeetingPlatform }) {
  if (platform === "google-meet") return <GoogleMeetMark width={20} height={20} />;
  if (platform === "zoom") return <ZoomMark width={20} height={20} />;
  return null;
}

function TargetMark({ target, size = 14 }: { target: MeetingSendTarget; size?: number }) {
  return target === "linear" ? <LinearMark width={size} height={size} aria-hidden="true" /> : <NotionMark width={size} height={size} aria-hidden="true" />;
}

/** A count that crossfades when it changes, in tabular numerals so the label beside it never shifts. */
function Count({ value, reduced }: { value: number; reduced: boolean }) {
  return <span className={styles.count}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={value} initial={reduced ? false : { opacity: 0, y: 2 }} animate={{ opacity: 1, y: 0, transition: FADE_IN }} exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -2, transition: FADE_OUT }}>{value}</motion.span>
    </AnimatePresence>
  </span>;
}

function Streamed({ text, chunks, tick }: { text: string; chunks?: Chunk[]; tick: number | null }) {
  if (tick === null || !chunks) return <>{text}</>;
  return <>{chunks.filter(chunk => chunk.tick <= tick).map((chunk, index) => <span key={index} className={styles.chunk}>{chunk.text}</span>)}</>;
}

function QuoteCard({ id, quote, speaker }: { id: string; quote: MeetingQuote; speaker?: MeetingPerson }) {
  const ref = useRef<HTMLDivElement>(null);
  const [above, setAbove] = useState(false);
  /* Opens below its line; flips above when the viewport has no room, measured before the first paint. */
  useLayoutEffect(() => {
    const node = ref.current;
    if (node && node.getBoundingClientRect().bottom > window.innerHeight - 12) setAbove(true);
  }, []);
  return <motion.div ref={ref} id={id} role="tooltip" className={styles.quote} data-above={above || undefined}
    initial={{ opacity: 0, y: above ? 3 : -3 }} animate={{ opacity: 1, y: 0, transition: FADE_IN }} exit={{ opacity: 0, transition: FADE_OUT }}>
    <div className={styles.quoteHead}>
      {speaker ? <Avatar name={speaker.name} src={speaker.avatar} size="sm" className={styles.quoteAvatar} /> : null}
      <span className={styles.quoteName}>{speaker?.name ?? "Speaker"}</span>
      <span className={styles.quoteTime}>{formatTimestamp(quote.at)}</span>
    </div>
    <p className={styles.quoteText}>&ldquo;{quote.text}&rdquo;</p>
  </motion.div>;
}

interface QuoteControl {
  active: string | null;
  enter: (id: string) => void;
  leave: () => void;
  focus: (id: string) => void;
  toggle: (id: string) => void;
}

function Timestamp({ id, quote, control, quoteId }: { id: string; quote: MeetingQuote; control: QuoteControl; quoteId: string }) {
  const open = control.active === id;
  return <button type="button" className={styles.timestamp} aria-label={`Transcript quote at ${formatTimestamp(quote.at)}`} aria-expanded={open} aria-describedby={open ? quoteId : undefined}
    onFocus={event => { if (event.currentTarget.matches(":focus-visible")) control.focus(id); }} onBlur={control.leave} onClick={() => control.toggle(id)}>
    {formatTimestamp(quote.at)}
  </button>;
}

function SendButton({ item, target, state, onSend, reduced }: { item: MeetingActionItem; target: MeetingSendTarget; state?: SendState; onSend: () => void; reduced: boolean }) {
  const { outer, inner } = useAutoSize("width", reduced);
  const name = TARGET_NAME[target];
  const view = state?.status ?? "idle";
  const swap = { initial: reduced ? false as const : { opacity: 0 }, animate: { opacity: 1, transition: FADE_IN }, exit: { opacity: 0, transition: reduced ? { duration: 0 } : FADE_OUT } };
  let content: ReactNode;
  if (view === "sent") {
    const reference = state?.result?.reference ?? (target === "linear" ? "Created" : "Added");
    const label = `Sent to ${name}${state?.result?.reference ? ` as ${state.result.reference}` : ""}`;
    const body = <><TargetMark target={target} /><span className={styles.sentRef}>{reference}</span><Check className={styles.sentCheck} size={12} strokeWidth={2.25} aria-hidden="true" /></>;
    content = <motion.span key="sent" className={styles.sentWrap} {...swap}>
      {state?.result?.url
        ? <a className={styles.sent} href={state.result.url} target="_blank" rel="noreferrer" aria-label={`${label}, open in ${name}`}>{body}</a>
        : <span className={styles.sent} role="status" aria-label={label}>{body}</span>}
    </motion.span>;
  } else {
    const tip = view === "failed" ? `Couldn't send to ${name}. Retry` : view === "sending" ? `Sending to ${name}` : `Send to ${name}`;
    content = <motion.span key="button" className={styles.sentWrap} {...swap}>
      <Tooltip content={tip}>
        <Button variant="ghost" size="sm" className={styles.iconButton} aria-label={`${tip}: ${item.text}`} aria-busy={view === "sending" || undefined} data-view={view}
          onClick={() => { if (view !== "sending") onSend(); }}>
          <span className={styles.iconSwap}>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span key={view} className={styles.iconSlot} data-view={view} {...swap}>
                {view === "sending" ? <Spinner size={14} /> : view === "failed" ? <CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> : <TargetMark target={target} />}
              </motion.span>
            </AnimatePresence>
          </span>
        </Button>
      </Tooltip>
    </motion.span>;
  }
  return <div ref={outer} className={styles.sizer}>
    <div ref={inner} className={styles.sizerInner}>
      <AnimatePresence initial={false} mode="popLayout">{content}</AnimatePresence>
    </div>
  </div>;
}

/**
 * MeetingSummary: AI notes for one call. A meeting header, then Summary, Decisions and Action items that stream in after
 * the summarizing pass. Hover a point (or focus its timestamp) for the transcript quote it came from; send any action
 * item to Linear or Notion. With no props it plays a sample and every send is simulated.
 */
export function MeetingSummary({
  meeting: meetingProp,
  status: statusProp,
  error,
  autoPlay = true,
  streamIn = true,
  model = DEFAULT_MODEL,
  sendTargets = DEFAULT_TARGETS,
  onSend,
  onActionItemChange,
  onRegenerate,
  className,
}: MeetingSummaryProps) {
  const meeting = meetingProp ?? meetingSummarySample;
  const sample = meetingProp === undefined && statusProp === undefined && onSend === undefined;
  const reduced = useReducedMotion() ?? false;
  const uid = useId();
  const quoteId = `${uid}-quote`;
  const root = useRef<HTMLElement>(null);

  const [internalStatus, setInternalStatus] = useState<MeetingSummaryStatus>(autoPlay ? "summarizing" : "ready");
  const status = statusProp ?? internalStatus;
  const [run, setRun] = useState(0);
  const [inView, setInView] = useState(false);
  const [tick, setTick] = useState<number | null>(null);
  /* Only what someone toggled is stored; every other item falls back to its own initial `done`, so new items just work. */
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  const [sends, setSends] = useState<Record<string, SendState>>({});
  const [announcement, setAnnouncement] = useState(status === "summarizing" ? "Summarizing transcript" : "");
  const [activeQuote, setActiveQuote] = useState<string | null>(null);

  const sendsRef = useRef(sends);
  useLayoutEffect(() => { sendsRef.current = sends; });
  const controllers = useRef(new Set<AbortController>());
  const interacted = useRef(false);
  const demoed = useRef(false);
  const demoChecked = useRef(false);
  const simulatedIssue = useRef(141);
  const openTimer = useRef<number | undefined>(undefined);
  const closeTimer = useRef<number | undefined>(undefined);
  const pinned = useRef(false);

  const people = useMemo(() => new Map(meeting.attendees.map(person => [person.id, person])), [meeting.attendees]);
  const plan = useMemo(() => buildPlan(meeting), [meeting]);
  const when = formatWhen(meeting.startsAt, meeting.durationMinutes);
  const { outer: bodyOuter, inner: bodyInner } = useAutoSize("height", reduced);

  const done = useMemo(() => Object.fromEntries(meeting.actionItems.map(item => [item.id, toggled[item.id] ?? !!item.done])), [meeting.actionItems, toggled]);

  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: .25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  /* Uncontrolled pass: summarize for a beat once the card is on screen, then hand over to the stream. */
  useEffect(() => {
    if (statusProp !== undefined || internalStatus !== "summarizing" || !inView) return;
    const timer = window.setTimeout(() => setInternalStatus("ready"), reduced ? SUMMARIZE_MS / 2 : SUMMARIZE_MS);
    return () => window.clearTimeout(timer);
  }, [statusProp, internalStatus, inView, reduced, run]);

  /* Summarizing to ready starts the stream; any other move shows the end state at once. Adjusted during render
     (React's pattern for state derived from a changing value) so the first streamed frame never flashes the full notes. */
  const [previousStatus, setPreviousStatus] = useState(status);
  if (previousStatus !== status) {
    setPreviousStatus(status);
    if (status === "summarizing") { setTick(null); setAnnouncement("Summarizing transcript"); }
    else if (status === "error") { setTick(null); setAnnouncement(`Couldn't summarize this meeting. ${error ?? ""}`.trim()); }
    else if (previousStatus === "summarizing") {
      const counts = `${meeting.summary.length} points, ${meeting.decisions.length} decisions, ${meeting.actionItems.length} action items`;
      setAnnouncement(plan.total ? `Summary ready: ${counts}` : "No transcript to summarize");
      setTick(streamIn && !reduced && plan.total ? 0 : null);
    }
  }

  const streaming = tick !== null;
  useEffect(() => {
    if (!streaming) return;
    const timer = window.setInterval(() => setTick(current => current === null ? null : current >= plan.total + 5 ? null : current + 1), TICK_MS);
    return () => window.clearInterval(timer);
  }, [streaming, plan.total]);

  useEffect(() => () => {
    controllers.current.forEach(controller => controller.abort());
    window.clearTimeout(openTimer.current);
    window.clearTimeout(closeTimer.current);
  }, []);

  const send = useCallback(async (item: MeetingActionItem, target: MeetingSendTarget) => {
    const key = `${item.id}:${target}`;
    const current = sendsRef.current[key]?.status;
    if (current === "sending" || current === "sent") return;
    const name = TARGET_NAME[target];
    setSends(previous => ({ ...previous, [key]: { status: "sending" } }));
    setAnnouncement(`Sending to ${name}`);
    const controller = new AbortController();
    controllers.current.add(controller);
    try {
      let result: MeetingSendResult;
      if (onSend) result = (await onSend(item, target, controller.signal)) ?? {};
      else {
        await new Promise<void>((resolve, reject) => {
          const timer = window.setTimeout(resolve, SIMULATED_SEND_MS);
          controller.signal.addEventListener("abort", () => { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
        });
        result = target === "linear" ? { reference: `PRC-${simulatedIssue.current++}` } : { reference: "Added" };
      }
      if (controller.signal.aborted) return;
      setSends(previous => ({ ...previous, [key]: { status: "sent", result } }));
      const as = result.reference && target === "linear" ? ` as ${result.reference}` : "";
      setAnnouncement(`Sent "${item.text}" to ${name}${as}.${onSend ? "" : " Simulated, nothing was sent."}`);
    } catch {
      if (controller.signal.aborted) return;
      setSends(previous => ({ ...previous, [key]: { status: "failed" } }));
      setAnnouncement(`Couldn't send to ${name}. Try again.`);
    } finally {
      controllers.current.delete(controller);
    }
  }, [onSend]);

  /* The sample shows the send flow once on its own, unless someone has already started using the card. */
  useEffect(() => {
    if (!sample || streaming || status !== "ready" || demoed.current || !inView || !sendTargets.includes("linear")) return;
    const item = meeting.actionItems[1] ?? meeting.actionItems[0];
    if (!item) return;
    const timer = window.setTimeout(() => {
      if (interacted.current || demoed.current) return;
      demoed.current = true;
      void send(item, "linear");
    }, 1100);
    return () => window.clearTimeout(timer);
  }, [sample, streaming, status, inView, meeting.actionItems, sendTargets, send]);

  /* Then it ticks off the first item, so the completed state is part of the loop people see. */
  const demoItem = meeting.actionItems[1] ?? meeting.actionItems[0];
  const demoSent = demoItem ? sends[`${demoItem.id}:linear`]?.status === "sent" : false;
  useEffect(() => {
    const first = meeting.actionItems[0];
    if (!sample || !demoSent || demoChecked.current || !first || !inView) return;
    const timer = window.setTimeout(() => {
      if (interacted.current || demoChecked.current) return;
      demoChecked.current = true;
      setToggled(previous => ({ ...previous, [first.id]: true }));
      setAnnouncement(`Done: ${first.text}`);
    }, 650);
    return () => window.clearTimeout(timer);
  }, [sample, demoSent, inView, meeting.actionItems]);

  const regenerate = () => {
    onRegenerate?.();
    controllers.current.forEach(controller => controller.abort());
    setSends({});
    setActiveQuote(null);
    if (statusProp === undefined) { setInternalStatus("summarizing"); setRun(value => value + 1); }
  };

  const toggleDone = (item: MeetingActionItem, next: boolean) => {
    setToggled(previous => ({ ...previous, [item.id]: next }));
    onActionItemChange?.(item, next);
    setAnnouncement(`${next ? "Done" : "Not done"}: ${item.text}`);
  };

  /* Quote hover intent: a short delay for the first card, instant while moving between lines, a brief grace on leave. */
  const quote: QuoteControl = {
    active: activeQuote,
    enter: id => {
      window.clearTimeout(closeTimer.current);
      window.clearTimeout(openTimer.current);
      if (pinned.current && activeQuote !== id) pinned.current = false;
      if (activeQuote) setActiveQuote(id);
      else openTimer.current = window.setTimeout(() => setActiveQuote(id), 260);
    },
    leave: () => {
      window.clearTimeout(openTimer.current);
      if (pinned.current) return;
      closeTimer.current = window.setTimeout(() => setActiveQuote(null), 90);
    },
    focus: id => { window.clearTimeout(closeTimer.current); window.clearTimeout(openTimer.current); setActiveQuote(id); },
    toggle: id => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(closeTimer.current);
      const open = activeQuote === id && pinned.current;
      pinned.current = !open;
      setActiveQuote(open ? null : id);
    },
  };
  useEffect(() => {
    if (!activeQuote || !pinned.current) return;
    const close = (event: PointerEvent) => {
      if ((event.target as Element | null)?.closest?.(`[data-quote-row="${activeQuote}"]`)) return;
      pinned.current = false;
      setActiveQuote(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [activeQuote]);

  const visible = (id: string) => tick === null || (plan.chunks.get(id)?.[0]?.tick ?? 0) <= tick;
  const finished = (id: string) => { const list = plan.chunks.get(id); return tick === null || (list?.[list.length - 1]?.tick ?? 0) < tick; };
  const sectionVisible = (section: Section) => tick === null || (plan.sectionTick[section] ?? Infinity) <= tick;

  const empty = status === "ready" && plan.total === 0;
  const view = status === "summarizing" ? "loading" : status === "error" ? "error" : empty ? "empty" : "notes";
  const doneCount = meeting.actionItems.filter(item => done[item.id]).length;
  const markdown = toMarkdown(meeting, done, people);
  const shownAttendees = meeting.attendees.slice(0, 4);
  const extraAttendees = meeting.attendees.length - shownAttendees.length;
  const swap = { initial: reduced ? false as const : { opacity: 0 }, animate: { opacity: 1, transition: FADE_IN }, exit: { opacity: 0, transition: reduced ? { duration: 0 } : FADE_OUT } };

  const pointRow = (point: MeetingPoint, marker: ReactNode, mounted: boolean) => {
    const rowId = `${uid}-${point.id}`;
    const open = activeQuote === rowId && !!point.quote;
    return <li key={point.id} className={cx(styles.point, mounted && styles.enter)} data-quote-row={rowId} data-active={open || undefined}
      onPointerEnter={event => { if (event.pointerType === "mouse" && point.quote && !streaming) quote.enter(rowId); }}
      onPointerLeave={event => { if (event.pointerType === "mouse") quote.leave(); }}>
      <span className={styles.marker} aria-hidden="true">{marker}</span>
      <span className={styles.pointText}><Streamed text={point.text} chunks={plan.chunks.get(point.id)} tick={tick} /></span>
      {point.quote ? <span className={cx(styles.pointAside, !finished(point.id) && styles.hidden)}>
        <Timestamp id={rowId} quote={point.quote} control={quote} quoteId={quoteId} />
      </span> : null}
      <AnimatePresence>{open && point.quote ? <QuoteCard key="quote" id={quoteId} quote={point.quote} speaker={people.get(point.quote.speakerId)} /> : null}</AnimatePresence>
    </li>;
  };

  return <article ref={root} className={cx(styles.root, className)} aria-label={`Meeting notes: ${meeting.title}`} aria-busy={status === "summarizing" || streaming}
    onPointerDown={() => { interacted.current = true; }} onKeyDown={event => {
      interacted.current = true;
      if (event.key === "Escape" && activeQuote) { pinned.current = false; setActiveQuote(null); }
    }}>
    <header className={styles.header}>
      <span className={styles.platform} aria-hidden={meeting.platform === "other" || undefined}><PlatformMark platform={meeting.platform} /></span>
      <div className={styles.heading}>
        <h2 className={styles.title}>{meeting.title}</h2>
        <p className={styles.when}>
          <span className={styles.srOnly}>{PLATFORM_NAME[meeting.platform]}, </span>
          <span>{when.day}</span><span className={styles.dot} aria-hidden="true" /><span>{when.range}</span><span className={styles.dot} aria-hidden="true" /><span>{meeting.durationMinutes} min</span>
        </p>
      </div>
      {meeting.attendees.length ? <Tooltip content={meeting.attendees.map(person => person.name).join(", ")}>
        <span className={styles.stack} tabIndex={0} role="group" aria-label={`${meeting.attendees.length} attendees: ${meeting.attendees.map(person => person.name).join(", ")}`}>
          <span className={styles.stackFaces} aria-hidden="true">
            {shownAttendees.map(person => <Avatar key={person.id} name={person.name} src={person.avatar} size="sm" className={styles.face} />)}
          </span>
          {extraAttendees > 0 ? <span className={styles.more} aria-hidden="true">+{extraAttendees}</span> : null}
        </span>
      </Tooltip> : null}
    </header>

    <div ref={bodyOuter} className={styles.bodyOuter}>
      <div ref={bodyInner} className={styles.body}>
        <AnimatePresence initial={false} mode="popLayout">
          {view === "loading" ? <motion.div key={`loading-${run}`} className={styles.loading} {...swap}>
            <Spinner />
            <TextShimmer className={styles.loadingLabel}>Summarizing transcript</TextShimmer>
          </motion.div> : null}

          {view === "error" ? <motion.div key="error" className={styles.state} role="alert" {...swap}>
            <span className={cx(styles.stateIcon, styles.stateDanger)} aria-hidden="true"><CircleAlert size={16} strokeWidth={1.75} /></span>
            <div className={styles.stateCopy}>
              <p className={styles.stateTitle}>Couldn&apos;t summarize this meeting</p>
              <p className={styles.stateText}>{error ?? "The transcript didn't finish processing. Try again in a minute."}</p>
              <Button variant="secondary" size="sm" className={styles.retry} onClick={regenerate}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Try again</Button>
            </div>
          </motion.div> : null}

          {view === "empty" ? <motion.div key="empty" className={styles.state} {...swap}>
            <span className={styles.stateIcon} aria-hidden="true"><MicOff size={16} strokeWidth={1.75} /></span>
            <div className={styles.stateCopy}>
              <p className={styles.stateTitle}>No transcript to summarize</p>
              <p className={styles.stateText}>Transcription was off for this call. Turn it on in {meeting.platform === "other" ? "your meeting app" : PLATFORM_NAME[meeting.platform]} to get notes next time.</p>
            </div>
          </motion.div> : null}

          {view === "notes" ? <motion.div key={`notes-${run}`} className={styles.notes} {...swap}>
            {meeting.summary.length && sectionVisible("summary") ? <section className={cx(styles.section, streaming && styles.enter)} aria-labelledby={`${uid}-summary`}>
              <h3 id={`${uid}-summary`} className={styles.sectionTitle}>Summary</h3>
              <ul className={styles.list}>{meeting.summary.filter(point => visible(point.id)).map(point => pointRow(point, <span className={styles.bullet} />, streaming))}</ul>
            </section> : null}

            {meeting.decisions.length && sectionVisible("decisions") ? <section className={cx(styles.section, streaming && styles.enter)} aria-labelledby={`${uid}-decisions`}>
              <h3 id={`${uid}-decisions`} className={styles.sectionTitle}>Decisions</h3>
              <ul className={styles.list}>{meeting.decisions.filter(point => visible(point.id)).map(point => pointRow(point, <Check size={14} strokeWidth={1.75} />, streaming))}</ul>
            </section> : null}

            {meeting.actionItems.length && sectionVisible("actions") ? <section className={cx(styles.section, streaming && styles.enter)} aria-labelledby={`${uid}-actions`}>
              <div className={styles.sectionHead}>
                <h3 id={`${uid}-actions`} className={styles.sectionTitle}>Action items</h3>
                <span className={cx(styles.progress, streaming && styles.hidden)}><Count value={doneCount} reduced={reduced} /> of {meeting.actionItems.length} done</span>
              </div>
              <ul className={styles.list}>{meeting.actionItems.filter(item => visible(item.id)).map(item => {
                const owner = item.ownerId ? people.get(item.ownerId) : undefined;
                const rowId = `${uid}-${item.id}`;
                const open = activeQuote === rowId && !!item.quote;
                const checked = !!done[item.id];
                return <li key={item.id} className={cx(styles.item, streaming && styles.enter)} data-quote-row={rowId} data-done={checked || undefined}>
                  <span className={styles.checkCell}>
                    <ActionCheck checked={checked} onCheckedChange={next => toggleDone(item, next)} label={item.text} reduced={reduced} />
                  </span>
                  <div className={styles.itemBody}>
                    <span className={styles.itemText}><span className={styles.strike}><Streamed text={item.text} chunks={plan.chunks.get(item.id)} tick={tick} /></span></span>
                    <div className={cx(styles.meta, !finished(item.id) && styles.hidden)}>
                      {owner ? <span className={styles.owner}><Avatar name={owner.name} src={owner.avatar} size="sm" className={styles.ownerAvatar} aria-hidden="true" /><span className={styles.ownerFull}>{owner.name}</span><span className={styles.ownerShort} aria-hidden="true">{owner.name.split(" ")[0]}</span></span> : null}
                      {item.due ? <span className={styles.due}><CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" /><span><span className={styles.srOnly}>Due </span>{formatDue(item.due)}</span></span> : null}
                      {item.quote ? <span className={styles.metaQuote}
                        onPointerEnter={event => { if (event.pointerType === "mouse") quote.enter(rowId); }}
                        onPointerLeave={event => { if (event.pointerType === "mouse") quote.leave(); }}>
                        <Timestamp id={rowId} quote={item.quote} control={quote} quoteId={quoteId} />
                      </span> : null}
                      {sendTargets.length ? <span className={styles.sendGroup}>
                        {sendTargets.map(target => <SendButton key={target} item={item} target={target} state={sends[`${item.id}:${target}`]} onSend={() => void send(item, target)} reduced={reduced} />)}
                      </span> : null}
                    </div>
                  </div>
                  <AnimatePresence>{open && item.quote ? <QuoteCard key="quote" id={quoteId} quote={item.quote} speaker={people.get(item.quote.speakerId)} /> : null}</AnimatePresence>
                </li>;
              })}</ul>
            </section> : null}
          </motion.div> : null}
        </AnimatePresence>
      </div>
    </div>

    <footer className={styles.footer}>
      <p className={styles.credit}>
        {model ? <>{model.icon ? <span className={styles.modelIcon}>{model.icon}</span> : null}<span className={styles.modelName}>{model.name}</span></> : null}
        {meeting.transcriptWords ? <>{model ? <span className={styles.dot} aria-hidden="true" /> : null}<span>{meeting.transcriptWords.toLocaleString("en-US")} words</span></> : null}
      </p>
      <div className={styles.tools}>
        <CopyButton value={markdown} label="Copy notes as Markdown" iconOnly variant="plain" disabled={view !== "notes" || streaming} className={styles.tool} />
        <Tooltip content="Regenerate">
          <Button variant="ghost" size="sm" className={styles.iconButton} aria-label="Regenerate notes" disabled={status === "summarizing" || streaming} onClick={regenerate}>
            <RotateCcw size={15} strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>
    </footer>

    <p className={styles.srOnly} aria-live="polite">{announcement}</p>
  </article>;
}

export default MeetingSummary;
