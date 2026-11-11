import type { EnrichColumnDefinition, EnrichColumnEnrich, EnrichColumnModel, EnrichColumnResult, EnrichColumnRow } from "./enrich-column-types";
import { ClaudeMark, FigmaMark, LinearMark, NotionMark, RampMark, RetoolMark, StripeMark, VercelMark } from "./enrich-column-marks";

export const enrichColumnSampleColumn: EnrichColumnDefinition = {
  name: "Headcount and funding",
  prompt: "Find the headcount and latest funding round",
};

export const enrichColumnSampleModel: EnrichColumnModel = {
  name: "Claude Haiku 5.5",
  detail: "Web search",
  mark: <ClaudeMark />,
};

export const enrichColumnSampleRows: EnrichColumnRow[] = [
  { id: "linear", name: "Linear", domain: "linear.app", logo: <LinearMark /> },
  { id: "vercel", name: "Vercel", domain: "vercel.com", logo: <VercelMark /> },
  { id: "notion", name: "Notion", domain: "notion.com", logo: <NotionMark /> },
  { id: "figma", name: "Figma", domain: "figma.com", logo: <FigmaMark /> },
  { id: "stripe", name: "Stripe", domain: "stripe.com", logo: <StripeMark /> },
  { id: "ramp", name: "Ramp", domain: "ramp.com", logo: <RampMark /> },
  { id: "retool", name: "Retool", domain: "retool.com", logo: <RetoolMark /> },
];

type Sample = EnrichColumnResult & { search: number; read: number; failFirst?: string };

/** Plausible sample values for the demo, not live data. Retool fails its first attempt so the retry path shows. */
const samples: Record<string, Sample> = {
  linear: { value: "180 people · Series C, $82M (Jun 2025)", source: { label: "linear.app/now", href: "https://linear.app/now" }, search: 300, read: 420 },
  vercel: { value: "820 people · Series F, $300M (Sep 2025)", source: { label: "vercel.com/blog", href: "https://vercel.com/blog" }, search: 340, read: 380 },
  notion: { value: "1,100 people · Series C, $275M (Oct 2021)", source: { label: "crunchbase.com", href: "https://www.crunchbase.com" }, search: 280, read: 460 },
  figma: { value: "1,700 people · IPO on the NYSE (Jul 2025)", source: { label: "sec.gov", href: "https://www.sec.gov" }, search: 360, read: 400 },
  stripe: { value: "8,500 people · Series I, $6.5B (Mar 2023)", source: { label: "stripe.com/newsroom", href: "https://stripe.com/newsroom" }, search: 320, read: 440 },
  ramp: { value: "1,200 people · Series E, $500M (Jul 2025)", source: { label: "ramp.com/blog", href: "https://ramp.com/blog" }, search: 300, read: 400 },
  retool: { value: "460 people · Series C, $45M (Jul 2022)", source: { label: "techcrunch.com", href: "https://techcrunch.com" }, search: 340, read: 480, failFirst: "No dated source found" },
};

export function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
    const timer = window.setTimeout(() => { signal.removeEventListener("abort", stop); resolve(); }, ms);
    function stop() { window.clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }
    signal.addEventListener("abort", stop, { once: true });
  });
}

/** The built in simulation: a short search, a read of one source, then the value. Nothing leaves the browser. */
export const simulateEnrich: EnrichColumnEnrich = async (row, { signal, attempt, setActivity }) => {
  const sample: Sample = samples[row.id] ?? {
    value: `Sample value for ${row.name}`,
    source: row.domain ? { label: row.domain, href: `https://${row.domain}` } : undefined,
    search: 320,
    read: 420,
  };
  await wait(sample.search, signal);
  if (sample.source) setActivity(`Reading ${sample.source.label}`);
  await wait(sample.read, signal);
  if (sample.failFirst && attempt === 1) throw new Error(sample.failFirst);
  return { value: sample.value, source: sample.source };
};
