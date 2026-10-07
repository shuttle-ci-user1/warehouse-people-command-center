/**
 * Unit tests for the rule-based analytics engines.
 * These functions are the "AI" — every test pins a formula or threshold.
 */

import { describe, it, expect } from 'vitest';
import {
  computeNetworkKpis,
  predictManpower,
  scoreAttritionRisk,
  buildAttritionRiskBoard,
  summarizeAttritionRisk,
  expectedAttendanceOn,
  upcomingFestivals,
  computeBusinessImpact,
  generateInsights,
  generateDailyBriefing,
  ASK_HR_QUESTIONS,
} from '../src/lib/analytics.js';
import { DEMO_LOCATIONS, DEMO_COHORTS, DEMO_FESTIVALS } from '../src/lib/mockData.js';

const demoData = {
  locations: DEMO_LOCATIONS,
  cohorts: DEMO_COHORTS,
  festivals: DEMO_FESTIVALS,
};

describe('computeNetworkKpis', () => {
  it('sums headcount and present across locations', () => {
    const k = computeNetworkKpis(DEMO_LOCATIONS);
    const hc = DEMO_LOCATIONS.reduce((s, l) => s + l.headcount, 0);
    const present = DEMO_LOCATIONS.reduce((s, l) => s + l.present, 0);
    expect(k.headcount).toBe(hc);
    expect(k.present).toBe(present);
    expect(k.absent).toBe(hc - present);
  });

  it('computes attendance rate and absenteeism consistently', () => {
    const k = computeNetworkKpis(DEMO_LOCATIONS);
    expect(k.attendanceRatePct).toBeCloseTo((k.present / k.headcount) * 100, 0);
    expect(k.absenteeismPct).toBeCloseTo(((k.headcount - k.present) / k.headcount) * 100, 0);
  });

  it('weights attrition by headcount', () => {
    const k = computeNetworkKpis(DEMO_LOCATIONS);
    const weighted = DEMO_LOCATIONS.reduce((s, l) => s + l.attritionPct * l.headcount, 0) / k.headcount;
    expect(k.attritionPct).toBeCloseTo(weighted, 1);
  });

  it('handles an empty location list without dividing by zero', () => {
    const k = computeNetworkKpis([]);
    expect(k.headcount).toBe(0);
    expect(k.absenteeismPct).toBe(0);
    expect(k.attritionPct).toBe(0);
    expect(k.otUtilPct).toBe(0);
  });
});

describe('predictManpower (Required HC × Expected Attendance %)', () => {
  it('inflates HC for less-than-perfect attendance', () => {
    // 200 needed on floor at 80% attendance → 250 required HC.
    const p = predictManpower(200, 80);
    expect(p.requiredHc).toBe(250);
    expect(p.expectedOnFloor).toBe(200); // 250 × 0.8 = 200
  });

  it('is the identity at 100% attendance with no buffer', () => {
    const p = predictManpower(120, 100);
    expect(p.requiredHc).toBe(120);
    expect(p.expectedOnFloor).toBe(120);
    expect(p.bufferHc).toBe(0);
  });

  it('adds the safety buffer on top of the base HC', () => {
    // 100 @ 50% → base 200; +10% buffer → 220.
    const p = predictManpower(100, 50, { bufferPct: 10 });
    expect(p.requiredHc).toBe(220);
    expect(p.bufferHc).toBe(20);
    expect(p.expectedOnFloor).toBe(110); // 220 × 0.5
  });

  it('computes the gap against current sanctioned HC', () => {
    const p = predictManpower(200, 80, { currentHc: 200 });
    expect(p.gap).toBe(50); // needs 250, has 200
    const covered = predictManpower(200, 80, { currentHc: 300 });
    expect(covered.gap).toBe(0); // never negative
  });

  it('clamps absurd attendance inputs safely', () => {
    const zero = predictManpower(100, 0); // treated as 1% minimum
    expect(zero.requiredHc).toBeGreaterThan(0);
    const over = predictManpower(100, 150); // treated as 100%
    expect(over.requiredHc).toBe(100);
  });
});

