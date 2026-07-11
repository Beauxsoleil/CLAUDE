import type { Team, Transaction } from '../types';

export interface TrendPoint {
  t: number;
  v: number;
}

export interface TrendSeries {
  team: Team;
  pts: TrendPoint[];
  total: number;
}

export interface TrendData {
  series: TrendSeries[];
  minT: number;
  maxT: number;
  minV: number;
  maxV: number;
}

/**
 * Cumulative points over time, one series per team that has received points.
 * Each series is padded to span the full time range so all lines share an
 * x-axis. Pure so it can be unit-tested independently of the chart.
 */
export function computeTrendSeries(
  teams: Team[],
  transactions: Transaction[],
  multiplierFor: (ts: number) => number,
): TrendData {
  const asc = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
  const lo = asc.length ? asc[0].createdAt : 0;
  const hi = asc.length ? asc[asc.length - 1].createdAt : 1;
  const rangeT = hi === lo ? 1 : hi - lo;

  const series = teams
    .map((team) => {
      let cum = 0;
      const pts: TrendPoint[] = [{ t: lo, v: 0 }];
      for (const tx of asc) {
        if (tx.teamId === team.id) {
          cum += tx.points * multiplierFor(tx.createdAt);
          pts.push({ t: tx.createdAt, v: cum });
        }
      }
      pts.push({ t: hi, v: cum });
      return { team, pts, total: cum };
    })
    .filter((x) => x.pts.length > 2); // only teams that have received points

  let maxV = 1;
  let minV = 0;
  for (const { pts } of series) {
    for (const p of pts) {
      if (p.v > maxV) maxV = p.v;
      if (p.v < minV) minV = p.v;
    }
  }
  return { series, minT: lo, maxT: lo + rangeT, minV, maxV };
}
