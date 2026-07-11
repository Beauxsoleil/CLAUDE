import { describe, expect, it } from 'vitest';
import { computeTrendSeries } from './trends';
import type { Team, Transaction } from '../types';

function team(id: string): Team {
  return { id, name: id.toUpperCase(), color: '#000000', createdAt: 0 };
}
function tx(teamId: string, points: number, createdAt: number): Transaction {
  return {
    id: `${teamId}${createdAt}`,
    teamId,
    teamName: teamId.toUpperCase(),
    points,
    reason: 'x',
    type: 'manual',
    scheduleItemId: null,
    createdAt,
  };
}

describe('computeTrendSeries', () => {
  it('returns no series and a default y-range when there are no awards', () => {
    const d = computeTrendSeries([team('a')], [], () => 1);
    expect(d.series).toEqual([]);
    expect(d.minV).toBe(0);
    expect(d.maxV).toBe(1);
  });

  it('builds cumulative series spanning the full time range', () => {
    const teams = [team('a'), team('b')];
    // intentionally unsorted input
    const txs = [tx('a', 20, 300), tx('a', 10, 100), tx('b', 5, 200)];
    const d = computeTrendSeries(teams, txs, () => 1);

    expect(d.minT).toBe(100);
    expect(d.maxT).toBe(300);
    expect(d.maxV).toBe(30);
    expect(d.series).toHaveLength(2);

    const a = d.series.find((s) => s.team.id === 'a')!;
    const b = d.series.find((s) => s.team.id === 'b')!;
    expect(a.total).toBe(30);
    expect(b.total).toBe(5);
    // every series starts at 0 at minT and ends at its total at maxT
    for (const s of d.series) {
      expect(s.pts[0]).toEqual({ t: 100, v: 0 });
      expect(s.pts[s.pts.length - 1]).toEqual({ t: 300, v: s.total });
    }
  });

  it('applies the multiplier to cumulative values', () => {
    const d = computeTrendSeries([team('a')], [tx('a', 10, 100), tx('a', 10, 200)], () => 2);
    expect(d.series[0].total).toBe(40);
    expect(d.maxV).toBe(40);
  });
});
