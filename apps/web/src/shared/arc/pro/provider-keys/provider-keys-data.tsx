import type { ComponentType, SVGProps } from "react";
import { AnthropicMark, GeminiColorMark, MistralColorMark, OpenaiMark, XaiMark } from "./provider-keys-marks";

export type ProviderId = "anthropic" | "openai" | "google" | "mistral" | "xai";
export type ProviderKeyStatus = "connected" | "invalid" | "unset";

export interface ProviderKey {
  provider: ProviderId;
  status: ProviderKeyStatus;
  /** The full key. Enables reveal and copy. Leave it out when your server only returns the last four characters. */
  value?: string;
  /** The last four characters, for the mask when `value` is not given. */
  last4?: string;
  /** When a request last used the key. Null or missing reads "Not used yet". */
  lastUsedAt?: Date | number | null;
  /** Why the provider rejected the key, such as "401 Unauthorized". Shown on hover and announced. */
  error?: string;
  /** When the key was last checked. Invalid keys read "Rejected 3 days ago". */
  checkedAt?: Date | number;
}

export type KeyTestResult = { ok: true; detail?: string } | { ok: false; error: string };

export interface KeyTestRequest {
  provider: ProviderId;
  /** The new key when testing a pasted key. Missing when retesting a stored key: test it on your server by provider. */
  key?: string;
  signal: AbortSignal;
}

