import {
  addDoc,
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

export async function createCamp(name: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateCampCode();
    const ref = campDoc(code);
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, { name, createdAt: Date.now() });
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
  return { id: code, name: data.name, createdAt: data.createdAt };
}

// --- Teams ---

export function subscribeTeams(campId: string, cb: (teams: Team[]) => void) {
  const q = query(teamsCol(campId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Team, 'id'>) })));
  });
}

export async function addTeam(campId: string, name: string, color: string) {
  await addDoc(teamsCol(campId), { name, color, createdAt: Date.now() });
}

export async function updateTeam(campId: string, teamId: string, patch: Partial<Pick<Team, 'name' | 'color'>>) {
  await updateDoc(doc(db, 'camps', campId, 'teams', teamId), patch);
}

export async function deleteTeam(campId: string, teamId: string) {
  await deleteDoc(doc(db, 'camps', campId, 'teams', teamId));
}

// --- Event presets ---

export function subscribePresets(campId: string, cb: (presets: EventPreset[]) => void) {
  const q = query(presetsCol(campId), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<EventPreset, 'id'>) })));
  });
}

export async function addPreset(campId: string, name: string, points: number, durationMin: number) {
  await addDoc(presetsCol(campId), { name, points, durationMin, createdAt: Date.now() });
}

export async function updatePreset(
  campId: string,
  presetId: string,
  patch: Partial<Pick<EventPreset, 'name' | 'points' | 'durationMin'>>,
) {
  await updateDoc(doc(db, 'camps', campId, 'eventPresets', presetId), patch);
}

export async function deletePreset(campId: string, presetId: string) {
  await deleteDoc(doc(db, 'camps', campId, 'eventPresets', presetId));
}

// --- Schedule ---

export function subscribeSchedule(campId: string, cb: (items: ScheduleItem[]) => void) {
  const q = query(scheduleCol(campId), orderBy('order', 'asc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ScheduleItem, 'id'>) })));
  });
}

export async function addScheduleItem(
  campId: string,
  input: { name: string; points: number; durationMin: number; presetId: string | null },
  order: number,
) {
  await addDoc(scheduleCol(campId), {
    ...input,
    order,
    status: 'pending' as ScheduleStatus,
    startedAt: null,
    finishedAt: null,
    createdAt: Date.now(),
  });
}

export async function updateScheduleItem(
  campId: string,
  itemId: string,
  patch: Partial<Pick<ScheduleItem, 'name' | 'points' | 'durationMin' | 'status' | 'startedAt' | 'finishedAt'>>,
) {
  await updateDoc(doc(db, 'camps', campId, 'schedule', itemId), patch);
}

export async function deleteScheduleItem(campId: string, itemId: string) {
  await deleteDoc(doc(db, 'camps', campId, 'schedule', itemId));
}

export async function reorderSchedule(campId: string, orderedIds: string[]) {
  const batch = writeBatch(db);
  orderedIds.forEach((id, index) => {
    batch.update(doc(db, 'camps', campId, 'schedule', id), { order: index });
  });
  await batch.commit();
}

export async function setActiveScheduleItem(campId: string, items: ScheduleItem[], activeId: string) {
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
  await batch.commit();
}

export async function markScheduleItemDone(campId: string, itemId: string) {
  await updateDoc(doc(db, 'camps', campId, 'schedule', itemId), {
    status: 'done',
    finishedAt: Date.now(),
  });
}

// --- Transactions (point awards) ---

export function subscribeTransactions(campId: string, cb: (txs: Transaction[]) => void) {
  const q = query(transactionsCol(campId), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Transaction, 'id'>) })));
  });
}

export async function awardPoints(
  campId: string,
  input: {
    teamId: string;
    teamName: string;
    points: number;
    reason: string;
    type: 'event' | 'manual';
    scheduleItemId: string | null;
  },
): Promise<string> {
  const ref = await addDoc(transactionsCol(campId), { ...input, createdAt: Date.now() });
  return ref.id;
}

export async function deleteTransaction(campId: string, txId: string) {
  await deleteDoc(doc(db, 'camps', campId, 'transactions', txId));
}
