import React, { useEffect, useMemo, useState } from 'react';
import { AssignmentWarning, CurrentShiftState, FinalizedShiftSnapshot, ForecastEvent, MTCoverageState, NurseStaff, OnCallProviders, OperationalEvent, PatientRoom, PCTCoverageState, PlanBaseline } from './types';
import { StorageService } from './services/storage';
import { downloadDailyStaffingExcel } from './services/excelExport';
import { MRS_CONFIG, getMRSStatus } from './config/mrs';
import { PrintSheet } from './components/PrintSheet';
import { NextShiftForecast } from './components/NextShiftForecast';
import { RosterPlanner } from './components/RosterPlanner';
import { CurrentStaffing } from './components/CurrentStaffing';
import { TomorrowStaffing } from './components/TomorrowStaffing';
import { HistoryView } from './components/HistoryView';
import { CalendarDays, Clock3, Download, History, Printer, RotateCcw, Settings2 } from 'lucide-react';

const tomorrowIso=()=>{const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
type Tab='current'|'plan'|'forecast'|'history'|'print';

const nextShiftIdentity=(current:CurrentShiftState)=>{
  if(current.shiftType==='Day') return {date:current.date,shiftType:'Night' as const};
  const d=new Date(`${current.date}T12:00:00`);d.setDate(d.getDate()+1);
  return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,shiftType:'Day' as const};
};