export interface ProviderSpec {
  id: ProviderId;
  name: string;
  /** What the mask shows before the dots. */
  maskPrefix: string;
  /** What every key starts with, for instant format feedback. */
  startsWith: string;
  pattern: RegExp;
  placeholder: string;
  console: string;
  /** Shape hint when the format is wrong. */
  formatHint: string;
  /** The model a simulated test pings. */
  testModel: string;
  Mark: ComponentType<SVGProps<SVGSVGElement> & { title?: string }>;
  /** Builds a random key in the right format, for the "Use sample key" shortcut. */
  sample: () => string;
}

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const URLSAFE = `${ALNUM}-_`;
function random(length: number, alphabet: string) {
  const bytes = new Uint8Array(length);
  globalThis.crypto?.getRandomValues?.(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[(bytes[i] || Math.floor(Math.random() * 256)) % alphabet.length];
  return out;
}

export const providerSpecs: Record<ProviderId, ProviderSpec> = {
  anthropic: {
    id: "anthropic", name: "Anthropic", maskPrefix: "sk-ant-", startsWith: "sk-ant-", pattern: /^sk-ant-[a-z0-9]+-[A-Za-z0-9_-]{40,}$/,
    placeholder: "sk-ant-api03-…", console: "console.anthropic.com", formatHint: "Anthropic keys start with sk-ant-",
    testModel: "Claude Opus 5.5", Mark: AnthropicMark, sample: () => `sk-ant-api03-${random(95, URLSAFE)}`,
  },
  openai: {
    id: "openai", name: "OpenAI", maskPrefix: "sk-proj-", startsWith: "sk-", pattern: /^sk-(proj-|svcacct-|admin-)?[A-Za-z0-9_-]{40,}$/,
    placeholder: "sk-proj-…", console: "platform.openai.com", formatHint: "OpenAI keys start with sk-",
    testModel: "GPT-6.1 Sol", Mark: OpenaiMark, sample: () => `sk-proj-${random(128, URLSAFE)}`,
  },
  google: {
    id: "google", name: "Google AI", maskPrefix: "AIza", startsWith: "AIza", pattern: /^AIza[0-9A-Za-z_-]{35}$/,
    placeholder: "AIza…", console: "aistudio.google.com", formatHint: "Google AI keys start with AIza",
    testModel: "Gemini 4 Argon", Mark: GeminiColorMark, sample: () => `AIzaSy${random(33, URLSAFE)}`,
  },
  mistral: {
    id: "mistral", name: "Mistral", maskPrefix: "", startsWith: "", pattern: /^[A-Za-z0-9]{32}$/,
    placeholder: "32 letters and numbers", console: "console.mistral.ai", formatHint: "Mistral keys are 32 letters and numbers",
    testModel: "Mistral Large 4", Mark: MistralColorMark, sample: () => random(32, ALNUM),
  },
  xai: {
    id: "xai", name: "xAI", maskPrefix: "xai-", startsWith: "xai-", pattern: /^xai-[A-Za-z0-9]{40,}$/,
    placeholder: "xai-…", console: "console.x.ai", formatHint: "xAI keys start with xai-",
    testModel: "Grok 4.7", Mark: XaiMark, sample: () => `xai-${random(80, ALNUM)}`,
  },
};

export const defaultProviders: ProviderId[] = ["anthropic", "openai", "google", "mistral", "xai"];

/** The revoked sample Mistral key. The simulated test rejects it so the invalid path stays reachable. */
export const revokedSampleKey = "TmC9U9AIkxZnWP4R75wJ0Prr58qBh7Qd";

const MIN = 60_000;
/** Sample keys for the demo, timed relative to now so relative labels match on server and client. */
export function sampleKeys(now = Date.now()): ProviderKey[] {
  return [
    { provider: "anthropic", status: "connected", lastUsedAt: now - 2 * MIN,
      value: "sk-ant-api03-eYgMU06SvpOdf6nN9lURze6EYWS6PaYPnhFlcwVc5QIzNVxM6F9ZRnone-6Mm6ELCeX1pVkPetNvRupr9rZhGrdkYoD4f2a" },
    { provider: "openai", status: "connected", lastUsedAt: now - 14 * MIN,
      value: "sk-proj-joW0m5EsjYx3k1QDHt7DZMbnIcwi5p6te-gASRh5Q1gD-FqXdGUVQhJd2ddCcvdbE4fP1UnTjKMAOYECVqgvlnlvNASLBLkbo5QZUnvsKur3rwkKn0s2fxYlJ2Uj9c1e" },
    { provider: "google", status: "connected", lastUsedAt: now - 26 * 60 * MIN, value: "AIzaSy9_ExVruZRmEvYh4_38g9EgwA-QxnLQk7w" },
    { provider: "mistral", status: "invalid", lastUsedAt: now - 3 * 24 * 60 * MIN, checkedAt: now - 3 * 24 * 60 * MIN,
      error: "401 Unauthorized, the key was revoked", value: revokedSampleKey },
  ];
}

export function maskKey(spec: ProviderSpec, key: ProviderKey) {
  const last4 = key.last4 ?? key.value?.slice(-4) ?? "";
  return { prefix: spec.maskPrefix, last4 };
}

/** "just now", "2 min ago", "3 h ago", "Yesterday", "3 days ago", then a date. */
export function relativeTime(at: number, now: number) {
  const diff = Math.max(0, now - at);
  if (diff < 45_000) return "just now";
  const min = Math.round(diff / MIN);
  if (min < 60) return `${min} min ago`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export const toMs = (value: Date | number | null | undefined) => value instanceof Date ? value.getTime() : value ?? undefined;

/** Instant format check. "error" only for a wrong start or wrong characters; length is judged on blur or submit. */
export function checkFormat(spec: ProviderSpec, raw: string): "empty" | "partial" | "valid" | "error" {
  const value = raw.trim();
  if (!value) return "empty";
  if (spec.pattern.test(value)) return "valid";
  const head = spec.startsWith;
  if (head && !(value.startsWith(head) || head.startsWith(value))) return "error";
  if (/\s/.test(value)) return "error";
  if (spec.id === "mistral" && (/[^A-Za-z0-9]/.test(value) || value.length > 32)) return "error";
  if (spec.id === "google" && value.length > 39) return "error";
  return "partial";
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const id = window.setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { window.clearTimeout(id); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});

/** Simulated connection test: a stored invalid key fails again, the revoked sample fails, everything else connects. */
export function simulatedTest(stored: ProviderKey[]) {
  return async ({ provider, key, signal }: KeyTestRequest): Promise<KeyTestResult> => {
    const spec = providerSpecs[provider];
    await wait(key ? 950 : 750, signal);
    const current = stored.find(item => item.provider === provider);
    if (key === revokedSampleKey || (!key && current?.status === "invalid")) return { ok: false, error: "401 Unauthorized, the key was revoked" };
    const ms = 340 + ((key ?? current?.value ?? provider).charCodeAt(5) % 9) * 13;
    return { ok: true, detail: `${spec.testModel} answered in ${ms} ms` };
  };
}
