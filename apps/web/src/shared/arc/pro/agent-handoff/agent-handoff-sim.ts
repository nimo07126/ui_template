"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { avatar } from "../lib/media";
import type { HandoffAgent, HandoffMessage, HandoffStage, HandoffSummary, HandoffTyping } from "./agent-handoff-types";

/** `handoff` plays a full transfer to a person. `unavailable` stops when nobody picks the transfer up, so Try again shows. */
export type HandoffScenario = "handoff" | "unavailable";

export const sampleAgent: HandoffAgent = { name: "Jordan Reyes", role: "Support specialist", avatar: avatar("jordan-reyes"), joinedAt: "14:05" };

const fullSummary: HandoffSummary = {
  issue: "Halden desk in white oak arrived with a cracked leg and a scratched top. Priya wants a full refund, not a replacement.",
  fields: [
    { label: "Order", value: "NW-48213 · delivered Oct 27" },
    { label: "Paid", value: "$649 · $150 gift card, $499 Visa 4417" },
    { label: "Asks for", value: "Full refund" },
  ],
};

const shortSummary: HandoffSummary = {
  issue: "Halden desk in white oak arrived with a cracked leg. Priya asked to talk to a person before choosing a fix.",
  fields: [
    { label: "Order", value: "NW-48213 · delivered Oct 27" },
    { label: "Paid", value: "$649 · $150 gift card, $499 Visa 4417" },
    { label: "Asks for", value: "Not decided yet" },
  ],
};

const lines = {
  c1: "Hi, my Halden desk arrived this morning with a cracked leg. Order NW-48213.",
  a1: "Sorry about that, Priya. I found order NW-48213, the Halden desk in white oak, delivered today at 11:42. I can ship a replacement leg in 2 business days, or start a return.",
  c2: "The top is scratched too, so I'd rather have a refund. I paid with a $150 gift card and my Visa.",
  a2: "Refunds split across a gift card and a card need someone on our team. I'm passing everything along, so you won't have to repeat yourself.",
  j1: "Hi Priya, I'm Jordan. I read the summary, so no need to repeat anything. I've refunded $150 to your gift card and $499 to your Visa ending 4417.",
  j2: "The Visa refund shows up in 3 to 5 business days. A courier picks up the desk on Thursday, Oct 29, between 9:00 and 12:00.",
  c3: "That's perfect, thank you!",
  j1Short: "Hi Priya, I'm Jordan. I read the summary, so no need to repeat anything. Would you like a replacement leg, or a full refund?",
  ask: "Can I talk to a person?",
  askReply: "Of course. I'm passing along everything we covered, so you won't have to repeat yourself.",
  cancelReply: "No problem, I'm still here. Ask for a person whenever you're ready and I'll pass this along.",
  noteReply: "Thanks, I've noted that. I can also bring in a person from our team if you'd like.",
  agentNote: "Thanks, Priya. I've added that to your case.",
};

interface SimState {
  runId: number;
  stage: HandoffStage;
  messages: HandoffMessage[];
  agentMessages: HandoffMessage[];
  typing: HandoffTyping;
  summary: HandoffSummary;
  notice: string;
}

const initialState = (runId: number): SimState => ({ runId, stage: "assistant", messages: [], agentMessages: [], typing: null, summary: fullSummary, notice: "" });

class Aborted extends Error {}

/** Chunks of 3 to 8 words, the way hosted models stream. */
function chunk(text: string) {
  const words = text.split(/(?<=\s)/);
  const out: string[] = [];
  for (let i = 0; i < words.length;) {
    const size = 3 + ((i * 7 + words.length) % 6);
    out.push(words.slice(i, i + size).join(""));
    i += size;
  }
  return out;
}

/**
 * Drives the built in demo: a furniture order support chat where the assistant hands off to a person. Waits pause while the
 * card is off screen, every action interrupts the script, and after a user action the loop stops until Replay.
 */
