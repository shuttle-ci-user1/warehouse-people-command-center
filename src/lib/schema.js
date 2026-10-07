/**
 * Shared data contracts for the Warehouse AI People Command Center.
 *
 * PRIVACY RULE (enforced by design): the frontend only ever handles
 * AGGREGATE numbers — headcounts, percentages, hours, cohort sizes.
 * No employee-level PII (names, IDs, phone numbers, salaries) exists
 * anywhere in this app, in any layer, at any time.
 */

/**
 * @typedef {Object} LocationSnapshot — one row per warehouse location, all aggregate.
 * @property {string} id               Stable slug, e.g. "WRH-DEL-01"
 * @property {string} name             Display name, e.g. "Bhiwandi Dark Store"
 * @property {string} city
 * @property {string} region           One of: North / South / East / West / Central
 * @property {string} vendor            Manpower vendor name
 * @property {number} headcount         Total sanctioned HC at the location
 * @property {number} present           Workers present today
 * @property {number} absenteeismPct    Location absenteeism % (7-day avg)
 * @property {number} attritionPct      Monthly attrition % (rolling 90d)
 * @property {number} overtimeHours      OT hours consumed this month
 * @property {number} otBudgetHours     Monthly OT budget
 * @property {number} avgTenureMonths   Average tenure of the workforce (aggregate)
 * @property {number[]} attendance7d    Daily attendance % for the last 7 days (0-100)
 * @property {number} vendorReliability Vendor reliability score 0-100 (historical fill-rate)
 * @property {number} attritionTrendPct Vendor attrition trend: +ve means worsening, pp/mo
 * @property {string} shift             Primary shift, e.g. "Morning"
 */

/**
 * @typedef {Object} CohortRow — aggregate attrition-risk cohort (NO individual records).
 * Risk is scored per cohort using: tenure band, attendance pattern band, vendor trend.
 * @property {string} locationId
 * @property {string} tenureBand      "0-3mo" | "3-6mo" | "6-12mo" | "12mo+"
 * @property {string} attendanceBand  "high" (>=95) | "medium" (85-95) | "low" (<85)
 * @property {string} vendor
 * @property {number} headcount       Number of workers in this cohort (aggregate count)
 * @property {number} attritionPct     Observed monthly attrition % for the cohort
 */

/**
 * @typedef {Object} FestivalRow — Indian festival/holiday risk lookup.
 * @property {string} date            ISO date "YYYY-MM-DD"
 * @property {string} festival
 * @property {string} impact          "critical" | "high" | "moderate" | "low"
 * @property {number} expectedDipPct  Expected attendance dip % on that day
 * @property {string[]} affectedRegions
 * @property {string} note
 */

/** Tenure bands used for cohort scoring, ordered lowest to highest tenure. */
export const TENURE_BANDS = ['0-3mo', '3-6mo', '6-12mo', '12mo+'];

/** Attendance bands used for cohort scoring. */
export const ATTENDANCE_BANDS = ['low', 'medium', 'high'];

/** Business impact model constants (per unstaffed worker-hour). */
export const IMPACT_MODEL = {
  /** Units of throughput lost per missing worker-hour. */
  unitsPerWorkerHour: 42,
  /** Gross margin per unit, in local currency (₹). */
  marginPerUnit: 11,
  /** Cost of expedite catch-up per unfulfilled unit, in ₹. */
  catchupCostPerUnit: 6,
  /** SLA breach probability beyond 10% understaffing, per pp, as a fraction. */
  slaBreachPerPp: 0.012,
  /** Average SLA penalty per breached order, in ₹. */
  slaPenaltyPerOrder: 45,
  /** Orders at risk per 100 units short. */
  ordersPer100Units: 3.1,
};

/**
 * Clamp a number between min and max. Non-finite input returns `min`.
 * @param {number} v
 * @param {number} min
 * @param {number} max
 */
export const clamp = (v, min, max) =>
  Math.min(Math.max(Number.isFinite(Number(v)) ? Number(v) : min, min), max);

/**
 * Round to `digits` decimal places (default 1). Non-finite input → 0.
 * @param {number} v
 * @param {number} [digits=1]
 */
export const round = (v, digits = 1) => {
  const f = 10 ** digits;
  return Math.round((Number(v) || 0) * f) / f;
};
