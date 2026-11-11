"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Transition } from "motion/react";
import { ArrowRight, Bug, CircleAlert, CircleCheck, CircleHelp, CreditCard, Frown, Inbox, Lightbulb, Meh, Pause, Play, Receipt, RotateCcw, Smile } from "lucide-react";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { motionTokens } from "../../lib/motion-tokens";
import { channelLabels, intentLabels, sentimentLabels, ticketRouterLanes, ticketRouterSamples, ticketRouterSeed } from "./ticket-router-data";
import type { RoutedTicket, TicketAssignee, TicketChannel, TicketClassification, TicketIntent, TicketLane, TicketMessage, TicketSentiment } from "./ticket-router-data";
import { ClaudeMark, GmailMark, IntercomMark, SlackMark, ZendeskMark } from "./ticket-router-marks";
import styles from "./ticket-router.module.css";

export type { RoutedTicket, TicketAssignee, TicketChannel, TicketClassification, TicketIntent, TicketLane, TicketMessage, TicketSentiment } from "./ticket-router-data";
export { ticketRouterLanes, ticketRouterSamples, ticketRouterSeed } from "./ticket-router-data";

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");
const pct = (value: number) => `${Math.round(value * 100)}%`;
const firstName = (name: string) => name.split(" ")[0];

type Phase = "connecting" | "arriving" | "classifying" | "labeled" | "routing" | "error" | "idle";
interface Target { lane: string; assignee?: TicketAssignee; suggestedLane?: string }

/* Timings in ms at speed 1. One ticket takes about two seconds from arrival to landing. */
const TIMING = { connect: 560, arrive: 220, classify: 720, labeled: 420, routing: 560, autoRetry: 1700 };
const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const sizeSpring: Transition = { type: "spring", visualDuration: .24, bounce: 0 };

/* ---------------------------------------------------------------- marks and icons */

const channelMarks: Record<TicketChannel, (props: { width: number; height: number; title: string }) => ReactNode> = {
  email: props => <GmailMark {...props} />,
  intercom: props => <IntercomMark {...props} />,
  slack: props => <SlackMark {...props} />,
  zendesk: props => <ZendeskMark {...props} />,
};

function ChannelMark({ channel, size = 16 }: { channel: TicketChannel; size?: number }) {
  return <span className={styles.mark} style={{ width: size, height: size }}>{channelMarks[channel]({ width: size, height: size, title: channelLabels[channel] })}</span>;
}

const intentIcons: Record<TicketIntent, typeof Bug> = { billing: CreditCard, bug: Bug, feature: Lightbulb, refund: Receipt };
const sentimentIcons: Record<TicketSentiment, typeof Bug> = { positive: Smile, neutral: Meh, negative: Frown };

/* ---------------------------------------------------------------- small parts */

/** A counter that rolls: the old value lifts out as the new one rises in, in reserved tabular width. */
function Rolling({ value, reduced }: { value: number; reduced: boolean }) {
  const text = String(value);
  return <span className={styles.roll} style={{ minWidth: `${Math.max(2, text.length)}ch` }}>
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span key={text} className={styles.rollValue}
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: "70%" }} animate={{ opacity: 1, y: 0 }} exit={reduced ? { opacity: 0 } : { opacity: 0, y: "-70%" }}
        transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease }}>{text}</motion.span>
    </AnimatePresence>
  </span>;
}

/** One crossfade per swap: the old content leaves in about 100ms, the new one settles in 160ms with a 2px rise. */
function Swap({ swapKey, children, className, reduced, travel = 2 }: { swapKey: string; children: ReactNode; className?: string; reduced: boolean; travel?: number }) {
  return <AnimatePresence initial={false}>
    <motion.div key={swapKey} className={cx(styles.swap, className)}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -travel }} animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0 : motionTokens.duration.fast, ease, delay: reduced ? 0 : .04 } }}
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: travel * 2, transition: { duration: .1, ease } }}>
      {children}
    </motion.div>
  </AnimatePresence>;
}