export function useHandoffSimulation(scenario: HandoffScenario, reduced: boolean) {
  const [state, setState] = useState<SimState>(() => initialState(0));
  const visible = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const flags = useRef({ askedRefund: false, interacted: false, retried: false });
  const ids = useRef(0);
  const reducedRef = useRef(reduced);
  useEffect(() => { reducedRef.current = reduced; }, [reduced]);

  const patch = useCallback((next: Partial<SimState> | ((s: SimState) => Partial<SimState>)) => setState(s => ({ ...s, ...(typeof next === "function" ? next(s) : next) })), []);

  const wait = useCallback(async (ms: number, signal: AbortSignal) => {
    let remaining = ms;
    while (remaining > 0) {
      const step = Math.min(remaining, 80);
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, step);
        signal.addEventListener("abort", () => { clearTimeout(timer); reject(new Aborted()); }, { once: true });
      });
      if (signal.aborted) throw new Aborted();
      if (visible.current) remaining -= step;
    }
  }, []);

  const add = useCallback((list: "messages" | "agentMessages", message: Omit<HandoffMessage, "id">) => {
    const id = `m${++ids.current}`;
    patch(s => ({ [list]: [...s[list], { ...message, id }] }));
    return id;
  }, [patch]);

  const stream = useCallback(async (list: "messages" | "agentMessages", text: string, signal: AbortSignal, time?: string) => {
    if (reducedRef.current) { add(list, { from: "assistant", text, time }); return; }
    const id = add(list, { from: "assistant", text: "", time, streaming: true });
    let shown = "";
    try {
      for (const part of chunk(text)) {
        await wait(34, signal);
        shown += part;
        const value = shown;
        patch(s => ({ [list]: s[list].map(m => m.id === id ? { ...m, text: value } : m) }));
      }
    } finally {
      // An interrupted reply keeps what arrived, like a stopped generation.
      patch(s => ({ [list]: s[list].map(m => m.id === id ? { ...m, streaming: false } : m).filter(m => m.text) }));
    }
  }, [add, patch, wait]);

  const think = useCallback(async (who: "assistant" | "agent", ms: number, signal: AbortSignal) => {
    patch({ typing: who });
    try { await wait(ms, signal); } finally { patch({ typing: null }); }
  }, [patch, wait]);

  const run = useCallback((task: (signal: AbortSignal) => Promise<void>) => {
    controller.current?.abort();
    const next = new AbortController();
    controller.current = next;
    task(next.signal).catch(error => { if (!(error instanceof Aborted)) throw error; });
  }, []);

  const connect = useCallback(async (signal: AbortSignal) => {
    patch({ stage: "connected", notice: `${sampleAgent.name} joined the conversation.` });
    const full = flags.current.askedRefund;
    await wait(500, signal);
    await think("agent", 950, signal);
    add("agentMessages", { from: "agent", text: full ? lines.j1 : lines.j1Short, time: "14:05" });
    if (!full) return;
    patch({ notice: "Refund issued. Simulated, no money moved." });
    await wait(600, signal);
    await think("agent", 1200, signal);
    add("agentMessages", { from: "agent", text: lines.j2, time: "14:06" });
    await wait(1400, signal);
    add("agentMessages", { from: "customer", text: lines.c3, time: "14:06" });
    await wait(700, signal);
    patch({ stage: "resolved", notice: `Resolved by ${sampleAgent.name}.` });
  }, [add, patch, think, wait]);

  const transfer = useCallback(async (signal: AbortSignal, waitMs = 2600) => {
    patch({ stage: "transferring", summary: flags.current.askedRefund ? fullSummary : shortSummary, notice: "Transferring to a person through Intercom. Simulated, nothing was sent." });
    await wait(waitMs, signal);
    if (scenario === "unavailable" && !flags.current.retried) {
      patch({ stage: "unavailable", notice: "No one is available right now. Try again, or keep writing and the team replies by email." });
      return;
    }
    await connect(signal);
  }, [connect, patch, scenario, wait]);

  const restartRef = useRef<() => void>(() => {});
  const playFromStart = useCallback((signal: AbortSignal) => (async () => {
    await wait(350, signal);
    add("messages", { from: "customer", text: lines.c1, time: "14:02" });
    await wait(350, signal);
    await think("assistant", 750, signal);
    await stream("messages", lines.a1, signal, "14:02");
    await wait(1500, signal);
    add("messages", { from: "customer", text: lines.c2, time: "14:03" });
    flags.current.askedRefund = true;
    await wait(350, signal);
    await think("assistant", 850, signal);
    await stream("messages", lines.a2, signal, "14:03");
    await wait(900, signal);
    await transfer(signal);
    if (flags.current.interacted || reducedRef.current) return;
    await wait(4200, signal);
    if (flags.current.interacted) return;
    restartRef.current();
  })(), [add, stream, think, transfer, wait]);

  const restart = useCallback(() => {
    flags.current = { askedRefund: false, interacted: false, retried: false };
    setState(s => initialState(s.runId + 1));
    run(playFromStart);
  }, [playFromStart, run]);
  useEffect(() => { restartRef.current = restart; }, [restart]);

  useEffect(() => {
    run(playFromStart);
    return () => controller.current?.abort();
    // Starts once; Replay and the scenario switch restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scenarioRef = useRef(scenario);
  useEffect(() => {
    if (scenarioRef.current === scenario) return;
    scenarioRef.current = scenario;
    restart();
  }, [restart, scenario]);

  const interact = () => { flags.current.interacted = true; };

  const onRequestHuman = useCallback(() => {
    interact();
    run(async signal => {
      add("messages", { from: "customer", text: lines.ask, time: "14:04" });
      await wait(300, signal);
      await think("assistant", 650, signal);
      await stream("messages", lines.askReply, signal, "14:04");
      await wait(600, signal);
      await transfer(signal);
    });
  }, [add, run, stream, think, transfer, wait]);

  const onCancelTransfer = useCallback(() => {
    interact();
    run(async signal => {
      patch({ stage: "assistant", agentMessages: [], notice: "Transfer canceled. The assistant is still here." });
      await wait(250, signal);
      await think("assistant", 600, signal);
      await stream("messages", lines.cancelReply, signal, "14:04");
    });
  }, [patch, run, stream, think, wait]);

  const onRetry = useCallback(() => {
    interact();
    flags.current.retried = true;
    run(signal => transfer(signal, 1600));
  }, [run, transfer]);

  const onSend = useCallback((text: string) => {
    const stage = state.stage;
    if (stage === "transferring") {
      add("agentMessages", { from: "customer", text, time: "14:04" });
      patch({ notice: "Added for the team. Simulated, nothing was sent." });
      return;
    }
    if (stage === "unavailable") {
      add("agentMessages", { from: "customer", text, time: "14:05" });
      patch({ notice: "Saved. The team replies by email. Simulated, nothing was sent." });
      return;
    }
    interact();
    if (stage === "assistant") {
      run(async signal => {
        add("messages", { from: "customer", text, time: "14:04" });
        patch({ notice: "Message sent to the assistant. Simulated, nothing was sent." });
        await wait(300, signal);
        await think("assistant", 700, signal);
        await stream("messages", lines.noteReply, signal, "14:04");
      });
      return;
    }
    run(async signal => {
      add("agentMessages", { from: "customer", text, time: "14:07" });
      patch({ stage: "connected", notice: `Message sent to ${sampleAgent.name}. Simulated, nothing was sent.` });
      await wait(400, signal);
      await think("agent", 1100, signal);
      add("agentMessages", { from: "agent", text: lines.agentNote, time: "14:07" });
    });
  }, [add, patch, run, state.stage, stream, think, wait]);

  const setVisible = useCallback((value: boolean) => { visible.current = value; }, []);

  return { ...state, onRequestHuman, onCancelTransfer, onRetry, onSend, onReplay: restart, setVisible };
}