describe('scoreAttritionRisk (tenure / attendance / vendor trend)', () => {
  it('scores a fresh, erratic, weak-vendor cohort as critical', () => {
    const r = scoreAttritionRisk({
      tenureBand: '0-3mo', attendanceBand: 'low', vendorReliability: 70, attritionTrendPct: 2,
    });
    expect(r.score).toBeGreaterThanOrEqual(70);
    expect(r.band).toBe('critical');
    expect(r.drivers.length).toBeGreaterThan(0);
  });

  it('scores a tenured, stable, strong-vendor cohort as low', () => {
    const r = scoreAttritionRisk({
      tenureBand: '12mo+', attendanceBand: 'high', vendorReliability: 95, attritionTrendPct: -1,
    });
    expect(r.score).toBeLessThan(35);
    expect(r.band).toBe('low');
  });

  it('respects the tenure ordering (new joiners riskier)', () => {
    const fresh = scoreAttritionRisk({ tenureBand: '0-3mo', attendanceBand: 'high', vendorReliability: 90, attritionTrendPct: 0 });
    const old = scoreAttritionRisk({ tenureBand: '12mo+', attendanceBand: 'high', vendorReliability: 90, attritionTrendPct: 0 });
    expect(fresh.score).toBeGreaterThan(old.score);
  });

  it('penalizes a worsening vendor attrition trend', () => {
    const flat = scoreAttritionRisk({ tenureBand: '3-6mo', attendanceBand: 'medium', vendorReliability: 85, attritionTrendPct: 0 });
    const worsening = scoreAttritionRisk({ tenureBand: '3-6mo', attendanceBand: 'medium', vendorReliability: 85, attritionTrendPct: 2 });
    expect(worsening.score).toBeGreaterThan(flat.score);
  });
});

describe('buildAttritionRiskBoard', () => {
  it('joins cohorts with location metadata and sorts by risk desc', () => {
    const board = buildAttritionRiskBoard(DEMO_COHORTS, DEMO_LOCATIONS);
    expect(board.length).toBeGreaterThan(0);
    for (let i = 1; i < board.length; i += 1) {
      expect(board[i - 1].score).toBeGreaterThanOrEqual(board[i].score);
    }
    expect(board[0].locationName).toBeTruthy();
  });

  it('filters by region and vendor', () => {
    const south = buildAttritionRiskBoard(DEMO_COHORTS, DEMO_LOCATIONS, { region: 'south' });
    expect(south.length).toBeGreaterThan(0);
    expect(south.every((r) => r.region === 'South')).toBe(true);

    const vega = buildAttritionRiskBoard(DEMO_COHORTS, DEMO_LOCATIONS, { vendor: 'Vega Staffing' });
    expect(vega.every((r) => r.vendor === 'Vega Staffing')).toBe(true);
  });

  it('drops cohorts below the minScore filter', () => {
    const strict = buildAttritionRiskBoard(DEMO_COHORTS, DEMO_LOCATIONS, { minScore: 60 });
    expect(strict.every((r) => r.score >= 60)).toBe(true);
  });

  it('skips cohorts whose location is missing', () => {
    const board = buildAttritionRiskBoard(
      [{ locationId: 'WRH-NOWHERE', tenureBand: '0-3mo', attendanceBand: 'low', vendor: 'x', headcount: 5, attritionPct: 20 }],
      DEMO_LOCATIONS,
    );
    expect(board).toHaveLength(0);
  });
});

describe('summarizeAttritionRisk', () => {
  it('aggregates headcount and HC-weighted average score', () => {
    const board = buildAttritionRiskBoard(DEMO_COHORTS, DEMO_LOCATIONS);
    const s = summarizeAttritionRisk(board);
    const total = board.reduce((a, r) => a + r.headcount, 0);
    expect(s.totalHc).toBe(total);
    expect(s.avgScore).toBeGreaterThanOrEqual(0);
    expect(s.avgScore).toBeLessThanOrEqual(100);
    expect(s.atRiskPct).toBeGreaterThanOrEqual(0);
    expect(s.atRiskPct).toBeLessThanOrEqual(100);
  });
});