function Confidence({ value, low }: { value: number; low: boolean }) {
  return <span className={styles.chip} data-low={low || undefined}>
    <span className={styles.meter} aria-hidden="true"><span className={styles.meterFill} style={{ transform: `scaleX(${Math.max(.04, Math.min(1, value))})` }} /></span>
    <span className={styles.chipNum}>{pct(value)}</span>
    <span className={styles.srOnly}>confidence{low ? ", low" : ""}</span>
  </span>;
}

function Labels({ result, low, reduced }: { result: TicketClassification; low: boolean; reduced: boolean }) {
  const IntentIcon = intentIcons[result.intent];
  const SentimentIcon = sentimentIcons[result.sentiment];
  const items = [
    <span key="intent" className={styles.chip}><IntentIcon size={14} strokeWidth={1.75} aria-hidden="true" />{intentLabels[result.intent]}</span>,
    <span key="sentiment" className={styles.chip} data-sentiment={result.sentiment}><SentimentIcon size={14} strokeWidth={1.75} aria-hidden="true" />{sentimentLabels[result.sentiment]}</span>,
    <Confidence key="confidence" value={result.confidence} low={low} />,
  ];
  return <span className={styles.chips}>
    {items.map((item, index) => <motion.span key={item.key} className={styles.chipSlot}
      initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: motionTokens.duration.fast, ease, delay: index * .05 }}>{item}</motion.span>)}
  </span>;
}

/* ---------------------------------------------------------------- props */

export interface TicketRouterProps {
  /** Incoming messages, processed in order. Defaults to a sample support inbox that loops. */
  tickets?: TicketMessage[];
  /** Team lanes, left to right. One lane may set `review: true` to collect low confidence tickets. */
  lanes?: TicketLane[];
  /** Tickets already in the lanes on first render, newest first. Defaults to samples when `tickets` is not set. */
  initialRouted?: RoutedTicket[];
  /** Your classifier. Throw to show the error state. Without it a simulated classifier reads each ticket's `sample`. */
  classify?: (ticket: TicketMessage, options: { signal: AbortSignal }) => Promise<TicketClassification>;
  /** Picks the lane id for a confident classification. Defaults to billing and refund to `billing`, bug to `engineering`, feature to `success`. */
  route?: (ticket: TicketMessage, classification: TicketClassification) => string;
  /** Confidence below this goes to the review lane. Defaults to 0.7. */
  reviewThreshold?: number;
  /** Starts over at the first ticket when the queue runs out. Defaults to true for the sample inbox, false for your own tickets. */
  loop?: boolean;
  /** Controls the flow. Pair with onPausedChange. */
  paused?: boolean;
  defaultPaused?: boolean;
  onPausedChange?: (paused: boolean) => void;
  /** Called when a ticket lands in a lane. */
  onRoute?: (ticket: RoutedTicket) => void;
  /** Called when someone confirms a review ticket's suggested lane. */
  onReview?: (ticket: RoutedTicket, lane: string) => void;
  /** Called when the classifier throws. */
  onError?: (ticket: TicketMessage, error: unknown) => void;
  /** Rows shown per lane. Defaults to 3 (2 on narrow containers). */
  maxVisible?: number;
  /** Playback speed multiplier. Defaults to 1. */
  speed?: number;
  /** Card title. Defaults to "Ticket routing". */
  title?: string;
  /** Classifier model name shown in the header. */
  model?: string;
  /** Mark shown before the title. Defaults to the Claude mark. */
  modelMark?: ReactNode;
  className?: string;
}

const defaultLaneFor = (intent: TicketIntent) => intent === "bug" ? "engineering" : intent === "feature" ? "success" : "billing";

