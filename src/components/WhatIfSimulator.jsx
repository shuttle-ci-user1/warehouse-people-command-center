/**
 * What-If Simulator — sliders for attendance, attrition, OT and volume;
 * recomputes KPIs and business impact live.
 */

import { useMemo, useState } from 'react';
import { computeNetworkKpis, computeBusinessImpact, predictManpower } from '../lib/analytics.js';
import { useAppState } from '../AppState.jsx';
import { Card, KpiCard, Badge, Slider, Meter } from './ui.jsx';

/** OT→HC conversion assumptions. */
const SHIFT_HOURS = 9;
const SHIFT_DAYS_PER_MONTH = 26;

export default function WhatIfSimulator() {
  const { dataset } = useAppState();
  const { locations } = dataset;

  const base = useMemo(() => computeNetworkKpis(locations), [locations]);

  const [attDelta, setAttDelta] = useState(0);      // pp change in attendance
  const [attrDelta, setAttrDelta] = useState(0);     // pp change in monthly attrition
  const [otShiftPct, setOtShiftPct] = useState(0);   // % of OT converted to permanent HC
  const [volumePct, setVolumePct] = useState(100);   // forecast volume vs plan

  const scenario = useMemo(() => {
    // Attendance change applies to the present count.
    const newAttPct = Math.min(Math.max(base.attendanceRatePct + attDelta, 40), 100);
    const newPresent = Math.round((base.headcount * newAttPct) / 100);
    // Attrition change shrinks sanctioned HC over the month.
    const monthlyChurn = Math.round((base.headcount * (base.attritionPct + attrDelta)) / 100);
    const newHc = Math.max(base.headcount - monthlyChurn, 0);
    // OT conversion: shifting OT hours to permanent HC.
    const otHoursShifted = (base.overtimeHours * otShiftPct) / 100;
    const otBackfillHc = Math.ceil(otHoursShifted / (SHIFT_HOURS * SHIFT_DAYS_PER_MONTH));
    const newOt = Math.round(base.overtimeHours - otHoursShifted);
    const requiredOnFloor = Math.round((base.present * volumePct) / 100);
    const hire = predictManpower(requiredOnFloor, newAttPct, { currentHc: newHc + otBackfillHc });
    const impact = computeBusinessImpact(requiredOnFloor, Math.min(newPresent, newHc + otBackfillHc), { forecastVolumePct: 100 });
    return { newAttPct, newPresent, monthlyChurn, newHc, otBackfillHc, newOt, requiredOnFloor, hire, impact };
  }, [base, attDelta, attrDelta, otShiftPct, volumePct]);

  const reset = () => { setAttDelta(0); setAttrDelta(0); setOtShiftPct(0); setVolumePct(100); };

  return (
    <div className="space-y-6">
      <Card
        title="What-If Simulator"
        subtitle="Drag the levers; every output recomputes from the same formulas as production views"
        actions={<button type="button" onClick={reset} className="rounded-lg border border-slate-600 px-3 py-1 text-xs text-slate-300 hover:border-slate-400">Reset</button>}
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(300px,1fr)_minmax(320px,1.2fr)]">
          <div className="space-y-5">
            <Slider id="wi-att" label="Attendance change (pp)" min={-15} max={10} step={1} value={attDelta} onChange={setAttDelta} format={(v) => `${v >= 0 ? '+' : ''}${v}pp`} />
            <Slider id="wi-attr" label="Monthly attrition change (pp)" min={-5} max={10} step={0.5} value={attrDelta} onChange={setAttrDelta} format={(v) => `${v >= 0 ? '+' : ''}${v}pp`} />
            <Slider id="wi-ot" label="Convert OT → permanent HC" min={0} max={100} step={5} value={otShiftPct} onChange={setOtShiftPct} format={(v) => `${v}%`} />
            <Slider id="wi-vol" label="Forecast volume vs plan" min={50} max={150} step={5} value={volumePct} onChange={setVolumePct} format={(v) => `${v}%`} />
            <p className="rounded-lg border border-slate-700/70 bg-slate-800/40 p-3 text-xs leading-relaxed text-slate-400">
              OT conversion assumes {SHIFT_HOURS}h shifts, {SHIFT_DAYS_PER_MONTH} working days a month.
              Attrition change models the trailing 30-day effect on sanctioned headcount.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <KpiCard
                label="Attendance"
                value={scenario.newAttPct}
                unit="%"
                delta={`${scenario.newAttPct - base.attendanceRatePct >= 0 ? '+' : ''}${(scenario.newAttPct - base.attendanceRatePct).toFixed(1)}pp vs today`}
                deltaGood={scenario.newAttPct >= base.attendanceRatePct}
                hint={`present ${scenario.newPresent.toLocaleString('en-IN')}`}
              />
              <KpiCard
                label="Sanctioned HC"
                value={scenario.newHc.toLocaleString('en-IN')}
                delta={`${scenario.monthlyChurn} churning this month`}
                deltaGood={false}
                hint={`+${scenario.otBackfillHc} from OT conversion`}
              />
              <KpiCard
                label="OT hours"
                value={scenario.newOt.toLocaleString('en-IN')}
                unit="h"
                delta={`${scenario.newOt - base.overtimeHours >= 0 ? '+' : ''}${(scenario.newOt - base.overtimeHours).toLocaleString('en-IN')}h vs now`}
                deltaGood={scenario.newOt <= base.overtimeHours}
                hint={`baseline ${base.overtimeHours.toLocaleString('en-IN')}h`}
              />
              <KpiCard
                label="Hiring gap"
                value={scenario.hire.gap > 0 ? `+${scenario.hire.gap}` : '0'}
                unit="workers"
                delta={scenario.hire.gap > 0 ? `hire ${scenario.hire.gap} to cover volume` : 'cover holds'}
                deltaGood={scenario.hire.gap === 0}
                hint={`need ${scenario.requiredOnFloor.toLocaleString('en-IN')} on floor`}
              />
            </div>
            <div className="rounded-xl border border-slate-700/60 bg-slate-900/60 p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-200">Scenario business impact (per day)</p>
                <Badge tone={scenario.impact.totalImpact > 500000 ? 'critical' : scenario.impact.totalImpact > 100000 ? 'warning' : 'good'}>
                  ₹{scenario.impact.totalImpact.toLocaleString('en-IN')}
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-slate-400">
                <div className="flex justify-between"><dt>Shortfall workers</dt><dd className="tabular-nums text-slate-200">{scenario.impact.shortfallWorkers}</dd></div>
                <div className="flex justify-between"><dt>Units at risk</dt><dd className="tabular-nums text-slate-200">{scenario.impact.unitsShort.toLocaleString('en-IN')}</dd></div>
                <div className="flex justify-between"><dt>Margin at risk</dt><dd className="tabular-nums text-slate-200">₹{scenario.impact.marginAtRisk.toLocaleString('en-IN')}</dd></div>
                <div className="flex justify-between"><dt>Catch-up cost</dt><dd className="tabular-nums text-slate-200">₹{scenario.impact.catchupCost.toLocaleString('en-IN')}</dd></div>
                <div className="flex justify-between"><dt>SLA breach prob.</dt><dd className="tabular-nums text-slate-200">{scenario.impact.breachPct}%</dd></div>
                <div className="flex justify-between"><dt>Penalty exposure</dt><dd className="tabular-nums text-slate-200">₹{scenario.impact.penalty.toLocaleString('en-IN')}</dd></div>
              </dl>
              <div className="mt-3">
                <Meter
                  value={scenario.impact.shortfallPct}
                  max={40}
                  tone={scenario.impact.shortfallPct > 10 ? 'red' : 'emerald'}
                  threshold={10}
                  label={`shortfall ${scenario.impact.shortfallPct}% of required on-floor (SLA guardrail 10%)`}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
