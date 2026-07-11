import { describe, expect, it } from 'vitest';
import { clampInt, formatPoints, formatSignedPoints } from './format';

describe('formatPoints', () => {
  it('adds thousands separators', () => {
    expect(formatPoints(0)).toBe('0');
    expect(formatPoints(5000)).toBe('5,000');
    expect(formatPoints(1234567)).toBe('1,234,567');
    expect(formatPoints(-2500)).toBe('-2,500');
  });
});

describe('formatSignedPoints', () => {
  it('always shows a sign', () => {
    expect(formatSignedPoints(30)).toBe('+30');
    expect(formatSignedPoints(0)).toBe('+0');
    expect(formatSignedPoints(-10)).toBe('-10');
    expect(formatSignedPoints(5000)).toBe('+5,000');
  });
});

describe('clampInt', () => {
  it('rounds to a whole number', () => {
    expect(clampInt(10.4)).toBe(10);
    expect(clampInt(10.6)).toBe(11);
  });
  it('returns min for non-finite input', () => {
    expect(clampInt(NaN)).toBe(0);
    expect(clampInt(Infinity)).toBe(0);
    expect(clampInt(NaN, 5)).toBe(5);
  });
  it('clamps to the range', () => {
    expect(clampInt(-5)).toBe(0);
    expect(clampInt(1e12)).toBe(1_000_000_000);
    expect(clampInt(3, 1)).toBe(3);
    expect(clampInt(0, 1)).toBe(1);
    expect(clampInt(50, 0, 100)).toBe(50);
  });
});
