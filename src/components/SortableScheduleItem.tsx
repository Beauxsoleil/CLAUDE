import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ScheduleItem } from '../types';
import { useConfirm } from './confirmContext';
import { CheckIcon, GripIcon, PencilIcon, XIcon } from './icons';
import { placeMedal } from '../lib/placements';
import { formatPoints } from '../lib/format';

const STATUS_STYLES: Record<ScheduleItem['status'], string> = {
  pending: 'bg-surface ring-1 ring-line',
  active: 'bg-accent/10 ring-1 ring-accent/60',
  done: 'bg-surface/50 ring-1 ring-line opacity-70',
};

export interface PlacementDisplay {
  place: number;
  name: string;
  color: string;
}

export function SortableScheduleItem({
  item,
  placements = [],
  canEdit = true,
  onStart,
  onFinish,
  onEdit,
  onDelete,
}: {
  item: ScheduleItem;
  placements?: PlacementDisplay[];
  canEdit?: boolean;
  onStart: () => void;
  onFinish: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const confirm = useConfirm();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  async function handleDelete() {
    const ok = await confirm({
      title: `Remove "${item.name}"?`,
      message: 'It comes off the schedule. Points already awarded for it are kept.',
      confirmLabel: 'Remove event',
      danger: true,
    });
    if (ok) onDelete();
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-1.5 rounded-2xl p-3 ${STATUS_STYLES[item.status]}`}
    >
      {canEdit ? (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none select-none px-1 py-2 text-ink-faint active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripIcon className="h-5 w-5" />
        </button>
      ) : (
        <span className="w-2" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-bold text-ink">{item.name}</p>
          {item.status === 'active' && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-black text-on-accent">
              <span className="h-1 w-1 animate-pulse rounded-full bg-surface" />
              LIVE
            </span>
          )}
          {item.status === 'done' && (
            <span className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-black text-ink-muted">
              <CheckIcon className="h-2.5 w-2.5" />
              DONE
            </span>
          )}
        </div>
        <p className="text-sm text-ink-faint">
          {item.scoringMode === 'ranked'
            ? `By place · ${placeMedal(1)}${formatPoints(item.placePoints?.[0] ?? 0)}`
            : `${formatPoints(item.points)} pts`}{' '}
          · ~{item.durationMin} min
        </p>
        {placements.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
            {placements.map((p) => (
              <span key={p.place} className="flex items-center gap-1 text-xs font-semibold text-ink-muted">
                <span>{placeMedal(p.place)}</span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                {p.name}
                {item.scoringMode === 'ranked' && item.placePoints?.[p.place - 1] != null && (
                  <span className="text-ink-faint">· {formatPoints(item.placePoints[p.place - 1])}</span>
                )}
              </span>
            ))}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-1">
          {item.status === 'pending' && (
            <button
              onClick={onStart}
              className="rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-on-accent transition active:scale-95"
            >
              Start
            </button>
          )}
          {item.status === 'active' && (
            <button
              onClick={onFinish}
              className="rounded-xl bg-surface3 px-3.5 py-2 text-xs font-bold text-ink transition active:scale-95"
            >
              Done
            </button>
          )}
          <button
            onClick={onEdit}
            className="p-1.5 text-ink-faint transition active:text-ink"
            aria-label="Edit"
          >
            <PencilIcon className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            className="p-1.5 text-ink-faint transition active:text-danger"
            aria-label="Delete"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
