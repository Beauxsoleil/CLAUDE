import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleItem } from '../types';

const STATUS_STYLES: Record<ScheduleItem['status'], string> = {
  pending: 'bg-slate-900 ring-1 ring-white/5',
  active: 'bg-amber-400/10 ring-1 ring-amber-400/60',
  done: 'bg-slate-900/50 ring-1 ring-white/5 opacity-50',
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
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  function handleDelete() {
    if (window.confirm(`Remove "${item.name}" from the schedule?`)) onDelete();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-2xl p-3 ${STATUS_STYLES[item.status]}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none select-none px-1.5 py-2 text-lg text-slate-600 active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold text-slate-100">{item.name}</p>
          {item.status === 'active' && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-slate-900">
              <span className="h-1 w-1 animate-pulse rounded-full bg-slate-900" />
              LIVE
            </span>
          )}
          {item.status === 'done' && (
            <span className="shrink-0 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-black text-slate-400">
              ✓ DONE
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {item.points} pts · ~{item.durationMin} min
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {item.status === 'pending' && (
          <button
            onClick={onStart}
            className="rounded-xl bg-amber-400 px-3.5 py-2 text-xs font-bold text-slate-900 transition active:scale-95"
          >
            Start
          </button>
        )}
        {item.status === 'active' && (
          <button
            onClick={onFinish}
            className="rounded-xl bg-slate-700 px-3.5 py-2 text-xs font-bold text-slate-100 transition active:scale-95"
          >
            Done
          </button>
        )}
        <button
          onClick={onEdit}
          className="px-1.5 py-2 text-slate-500 transition active:text-slate-200"
          aria-label="Edit"
        >
          ✎
        </button>
        <button
          onClick={handleDelete}
          className="px-1.5 py-2 text-slate-600 transition active:text-red-400"
          aria-label="Delete"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
