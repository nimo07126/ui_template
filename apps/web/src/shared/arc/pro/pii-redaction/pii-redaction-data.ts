/**
 * PII redaction helpers: a small built-in detector, redaction into numbered placeholders, and restoration.
 * Pure functions, safe to run on the server. The detector is a demo-grade baseline (regex plus a Luhn check);
 * wire a real service through the component's `detect` prop for production traffic.
 */

export type PiiEntityType = "name" | "email" | "phone" | "card";

/** A span of `text` the detector flagged. `end` is exclusive. */
export interface PiiMatch {
  type: PiiEntityType;
  start: number;
  end: number;
}

/** A flagged span with its original value and the placeholder token that replaced it, like `EMAIL_1`. */
export interface PiiEntity extends PiiMatch {
  value: string;
  token: string;
}

export interface PiiRedactionResult {
  /** The text with every entity swapped for `[TOKEN]`. This is what reaches the model. */
  prompt: string;
  entities: PiiEntity[];
}

export const piiTypes: PiiEntityType[] = ["name", "email", "phone", "card"];
export const piiLabels: Record<PiiEntityType, string> = { name: "Name", email: "Email", phone: "Phone", card: "Card" };
const tokenPrefix: Record<PiiEntityType, string> = { name: "NAME", email: "EMAIL", phone: "PHONE", card: "CARD" };

/** Sample: a support message from Sofia Ramirez about a double charge, October 2026. The card number is a Luhn-valid test number. */
export const piiSampleMessage = "Hi, this is Sofia Ramirez. I was charged twice for my October 24 order on the card 4539 1488 0343 6467. Could you refund the duplicate $48.00? You can reach me at sofia.ramirez@fastmail.com or +1 415 555 0132.";
export const piiSampleNames = ["Sofia Ramirez"];
/** What the model answers to the redacted sample. It only ever sees placeholders. */
export const piiSampleReply = "Thanks, [NAME_1]. I can see two charges of $48.00 on [CARD_1] from October 24, and the second one is a duplicate. I have started a refund, which usually lands in 3 to 5 business days. A confirmation is on its way to [EMAIL_1], and we will text [PHONE_1] if we need anything else.";

const luhn = (digits: string) => {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let digit = Number(digits[digits.length - 1 - i]);
    if (i % 2) { digit *= 2; if (digit > 9) digit -= 9; }
    sum += digit;
  }
  return sum % 10 === 0;
};

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Finds emails, card numbers (13 to 19 digits that pass Luhn), phone numbers (7 to 15 digits) and names
 * (from `names`, plus "I'm", "this is" and "my name is" introductions). Overlaps resolve in that order.
 */
export function detectPii(text: string, options: { names?: string[] } = {}): PiiMatch[] {
  const found: PiiMatch[] = [];
  const add = (type: PiiEntityType, start: number, end: number) => {
    if (found.some(match => start < match.end && end > match.start)) return;
    found.push({ type, start, end });
  };
  for (const match of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g)) add("email", match.index, match.index + match[0].length);
  for (const match of text.matchAll(/(?<![\d-])\d(?:[ -]?\d){12,18}(?![\d-])/g)) {
    if (luhn(match[0].replace(/\D/g, ""))) add("card", match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(/(?<![\w+])\+?\(?\d[\d\s().-]{5,}\d(?![\w])/g)) {
    const digits = match[0].replace(/\D/g, "").length;
    const dateOrAmount = /^\d+[.,]\d{1,2}$/.test(match[0]) || /^\d{4}[-./]\d{1,2}[-./]\d{1,2}$|^\d{1,2}[-./]\d{1,2}[-./]\d{2,4}$/.test(match[0].trim());
    if (digits >= 7 && digits <= 15 && !dateOrAmount) add("phone", match.index, match.index + match[0].length);
  }
  for (const name of options.names ?? []) {
    if (!name.trim()) continue;
    for (const match of text.matchAll(new RegExp(`(?<![\\w])${escape(name.trim())}(?![\\w])`, "g"))) add("name", match.index, match.index + match[0].length);
  }
  for (const match of text.matchAll(/\b(?:I'm|I’m|I am|this is|This is|my name is|My name is)\s+([A-Z][a-z'’-]+(?:\s+[A-Z][a-z'’-]+){0,2})/g)) {
    const start = match.index + match[0].length - match[1].length;
    add("name", start, start + match[1].length);
  }
  return found.sort((a, b) => a.start - b.start);
}

/** Swaps each match for a numbered placeholder. The same value always gets the same token, so the model can refer back to it. */
export function redactPii(text: string, matches: PiiMatch[]): PiiRedactionResult {
  const counts: Partial<Record<PiiEntityType, number>> = {};
  const seen = new Map<string, string>();
  const entities: PiiEntity[] = [];
  let prompt = "";
  let cursor = 0;
  for (const match of [...matches].sort((a, b) => a.start - b.start)) {
    if (match.start < cursor || match.end > text.length || match.end <= match.start) continue;
    const value = text.slice(match.start, match.end);
    const key = `${match.type}:${value}`;
    let token = seen.get(key);
    if (!token) {
      counts[match.type] = (counts[match.type] ?? 0) + 1;
      token = `${tokenPrefix[match.type]}_${counts[match.type]}`;
      seen.set(key, token);
    }
    entities.push({ ...match, value, token });
    prompt += `${text.slice(cursor, match.start)}[${token}]`;
    cursor = match.end;
  }
  return { prompt: prompt + text.slice(cursor), entities };
}

export const placeholderPattern = /\[((?:NAME|EMAIL|PHONE|CARD)_\d+)\]/g;

/** Puts the original values back into a model reply. Unknown tokens stay as they are. */
export function restorePii(text: string, entities: PiiEntity[]) {
  const values = new Map(entities.map(entity => [entity.token, entity.value]));
  return text.replace(placeholderPattern, (whole, token: string) => values.get(token) ?? whole);
}

/** The simulated model: answers whatever placeholders the prompt carries, the way a support assistant would. */
export function simulatedReply(prompt: string, entities: PiiEntity[]) {
  if (prompt === redactPii(piiSampleMessage, detectPii(piiSampleMessage, { names: piiSampleNames })).prompt) return piiSampleReply;
  const first = (type: PiiEntityType) => entities.find(entity => entity.type === type)?.token;
  const name = first("name"), card = first("card"), email = first("email"), phone = first("phone");
  if (!entities.length) return "Thanks for the message. I did not find any personal details in it, so it reached me exactly as you wrote it. How can I help?";
  const lines = [name ? `Thanks, [${name}].` : "Thanks for the details."];
  if (card) lines.push(`I have flagged the latest charge on [${card}] for review.`);
  if (email && phone) lines.push(`I will send a summary to [${email}] and text [${phone}] if anything changes.`);
  else if (email) lines.push(`I will send a summary to [${email}] within the hour.`);
  else if (phone) lines.push(`I will text [${phone}] if anything changes.`);
  if (!card && !email && !phone) lines.push("What can I help you with today?");
  return lines.join(" ");
}
