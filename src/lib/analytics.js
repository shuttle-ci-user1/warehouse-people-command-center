/**
 * Rule-based analytics engines.
 * Deterministic, explainable "AI": every number traces back to a formula
 * or threshold documented inline. No black boxes, no external API calls.
 */

import { clamp, round, IMPACT_MODEL } from './schema.js';

/* ------------------------------------------------------------------ */
/* KPI aggregation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Aggregate network KPIs across all locations.
 * @param {import('./schema.js').LocationSnapshot[]} locations
 */
export function computeNetworkKpis(locations) {
  const hc = locations.reduce((s, l) => s + l.headcount, 0);
  const present = locations.reduce((s, l) => s + l.present, 0);
  const absent = hc - present;
  const absenteeismPct = hc > 0 ? round((absent / hc) * 100) : 0;
  // Attrition % weighted by headcount so big locations dominate honestly.
  const attritionPct = hc > 0
    ? round(locations.reduce((s, l) => s + l.attritionPct * l.headcount, 0) / hc, 2)
    : 0;
  const overtimeHours = locations.reduce((s, l) => s + l.overtimeHours, 0);
  const otBudgetHours = locations.reduce((s, l) => s + l.otBudgetHours, 0);
  const otUtilPct = otBudgetHours > 0 ? round((overtimeHours / otBudgetHours) * 100) : 0;
  const attendanceRatePct = hc > 0 ? round((present / hc) * 100) : 0;
  const atRiskLocations = locations.filter(
    (l) => l.absenteeismPct > 12 || l.attritionPct > 10 || l.overtimeHours > l.otBudgetHours,
  ).length;

  return {
    headcount: hc,
    present,
    absent,
    absenteeismPct,
    attritionPct,
    overtimeHours,
    otBudgetHours,
    otUtilPct,
    attendanceRatePct,
    locations: locations.length,
    atRiskLocations,
  };
}

/* ------------------------------------------------------------------ */
/* 1. Manpower Predictor: Required HC × Expected Attendance %           */
/* ------------------------------------------------------------------ */

/**
 * The canonical staffing formula: to have `requiredOnFloor` workers actually
 * present, you must staff Required HC = Required on floor ÷ Expected
 * attendance fraction (equivalently Required HC × Expected Attendance % gives
 * expected on-floor count).
 *
 * @param {number} requiredOnFloor Workers needed present to hit volume targets.
 * @param {number} expectedAttendancePct Expected attendance % (0-100), incl. festival dips.
 * @param {Object} [opts]
 * @param {number} [opts.bufferPct=0]     Extra safety buffer % added on top (0-100).
 * @param {number} [opts.currentHc=0]    Existing sanctioned HC (for gap calc).
 * @returns {{requiredHc:number, expectedOnFloor:number, bufferHc:number, gap:number}}
 */
export function predictManpower(requiredOnFloor, expectedAttendancePct, opts = {}) {
  const att = clamp(expectedAttendancePct, 1, 100); // avoid div-by-zero; 100% max
  const bufferPct = clamp(opts.bufferPct ?? 0, 0, 100);
  const baseHc = requiredOnFloor / (att / 100);
  // Epsilon guards against FP noise (e.g. 200 × 1.1 = 220.00000000000003).
  const requiredHc = Math.ceil(baseHc * (1 + bufferPct / 100) - 1e-9);
  const expectedOnFloor = Math.floor(requiredHc * (att / 100));
  const bufferHc = requiredHc - Math.ceil(baseHc - 1e-9);
  const gap = Math.max(requiredHc - (opts.currentHc ?? 0), 0);
  return { requiredHc, expectedOnFloor, bufferHc, gap: Math.round(gap) };
}

/* ------------------------------------------------------------------ */
/* 2. Attrition Risk scorer (tenure / attendance pattern / vendor trend) */
/* ------------------------------------------------------------------ */

// Weights must sum to 100. Rationale: tenure is the strongest single
// predictor of early attrition; attendance pattern is a leading indicator;
// vendor trend is the macro modifier.
const ATTRITION_WEIGHTS = { tenure: 45, attendance: 35, vendor: 20 };

