/**
 * Google Sheets connection modal — lets an admin point the app at a
 * published (link-shared, view-only) sheet. Falls back to demo data on
 * any error, so the app never breaks.
 */

import { useState } from 'react';
import { useAppState } from '../AppState.jsx';

const inputCls =
  'mt-1 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400';

export default function SheetSettings({ onClose }) {
  const { sheetCfg, connectSheet, useDemoData, dataset } = useAppState();
  const [sheetUrl, setSheetUrl] = useState(sheetCfg.sheetUrl || '');
  const [locationsGid, setLocationsGid] = useState(sheetCfg.locationsGid || '0');
  const [cohortsGid, setCohortsGid] = useState(sheetCfg.cohortsGid || '1');
  const [error, setError] = useState('');

  const save = (e) => {
    e.preventDefault();
    if (sheetUrl && !sheetUrl.includes('/spreadsheets/d/') && !/^[a-zA-Z0-9-_]+$/.test(sheetUrl.trim())) {
      setError('Paste the full sheet URL (or just the sheet ID).');
      return;
    }
    connectSheet(sheetUrl.trim(), { locationsGid: locationsGid.trim(), cohortsGid: cohortsGid.trim() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Google Sheets settings">
      <form onSubmit={save} className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-sm font-semibold text-slate-100">Connect Google Sheet</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          Share your sheet as <em>Anyone with the link can view</em>, then paste its URL.
          Tabs are read via the read-only gviz endpoint — no API key needed.
          Keep the sheet <strong>aggregate-only</strong>: per-location counts and
          percentages, never individual employee rows.
        </p>

        <label htmlFor="ss-url" className="mt-4 block text-xs font-medium text-slate-300">Sheet URL or ID</label>
        <input id="ss-url" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/…" className={inputCls} />

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ss-loc-gid" className="block text-xs font-medium text-slate-300">Locations tab gid</label>
            <input id="ss-loc-gid" value={locationsGid} onChange={(e) => setLocationsGid(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="ss-coh-gid" className="block text-xs font-medium text-slate-300">Cohorts tab gid</label>
            <input id="ss-coh-gid" value={cohortsGid} onChange={(e) => setCohortsGid(e.target.value)} className={inputCls} />
          </div>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
        {dataset.error && <p className="mt-3 text-xs text-amber-400">Last sheet load failed ({dataset.error}) — running on demo data.</p>}

        <p className="mt-4 rounded-lg border border-slate-700 bg-slate-800/40 p-2.5 text-[11px] leading-relaxed text-slate-400">
          Locations tab columns: id, name, city, region, vendor, headcount, present,
          absenteeismPct, attritionPct, overtimeHours, otBudgetHours, avgTenureMonths,
          attendance7d (comma-separated), vendorReliability, attritionTrendPct, shift.
          Cohorts tab: locationId, tenureBand, attendanceBand, vendor, headcount, attritionPct.
        </p>

        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => { useDemoData(); onClose(); }}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500"
          >
            Use demo data
          </button>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-500">Cancel</button>
            <button type="submit" className="rounded-lg bg-sky-500 px-4 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400">Connect</button>
          </div>
        </div>
      </form>
    </div>
  );
}
