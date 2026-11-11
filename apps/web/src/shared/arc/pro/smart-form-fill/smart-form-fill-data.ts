/* Smart form fill: types, the default contact fields, two realistic samples and a simulated extractor.
   The simulated extractor returns hand-checked results for the samples and runs a small local parser on anything
   else, so pasting a real signature still fills something sensible. Nothing leaves the page. */

export type SmartFormFillFieldKind = "text" | "email" | "tel" | "company" | "address" | "url";

export interface SmartFormFillField {
  /** Key in the values object and in extraction results. */
  id: string;
  label: string;
  /** Picks the input type and keyboard; "company" adds a logo slot. Defaults to "text". */
  kind?: SmartFormFillFieldKind;
  placeholder?: string;
  /** 2 spans the full row on wide cards. Defaults to 1. */
  span?: 1 | 2;
  autoComplete?: string;
}

export interface SmartFormFillExtracted {
  value: string;
  /** 0 to 1. Fields below `reviewThreshold` ask for review. */
  confidence: number;
  /** Exact substring of the pasted text this value came from; it highlights in the source view. */
  source?: string;
  /** Why the model is unsure, shown while the field is hovered or focused. */
  note?: string;
}

/** Extraction result keyed by field id. Missing fields stay untouched. */
export type SmartFormFillResult = Partial<Record<string, SmartFormFillExtracted>>;

export interface SmartFormFillSample {
  label: string;
  text: string;
}

export type SmartFormFillValues = Record<string, string>;

export const smartFormFillDefaultFields: SmartFormFillField[] = [
  { id: "name", label: "Full name", placeholder: "Ada Lovelace", autoComplete: "name" },
  { id: "title", label: "Job title", placeholder: "Head of partnerships", autoComplete: "organization-title" },
  { id: "company", label: "Company", kind: "company", placeholder: "Company name", span: 2, autoComplete: "organization" },
  { id: "email", label: "Email", kind: "email", placeholder: "name@company.com", autoComplete: "email" },
  { id: "phone", label: "Phone", kind: "tel", placeholder: "+1 (555) 000-0000", autoComplete: "tel" },
  { id: "address", label: "Address", kind: "address", placeholder: "Street, city, region, postcode", span: 2, autoComplete: "street-address" },
];

const signature = `Thanks again for the walkthrough on Tuesday. Redlines coming by Friday.

Maya Okafor
Head of Partnerships, Stripe
m +1 (415) 555-0142 · o +1 (415) 555-0100
maya.okafor@stripe.com
354 Oyster Pt Blvd, S. San Francisco 94080`;

const note = `fwd from Jonas: met Priya Raman at Config last week,
she runs design eng at linear. priya@linear.app
cell is 628 555 0199, wants a follow up call
office near 1 Letterman Dr SF? not 100% sure`;

export const smartFormFillSamples: SmartFormFillSample[] = [
  { label: "Email signature", text: signature },
  { label: "Messy note", text: note },
];

const sampleResults: Record<string, SmartFormFillResult> = {
  [signature]: {
    name: { value: "Maya Okafor", confidence: 0.99, source: "Maya Okafor" },
    title: { value: "Head of Partnerships", confidence: 0.97, source: "Head of Partnerships" },
    company: { value: "Stripe", confidence: 0.98, source: "Stripe" },
    email: { value: "maya.okafor@stripe.com", confidence: 0.99, source: "maya.okafor@stripe.com" },
    phone: { value: "+1 (415) 555-0142", confidence: 0.72, source: "+1 (415) 555-0142", note: "Two numbers found, picked the mobile one" },
    address: { value: "354 Oyster Point Blvd, South San Francisco, CA 94080", confidence: 0.68, source: "354 Oyster Pt Blvd, S. San Francisco 94080", note: "Expanded abbreviations and added the state" },
  },
  [note]: {
    name: { value: "Priya Raman", confidence: 0.96, source: "Priya Raman" },
    title: { value: "Design Engineering Lead", confidence: 0.66, source: "runs design eng", note: "Paraphrased from “runs design eng”" },
    company: { value: "Linear", confidence: 0.94, source: "linear" },
    email: { value: "priya@linear.app", confidence: 0.99, source: "priya@linear.app" },
    phone: { value: "+1 (628) 555-0199", confidence: 0.9, source: "628 555 0199" },
    address: { value: "1 Letterman Drive, San Francisco, CA 94129", confidence: 0.48, source: "1 Letterman Dr SF", note: "The note itself says it is not sure" },
  },
};

