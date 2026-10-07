/**
 * Google Sheets data source (read-only).
 *
 * Reads a published sheet via the GViz "gviz/tq" endpoint — no API key,
 * no OAuth, no server needed. The sheet must be shared as "Anyone with
 * the link can view". If no sheet is configured, the app transparently
 * falls back to the bundled demo dataset, so every feature works offline.
 *
 * SECURITY: this module fetches ONLY aggregate rows (per-location counts
 * and percentages). It must never be pointed at a sheet containing
 * employee-level PII.
 */

import { DEMO_LOCATIONS, DEMO_COHORTS, DEMO_FESTIVALS } from './mockData.js';

/**
 * Parse a gviz JSON response body into a 2-D array of cell values.
 * The body looks like `/*O_o*\/\ngoogle.visualization.Query.setResponse({...});`
 * @param {string} raw
 * @returns {string[][]}
 */
export function parseGvizResponse(raw) {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Unexpected Google Sheets response format');
  const json = JSON.parse(raw.slice(start, end + 1));
  if (json.status === 'error') {
    const msg = json.errors?.map((e) => e.detailed_message || e.reason).join('; ');
    throw new Error(`Google Sheets query failed: ${msg || 'unknown error'}`);
  }
  const cols = (json.table?.cols || []).map((c) => (c.label || '').trim());
  const rows = (json.table?.rows || []).map((r) =>
    (r.c || []).map((cell) => (cell && cell.v !== undefined && cell.v !== null ? String(cell.v) : '')),
  );
  return [cols, ...rows];
}

/** Coerce a gviz cell string into a number; returns 0 for junk. */
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[,₹%]/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

/** Lowercased, whitespace-stripped header name for matching. */
const norm = (h) => String(h ?? '').toLowerCase().replace(/\s+/g, '');

/**
 * Parse the "Locations" tab rows (post-header) into LocationSnapshots.
 * Column names (case/whitespace-insensitive): id, name, city, region, vendor,
 * headcount, present, absenteeismPct, attritionPct, overtimeHours, otBudgetHours,
 * avgTenureMonths, attendance7d (7 comma-separated numbers), vendorReliability,
 * attritionTrendPct, shift. Required: id, name, headcount, present.
 *
 * @param {string[][]} grid
 */
export function parseLocationRows(grid) {
  const [header, ...rows] = grid;
  const idx = (name) => header.findIndex((h) => norm(h) === name);
  const iId = idx('id'), iName = idx('name'), iCity = idx('city'), iRegion = idx('region'),
    iVendor = idx('vendor'), iHc = idx('headcount'), iPresent = idx('present'),
    iAbs = idx('absenteeismpct'), iAttr = idx('attritionpct'), iOt = idx('overtimehours'),
    iOtB = idx('otbudgethours'), iTen = idx('avgtenuremonths'), iAtt7 = idx('attendance7d'),
    iRel = idx('vendorreliability'), iTrend = idx('attritiontrendpct'), iShift = idx('shift');
  if (iId === -1 || iName === -1 || iHc === -1 || iPresent === -1) {
    throw new Error('Locations sheet is missing required columns (id, name, headcount, present)');
  }

  return rows
    .filter((r) => r[iId])
    .map((r) => {
      const attendance7d = iAtt7 >= 0 && r[iAtt7]
        ? r[iAtt7].split(',').map((x) => num(x)).filter((x) => x > 0).slice(-7)
        : [];
      return {
        id: r[iId].trim(),
        name: r[iName].trim(),
        city: iCity >= 0 ? r[iCity].trim() : '',
        region: iRegion >= 0 ? r[iRegion].trim() : '',
        vendor: iVendor >= 0 ? r[iVendor].trim() : '',
        headcount: Math.round(num(r[iHc])),
        present: Math.round(num(r[iPresent])),
        absenteeismPct: iAbs >= 0 ? num(r[iAbs]) : 0,
        attritionPct: iAttr >= 0 ? num(r[iAttr]) : 0,
        overtimeHours: iOt >= 0 ? num(r[iOt]) : 0,
        otBudgetHours: iOtB >= 0 ? num(r[iOtB]) : 0,
        avgTenureMonths: iTen >= 0 ? num(r[iTen]) : 0,
        attendance7d: attendance7d.length ? attendance7d : [0],
        vendorReliability: iRel >= 0 ? num(r[iRel]) : 80,
        attritionTrendPct: iTrend >= 0 ? num(r[iTrend]) : 0,
        shift: iShift >= 0 ? r[iShift].trim() : '',
      };
    });
}

