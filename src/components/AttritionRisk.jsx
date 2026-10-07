/**
 * Attrition Risk scorer — tenure, attendance pattern, vendor trend.
 * Cohort-level only: aggregate headcounts, no individual records.
 */

import { useMemo, useState } from 'react';
import { buildAttritionRiskBoard, summarizeAttritionRisk, scoreAttritionRisk } from '../lib/analytics.js';
import { useAppState } from '../AppState.jsx';
import { Card, KpiCard, Badge, RiskBand, DataTable, Meter } from './ui.jsx';

export default function AttritionRisk() {
  const { dataset } = useAppState();
  const { locations, cohorts } = dataset;

  const vendors = useMemo(
    () => [...new Set(cohorts.map((c) => c.vendor))].filter(Boolean).sort(),
    [cohorts],
  );
  const regions = useMemo(
    () => [...new Set(locations.map((l) => l.region))].sort(),
    [locations],
  );

  const [region, setRegion] = useState('all');
  const [vendor, setVendor] = useState('all');
  const [minScore, setMinScore] = useState(0);

  const board = useMemo(
    () => buildAttritionRiskBoard(cohorts, locations, {
      region: region === 'all' ? undefined : region,
      vendor: vendor === 'all' ? undefined : vendor,
      minScore: minScore || undefined,
    }),
    [cohorts, locations, region, vendor, minScore],
  );
  const summary = useMemo(() => summarizeAttritionRisk(board), [board]);

  return (
    <div className="space-y-6">
      <Card
        title="Attrition Risk Model"
        subtitle="Score = 45% tenure + 35% attendance pattern + 20% vendor trend — explainable, no black box"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiCard label="Cohort HC scored" value={summary.totalHc.toLocaleString('en-IN')} hint="aggregate cohorts only" />
          <KpiCard label="Avg risk score" value={`${summary.avgScore}/100`} delta={summary.avgScore >= 55 ? 'elevated' : 'manageable'} deltaGood={summary.avgScore < 55} />
          <KpiCard label="High/critical cohorts" value={summary.highOrCriticalCohorts} unit={`(${summary.criticalCohorts} critical)`} />
          <KpiCard label="HC in high-risk cohorts" value={summary.atRiskHc.toLocaleString('en-IN')} unit={`(${summary.atRiskPct}%)`} deltaGood={summary.atRiskPct < 20} delta={summary.atRiskPct >= 20 ? 'prioritize retention spend here' : 'within tolerance'} />
          <KpiCard label="Critical HC" value={summary.criticalHc.toLocaleString('en-IN')} hint="act within 30 days" />
        </div>
      </Card>

      <Card title="Risk board" subtitle="Filters apply live; rows sorted by score">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="ar-region" className="block text-[11px] font-medium text-slate-400">Region</label>
            <select
              id="ar-region" value={region} onChange={(e) => setRegion(e.target.value)}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="all">All regions</option>
              {regions.map((r) => <option key={r} value={r.toLowerCase()}>{r}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="ar-vendor" className="block text-[11px] font-medium text-slate-400">Vendor</label>
            <select
              id="ar-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}
              className="mt-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-100"
            >
              <option value="all">All vendors</option>
              {vendors.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
          <div className="w-44">
            <label htmlFor="ar-score" className="block text-[11px] font-medium text-slate-400">
              Min score: <span className="text-sky-300">{minScore}</span>
            </label>
            <input
              id="ar-score" type="range" min={0} max={90} step={5} value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="mt-3 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400"
            />
          </div>
          <Badge tone="info">{board.length} cohorts shown</Badge>
        </div>

        <DataTable
          columns={[
            { key: 'loc', label: 'Location / cohort' },
            { key: 'score', label: 'Risk', align: 'right' },
            { key: 'hc', label: 'HC', align: 'right' },
            { key: 'attr', label: 'Observed attr.', align: 'right' },
            { key: 'drivers', label: 'Drivers' },
          ]}
        >
          {board.slice(0, 20).map((r) => (
            <tr key={`${r.locationId}-${r.tenureBand}-${r.attendanceBand}`} className="hover:bg-slate-800/40">
              <td className="px-3 py-2.5">
                <span className="block text-[13px] font-medium text-slate-100">{r.locationName}</span>
                <span className="text-[11px] text-slate-500">{r.tenureBand} tenure · {r.attendanceBand} attendance · {r.vendor}</span>
              </td>
              <td className="px-3 py-2.5 text-right">
                <span className={`font-semibold tabular-nums ${r.score >= 70 ? 'text-red-300' : r.score >= 55 ? 'text-orange-300' : r.score >= 35 ? 'text-amber-300' : 'text-emerald-300'}`}>
                  {r.score}
                </span>
                <div className="mt-1"><RiskBand band={r.band} /></div>
                <Meter value={r.score} tone={r.score >= 70 ? 'red' : r.score >= 35 ? 'amber' : 'emerald'} />
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums">{r.headcount}</td>
              <td className="px-3 py-2.5 text-right tabular-nums text-slate-400">{r.attritionPct}%/mo</td>
              <td className="px-3 py-2.5 text-xs leading-relaxed text-slate-400">{r.drivers.join(' · ')}</td>
            </tr>
          ))}
        </DataTable>
      </Card>

      <Card title="Model reference" subtitle="How the three sub-scores map to points">
        <div className="grid gap-4 text-xs text-slate-400 md:grid-cols-3">
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
            <p className="mb-2 font-semibold text-slate-200">Tenure band (45%)</p>
            <ul className="space-y-1">
              <li>0–3 months → 100 pts</li>
              <li>3–6 months → 65 pts</li>
              <li>6–12 months → 35 pts</li>
              <li>12+ months → 10 pts</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
            <p className="mb-2 font-semibold text-slate-200">Attendance pattern (35%)</p>
            <ul className="space-y-1">
              <li>low (&lt;85%) → 100 pts</li>
              <li>medium (85–95%) → 55 pts</li>
              <li>high (≥95%) → 15 pts</li>
            </ul>
          </div>
          <div className="rounded-lg border border-slate-700/60 bg-slate-800/30 p-3">
            <p className="mb-2 font-semibold text-slate-200">Vendor trend (20%)</p>
            <p>(100 − reliability) + 15 × trend(pp/mo), trend capped at +30.</p>
            <p className="mt-2">Example: reliability 78, trend +1.8 → 22 + 27 = 49 pts.</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] text-slate-500">
          Bands: critical ≥70 · high 55–69 · medium 35–54 · low &lt;35.{' '}
          {(() => {
            const ex = scoreAttritionRisk({ tenureBand: '0-3mo', attendanceBand: 'low', vendorReliability: 78, attritionTrendPct: 1.8 });
            return `Worked example: 0-3mo + low attendance + vendor 78/+1.8pp → score ${ex.score} (${ex.band}).`;
          })()}
        </p>
      </Card>
    </div>
  );
}
