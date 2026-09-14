import {
  NurseStaff,
  PatientRoom,
  OnCallProviders,
  FinalizedShiftSnapshot,
  ForecastEvent,
  CurrentShiftState,
  OperationalEvent,
  PlanBaseline,
  PlanningWorkspace,
  MTCoverageState,
  PCTCoverageState,
} from '../types';

const ROSTER_KEY = '1E_STAFF_ROSTER';
const ROOMS_KEY = '1E_CURRENT_ROOMS';
const ONCALL_KEY = '1E_ONCALL_PROVIDERS';
const HISTORY_KEY = '1E_SHIFT_HISTORY';
const FORECAST_KEY = '1E_FORECAST_EVENTS';
const CURRENT_SHIFT_KEY = '1E_LIVE_CURRENT_SHIFT';
const OPERATIONAL_EVENTS_KEY = '1E_OPERATIONAL_EVENTS';
const PLAN_BASELINE_KEY = '1E_PLAN_BASELINE';
const CURRENT_MRS_KEY = '1E_CURRENT_MRS_INPUT';
const PROJECTED_MRS_KEY = '1E_PROJECTED_MRS_INPUT';
const PLAN_DATE_KEY = '1E_PLAN_DATE';
const SHIFT_KEY = '1E_SHIFT_TYPE';
const PLAN_SOURCE_KEY = '1E_PLAN_SOURCE_SHIFT';
const PM_ONCALL_KEY = '1E_NEXT_DAY_PM_ONCALL';
const PLAN_MT_STATE_KEY = '1E_PLAN_MT_STATE';
const PLAN_PCT_STATE_KEY = '1E_PLAN_PCT_STATE';
const PLANNING_WORKSPACE_KEY = '1E_PLANNING_WORKSPACE';

const EMPTY_ONCALL: OnCallProviders = { intensivist:'', cardiothoracic:'', acuteMI:'', cardiology:'', hospitalist:'' };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const safeParse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return clone(fallback);
  try {
    return JSON.parse(raw) as T;
  } catch {
    return clone(fallback);
  }
};
const normalizeName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');
const localIsoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const shiftOrdinal = (date: string, shiftType: 'Day'|'Night') => {
  const day = Math.floor(new Date(`${date}T12:00:00`).getTime() / 86400000);
  return day * 2 + (shiftType === 'Night' ? 1 : 0);
};

export const INITIAL_STAFF: NurseStaff[] = [
  { id: 'n1', name: 'Sarah Jenkins', role: 'CHG', assignedPhone: '44-3801', capability: 'CVICU', staffStatus: 'ACTIVE' },
  { id: 'n2', name: 'Mark Wilson', role: 'RN', assignedPhone: '44-3867', capability: 'ICU', staffStatus: 'ACTIVE', coveringMT: true },
  { id: 'n3', name: 'Elena Rostova', role: 'RN', assignedPhone: '44-3882', capability: 'CVICU', staffStatus: 'ACTIVE' },
  { id: 'n4', name: 'David Kim', role: 'RN', assignedPhone: '44-3912', capability: 'ICU', staffStatus: 'ACTIVE' },
  { id: 'n5', name: 'Christina Morales', role: 'RN', assignedPhone: '44-3966', capability: 'PCU_TELE', staffStatus: 'ACTIVE' },
  { id: 'n6', name: 'Halley Bennett', role: 'RN', assignedPhone: '44-3866', capability: 'PCU_TELE', staffStatus: 'ACTIVE' },
  { id: 'n7', name: 'Lauren Davis', role: 'RN', assignedPhone: '44-3990', capability: 'ICU', staffStatus: 'ON_CALL' },
  { id: 'n8', name: 'James Miller', role: 'MT', assignedPhone: '44-4001', capability: 'PCU_TELE', staffStatus: 'ACTIVE' },
  { id: 'n9', name: 'Alex Johnson', role: 'PCT', assignedPhone: '44-4055', capability: 'PCU_TELE', staffStatus: 'ACTIVE' },
];