function guess(ticket: TicketMessage): TicketClassification {
  const text = `${ticket.subject} ${ticket.preview}`.toLowerCase();
  const intent: TicketIntent = /refund|cancel/.test(text) ? "refund" : /invoice|charge|billing|card|vat|plan/.test(text) ? "billing" : /error|fail|bug|broken|crash|5\d\d|twice/.test(text) ? "bug" : "feature";
  const sentiment: TicketSentiment = /love|great|thanks|would love/.test(text) ? "positive" : /twice|again|still|urgent|broken/.test(text) ? "negative" : "neutral";
  return { intent, sentiment, confidence: .66 };
}

/* ---------------------------------------------------------------- component */

/**
 * A support ticket router: messages from Gmail, Intercom, Slack and Zendesk arrive one at a time, an AI classifier
 * labels intent, sentiment and confidence, and the ticket lands in a team lane with an assignee. Low confidence
 * tickets go to review, where one click confirms the suggested lane. With no props it plays a simulated inbox.
 */
export function TicketRouter({
  tickets: ticketsProp, lanes = ticketRouterLanes, initialRouted, classify, route, reviewThreshold = .7, loop: loopProp,
  paused: pausedProp, defaultPaused = false, onPausedChange, onRoute, onReview, onError, maxVisible = 3, speed = 1,
  title = "Ticket routing", model = "Claude Haiku 5.5", modelMark, className,
}: TicketRouterProps) {
  const reduced = useReducedMotion() ?? false;
  const id = useId();
  const tickets = ticketsProp ?? ticketRouterSamples;
  const loop = loopProp ?? !ticketsProp;
  const simulated = !classify;

  const [pausedState, setPausedState] = useState(defaultPaused);
  const paused = pausedProp ?? pausedState;
  const [visible, setVisible] = useState(true);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [current, setCurrent] = useState<TicketMessage | null>(null);
  const [result, setResult] = useState<TicketClassification | null>(null);
  const [target, setTarget] = useState<Target | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [routed, setRouted] = useState<RoutedTicket[]>(() => initialRouted ?? (ticketsProp ? [] : [...ticketRouterSeed].sort((a, b) => b.id.localeCompare(a.id))));
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(lanes.map(lane => [lane.id, lane.count ?? 0])));
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());
  const [handled, setHandled] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const root = useRef<HTMLElement>(null);
  const cursor = useRef(0);
  const done = useRef(new Set<string>());
  const failed = useRef(new Set<string>());
  const turn = useRef<Record<string, number>>({});
  const callbacks = useRef({ classify, route, onRoute, onReview, onError });
  useEffect(() => { callbacks.current = { classify, route, onRoute, onReview, onError }; });

  const reviewLane = lanes.find(lane => lane.review);
  const laneById = useCallback((laneId?: string) => lanes.find(lane => lane.id === laneId), [lanes]);
  const wait = (ms: number) => ms / Math.max(.25, speed);

  const setPaused = (next: boolean) => {
    if (pausedProp === undefined) setPausedState(next);
    onPausedChange?.(next);
    setAnnouncement(next ? "Paused. New tickets wait in the queue." : "Resumed routing.");
  };

  // Narrow containers show two rows per lane, matching the 2 by 2 lane grid in the stylesheet.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const node = root.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width <= 600));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const rowsShown = narrow ? Math.min(2, maxVisible) : maxVisible;

  // Loops pause off screen, so a page full of previews stays quiet.
  useEffect(() => {
    const node = root.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "80px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const pickNext = useCallback((): TicketMessage | null => {
    if (!tickets.length) return null;
    if (loop) {
      const index = cursor.current % tickets.length, round = Math.floor(cursor.current / tickets.length);
      cursor.current += 1;
      const ticket = tickets[index];
      return round ? { ...ticket, id: `${ticket.id}-${round}`, receivedAt: undefined } : ticket;
    }
    return tickets.find(ticket => !done.current.has(ticket.id)) ?? null;
  }, [tickets, loop]);

  const advance = useCallback(() => {
    const next = pickNext();
    setResult(null);
    setTarget(null);
    setError("");
    setAttempt(0);
    setCurrent(next);
    setPhase(next ? "arriving" : "idle");
  }, [pickNext]);

  const assign = useCallback((laneId: string) => {
    const pool = laneById(laneId)?.assignees ?? [];
    if (!pool.length) return undefined;
    const index = turn.current[laneId] ?? 0;
    turn.current[laneId] = index + 1;
    return pool[index % pool.length];
  }, [laneById]);

  const decide = useCallback((ticket: TicketMessage, classification: TicketClassification): Target => {
    const picked = callbacks.current.route?.(ticket, classification) ?? defaultLaneFor(classification.intent);
    const laneId = laneById(picked) ? picked : lanes.find(lane => !lane.review)?.id ?? picked;
    if (reviewLane && classification.confidence < reviewThreshold) return { lane: reviewLane.id, suggestedLane: laneId };
    return { lane: laneId, assignee: assign(laneId) };
  }, [laneById, lanes, reviewLane, reviewThreshold, assign]);

  const land = useCallback((ticket: TicketMessage, classification: TicketClassification | undefined, to: Target) => {
    const entry: RoutedTicket = { ...ticket, classification, lane: to.lane, assignee: to.assignee, suggestedLane: to.suggestedLane };
    done.current.add(ticket.id);
    setRouted(list => [entry, ...list].slice(0, 80));
    setCounts(map => ({ ...map, [to.lane]: (map[to.lane] ?? 0) + 1 }));
    setFresh(set => new Set(set).add(ticket.id));
    setHandled(count => count + 1);
    const laneLabel = laneById(to.lane)?.label ?? to.lane;
    setAnnouncement(`${ticket.subject}: routed to ${laneLabel}${to.assignee ? `, assigned to ${to.assignee.name}` : ""}.${simulated ? " Simulated, nothing was sent." : ""}`);
    callbacks.current.onRoute?.(entry);
  }, [laneById, simulated]);

  function pickNextAvailable() {
    return tickets.length > 0 && (loop || tickets.some(ticket => !done.current.has(ticket.id)));
  }

  // The flow: one timer or one classifier call per phase, cancelled on pause, off screen or unmount.
  useEffect(() => {
    if (paused || !visible) return;
    let timer: number | undefined;
    const after = (ms: number, run: () => void) => { timer = window.setTimeout(run, wait(ms)); };

    if (phase === "connecting") after(TIMING.connect, advance);
    else if (phase === "arriving") after(TIMING.arrive, () => setPhase("classifying"));
    else if (phase === "labeled") after(TIMING.labeled, () => setPhase("routing"));
    else if (phase === "routing" && current && target) after(TIMING.routing, () => { land(current, result ?? undefined, target); advance(); });
    else if (phase === "error" && simulated) after(TIMING.autoRetry, () => { setAttempt(count => count + 1); setPhase("classifying"); });
    else if (phase === "idle") { if (pickNextAvailable()) after(TIMING.arrive, advance); }
    else if (phase === "classifying" && current) {
      const controller = new AbortController();
      const ticket = current;
      const run = callbacks.current.classify
        ? callbacks.current.classify(ticket, { signal: controller.signal })
        : new Promise<TicketClassification>((resolve, reject) => {
          timer = window.setTimeout(() => {
            if (ticket.sample?.failOnce && !failed.current.has(ticket.id)) { failed.current.add(ticket.id); reject(new Error("The classifier timed out after 8s.")); }
            else resolve(ticket.sample ? { intent: ticket.sample.intent, sentiment: ticket.sample.sentiment, confidence: ticket.sample.confidence } : guess(ticket));
          }, wait(TIMING.classify));
        });
      run.then(classification => {
        if (controller.signal.aborted) return;
        setResult(classification);
        setTarget(decide(ticket, classification));
        setPhase("labeled");
      }, (reason: unknown) => {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error && reason.message ? reason.message : "The classifier could not label this ticket.");
        setPhase("error");
        setAnnouncement(`${ticket.subject}: classification failed.`);
        callbacks.current.onError?.(ticket, reason);
      });
      return () => { controller.abort(); window.clearTimeout(timer); };
    }
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, current, target, attempt, paused, visible, simulated, tickets, advance, decide, land]);

  const retry = () => { setError(""); setAttempt(count => count + 1); setPhase("classifying"); };
  const sendToReview = () => {
    if (!current || !reviewLane) return;
    land(current, undefined, { lane: reviewLane.id });
    advance();
  };

  const confirmReview = (ticket: RoutedTicket) => {
    const to = ticket.suggestedLane;
    if (!to || !laneById(to)) return;
    const assignee = assign(to);
    const moved: RoutedTicket = { ...ticket, lane: to, assignee, suggestedLane: undefined };
    setRouted(list => [moved, ...list.filter(entry => entry.id !== ticket.id)]);
    setCounts(map => ({ ...map, [ticket.lane]: Math.max(0, (map[ticket.lane] ?? 0) - 1), [to]: (map[to] ?? 0) + 1 }));
    setFresh(set => new Set(set).add(ticket.id));
    const label = laneById(to)?.label ?? to;
    setAnnouncement(`${ticket.subject}: moved to ${label}${assignee ? `, assigned to ${assignee.name}` : ""}.${simulated ? " Simulated, nothing was sent." : ""}`);
    callbacks.current.onReview?.(moved, to);
  };

  /* ---------------------------------------------------------------- derived view */

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const low = !!result && result.confidence < reviewThreshold && !!reviewLane;
  const targetIndex = target ? lanes.findIndex(lane => lane.id === target.lane) : -1;
  const targetLane = laneById(target?.lane);
  const showRoute = phase === "routing" && !!target;
  const busy = !paused && phase !== "idle" && phase !== "error";

  const cardKey = phase === "connecting" ? "connecting" : current ? `ticket-${current.id}` : handled ? "done" : "empty";
  const rowKey = !current ? "none" : phase === "error" ? "error" : (phase === "labeled" || phase === "routing") && result ? "labels" : "classifying";

  const card = phase === "connecting"
    ? <div className={styles.placeholder}><TextShimmer className={styles.placeholderText}>Connecting to Gmail, Intercom, Slack and Zendesk</TextShimmer></div>
    : !current
      ? <div className={styles.placeholder}>
        {handled ? <CircleCheck size={16} strokeWidth={1.75} className={styles.doneIcon} aria-hidden="true" /> : <Inbox size={16} strokeWidth={1.75} className={styles.mutedIcon} aria-hidden="true" />}
        <span className={styles.placeholderTitle}>{handled ? "All caught up" : "Inbox is clear"}</span>
        <span className={styles.placeholderText}>{handled ? `Routed ${handled} ${handled === 1 ? "ticket" : "tickets"} this session.` : "New messages are classified and routed as they arrive."}</span>
      </div>
      : <div className={styles.ticket}>
        <div className={styles.from}>
          <ChannelMark channel={current.channel} />
          <span className={styles.fromText}><span className={styles.customer}>{current.customer}</span>{current.company ? <span className={styles.company}>{current.company}</span> : null}</span>
          <span className={styles.time}>{current.receivedAt ?? "now"}</span>
        </div>
        <p className={styles.subject}>{current.subject}</p>
        <p className={styles.preview}>{current.preview}</p>
      </div>;

  const classifyRow = rowKey === "none" ? null
    : rowKey === "error"
      ? <div className={styles.rowInner}>
        <span className={styles.errorText}><CircleAlert size={14} strokeWidth={1.75} aria-hidden="true" /><span className={styles.truncate}>{error}{simulated ? " Retrying." : ""}</span></span>
        <span className={styles.rowActions}>
          {reviewLane ? <Button variant="ghost" size="sm" onClick={sendToReview}>Send to review</Button> : null}
          <Button variant="secondary" size="sm" onClick={retry}><RotateCcw size={14} strokeWidth={1.75} aria-hidden="true" />Retry</Button>
        </span>
      </div>
      : rowKey === "labels" && result
        ? <div className={styles.rowInner}>
          <Labels result={result} low={low} reduced={reduced} />
          <span className={styles.routeSlot}>
            <AnimatePresence initial={false}>
              {showRoute && target ? <motion.span key="route" className={styles.route}
                initial={reduced ? { opacity: 0 } : { opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: reduced ? 0 : motionTokens.duration.fast, ease }}>
                <ArrowRight size={14} strokeWidth={1.75} className={styles.mutedIcon} aria-hidden="true" />
                {targetLane?.review ? <><CircleHelp size={14} strokeWidth={1.75} className={styles.reviewIcon} aria-hidden="true" /><span className={styles.routeLane}>{targetLane.label}</span></>
                  : <><span className={styles.routeLane}>{targetLane?.label}</span>{target.assignee ? <span className={styles.routeWho}><Avatar name={target.assignee.name} src={target.assignee.avatar} size="sm" className={styles.avatar20} /><span className={styles.truncate}>{target.assignee.name}</span></span> : null}</>}
              </motion.span> : null}
            </AnimatePresence>
          </span>
        </div>
        : <div className={styles.rowInner}><TextShimmer active={busy} className={styles.classifying}>{paused ? "Paused before classifying" : `Classifying with ${model}`}</TextShimmer></div>;

  const laneStyle = { "--n": lanes.length } as CSSProperties;

  return <section ref={root} className={cx(styles.root, className)} aria-labelledby={`${id}-title`} data-paused={paused || undefined} style={{ "--rows": maxVisible } as CSSProperties}>
    <header className={styles.header}>
      <span className={styles.modelMark} aria-hidden="true">{modelMark ?? <ClaudeMark width={16} height={16} title="" />}</span>
      <span className={styles.heading}>
        <span id={`${id}-title`} className={styles.title}>{title}</span>
        <span className={styles.model}>{model}</span>
      </span>
      <span className={styles.total}><Rolling value={total} reduced={reduced} /> routed today</span>
      <Button variant="secondary" size="sm" className={styles.pause} onClick={() => setPaused(!paused)}>
        {paused ? <Play size={14} strokeWidth={1.75} aria-hidden="true" /> : <Pause size={14} strokeWidth={1.75} aria-hidden="true" />}
        {paused ? "Resume" : "Pause"}
      </Button>
    </header>

    <div className={styles.incoming} data-phase={phase} data-low={low || undefined}>
      <div className={styles.stage}>
        <Swap swapKey={cardKey} reduced={reduced} travel={3}>
          {current && phase !== "connecting" ? <>
            {card}
            <div className={styles.classifyRow}>
              <Swap swapKey={rowKey} reduced={reduced}>{classifyRow}</Swap>
            </div>
          </> : card}
        </Swap>
      </div>
    </div>

    <div className={styles.connector} style={laneStyle} aria-hidden="true">
      <span className={styles.stubTop} />
      <span className={styles.rail} />
      {lanes.map((lane, index) => <span key={lane.id} className={styles.stub} style={{ "--i": index } as CSSProperties} />)}
      <AnimatePresence>
        {showRoute && targetIndex >= 0 && current ? <motion.span key={current.id} className={styles.pulse} data-review={targetLane?.review || undefined}
          style={{ "--i": targetIndex } as CSSProperties} initial={{ opacity: 1 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: motionTokens.duration.fast } }}>
          <motion.span className={styles.pulseTop} initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: .08, ease: "linear" }} />
          <motion.span className={styles.pulseRail} data-side={(targetIndex + .5) / lanes.length < .5 ? "left" : "right"} initial={reduced ? false : { scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: .16, ease: "linear", delay: .08 }} />
          <motion.span className={styles.pulseStub} initial={reduced ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: .08, ease: [.22, 1, .36, 1], delay: .24 }} />
        </motion.span> : null}
      </AnimatePresence>
    </div>

    <div className={styles.lanes} style={laneStyle}>
      {lanes.map(lane => {
        const rows = routed.filter(ticket => ticket.lane === lane.id).slice(0, rowsShown);
        const count = counts[lane.id] ?? 0;
        return <div key={lane.id} className={styles.lane} data-target={showRoute && target?.lane === lane.id || undefined} data-review={lane.review || undefined}>
          <div className={styles.laneHead}>
            <span className={styles.laneName}>{lane.label}</span>
            <span className={styles.laneCount}><Rolling value={count} reduced={reduced} /></span>
          </div>
          <ul className={styles.laneBody} aria-label={`${lane.label}, ${count} ${count === 1 ? "ticket" : "tickets"}`}>
            <AnimatePresence initial={false}>
              {rows.map(ticket => <motion.li key={ticket.id} className={styles.rowItem}
                initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
                transition={reduced ? { duration: 0 } : { height: sizeSpring, opacity: { duration: motionTokens.duration.fast, ease } }}>
                <LaneRow ticket={ticket} lane={lane} fresh={fresh.has(ticket.id)} suggested={laneById(ticket.suggestedLane)} onConfirm={confirmReview} />
              </motion.li>)}
            </AnimatePresence>
            {!rows.length ? <li className={styles.laneEmpty}>No tickets yet</li> : null}
          </ul>
        </div>;
      })}
    </div>

    <span className={styles.srOnly} role="status" aria-live="polite">{announcement}</span>
  </section>;
}

