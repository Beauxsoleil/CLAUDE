import { describe, expect, it } from 'vitest';
import { ordinal, placeMedal } from './placements';

describe('ordinal', () => {
  it('handles the common cases', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(10)).toBe('10th');
  });
  it('handles the 11–13 exceptions', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(111)).toBe('111th');
    expect(ordinal(112)).toBe('112th');
  });
  it('handles 21–23 and 101', () => {
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(101)).toBe('101st');
  });
});

describe('placeMedal', () => {
  it('medals the top three, ordinals the rest', () => {
    expect(placeMedal(1)).toBe('🥇');
    expect(placeMedal(2)).toBe('🥈');
    expect(placeMedal(3)).toBe('🥉');
    expect(placeMedal(4)).toBe('4th');
    expect(placeMedal(11)).toBe('11th');
  });
});
