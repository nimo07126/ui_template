/* Types, sample email and the local draft simulation for the reply draft. Nothing here calls a network. */
import type { ReactNode } from "react";
import { avatar } from "../lib/media";

export type ReplyDraftTone = "friendly" | "concise" | "formal";
export type ReplyDraftLength = "short" | "medium" | "long";

export interface ReplyDraftMessage {
  from: { name: string; email: string; avatar?: string };
  /** Shown after "to", for example "me" or "sales@halden.io". */
  to?: string;
  subject: string;
  /** Plain text. Blank lines separate paragraphs. */
  body: string;
  /** Preformatted time, for example "9:14 AM". */
  receivedAt: string;
}

export interface ReplyDraftSuggestion {
  id: string;
  /** Short chip label, for example "Thursday works". */
  label: string;
}

export interface ReplyDraftModel {
  name: string;
  /** A 16px mark. Defaults to the Claude mark. */
  mark?: ReactNode;
}

export interface ReplyDraftRequest {
  message: ReplyDraftMessage;
  tone: ReplyDraftTone;
  length: ReplyDraftLength;
  /** The quick reply that steers the draft, if one is selected. */
  suggestion?: ReplyDraftSuggestion;
  /** "draft" streams a fresh reply, "rewrite" restyles the current one for a new tone or length. */
  mode: "draft" | "rewrite";
  /** The current draft text, including the reader's edits, when rewriting. */
  previous?: string;
  signal: AbortSignal;
}

/** Return the whole draft, or stream it as text chunks. Throw to show the error state. */
export type ReplyDraftGenerate = (request: ReplyDraftRequest) => Promise<string> | AsyncIterable<string>;

export const replyDraftTones: { value: ReplyDraftTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "concise", label: "Concise" },
  { value: "formal", label: "Formal" },
];

