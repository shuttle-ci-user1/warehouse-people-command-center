/**
 * Ask HR AI — pre-built question menu that runs real analysis functions
 * on the live dataset (all rule-based, no external AI API).
 */

import { useMemo, useState } from 'react';
import { ASK_HR_QUESTIONS } from '../lib/analytics.js';
import { useAppState } from '../AppState.jsx';
import { Card, Badge } from './ui.jsx';

export default function AskHr() {
  const { dataset } = useAppState();
  const { locations, cohorts, festivals } = dataset;

  const data = useMemo(
    () => ({ locations, cohorts, festivals }),
    [locations, cohorts, festivals],
  );

  const [activeId, setActiveId] = useState(null);
  const [answers, setAnswers] = useState({}); // id -> result

  const active = ASK_HR_QUESTIONS.find((q) => q.id === activeId);

  const ask = (q) => {
    setActiveId(q.id);
    setAnswers((prev) => {
      if (prev[q.id]) return prev; // cached answers stay until data changes
      try {
        return { ...prev, [q.id]: q.run(data) };
      } catch (err) {
        return { ...prev, [q.id]: { headline: 'Analysis failed', detail: err.message, rows: [] } };
      }
    });
  };

  const result = activeId ? answers[activeId] : null;

  return (
    <div className="space-y-6">
      <Card
        title="Ask HR AI"
        subtitle="Pick a question — the answer is computed live from your data, not generated"
        actions={<Badge tone="info">rule-based · deterministic</Badge>}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {ASK_HR_QUESTIONS.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => ask(q)}
              className={`rounded-lg border px-3.5 py-2.5 text-left text-[13px] font-medium transition ${
                activeId === q.id
                  ? 'border-sky-400/60 bg-sky-500/15 text-sky-100'
                  : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:text-slate-100'
              }`}
            >
              {q.question}
            </button>
          ))}
        </div>
      </Card>

      {result && (
        <Card title={active?.question} subtitle={result.detail}>
          <p className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/5 p-3.5 text-sm font-medium leading-relaxed text-sky-100">
            {result.headline}
          </p>
          <div className="space-y-2">
            {result.rows.map((r) => (
              <div key={`${r.label}-${r.value}`} className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-slate-700/60 bg-slate-800/30 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-slate-100">{r.label}</p>
                  {r.sub && <p className="text-[11px] text-slate-500">{r.sub}</p>}
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-sky-300">{r.value}</p>
              </div>
            ))}
            {result.rows.length === 0 && <p className="text-sm text-slate-500">No rows matched.</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
