/**
 * Business Impact Calculator — translates a staffing shortfall into
 * units, margin, catch-up cost and SLA penalty exposure.
 */

import { useMemo, useState } from 'react';
import { computeBusinessImpact } from '../lib/analytics.js';
import { IMPACT_MODEL } from '../lib/schema.js';
import { useAppState } from '../AppState.jsx';
import { Card, KpiCard, Slider, Badge } from './ui.jsx';

export default function BusinessImpact() {
  const { dataset } = useAppState();
  const { locations } = dataset;

  const totalPresent = locations.reduce((s, l) => s + l.present, 0);

  const [requiredOnFloor, setRequiredOnFloor] = useState(totalPresent || 100);
  const [expectedPresent, setExpectedPresent] = useState(Math.max(Math.round((totalPresent || 100) * 0.88), 10));
  const [hoursPerShift, setHoursPerShift] = useState(9);
  const [volumePct, setVolumePct] = useState(100);

  const impact = useMemo(
    () => computeBusinessImpact(requiredOnFloor, expectedPresent, { hoursPerShift, forecastVolumePct: volumePct }),
    [requiredOnFloor, expectedPresent, hoursPerShift, volumePct],
  );

  return (
    <div className="space-y-6">
      <Card
        title="Business Impact Calculator"
        subtitle="Shortfall → worker-hours → units → margin, catch-up and SLA penalty"
        actions={<Badge tone={impact.totalImpact > 500000 ? 'critical' : impact.totalImpact > 100000 ? 'warning' : 'good'}>₹{impact.totalImpact.toLocaleString('en-IN')} / day</Badge>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,1fr)_minmax(320px,1.2fr)]">
          <div className="space-y-5">
            <Slider id="bi-req" label="Workers required on floor" min={10} max={3000} step={10} value={requiredOnFloor} onChange={setRequiredOnFloor} format={(v) => v.toLocaleString('en-IN')} />
            <Slider id="bi-exp" label="Workers expected present" min={10} max={3000} step={10} value={expectedPresent} onChange={setExpectedPresent} format={(v) => v.toLocaleString('en-IN')} />
            <Slider id="bi-hours" label="Hours per shift" min={4} max={12} step={0.5} value={hoursPerShift} onChange={setHoursPerShift} format={(v) => `${v}h`} />
            <Slider id="bi-vol" label="Forecast volume vs plan" min={50} max={150} step={5} value={volumePct} onChange={setVolumePct} format={(v) => `${v}%`} />
            <p className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3 text-xs leading-relaxed text-slate-400">
              Shortfall = required × volume% − expected. Every unstaffed worker-hour
              costs {IMPACT_MODEL.unitsPerWorkerHour} units of throughput; each unit
              carries ₹{IMPACT_MODEL.marginPerUnit} margin and ₹{IMPACT_MODEL.catchupCostPerUnit} catch-up cost.
              Beyond a 10% shortfall, SLA breach probability climbs {IMPACT_MODEL.slaBreachPerPp * 100}pp per point.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <KpiCard label="Shortfall" value={impact.shortfallWorkers.toLocaleString('en-IN')} unit="workers" hint={`${impact.shortfallPct}% of requirement`} />
              <KpiCard label="Unstaffed hours" value={impact.workerHours.toLocaleString('en-IN')} unit="wh" hint={`${impact.shortfallWorkers} × ${hoursPerShift}h`} />
              <KpiCard label="Units at risk" value={impact.unitsShort.toLocaleString('en-IN')} hint={`${IMPACT_MODEL.unitsPerWorkerHour} units / worker-hour`} />
              <KpiCard label="SLA orders at risk" value={impact.slaOrdersAtRisk.toLocaleString('en-IN')} hint={`${impact.breachPct}% breach probability`} />
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
              <p className="mb-3 text-xs font-semibold text-slate-200">Cost stack (per day)</p>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Gross margin at risk</dt>
                  <dd className="font-semibold tabular-nums text-red-300">₹{impact.marginAtRisk.toLocaleString('en-IN')}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">Catch-up / expedite cost</dt>
                  <dd className="font-semibold tabular-nums text-orange-300">₹{impact.catchupCost.toLocaleString('en-IN')}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-400">SLA penalty exposure</dt>
                  <dd className="font-semibold tabular-nums text-amber-300">₹{impact.penalty.toLocaleString('en-IN')}</dd>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-slate-700/60 pt-2.5">
                  <dt className="font-semibold text-slate-200">Total impact / day</dt>
                  <dd className="text-lg font-bold tabular-nums text-red-300">₹{impact.totalImpact.toLocaleString('en-IN')}</dd>
                </div>
              </dl>
              <p className="mt-3 text-[11px] text-slate-500">
                Scaled to a 30-day month: <strong className="text-slate-300">₹{(impact.totalImpact * 30).toLocaleString('en-IN')}</strong> if the gap persists daily.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
