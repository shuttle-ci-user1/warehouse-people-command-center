/**
 * App shell: sidebar navigation + header with data-source status
 * and Google Sheets connection.
 */

import { useState } from 'react';
import { useAppState } from '../AppState.jsx';
import { Badge } from './ui.jsx';
import SheetSettings from './SheetSettings.jsx';

const NAV = [
  { id: 'command', label: 'Command Center', icon: '▦' },
  { id: 'predictor', label: 'Manpower Predictor', icon: '◈' },
  { id: 'attrition', label: 'Attrition Risk', icon: '▼' },
  { id: 'holiday', label: 'Holiday Risk Calendar', icon: '◍' },
  { id: 'whatif', label: 'What-If Simulator', icon: '◑' },
  { id: 'impact', label: 'Business Impact', icon: '₹' },
  { id: 'askhr', label: 'Ask HR AI', icon: '?' },
  { id: 'briefing', label: 'Daily Briefing', icon: '☰' },
];

export default function Shell({ tab, onTab, children }) {
  const { user, logout, dataset, sheetCfg } = useAppState();
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <aside className="flex w-60 shrink-0 flex-col border-r border-slate-800/80 bg-slate-900/50">
        <div className="border-b border-slate-800/80 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-300">▦</span>
            <div className="leading-tight">
              <p className="text-sm font-semibold">People Command</p>
              <p className="text-[10px] uppercase tracking-widest text-slate-500">Warehouse AI</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onTab(n.id)}
              aria-current={tab === n.id ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition ${
                tab === n.id
                  ? 'bg-sky-500/15 text-sky-200'
                  : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <span className="w-4 text-center text-xs opacity-70">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-800/80 p-4">
          <p className="truncate text-xs text-slate-400" title={user?.email}>{user?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 w-full rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-slate-100"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-900/40 px-6 py-3">
          <div>
            <h1 className="text-sm font-semibold text-slate-100">
              {NAV.find((n) => n.id === tab)?.label ?? 'Command Center'}
            </h1>
            <p className="text-[11px] text-slate-500">
              {dataset.loading
                ? 'Loading data…'
                : `${dataset.source === 'sheet' ? 'Google Sheets (live)' : 'Demo dataset'} · ${dataset.locations.length} locations · aggregate only, no PII`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dataset.error && <Badge tone="warning">sheet error → demo fallback</Badge>}
            <Badge tone={dataset.source === 'sheet' ? 'good' : 'neutral'}>
              {dataset.source === 'sheet' ? 'LIVE SHEET' : 'DEMO DATA'}
            </Badge>
            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 transition hover:border-slate-400 hover:text-slate-100"
            >
              {sheetCfg.sheetUrl ? 'Sheet settings' : 'Connect sheet'}
            </button>
          </div>
        </header>
        <main className="min-w-0 flex-1 overflow-x-hidden p-6">{children}</main>
      </div>

      {showSettings && <SheetSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