/* ---------- Local parser for anything that is not a sample ---------- */

const freeMail = /^(gmail|googlemail|outlook|hotmail|yahoo|icloud|me|proton|protonmail|aol|gmx|hey)$/i;
const titleWords = /\b(head|director|manager|engineer|designer|founder|co-?founder|ceo|cto|coo|cfo|vp|vice president|lead|partner|analyst|consultant|recruiter|developer|architect|officer|president|specialist|scientist|marketing|sales|product|operations)\b/i;
const streetWords = /\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|way|lane|ln|ct|court|pl|place|sq|square|pkwy|parkway|hwy|ctr|center|strasse|straße|gasse|weg|platz)\b\.?/i;
const titleCase = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function digitsOf(text: string) { return text.replace(/\D/g, ""); }

function formatPhone(raw: string) {
  const digits = digitsOf(raw);
  if (digits.length === 10) return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  return raw.trim();
}

export function parseContact(text: string): SmartFormFillResult {
  const result: SmartFormFillResult = {};
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const email = text.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/);
  if (email) result.email = { value: email[0].toLowerCase(), confidence: 0.98, source: email[0] };

  const phones = [...text.matchAll(/(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3}[\s.-]?\d{3,4}/g)].filter((match) => digitsOf(match[0]).length >= 9);
  if (phones.length) {
    const mobile = phones.find((match) => /\b(m|mob|mobile|cell|c)\b[\s.:]*$/i.test(text.slice(Math.max(0, (match.index ?? 0) - 10), match.index)));
    const pick = mobile ?? phones[0];
    const several = phones.length > 1;
    result.phone = {
      value: formatPhone(pick[0]), confidence: several ? 0.72 : 0.92, source: pick[0].trim(),
      note: several ? `${phones.length} numbers found, picked ${mobile ? "the mobile one" : "the first"}` : undefined,
    };
  }

  const nameLine = lines.find((line) => /^[A-Z][a-z'-]+(?: [A-Z][a-z'-]+){1,2}$/.test(line) && !titleWords.test(line));
  if (nameLine) result.name = { value: nameLine, confidence: 0.9, source: nameLine };

  const titleLine = lines.find((line) => titleWords.test(line) && line !== nameLine && !line.includes("@") && line.length < 80);
  if (titleLine) {
    const [title, rest] = titleLine.split(/\s*(?:,|\||\bat\b|@|·|–|-)\s+/);
    if (title) result.title = { value: title.trim(), confidence: 0.86, source: title.trim() };
    if (rest && /^[A-Z]/.test(rest)) result.company = { value: rest.trim(), confidence: 0.9, source: rest.trim() };
  }

  if (!result.company && email) {
    const root = email[0].split("@")[1].split(".")[0];
    if (!freeMail.test(root)) result.company = { value: titleCase(root), confidence: 0.74, source: root, note: "Guessed from the email domain" };
  }

  const addressLine = lines.find((line) => /^\d+\s/.test(line) && streetWords.test(line)) ?? lines.find((line) => /\b\d{5}(?:-\d{4})?\b/.test(line) && !/@/.test(line) && digitsOf(line).length < 9);
  if (addressLine) {
    const hasPostcode = /\b\d{4,5}\b/.test(addressLine.replace(/^\d+/, ""));
    result.address = { value: addressLine, confidence: hasPostcode ? 0.84 : 0.7, source: addressLine, note: hasPostcode ? undefined : "No postcode in the text" };
  }
  return result;
}

const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(signal.reason);
  const timer = setTimeout(resolve, ms);
  signal.addEventListener("abort", () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
});

/** The default `extract`: a short simulated read, then the sample result or the local parser. */
export async function simulateExtract(text: string, signal: AbortSignal): Promise<SmartFormFillResult> {
  await wait(720, signal);
  return sampleResults[text.trim()] ?? sampleResults[text] ?? parseContact(text);
}
