import { describe, expect, it } from 'vitest';
import { generateCampCode, normalizeCampCode } from './campCode';

const SAFE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;

describe('generateCampCode', () => {
  it('is 5 chars by default from the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCampCode();
      expect(code).toHaveLength(5);
      expect(code).toMatch(SAFE);
      // no lookalike characters
      expect(code).not.toMatch(/[0O1IL]/);
    }
  });
  it('respects a custom length', () => {
    expect(generateCampCode(3)).toHaveLength(3);
    expect(generateCampCode(8)).toHaveLength(8);
  });
});

describe('normalizeCampCode', () => {
  it('trims and uppercases', () => {
    expect(normalizeCampCode('  abcde ')).toBe('ABCDE');
    expect(normalizeCampCode('p9ncf')).toBe('P9NCF');
    expect(normalizeCampCode('ABCDE')).toBe('ABCDE');
  });
});