const TENURE_SCORE = { '0-3mo': 100, '3-6mo': 65, '6-12mo': 35, '12mo+': 10 };
const ATTENDANCE_SCORE = { low: 100, medium: 55, high: 15 };

/**
 * Score a cohort's attrition risk 0-100.
 *
 * Sub-scores:
 *  - tenure:      band lookup (new joiners riskiest)
 *  - attendance:  band lookup (erratic attendance precedes exits)
 *  - vendor:      reliability + trend → (100 − reliability) plus trend penalty
 *
 * @param {{tenureBand:string, attendanceBand:string, vendorReliability:number, attritionTrendPct:number}} input
 * @returns {{score:number, band:'low'|'medium'|'high'|'critical', drivers:string[]}}
 */
export function scoreAttritionRisk(input) {
  const tenureScore = TENURE_SCORE[input.tenureBand] ?? 50;
  const attScore = ATTENDANCE_SCORE[input.attendanceBand] ?? 50;
  // Vendor: low reliability = high risk; worsening trend adds up to 30 pts.
  const vendorBase = clamp(100 - (input.vendorReliability ?? 80), 0, 100);
  const trendPenalty = clamp((input.attritionTrendPct ?? 0) * 15, 0, 30);
  const vendorScore = clamp(vendorBase + trendPenalty, 0, 100);

  const score = Math.round(
    (tenureScore * ATTRITION_WEIGHTS.tenure
      + attScore * ATTRITION_WEIGHTS.attendance
      + vendorScore * ATTRITION_WEIGHTS.vendor) / 100,
  );

  const band = score >= 70 ? 'critical'
    : score >= 55 ? 'high'
      : score >= 35 ? 'medium'
        : 'low';

  // Explainability: list the drivers that contributed meaningfully.
  const drivers = [];
  if (tenureScore >= 65) drivers.push(`short tenure (${input.tenureBand})`);
  if (attScore >= 55) drivers.push(`erratic attendance pattern (${input.attendanceBand})`);
  if (vendorBase >= 30) drivers.push(`vendor reliability ${round(input.vendorReliability ?? 80)}/100`);
  if (trendPenalty >= 8) drivers.push(`vendor attrition trending up (+${round(input.attritionTrendPct ?? 0)}pp/mo)`);
  if (drivers.length === 0) drivers.push('stable tenure, attendance and vendor trend');

  return { score, band, drivers };
}

/**
 * Score every cohort, join location metadata, sort by risk.
 * Returns cohort-level rows only — aggregate counts, never individuals.
 *
 * @param {import('./schema.js').CohortRow[]} cohorts
 * @param {import('./schema.js').LocationSnapshot[]} locations
 * @param {Object} [filters] Optional filters: {region, vendor, tenureBand, minScore}
 */
export function buildAttritionRiskBoard(cohorts, locations, filters = {}) {
  const locById = new Map(locations.map((l) => [l.id, l]));
  const rows = [];
  for (const c of cohorts) {
    const loc = locById.get(c.locationId);
    if (!loc) continue;
    if (filters.region && loc.region.toLowerCase() !== filters.region) continue;
    if (filters.vendor && c.vendor !== filters.vendor) continue;
    if (filters.tenureBand && c.tenureBand !== filters.tenureBand) continue;
    const scored = scoreAttritionRisk({
      tenureBand: c.tenureBand,
      attendanceBand: c.attendanceBand,
      vendorReliability: loc.vendorReliability,
      attritionTrendPct: loc.attritionTrendPct,
    });
    if (filters.minScore && scored.score < filters.minScore) continue;
    rows.push({
      locationId: c.locationId,
      locationName: loc.name,
      region: loc.region,
      city: loc.city,
      vendor: c.vendor,
      tenureBand: c.tenureBand,
      attendanceBand: c.attendanceBand,
      headcount: c.headcount,
      attritionPct: c.attritionPct,
      ...scored,
    });
  }
  return rows.sort((a, b) => b.score - a.score);
}

