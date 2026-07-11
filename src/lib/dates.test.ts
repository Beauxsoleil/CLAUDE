import { describe, expect, it } from 'vitest';
import { dayKey, formatDayKey, todayKey } from './dates';

describe('dayKey', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    const ts = new Date(2026, 6, 5, 14, 30).getTime(); // July 5 2026, local
    expect(dayKey(ts)).toBe('2026-07-05');
  });
  it('zero-pads month and day', () => {
    expect(dayKey(new Date(2026, 0, 9).getTime())).toBe('2026-01-09');
  });
});

describe('todayKey', () => {
  it('matches dayKey(now)', () => {
    expect(todayKey()).toBe(dayKey(Date.now()));
  });
});

describe('formatDayKey', () => {
  it('produces a human label containing the day of month', () => {
    expect(formatDayKey('2026-07-10')).toContain('10');
  });
});
