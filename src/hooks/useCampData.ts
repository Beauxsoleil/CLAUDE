import { useEffect, useMemo, useState } from 'react';
import {
  subscribePresets,
  subscribeSchedule,
  subscribeTeams,
  subscribeTransactions,
} from '../lib/campRepo';
import type { EventPreset, ScheduleItem, Team, Transaction } from '../types';

export interface TeamWithTotal extends Team {
  total: number;
}

export function useCampData(campId: string | null) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [presets, setPresets] = useState<EventPreset[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!campId) {
      setTeams([]);
      setPresets([]);
      setSchedule([]);
      setTransactions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let pending = 4;
    const settle = () => {
      pending -= 1;
      if (pending <= 0) setLoading(false);
    };
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
      unsubTeams();
      unsubPresets();
      unsubSchedule();
      unsubTx();
    };
  }, [campId]);

  const teamsWithTotals: TeamWithTotal[] = useMemo(() => {
    const totals = new Map<string, number>();
    for (const tx of transactions) {
      totals.set(tx.teamId, (totals.get(tx.teamId) ?? 0) + tx.points);
    }
    return teams
      .map((t) => ({ ...t, total: totals.get(t.id) ?? 0 }))
      .sort((a, b) => b.total - a.total);
  }, [teams, transactions]);

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
    activeScheduleItem,
    nextScheduleItem,
    loading,
  };
}
