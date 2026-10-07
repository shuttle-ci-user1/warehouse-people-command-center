# Warehouse AI People Command Center

An executive dashboard for warehouse workforce ops — headcount, attendance,
attrition, overtime and festive-day risk — with **rule-based "AI" insights**
(no external AI API; every recommendation traces to a documented formula or
threshold). Built with **React + Vite + Tailwind CSS v4**, reads data from
**Google Sheets (read-only)**, and deploys to **Vercel**.

## Privacy by design

The frontend only ever handles **aggregate numbers** — per-location
headcounts, percentages, hours and cohort sizes. There is no employee-level
PII (names, IDs, phones, salaries) anywhere in the app, in any layer.

## Features

| Module | What it does |
|---|---|
| **Executive Command Center** | KPI cards (HC, Present, Absenteeism, Attrition, OT), location health table with guardrails, ranked rule-based AI insights |
| **Manpower Predictor** | `Required HC = Required on-floor ÷ Expected attendance %` (+ safety buffer), applied per location with festival-adjusted attendance |
| **Attrition Risk scorer** | Cohort risk 0-100 from tenure (45%) + attendance pattern (35%) + vendor trend (20%), with explainable drivers |
| **Holiday Risk Calendar** | Indian festival lookup table with expected attendance dips and per-location exposure |
| **What-If Simulator** | Sliders for attendance / attrition / OT-conversion / volume; recomputes KPIs and business impact live |
| **Business Impact Calculator** | Shortfall → worker-hours → units → margin at risk, catch-up cost and SLA penalty exposure |
| **Ask HR AI** | Pre-built question menu; each answer is computed live from your data (deterministic, auditable) |
| **Daily Briefing** | Auto-generated ops summary with copy-to-clipboard |

## Getting started

```bash
npm install
npm run dev       # local dev server
npm test          # unit tests (Vitest)
npm run build     # production build
npm run preview   # preview the production build
```

## Connecting your Google Sheet

1. Share a Google Sheet as **"Anyone with the link can view"** (read-only is
   all the app needs — it uses the public gviz endpoint, no API key).
2. In the app header, click **Connect sheet** and paste the URL (or bare ID)
   plus the tab gids.
3. If loading fails, the app transparently falls back to the bundled demo
   dataset — it never breaks.

**Locations tab columns** (case-insensitive; required: `id, name, headcount, present`):

`id, name, city, region, vendor, headcount, present, absenteeismPct, attritionPct, overtimeHours, otBudgetHours, avgTenureMonths, attendance7d, vendorReliability, attritionTrendPct, shift`

- `region` — North / South / East / West / Central
- `attendance7d` — 7 comma-separated daily attendance percentages
- `vendorReliability` — vendor fill-rate score 0-100
- `attritionTrendPct` — vendor attrition trend, +ve = worsening (pp/month)

**Cohorts tab columns** (required: `locationId, tenureBand, headcount`):

`locationId, tenureBand, attendanceBand, vendor, headcount, attritionPct`

- `tenureBand` — `0-3mo | 3-6mo | 6-12mo | 12mo+`
- `attendanceBand` — `low (<85) | medium (85-95) | high (>=95)`

Rows must stay **aggregate**: one row per location (or per cohort), never
per employee.

## The analytics (all explainable)

- **Manpower Predictor** — `Required HC = Required on-floor ÷ Expected attendance %`, × (1 + buffer%). Gap = Required HC − sanctioned HC.
- **Attrition risk** — weighted sub-scores: tenure band (45%), attendance band (35%), vendor (20%: `100 − reliability + 15 × trend`, trend capped at +30). Bands: critical ≥70, high ≥55, medium ≥35, low <35.
- **Festival dips** — affected regions take the full expected dip; unaffected take 20%; expected attendance floors at 40%.
- **Business impact** — shortfall × hours → worker-hours × 42 units → margin (₹11/unit) + catch-up (₹6/unit) + SLA penalty (beyond 10% shortfall: 1.2pp breach-probability per point × orders at risk × ₹45).
- Guardrails used across views: absenteeism ≤12%, attrition ≤8%/mo, OT ≤ budget.

Constants live in `src/lib/schema.js` (`IMPACT_MODEL`) and thresholds inline
in `src/lib/analytics.js` — tune them in one place.

## Auth

Simple email/password gate (any valid email + 6-char password) stored as a
local session marker. This is a demo convenience gate, not a security
boundary — put real auth in front (Vercel password protection, SSO proxy,
etc.) if you deploy this beyond a trusted team.

## Deploying to Vercel

The repo is Vercel-ready (`vercel.json` included):

1. Push to GitHub.
2. In Vercel: **New Project → Import** the repo. Framework preset auto-detects
   Vite; build command `npm run build`, output `dist`.
3. Deploy. No environment variables required.

## Project layout

```
src/
  lib/
    schema.js        Data contracts + impact-model constants
    mockData.js      Demo dataset (aggregate only)
    analytics.js     All rule-based engines (KPIs, predictor, risk, insights,
                     briefing, Ask-HR analyses)
    sheetsClient.js  Google Sheets gviz adapter + demo fallback
  components/        One file per view + shared UI primitives
  AppState.jsx       Auth + dataset context
tests/               Vitest unit tests for the engines and sheet parsing
```
