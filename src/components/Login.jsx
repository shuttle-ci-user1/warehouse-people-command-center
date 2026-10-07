/**
 * Simple email/password gate. Demo-grade by design (no backend):
 * any valid email + ≥6-char password opens the dashboard.
 */

import { useState } from 'react';
import { useAppState } from '../AppState.jsx';

export default function Login() {
  const { login } = useAppState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    // Small artificial delay so the gate feels like a real check.
    setTimeout(() => {
      const res = login(email, password);
      if (!res.ok) setError(res.error);
      setBusy(false);
    }, 250);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-2xl">▦</div>
          <h1 className="mt-4 text-xl font-semibold text-slate-50">Warehouse AI People Command Center</h1>
          <p className="mt-1 text-sm text-slate-400">Aggregate workforce intelligence · no employee PII</p>
        </div>
        <form
          onSubmit={submit}
          className="rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-xl shadow-black/30"
        >
          <label htmlFor="login-email" className="block text-xs font-medium text-slate-300">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ops.lead@company.com"
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400"
          />
          <label htmlFor="login-password" className="mt-4 block text-xs font-medium text-slate-300">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min. 6 characters"
            className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-sky-400"
          />
          {error && <p role="alert" className="mt-3 text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="mt-5 w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
            This demo gate stores a session marker locally. All dashboards show
            aggregate numbers only — never individual employee data.
          </p>
        </form>
      </div>
    </div>
  );
}
