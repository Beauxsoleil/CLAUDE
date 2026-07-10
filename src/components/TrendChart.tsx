import { useMemo } from 'react';
import type { Team, Transaction } from '../types';
import { formatPoints } from '../lib/format';

// Chart geometry (viewBox units; the SVG scales to its container width).
const W = 320;
const H = 180;
const PAD_L = 40;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 22;

interface Pt {
  t: number;
  v: number;
}

/**
 * Cumulative points over time, one line per team in the team's own color.
 * Identity is carried by direct end-labels (≤4 teams) or the legend below —
 * never by color alone — and text uses ink tokens, not the series color.
 */
export function TrendChart({
  teams,
  transactions,
  multiplierFor,
}: {
  teams: Team[];
  transactions: Transaction[];
  multiplierFor: (ts: number) => number;
}) {
  const { series, minT, maxT, minV, maxV } = useMemo(() => {
    const asc = [...transactions].sort((a, b) => a.createdAt - b.createdAt);
    const lo = asc.length ? asc[0].createdAt : 0;
    const hi = asc.length ? asc[asc.length - 1].createdAt : 1;
    const rangeT = hi === lo ? 1 : hi - lo;

    const s = teams
      .map((team) => {
        let cum = 0;
        const pts: Pt[] = [{ t: lo, v: 0 }];
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

    let vMax = 1;
    let vMin = 0;
    for (const { pts } of s) {
      for (const p of pts) {
        if (p.v > vMax) vMax = p.v;
        if (p.v < vMin) vMin = p.v;
      }
    }
    return { series: s, minT: lo, maxT: lo + rangeT, minV: vMin, maxV: vMax };
  }, [teams, transactions, multiplierFor]);

  if (series.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-faint">
        Award some points to see momentum over time.
      </div>
    );
  }

  const x = (t: number) => PAD_L + ((t - minT) / (maxT - minT || 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - (v - minV) / (maxV - minV || 1)) * (H - PAD_T - PAD_B);

  const gridVals = [minV, minV + (maxV - minV) / 2, maxV];
  const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const directLabels = series.length <= 4;

  // Direct end-labels, nudged apart so equal/near-equal finishers don't overlap.
  const endLabels: { id: string; name: string; cx: number; labelY: number }[] = [];
  const rawEnds = series
    .map(({ team, pts }) => {
      const last = pts[pts.length - 1];
      return { id: team.id, name: team.name, cx: x(last.t), cy: y(last.v) - 5 };
    })
    .sort((a, b) => a.cy - b.cy);
  let prevY = -Infinity;
  for (const e of rawEnds) {
    const labelY = Math.max(e.cy, prevY + 10);
    endLabels.push({ id: e.id, name: e.name, cx: e.cx, labelY });
    prevY = labelY;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative points over time by team">
        {/* recessive gridlines + y labels */}
        {gridVals.map((gv, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(gv)} y2={y(gv)} className="stroke-line" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(gv) + 3} textAnchor="end" className="fill-ink-faint" fontSize={9}>
              {formatPoints(Math.round(gv))}
            </text>
          </g>
        ))}
        {/* x endpoints */}
        <text x={PAD_L} y={H - 6} textAnchor="start" className="fill-ink-faint" fontSize={9}>
          {fmtTime(minT)}
        </text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" className="fill-ink-faint" fontSize={9}>
          {fmtTime(maxT)}
        </text>

        {/* team lines */}
        {series.map(({ team, pts }) => (
          <polyline
            key={team.id}
            points={pts.map((p) => `${x(p.t)},${y(p.v)}`).join(' ')}
            fill="none"
            stroke={team.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}
        {/* end markers */}
        {series.map(({ team, pts }) => {
          const last = pts[pts.length - 1];
          return <circle key={team.id} cx={x(last.t)} cy={y(last.v)} r={3} fill={team.color} />;
        })}
        {/* direct end-labels (≤4 series), de-collided vertically and given a
            surface halo so they stay legible where lines cross */}
        {directLabels &&
          endLabels.map((e) => (
            <text
              key={e.id}
              x={e.cx - 5}
              y={e.labelY}
              textAnchor="end"
              className="fill-ink stroke-surface"
              strokeWidth={3}
              paintOrder="stroke"
              fontSize={9}
              fontWeight={700}
            >
              {e.name}
            </text>
          ))}
      </svg>

      {/* legend (always present for >=2 series) */}
      {series.length >= 2 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map(({ team, total }) => (
            <span key={team.id} className="flex items-center gap-1.5 text-xs font-medium text-ink-muted">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: team.color }} />
              {team.name}
              <span className="tabular-nums text-ink-faint">{formatPoints(total)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