describe('expectedAttendanceOn (festival dips)', () => {
  const loc = DEMO_LOCATIONS[0]; // West region

  it('applies the full dip for affected regions', () => {
    const fest = { date: '2026-11-08', festival: 'Diwali', impact: 'critical', expectedDipPct: 45, affectedRegions: ['west'], note: '' };
    const baseline = loc.attendance7d.reduce((s, v) => s + v, 0) / loc.attendance7d.length;
    expect(expectedAttendanceOn(loc, fest)).toBeCloseTo(Math.max(baseline - 45, 40), 1);
  });

  it('applies only 20% of the dip for unaffected regions', () => {
    const fest = { date: '2026-11-08', festival: 'Diwali', impact: 'critical', expectedDipPct: 45, affectedRegions: ['east'], note: '' };
    const baseline = loc.attendance7d.reduce((s, v) => s + v, 0) / loc.attendance7d.length;
    expect(expectedAttendanceOn(loc, fest)).toBeCloseTo(Math.max(baseline - 9, 40), 1);
  });

  it('floors expected attendance at 40%', () => {
    const fest = { date: '2026-03-03', festival: 'Holi', impact: 'critical', expectedDipPct: 90, affectedRegions: ['west'], note: '' };
    expect(expectedAttendanceOn(loc, fest)).toBe(40);
  });
});

describe('upcomingFestivals', () => {
  it('returns only festivals on or after the from date, sorted', () => {
    const from = '2026-11-01';
    const up = upcomingFestivals(DEMO_FESTIVALS, from);
    expect(up.length).toBeGreaterThan(0);
    for (const f of up) expect(f.date >= from).toBe(true);
    for (let i = 1; i < up.length; i += 1) {
      expect(up[i - 1].date.localeCompare(up[i].date)).toBeLessThanOrEqual(0);
    }
    // Everything from before the from date is excluded.
    const before = DEMO_FESTIVALS.filter((f) => f.date < from).map((f) => f.date);
    expect(up.some((f) => before.includes(f.date))).toBe(false);
  });

  it('returns an empty list for a date beyond the calendar', () => {
    expect(upcomingFestivals(DEMO_FESTIVALS, '2030-01-01')).toHaveLength(0);
  });
});

describe('computeBusinessImpact', () => {
  it('returns zero impact when fully staffed', () => {
    const r = computeBusinessImpact(200, 200);
    expect(r.shortfallWorkers).toBe(0);
    expect(r.totalImpact).toBe(0);
    expect(r.unitsShort).toBe(0);
  });

  it('computes the unit and rupee stack from a shortfall', () => {
    // 50 workers short × 9h = 450 wh → × 42 units = 18900 units.
    const r = computeBusinessImpact(200, 150, { hoursPerShift: 9 });
    expect(r.shortfallWorkers).toBe(50);
    expect(r.workerHours).toBe(450);
    expect(r.unitsShort).toBe(18900);
    expect(r.marginAtRisk).toBe(18900 * 11);
    expect(r.catchupCost).toBe(18900 * 6);
  });

  it('scales the requirement by forecast volume', () => {
    // 200 required at 150% volume → need 300; 250 present → 50 short.
    const r = computeBusinessImpact(200, 250, { forecastVolumePct: 150 });
    expect(r.shortfallWorkers).toBe(50);
    expect(r.shortfallPct).toBeCloseTo(16.7, 0);
  });

  it('holds breach probability at zero until the 10% guardrail', () => {
    const within = computeBusinessImpact(100, 95); // 5% short
    expect(within.breachPct).toBe(0);
    expect(within.penalty).toBe(0);

    const beyond = computeBusinessImpact(100, 80); // 20% short → 10pp over guardrail
    expect(beyond.breachPct).toBeCloseTo(0.12, 3); // 10pp × 0.012
    expect(beyond.penalty).toBeGreaterThan(0);
  });

  it('ignores a surplus (shortfall never negative)', () => {
    const r = computeBusinessImpact(100, 130);
    expect(r.shortfallWorkers).toBe(0);
    expect(r.totalImpact).toBe(0);
  });
});

