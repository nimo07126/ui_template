import { useId } from "react";
import type { ReactNode } from "react";

/** ISO 3166 alpha-2 codes with a built-in flag. Any other code renders a neutral swatch; pass `flag` on the event to bring your own. */
export type FlagCode = "US" | "GB" | "DE" | "FR" | "NL" | "SE" | "CH" | "JP" | "IN" | "BR";

export const countryNames: Record<FlagCode, string> = {
  US: "United States",
  GB: "United Kingdom",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  SE: "Sweden",
  CH: "Switzerland",
  JP: "Japan",
  IN: "India",
  BR: "Brazil",
};

/* Flags are drawn on a 16 by 12 grid and shown at 16 by 12px. Official colors; the US stars are left out at this size. */
function UnitedKingdom() {
  const id = useId().replace(/:/g, "");
  return (
    <svg viewBox="10 0 40 30" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <clipPath id={`${id}t`}><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z" /></clipPath>
      <path d="M0 0v30h60V0z" fill="#012169" />
      <path d="M0 0l60 30m0-30L0 30" stroke="#fff" strokeWidth="6" />
      <path d="M0 0l60 30m0-30L0 30" clipPath={`url(#${id}t)`} stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  );
}

const stripes = Array.from({ length: 6 }, (_, i) => <rect key={i} y={(i * 2 + 1) * 12 / 13} width="16" height={12 / 13} fill="#fff" />);

const flags: Record<FlagCode, () => ReactNode> = {
  US: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#B22234" />
      {stripes}
      <rect width="6.4" height={12 * 7 / 13} fill="#3C3B6E" />
    </svg>
  ),
  GB: () => <UnitedKingdom />,
  DE: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="4" fill="#000" />
      <rect y="4" width="16" height="4" fill="#DD0000" />
      <rect y="8" width="16" height="4" fill="#FFCE00" />
    </svg>
  ),
  FR: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="5.34" height="12" fill="#0055A4" />
      <rect x="5.33" width="5.34" height="12" fill="#fff" />
      <rect x="10.66" width="5.34" height="12" fill="#EF4135" />
    </svg>
  ),
  NL: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="4" fill="#AE1C28" />
      <rect y="4" width="16" height="4" fill="#fff" />
      <rect y="8" width="16" height="4" fill="#21468B" />
    </svg>
  ),
  SE: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#006AA7" />
      <rect x="5" width="2" height="12" fill="#FECC02" />
      <rect y="5" width="16" height="2" fill="#FECC02" />
    </svg>
  ),
  CH: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#DA291C" />
      <rect x="7" y="2.5" width="2" height="7" fill="#fff" />
      <rect x="4.5" y="5" width="7" height="2" fill="#fff" />
    </svg>
  ),
  JP: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#fff" />
      <circle cx="8" cy="6" r="3.6" fill="#BC002D" />
    </svg>
  ),
  IN: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="4" fill="#FF9933" />
      <rect y="4" width="16" height="4" fill="#fff" />
      <rect y="8" width="16" height="4" fill="#138808" />
      <circle cx="8" cy="6" r="1.5" fill="none" stroke="#000080" strokeWidth=".45" />
      <circle cx="8" cy="6" r=".4" fill="#000080" />
    </svg>
  ),
  BR: () => (
    <svg viewBox="0 0 16 12" aria-hidden="true">
      <rect width="16" height="12" fill="#009C3B" />
      <path d="M8 1.3 14.6 6 8 10.7 1.4 6z" fill="#FFDF00" />
      <circle cx="8" cy="6" r="2.7" fill="#002776" />
      <path d="M5.4 5.4c1.8-.4 3.7 0 5.2 1" fill="none" stroke="#fff" strokeWidth=".5" />
    </svg>
  ),
};

export function hasFlag(code: string): code is FlagCode {
  return code in flags;
}

/** A 16 by 12px flag. Unknown codes render a neutral swatch so rows keep their alignment. */
export function Flag({ code, className }: { code: string; className?: string }) {
  const upper = code.toUpperCase();
  return <span className={className} data-flag={hasFlag(upper) ? upper : "none"} aria-hidden="true">{hasFlag(upper) ? flags[upper]() : null}</span>;
}
