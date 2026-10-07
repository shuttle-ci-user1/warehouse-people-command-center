/**
 * Unit tests for the Google Sheets adapter (parsing + fallback logic).
 * fetch is stubbed so no network is touched.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  parseGvizResponse,
  parseLocationRows,
  parseCohortRows,
  buildGvizUrl,
  extractSheetId,
  loadDataset,
} from '../src/lib/sheetsClient.js';
import { DEMO_LOCATIONS } from '../src/lib/mockData.js';

/** Build a realistic gviz JSON response body for the given grid. */
function gvizBody(cols, rows) {
  const table = {
    cols: cols.map((label) => ({ label })),
    rows: rows.map((r) => ({ c: r.map((v) => ({ v })) })),
  };
  return `/*O_o*/\ngoogle.visualization.Query.setResponse({"version":"0.6","status":"ok","table":${JSON.stringify(table)}});`;
}

const LOC_COLS = ['id', 'name', 'city', 'region', 'vendor', 'headcount', 'present',
  'absenteeismPct', 'attritionPct', 'overtimeHours', 'otBudgetHours', 'avgTenureMonths',
  'attendance7d', 'vendorReliability', 'attritionTrendPct', 'shift'];

const LOC_ROWS = [
  ['WRH-1', 'Alpha FC', 'Pune', 'West', 'VendorA', '120', '108', '10', '6', '300', '400', '8.5', '90,92,88,91,90,89,90', '85', '0.5', 'Morning'],
  ['WRH-2', 'Beta Hub', 'Patna', 'East', 'VendorB', '80', '64', '20', '12', '500', '300', '3.1', '80,79,81,78,77,80,79', '70', '2.0', 'Night'],
];

describe('parseGvizResponse', () => {
  it('extracts the header row and data rows from a gviz body', () => {
    const grid = parseGvizResponse(gvizBody(['a', 'b'], [['1', 'x'], ['2', 'y']]));
    expect(grid).toEqual([['a', 'b'], ['1', 'x'], ['2', 'y']]);
  });

  it('throws on a non-JSON body', () => {
    expect(() => parseGvizResponse('no braces here')).toThrow();
  });

  it('surfaces gviz error status as an exception', () => {
    const body = 'google.visualization.Query.setResponse({"status":"error","errors":[{"reason":"invalid_query","detailed_message":"bad gid"}]})';
    expect(() => parseGvizResponse(body)).toThrow(/bad gid/);
  });
});

describe('parseLocationRows', () => {
  it('maps sheet columns to LocationSnapshot fields', () => {
    const rows = parseLocationRows([LOC_COLS, ...LOC_ROWS]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'WRH-1', name: 'Alpha FC', city: 'Pune', region: 'West', vendor: 'VendorA',
      headcount: 120, present: 108, absenteeismPct: 10, attritionPct: 6,
      overtimeHours: 300, otBudgetHours: 400, avgTenureMonths: 8.5,
      vendorReliability: 85, attritionTrendPct: 0.5, shift: 'Morning',
    });
    expect(rows[0].attendance7d).toHaveLength(7);
  });

  it('throws when required columns are missing', () => {
    expect(() => parseLocationRows([['foo', 'bar'], ['1', '2']])).toThrow(/missing required columns/);
  });

  it('skips blank rows and tolerates messy numbers ("1,200", "12.5%")', () => {
    const grid = [
      LOC_COLS,
      ['', 'blank', '', '', '', '1', '1', '', '', '', '', '', '', '', '', ''],
      ['WRH-3', 'Gamma', 'Pune', 'West', 'VendorA', '1,200', '1,050', '12.5%', '', '', '', '', '', '', '', ''],
    ];
    const rows = parseLocationRows(grid);
    expect(rows).toHaveLength(1);
    expect(rows[0].headcount).toBe(1200);
    expect(rows[0].absenteeismPct).toBe(12.5);
  });
});

describe('parseCohortRows', () => {
  it('maps cohort columns and defaults attendanceBand when absent', () => {
    const grid = [
      ['locationId', 'tenureBand', 'attendanceBand', 'vendor', 'headcount', 'attritionPct'],
      ['WRH-1', '0-3mo', 'low', 'VendorA', '25', '18'],
    ];
    const rows = parseCohortRows(grid);
    expect(rows[0]).toMatchObject({
      locationId: 'WRH-1', tenureBand: '0-3mo', attendanceBand: 'low',
      vendor: 'VendorA', headcount: 25, attritionPct: 18,
    });

    const minimal = [['locationId', 'tenureBand', 'headcount'], ['WRH-1', '12mo+', '10']];
    expect(parseCohortRows(minimal)[0].attendanceBand).toBe('medium');
  });

  it('throws when required cohort columns are missing', () => {
    expect(() => parseCohortRows([['vendor'], ['x']])).toThrow(/missing required columns/);
  });
});

describe('buildGvizUrl / extractSheetId', () => {
  it('builds a gviz URL from a bare sheet ID and gid', () => {
    expect(buildGvizUrl('AbC-123_x', '2')).toBe(
      'https://docs.google.com/spreadsheets/d/AbC-123_x/gviz/tq?tqx=out:json&gid=2',
    );
  });

  it('rejects malformed sheet IDs', () => {
    expect(() => buildGvizUrl('bad/id with spaces')).toThrow(/Invalid/);
    expect(() => buildGvizUrl('')).toThrow(/Invalid/);
  });

  it('extracts the ID from a full URL or accepts a bare ID', () => {
    expect(extractSheetId('https://docs.google.com/spreadsheets/d/AbC123/edit#gid=0')).toBe('AbC123');
    expect(extractSheetId('AbC123')).toBe('AbC123');
    expect(extractSheetId('https://example.com/nope')).toBe('');
    expect(extractSheetId('')).toBe('');
  });
});

describe('loadDataset fallback behaviour', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns demo data when no sheet is configured', async () => {
    const res = await loadDataset({});
    expect(res.source).toBe('demo');
    expect(res.locations).toBe(DEMO_LOCATIONS);
    expect(res.error).toBeUndefined();
  });

  it('falls back to demo data (with error) when the sheet fetch fails', async () => {
    globalThis.fetch = async () => { throw new Error('network down'); };
    const res = await loadDataset({ sheetUrl: 'https://docs.google.com/spreadsheets/d/abc123/edit' });
    expect(res.source).toBe('demo');
    expect(res.error).toMatch(/network down/);
  });

  it('uses sheet data when the fetch succeeds', async () => {
    globalThis.fetch = async (url) => ({
      ok: true,
      text: async () => (url.includes('gid=0')
        ? gvizBody(LOC_COLS, LOC_ROWS)
        : gvizBody(['locationId', 'tenureBand', 'attendanceBand', 'vendor', 'headcount', 'attritionPct'],
          [['WRH-1', '0-3mo', 'low', 'VendorA', '25', '18']])),
    });
    const res = await loadDataset({ sheetUrl: 'abc123', locationsGid: '0', cohortsGid: '1' });
    expect(res.source).toBe('sheet');
    expect(res.locations).toHaveLength(2);
    expect(res.locations[0].name).toBe('Alpha FC');
    expect(res.cohorts).toHaveLength(1);
    expect(res.error).toBeUndefined();
  });

  it('falls back when the sheet parses but has zero location rows', async () => {
    globalThis.fetch = async () => ({ ok: true, text: async () => gvizBody(LOC_COLS, []) });
    const res = await loadDataset({ sheetUrl: 'abc123' });
    expect(res.source).toBe('demo');
    expect(res.error).toMatch(/zero rows/);
  });
});
