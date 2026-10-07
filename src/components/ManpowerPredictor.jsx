/**
 * Manpower Predictor — Required HC × Expected Attendance %.
 * Also factors a safety buffer and shows the per-location gap.
 */

import { useMemo, useState } from 'react';
import { predictManpower, computeNetworkKpis, upcomingFestivals, expectedAttendanceOn } from '../lib/analytics.js';
import { useAppState } from '../AppState.jsx';
import { Card, KpiCard, Badge, DataTable, Slider } from './ui.jsx';

export default function ManpowerPredictor() {
  const { dataset } = useAppState();
  const { locations, festivals } = dataset;

  const kpis = useMemo(() => computeNetworkKpis(locations), [locations]);
  const nextFest = useMemo(() => upcomingFestivals(festivals)[0], [festivals]);

  const [requiredOnFloor, setRequiredOnFloor] = useState(() => Math.max(kpis.present, 1));
  const [attendancePct, setAttendancePct] = useState(() => Math.max(Math.round(kpis.attendanceRatePct) - 2, 50));
  const [bufferPct, setBufferPct] = useState(5);

  const result = useMemo(
    () => predictManpower(requiredOnFloor, attendancePct, { bufferPct, currentHc: kpis.headcount }),
    [requiredOnFloor, attendancePct, bufferPct, kpis.headcount],
  );

  // Per-location view: apply the same formula using each location's own
  // baseline, adjusted for the next festival if it affects that region.
  const perLocation = useMemo(() => locations.map((l) => {
    const baseline = l.attendance7d.reduce((s, v) => s + v, 0) / (l.attendance7d.length || 1);
    const festAtt = nextFest ? expectedAttendanceOn(l, nextFest) : Math.round(baseline);
    const share = kpis.present > 0 ? l.present / kpis.present : 0;
    const locRequired = Math.round(requiredOnFloor * share);
    const p = predictManpower(locRequired, festAtt, { bufferPct, currentHc: l.headcount });
    return { ...l, baseline: Math.round(baseline), festAtt, locRequired, ...p };
  }), [locations, requiredOnFloor, bufferPct, nextFest, kpis.present]);

  return (
    <div className="space-y-6">
      <Card
        title="Manpower Predictor"
        subtitle="Required HC = Required on-floor ÷ Expected attendance %, plus a safety buffer"
        actions={<Badge tone="info">{nextFest ? `next fest: ${nextFest.festival}` : 'no festivals ahead'}</Badge>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(280px,1fr)_minmax(280px,1.1fr)]">
          <div className="space-y-5">
            <Slider
              id="mp-required"
              label="Workers required on floor"
              min={10} max={3000} step={10}
              value={requiredOnFloor}
              onChange={setRequiredOnFloor}
              format={(v) => v.toLocaleString('en-IN')}
            />
            <Slider
              id="mp-attendance"
              label="Expected attendance %"
              min={40} max={100} step={1}
              value={attendancePct}
              onChange={setAttendancePct}
              format={(v) => `${v}%`}
            />
            <Slider
              id="mp-buffer"
              label="Safety buffer %"
              min={0} max={30} step={1}
              value={bufferPct}
              onChange={setBufferPct}
              format={(v) => `+${v}%`}
            />
            <p className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3 text-xs leading-relaxed text-slate-400">
              The per-location table applies each site's own 7-day baseline
              attendance, minus the festival dip for its region — so festive
              risk is baked into the required HC automatically.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4 self-start">
            <KpiCard label="Required HC" value={result.requiredHc.toLocaleString('en-IN')} hint="incl. buffer, rounded up" />
            <KpiCard label="Expected on floor" value={result.expectedOnFloor.toLocaleString('en-IN')} unit={`(${attendancePct}%)`} hint="requiredHc × attendance%" />
            <KpiCard label="Buffer headcount" value={result.bufferHc} unit="workers" hint="the +buffer% cushion" />
            <KpiCard
              label="Gap vs sanctioned"
              value={result.gap > 0 ? `+${result.gap}` : '0'}
              unit="workers"
              delta={result.gap > 0 ? `need to hire ${result.gap}` : 'current HC is sufficient'}
              deltaGood={result.gap === 0}
              hint={`sanctioned HC ${kpis.headcount.toLocaleString('en-IN')}`}
            />
          </div>
        </div>
      </Card>

      <Card title="Per-location requirement" subtitle="Applies each location's own baseline attendance and festival exposure">
        <DataTable
          columns={[
            { key: 'name', label: 'Location' },
            { key: 'req', label: 'On-floor need', align: 'right' },
            { key: 'att', label: 'Expected att. %', align: 'right' },
            { key: 'hc', label: 'Required HC', align: 'right' },
            { key: 'cur', label: 'Current HC', align: 'right' },
            { key: 'gap', label: 'Gap', align: 'right' },
          ]}
        >
          {perLocation.map((l) => (
            <tr key={l.id} className="hover:bg-slate-800/40">
              <td className="px-3 py-2.5">
                <span className="block text-[13px] font-medium text-slate-100">{l.name}</span>
                <span className="text-[11px] text-slate-500">baseline {l.baseline}%{nextFest ? ` · festive ${l.festAtt}%` : ''}</span>
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{l.locRequired}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{l.festAtt}%</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-sky-300">{l.requiredHc}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{l.headcount}</td>
              <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${l.gap > 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                {l.gap > 0 ? `+${l.gap}` : '✓'}
              </td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </div>
  );
}