/**
 * Parse the "Cohorts" tab rows into CohortRows.
 * Columns: locationId, tenureBand, attendanceBand, vendor, headcount, attritionPct.
 * Required: locationId, tenureBand, headcount.
 * @param {string[][]} grid
 */
export function parseCohortRows(grid) {
  const [header, ...rows] = grid;
  const idx = (name) => header.findIndex((h) => norm(h) === name);
  const iLoc = idx('locationid'), iTen = idx('tenureband'), iAtt = idx('attendanceband'),
    iVendor = idx('vendor'), iHc = idx('headcount'), iAttr = idx('attritionpct');
  if (iLoc === -1 || iTen === -1 || iHc === -1) {
    throw new Error('Cohorts sheet is missing required columns (locationId, tenureBand, headcount)');
  }

  return rows
    .filter((r) => r[iLoc] && r[iTen])
    .map((r) => ({
      locationId: r[iLoc].trim(),
      tenureBand: r[iTen].trim(),
      attendanceBand: iAtt >= 0 ? r[iAtt].trim() : 'medium',
      vendor: iVendor >= 0 ? r[iVendor].trim() : '',
      headcount: Math.round(num(r[iHc])),
      attritionPct: iAttr >= 0 ? num(r[iAttr]) : 0,
    }));
}

/**
 * Build the gviz query URL for a published Google Sheet.
 * @param {string} sheetId
 * @param {string} [gid='0'] Tab gid.
 */
export function buildGvizUrl(sheetId, gid = '0') {
  if (!sheetId || !/^[a-zA-Z0-9-_]+$/.test(sheetId)) {
    throw new Error('Invalid Google Sheet ID');
  }
  return `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&gid=${encodeURIComponent(gid)}`;
}

/**
 * Normalize a raw sheet URL or bare ID into a sheet ID.
 * Accepts: full URL, /d/<id>/..., or bare ID.
 * @param {string} input
 */
export function extractSheetId(input) {
  const s = String(input || '').trim();
  if (!s) return '';
  const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (m) return m[1];
  if (/^[a-zA-Z0-9-_]+$/.test(s)) return s;
  return '';
}

/**
 * Fetch and parse one gviz grid.
 * @param {string} url
 * @returns {Promise<string[][]>}
 */
async function fetchGviz(url) {
  const res = await fetch(url, { credentials: 'omit' });
  if (!res.ok) throw new Error(`Google Sheets request failed (HTTP ${res.status})`);
  return parseGvizResponse(await res.text());
}

/**
 * Load the dataset. If `sheetUrl` is provided and fetch succeeds, use the
 * sheet; otherwise fall back to demo data. Always resolves — the UI never
 * breaks because of a bad sheet link.
 *
 * @param {{sheetUrl?: string, locationsGid?: string, cohortsGid?: string}} [cfg]
 * @returns {Promise<{locations: import('./schema.js').LocationSnapshot[], cohorts: import('./schema.js').CohortRow[], festivals: import('./schema.js').FestivalRow[], source: 'sheet'|'demo', error?: string}>}
 */
export async function loadDataset(cfg = {}) {
  const sheetId = extractSheetId(cfg.sheetUrl || '');
  if (!sheetId) {
    return {
      locations: DEMO_LOCATIONS, cohorts: DEMO_COHORTS, festivals: DEMO_FESTIVALS,
      source: 'demo',
    };
  }
  try {
    const [locGrid, cohGrid] = await Promise.all([
      fetchGviz(buildGvizUrl(sheetId, cfg.locationsGid || '0')),
      fetchGviz(buildGvizUrl(sheetId, cfg.cohortsGid || '1')).catch(() => [[]]),
    ]);
    const locations = parseLocationRows(locGrid);
    if (locations.length === 0) throw new Error('Locations sheet returned zero rows');
    const cohorts = cohGrid.length > 1 ? parseCohortRows(cohGrid) : [];
    return { locations, cohorts, festivals: DEMO_FESTIVALS, source: 'sheet' };
  } catch (err) {
    return {
      locations: DEMO_LOCATIONS, cohorts: DEMO_COHORTS, festivals: DEMO_FESTIVALS,
      source: 'demo', error: err.message,
    };
  }
}
