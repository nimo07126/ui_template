"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, FormEvent, ReactNode } from "react";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from "motion/react";
import type { AnimationPlaybackControls } from "motion/react";
import { ArrowUp, Bot, ChevronDown, CircleAlert, CircleCheck, Headset, LoaderCircle, RotateCcw } from "lucide-react";
import { motionTokens } from "../../lib/motion-tokens";
import { Avatar } from "../../avatar/avatar";
import { Button } from "../../button/button";
import { TextShimmer } from "../../text-shimmer/text-shimmer";
import { ClaudeMark, IntercomMark, NorthwindMark, ZendeskMark } from "./agent-handoff-marks";
import { sampleAgent, useHandoffSimulation } from "./agent-handoff-sim";
import type { HandoffScenario } from "./agent-handoff-sim";
import type { HandoffAgent, HandoffAssistant, HandoffMessage, HandoffProvider, HandoffStage, HandoffSummary, HandoffTyping } from "./agent-handoff-types";
import styles from "./agent-handoff.module.css";

export type { HandoffAgent, HandoffAssistant, HandoffMessage, HandoffProvider, HandoffSender, HandoffStage, HandoffSummary, HandoffSummaryField, HandoffTyping } from "./agent-handoff-types";
export { useHandoffSimulation } from "./agent-handoff-sim";
export type { HandoffScenario } from "./agent-handoff-sim";
export { ClaudeMark, IntercomMark, NorthwindMark, ZendeskMark } from "./agent-handoff-marks";

export interface AgentHandoffProps {
  /** Where the conversation is. Leave it out to play the built in simulated support chat. */
  stage?: HandoffStage;
  /** The conversation with the assistant, before the handoff. */
  messages?: HandoffMessage[];
  /** Everything after the handoff card: the customer's notes while waiting and the conversation with the person. */
  agentMessages?: HandoffMessage[];
  /** Who is typing right now. */
  typing?: HandoffTyping;
  /** What the assistant passes to the person. Shown in the handoff card from `transferring` on. */
  summary?: HandoffSummary;
  /** The AI assistant. Defaults to "Assistant" with the Claude mark. */
  assistant?: HandoffAssistant;
  /** The person who takes over. Required from `connected` on. */
  agent?: HandoffAgent;
  /** The help desk the conversation moves to. Defaults to Intercom. */
  provider?: HandoffProvider;
  /** Typical wait shown while transferring. Defaults to "2 min". */
  replyEstimate?: string;
  /** Header title, such as the order or ticket. */
  title?: string;
  subtitle?: string;
  /** Your brand mark, shown before the title at 28px. */
  logo?: ReactNode;
  /** Shows the composer. Called with the trimmed text; add the message to `messages` or `agentMessages` yourself. */
  onSend?: (text: string) => void;
  /** Shows a "Talk to a person" reply under the assistant's last answer. */
  onRequestHuman?: () => void;
  /** Shows Cancel on the handoff card while transferring. */
  onCancelTransfer?: () => void;
  /** Shows Try again on the handoff card when nobody is available. */
  onRetry?: () => void;
  /** Composer placeholder. Defaults to one that follows the stage. */
  placeholder?: string;
  /** Card height. The thread scrolls inside and stays pinned to the newest message. Defaults to 600. */
  height?: number | string;
  /** A one-off message for screen readers, such as the result of an action. */
  notice?: string;
  /** Simulation only: which story the built in demo plays. */
  scenario?: HandoffScenario;
  className?: string;
}

interface ViewProps extends AgentHandoffProps {
  stage: HandoffStage;
  runKey?: number;
  onReplay?: () => void;
  onVisibleChange?: (visible: boolean) => void;
}

const ease = [...motionTokens.ease.standard] as [number, number, number, number];
const sizeSpring = { type: "spring", visualDuration: .24, bounce: 0 } as const;
const fade = { duration: motionTokens.duration.fast, ease };
const swap = { initial: { opacity: 0, y: 2 }, animate: { opacity: 1, y: 0, transition: fade }, exit: { opacity: 0, transition: { duration: .1, ease } } };
const defaultAssistant = { name: "Assistant", model: "Claude Sonnet 5.5" };

