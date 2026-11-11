"use client";

import styles from "./speculative-decoding.module.css";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * A number that rolls. Each digit is a wheel keyed by its place from the decimal point, so 2.4 to 2.6 turns only the
 * last wheel. Places that come and go (9 to 10) open their width on the grid track instead of resizing in one frame.
 * Before there is a value it shows a dash.
 */
export function RollingNumber({ value, decimals = 0, suffix, places = 1 }: { value: number | null; decimals?: number; suffix?: string; places?: number }) {
  const text = value === null ? "" : value.toFixed(decimals);
  const [whole = "", fraction = ""] = text.split(".");
  // Integer places are counted from the decimal point, so a wheel keeps its place when the number grows a digit.
  const slots = Math.max(places, whole.length);
  const integer = Array.from({ length: slots }, (_, index) => {
    const place = slots - 1 - index;
    const char = whole[whole.length - 1 - place];
    return { key: `i${place}`, digit: char === undefined ? null : Number(char), place };
  });
  return <span className={styles.number} data-empty={value === null || undefined} aria-hidden="true">
    <span className={styles.numberDash}>–</span>
    <span className={styles.numberValue}>
      {integer.map(item => <span key={item.key} className={styles.wheelSlot} data-off={(item.digit === null && item.place > 0) || undefined}>
        <span className={styles.wheel}>
          <span className={styles.strip} style={{ transform: `translateY(${-(item.digit ?? 0) * 10}%)` }}>
            {DIGITS.map(digit => <span key={digit}>{digit}</span>)}
          </span>
        </span>
      </span>)}
      {decimals > 0 && <span>.</span>}
      {[...fraction.padEnd(decimals, "0")].map((char, index) => <span key={`f${index}`} className={styles.wheelSlot}>
        <span className={styles.wheel}>
          <span className={styles.strip} style={{ transform: `translateY(${-Number(char) * 10}%)` }}>
            {DIGITS.map(digit => <span key={digit}>{digit}</span>)}
          </span>
        </span>
      </span>)}
      {suffix && <span className={styles.numberSuffix}>{suffix}</span>}
    </span>
  </span>;
}

export default RollingNumber;
