/**
 * Global app context: auth + dataset loading.
 * Auth is intentionally simple (email/password gate stored locally) — this
 * is a demo-grade gate, not a security boundary. All data remains
 * aggregate-only regardless of auth state.
 */

import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
} from 'react';
import { loadDataset } from './lib/sheetsClient.js';
import { DEMO_LOCATIONS, DEMO_COHORTS, DEMO_FESTIVALS } from './lib/mockData.js';

const STORAGE_KEY = 'wpcc.session';
const SHEET_CFG_KEY = 'wpcc.sheet';

const AppStateCtx = createContext(null);

/** Simple deterministic hash for demo session tokens (NOT cryptographic). */
function demoHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * Validate a demo login. Any valid email + password of ≥6 chars opens the
 * dashboard. Keeping this permissive on purpose: the app ships with no
 * backend, so a strict credential store would lock users out of their own
 * dashboard.
 */
function validateLogin(email, password) {
  const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const okPass = typeof password === 'string' && password.length >= 6;
  if (!okEmail) return { ok: false, error: 'Enter a valid email address.' };
  if (!okPass) return { ok: false, error: 'Password must be at least 6 characters.' };
  return { ok: true, user: { email: email.toLowerCase(), token: demoHash(`${email}:${password}`) } };
}

export function AppStateProvider({ children }) {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [dataset, setDataset] = useState({
    locations: [], cohorts: [], festivals: [], source: 'demo', loading: true,
  });
  const [sheetCfg, setSheetCfg] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(SHEET_CFG_KEY)) || {};
    } catch {
      return {};
    }
  });

  // Restore session on mount.
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (s?.user?.email) setUser(s.user);
    } catch { /* corrupt session — ignore */ }
    setBooting(false);
  }, []);

  // Load dataset whenever sheet config changes (or on first mount).
  useEffect(() => {
    let cancelled = false;
    setDataset((d) => ({ ...d, loading: true }));
    loadDataset(sheetCfg).then((data) => {
      if (!cancelled) setDataset({ ...data, loading: false });
    });
    return () => { cancelled = true; };
  }, [sheetCfg]);

  const login = useCallback((email, password) => {
    const res = validateLogin(email, password);
    if (res.ok) {
      const u = res.user;
      setUser(u);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: u }));
      } catch { /* storage blocked — session is in-memory only */ }
    }
    return res;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const connectSheet = useCallback((sheetUrl, gids) => {
    const cfg = { sheetUrl, ...gids };
    setSheetCfg(cfg);
    try {
      localStorage.setItem(SHEET_CFG_KEY, JSON.stringify(cfg));
    } catch { /* ignore */ }
  }, []);

  const useDemoData = useCallback(() => {
    setSheetCfg({});
    try { localStorage.removeItem(SHEET_CFG_KEY); } catch { /* ignore */ }
    setDataset({
      locations: DEMO_LOCATIONS, cohorts: DEMO_COHORTS, festivals: DEMO_FESTIVALS,
      source: 'demo', loading: false,
    });
  }, []);

  const value = useMemo(
    () => ({
      user, booting, login, logout,
      dataset, sheetCfg, connectSheet, useDemoData,
    }),
    [user, booting, login, logout, dataset, sheetCfg, connectSheet, useDemoData],
  );

  return <AppStateCtx.Provider value={value}>{children}</AppStateCtx.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateCtx);
  if (!ctx) throw new Error('useAppState must be used inside <AppStateProvider>');
  return ctx;
}
