/**
 * Demo dataset backing the app when no Google Sheet is connected.
 * Every row is AGGREGATE — no employee PII. Numbers are illustrative.
 *
 * The shape mirrors exactly what the Google Sheets adapter parses into,
 * so switching data sources is invisible to every downstream module.
 */

export const DEMO_LOCATIONS = [
  {
    id: 'WRH-DEL-01', name: 'Bhiwandi Dark Store', city: 'Bhiwandi', region: 'West', vendor: 'SkyForce Manpower',
    headcount: 210, present: 182, absenteeismPct: 13.3, attritionPct: 9.2, overtimeHours: 1240, otBudgetHours: 1000,
    avgTenureMonths: 7.4, attendance7d: [88, 90, 92, 87, 85, 91, 86], vendorReliability: 88,
    attritionTrendPct: 0.6, shift: 'Morning',
  },
  {
    id: 'WRH-DEL-02', name: 'Gurgaon Fulfilment Hub', city: 'Gurgaon', region: 'North', vendor: 'SkyForce Manpower',
    headcount: 340, present: 313, absenteeismPct: 7.9, attritionPct: 5.8, overtimeHours: 860, otBudgetHours: 1200,
    avgTenureMonths: 11.2, attendance7d: [93, 94, 92, 95, 91, 94, 93], vendorReliability: 93,
    attritionTrendPct: -0.4, shift: 'Morning',
  },
  {
    id: 'WRH-BLR-01', name: 'Hosur Road Warehouse', city: 'Bengaluru', region: 'South', vendor: 'Vega Staffing',
    headcount: 285, present: 242, absenteeismPct: 15.1, attritionPct: 12.4, overtimeHours: 1720, otBudgetHours: 1400,
    avgTenureMonths: 5.1, attendance7d: [86, 84, 88, 82, 80, 85, 83], vendorReliability: 78,
    attritionTrendPct: 1.8, shift: 'Night',
  },
  {
    id: 'WRH-BLR-02', name: 'Whitefield Micro-Warehouse', city: 'Bengaluru', region: 'South', vendor: 'Vega Staffing',
    headcount: 95, present: 88, absenteeismPct: 7.4, attritionPct: 4.1, overtimeHours: 180, otBudgetHours: 320,
    avgTenureMonths: 13.8, attendance7d: [94, 93, 95, 92, 94, 93, 92], vendorReliability: 91,
    attritionTrendPct: -0.9, shift: 'Evening',
  },
  {
    id: 'WRH-HYD-01', name: 'Shamshabad Sortation Center', city: 'Hyderabad', region: 'South', vendor: 'Aarna Workforce',
    headcount: 410, present: 358, absenteeismPct: 12.7, attritionPct: 10.8, overtimeHours: 2100, otBudgetHours: 1800,
    avgTenureMonths: 4.8, attendance7d: [89, 87, 90, 86, 84, 88, 87], vendorReliability: 82,
    attritionTrendPct: 1.2, shift: 'Morning',
  },
  {
    id: 'WRH-MAA-01', name: 'Perungudi FC', city: 'Chennai', region: 'South', vendor: 'Aarna Workforce',
    headcount: 150, present: 141, absenteeismPct: 6.0, attritionPct: 6.5, overtimeHours: 420, otBudgetHours: 560,
    avgTenureMonths: 9.7, attendance7d: [95, 94, 96, 93, 95, 94, 94], vendorReliability: 89,
    attritionTrendPct: 0.1, shift: 'Morning',
  },
  {
    id: 'WRH-CCU-01', name: 'Howrah Depot', city: 'Kolkata', region: 'East', vendor: 'Eastern Ridge',
    headcount: 120, present: 101, absenteeismPct: 15.8, attritionPct: 14.1, overtimeHours: 690, otBudgetHours: 480,
    avgTenureMonths: 4.2, attendance7d: [84, 83, 85, 81, 79, 84, 82], vendorReliability: 74,
    attritionTrendPct: 2.1, shift: 'Night',
  },
  {
    id: 'WRH-PNQ-01', name: 'Chakan Mega FC', city: 'Pune', region: 'West', vendor: 'Eastern Ridge',
    headcount: 520, present: 469, absenteeismPct: 9.8, attritionPct: 7.6, overtimeHours: 940, otBudgetHours: 2000,
    avgTenureMonths: 10.5, attendance7d: [91, 92, 90, 93, 89, 92, 90], vendorReliability: 90,
    attritionTrendPct: -0.6, shift: 'Morning',
  },
];

