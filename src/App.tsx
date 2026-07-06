import { useEffect, useState } from 'react';
import { useCampSession } from './hooks/useCampSession';
import { useCampData } from './hooks/useCampData';
import { CampGate } from './components/CampGate';
import { LiveTab } from './pages/LiveTab';
import { ScheduleTab } from './pages/ScheduleTab';
import { SetupTab } from './pages/SetupTab';
import { LogTab } from './pages/LogTab';
import {
  CalendarIcon,
  CheckIcon,
  CopyIcon,
  HistoryIcon,
  SlidersIcon,
  TentIcon,
  TrophyIcon,
  WifiOffIcon,
} from './components/icons';

function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export type Tab = 'live' | 'schedule' | 'setup' | 'log';

const TABS: { id: Tab; label: string; Icon: typeof TrophyIcon }[] = [
  { id: 'live', label: 'Live', Icon: TrophyIcon },
  { id: 'schedule', label: 'Schedule', Icon: CalendarIcon },
  { id: 'setup', label: 'Setup', Icon: SlidersIcon },
  { id: 'log', label: 'History', Icon: HistoryIcon },
];

function App() {
  const session = useCampSession();
  const [tab, setTab] = useState<Tab>('live');

  if (session.loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-950 text-slate-500">
        <TentIcon className="h-10 w-10 text-amber-400" />
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
  const online = useOnline();
  const [codeCopied, setCodeCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(campId);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1500);
    } catch {
      // clipboard API unavailable; ignore
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72"
        style={{ background: 'radial-gradient(ellipse 90% 100% at 50% 0%, rgba(251,191,36,0.06), transparent)' }}
      />

      <header className="sticky top-0 z-30 border-b border-white/5 bg-slate-950/90 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3 px-4 py-3">
          <h1 className="min-w-0 truncate text-lg font-bold tracking-tight">{campName}</h1>
          <button
            onClick={copyCode}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold tracking-widest text-amber-300 ring-1 ring-white/10 transition active:scale-95"
            aria-label="Copy camp code"
          >
            {campId}
            {codeCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5 opacity-60" />}
          </button>
        </div>
        {!online && (
          <div className="flex items-center justify-center gap-1.5 bg-amber-500/15 py-1 text-xs font-semibold text-amber-300">
            <WifiOffIcon className="h-3.5 w-3.5" />
            Offline — points still count and will sync when you're back
          </div>
        )}
      </header>

      <main className="relative mx-auto max-w-lg">
        {tab === 'live' && (
          <LiveTab
            campId={campId}
            teams={data.teamsWithTotals}
            schedule={data.schedule}
            activeScheduleItem={data.activeScheduleItem}
            nextScheduleItem={data.nextScheduleItem}
            isTodayDouble={data.isTodayDouble}
            eventPlacements={data.eventPlacements}
            onNavigate={setTab}
          />
        )}
        {tab === 'schedule' && (
          <ScheduleTab
            campId={campId}
            schedule={data.schedule}
            presets={data.presets}
            teams={data.teams}
            eventPlacements={data.eventPlacements}
          />
        )}
        {tab === 'setup' && (
          <SetupTab
            campId={campId}
            campName={campName}
            teams={data.teamsWithTotals}
            presets={data.presets}
            doubleDays={data.doubleDays}
            onLeave={onLeave}
          />
        )}
        {tab === 'log' && (
          <LogTab
            campId={campId}
            teams={data.teams}
            transactions={data.transactions}
            multiplierFor={data.multiplierFor}
          />
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/5 bg-slate-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
        <div className="mx-auto flex max-w-lg">
          {TABS.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-1 select-none flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-amber-300' : 'text-slate-500'
                }`}
              >
                <span
                  className={`flex h-7 items-center justify-center rounded-full px-4 transition ${
                    active ? 'bg-amber-400/15' : ''
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default App;