function LaneRow({ ticket, lane, fresh, suggested, onConfirm }: { ticket: RoutedTicket; lane: TicketLane; fresh: boolean; suggested?: TicketLane; onConfirm: (ticket: RoutedTicket) => void }) {
  const confidence = ticket.classification ? pct(ticket.classification.confidence) : undefined;
  const body = <>
    <ChannelMark channel={ticket.channel} size={14} />
    <span className={styles.rowSubject}>{ticket.subject}</span>
    <span className={styles.rowWho}>
      {lane.review ? <CircleHelp size={14} strokeWidth={1.75} className={styles.reviewIcon} aria-hidden="true" />
        : ticket.assignee ? <Avatar name={ticket.assignee.name} src={ticket.assignee.avatar} size="sm" className={styles.avatar16} /> : null}
    </span>
    <span className={styles.rowMeta}>
      {lane.review ? (suggested ? <><span className={styles.rowMetaStrong}>{suggested.label}</span>?<span className={styles.srOnly}> suggested</span></> : "Not classified")
        : ticket.assignee ? firstName(ticket.assignee.name) : "Unassigned"}
    </span>
    <span className={styles.rowPct}>{suggested ? <ArrowRight size={14} strokeWidth={1.75} className={styles.rowGo} aria-hidden="true" /> : null}<span>{confidence}</span></span>
  </>;
  if (lane.review && suggested) {
    return <button type="button" className={styles.row} data-fresh={fresh || undefined} onClick={() => onConfirm(ticket)}
      aria-label={`${ticket.subject}, from ${ticket.customer}. ${confidence ?? ""} confidence. Route to ${suggested.label}`} title={`Route to ${suggested.label}`}>{body}</button>;
  }
  return <div className={styles.row} data-fresh={fresh || undefined}
    aria-label={`${ticket.subject}, from ${ticket.customer}${ticket.assignee ? `, assigned to ${ticket.assignee.name}` : ""}`} role="group">{body}</div>;
}

export default TicketRouter;
