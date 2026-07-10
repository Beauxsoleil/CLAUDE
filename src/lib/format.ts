/** Format a point total with thousands separators, e.g. 5000 -> "5,000". */
export function formatPoints(n: number): string {
  return n.toLocaleString('en-US');
}

/** Signed variant for the history/undo log, e.g. 30 -> "+30", -10 -> "-10". */
export function formatSignedPoints(n: number): string {
  return `${n >= 0 ? '+' : ''}${formatPoints(n)}`;
}