export const App:React.FC=()=>{
 const[activeTab,setActiveTab]=useState<Tab>('current'),[date,setDate]=useState(()=>StorageService.loadPlanDate(tomorrowIso())),[shiftType,setShiftType]=useState<'Day'|'Night'>(()=>StorageService.loadShiftType()),[mtState,setMtState]=useState<MTCoverageState>(()=>StorageService.loadPlanMtState()),[pctState,setPctState]=useState<PCTCoverageState>(()=>StorageService.loadPlanPctState()),[roster,setRoster]=useState<NurseStaff[]>([]),[rooms,setRooms]=useState<PatientRoom[]>([]),[onCall,setOnCall]=useState<OnCallProviders>(StorageService.loadOnCall()),[pmOnCall,setPmOnCall]=useState<OnCallProviders>(()=>StorageService.loadPmOnCall()),[forecastEvents,setForecastEvents]=useState<ForecastEvent[]>([]),[warnings,setWarnings]=useState<AssignmentWarning[]>([]),[fitScore]=useState(100),[currentMRS,setCurrentMRS]=useState(()=>StorageService.loadCurrentMrs(MRS_CONFIG.target)),[projectedMRS,setProjectedMRS]=useState(()=>StorageService.loadProjectedMrs(MRS_CONFIG.target)),[currentShift,setCurrentShift]=useState<CurrentShiftState>(()=>StorageService.loadCurrentShift()),[events,setEvents]=useState<OperationalEvent[]>(()=>StorageService.loadOperationalEvents()),[planBaseline,setPlanBaseline]=useState<PlanBaseline|null>(()=>StorageService.loadPlanBaseline()),[history,setHistory]=useState<FinalizedShiftSnapshot[]>(()=>StorageService.loadHistory());
 useEffect(()=>{setRoster(StorageService.loadStaff());setRooms(StorageService.loadRooms());setForecastEvents(StorageService.loadForecast());const saved=StorageService.loadPlanBaseline();if(saved?.pmOnCall)setPmOnCall(saved.pmOnCall);},[]);
 useEffect(()=>{StorageService.savePlanDate(date)},[date]);useEffect(()=>{StorageService.saveShiftType(shiftType)},[shiftType]);useEffect(()=>{StorageService.savePlanMtState(mtState)},[mtState]);useEffect(()=>{StorageService.savePlanPctState(pctState)},[pctState]);useEffect(()=>{StorageService.saveCurrentMrs(currentMRS)},[currentMRS]);useEffect(()=>{StorageService.saveProjectedMrs(projectedMRS)},[projectedMRS]);useEffect(()=>{StorageService.savePmOnCall(pmOnCall)},[pmOnCall]);
 const currentStatus=getMRSStatus(currentMRS),projectedStatus=getMRSStatus(projectedMRS),plannedCensus=rooms.filter(r=>r.isOccupied).length,currentCensus=currentShift.rooms.filter(r=>r.isOccupied).length,currentActiveRNs=currentShift.roster.filter(s=>['RN','Preceptor'].includes(s.role)&&['ACTIVE','RECALLED'].includes(s.staffStatus)).length;
 const supportRisk=useMemo(()=>{const a:string[]=[];if(currentShift.mtState==='MT_UNFILLED')a.push('MT unfilled');if(currentShift.mtState==='RN_COVERING_MT')a.push('RN covering MT');if(currentShift.pctState==='PCT_NONE')a.push('No PCT');return a},[currentShift.mtState,currentShift.pctState]);
 const saveRoster=(u:NurseStaff[])=>{setRoster(u);StorageService.saveStaff(u)};
 const saveRooms=(u:PatientRoom[])=>{setRooms(u);StorageService.saveRooms(u)};
 const savePlanBaseline=()=>{const b:PlanBaseline={id:`plan-${Date.now()}`,date,shiftType,finalizedAt:new Date().toISOString(),savedAt:new Date().toISOString(),roster,rooms,onCall,pmOnCall,fitScore,warnings,mtState,pctState,currentMRS,projectedMRS};StorageService.savePlanBaseline(b);setPlanBaseline(b);window.alert('Next Shift Plan saved as baseline, including AM and PM on-call coverage.')};
 const startCurrentFromPlan=()=>{const p=StorageService.loadPlanBaseline();if(!p){window.alert('Save a Next Shift Plan baseline first.');setActiveTab('plan');return}const s=StorageService.startCurrentShiftFromPlan(p);setCurrentShift(s);setEvents(StorageService.loadOperationalEvents());setActiveTab('current')};
 const openNextShiftPlan=()=>{
   const sourceKey=`${currentShift.date}|${currentShift.shiftType}`;
   const target=nextShiftIdentity(currentShift);
   if(StorageService.loadPlanSource()!==sourceKey){
     const seededRooms=currentShift.rooms.map(r=>({...r,assignedNurseId:null}));
     setRooms(seededRooms);StorageService.saveRooms(seededRooms);
     setDate(target.date);setShiftType(target.shiftType);
     StorageService.savePlanSource(sourceKey);
   }
   const saved=StorageService.loadPlanBaseline();if(saved?.date===target.date&&saved.pmOnCall)setPmOnCall(saved.pmOnCall);
   setActiveTab('plan');
 };
 const reset=()=>{StorageService.resetToDefaults();setRoster(StorageService.loadStaff());setRooms(StorageService.loadRooms());setOnCall(StorageService.loadOnCall());setPmOnCall(StorageService.loadPmOnCall());setForecastEvents(StorageService.loadForecast());setWarnings([]);setCurrentShift(StorageService.loadCurrentShift());setEvents(StorageService.loadOperationalEvents());setPlanBaseline(StorageService.loadPlanBaseline());setHistory(StorageService.loadHistory());setDate(StorageService.loadPlanDate(tomorrowIso()));setShiftType(StorageService.loadShiftType());setMtState(StorageService.loadPlanMtState());setPctState(StorageService.loadPlanPctState());setCurrentMRS(StorageService.loadCurrentMrs(MRS_CONFIG.target));setProjectedMRS(StorageService.loadProjectedMrs(MRS_CONFIG.target));setActiveTab('current')};
 const refreshHistory=()=>setHistory(StorageService.loadHistory());const previousShift=history[0]||null;
 const openPrint=()=>{refreshHistory();setPlanBaseline(StorageService.loadPlanBaseline());setActiveTab('print')};
 const downloadExcel=()=>{const savedPlan=StorageService.loadPlanBaseline();setPlanBaseline(savedPlan);downloadDailyStaffingExcel(currentShift,previousShift,savedPlan);};

 return <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
  <header className="bg-slate-900 text-white px-6 py-3 no-print"><div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4"><div><h1 className="font-black text-lg">1E FLOW & ASSIGNMENT BOARD</h1><p className="text-xs text-slate-400">Current operations • next-shift planning • readiness</p></div><div className="flex gap-2 text-xs"><div className="bg-slate-800 px-3 py-1.5 rounded">Current Census <b>{currentCensus}</b></div><div className="bg-slate-800 px-3 py-1.5 rounded">Current Bedside RNs <b>{currentActiveRNs}</b></div><div className="bg-slate-800 px-3 py-1.5 rounded">Next Shift Census <b>{plannedCensus}</b></div>{supportRisk.length>0&&<div className="bg-amber-950 px-3 py-1.5 rounded text-amber-200">{supportRisk.join(' • ')}</div>}</div></div></header>
  <nav className="bg-white border-b px-6 py-2.5 no-print"><div className="max-w-7xl mx-auto flex justify-between"><div className="flex gap-2 flex-wrap"><button onClick={()=>setActiveTab('current')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex gap-1 ${activeTab==='current'?'bg-emerald-600 text-white':''}`}><Clock3 className="w-3.5"/>Current Staffing</button><button onClick={openNextShiftPlan} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex gap-1 ${activeTab==='plan'?'bg-blue-600 text-white':''}`}><CalendarDays className="w-3.5"/>Next Shift Plan</button><button onClick={()=>setActiveTab('forecast')} className="px-3 py-1.5 text-xs font-bold">Next Shift Readiness</button><button onClick={()=>{refreshHistory();setEvents(StorageService.loadOperationalEvents());setActiveTab('history')}} className="px-3 py-1.5 text-xs font-bold flex gap-1"><History className="w-3.5"/>History</button><button onClick={openPrint} className="px-3 py-1.5 text-xs font-bold flex gap-1"><Printer className="w-3.5"/>Print View</button></div><button onClick={reset}><RotateCcw className="w-4"/></button></div></nav>
  <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
   {activeTab==='current'&&<CurrentStaffing currentShift={currentShift} onCurrentShiftChange={setCurrentShift} events={events} onEventsChange={setEvents} onStartFromPlan={startCurrentFromPlan} onOpenPrint={openPrint} onDownloadExcel={downloadExcel}/>} 
   {activeTab==='plan'&&<div className="space-y-5">
     <TomorrowStaffing date={date} shiftType={shiftType} roster={roster} rooms={rooms} mtState={mtState} pctState={pctState} onCall={onCall} sourceShift={currentShift} onDateChange={setDate} onShiftTypeChange={setShiftType} onRosterChange={saveRoster} onRoomsChange={saveRooms} onMtStateChange={setMtState} onPctStateChange={setPctState} onSaveBaseline={savePlanBaseline}/>
     <details className="bg-white border rounded-xl p-4"><summary className="cursor-pointer flex items-center gap-2 text-xs font-black uppercase"><Settings2 className="w-4 h-4"/>Next Shift Roster / On-Call / MRS Setup</summary><div className="mt-4 space-y-4"><div className="flex flex-wrap gap-4 items-end bg-slate-50 border rounded-lg p-3"><div><label className="text-[10px] font-black uppercase block">Current MRS</label><input type="number" step=".001" value={currentMRS} onChange={e=>setCurrentMRS(Number(e.target.value))} className="w-28 border rounded px-3 py-2"/> <span className="text-xs">{currentStatus.color}</span></div><div><label className="text-[10px] font-black uppercase block">Projected MRS</label><input type="number" step=".001" value={projectedMRS} onChange={e=>setProjectedMRS(Number(e.target.value))} className="w-28 border rounded px-3 py-2"/> <span className="text-xs">{projectedStatus.color}</span></div></div><RosterPlanner roster={roster} mtState={mtState} pctState={pctState} onRosterChange={saveRoster} onMtStateChange={setMtState} onPctStateChange={setPctState} onCall={onCall} pmOnCall={pmOnCall} onOnCallChange={u=>{setOnCall(u);StorageService.saveOnCall(u)}} onPmOnCallChange={setPmOnCall}/></div></details>
   </div>}
   {activeTab==='forecast'&&<NextShiftForecast events={forecastEvents} roster={roster} rooms={rooms} mtState={mtState} pctState={pctState} onAddEvent={e=>{const u=[...forecastEvents,e];setForecastEvents(u);StorageService.saveForecast(u)}} onDeleteEvent={id=>{const u=forecastEvents.filter(e=>e.id!==id);setForecastEvents(u);StorageService.saveForecast(u)}}/>}
   {activeTab==='history'&&<HistoryView plan={planBaseline} current={currentShift} history={history} events={events}/>} 
   {activeTab==='print'&&<div><div className="no-print mb-4 flex flex-wrap justify-between gap-3 bg-white p-4 rounded border"><span className="text-sm">Portrait daily assignment sheet: AM shift on top, AM/PM on-call coverage in the middle, PM shift on the bottom. Saved Next Shift Plan is included automatically.</span><div className="flex flex-wrap gap-2"><button onClick={downloadExcel} className="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5"><Download className="w-4 h-4"/>Download Excel</button><button onClick={()=>window.print()} className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5"><Printer className="w-4 h-4"/>Print Daily Assignment Sheet</button></div></div><PrintSheet date={currentShift.date} shiftType={currentShift.shiftType} roster={currentShift.roster} rooms={currentShift.rooms} onCall={currentShift.onCall} previousShift={previousShift} nextShift={planBaseline?{date:planBaseline.date,shiftType:planBaseline.shiftType,roster:planBaseline.roster,rooms:planBaseline.rooms,onCall:planBaseline.onCall,pmOnCall:planBaseline.pmOnCall}:null}/></div>}
  </main>
 </div>;
};