/**
 * Aggregate the risk board into a network-level summary.
 * @param {ReturnType<typeof buildAttritionRiskBoard>} board
 */
export function summarizeAttritionRisk(board) {
  const total = board.reduce((s, r) => s + r.headcount, 0);
  const weighted = board.reduce((s, r) => s + r.score * r.headcount, 0);
  const atRisk = board.filter((r) => r.band === 'high' || r.band === 'critical');
  const atRiskHc = atRisk.reduce((s, r) => s + r.headcount, 0);
  const critical = board.filter((r) => r.band === 'critical');
  return {
    totalHc: total,
    avgScore: total > 0 ? Math.round(weighted / total) : 0,
    highOrCriticalCohorts: atRisk.length,
    atRiskHc,
    atRiskPct: total > 0 ? round((atRiskHc / total) * 100) : 0,
    criticalCohorts: critical.length,
    criticalHc: critical.reduce((s, r) => s + r.headcount, 0),
  };
}

/* ------------------------------------------------------------------ */
/* 3. Holiday / Festival risk calendar                                  */
/* ------------------------------------------------------------------ */

/**
 * Effective expected attendance for a location on a festival date:
 * baseline 7-day avg minus the festival dip (only if region is affected),
 * floored at a hard 40% so predictions stay sane.
 *
 * @param {import('./schema.js').LocationSnapshot} loc
 * @param {import('./schema.js').FestivalRow} festival
 */
export function expectedAttendanceOn(loc, festival) {
  const baseline =
    loc.attendance7d.reduce((s, v) => s + v, 0) / (loc.attendance7d.length || 1);
  const affected = festival.affectedRegions.includes(loc.region.toLowerCase());
  const expected = affected
    ? Math.max(baseline - festival.expectedDipPct, 40)
    : Math.max(baseline - festival.expectedDipPct * 0.2, 40);
  return round(expected);
}

/**
 * Upcoming festivals sorted by date (from `fromDate`, default today).
 * @param {import('./schema.js').FestivalRow[]} festivals
 * @param {string} [fromDate] ISO date.
 */