export const replyDraftLengths: { value: ReplyDraftLength; label: string }[] = [
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export const replyDraftSampleMessage: ReplyDraftMessage = {
  from: { name: "Diane Foster", email: "diane.foster@haldenlogistics.com", avatar: avatar("diane-foster") },
  to: "me",
  subject: "Renewal call next week and an SSO question",
  body: "Hi Ryan,\n\nThanks for the updated quote. Before we sign the renewal for 180 seats, could we move Wednesday's call to Thursday afternoon? Our IT lead also wants to confirm that SAML SSO with Okta is included on the Business plan.\n\nBest,\nDiane",
  receivedAt: "9:14 AM",
};

export const replyDraftSampleSuggestions: ReplyDraftSuggestion[] = [
  { id: "thursday", label: "Thursday works" },
  { id: "friday", label: "Suggest Friday" },
  { id: "loop-in", label: "Loop in Daniel" },
];

export const replyDraftSampleModel: ReplyDraftModel = { name: "Claude Sonnet 5.5" };

/* Four sentences per reply and tone. Short keeps two, medium three, long all four over two paragraphs. */
const sentences: Record<string, Record<ReplyDraftTone, string[]>> = {
  thursday: {
    friendly: [
      "Thursday afternoon works great, I've moved our call to 2:00 PM and sent you an updated invite.",
      "Good news for your IT lead too: SAML SSO with Okta is included on the Business plan at no extra cost.",
      "Happy to send our Okta setup guide beforehand so they can take a look.",
      "Looking forward to getting all 180 seats renewed with you!",
    ],
    concise: [
      "Thursday at 2:00 PM works, updated invite sent.",
      "SAML SSO with Okta is included on the Business plan.",
      "I can share the Okta setup guide if useful.",
      "The renewal for 180 seats is ready to sign.",
    ],
    formal: [
      "Thank you for your note. I have moved our call to Thursday at 2:00 PM and sent an updated invitation.",
      "I can also confirm that SAML single sign-on with Okta is included in the Business plan.",
      "Should your IT lead wish to review the configuration in advance, I would be glad to share our Okta setup guide.",
      "We look forward to continuing our partnership with the renewal of your 180 seats.",
    ],
  },
  friday: {
    friendly: [
      "Thursday's packed on my end, unfortunately. Would Friday at 10:00 AM work instead?",
      "On SSO: yes, SAML with Okta is included on the Business plan, so your IT lead is all set.",
      "If Friday doesn't suit, send me a couple of times and I'll make one work.",
      "Thanks again for the quick turnaround on the quote!",
    ],
    concise: [
      "Thursday is full for me. Does Friday at 10:00 AM work?",
      "SAML SSO with Okta is included on Business.",
      "Otherwise, send two times that suit you.",
      "The quote stays valid through November 14.",
    ],
    formal: [
      "Unfortunately, I am unavailable on Thursday afternoon. Might Friday at 10:00 AM suit you instead?",
      "Regarding your IT lead's question, SAML single sign-on with Okta is included in the Business plan.",
      "If Friday is not convenient, please let me know a few times that work for your team.",
      "The quote remains valid through November 14.",
    ],
  },
  "loop-in": {
    friendly: [
      "Thursday afternoon works, I'll send an invite for 2:00 PM.",
      "I'm looping in Daniel Kim from our solutions team, who set up Okta SSO for three customers this month.",
      "He can join the call and answer anything your IT lead throws at him.",
      "Thanks for keeping things moving, Diane!",
    ],
    concise: [
      "Thursday at 2:00 PM works, invite to follow.",
      "Adding Daniel Kim from solutions for the SSO questions.",
      "He'll join the call to cover the Okta setup.",
      "Renewal paperwork is ready when you are.",
    ],
    formal: [
      "Thursday at 2:00 PM suits us well, and I will send an invitation shortly.",
      "I have copied my colleague Daniel Kim, a solutions engineer, who can address your IT lead's questions about Okta SSO.",
      "He will join the call to walk through the configuration in detail.",
      "Thank you for your continued partnership.",
    ],
  },
};

const greeting: Record<ReplyDraftTone, (name: string) => string> = {
  friendly: name => `Hi ${name},`,
  concise: name => `Hi ${name},`,
  formal: name => `Dear ${name},`,
};

const signOff: Record<ReplyDraftTone, string> = {
  friendly: "Talk soon,\nRyan",
  concise: "Best,\nRyan",
  formal: "Kind regards,\nRyan Sullivan",
};

/** Composes the sample reply for a tone, length and quick reply. */
export function composeSampleReply(request: Pick<ReplyDraftRequest, "message" | "tone" | "length" | "suggestion">) {
  const set = sentences[request.suggestion?.id ?? "thursday"] ?? sentences.thursday;
  const lines = set[request.tone];
  const first = request.message.from.name.split(" ")[0] ?? request.message.from.name;
  const body = request.length === "short" ? lines.slice(0, 2).join(" ")
    : request.length === "medium" ? lines.slice(0, 3).join(" ")
    : `${lines.slice(0, 2).join(" ")}\n\n${lines.slice(2).join(" ")}`;
  return `${greeting[request.tone](first)}\n\n${body}\n\n${signOff[request.tone]}`;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return; }
  const timer = setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
  const stop = () => { clearTimeout(timer); reject(signal.reason); };
  signal.addEventListener("abort", stop, { once: true });
});

/** Splits text into chunks of 3 to 8 words, keeping whitespace and line breaks attached. */
export function chunkText(text: string) {
  const tokens = text.match(/\S+\s*/g) ?? [];
  const chunks: string[] = [];
  let index = 0, step = 0;
  while (index < tokens.length) {
    const size = 3 + ((step * 7 + 3) % 6);
    chunks.push(tokens.slice(index, index + size).join(""));
    index += size;
    step += 1;
  }
  const lead = text.match(/^\s*/)?.[0] ?? "";
  if (lead && chunks.length) chunks[0] = lead + chunks[0];
  return chunks;
}

/** Streams any finished text in chunks every 34ms, so a Promise-based generator reads like a live stream. */
export async function* streamText(text: string, signal: AbortSignal, tick = 34): AsyncGenerator<string> {
  for (const chunk of chunkText(text)) {
    await wait(tick, signal);
    yield chunk;
  }
}

/** The built-in simulation: a short think, then a fast chunked stream. Rewrites skip the stream and resolve whole. */
export const simulateReplyDraft: ReplyDraftGenerate = request => {
  const text = composeSampleReply(request);
  if (request.mode === "rewrite") return wait(420, request.signal).then(() => text);
  return (async function* () {
    await wait(620, request.signal);
    yield* streamText(text, request.signal);
  })();
};
