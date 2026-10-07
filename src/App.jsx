/**
 * App root: auth gate → shell → active view.
 */

import { useState } from 'react';
import { AppStateProvider, useAppState } from './AppState.jsx';
import Login from './components/Login.jsx';
import Shell from './components/Shell.jsx';
import CommandCenter from './components/CommandCenter.jsx';
import ManpowerPredictor from './components/ManpowerPredictor.jsx';
import AttritionRisk from './components/AttritionRisk.jsx';
import HolidayRiskCalendar from './components/HolidayRiskCalendar.jsx';
import WhatIfSimulator from './components/WhatIfSimulator.jsx';
import BusinessImpact from './components/BusinessImpact.jsx';
import AskHr from './components/AskHr.jsx';
import DailyBriefing from './components/DailyBriefing.jsx';

const VIEWS = {
  command: CommandCenter,
  predictor: ManpowerPredictor,
  attrition: AttritionRisk,
  holiday: HolidayRiskCalendar,
  whatif: WhatIfSimulator,
  impact: BusinessImpact,
  askhr: AskHr,
  briefing: DailyBriefing,
};

function AuthedApp() {
  const { booting } = useAppState();
  const [tab, setTab] = useState('command');

  if (booting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="animate-pulse text-sm text-slate-400">Booting command center…</p>
      </div>
    );
  }

  const View = VIEWS[tab] ?? CommandCenter;
  return (
    <Shell tab={tab} onTab={setTab}>
      <View />
    </Shell>
  );
}

function Gate() {
  const { user } = useAppState();
  return user ? <AuthedApp /> : <Login />;
}

export default function App() {
  return (
    <AppStateProvider>
      <Gate />
    </AppStateProvider>
  );
}
