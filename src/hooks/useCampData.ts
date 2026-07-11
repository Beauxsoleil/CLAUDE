import { useEffect, useMemo, useState } from 'react';
import {
  subscribeCamp,
  subscribePresets,
  subscribeSchedule,
  subscribeTeams,
  subscribeTransactions,
} from '../lib/campRepo';
import { todayKey } from '../lib/dates';
import { computePlacements, computeTotals, makeMultiplier } from '../lib/scoring';
import type { EventPreset, ScheduleItem, Team, Transaction } from '../types';

export type { TeamWithTotal, Placement } from '../lib/scoring';

export function useCampData(campId: string | null) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [presets, setPresets] = useState<EventPreset[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [doubleDays, setDoubleDays] = useState<Set<string>>(new Set());
  const [campPin, setCampPin] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!campId) {
      setTeams([]);
      setPresets([]);
      setSchedule([]);
      setTransactions([]);
      setDoubleDays(new Set());
      setCampPin(undefined);
      return;
    }
    const unsubCamp = subscribeCamp(campId, (camp) => {
      setDoubleDays(new Set(camp?.doublePointDays ?? []));
      setCampPin(camp?.pin);
    });
    const unsubTeams = subscribeTeams(campId, setTeams);
    const unsubPresets = subscribePresets(campId, setPresets);
    const unsubSchedule = subscribeSchedule(campId, setSchedule);
    const unsubTx = subscribeTransactions(campId, setTransactions);
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
  const multiplierFor = useMemo(() => makeMultiplier(doubleDays), [doubleDays]);

  const isTodayDouble = doubleDays.has(todayKey());

  const teamsWithTotals = useMemo(
    () => computeTotals(teams, transactions, multiplierFor),
    [teams, transactions, multiplierFor],
  );

  const eventPlacements = useMemo(() => computePlacements(transactions), [transactions]);

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
    campPin,
    isTodayDouble,
    multiplierFor,
    eventPlacements,
    activeScheduleItem,
    nextScheduleItem,
  };
}