export const INITIAL_ROOMS: PatientRoom[] = [
  { roomNumber: '101', isOccupied: true, patientStayId: 'PT-8801', acuity: 'CVICU', flags: ['Pressors', 'Fresh Post-Op'], assignedNurseId: null },
  { roomNumber: '102', isOccupied: true, patientStayId: 'PT-8802', acuity: 'ICU', flags: ['Pressors'], assignedNurseId: null },
  { roomNumber: '103', isOccupied: false, patientStayId: '', acuity: 'TELE', flags: [], assignedNurseId: null },
  { roomNumber: '104', isOccupied: true, patientStayId: 'PT-8832', acuity: 'ICU', flags: ['Vent'], assignedNurseId: null },
  { roomNumber: '105', isOccupied: true, patientStayId: 'PT-4421', acuity: 'PCU', flags: ['Isolation'], assignedNurseId: null },
  { roomNumber: '106', isOccupied: true, patientStayId: 'PT-9931', acuity: 'ICU', flags: ['Vent'], assignedNurseId: null },
  { roomNumber: '107', isOccupied: false, patientStayId: '', acuity: 'TELE', flags: [], assignedNurseId: null },
  { roomNumber: '108', isOccupied: false, patientStayId: '', acuity: 'TELE', flags: [], assignedNurseId: null },
  { roomNumber: '109', isOccupied: true, patientStayId: 'PT-3301', acuity: 'PCU', flags: ['High Fall Risk', 'Confused'], assignedNurseId: null },
  { roomNumber: '110', isOccupied: true, patientStayId: 'PT-5512', acuity: 'PCU', flags: [], assignedNurseId: null },
  { roomNumber: '111', isOccupied: true, patientStayId: 'PT-7714', acuity: 'TELE', flags: ['Admission'], assignedNurseId: null },
  { roomNumber: '112', isOccupied: true, patientStayId: 'PT-6619', acuity: 'PCU', flags: [], assignedNurseId: null },
  { roomNumber: '113', isOccupied: true, patientStayId: 'PT-2291', acuity: 'ICU', flags: ['HD/Dialysis'], assignedNurseId: null },
  { roomNumber: '114', isOccupied: true, patientStayId: 'PT-1104', acuity: 'ICU', flags: ['Vent'], assignedNurseId: null },
  { roomNumber: '115', isOccupied: true, patientStayId: 'PT-5519', acuity: 'PCU', flags: [], assignedNurseId: null },
  { roomNumber: '116', isOccupied: true, patientStayId: 'PT-3942', acuity: 'PCU', flags: [], assignedNurseId: null },
  { roomNumber: '117', isOccupied: false, patientStayId: '', acuity: 'TELE', flags: [], assignedNurseId: null },
  { roomNumber: '118', isOccupied: true, patientStayId: 'PT-5509', acuity: 'TELE', flags: ['Discharge'], assignedNurseId: null },
  { roomNumber: '119', isOccupied: true, patientStayId: 'PT-9941', acuity: 'PCU', flags: ['Sitter/Safety', 'Confused'], assignedNurseId: null },
  { roomNumber: '120', isOccupied: true, patientStayId: 'PT-2234', acuity: 'TELE', flags: [], assignedNurseId: null },
  { roomNumber: '121', isOccupied: false, patientStayId: '', acuity: 'TELE', flags: [], assignedNurseId: null },
  { roomNumber: '122', isOccupied: true, patientStayId: 'PT-6677', acuity: 'PCU', flags: [], assignedNurseId: null },
];

export const INITIAL_ONCALL: OnCallProviders = {
  intensivist: 'Dr. R. Vance',
  cardiothoracic: 'Dr. S. Miller',
  acuteMI: 'Dr. E. Thorne',
  cardiology: 'Dr. A. Patel',
  hospitalist: 'Dr. M. Jenkins',
};

export const INITIAL_FORECAST: ForecastEvent[] = [
  { id: 'fe-1', procedureType: 'CABG', expectedTime: '12:00', acuity: 'CVICU', destinationLevel: 'CVICU Bed', notes: 'Expected post-op return' },
  { id: 'fe-2', procedureType: 'TAVR', expectedTime: '13:30', acuity: 'ICU', destinationLevel: 'ICU Bed', notes: 'Direct from Hybrid OR' },
  { id: 'fe-3', procedureType: 'Direct/ED Admission', expectedTime: '14:00', acuity: 'PCU', destinationLevel: 'Floor Bed', notes: 'ED transfer with NSTEMI' },
  { id: 'fe-4', procedureType: 'Expected Discharge', expectedTime: '11:00', acuity: 'TELE', destinationLevel: 'Home', notes: 'Discharge orders pending' },
];

export const INITIAL_HISTORY: FinalizedShiftSnapshot[] = [];

const defaultCurrentShift = (): CurrentShiftState => {
  const now = new Date();
  return {
    date: localIsoDate(now),
    shiftType: now.getHours() >= 19 || now.getHours() < 7 ? 'Night' : 'Day',
    roster: clone(INITIAL_STAFF),
    rooms: clone(INITIAL_ROOMS),
    mtState: 'MT_PRESENT',
    pctState: 'PCT_PRESENT',
    onCall: clone(INITIAL_ONCALL),
    lastUpdatedAt: now.toISOString(),
  };
};

