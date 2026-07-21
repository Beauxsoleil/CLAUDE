import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { generateCampCode, normalizeCampCode } from './campCode';
import type { TeamWithTotal } from './scoring';
import type {
  Camp,
  EventPreset,
  ScheduleItem,
  ScheduleStatus,
  ScoringMode,
  Team,
  Transaction,
} from '../types';

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
    pin: data.pin ?? undefined,
    boardCampId: data.boardCampId ?? undefined,
    boardPublishedAt: data.boardPublishedAt ?? undefined,
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
      pin: data.pin ?? undefined,
      boardCampId: data.boardCampId ?? undefined,
      boardPublishedAt: data.boardPublishedAt ?? undefined,
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

export function setCampPin(campId: string, pin: string | null) {
  fireWrite(updateDoc(campDoc(campId), { pin: pin ?? deleteField() }));
}

// --- Hardware board (display camp) ---
//
// The ESP32 board sums a camp's transactions live, so it can't be "frozen"
// while pointed at the real camp. Instead we point it at a separate "display
// camp" whose teams + transactions are overwritten with a standings snapshot
// only when someone presses "Update board" — so the board holds until then.

/** Create a display camp and link it to this camp. Returns the display code. */
export async function linkBoardCamp(campId: string, name: string): Promise<string> {
  const boardCampId = await createCamp(`${name} (Board)`);
  await updateDoc(campDoc(campId), { boardCampId });
  return boardCampId;
}

/** Forget the display camp. The orphan camp doc itself can't be deleted
 *  (rules block camp deletes), but the board simply stops being updated. */
export function unlinkBoardCamp(campId: string) {
  fireWrite(updateDoc(campDoc(campId), { boardCampId: deleteField(), boardPublishedAt: deleteField() }));
}

/** Overwrite the display camp so its teams + one-transaction-per-team snapshot
 *  reproduce the given standings exactly. Team docs are upserted by team id;
 *  the snapshot transactions are wiped and re-created fresh each publish
 *  (transaction *updates* are reserved for reversals by the rules, so a
 *  publish must never rewrite an existing transaction in place). */
export async function publishBoardSnapshot(
  campId: string,
  boardCampId: string,
  teams: TeamWithTotal[],
) {
  const now = Date.now();
  const currentIds = new Set(teams.map((t) => t.id));

  const [existingTeams, existingTx] = await Promise.all([
    getDocs(teamsCol(boardCampId)),
    getDocs(transactionsCol(boardCampId)),
  ]);
  const batch = writeBatch(db);

  // Clear the previous snapshot transactions, then write one per current team.
  for (const d of existingTx.docs) {
    batch.delete(doc(transactionsCol(boardCampId), d.id));
  }
  for (const t of teams) {
    batch.set(doc(teamsCol(boardCampId), t.id), {
      name: t.name,
      color: t.color,
      createdAt: t.createdAt,
    });
    batch.set(doc(transactionsCol(boardCampId)), {
      teamId: t.id,
      teamName: t.name,
      points: t.total,
      reason: 'Published standings',
      type: 'manual',
      scheduleItemId: null,
      createdAt: now,
    });
  }

  // Drop teams that no longer exist in the real camp.
  for (const d of existingTeams.docs) {
    if (!currentIds.has(d.id)) batch.delete(doc(teamsCol(boardCampId), d.id));
  }

  await batch.commit();
  await updateDoc(campDoc(campId), { boardPublishedAt: now });
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

export interface PresetInput {
  name: string;
  points: number;
  durationMin: number;
  scoringMode: ScoringMode;
  placePoints: number[];
}

export function addPreset(campId: string, input: PresetInput) {
  fireWrite(setDoc(doc(presetsCol(campId)), { ...input, createdAt: Date.now() }));
}

export function updatePreset(
  campId: string,
  presetId: string,
  patch: Partial<Pick<EventPreset, 'name' | 'points' | 'durationMin' | 'scoringMode' | 'placePoints'>>,
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
  input: {
    name: string;
    points: number;
    durationMin: number;
    presetId: string | null;
    scoringMode: ScoringMode;
    placePoints: number[];
  },
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
  patch: Partial<
    Pick<
      ScheduleItem,
      'name' | 'points' | 'durationMin' | 'scoringMode' | 'placePoints' | 'status' | 'startedAt' | 'finishedAt'
    >
  >,
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
    awardedBy?: string;
  },
): string {
  const ref = doc(transactionsCol(campId));
  const { awardedBy, ...rest } = input;
  fireWrite(setDoc(ref, { ...rest, ...(awardedBy ? { awardedBy } : {}), createdAt: Date.now() }));
  return ref.id;
}

export function deleteTransaction(campId: string, txId: string) {
  fireWrite(deleteDoc(doc(db, 'camps', campId, 'transactions', txId)));
}

/** Soft-delete: mark an entry reversed so it stays in the log as an audit
 *  record (who reversed it, when) but no longer counts toward totals. */
export function reverseTransaction(campId: string, txId: string, reversedBy: string) {
  fireWrite(
    updateDoc(doc(db, 'camps', campId, 'transactions', txId), {
      reversedAt: Date.now(),
      ...(reversedBy ? { reversedBy } : {}),
    }),
  );
}