/**
 * A support conversation where an AI assistant hands off to a person. The assistant answers first; when it hands off, a card
 * shows the summary it passes to the team and the typical wait, then the person joins and takes over. A thin timeline on the
 * left marks each step. With no props it plays a simulated furniture order chat.
 */
export function AgentHandoff(props: AgentHandoffProps) {
  if (props.stage === undefined) return <SimulatedAgentHandoff {...props} />;
  return <AgentHandoffView {...props} stage={props.stage} />;
}

function SimulatedAgentHandoff(props: AgentHandoffProps) {
  const reduced = !!useReducedMotion();
  const sim = useHandoffSimulation(props.scenario ?? "handoff", reduced);
  return <AgentHandoffView title="Order NW-48213" subtitle="Northwind Home support" logo={<NorthwindMark aria-hidden="true" />} agent={sampleAgent} {...props}
    stage={sim.stage} messages={sim.messages} agentMessages={sim.agentMessages} typing={sim.typing} summary={sim.summary} notice={sim.notice}
    onSend={sim.onSend} onRequestHuman={sim.onRequestHuman} onCancelTransfer={sim.onCancelTransfer} onRetry={sim.onRetry}
    runKey={sim.runId} onReplay={sim.onReplay} onVisibleChange={sim.setVisible} />;
}

type Row =
  | { kind: "assistant-node"; key: string }
  | { kind: "message"; key: string; message: HandoffMessage }
  | { kind: "handoff"; key: string }
  | { kind: "agent-node"; key: string }
  | { kind: "resolved-node"; key: string }
  | { kind: "typing"; key: string; who: "assistant" | "agent" }
  | { kind: "ask"; key: string };

function buildRows(p: { stage: HandoffStage; messages: HandoffMessage[]; agentMessages: HandoffMessage[]; typing: HandoffTyping; canAsk: boolean }) {
  const rows: Row[] = [];
  const handedOff = p.stage !== "assistant";
  const joined = p.stage === "connected" || p.stage === "resolved";
  if (p.messages.length || (p.typing === "assistant" && !handedOff)) rows.push({ kind: "assistant-node", key: "assistant-node" });
  for (const message of p.messages) rows.push({ kind: "message", key: message.id, message });
  if (handedOff) {
    rows.push({ kind: "handoff", key: "handoff" });
    let placed = false;
    for (const message of p.agentMessages) {
      if (joined && !placed && message.from === "agent") { rows.push({ kind: "agent-node", key: "agent-node" }); placed = true; }
      rows.push({ kind: "message", key: message.id, message });
    }
    if (joined && !placed) rows.push({ kind: "agent-node", key: "agent-node" });
  }
  if (p.typing === "assistant" && !handedOff) rows.push({ kind: "typing", key: "typing-assistant", who: "assistant" });
  if (p.typing === "agent" && joined) rows.push({ kind: "typing", key: "typing-agent", who: "agent" });
  if (p.stage === "resolved") rows.push({ kind: "resolved-node", key: "resolved-node" });
  const streaming = p.messages.some(m => m.streaming);
  if (p.stage === "assistant" && p.canAsk && !p.typing && !streaming && p.messages.length) rows.push({ kind: "ask", key: "ask" });
  return rows;
}

const sender = (row: Row | undefined) => row?.kind === "message" ? row.message.from : row?.kind === "typing" ? row.who : row?.kind === "ask" ? "customer" : undefined;
const isNode = (row: Row | undefined) => row?.kind === "assistant-node" || row?.kind === "agent-node" || row?.kind === "resolved-node";

/** Space above a row, from one 4/8/12/16 scale: tight within a speaker, wider between speakers, widest before a new step. */
function gapBefore(row: Row, prev: Row | undefined) {
  if (!prev) return 0;
  if (isNode(row) || row.kind === "handoff" || prev.kind === "handoff") return 16;
  if (isNode(prev)) return 8;
  return sender(row) === sender(prev) ? 4 : 12;
}