export const StorageService = {
  loadStaff(): NurseStaff[] { return safeParse(localStorage.getItem(ROSTER_KEY), INITIAL_STAFF); },
  saveStaff(staff: NurseStaff[]): void { localStorage.setItem(ROSTER_KEY, JSON.stringify(staff)); },
  loadRooms(): PatientRoom[] { return safeParse(localStorage.getItem(ROOMS_KEY), INITIAL_ROOMS); },
  saveRooms(rooms: PatientRoom[]): void { localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms)); },
  loadOnCall(): OnCallProviders { return safeParse(localStorage.getItem(ONCALL_KEY), INITIAL_ONCALL); },
  saveOnCall(onCall: OnCallProviders): void { localStorage.setItem(ONCALL_KEY, JSON.stringify(onCall)); },
  loadHistory(): FinalizedShiftSnapshot[] { return safeParse(localStorage.getItem(HISTORY_KEY), INITIAL_HISTORY); },
  saveFinalizedShift(snapshot: FinalizedShiftSnapshot): void {
    const history = this.loadHistory().filter(s => !(s.date === snapshot.date && s.shiftType === snapshot.shiftType));
    history.unshift(snapshot);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 60)));
  },
  loadForecast(): ForecastEvent[] { return safeParse(localStorage.getItem(FORECAST_KEY), INITIAL_FORECAST); },
  saveForecast(events: ForecastEvent[]): void { localStorage.setItem(FORECAST_KEY, JSON.stringify(events)); },
  savePlanBaseline(snapshot: PlanBaseline): void { localStorage.setItem(PLAN_BASELINE_KEY, JSON.stringify(snapshot)); },
  loadPlanBaseline(): PlanBaseline | null { return safeParse<PlanBaseline | null>(localStorage.getItem(PLAN_BASELINE_KEY), null); },
  loadCurrentShift(): CurrentShiftState { return safeParse(localStorage.getItem(CURRENT_SHIFT_KEY), defaultCurrentShift()); },
  saveCurrentShift(state: CurrentShiftState): void { localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify({ ...state, lastUpdatedAt: new Date().toISOString() })); },
  startCurrentShiftFromPlan(plan: PlanBaseline): CurrentShiftState {
    const state: CurrentShiftState = { date: plan.date, shiftType: plan.shiftType, roster: clone(plan.roster), rooms: clone(plan.rooms), mtState: plan.mtState, pctState: plan.pctState, onCall: clone(plan.onCall), lastUpdatedAt: new Date().toISOString() };
    this.saveCurrentShift(state);
    this.appendOperationalEvent({ id: `evt-${Date.now()}`, timestamp: new Date().toISOString(), shiftDate: state.date, shiftType: state.shiftType, type: 'SHIFT_STARTED', summary: 'Current staffing initialized from saved plan baseline.' });
    return state;
  },
  loadOperationalEvents(): OperationalEvent[] { return safeParse(localStorage.getItem(OPERATIONAL_EVENTS_KEY), [] as OperationalEvent[]); },
  appendOperationalEvent(event: OperationalEvent): void { const events = this.loadOperationalEvents(); events.unshift(event); localStorage.setItem(OPERATIONAL_EVENTS_KEY, JSON.stringify(events.slice(0, 300))); },

  loadPlanDate(fallback: string): string { return localStorage.getItem(PLAN_DATE_KEY) || fallback; },
  savePlanDate(value: string): void { localStorage.setItem(PLAN_DATE_KEY, value); },
  loadShiftType(): 'Day' | 'Night' { const raw = localStorage.getItem(SHIFT_KEY); return raw === 'Night' ? 'Night' : 'Day'; },
  saveShiftType(value: 'Day' | 'Night'): void { localStorage.setItem(SHIFT_KEY, value); },
  loadCurrentMrs(fallback: number): number { const value = Number(localStorage.getItem(CURRENT_MRS_KEY)); return Number.isFinite(value) && value > 0 ? value : fallback; },
  saveCurrentMrs(value: number): void { localStorage.setItem(CURRENT_MRS_KEY, String(value)); },
  loadProjectedMrs(fallback: number): number { const value = Number(localStorage.getItem(PROJECTED_MRS_KEY)); return Number.isFinite(value) && value > 0 ? value : fallback; },
  saveProjectedMrs(value: number): void { localStorage.setItem(PROJECTED_MRS_KEY, String(value)); },
  loadPlanSource(): string | null { return localStorage.getItem(PLAN_SOURCE_KEY); },
  savePlanSource(value: string): void { localStorage.setItem(PLAN_SOURCE_KEY, value); },
  clearPlanSource(): void { localStorage.removeItem(PLAN_SOURCE_KEY); },
  loadPmOnCall(): OnCallProviders { return safeParse(localStorage.getItem(PM_ONCALL_KEY), EMPTY_ONCALL); },
  savePmOnCall(value: OnCallProviders): void { localStorage.setItem(PM_ONCALL_KEY, JSON.stringify(value)); },
  loadPlanMtState(): MTCoverageState { const raw = localStorage.getItem(PLAN_MT_STATE_KEY); return raw === 'RN_COVERING_MT' || raw === 'MT_UNFILLED' ? raw : 'MT_PRESENT'; },
  savePlanMtState(value: MTCoverageState): void { localStorage.setItem(PLAN_MT_STATE_KEY, value); },
  loadPlanPctState(): PCTCoverageState { return localStorage.getItem(PLAN_PCT_STATE_KEY) === 'PCT_NONE' ? 'PCT_NONE' : 'PCT_PRESENT'; },
  savePlanPctState(value: PCTCoverageState): void { localStorage.setItem(PLAN_PCT_STATE_KEY, value); },

  loadPlanningWorkspace(defaultDate: string, defaultMrs: number): PlanningWorkspace {
    const raw = localStorage.getItem(PLANNING_WORKSPACE_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as PlanningWorkspace;
      } catch {
        // Fall through to a safe migration from the Stage B keys.
      }
    }
    const migrated: PlanningWorkspace = {
      targetDate: this.loadPlanDate(defaultDate),
      shiftType: this.loadShiftType(),
      roster: this.loadStaff(),
      rooms: this.loadRooms(),
      mtState: this.loadPlanMtState(),
      pctState: this.loadPlanPctState(),
      onCall: this.loadOnCall(),
      pmOnCall: this.loadPmOnCall(),
      currentMRS: this.loadCurrentMrs(defaultMrs),
      projectedMRS: this.loadProjectedMrs(defaultMrs),
      lastUpdatedAt: new Date().toISOString(),
    };
    this.savePlanningWorkspace(migrated);
    return migrated;
  },
  savePlanningWorkspace(workspace: PlanningWorkspace): PlanningWorkspace {
    const stamped = { ...workspace, lastUpdatedAt: new Date().toISOString() };
    localStorage.setItem(PLANNING_WORKSPACE_KEY, JSON.stringify(stamped));
    return stamped;
  },

  resetToDefaults(): void {
    [
      ROSTER_KEY,
      ROOMS_KEY,
      ONCALL_KEY,
      HISTORY_KEY,
      FORECAST_KEY,
      CURRENT_SHIFT_KEY,
      OPERATIONAL_EVENTS_KEY,
      PLAN_BASELINE_KEY,
      CURRENT_MRS_KEY,
      PROJECTED_MRS_KEY,
      PLAN_DATE_KEY,
      SHIFT_KEY,
      PLAN_SOURCE_KEY,
      PM_ONCALL_KEY,
      PLAN_MT_STATE_KEY,
      PLAN_PCT_STATE_KEY,
      PLANNING_WORKSPACE_KEY,
    ].forEach(key => localStorage.removeItem(key));
  },
  findContinuity(patientStayId: string, currentRoster: NurseStaff[], targetDate?: string, targetShift?: 'Day'|'Night'): { nurseId: string; nurseName: string; daysAgo: number } | null {
    if (!patientStayId) return null;
    let history = this.loadHistory();
    if (targetDate && targetShift) {
      const target = shiftOrdinal(targetDate, targetShift);
      history = history
        .filter(s => s.shiftType === targetShift && shiftOrdinal(s.date, s.shiftType) < target)
        .sort((a,b) => shiftOrdinal(b.date,b.shiftType) - shiftOrdinal(a.date,a.shiftType));
    }
    for (let i = 0; i < Math.min(history.length, 6); i += 1) {
      const snap = history[i];
      const match = snap.rooms.find(r => r.patientStayId === patientStayId && r.assignedNurseId);
      if (!match?.assignedNurseId) continue;
      let activeStaff = currentRoster.find(s => s.id === match.assignedNurseId && (s.staffStatus === 'ACTIVE' || s.staffStatus === 'RECALLED'));
      if (!activeStaff) {
        const priorNurse = snap.roster.find(s => s.id === match.assignedNurseId);
        if (priorNurse) {
          const priorName = normalizeName(priorNurse.name);
          activeStaff = currentRoster.find(s => normalizeName(s.name) === priorName && (s.staffStatus === 'ACTIVE' || s.staffStatus === 'RECALLED'));
        }
      }
      if (activeStaff) return { nurseId: activeStaff.id, nurseName: activeStaff.name, daysAgo: i + 1 };
    }
    return null;
  },
};
