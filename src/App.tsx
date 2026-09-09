import React, { useEffect, useMemo, useState } from 'react';
import {
  AssignmentWarning,
  CurrentShiftState,
  FinalizedShiftSnapshot,
  ForecastEvent,
  MTCoverageState,
  NurseStaff,
  OnCallProviders,
  OperationalEvent,
  PatientRoom,
  PCTCoverageState,
  PlanBaseline,
} from './types';
import { StorageService } from './services/storage';
import { runRecommendationEngine } from './services/recommendationEngine';
import { MRS_CONFIG, getMRSStatus } from './config/mrs';
import { UnitBoard } from './components/UnitBoard';
import { PrintSheet } from './components/PrintSheet';
import { NextShiftForecast } from './components/NextShiftForecast';
import { RosterPlanner } from './components/RosterPlanner';
import { CurrentStaffing } from './components/CurrentStaffing';
import { HistoryView } from './components/HistoryView';
import { AlertTriangle, CalendarDays, Clock3, History, Play, Printer, RotateCcw } from 'lucide-react';

const tomorrowIso = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const CURRENT_MRS_KEY = '1E_CURRENT_MRS_INPUT';
const PROJECTED_MRS_KEY = '1E_PROJECTED_MRS_INPUT';
const PLAN_DATE_KEY = '1E_PLAN_DATE';
const SHIFT_KEY = '1E_SHIFT_TYPE';

