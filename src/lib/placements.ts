const MEDALS = ['🥇', '🥈', '🥉'];

export function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** Medal for the top 3, ordinal ("4th", "5th"…) beyond that. */
export function placeMedal(place: number): string {
  return MEDALS[place - 1] ?? ordinal(place);
}