/** Aggregate attrition-risk cohorts per location (no individual records). */
export const DEMO_COHORTS = [
  { locationId: 'WRH-DEL-01', tenureBand: '0-3mo', attendanceBand: 'low', vendor: 'SkyForce Manpower', headcount: 38, attritionPct: 18.5 },
  { locationId: 'WRH-DEL-01', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'SkyForce Manpower', headcount: 22, attritionPct: 14.2 },
  { locationId: 'WRH-DEL-01', tenureBand: '3-6mo', attendanceBand: 'medium', vendor: 'SkyForce Manpower', headcount: 45, attritionPct: 9.8 },
  { locationId: 'WRH-DEL-01', tenureBand: '6-12mo', attendanceBand: 'high', vendor: 'SkyForce Manpower', headcount: 60, attritionPct: 5.4 },
  { locationId: 'WRH-DEL-01', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'SkyForce Manpower', headcount: 45, attritionPct: 2.1 },
  { locationId: 'WRH-DEL-02', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'SkyForce Manpower', headcount: 30, attritionPct: 11.0 },
  { locationId: 'WRH-DEL-02', tenureBand: '3-6mo', attendanceBand: 'high', vendor: 'SkyForce Manpower', headcount: 70, attritionPct: 5.9 },
  { locationId: 'WRH-DEL-02', tenureBand: '6-12mo', attendanceBand: 'high', vendor: 'SkyForce Manpower', headcount: 120, attritionPct: 3.8 },
  { locationId: 'WRH-DEL-02', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'SkyForce Manpower', headcount: 120, attritionPct: 1.6 },
  { locationId: 'WRH-BLR-01', tenureBand: '0-3mo', attendanceBand: 'low', vendor: 'Vega Staffing', headcount: 75, attritionPct: 22.4 },
  { locationId: 'WRH-BLR-01', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'Vega Staffing', headcount: 48, attritionPct: 16.8 },
  { locationId: 'WRH-BLR-01', tenureBand: '3-6mo', attendanceBand: 'low', vendor: 'Vega Staffing', headcount: 52, attritionPct: 15.2 },
  { locationId: 'WRH-BLR-01', tenureBand: '3-6mo', attendanceBand: 'medium', vendor: 'Vega Staffing', headcount: 40, attritionPct: 11.4 },
  { locationId: 'WRH-BLR-01', tenureBand: '6-12mo', attendanceBand: 'medium', vendor: 'Vega Staffing', headcount: 45, attritionPct: 7.2 },
  { locationId: 'WRH-BLR-01', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'Vega Staffing', headcount: 25, attritionPct: 2.4 },
  { locationId: 'WRH-BLR-02', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'Vega Staffing', headcount: 10, attritionPct: 9.5 },
  { locationId: 'WRH-BLR-02', tenureBand: '3-6mo', attendanceBand: 'high', vendor: 'Vega Staffing', headcount: 20, attritionPct: 4.8 },
  { locationId: 'WRH-BLR-02', tenureBand: '6-12mo', attendanceBand: 'high', vendor: 'Vega Staffing', headcount: 30, attritionPct: 3.1 },
  { locationId: 'WRH-BLR-02', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'Vega Staffing', headcount: 35, attritionPct: 1.2 },
  { locationId: 'WRH-HYD-01', tenureBand: '0-3mo', attendanceBand: 'low', vendor: 'Aarna Workforce', headcount: 105, attritionPct: 21.1 },
  { locationId: 'WRH-HYD-01', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'Aarna Workforce', headcount: 60, attritionPct: 15.4 },
  { locationId: 'WRH-HYD-01', tenureBand: '3-6mo', attendanceBand: 'medium', vendor: 'Aarna Workforce', headcount: 88, attritionPct: 10.9 },
  { locationId: 'WRH-HYD-01', tenureBand: '6-12mo', attendanceBand: 'high', vendor: 'Aarna Workforce', headcount: 92, attritionPct: 6.3 },
  { locationId: 'WRH-HYD-01', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'Aarna Workforce', headcount: 65, attritionPct: 2.8 },
  { locationId: 'WRH-MAA-01', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'Aarna Workforce', headcount: 18, attritionPct: 10.2 },
  { locationId: 'WRH-MAA-01', tenureBand: '3-6mo', attendanceBand: 'high', vendor: 'Aarna Workforce', headcount: 32, attritionPct: 6.1 },
  { locationId: 'WRH-MAA-01', tenureBand: '6-12mo', attendanceBand: 'high', vendor: 'Aarna Workforce', headcount: 55, attritionPct: 3.9 },
  { locationId: 'WRH-MAA-01', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'Aarna Workforce', headcount: 45, attritionPct: 1.9 },
  { locationId: 'WRH-CCU-01', tenureBand: '0-3mo', attendanceBand: 'low', vendor: 'Eastern Ridge', headcount: 42, attritionPct: 23.7 },
  { locationId: 'WRH-CCU-01', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'Eastern Ridge', headcount: 25, attritionPct: 17.3 },
  { locationId: 'WRH-CCU-01', tenureBand: '3-6mo', attendanceBand: 'low', vendor: 'Eastern Ridge', headcount: 28, attritionPct: 14.8 },
  { locationId: 'WRH-CCU-01', tenureBand: '6-12mo', attendanceBand: 'medium', vendor: 'Eastern Ridge', headcount: 15, attritionPct: 8.1 },
  { locationId: 'WRH-CCU-01', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'Eastern Ridge', headcount: 10, attritionPct: 3.5 },
  { locationId: 'WRH-PNQ-01', tenureBand: '0-3mo', attendanceBand: 'medium', vendor: 'Eastern Ridge', headcount: 58, attritionPct: 12.6 },
  { locationId: 'WRH-PNQ-01', tenureBand: '3-6mo', attendanceBand: 'high', vendor: 'Eastern Ridge', headcount: 108, attritionPct: 7.4 },
  { locationId: 'WRH-PNQ-01', tenureBand: '6-12mo', attendanceBand: 'high', vendor: 'Eastern Ridge', headcount: 184, attritionPct: 4.2 },
  { locationId: 'WRH-PNQ-01', tenureBand: '12mo+', attendanceBand: 'high', vendor: 'Eastern Ridge', headcount: 170, attritionPct: 1.4 },
];

