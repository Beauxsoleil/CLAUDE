import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import type { EventPreset, ScheduleItem, Team } from '../types';
import type { Placement } from '../hooks/useCampData';
import { SortableScheduleItem, type PlacementDisplay } from '../components/SortableScheduleItem';
import { PlusIcon } from '../components/icons';
import { ScheduleItemModal, type ScheduleItemFormValue } from '../components/ScheduleItemModal';
import {
  addScheduleItem,
  deleteScheduleItem,
  markScheduleItemDone,
  reorderSchedule,
  setActiveScheduleItem,
  updateScheduleItem,
} from '../lib/campRepo';

export function ScheduleTab({
  campId,
  schedule,
  presets,
  teams,
  eventPlacements,
}: {
  campId: string;
  schedule: ScheduleItem[];
  presets: EventPreset[];
  teams: Team[];
  eventPlacements: Map<string, Placement[]>;
}) {
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = schedule.findIndex((s) => s.id === active.id);
    const newIndex = schedule.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(schedule, oldIndex, newIndex);
    await reorderSchedule(campId, reordered.map((s) => s.id));
  }

  function handleAdd(value: ScheduleItemFormValue) {
    const nextOrder = schedule.length ? Math.max(...schedule.map((s) => s.order)) + 1 : 0;
    addScheduleItem(campId, value, nextOrder);
  }

  function handleEdit(value: ScheduleItemFormValue) {
    if (!editing) return;
    updateScheduleItem(campId, editing.id, {
      name: value.name,
      points: value.points,
      durationMin: value.durationMin,
      scoringMode: value.scoringMode,
      placePoints: value.placePoints,
    });
  }

  const remaining = schedule.filter((s) => s.status !== 'done');
  const totalMinutes = remaining.reduce((sum, s) => sum + s.durationMin, 0);
  const doneCount = schedule.length - remaining.length;

  const teamById = new Map(teams.map((t) => [t.id, t]));
  function placementsFor(itemId: string): PlacementDisplay[] {
    return (eventPlacements.get(itemId) ?? []).flatMap((p) => {
      const team = teamById.get(p.teamId);
      return team ? [{ place: p.place, name: team.name, color: team.color }] : [];
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4 pb-32">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-100">Today's Schedule</h2>
          <p className="text-sm text-slate-500">
            {schedule.length > 0
              ? `${doneCount}/${schedule.length} done · ~${totalMinutes} min left · drag to reorder`
              : 'Plan the day, stay flexible'}
          </p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex shrink-0 items-center gap-1.5 rounded-2xl bg-amber-400 px-4 py-2.5 font-bold text-slate-900 transition active:scale-95"
        >
          <PlusIcon className="h-4 w-4" />
          Add
        </button>
      </div>

      {schedule.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center">
          <p className="text-sm text-slate-500">
            No events yet. Add your first event to build the day's plan — you can drag to reorder anytime,
            so it's easy to shuffle the day when plans change.
          </p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={schedule.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {schedule.map((item) => (
              <SortableScheduleItem
                key={item.id}
                item={item}
                placements={placementsFor(item.id)}
                onStart={() => setActiveScheduleItem(campId, schedule, item.id)}
                onFinish={() => markScheduleItemDone(campId, item.id)}
                onEdit={() => {
                  setEditing(item);
                  setShowModal(true);
                }}
                onDelete={() => deleteScheduleItem(campId, item.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {showModal && (
        <ScheduleItemModal
          presets={presets}
          initial={editing}
          onClose={() => setShowModal(false)}
          onSubmit={editing ? handleEdit : handleAdd}
        />
      )}
    </div>
  );
}
