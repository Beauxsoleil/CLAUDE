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
import type { EventPreset, ScheduleItem } from '../types';
import { SortableScheduleItem } from '../components/SortableScheduleItem';
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
}: {
  campId: string;
  schedule: ScheduleItem[];
  presets: EventPreset[];
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

  async function handleAdd(value: ScheduleItemFormValue) {
    const nextOrder = schedule.length ? Math.max(...schedule.map((s) => s.order)) + 1 : 0;
    await addScheduleItem(campId, value, nextOrder);
  }

  async function handleEdit(value: ScheduleItemFormValue) {
    if (!editing) return;
    await updateScheduleItem(campId, editing.id, {
      name: value.name,
      points: value.points,
      durationMin: value.durationMin,
    });
  }

  const totalMinutes = schedule
    .filter((s) => s.status !== 'done')
    .reduce((sum, s) => sum + s.durationMin, 0);

  return (
    <div className="flex flex-col gap-4 p-4 pb-28">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Today's Schedule</h2>
          <p className="text-sm text-slate-500">~{totalMinutes} min remaining · drag to reorder</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="rounded-xl bg-amber-400 px-4 py-2 font-semibold text-slate-900"
        >
          + Add event
        </button>
      </div>

      {schedule.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-500">
          No events yet. Add your first event to build the day's plan.
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={schedule.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-2">
            {schedule.map((item) => (
              <SortableScheduleItem
                key={item.id}
                item={item}
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
