import type { CodeSuggestionHunk } from "./code-suggestion-types";

/** Sample content: a billing helper in a TypeScript service, edited with "Add retry with backoff". */
export const codeSuggestionSample = {
  fileName: "fetch-invoice.ts",
  filePath: "src/billing",
  instruction: "Add retry with backoff",
  code: [
    'import type { Invoice } from "./types";',
    "",
    "export async function fetchInvoice(id: string): Promise<Invoice> {",
    "  const res = await fetch(`/api/invoices/${id}`);",
    "  if (!res.ok) throw new Error(`Invoice ${id} failed: ${res.status}`);",
    "  return res.json();",
    "}",
  ].join("\n"),
  hunks: [
    {
      id: "limits",
      start: 1,
      remove: 0,
      summary: "Add retry limits",
      insert: [
        'import { sleep } from "./sleep";',
        "",
        "const MAX_ATTEMPTS = 4;",
        "const BASE_DELAY_MS = 250;",
      ],
    },
    {
      id: "loop",
      start: 3,
      remove: 1,
      summary: "Retry 429 and 5xx with backoff",
      insert: [
        "  let res = await fetch(`/api/invoices/${id}`);",
        "  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {",
        "    if (res.status !== 429 && res.status < 500) break;",
        "    await sleep(BASE_DELAY_MS * 2 ** (attempt - 1));",
        "    res = await fetch(`/api/invoices/${id}`);",
        "  }",
      ],
    },
    {
      id: "error",
      start: 4,
      remove: 1,
      summary: "Mention retries in the error",
      insert: [
        "  if (!res.ok) {",
        "    throw new Error(`Invoice ${id} failed after retries: ${res.status}`);",
        "  }",
      ],
    },
  ] satisfies CodeSuggestionHunk[],
};
