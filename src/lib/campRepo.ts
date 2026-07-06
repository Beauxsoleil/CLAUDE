import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateCampCode, normalizeCampCode } from './campCode';
import type { Camp, EventPreset, ScheduleItem, ScheduleStatus, Team, Transaction } from '../types';

// Writes are intentionally NOT awaited to completion: with offline persistence
// enabled, Firestore applies them to the local cache immediately (snapshots
// fire right away) and syncs to the server whenever a connection exists.
// Awaiting server acknowledgement would hang the UI while offline.
function fireWrite(p: Promise<unknown>) {
  p.catch((err) => console.error('Firestore write failed:', err));
}

function campDoc(campId: string) {
  return doc(db, 'camps', campId);
}
function teamsCol(campId: string) {
  return collection(db, 'camps', campId, 'teams');
}
function presetsCol(campId: string) {
  return collection(db, 'camps', campId, 'eventPresets');
}
function scheduleCol(campId: string) {
  return collection(db, 'camps', campId, 'schedule');
}
function transactionsCol(campId: string) {
  return collection(db, 'camps', campId, 'transactions');
}

// --- Camp ---

export async function createCamp(name: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCampCode();
    const ref = campDoc(code);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { name, createdAt: Date.now(), doublePointDays: [] });
      return code;
    }
  }
  throw new Error('Could not generate a unique camp code, please try again.');
}

export async function campExists(rawCode: string): Promise<Camp | null> {
  const code = normalizeCampCode(rawCode);
  const snap = await getDoc(campDoc(code));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    id: code,
    name: data.name,
    createdAt: data.createdAt,
    doublePointDays: data.doublePointDays ?? [],
  };
}

export function subscribeCamp(campId: string, cb: (camp: Camp | null) => void) {
  return onSnapshot(campDoc(campId), (snap) => {
    if (!snap.exists()) {
      cb(null);
      return;
    }
    const data = snap.data();
    cb({
      id: snap.id,
      name: data.name,
      createdAt: data.createdAt,
      doublePointDays: data.doublePointDays ?? [],
    });
  });
}

export function setDoublePointDay(campId: string, day: string, enabled: boolean) {
  fireWrite(
    updateDoc(campDoc(campId), {
      doublePointDays: enabled ? arrayUnion(day) : arrayRemove(day),
    }),
  );
}

// --- Teams ---

export function subscribeTeams(campId: string, cb: (teams: Team[]) => void) {
  const q = query(teamsCol(campId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Team, 'id'>) })));
  });
}

export function addTeam(campId: string, name: string, color: string) {
  fireWrite(setDoc(doc(teamsCol(campId)), { name, color, createdAt: Date.now() }));
}

export function updateTeam(campId: string, teamId: string, patch: Partial<Pick<Team, 'name' | 'color'>>) {
  fireWrite(updateDoc(doc(db, 'camps', campId, 'teams', teamId), patch));
}

export function deleteTeam(campId: string, teamId: string) {
  fireWrite(deleteDoc(doc(db, 'camps', campId, 'teams', teamId)));
}

// --- Event presets ---

export function subscribePresets(campId: string, cb: (presets: EventPreset[]) => void) {
  const q = query(presetsCol(campId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventPreset, 'id'>) })));
  });
}

export function addPreset(campId: string, name: string, points: number, durationMin: number) {
  fireWrite(setDoc(doc(presetsCol(campId)), { name, points, durationMin, createdAt: Date.now() }));
}

export function updatePreset(
  campId: string,
  presetId: string,
  patch: Partial<Pick<EventPreset, 'name' | 'points' | 'durationMin'>>,
) {
  fireWrite(updateDoc(doc(db, 'camps', campId, 'eventPresets', presetId), patch));
}

export function deletePreset(campId: string, presetId: string) {
  fireWrite(deleteDoc(doc(db, 'camps', campId, 'eventPresets', presetId)));
}

// --- Schedule ---

export function subscribeSchedule(campId: string, cb: (items: ScheduleItem[]) => void) {
  const q = query(scheduleCol(campId), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleItem, 'id'>) })));
  });
}

export function addScheduleItem(
  campId: string,
  input: { name: string; points: number; durationMin: number; presetId: string | null },
  order: number,
) {
  fireWrite(
    setDoc(doc(scheduleCol(campId)), {
      ...input,
      order,
      status: 'pending' as ScheduleStatus,
      startedAt: null,
      finishedAt: null,
      createdAt: Date.now(),
    }),
  );
}

export function updateScheduleItem(
  campId: string,
  itemId: string,
  patch: Partial<Pick<ScheduleItem, 'name' | 'points' | 'durationMin' | 'status' | 'startedAt' | 'finishedAt'>>,
) {
  fireWrite(updateDoc(doc(db, 'camps', campId, 'schedule', itemId), patch));
}

export function deleteScheduleItem(campId: string, itemId: string) {
  fireWrite(deleteDoc(doc(db, 'camps', campId, 'schedule', itemId)));
}

export function reorderSchedule(campId: string, orderedIds: string[]) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'camps', campId, 'schedule', id), { order: index });
  });
  fireWrite(batch.commit());
}

export function setActiveScheduleItem(campId: string, items: ScheduleItem[], activeId: string) {
  const batch = writeBatch(db);
  for (const item of items) {
    if (item.id === activeId) {
      batch.update(doc(db, 'camps', campId, 'schedule', item.id), {
        status: 'active',
        startedAt: item.startedAt ?? Date.now(),
      });
    } else if (item.status === 'active') {
      batch.update(doc(db, 'camps', campId, 'schedule', item.id), { status: 'pending' });
    }
  }
  fireWrite(batch.commit());
}

export function markScheduleItemDone(campId: string, itemId: string) {
  fireWrite(
    updateDoc(doc(db, 'camps', campId, 'schedule', itemId), {
      status: 'done',
      finishedAt: Date.now(),
    }),
  );
}

// --- Transactions (point awards) ---

export function subscribeTransactions(campId: string, cb: (txs: Transaction[]) => void) {
  const q = query(transactionsCol(campId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) })));
  });
}

export function awardPoints(
  campId: string,
  input: {
    teamId: string;
    teamName: string;
    points: number;
    reason: string;
    type: 'event' | 'manual';
    scheduleItemId: string | null;
  },
): string {
  const ref = doc(transactionsCol(campId));
  fireWrite(setDoc(ref, { ...input, createdAt: Date.now() }));
  return ref.id;
}

export function deleteTransaction(campId: string, txId: string) {
  fireWrite(deleteDoc(doc(db, 'camps', campId, 'transactions', txId)));
}
