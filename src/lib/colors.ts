export const TEAM_COLORS = [
  '#f59e0b', '#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#14b8a6', '#f97316',
];

// Pick dark or light text for readability on an arbitrary team color.
export function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 150 ? '#0f172a' : '#ffffff';
}

export function nextTeamColor(usedCount: number): string {
  return TEAM_COLORS[usedCount % TEAM_COLORS.length];
}