type Tab = 'current' | 'plan' | 'forecast' | 'history' | 'print';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('current');
  const [date, setDate] = useState<string>(() => localStorage.getItem(PLAN_DATE_KEY) || tomorrowIso());
  const [shiftType, setShiftType] = useState<'Day' | 'Night'>(() => (localStorage.getItem(SHIFT_KEY) as 'Day' | 'Night') || 'Day');
  const [chargeTakingPatients, setChargeTakingPatients] = useState(false);
  const [allowTeleQuad, setAllowTeleQuad] = useState(false);
  const [mtState, setMtState] = useState<MTCoverageState>('MT_PRESENT');
  const [pctState, setPctState] = useState<PCTCoverageState>('PCT_PRESENT');
  const [roster, setRoster] = useState<NurseStaff[]>([]);
  const [rooms, setRooms] = useState<PatientRoom[]>([]);
  const [onCall, setOnCall] = useState<OnCallProviders>(StorageService.loadOnCall());
  const [forecastEvents, setForecastEvents] = useState<ForecastEvent[]>([]);
  const [warnings, setWarnings] = useState<AssignmentWarning[]>([]);
  const [fitScore, setFitScore] = useState(100);
  const [fitLabel, setFitLabel] = useState('NOT YET GENERATED');
  const [unassignedRooms, setUnassignedRooms] = useState<string[]>([]);
  const [currentMRS, setCurrentMRS] = useState<number>(() => Number(localStorage.getItem(CURRENT_MRS_KEY) || MRS_CONFIG.target));
  const [projectedMRS, setProjectedMRS] = useState<number>(() => Number(localStorage.getItem(PROJECTED_MRS_KEY) || MRS_CONFIG.target));
  const [currentShift, setCurrentShift] = useState<CurrentShiftState>(() => StorageService.loadCurrentShift());
  const [events, setEvents] = useState<OperationalEvent[]>(() => StorageService.loadOperationalEvents());
  const [planBaseline, setPlanBaseline] = useState<PlanBaseline | null>(() => StorageService.loadPlanBaseline());
  const [history, setHistory] = useState<FinalizedShiftSnapshot[]>(() => StorageService.loadHistory());

  useEffect(() => {
    setRoster(StorageService.loadStaff());
    setRooms(StorageService.loadRooms());
    setForecastEvents(StorageService.loadForecast());
  }, []);

  useEffect(() => { localStorage.setItem(PLAN_DATE_KEY, date); }, [date]);
  useEffect(() => { localStorage.setItem(SHIFT_KEY, shiftType); }, [shiftType]);
  useEffect(() => { localStorage.setItem(CURRENT_MRS_KEY, String(currentMRS)); }, [currentMRS]);
  useEffect(() => { localStorage.setItem(PROJECTED_MRS_KEY, String(projectedMRS)); }, [projectedMRS]);

  const currentStatus = getMRSStatus(currentMRS);
  const projectedStatus = getMRSStatus(projectedMRS);
  const plannedCensus = rooms.filter(r => r.isOccupied).length;
  const currentCensus = currentShift.rooms.filter(r => r.isOccupied).length;
  const currentActiveRNs = currentShift.roster.filter(s => s.role === 'RN' && ['ACTIVE','RECALLED'].includes(s.staffStatus)).length;

  const supportRisk = useMemo(() => {
    const issues: string[] = [];
    if (currentShift.mtState === 'MT_UNFILLED') issues.push('MT unfilled');
    if (currentShift.mtState === 'RN_COVERING_MT') issues.push('RN covering MT');
    if (currentShift.pctState === 'PCT_NONE') issues.push('No PCT');
    return issues;
  }, [currentShift.mtState, currentShift.pctState]);

  const handleGenerateRecommendation = (teleQuad = allowTeleQuad, chargePatients = chargeTakingPatients) => {
    const result = runRecommendationEngine(roster, rooms, chargePatients, teleQuad);
    const updatedRooms = rooms.map(r => ({ ...r, assignedNurseId: result.assignments[r.roomNumber] || null }));
    setRooms(updatedRooms);
    setWarnings(result.warnings);
    setFitScore(result.fitScore);
    setFitLabel(result.fitLabel);
    setUnassignedRooms(result.unassignedRooms);
    StorageService.saveRooms(updatedRooms);
  };

  const saveRoster = (updated: NurseStaff[]) => {
    setRoster(updated);
    StorageService.saveStaff(updated);
  };

  const savePlanBaseline = () => {
    const baseline: PlanBaseline = {
      id: `plan-${Date.now()}`,
      date,
      shiftType,
      finalizedAt: new Date().toISOString(),
      savedAt: new Date().toISOString(),
      roster,
      rooms,
      onCall,
      fitScore,
      warnings,
      mtState,
      pctState,
      currentMRS,
      projectedMRS,
    };
    StorageService.savePlanBaseline(baseline);
    setPlanBaseline(baseline);
    window.alert('Tomorrow plan saved as the baseline for planned-vs-actual comparison.');
  };

  const startCurrentFromPlan = () => {
    const plan = StorageService.loadPlanBaseline();
    if (!plan) {
      window.alert('Save a Tomorrow Plan baseline first.');
      setActiveTab('plan');
      return;
    }
    const state = StorageService.startCurrentShiftFromPlan(plan);
    setCurrentShift(state);
    setEvents(StorageService.loadOperationalEvents());
    setActiveTab('current');
  };

  const handleReset = () => {
    StorageService.resetToDefaults();
    localStorage.removeItem(CURRENT_MRS_KEY);
    localStorage.removeItem(PROJECTED_MRS_KEY);
    setRoster(StorageService.loadStaff());
    setRooms(StorageService.loadRooms());
    setOnCall(StorageService.loadOnCall());
    setForecastEvents(StorageService.loadForecast());
    setWarnings([]);
    setUnassignedRooms([]);
    setFitScore(100);
    setFitLabel('NOT YET GENERATED');
    setCurrentMRS(MRS_CONFIG.target);
    setProjectedMRS(MRS_CONFIG.target);
    setCurrentShift(StorageService.loadCurrentShift());
    setEvents([]);
    setPlanBaseline(null);
    setHistory([]);
    setActiveTab('current');
  };

  const refreshHistory = () => setHistory(StorageService.loadHistory());

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
      <header className="bg-slate-900 text-white px-6 py-3 no-print">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="font-black text-lg tracking-tight">1E ASSIGNMENT RECOMMENDATION ENGINE</h1>
            <p className="text-xs text-slate-400">Current operations • Tomorrow planning • Next-shift readiness</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="bg-slate-800 px-3 py-1.5 rounded border border-slate-700">Current Census <strong>{currentCensus}</strong></div>
            <div className="bg-slate-800 px-3 py-1.5 rounded border border-slate-700">Current Bedside RNs <strong>{currentActiveRNs}</strong></div>
            <div className="bg-slate-800 px-3 py-1.5 rounded border border-slate-700">Tomorrow Planned Census <strong>{plannedCensus}</strong></div>
            {supportRisk.length > 0 && <div className="bg-amber-950 px-3 py-1.5 rounded border border-amber-800 text-amber-200">{supportRisk.join(' • ')}</div>}
          </div>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 px-6 py-2.5 no-print shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setActiveTab('current')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${activeTab === 'current' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Clock3 className="w-3.5 h-3.5"/> Current Staffing</button>
            <button onClick={() => setActiveTab('plan')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${activeTab === 'plan' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><CalendarDays className="w-3.5 h-3.5"/> Tomorrow Plan</button>
            <button onClick={() => setActiveTab('forecast')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${activeTab === 'forecast' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><CalendarDays className="w-3.5 h-3.5"/> Next Shift Readiness</button>
            <button onClick={() => { refreshHistory(); setEvents(StorageService.loadOperationalEvents()); setActiveTab('history'); }} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${activeTab === 'history' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><History className="w-3.5 h-3.5"/> History</button>
            <button onClick={() => setActiveTab('print')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${activeTab === 'print' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}><Printer className="w-3.5 h-3.5"/> Print View</button>
          </div>
          <button onClick={handleReset} className="text-slate-500 hover:text-slate-800 p-1.5 rounded hover:bg-slate-100" title="Reset local demo data"><RotateCcw className="w-4 h-4"/></button>
        </div>
      </nav>

      {activeTab === 'plan' && (
        <section className="bg-white border-b border-slate-200 no-print">
          <div className="max-w-7xl mx-auto px-6 py-3 flex flex-wrap items-end gap-4">
            <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Planning Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" /></div>
            <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Shift</label><select value={shiftType} onChange={e => setShiftType(e.target.value as 'Day'|'Night')} className="border rounded-lg px-3 py-2 text-sm"><option>Day</option><option>Night</option></select></div>
            <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Current MRS <span className="font-normal">(manual advisory)</span></label><input type="number" step="0.001" value={currentMRS} onChange={e => setCurrentMRS(Number(e.target.value))} className="w-28 border rounded-lg px-3 py-2 text-sm" /><span className="ml-2 text-xs font-bold">{currentStatus.color}</span></div>
            <div><label className="text-[10px] font-black uppercase text-slate-500 block mb-1">Projected MRS <span className="font-normal">(manual advisory)</span></label><input type="number" step="0.001" value={projectedMRS} onChange={e => setProjectedMRS(Number(e.target.value))} className="w-28 border rounded-lg px-3 py-2 text-sm" /><span className="ml-2 text-xs font-bold">{projectedStatus.color}</span></div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button onClick={() => setChargeTakingPatients(v => !v)} className={`px-2.5 py-2 rounded border text-xs font-bold ${chargeTakingPatients ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>Charge Taking Patients: {chargeTakingPatients ? 'YES' : 'NO'}</button>
              <button onClick={() => handleGenerateRecommendation()} className="bg-emerald-600 text-white px-3.5 py-2 rounded-lg text-xs font-black flex items-center gap-1.5"><Play className="w-3.5 h-3.5 fill-current"/> Generate Tomorrow Plan</button>
              <button onClick={savePlanBaseline} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold">Save Plan Baseline</button>
            </div>
          </div>
        </section>
      )}

      {unassignedRooms.length > 0 && activeTab === 'plan' && <div className="bg-rose-600 text-white px-6 py-3 no-print"><div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-3"><div className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="w-5 h-5"/>STAFFING CAPACITY EXCEEDED — rooms {unassignedRooms.join(', ')} require Charge Nurse review.</div><div className="flex gap-2 text-xs"><button onClick={() => { setAllowTeleQuad(true); handleGenerateRecommendation(true, chargeTakingPatients); }} className="bg-white text-rose-800 px-3 py-1 rounded font-bold">Allow TELE Quad</button><button onClick={() => { setChargeTakingPatients(true); handleGenerateRecommendation(allowTeleQuad, true); }} className="bg-white text-rose-800 px-3 py-1 rounded font-bold">Charge Takes Patient</button></div></div></div>}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {activeTab === 'current' && <CurrentStaffing currentShift={currentShift} onCurrentShiftChange={setCurrentShift} events={events} onEventsChange={setEvents} onStartFromPlan={startCurrentFromPlan} />}

        {activeTab === 'plan' && <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200"><div className="flex flex-wrap justify-between gap-2"><div><h2 className="font-black text-base">Tomorrow Plan — {date} {shiftType}</h2><p className="text-xs text-slate-500 mt-1">Plan staff first, then confirm room acuity/occupancy and generate the recommendation. Saving creates the baseline for planned-vs-actual history.</p></div><div className="text-xs text-slate-500">Assignment fit: <b>{fitScore}% {fitLabel}</b></div></div></div>
          <RosterPlanner roster={roster} mtState={mtState} pctState={pctState} onRosterChange={saveRoster} onMtStateChange={setMtState} onPctStateChange={setPctState} onCall={onCall} onOnCallChange={updated => { setOnCall(updated); StorageService.saveOnCall(updated); }} />
          <UnitBoard rooms={rooms} roster={roster} warnings={warnings} onRoomChange={updated => { const next = rooms.map(r => r.roomNumber === updated.roomNumber ? updated : r); setRooms(next); StorageService.saveRooms(next); }} onAssignRoom={(roomNum, nurseId) => { const next = rooms.map(r => r.roomNumber === roomNum ? { ...r, assignedNurseId: nurseId } : r); setRooms(next); StorageService.saveRooms(next); }} />
        </div>}

        {activeTab === 'forecast' && <NextShiftForecast events={forecastEvents} roster={roster} rooms={rooms} mtState={mtState} pctState={pctState} onAddEvent={e => { const updated = [...forecastEvents, e]; setForecastEvents(updated); StorageService.saveForecast(updated); }} onDeleteEvent={id => { const updated = forecastEvents.filter(e => e.id !== id); setForecastEvents(updated); StorageService.saveForecast(updated); }} />}

        {activeTab === 'history' && <HistoryView plan={planBaseline} current={currentShift} history={history} events={events} />}

        {activeTab === 'print' && <div><div className="no-print mb-4 flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200"><span className="text-sm font-semibold text-slate-700">Prints the current live staffing sheet using first names only.</span><button onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5"><Printer className="w-4 h-4"/> Print Current Sheet</button></div><PrintSheet date={currentShift.date} shiftType={currentShift.shiftType} roster={currentShift.roster} rooms={currentShift.rooms} onCall={currentShift.onCall}/></div>}
      </main>
    </div>
  );
};
