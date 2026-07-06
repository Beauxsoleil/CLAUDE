import { useEffect, useMemo, useState } from 'react';
import {
  subscribeCamp,
  subscribePresets,
  subscribeSchedule,
  subscribeTeams,
  subscribeTransactions,
} from '../lib/campRepo';
import { dayKey, todayKey } from '../lib/dates';
import type { EventPreset, ScheduleItem, Team, Transaction } from '../types';

export interface TeamWithTotal extends Team {
  total: number;
}

export interface Placement {
  teamId: string;
  place: number;
}

export function useCampData(campId: string | null) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [presets, setPresets] = useState<EventPreset[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doubleDays, setDoubleDays] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campId) {
      setTeams([]);
      setPresets([]);
      setSchedule([]);
      setTransactions([]);
      setDoubleDays(new Set());
      setLoading(false);
      return;
    }
    setLoading(true);
    let pending = 5;
    const settle = () => {
      pending -= 1;
      if (pending <= 0) setLoading(false);
    };
    const unsubCamp = subscribeCamp(campId, (camp) => {
      setDoubleDays(new Set(camp?.doublePointDays ?? []));
      settle();
    });
    const unsubTeams = subscribeTeams(campId, (v) => {
      setTeams(v);
      settle();
    });
    const unsubPresets = subscribePresets(campId, (v) => {
      setPresets(v);
      settle();
    });
    const unsubSchedule = subscribeSchedule(campId, (v) => {
      setSchedule(v);
      settle();
    });
    const unsubTx = subscribeTransactions(campId, (v) => {
      setTransactions(v);
      settle();
    });
    return () => {
      unsubCamp();
      unsubTeams();
      unsubPresets();
      unsubSchedule();
      unsubTx();
    };
  }, [campId]);

  /** 2 on a double-point day, 1 otherwise — applied at read time so a day
   *  can be marked double (or unmarked) retroactively at any point. */
  const multiplierFor = useMemo(
    () => (ts: number) => (doubleDays.has(dayKey(ts)) ? 2 : 1),
    [doubleDays],
  );

  const isTodayDouble = doubleDays.has(todayKey());

  const teamsWithTotals: TeamWithTotal[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      totals.set(tx.teamId, (totals.get(tx.teamId) ?? 0) + tx.points * multiplierFor(tx.createdAt));
    }
    return teams
      .map((t) => ({ ...t, total: totals.get(t.id) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }, [teams, transactions, multiplierFor]);

  /** Finishing order per event, derived from award order (first team awarded
   *  for an event finished 1st, and so on). Undo-safe: deleting an award
   *  shifts the places of everyone after it. */
  const eventPlacements = useMemo(() => {
    const byEvent = new Map<string, Placement[]>();
    // transactions arrive newest-first; walk oldest-first for award order.
    for (let i = transactions.length - 1; i >= 0; i--) {
      const tx = transactions[i];
      if (tx.type !== 'event' || !tx.scheduleItemId) continue;
      let placements = byEvent.get(tx.scheduleItemId);
      if (!placements) {
        placements = [];
        byEvent.set(tx.scheduleItemId, placements);
      }
      if (!placements.some((p) => p.teamId === tx.teamId)) {
        placements.push({ teamId: tx.teamId, place: placements.length + 1 });
      }
    }
    return byEvent;
  }, [transactions]);

  const activeScheduleItem = useMemo(
    () => schedule.find((s) => s.status === 'active') ?? null,
    [schedule],
  );

  const nextScheduleItem = useMemo(() => {
    const pendingItems = schedule.filter((s) => s.status === 'pending').sort((a, b) => a.order - b.order);
    return pendingItems[0] ?? null;
  }, [schedule]);

  return {
    teams,
    teamsWithTotals,
    presets,
    schedule,
    transactions,
    doubleDays,
    isTodayDouble,
    multiplierFor,
    eventPlacements,
    activeScheduleItem,
    nextScheduleItem,
    loading,
  };
}
