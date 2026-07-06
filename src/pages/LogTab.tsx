import type { Transaction } from '../types';
import { deleteTransaction } from '../lib/campRepo';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function LogTab({ campId, transactions }: { campId: string; transactions: Transaction[] }) {
  return (
    <div className="flex flex-col gap-2 p-4 pb-28">
      <h2 className="mb-1 text-lg font-bold text-slate-100">Point History</h2>
      {transactions.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-slate-500">
          No points awarded yet.
        </p>
      )}
      {transactions.map((tx) => (
        <div key={tx.id} className="flex items-center gap-3 rounded-xl bg-slate-900 px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-slate-100">
              {tx.teamName} · {tx.reason}
            </p>
            <p className="text-xs text-slate-500">
              {formatTime(tx.createdAt)} · {tx.type === 'event' ? 'Event' : 'Manual'}
            </p>
          </div>
          <span className={`font-bold ${tx.points >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {tx.points >= 0 ? '+' : ''}
            {tx.points}
          </span>
          <button
            onClick={() => deleteTransaction(campId, tx.id)}
            className="text-slate-600"
            aria-label="Undo / delete entry"
          >
            🗑
          </button>
        </div>
      ))}
    </div>
  );
}
