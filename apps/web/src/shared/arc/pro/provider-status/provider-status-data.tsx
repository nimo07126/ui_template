import type { ReactNode } from "react";
import { AnthropicMark, AwsMark, GeminiColorMark, MistralColorMark, OpenaiMark, XaiMark } from "./provider-status-marks";
import type { IncidentUpdate, ProviderDay, ProviderHealth, ProviderIncident, ProviderStatusItem } from "./provider-status-types";

/**
 * Sample data for the self-playing demo. Every number here is a plausible sample, not a real measurement.
 * Uptime counts outage minutes in full and degraded minutes at 30%, over a 1,440 minute day.
 */

/** Today in the sample is Tuesday, October 27, 2026; the bar covers September 28 to October 27. */
export const SAMPLE_TODAY = "2026-10-27";
const DAYS = 30;

type DayOverride = [uptime: number, status: ProviderHealth, note: string];

function isoDay(offsetFromToday: number) {
  const date = new Date(`${SAMPLE_TODAY}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetFromToday);
  return date.toISOString().slice(0, 10);
}

function history(overrides: Record<string, DayOverride>, today?: DayOverride): ProviderDay[] {
  return Array.from({ length: DAYS }, (_, index) => {
    const date = isoDay(index - (DAYS - 1));
    const hit = date === SAMPLE_TODAY ? today : overrides[date];
    return hit ? { date, uptime: hit[0], status: hit[1], note: hit[2] } : { date, uptime: 100, status: "operational" };
  });
}

interface Stage { stage: IncidentUpdate["stage"]; at: string; message: string }

const openaiStages: Stage[] = [
  { stage: "investigating", at: "14:02 UTC", message: "We are seeing elevated 5xx errors on the Responses API for GPT-6.1 Sol. GPT-6 Luna is not affected." },
  { stage: "identified", at: "14:19 UTC", message: "A capacity issue in one inference cluster is causing the errors. We are moving traffic to healthy regions." },
  { stage: "monitoring", at: "14:41 UTC", message: "Error rates are back near normal. Some requests may still see higher latency while traffic rebalances." },
  { stage: "resolved", at: "14:58 UTC", message: "Error rates and latency have been normal for 15 minutes. This incident is resolved." },
];

const geminiStages: Stage[] = [
  { stage: "investigating", at: "13:37 UTC", message: "Some requests to Gemini 4 Argon in us-central1 see a longer time to first token." },
  { stage: "identified", at: "13:55 UTC", message: "A configuration change increased queue times on one serving pool. A rollback is in progress." },
  { stage: "monitoring", at: "14:24 UTC", message: "The rollback is complete and latency is recovering across us-central1." },
  { stage: "resolved", at: "14:50 UTC", message: "Latency is back to normal in every region. This incident is resolved." },
];

const mistralStages: Stage[] = [
  { stage: "investigating", at: "15:06 UTC", message: "Some chat completion requests to Mistral Large 4 return 503 errors in the EU region." },
  { stage: "identified", at: "15:18 UTC", message: "A failed node pool upgrade reduced capacity. We are adding capacity back." },
  { stage: "monitoring", at: "15:31 UTC", message: "Capacity is restored and errors have stopped. We are watching the EU region closely." },
  { stage: "resolved", at: "15:47 UTC", message: "Mistral Large 4 has been stable for 15 minutes. This incident is resolved." },
];

function incident(id: string, title: string, stages: Stage[], count: number, url: string): ProviderIncident {
  return { id, title, url, updates: stages.slice(0, count).map(({ stage, at, message }) => ({ stage, at, message })) };
}

interface Base { id: string; name: string; detail: string; mark: ReactNode; latency: number; days: Record<string, DayOverride> }

const bases: Base[] = [
  { id: "anthropic", name: "Anthropic", detail: "Claude Opus 5.5, Sonnet 5.5", mark: <AnthropicMark />, latency: 412, days: {
    "2026-10-09": [99.15, "degraded", "Elevated errors on Claude Opus 5.5 for 41 min"],
    "2026-10-21": [99.65, "degraded", "Slow responses on the Messages API for 17 min"],
  } },
  { id: "openai", name: "OpenAI", detail: "GPT-6.1 Sol, GPT-6 Luna", mark: <OpenaiMark />, latency: 538, days: {
    "2026-10-03": [92.08, "outage", "API outage for 1 h 54 min"],
    "2026-10-17": [99.38, "degraded", "Elevated latency on GPT-6 Luna for 30 min"],
  } },
  { id: "gemini", name: "Google Gemini", detail: "Gemini 4 Argon, 3.8 Flash", mark: <GeminiColorMark />, latency: 604, days: {
    "2026-10-12": [99.5, "degraded", "Increased errors in europe-west4 for 24 min"],
  } },
  { id: "mistral", name: "Mistral AI", detail: "Mistral Large 4", mark: <MistralColorMark />, latency: 356, days: {
    "2026-10-06": [94.24, "outage", "La Plateforme API unavailable for 1 h 23 min"],
  } },
  { id: "xai", name: "xAI", detail: "Grok 4.7", mark: <XaiMark />, latency: 448, days: {
    "2026-10-01": [99.54, "degraded", "Elevated errors on Grok 4.7 for 22 min"],
    "2026-10-24": [99.75, "degraded", "Slow image generation for 12 min"],
  } },
  { id: "bedrock", name: "Amazon Bedrock", detail: "Claude Sonnet 5.5 in us-east-1", mark: <AwsMark />, latency: 521, days: {
    "2026-10-15": [99, "degraded", "Throttling errors in us-east-1 for 48 min"],
  } },
];

/** Small, repeatable latency drift so every check moves the numbers a little. */
const drift = [0, 14, -9, 22, -17, 6, -12, 19, -4, 11, -7, 3];

/** How many demo checks make one loop of the story. */
export const SAMPLE_STEPS = 11;
/** The check in each loop that fails, to show the error state. */
export const SAMPLE_FAILING_STEP = 6;

/**
 * The sample providers after a number of simulated checks. The story: an OpenAI outage and a Gemini slowdown resolve,
 * Mistral has a short incident of its own, then everything is operational before the loop starts again.
 */
export function sampleProviders(check: number): ProviderStatusItem[] {
  const step = check % SAMPLE_STEPS;
  const looped = check >= SAMPLE_STEPS;
  // The failing check changes nothing, so its data matches the check before it.
  const story = step === SAMPLE_FAILING_STEP ? step - 1 : step;

  const openaiCount = story <= 3 ? story + 1 : 0;
  const geminiCount = story <= 1 ? 2 : story <= 3 ? 3 : story === 4 ? 4 : 0;
  const mistralCount = story >= 5 && story <= 9 ? Math.min(4, story === 5 ? 1 : story - 5) : 0;
  const mistralToday = looped || story >= 5;

  return bases.map((base, index) => {
    let status: ProviderHealth = "operational";
    let latency = base.latency + drift[(check + index * 3) % drift.length];
    let current: ProviderIncident | undefined;
    let today: DayOverride | undefined;

    if (base.id === "openai") {
      today = [96.94, "outage", "Elevated error rates on GPT-6.1 Sol"];
      if (openaiCount) {
        current = incident("oai-2026-10-27", "Elevated error rates on GPT-6.1 Sol", openaiStages, openaiCount, "https://status.openai.com");
        status = openaiCount <= 2 ? "outage" : openaiCount === 3 ? "degraded" : "operational";
        if (status === "outage") latency = 2140 + drift[check % drift.length] * 6;
        if (status === "degraded") latency = 860 + drift[check % drift.length] * 2;
      }
    }
    if (base.id === "gemini") {
      today = [98.48, "degraded", "Increased latency for Gemini 4 Argon"];
      if (geminiCount) {
        current = incident("gem-2026-10-27", "Increased latency for Gemini 4 Argon", geminiStages, geminiCount, "https://status.cloud.google.com");
        status = geminiCount < 4 ? "degraded" : "operational";
        if (status === "degraded") latency = (geminiCount === 3 ? 940 : 1380) + drift[check % drift.length] * 3;
      }
    }
    if (base.id === "mistral") {
      if (mistralToday) today = [99.15, "degraded", "Elevated errors on Mistral Large 4"];
      if (mistralCount) {
        current = incident("mis-2026-10-27", "Elevated errors on Mistral Large 4", mistralStages, mistralCount, "https://status.mistral.ai");
        status = mistralCount < 4 ? "degraded" : "operational";
        if (status === "degraded") latency = 812 + drift[check % drift.length] * 2;
      }
    }

    return { id: base.id, name: base.name, detail: base.detail, mark: base.mark, status, latencyMs: latency, days: history(base.days, today), incident: current };
  });
}