export function upcomingFestivals(festivals, fromDate) {
  const from = fromDate || new Date().toISOString().slice(0, 10);
  return festivals
    .filter((f) => f.date >= from)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Impact → UI severity rank (lower = worse). */
export const IMPACT_RANK = { critical: 0, high: 1, moderate: 2, low: 3 };

/* ------------------------------------------------------------------ */
/* 4. Business Impact Calculator                                        */
/* ------------------------------------------------------------------ */

/**
 * Translate a staffing shortfall into business outcomes.
 *
 * shortfallWorkers = required on floor − expected present (scaled by volume)
 * workerHours      = shortfallWorkers × hoursPerShift
 * unitsShort       = workerHours × unitsPerWorkerHour
 * marginAtRisk     = unitsShort × marginPerUnit
 * catchupCost      = unitsShort × catchupCostPerUnit
 * slaOrders        = unitsShort / 100 × ordersPer100Units
 * breachPct        = shortfall% beyond 10% × slaBreachPerPp
 * penalty          = slaOrders × breachPct × slaPenaltyPerOrder
 * totalImpact      = marginAtRisk + catchupCost + penalty
 *
 * @param {number} requiredOnFloor
 * @param {number} expectedPresent
 * @param {Object} [opts] { hoursPerShift=9, forecastVolumePct=100 }
 * @returns {{
 *  shortfallWorkers:number, shortfallPct:number, workerHours:number,
 *  unitsShort:number, marginAtRisk:number, catchupCost:number,
 *  slaOrdersAtRisk:number, breachPct:number, penalty:number, totalImpact:number
 * }}
 */
export function computeBusinessImpact(requiredOnFloor, expectedPresent, opts = {}) {
  const hours = clamp(opts.hoursPerShift ?? 9, 1, 24);
  const volumePct = clamp(opts.forecastVolumePct ?? 100, 1, 300) / 100;
  const required = Math.max(requiredOnFloor * volumePct, 0);
  const shortfallWorkers = Math.max(required - expectedPresent, 0);
  const shortfallPct = required > 0 ? round((shortfallWorkers / required) * 100) : 0;
  const workerHours = round(shortfallWorkers * hours);
  const unitsShort = Math.round(workerHours * IMPACT_MODEL.unitsPerWorkerHour);
  const marginAtRisk = Math.round(unitsShort * IMPACT_MODEL.marginPerUnit);
  const catchupCost = Math.round(unitsShort * IMPACT_MODEL.catchupCostPerUnit);
  const slaOrdersAtRisk = round((unitsShort / 100) * IMPACT_MODEL.ordersPer100Units);
  const breachPct = round(
    clamp(shortfallPct - 10, 0, 100) * IMPACT_MODEL.slaBreachPerPp,
    3,
  );
  const penalty = Math.round(slaOrdersAtRisk * breachPct * IMPACT_MODEL.slaPenaltyPerOrder);
  const totalImpact = marginAtRisk + catchupCost + penalty;
  return {
    shortfallWorkers: Math.round(shortfallWorkers),
    shortfallPct,
    workerHours,
    unitsShort,
    marginAtRisk,
    catchupCost,
    slaOrdersAtRisk,
    breachPct,
    penalty,
    totalImpact,
  };
}

/* ------------------------------------------------------------------ */
/* 5. Rule-based insight engine (the "AI insights" panel)               */
/* ------------------------------------------------------------------ */

/**
 * Generate ranked, explainable recommendations from location snapshots.
 * Each rule fires independently; results are sorted by severity.
 *
 * @param {import('./schema.js').LocationSnapshot[]} locations
 * @param {Object} [ctx] { festivals: FestivalRow[] }
 * @returns {Array<{id:string, severity:'critical'|'warning'|'info'|'good', title:string, detail:string, action:string, locations:string[], metric?:string}>}
 */
export function generateInsights(locations, ctx = {}) {
  const out = [];

  for (const loc of locations) {
    const baseline =
      loc.attendance7d.reduce((s, v) => s + v, 0) / (loc.attendance7d.length || 1);
    const trend = loc.attendance7d.length >= 2
      ? loc.attendance7d[loc.attendance7d.length - 1] - loc.attendance7d[0]
      : 0;

    if (loc.absenteeismPct > 15) {
      out.push({
        id: `abs-${loc.id}`, severity: 'critical', locations: [loc.name], metric: `${loc.absenteeismPct}%`,
        title: `Absenteeism above 15% at ${loc.name}`,
        detail: `7-day attendance averages ${round(baseline)}% and is trending ${trend >= 0 ? '+' : ''}${round(trend)}pp. At ${loc.absenteeismPct}% absenteeism, daily throughput is at risk.`,
        action: `Trigger attendance-incentive scheme and audit vendor ${loc.vendor} fill-rate this week.`,
      });
    } else if (loc.absenteeismPct > 12) {
      out.push({
        id: `abs-${loc.id}`, severity: 'warning', locations: [loc.name], metric: `${loc.absenteeismPct}%`,
        title: `Absenteeism elevated at ${loc.name}`,
        detail: `Absenteeism at ${loc.absenteeismPct}% exceeds the 12% network guardrail; attendance trend is ${trend >= 0 ? '+' : ''}${round(trend)}pp over 7 days.`,
        action: 'Move to daily attendance tracking and pre-shift confirmation calls.',
      });
    }

    if (loc.attritionPct > 10) {
      out.push({
        id: `attr-${loc.id}`, severity: 'critical', locations: [loc.name], metric: `${loc.attritionPct}%/mo`,
        title: `Attrition critical at ${loc.name}`,
        detail: `Monthly attrition of ${loc.attritionPct}% with vendor trend +${round(loc.attritionTrendPct)}pp/mo and average tenure of ${loc.avgTenureMonths} months — a churn flywheel is forming.`,
        action: `Open vendor performance review with ${loc.vendor}; fast-track retention bonuses for 0-6 month tenure bands.`,
      });
    } else if (loc.attritionPct > 8) {
      out.push({
        id: `attr-${loc.id}`, severity: 'warning', locations: [loc.name], metric: `${loc.attritionPct}%/mo`,
        title: `Attrition elevated at ${loc.name}`,
        detail: `Attrition at ${loc.attritionPct}%/mo is above the 8% comfort band, with average tenure ${loc.avgTenureMonths} months.`,
        action: 'Schedule stay-interviews for high-risk tenure cohorts this week.',
      });
    }

    if (loc.overtimeHours > loc.otBudgetHours) {
      const overPct = round((loc.overtimeHours / Math.max(loc.otBudgetHours, 1) - 1) * 100);
      out.push({
        id: `ot-${loc.id}`, severity: loc.overtimeHours > loc.otBudgetHours * 1.2 ? 'critical' : 'warning',
        locations: [loc.name], metric: `${overPct}% over`,
        title: `Overtime budget breached at ${loc.name}`,
        detail: `${loc.overtimeHours} OT hours against a ${loc.otBudgetHours}-hour budget (${overPct}% over). Chronic OT signals structural understaffing, not seasonal spikes.`,
        action: 'Convert recurring OT into sanctioned headcount; re-baseline the budget.',
      });
    }

    if (loc.vendorReliability < 80) {
      out.push({
        id: `ven-${loc.id}`, severity: 'warning', locations: [loc.name], metric: `${loc.vendorReliability}/100`,
        title: `Vendor reliability low at ${loc.name}`,
        detail: `${loc.vendor} scores ${loc.vendorReliability}/100 on fill-rate with attrition trending +${round(loc.attritionTrendPct)}pp/mo.`,
        action: 'Add a second vendor to the location roster and set minimum fill-rate SLAs.',
      });
    }

    if (loc.absenteeismPct <= 12 && loc.attritionPct <= 8 && loc.overtimeHours <= loc.otBudgetHours) {
      out.push({
        id: `ok-${loc.id}`, severity: 'good', locations: [loc.name],
        title: `${loc.name} is healthy`,
        detail: `All guardrails green: absenteeism ${loc.absenteeismPct}%, attrition ${loc.attritionPct}%/mo, OT within budget.`,
        action: 'Use as a benchmark site; document its practices for the network playbook.',
      });
    }
  }

  // Festival context: critical festivals in the next 21 days with exposed HC.
  const festivals = ctx.festivals || [];
  const horizon = upcomingFestivals(festivals);
  const today = new Date();
  const in21 = new Date(today.getTime() + 21 * 86400000).toISOString().slice(0, 10);
  const nearCritical = horizon.filter((f) => f.date <= in21 && f.impact === 'critical');
  for (const f of nearCritical.slice(0, 3)) {
    const exposed = locations
      .filter((l) => f.affectedRegions.includes(l.region.toLowerCase()))
      .reduce((s, l) => s + l.headcount, 0);
    out.push({
      id: `fest-${f.date}`, severity: 'critical', locations: [f.festival], metric: `-${f.expectedDipPct}%`,
      title: `${f.festival} on ${f.date} exposes ${exposed} workers' locations`,
      detail: `Expected dip ${f.expectedDipPct}% across ${f.affectedRegions.length} regions (~${exposed} HC exposed). ${f.note}`,
      action: 'Freeze leave, pre-book backup vendor crews, and shift volume to unaffected regions.',
    });
  }

  const sevRank = { critical: 0, warning: 1, info: 2, good: 3 };
  return out.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
}

/* ------------------------------------------------------------------ */
/* 6. Daily Briefing generator                                          */
/* ------------------------------------------------------------------ */

/**
 * Deterministic daily briefing: a prioritized, human-readable ops summary.
 *
 * @param {import('./schema.js').LocationSnapshot[]} locations
 * @param {Object} [ctx] { festivals: FestivalRow[], cohorts: CohortRow[] }
 * @returns {{date:string, headline:string, sections:Array<{heading:string, bullets:string[]}>}}
 */
export function generateDailyBriefing(locations, ctx = {}) {
  const kpis = computeNetworkKpis(locations);
  const insights = generateInsights(locations, ctx);
  const critical = insights.filter((i) => i.severity === 'critical');
  const warnings = insights.filter((i) => i.severity === 'warning');
  const topRiskBoard = buildAttritionRiskBoard(ctx.cohorts || [], locations);
  const topCohorts = topRiskBoard.slice(0, 3);

  const sections = [];

  sections.push({
    heading: 'Network snapshot',
    bullets: [
      `${kpis.present}/${kpis.headcount} workers present (${kpis.attendanceRatePct}% attendance) across ${kpis.locations} locations.`,
      `Absenteeism at ${kpis.absenteeismPct}% network-wide; attrition at ${kpis.attritionPct}%/mo (HC-weighted).`,
      `Overtime: ${kpis.overtimeHours}h against ${kpis.otBudgetHours}h budget (${kpis.otUtilPct}% utilization).`,
      `${kpis.atRiskLocations} location(s) breaching at least one guardrail.`,
    ],
  });

  const critBullets = critical.slice(0, 5).map((i) => `${i.title} — ${i.action}`);
  if (critBullets.length) sections.push({ heading: 'Act today', bullets: critBullets });

  const warnBullets = warnings.slice(0, 4).map((i) => `${i.title} — ${i.action}`);
  if (warnBullets.length) sections.push({ heading: 'Watch list', bullets: warnBullets });

  const festivals = upcomingFestivals(ctx.festivals || []);
  const nextFest = festivals[0];
  if (nextFest) {
    const days = Math.max(
      0,
      Math.round(
        (new Date(nextFest.date).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000,
      ),
    );
    sections.push({
      heading: 'Holiday radar',
      bullets: [
        `Next festival: ${nextFest.festival} in ${days} day(s) (${nextFest.impact} impact, −${nextFest.expectedDipPct}% expected dip). ${nextFest.note}`,
        ...festivals.slice(1, 3).map(
          (f) => `Then: ${f.festival} on ${f.date} (${f.impact}, −${f.expectedDipPct}%).`,
        ),
      ],
    });
  }

  if (topCohorts.length) {
    sections.push({
      heading: 'Attrition hotspots (aggregate cohorts)',
      bullets: topCohorts.map(
        (r) => `${r.locationName} · ${r.tenureBand} · ${r.attendanceBand} attendance — risk ${r.score}/100 (${r.band}); drivers: ${r.drivers.join(', ')}.`,
      ),
    });
  }

  const headline = critical.length
    ? `${critical.length} critical alert(s) — network attendance ${kpis.attendanceRatePct}%, absenteeism ${kpis.absenteeismPct}%`
    : `Network stable — attendance ${kpis.attendanceRatePct}%, no critical alerts`;

  return {
    date: new Date().toISOString().slice(0, 10),
    headline,
    sections,
  };
}

/* ------------------------------------------------------------------ */
/* 7. Ask-HR analysis functions (driven by the same engines)            */
/* ------------------------------------------------------------------ */

/**
 * Pre-built Ask-HR analyses. Each takes the full dataset and returns
 * a structured answer the UI renders. Pure functions — trivially testable.
 */
export const ASK_HR_QUESTIONS = [
  {
    id: 'q-worst-absenteeism',
    question: 'Which locations have the worst absenteeism right now?',
    run: (data) => {
      const rows = [...data.locations]
        .sort((a, b) => b.absenteeismPct - a.absenteeismPct)
        .slice(0, 5)
        .map((l) => ({ label: l.name, value: `${l.absenteeismPct}%`, sub: `${l.city} · ${l.vendor}` }));
      const worst = rows[0];
      return {
        headline: worst
          ? `${worst.label} leads absenteeism at ${worst.value}`
          : 'No location data available.',
        detail: 'Ranked by 7-day-average absenteeism percentage across the network.',
        rows,
      };
    },
  },
  {
    id: 'q-attrition-drivers',
    question: 'What is driving attrition risk the most?',
    run: (data) => {
      const board = buildAttritionRiskBoard(data.cohorts, data.locations);
      const summary = summarizeAttritionRisk(board);
      const byDriver = {};
      for (const r of board) {
        if (r.band !== 'high' && r.band !== 'critical') continue;
        for (const d of r.drivers) byDriver[d] = (byDriver[d] || 0) + r.headcount;
      }
      const rows = Object.entries(byDriver)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([label, hc]) => ({ label, value: `${hc} HC`, sub: 'exposed in high/critical cohorts' }));
      return {
        headline: `Network attrition risk ${summary.avgScore}/100 · ${summary.atRiskPct}% of HC in high-risk cohorts`,
        detail: `Scored by tenure (45%), attendance pattern (35%) and vendor trend (20%). ${summary.highOrCriticalCohorts} cohorts flagged high or critical.`,
        rows,
      };
    },
  },
  {
    id: 'q-ot-burn',
    question: 'Where are we burning overtime budget fastest?',
    run: (data) => {
      const rows = [...data.locations]
        .map((l) => ({
          label: l.name,
          value: round((l.overtimeHours / Math.max(l.otBudgetHours, 1)) * 100),
          display: `${round((l.overtimeHours / Math.max(l.otBudgetHours, 1)) * 100)}% of budget`,
          sub: `${l.overtimeHours}h / ${l.otBudgetHours}h`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5)
        .map(({ label, display, sub }) => ({ label, value: display, sub }));
      const breaches = data.locations.filter((l) => l.overtimeHours > l.otBudgetHours);
      return {
        headline: `${breaches.length} of ${data.locations.length} locations have breached the OT budget`,
        detail: 'Chronic OT is a structural understaffing signal — each breach location should be re-costed for permanent HC.',
        rows,
      };
    },
  },
  {
    id: 'q-festival-exposure',
    question: 'Which upcoming festival hurts us most?',
    run: (data) => {
      const fests = upcomingFestivals(data.festivals || []);
      const scored = fests
        .map((f) => {
          const exposedHc = data.locations
            .filter((l) => f.affectedRegions.includes(l.region.toLowerCase()))
            .reduce((s, l) => s + l.headcount, 0);
          return { f, exposedHc };
        })
        .sort((a, b) => b.exposedHc - a.exposedHc || IMPACT_RANK[a.f.impact] - IMPACT_RANK[b.f.impact]);
      const top = scored[0];
      const rows = scored.slice(0, 5).map(({ f, exposedHc }) => ({
        label: `${f.festival} (${f.date})`,
        value: `−${f.expectedDipPct}% dip`,
        sub: `${exposedHc} HC exposed · ${f.impact}`,
      }));
      return {
        headline: top
          ? `${top.f.festival} is the biggest exposure: −${top.f.expectedDipPct}% across ${top.exposedHc} HC`
          : 'No upcoming festivals in the calendar.',
        detail: 'Exposure = headcount in affected regions × expected dip. Lunar festival dates may shift ±1 day.',
        rows,
      };
    },
  },
  {
    id: 'q-vendor-ranking',
    question: 'Rank our manpower vendors by performance.',
    run: (data) => {
      const byVendor = {};
      for (const l of data.locations) {
        byVendor[l.vendor] = byVendor[l.vendor] || {
          vendor: l.vendor, locations: 0, hc: 0, attrW: 0, absW: 0, relSum: 0, relN: 0,
        };
        const v = byVendor[l.vendor];
        v.locations += 1;
        v.hc += l.headcount;
        v.attrW += l.attritionPct * l.headcount;
        v.absW += l.absenteeismPct * l.headcount;
        v.relSum += l.vendorReliability;
        v.relN += 1;
      }
      const rows = Object.values(byVendor)
        .map((v) => ({
          label: v.vendor,
          rel: round(v.relSum / v.relN),
          value: `${round(v.relSum / v.relN)}/100 reliability`,
          sub: `${v.locations} sites · ${v.hc} HC · attrition ${round(v.attrW / v.hc, 2)}%/mo · absenteeism ${round(v.absW / v.hc)}%`,
        }))
        .sort((a, b) => b.rel - a.rel)
        .map(({ label, value, sub }) => ({ label, value, sub }));
      return {
        headline: `Best vendor: ${rows[0]?.label ?? 'n/a'} (${rows[0]?.value ?? 'n/a'})`,
        detail: 'Reliability is the vendor fill-rate score (0-100); attrition/absenteeism are HC-weighted averages.',
        rows,
      };
    },
  },
  {
    id: 'q-region-health',
    question: 'Which region is healthiest and which needs urgent help?',
    run: (data) => {
      const byRegion = {};
      for (const l of data.locations) {
        const r = l.region;
        byRegion[r] = byRegion[r] || { hc: 0, present: 0, absW: 0, attrW: 0, n: 0 };
        byRegion[r].hc += l.headcount;
        byRegion[r].present += l.present;
        byRegion[r].absW += l.absenteeismPct * l.headcount;
        byRegion[r].attrW += l.attritionPct * l.headcount;
        byRegion[r].n += 1;
      }
      const rows = Object.entries(byRegion)
        .map(([region, v]) => ({
          label: region,
          att: round((v.present / v.hc) * 100),
          value: `${round((v.present / v.hc) * 100)}% attendance`,
          sub: `attrition ${round(v.attrW / v.hc, 2)}%/mo · absenteeism ${round(v.absW / v.hc)}%`,
        }))
        .sort((a, b) => a.att - b.att)
        .map(({ label, value, sub }) => ({ label, value, sub }));
      return {
        headline: rows.length
          ? `${rows[rows.length - 1].label} needs urgent attention; ${rows[0].label} is healthiest`
          : 'No data.',
        detail: 'Regions ranked by blended attendance; sub-metrics are HC-weighted.',
        rows,
      };
    },
  },
  {
    id: 'q-hiring-gap',
    question: 'How many people do we need to hire to cover the next month?',
    run: (data) => {
      const kpis = computeNetworkKpis(data.locations);
      const expectedAtt = clamp(kpis.attendanceRatePct - 2, 40, 100); // conservative 2pp haircut
      let totalGap = 0;
      const rows = data.locations.map((l) => {
        const required = l.present + Math.round((l.headcount - l.present) * 0.6); // target 60% backfill of the absent gap
        const p = predictManpower(required, expectedAtt, { currentHc: l.headcount });
        totalGap += p.gap;
        return {
          label: l.name,
          value: p.gap > 0 ? `hire ${p.gap}` : 'adequate',
          sub: `req ${p.requiredHc} HC @ ${round(expectedAtt)}% expected attendance`,
        };
      }).filter((r) => r.value !== 'adequate').slice(0, 6);
      return {
        headline: `Network hiring gap: ~${totalGap} workers to hold service levels`,
        detail: `Formula: Required HC = on-floor need ÷ expected attendance (${round(expectedAtt)}%, current ${kpis.attendanceRatePct}% minus 2pp conservatism), minus current sanctioned HC.`,
        rows,
      };
    },
  },
  {
    id: 'q-churn-cost',
    question: 'What is understaffing costing us per day?',
    run: (data) => {
      const kpis = computeNetworkKpis(data.locations);
      const impact = computeBusinessImpact(kpis.present, kpis.present - kpis.absent * 0.5);
      const rows = [
        { label: 'Units at risk', value: impact.unitsShort.toLocaleString('en-IN'), sub: 'from unstaffed worker-hours' },
        { label: 'Margin at risk', value: `₹${impact.marginAtRisk.toLocaleString('en-IN')}`, sub: 'lost gross margin' },
        { label: 'Catch-up cost', value: `₹${impact.catchupCost.toLocaleString('en-IN')}`, sub: 'expedite premium' },
        { label: 'SLA exposure', value: `₹${impact.penalty.toLocaleString('en-IN')}`, sub: `${impact.breachPct}% breach probability × ${impact.slaOrdersAtRisk} orders` },
      ];
      return {
        headline: `Understaffing costs ~₹${impact.totalImpact.toLocaleString('en-IN')} per day at current gaps`,
        detail: 'Assumes half of today\'s absent workers remain uncovered through the shift.',
        rows,
      };
    },
  },
];
