/**
 * Executive Command Center: KPI cards, location health table,
 * and the rule-based AI insights panel.
 */

import { useMemo, useState } from 'react';
import { computeNetworkKpis, generateInsights } from '../lib/analytics.js';
import { useAppState } from '../AppState.jsx';
import { Card, KpiCard, Badge, Sparkline, Meter, DataTable } from './ui.jsx';

const SEV_TONE = { critical: 'critical', warning: 'warning', good: 'good', info: 'info' };

/** Sortable numeric columns in the health table. */
const NUMERIC_SORTS = {
  headcount: 'headcount',
  present: 'present',
  absenteeismPct: 'absenteeismPct',
  attritionPct: 'attritionPct',
};

export default function CommandCenter() {
  const { dataset } = useAppState();
  const { locations, festivals, cohorts } = dataset;
  const [sortKey, setSortKey] = useState('absenteeismPct');
  const [sortDir, setSortDir] = useState('desc');

  const kpis = useMemo(() => computeNetworkKpis(locations), [locations]);
  const insights = useMemo(
    () => generateInsights(locations, { festivals, cohorts }),
    [locations, festivals, cohorts],
  );

  const sorted = useMemo(() => {
    const arr = [...locations];
    arr.sort((a, b) => (sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return arr;
  }, [locations, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const health = (l) => {
    if (l.absenteeismPct > 15 || l.attritionPct > 10 || l.overtimeHours > l.otBudgetHours * 1.2) return 'critical';
    if (l.absenteeismPct > 12 || l.attritionPct > 8 || l.overtimeHours > l.otBudgetHours) return 'warning';
    return 'good';
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <KpiCard label="Headcount" value={kpis.headcount.toLocaleString('en-IN')} hint={`${kpis.locations} locations · sanctioned`} />
        <KpiCard label="Present today" value={kpis.present.toLocaleString('en-IN')} unit={`(${kpis.attendanceRatePct}%)`} delta={`${kpis.absent} absent`} deltaGood={false} hint="live attendance snapshot" />
        <KpiCard label="Absenteeism" value={kpis.absenteeismPct} unit="%" delta={kpis.absenteeismPct > 12 ? 'above 12% guardrail' : 'within guardrail'} deltaGood={kpis.absenteeismPct <= 12} hint="network blended" />
        <KpiCard label="Attrition" value={kpis.attritionPct} unit="%/mo" delta={kpis.attritionPct > 8 ? 'above 8% band' : 'within band'} deltaGood={kpis.attritionPct <= 8} hint="HC-weighted, rolling 90d" />
        <KpiCard label="Overtime" value={kpis.overtimeHours.toLocaleString('en-IN')} unit="h" delta={`${kpis.otUtilPct}% of budget`} deltaGood={kpis.otUtilPct <= 100} hint={`budget ${kpis.otBudgetHours.toLocaleString('en-IN')}h`} />
      </div>

      <Card
        title="AI Insights — rule-based recommendations"
        subtitle="Every insight traces to a threshold or formula; ranked by severity"
        actions={<Badge tone="info">{insights.filter((i) => i.severity === 'critical').length} critical · {insights.filter((i) => i.severity === 'warning').length} warning</Badge>}
      >
        <ul className="space-y-2.5">
          {insights.slice(0, 8).map((i) => (
            <li key={i.id} className={`rounded-lg border p-3 ${i.severity === 'critical' ? 'border-red-500/30 bg-red-500/5' : i.severity === 'warning' ? 'border-amber-500/30 bg-amber-500/5' : i.severity === 'good' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-slate-700 bg-slate-800/30'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={SEV_TONE[i.severity]}>{i.severity}</Badge>
                <p className="text-sm font-medium text-slate-100">{i.title}</p>
                {i.metric && <span className="text-xs font-semibold text-slate-300">{i.metric}</span>}
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{i.detail}</p>
              <p className="mt-1 text-xs font-medium text-sky-300">→ {i.action}</p>
            </li>
          ))}
          {insights.length === 0 && <li className="text-sm text-slate-500">No locations loaded yet.</li>}
        </ul>
      </Card>

      <Card
        title="Location health"
        subtitle="Numeric column headers sort · guardrails: absent ≤12%, attrition ≤8%/mo, OT ≤ budget"
      >
        <DataTable
          columns={[
            { key: 'name', label: 'Location' },
            { key: 'health', label: 'Health' },
            { key: 'headcount', label: 'HC', align: 'right' },
            { key: 'present', label: 'Present', align: 'right' },
            { key: 'absenteeismPct', label: 'Absent %', align: 'right' },
            { key: 'attritionPct', label: 'Attr %/mo', align: 'right' },
            { key: 'ot', label: 'OT vs budget' },
            { key: 'trend', label: '7-day att.' },
            { key: 'vendor', label: 'Vendor' },
          ]}
        >
          {sorted.map((l) => {
            const otPct = Math.round((l.overtimeHours / Math.max(l.otBudgetHours, 1)) * 100);
            return (
              <tr key={l.id} className="hover:bg-slate-800/40">
                <td className="px-3 py-2.5">
                  <span className="block text-[13px] font-medium text-slate-100">{l.name}</span>
                  <span className="text-[11px] text-slate-500">{l.city} · {l.region} · {l.shift}</span>
                </td>
                <td className="px-3 py-2.5"><Badge tone={health(l)}>{health(l)}</Badge></td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <button type="button" onClick={() => toggleSort('headcount')} className="tabular-nums">{l.headcount}</button>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <button type="button" onClick={() => toggleSort('present')} className="tabular-nums">
                    {l.present}
                    <span className="ml-1 text-[11px] text-slate-500">({Math.round((l.present / Math.max(l.headcount, 1)) * 100)}%)</span>
                  </button>
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => toggleSort('absenteeismPct')} className={`tabular-nums ${l.absenteeismPct > 12 ? 'text-red-300' : 'text-slate-200'}`}>
                    {l.absenteeismPct}%
                  </button>
                  <Meter value={l.absenteeismPct} max={25} tone={l.absenteeismPct > 12 ? 'red' : 'emerald'} threshold={12} />
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button type="button" onClick={() => toggleSort('attritionPct')} className={`tabular-nums ${l.attritionPct > 8 ? 'text-orange-300' : 'text-slate-200'}`}>
                    {l.attritionPct}%
                  </button>
                  <Meter value={l.attritionPct} max={20} tone={l.attritionPct > 8 ? 'amber' : 'emerald'} threshold={8} />
                </td>
                <td className="px-3 py-2.5">
                  <span className={`text-xs tabular-nums ${otPct > 100 ? 'text-red-300' : 'text-slate-300'}`}>
                    {otPct}% ({l.overtimeHours}h)
                  </span>
                  <Meter value={otPct} max={200} tone={otPct > 100 ? 'red' : 'emerald'} threshold={100} />
                </td>
                <td className="px-3 py-2.5"><Sparkline values={l.attendance7d} /></td>
                <td className="px-3 py-2.5 text-xs text-slate-400">{l.vendor}</td>
              </tr>
            );
          })}
        </DataTable>
      </Card>
    </div>
  );
}

// Re-exported so the table header contract stays close to the row renderer
// (numeric sortable keys documented in one place).
export { NUMERIC_SORTS };
