/** Format a point total with thousands separators, e.g. 5000 -> "5,000". */
export function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

/** Signed variant for the history/undo log, e.g. 30 -> "+30", -10 -> "-10". */
export function formatSignedPoints(n: number): string {
  return `${n >= 0 ? '+' : ''}${formatPoints(n)}`;
}

/**
 * Coerce free-form numeric input to a safe whole number in range. Non-finite
 * input (empty, "-", NaN) becomes `min`, so a stray keystroke can never store a
 * bad value.
 */
export function clampInt(n: number, min = 0, max = 1_000_000_000): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}