function AgentHandoffView({ stage, messages = [], agentMessages = [], typing = null, summary, assistant, agent, provider = "intercom", replyEstimate = "2 min",
  title = "Support chat", subtitle, logo, onSend, onRequestHuman, onCancelTransfer, onRetry, placeholder, height = 600, notice, className, runKey = 0, onReplay, onVisibleChange }: ViewProps) {
  const reduced = !!useReducedMotion();
  const rootRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);
  const visibleCallback = useRef(onVisibleChange);
  useEffect(() => { visibleCallback.current = onVisibleChange; }, [onVisibleChange]);

  // Loops (the travel dot, typing dots, shimmer) pause while the card is off screen; so does the demo script.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => { setPaused(!entry.isIntersecting); visibleCallback.current?.(entry.isIntersecting); });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const ai = { ...defaultAssistant, ...assistant };
  const desk = provider === "intercom" ? { name: "Intercom", mark: <IntercomMark aria-hidden="true" /> } : provider === "zendesk" ? { name: "Zendesk", mark: <ZendeskMark aria-hidden="true" /> } : provider;
  const person = agent ?? { name: "Support" };
  const firstName = person.name.split(" ")[0];
  const rows = buildRows({ stage, messages, agentMessages, typing, canAsk: !!onRequestHuman });
  const empty = rows.length === 0;
  const firstTime = messages[0]?.time;

  const style = { "--handoff-height": typeof height === "number" ? `${height}px` : height } as CSSProperties;

  const renderRow = (row: Row) => {
    switch (row.kind) {
      case "assistant-node":
        return <Node mark={<span className={styles.modelMark}>{ai.mark ?? <ClaudeMark aria-hidden="true" />}</span>} title={ai.name} meta={ai.model} time={firstTime} />;
      case "agent-node":
        return <Node mark={<Avatar name={person.name} src={person.avatar} size="sm" className={styles.nodeAvatar} />} title={`${person.name} joined`} meta={person.role} time={person.joinedAt} />;
      case "resolved-node":
        return <Node mark={<CircleCheck className={styles.resolvedIcon} aria-hidden="true" />} title="Resolved" meta={`by ${person.name}`} />;
      case "message":
        return <Bubble message={row.message} reduced={reduced} />;
      case "typing":
        return row.who === "assistant"
          ? <div className={styles.thinking}><TextShimmer duration={1.4}>Thinking</TextShimmer></div>
          : <div className={styles.bubble} data-from="agent" data-typing="" role="img" aria-label={`${firstName} is typing`}><i /><i /><i /></div>;
      case "ask":
        return <div className={styles.askRow}><button type="button" className={styles.ask} onClick={onRequestHuman}><Headset aria-hidden="true" />Talk to a person</button></div>;
      case "handoff":
        return <HandoffCard stage={stage} summary={summary} desk={desk} personName={person.name} replyEstimate={replyEstimate} onCancel={onCancelTransfer} onRetry={onRetry} />;
    }
  };

  return <section ref={rootRef} className={[styles.root, className].filter(Boolean).join(" ")} style={style} data-paused={paused || undefined} data-reduced={reduced || undefined} aria-label={title}>
    <header className={styles.header}>
      {logo && <span className={styles.logo}>{logo}</span>}
      <div className={styles.heading}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      <div className={styles.headerEnd}>
        <StageChip stage={stage} name={firstName} />
        {onReplay && <Button variant="ghost" size="sm" aria-label="Replay the demo" title="Replay" onClick={onReplay}><RotateCcw aria-hidden="true" /></Button>}
      </div>
    </header>

    <div className={styles.scroll} role="log" aria-live="off" aria-label="Conversation" tabIndex={0}>
      <div className={styles.fill}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={runKey} className={styles.run} initial={{ opacity: 0 }} animate={{ opacity: 1, transition: fade }} exit={{ opacity: 0, transition: { duration: .12, ease } }}>
            {empty
              ? <div className={styles.empty}>
                  <span className={styles.modelMark}>{ai.mark ?? <ClaudeMark aria-hidden="true" />}</span>
                  <p className={styles.emptyTitle}>Ask the {ai.name.toLowerCase()} anything</p>
                  <p className={styles.emptyMeta}>A person from the team can join at any time.</p>
                </div>
              : <AutoHeight reduced={reduced}>
                  <ol className={styles.thread}>
                    {/* Rows that arrive after the first paint fade in; the first paint never fades. */}
                    <AnimatePresence initial={false}>
                      {rows.map((row, index) => <ThreadRow key={row.key} row={row} gap={gapBefore(row, rows[index - 1])} travel={row.kind === "handoff" && stage === "transferring" && !reduced}>{renderRow(row)}</ThreadRow>)}
                    </AnimatePresence>
                  </ol>
                </AutoHeight>}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>

    {onSend && <Composer stage={stage} name={firstName} assistantName={ai.name} placeholder={placeholder} onSend={onSend} />}
    <p className={styles.srOnly} role="status" aria-live="polite">{notice}</p>
  </section>;
}

