import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleItem } from '../types';

const STATUS_STYLES: Record<ScheduleItem['status'], string> = {
  pending: 'bg-slate-900 border-slate-800',
  active: 'bg-amber-400/10 border-amber-400',
  done: 'bg-slate-900/50 border-slate-800 opacity-60',
};

export function SortableScheduleItem({
  item,
  onStart,
  onFinish,
  onEdit,
  onDelete,
}: {
  item: ScheduleItem;
  onStart: () => void;
  onFinish: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-xl border p-3 ${STATUS_STYLES[item.status]}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none px-1 text-xl text-slate-500 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-semibold text-slate-100">{item.name}</p>
          {item.status === 'active' && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-bold text-slate-900">
              LIVE
            </span>
          )}
          {item.status === 'done' && (
            <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs font-bold text-slate-300">
              DONE
            </span>
          )}
        </div>
        <p className="text-sm text-slate-400">
          {item.points} pts · ~{item.durationMin} min
        </p>
      </div>
      <div className="flex items-center gap-1">
        {item.status === 'pending' && (
          <button
            onClick={onStart}
            className="rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900"
          >
            Start
          </button>
        )}
        {item.status === 'active' && (
          <button
            onClick={onFinish}
            className="rounded-lg bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100"
          >
            Done
          </button>
        )}
        <button onClick={onEdit} className="rounded-lg px-2 py-2 text-slate-400" aria-label="Edit">
          ✏️
        </button>
        <button onClick={onDelete} className="rounded-lg px-2 py-2 text-slate-500" aria-label="Delete">
          🗑
        </button>
      </div>
    </div>
  );
}
