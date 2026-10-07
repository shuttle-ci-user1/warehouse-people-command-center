/**
 * Shared UI primitives: Card, KpiCard, Badge, Table, Sparkline, Slider.
 * Dark command-center theme via Tailwind utility classes.
 */

const SEV_STYLES = {
  critical: 'bg-red-500/15 text-red-300 border-red-500/30',
  warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  good: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  neutral: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const BAND_STYLES = {
  critical: 'bg-red-500/20 text-red-300',
  high: 'bg-orange-500/20 text-orange-300',
  medium: 'bg-amber-500/20 text-amber-300',
  low: 'bg-emerald-500/20 text-emerald-300',
};

export function Card({ title, subtitle, actions, children, className = '' }) {
  return (
    <section className={`rounded-xl border border-slate-700/60 bg-slate-900/70 backdrop-blur ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-slate-700/60 px-5 py-4">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-wide text-slate-100">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function KpiCard({ label, value, unit, delta, deltaGood, hint }) {
  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-slate-50">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-slate-400">{unit}</span>}
      </p>
      {delta !== undefined && (
        <p className={`mt-1 text-xs ${deltaGood ? 'text-emerald-400' : 'text-red-400'}`}>{delta}</p>
      )}
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
    </div>
  );
}

export function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${SEV_STYLES[tone] || SEV_STYLES.neutral}`}>
      {children}
    </span>
  );
}

export function RiskBand({ band }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${BAND_STYLES[band] || BAND_STYLES.low}`}>
      {band}
    </span>
  );
}

/** Minimal inline SVG sparkline (no chart library). */
export function Sparkline({ values, width = 96, height = 28, stroke = '#38bdf8' }) {
  if (!values || values.length < 2) return <span className="text-xs text-slate-500">—</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - ((v - min) / span) * (height - 4) - 2}`)
    .join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Simple horizontal meter bar with an optional threshold marker. */
export function Meter({ value, max = 100, tone = 'sky', threshold, label }) {
  const pct = Math.min((Math.max(value, 0) / max) * 100, 100);
  const toneClass = {
    sky: 'bg-sky-400', red: 'bg-red-400', amber: 'bg-amber-400', emerald: 'bg-emerald-400',
  }[tone];
  return (
    <div>
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-700/60">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${pct}%` }} />
        {threshold !== undefined && (
          <span
            className="absolute -top-[2px] h-[10px] w-px bg-slate-300/70"
            style={{ left: `${Math.min((threshold / max) * 100, 100)}%` }}
            title={`guardrail ${threshold}`}
          />
        )}
      </div>
      {label && <p className="mt-1 text-[11px] text-slate-500">{label}</p>}
    </div>
  );
}

export function Slider({ label, value, min, max, step = 1, onChange, format, id }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className="text-xs font-medium text-slate-300">{label}</label>
        <span className="text-xs font-semibold text-sky-300">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-700 accent-sky-400"
      />
    </div>
  );
}

/** Themed data table. `columns` items: {key, label, align?}. */
export function DataTable({ columns, children, emptyMessage = 'No data.' }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-slate-700/60 text-[11px] uppercase tracking-wider text-slate-400">
            {columns.map((c) => (
              <th key={c.key} className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {hasRows ? (
            children
          ) : (
            <tr><td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">{emptyMessage}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