/** One row of the thread. New rows fade in; the thread's measured height glides, so nothing below snaps. */
function ThreadRow({ row, gap, travel, children }: { row: Row; gap: number; travel: boolean; children: ReactNode }) {
  const node = isNode(row) || row.kind === "handoff";
  return <motion.li className={styles.row} data-kind={row.kind} data-node={node || undefined} style={{ paddingTop: gap, "--gap": `${gap}px` } as CSSProperties}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
    <div className={styles.gutter} aria-hidden="true">{travel && <span className={styles.travel}><i /></span>}</div>
    <div className={styles.body}>{children}</div>
  </motion.li>;
}

function Node({ mark, title, meta, time }: { mark: ReactNode; title: string; meta?: string; time?: string }) {
  return <div className={styles.node}>
    <span className={styles.nodeMark}>{mark}</span>
    <span className={styles.nodeText}>
      <span className={styles.nodeTitle}>{title}</span>
      {meta && <span className={styles.nodeMeta}>{meta}</span>}
    </span>
    {time && <time className={styles.time}>{time}</time>}
  </div>;
}

function Bubble({ message, reduced }: { message: HandoffMessage; reduced: boolean }) {
  return <div className={styles.bubble} data-from={message.from} data-streaming={message.streaming || undefined}>
    <StreamText text={message.text} streaming={!!message.streaming && !reduced} />
  </div>;
}

/** Streams like a hosted model: each arriving chunk only fades in. Works with real token streams as long as text grows by appending. */
function StreamText({ text, streaming }: { text: string; streaming: boolean }) {
  const [state, setState] = useState(() => ({ seen: text, chunks: text ? [text] : [] as string[] }));
  let chunks = state.chunks;
  if (state.seen !== text) {
    chunks = text.startsWith(state.seen) ? [...state.chunks, text.slice(state.seen.length)] : [text];
    setState({ seen: text, chunks });
  }
  if (!streaming) return <>{text}</>;
  return <>{chunks.map((part, i) => <span key={i} className={styles.chunk}>{part}</span>)}</>;
}