describe('generateInsights (rule engine)', () => {
  it('flags locations breaching guardrails with matching severity', () => {
    const insights = generateInsights(DEMO_LOCATIONS, { festivals: DEMO_FESTIVALS });
    expect(insights.length).toBeGreaterThan(0);
    const critical = insights.filter((i) => i.severity === 'critical');
    expect(critical.length).toBeGreaterThan(0);
    for (const i of critical) {
      expect(i.title).toBeTruthy();
      expect(i.action).toBeTruthy();
      expect(i.locations.length).toBeGreaterThan(0);
    }
  });

  it('sorts by severity: critical before warning before good', () => {
    const insights = generateInsights(DEMO_LOCATIONS, { festivals: DEMO_FESTIVALS });
    const rank = { critical: 0, warning: 1, info: 2, good: 3 };
    for (let i = 1; i < insights.length; i += 1) {
      expect(rank[insights[i - 1].severity]).toBeLessThanOrEqual(rank[insights[i].severity]);
    }
  });

  it('emits a healthy note for locations inside all guardrails', () => {
    const healthy = [{
      id: 'X1', name: 'Healthy Site', city: 'C', region: 'South', vendor: 'V',
      headcount: 100, present: 96, absenteeismPct: 4, attritionPct: 3,
      overtimeHours: 50, otBudgetHours: 100, avgTenureMonths: 12,
      attendance7d: [96, 97, 95, 96, 97, 96, 96], vendorReliability: 95,
      attritionTrendPct: -0.5, shift: 'Morning',
    }];
    const insights = generateInsights(healthy, {});
    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('good');
  });
});

describe('generateDailyBriefing', () => {
  it('produces a headline, snapshot section and dated output', () => {
    const b = generateDailyBriefing(DEMO_LOCATIONS, { cohorts: DEMO_COHORTS, festivals: DEMO_FESTIVALS });
    expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(b.headline).toBeTruthy();
    expect(b.sections.length).toBeGreaterThan(0);
    expect(b.sections[0].heading).toBe('Network snapshot');
    expect(b.sections[0].bullets.length).toBe(4);
  });

  it('lists attrition hotspots from cohort data', () => {
    const b = generateDailyBriefing(DEMO_LOCATIONS, { cohorts: DEMO_COHORTS, festivals: DEMO_FESTIVALS });
    const hot = b.sections.find((s) => s.heading === 'Attrition hotspots (aggregate cohorts)');
    expect(hot).toBeTruthy();
    expect(hot.bullets.length).toBeLessThanOrEqual(3);
  });
});

describe('ASK_HR_QUESTIONS (pre-built analyses)', () => {
  it('has a unique id and question for every entry', () => {
    const ids = ASK_HR_QUESTIONS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const q of ASK_HR_QUESTIONS) expect(q.question).toBeTruthy();
  });

  it('every question runs against the demo data and returns structured rows', () => {
    for (const q of ASK_HR_QUESTIONS) {
      const res = q.run(demoData);
      expect(res.headline).toBeTruthy();
      expect(res.detail).toBeTruthy();
      expect(Array.isArray(res.rows)).toBe(true);
    }
  });

  it('answers are computed, not templated — different data gives different headlines', () => {
    const a = ASK_HR_QUESTIONS.find((q) => q.id === 'q-worst-absenteeism');
    const full = a.run(demoData).headline;
    const single = a.run({ ...demoData, locations: [DEMO_LOCATIONS[3]] }).headline;
    expect(full).not.toBe(single);
  });
});
