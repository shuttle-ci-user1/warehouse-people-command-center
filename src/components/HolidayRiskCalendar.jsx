/**
 * Holiday Risk Calendar — festival lookup table with expected dips
 * and per-location exposure for the selected date.
 */

import { useMemo, useState } from 'react';
import { upcomingFestivals, expectedAttendanceOn } from '../lib/analytics.js';
import { useAppState } from '../AppState.jsx';
import { Card, KpiCard, Badge, DataTable, Meter } from './ui.jsx';

const IMPACT_TONE = { critical: 'critical', high: 'warning', moderate: 'info', low: 'good' };

export default function HolidayRiskCalendar() {
  const { dataset } = useAppState();
  const { locations, festivals } = dataset;

  const upcoming = useMemo(() => upcomingFestivals(festivals), [festivals]);
  const [selected, setSelected] = useState(() => upcoming[0]?.date ?? '');

  const fest = useMemo(
    () => festivals.find((f) => f.date === selected) ?? upcoming[0],
    [festivals, selected, upcoming],
  );

  const criticalCount = upcoming.filter((f) => f.impact === 'critical').length;

  const exposure = useMemo(() => {
    if (!fest) return [];
    return locations
      .map((l) => {
        const expected = expectedAttendanceOn(l, fest);
        const absentHc = Math.round((l.headcount * (100 - expected)) / 100);
        return { ...l, expected, absentHc };
      })
      .sort((a, b) => a.expected - b.expected);
  }, [locations, fest]);

  const totalExposed = exposure.reduce((s, l) => s + l.absentHc, 0);
  const worst = exposure[0];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Festivals ahead" value={upcoming.length} hint="in the loaded calendar" />
        <KpiCard label="Critical festivals" value={criticalCount} delta={criticalCount > 0 ? 'plan skeleton crews' : 'none ahead'} deltaGood={criticalCount === 0} />
        <KpiCard label="Selected day dip" value={fest ? `−${fest.expectedDipPct}` : '—'} unit="%" hint={fest?.festival ?? ''} />
        <KpiCard label="Workers absent (est.)" value={totalExposed.toLocaleString('en-IN')} hint="network, on selected date" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Festival risk table" subtitle="Sorted by date · click a row to inspect exposure">
          <div className="max-h-[430px] overflow-y-auto">
            <DataTable
              columns={[
                { key: 'date', label: 'Date' },
                { key: 'festival', label: 'Festival' },
                { key: 'impact', label: 'Impact' },
                { key: 'dip', label: 'Dip', align: 'right' },
                { key: 'regions', label: 'Regions' },
              ]}
            >
              {upcoming.map((f) => (
                <tr
                  key={f.date}
                  onClick={() => setSelected(f.date)}
                  className={`cursor-pointer transition hover:bg-slate-800/40 ${selected === f.date ? 'bg-sky-500/10' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums text-slate-300">{f.date}</td>
                  <td className="px-3 py-2.5">
                    <span className="block text-[13px] font-medium text-slate-100">{f.festival}</span>
                    <span className="text-[11px] leading-snug text-slate-500">{f.note}</span>
                  </td>
                  <td className="px-3 py-2.5"><Badge tone={IMPACT_TONE[f.impact]}>{f.impact}</Badge></td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-red-300">−{f.expectedDipPct}%</td>
                  <td className="px-3 py-2.5 text-[11px] capitalize text-slate-400">{f.affectedRegions.join(', ')}</td>
                </tr>
              ))}
            </DataTable>
          </div>
        </Card>

        <Card
          title={fest ? `Exposure — ${fest.festival} (${fest.date})` : 'Exposure'}
          subtitle={fest ? `${fest.note} · unaffected regions take 20% of the dip` : ''}
          actions={fest ? <Badge tone={IMPACT_TONE[fest.impact]}>{fest.impact}</Badge> : null}
        >
          {worst && (
            <p className="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-200/90">
              Worst hit: <strong>{worst.name}</strong> — expected attendance{' '}
              <strong>{worst.expected}%</strong> (~{worst.absentHc.toLocaleString('en-IN')} of {worst.headcount} workers absent).
              Pre-position backup crews and shift volume to healthier regions.
            </p>
          )}
          <DataTable
            columns={[
              { key: 'name', label: 'Location' },
              { key: 'affected', label: 'Affected', align: 'right' },
              { key: 'expected', label: 'Expected att.', align: 'right' },
              { key: 'absent', label: 'Est. absent', align: 'right' },
            ]}
          >
            {exposure.map((l) => (
              <tr key={l.id} className="hover:bg-slate-800/40">
                <td className="px-3 py-2.5">
                  <span className="block text-[13px] font-medium text-slate-100">{l.name}</span>
                  <span className="text-[11px] text-slate-500">{l.city} · {l.region}</span>
                </td>
                <td className="px-3 py-2.5 text-right">
                  {fest && fest.affectedRegions.includes(l.region.toLowerCase())
                    ? <Badge tone="warning">yes</Badge>
                    : <Badge tone="good">no</Badge>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <span className={`tabular-nums ${l.expected < 70 ? 'text-red-300' : l.expected < 85 ? 'text-amber-300' : 'text-emerald-300'}`}>{l.expected}%</span>
                  <Meter value={l.expected} tone={l.expected < 70 ? 'red' : l.expected < 85 ? 'amber' : 'emerald'} />
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-slate-300">{l.absentHc}</td>
              </tr>
            ))}
          </DataTable>
        </Card>
      </div>
    </div>
  );
}