function HandoffCard({ stage, summary, desk, personName, replyEstimate, onCancel, onRetry }: {
  stage: HandoffStage; summary?: HandoffSummary; desk: { name: string; mark: ReactNode }; personName: string; replyEstimate: string; onCancel?: () => void; onRetry?: () => void;
}) {
  const [open, setOpen] = useState(true);
  const status = stage === "transferring"
    ? { key: "transferring", title: <TextShimmer duration={1.6}>Transferring to a person</TextShimmer>, meta: `${desk.name} · typical reply in ${replyEstimate}` }
    : stage === "unavailable"
      ? { key: "unavailable", title: "No one is available right now", meta: `${desk.name} · the team replies by email` }
      : { key: "done", title: `Transferred to ${personName}`, meta: `${desk.name} · summary read` };
  const action = stage === "transferring" && onCancel
    ? <Button key="cancel" variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
    : stage === "unavailable" && onRetry
      ? <Button key="retry" variant="primary" size="sm" onClick={onRetry}>Try again</Button>
      : null;
  const summaryId = useId();

  return <div className={styles.handoff}>
    <span className={styles.deskMark} aria-hidden="true">{desk.mark}</span>
    <section className={styles.card} aria-label="Handoff to a person">
      <div className={styles.cardHead}>
        <div className={styles.cardStatus}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div key={status.key} className={styles.cardStatusInner} {...swap}>
              <span className={styles.cardTitle}>
                {stage === "unavailable" && <CircleAlert className={styles.warnIcon} aria-hidden="true" />}
                {(stage === "connected" || stage === "resolved") && <CircleCheck className={styles.okIcon} aria-hidden="true" />}
                {status.title}
              </span>
              <span className={styles.cardMeta}>{status.meta}</span>
            </motion.div>
          </AnimatePresence>
        </div>
        <div className={styles.cardAction}>
          <AnimatePresence mode="popLayout" initial={false}>
            {action && <motion.div key={action.key} {...swap}>{action}</motion.div>}
          </AnimatePresence>
        </div>
      </div>
      {summary && <>
        <button type="button" className={styles.summaryToggle} aria-expanded={open} aria-controls={summaryId} onClick={() => setOpen(value => !value)}>
          <span>Summary shared with the team</span>
          <ChevronDown className={styles.chevron} data-open={open || undefined} aria-hidden="true" />
        </button>
        <AnimatePresence initial={false}>{open && <motion.div id={summaryId} className={styles.summary} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={fade}>
          <p className={styles.issue}>{summary.issue}</p>
          {!!summary.fields?.length && <dl className={styles.fields}>
            {summary.fields.map(field => <div key={field.label} className={styles.field}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}
          </dl>}
        </motion.div>}</AnimatePresence>
      </>}
    </section>
  </div>;
}

function StageChip({ stage, name }: { stage: HandoffStage; name: string }) {
  const chip = {
    assistant: { icon: <Bot aria-hidden="true" />, label: "Assistant" },
    transferring: { icon: <LoaderCircle className={styles.spin} aria-hidden="true" />, label: "Transferring" },
    connected: { icon: <Headset aria-hidden="true" />, label: `With ${name}` },
    resolved: { icon: <CircleCheck className={styles.okIcon} aria-hidden="true" />, label: "Resolved" },
    unavailable: { icon: <CircleAlert className={styles.warnIcon} aria-hidden="true" />, label: "No one available" },
  }[stage];
  return <span className={styles.chip}>
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={stage} className={styles.chipInner} {...swap}>{chip.icon}{chip.label}</motion.span>
    </AnimatePresence>
  </span>;
}

function Composer({ stage, name, assistantName, placeholder, onSend }: { stage: HandoffStage; name: string; assistantName: string; placeholder?: string; onSend: (text: string) => void }) {
  const [value, setValue] = useState("");
  const hint = placeholder ?? {
    assistant: `Message the ${assistantName.toLowerCase()}`,
    transferring: "Add details for the team",
    connected: `Message ${name}`,
    resolved: `Reply to ${name}`,
    unavailable: "Leave a message for the team",
  }[stage];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = value.trim();
    if (!text) return;
    onSend(text);
    setValue("");
  };
  return <form className={styles.composer} onSubmit={submit}>
    <input className={styles.input} value={value} onChange={event => setValue(event.target.value)} placeholder={hint} aria-label="Message" enterKeyHint="send" autoComplete="off" />
    <Button type="submit" variant="primary" size="sm" className={styles.send} aria-label="Send" disabled={!value.trim()}><ArrowUp aria-hidden="true" /></Button>
  </form>;
}

/** Animates the thread to its measured height with a bounce-free spring, so new rows and streamed lines push the thread up smoothly. */
function AutoHeight({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const inner = useRef<HTMLDivElement>(null);
  const height = useMotionValue<number | "auto">("auto");
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    let first = true;
    let controls: AnimationPlaybackControls | undefined;
    const observer = new ResizeObserver(() => {
      const next = node.offsetHeight;
      if (first || reduced) { controls?.stop(); height.set(next); first = false; return; }
      controls?.stop();
      controls = animate(height, next, sizeSpring);
    });
    observer.observe(node);
    return () => { observer.disconnect(); controls?.stop(); };
  }, [height, reduced]);
  return <motion.div className={styles.clip} style={{ height }}><div ref={inner}>{children}</div></motion.div>;
}

export default AgentHandoff;