/**
 * Festival/holiday risk lookup (2026 Indian calendar, illustrative).
 * expectedDipPct = attendance dip expected on that date across affected regions.
 */
export const DEMO_FESTIVALS = [
  { date: '2026-01-14', festival: 'Makar Sankranti / Pongal / Lohri', impact: 'high', expectedDipPct: 18, affectedRegions: ['north', 'west', 'south'], note: 'Regional harvest festival; North and West warehouses see heavier dips.' },
  { date: '2026-01-26', festival: 'Republic Day', impact: 'moderate', expectedDipPct: 10, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'National holiday; ops continue with reduced staffing.' },
  { date: '2026-02-15', festival: 'Maha Shivaratri', impact: 'moderate', expectedDipPct: 12, affectedRegions: ['north', 'west', 'central'], note: 'Widespread observance in Hindi belt.' },
  { date: '2026-03-03', festival: 'Holi', impact: 'critical', expectedDipPct: 35, affectedRegions: ['north', 'east', 'central'], note: 'Critical dip day — night shift before Holi also affected.' },
  { date: '2026-03-04', festival: 'Holi (regional)', impact: 'high', expectedDipPct: 22, affectedRegions: ['north', 'east', 'west'], note: 'Day-after absenteeism; plan catch-up buffers.' },
  { date: '2026-03-20', festival: 'Eid al-Fitr (expected)', impact: 'critical', expectedDipPct: 30, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Lunar; date may shift. Heavy dip in mixed-faith teams.' },
  { date: '2026-04-01', festival: 'Annual appraisal season start', impact: 'low', expectedDipPct: 4, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Mild; watch attrition intent signals instead.' },
  { date: '2026-04-09', festival: 'Ram Navami', impact: 'moderate', expectedDipPct: 11, affectedRegions: ['north', 'central'], note: 'Processions in North; evening shift impact.' },
  { date: '2026-04-14', festival: 'Ambedkar Jayanti / Baisakhi', impact: 'moderate', expectedDipPct: 13, affectedRegions: ['north', 'west', 'central'], note: 'Combined observance across North and West.' },
  { date: '2026-05-01', festival: 'Labour Day', impact: 'high', expectedDipPct: 20, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Union activity; contractor workforce dips hardest.' },
  { date: '2026-05-26', festival: 'Bakrid / Eid al-Adha (expected)', impact: 'critical', expectedDipPct: 28, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Lunar; date may shift. Plan skeleton crews.' },
  { date: '2026-08-15', festival: 'Independence Day', impact: 'moderate', expectedDipPct: 9, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'National holiday; minimal for logistics crews.' },
  { date: '2026-08-28', festival: 'Onam', impact: 'high', expectedDipPct: 19, affectedRegions: ['south'], note: 'Kerala-heavy teams return home; South FCs plan cover.' },
  { date: '2026-10-02', festival: 'Gandhi Jayanti', impact: 'moderate', expectedDipPct: 10, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Dry day; standard holiday staffing.' },
  { date: '2026-10-10', festival: 'Dussehra (Vijayadashami)', impact: 'critical', expectedDipPct: 32, affectedRegions: ['north', 'west', 'south', 'central'], note: 'Major festival; combine with pre-Diwali attrition watch.' },
  { date: '2026-11-08', festival: 'Diwali (main)', impact: 'critical', expectedDipPct: 45, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Highest-dip day of the year; night shift around Diwali also hit.' },
  { date: '2026-11-09', festival: 'Diwali (regional / Badi Diwali)', impact: 'critical', expectedDipPct: 38, affectedRegions: ['north', 'east', 'central'], note: 'Day two; travel-return absenteeism extends 2-3 days.' },
  { date: '2026-11-14', festival: 'Bhai Dooj / Chhath begins', impact: 'high', expectedDipPct: 24, affectedRegions: ['north', 'east'], note: 'Chhath is critical in Bihar/UP/Jharkhand talent pools.' },
  { date: '2026-11-15', festival: 'Chhath Puja', impact: 'critical', expectedDipPct: 40, affectedRegions: ['north', 'east'], note: 'Largest East-belt absence; freeze shifts for East depots.' },
  { date: '2026-12-25', festival: 'Christmas', impact: 'moderate', expectedDipPct: 12, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Moderate; plan for Christian staff leave.' },
  { date: '2026-12-31', festival: 'New Year Eve', impact: 'high', expectedDipPct: 21, affectedRegions: ['north', 'south', 'east', 'west', 'central'], note: 'Night-shift no-shows spike; incentivize attendance.' },
];

/** Region display metadata. */
export const DEMO_REGIONS = {
  north: { label: 'North', cities: ['Delhi NCR', 'Jaipur', 'Lucknow'] },
  south: { label: 'South', cities: ['Bengaluru', 'Chennai', 'Hyderabad'] },
  east: { label: 'East', cities: ['Kolkata', 'Patna', 'Bhubaneswar'] },
  west: { label: 'West', cities: ['Mumbai', 'Pune', 'Ahmedabad'] },
  central: { label: 'Central', cities: ['Indore', 'Nagpur', 'Bhopal'] },
};
