import { useState } from 'react';
import { useCampSession } from './hooks/useCampSession';
import { useCampData } from './hooks/useCampData';
import { CampGate } from './components/CampGate';
import { LiveTab } from './pages/LiveTab';
import { ScheduleTab } from './pages/ScheduleTab';
import { SetupTab } from './pages/SetupTab';
import { LogTab } from './pages/LogTab';

type Tab = 'live' | 'schedule' | 'setup' | 'log';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'live', label: 'Live', icon: '🏆' },
  { id: 'schedule', label: 'Schedule', icon: '🗓️' },
  { id: 'setup', label: 'Setup', icon: '⚙️' },
  { id: 'log', label: 'History', icon: '📜' },
];

function App() {
  const session = useCampSession();
  const [tab, setTab] = useState<Tab>('live');

  if (session.loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-400">
        <span className="text-4xl">🏕️</span>
        Loading…
      </div>
    );
  }

  if (!session.camp) {
    return <CampGate session={session} />;
  }

  return (
    <CampApp
      campId={session.camp.id}
      campName={session.camp.name}
      tab={tab}
      setTab={setTab}
      onLeave={session.leave}
    />
  );
}

function CampApp({
  campId,
  campName,
  tab,
  setTab,
  onLeave,
}: {
  campId: string;
  campName: string;
  tab: Tab;
  setTab: (t: Tab) => void;
  onLeave: () => void;
}) {
  const data = useCampData(campId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="px-4 py-3">
          <h1 className="text-center font-bold tracking-tight">{campName}</h1>
        </div>
      </header>

      <main className="mx-auto max-w-lg">
        {tab === 'live' && (
          <LiveTab
            campId={campId}
            teams={data.teamsWithTotals}
            schedule={data.schedule}
            transactions={data.transactions}
            activeScheduleItem={data.activeScheduleItem}
            nextScheduleItem={data.nextScheduleItem}
          />
        )}
        {tab === 'schedule' && (
          <ScheduleTab campId={campId} schedule={data.schedule} presets={data.presets} />
        )}
        {tab === 'setup' && (
          <SetupTab
            campId={campId}
            campName={campName}
            teams={data.teamsWithTotals}
            presets={data.presets}
            onLeave={onLeave}
          />
        )}
        {tab === 'log' && (
          <LogTab campId={campId} teams={data.teams} transactions={data.transactions} />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/5 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex flex-1 select-none flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                <span
                  className={`flex h-7 items-center rounded-full px-4 text-base leading-none transition ${
                    active ? 'bg-amber-400/15' : 'opacity-40 grayscale'
                  }`}
                >
                  {t.icon}
                </span>
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
