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
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
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
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 px-4 py-3 backdrop-blur">
        <h1 className="text-center font-bold">{campName}</h1>
      </header>

      <main>
        {tab === 'live' && (
          <LiveTab
            campId={campId}
            teams={data.teamsWithTotals}
            schedule={data.schedule}
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
        {tab === 'log' && <LogTab campId={campId} transactions={data.transactions} />}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-800 bg-slate-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium ${
              tab === t.id ? 'text-amber-400' : 'text-slate-500'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default App;
