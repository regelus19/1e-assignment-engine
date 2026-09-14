import React, { useEffect, useMemo, useState } from 'react';
import { AssignmentWarning, CurrentShiftState, FinalizedShiftSnapshot, ForecastEvent, NurseStaff, OperationalEvent, PatientRoom, PlanBaseline, PlanningWorkspace } from './types';
import { StorageService } from './services/storage';
import { operationalRepository } from './services/repository';
import { downloadDailyStaffingExcel } from './services/excelExport';
import { MRS_CONFIG, getMRSStatus } from './config/mrs';
import { PrintSheet } from './components/PrintSheet';
import { NextShiftForecast } from './components/NextShiftForecast';
import { RosterPlanner } from './components/RosterPlanner';
import { CurrentStaffing } from './components/CurrentStaffing';
import { TomorrowStaffing } from './components/TomorrowStaffing';
import { HistoryView } from './components/HistoryView';
import { CalendarDays, Clock3, Download, History, Printer, RotateCcw, Settings2 } from 'lucide-react';

const UNIT_ID='1E';
const tomorrowIso=()=>{const d=new Date();d.setDate(d.getDate()+1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
type Tab='current'|'plan'|'forecast'|'history'|'print';

const nextShiftIdentity=(current:CurrentShiftState)=>{
  if(current.shiftType==='Day') return {date:current.date,shiftType:'Night' as const};
  const d=new Date(`${current.date}T12:00:00`);d.setDate(d.getDate()+1);
  return {date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,shiftType:'Day' as const};
};

export const App:React.FC=()=>{
 const[activeTab,setActiveTab]=useState<Tab>('current'),[planningWorkspace,setPlanningWorkspace]=useState<PlanningWorkspace|null>(null),[forecastEvents,setForecastEvents]=useState<ForecastEvent[]>(()=>StorageService.loadForecast()),[warnings,setWarnings]=useState<AssignmentWarning[]>([]),[fitScore]=useState(100),[currentShift,setCurrentShift]=useState<CurrentShiftState|null>(null),[events,setEvents]=useState<OperationalEvent[]>([]),[planBaseline,setPlanBaseline]=useState<PlanBaseline|null>(()=>StorageService.loadPlanBaseline()),[history,setHistory]=useState<FinalizedShiftSnapshot[]>([]);

 const loadOperationalState=async()=>{
   const live=await operationalRepository.loadCurrentShift(UNIT_ID);
   const plan=await operationalRepository.loadPlanningWorkspace(UNIT_ID,tomorrowIso(),'Day');
   const [historyResult,eventResult]=await Promise.all([
     operationalRepository.loadHistory(UNIT_ID),
     operationalRepository.loadOperationalEvents(UNIT_ID,live.data.date,live.data.shiftType),
   ]);
   return {live:live.data,plan:plan.data,history:historyResult.data,events:eventResult.data};
 };

 useEffect(()=>{
   let active=true;
   void loadOperationalState().then(state=>{
     if(!active)return;
     setCurrentShift(state.live);
     setPlanningWorkspace(state.plan);
     setHistory(state.history);
     setEvents(state.events);
   });
   return()=>{active=false;};
 },[]);

 if(!planningWorkspace||!currentShift){
   return <div className="min-h-screen bg-slate-100 flex items-center justify-center text-sm font-bold text-slate-600">Loading 1E assignment workspace…</div>;
 }

 const {targetDate:date,shiftType,mtState,pctState,roster,rooms,onCall,pmOnCall,currentMRS,projectedMRS}=planningWorkspace;
 const updatePlanningWorkspace=(patch:Partial<PlanningWorkspace>)=>setPlanningWorkspace(current=>{
   if(!current)return current;
   const next={...current,...patch,lastUpdatedAt:new Date().toISOString()};
   void operationalRepository.savePlanningWorkspace(next);
   return next;
 });
 const currentStatus=getMRSStatus(currentMRS),projectedStatus=getMRSStatus(projectedMRS),plannedCensus=rooms.filter(r=>r.isOccupied).length,currentCensus=currentShift.rooms.filter(r=>r.isOccupied).length,currentActiveRNs=currentShift.roster.filter(s=>['RN','Preceptor'].includes(s.role)&&['ACTIVE','RECALLED'].includes(s.staffStatus)).length;
 const supportRisk=useMemo(()=>{const a:string[]=[];if(currentShift.mtState==='MT_UNFILLED')a.push('MT unfilled');if(currentShift.mtState==='RN_COVERING_MT')a.push('RN covering MT');if(currentShift.pctState==='PCT_NONE')a.push('No PCT');return a},[currentShift.mtState,currentShift.pctState]);
 const saveRoster=(u:NurseStaff[])=>updatePlanningWorkspace({roster:u});
 const saveRooms=(u:PatientRoom[])=>updatePlanningWorkspace({rooms:u});
 const savePlanBaseline=()=>{const b:PlanBaseline={id:`plan-${Date.now()}`,date,shiftType,finalizedAt:new Date().toISOString(),savedAt:new Date().toISOString(),roster,rooms,onCall,pmOnCall,fitScore,warnings,mtState,pctState,currentMRS,projectedMRS};StorageService.savePlanBaseline(b);setPlanBaseline(b);window.alert('Next Shift Plan saved as baseline, including AM and PM on-call coverage.')};
 const startCurrentFromPlan=()=>{const p=StorageService.loadPlanBaseline();if(!p){window.alert('Save a Next Shift Plan baseline first.');setActiveTab('plan');return}const s:CurrentShiftState={date:p.date,shiftType:p.shiftType,roster:p.roster,rooms:p.rooms,mtState:p.mtState,pctState:p.pctState,onCall:p.onCall,lastUpdatedAt:new Date().toISOString()};setCurrentShift(s);void operationalRepository.saveCurrentShift(s);const event:OperationalEvent={id:`evt-${Date.now()}`,timestamp:new Date().toISOString(),shiftDate:s.date,shiftType:s.shiftType,type:'SHIFT_STARTED',summary:'Current staffing initialized from saved plan baseline.'};void operationalRepository.appendOperationalEvent(event).then(result=>setEvents(result.data));setActiveTab('current')};
 const openNextShiftPlan=()=>{
   const sourceKey=`${currentShift.date}|${currentShift.shiftType}`;
   const target=nextShiftIdentity(currentShift);
   if(StorageService.loadPlanSource()!==sourceKey){
     const seededRooms=currentShift.rooms.map(r=>({...r,assignedNurseId:null}));
     updatePlanningWorkspace({rooms:seededRooms,targetDate:target.date,shiftType:target.shiftType});
     StorageService.savePlanSource(sourceKey);
   }
   const saved=StorageService.loadPlanBaseline();if(saved?.date===target.date&&saved.pmOnCall)updatePlanningWorkspace({pmOnCall:saved.pmOnCall});
   setActiveTab('plan');
 };
 const reset=()=>{StorageService.resetToDefaults();setPlanningWorkspace(null);setCurrentShift(null);setEvents([]);setHistory([]);setForecastEvents(StorageService.loadForecast());setWarnings([]);setPlanBaseline(StorageService.loadPlanBaseline());setActiveTab('current');void loadOperationalState().then(state=>{setCurrentShift(state.live);setPlanningWorkspace(state.plan);setHistory(state.history);setEvents(state.events);});};
 const refreshHistory=async()=>{const result=await operationalRepository.loadHistory(UNIT_ID);setHistory(result.data);return result.data;};
 const openPrint=()=>{void refreshHistory().then(()=>{setPlanBaseline(StorageService.loadPlanBaseline());setActiveTab('print')});};
 const downloadExcel=()=>{void refreshHistory().then(latestHistory=>{const savedPlan=StorageService.loadPlanBaseline();setPlanBaseline(savedPlan);downloadDailyStaffingExcel(currentShift,latestHistory[0]||null,savedPlan);});};
 const previousShift=history[0]||null;

 return <div className="min-h-screen bg-slate-100 flex flex-col font-sans">
  <header className="bg-slate-900 text-white px-6 py-3 no-print"><div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4"><div><h1 className="font-black text-lg">1E FLOW & ASSIGNMENT BOARD</h1><p className="text-xs text-slate-400">Current operations • next-shift planning • readiness</p></div><div className="flex gap-2 text-xs"><div className="bg-slate-800 px-3 py-1.5 rounded">Current Census <b>{currentCensus}</b></div><div className="bg-slate-800 px-3 py-1.5 rounded">Current Bedside RNs <b>{currentActiveRNs}</b></div><div className="bg-slate-800 px-3 py-1.5 rounded">Next Shift Census <b>{plannedCensus}</b></div>{supportRisk.length>0&&<div className="bg-amber-950 px-3 py-1.5 rounded text-amber-200">{supportRisk.join(' • ')}</div>}</div></div></header>
  <nav className="bg-white border-b px-6 py-2.5 no-print"><div className="max-w-7xl mx-auto flex justify-between"><div className="flex gap-2 flex-wrap"><button onClick={()=>setActiveTab('current')} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex gap-1 ${activeTab==='current'?'bg-emerald-600 text-white':''}`}><Clock3 className="w-3.5"/>Current Staffing</button><button onClick={openNextShiftPlan} className={`px-3 py-1.5 rounded-lg text-xs font-bold flex gap-1 ${activeTab==='plan'?'bg-blue-600 text-white':''}`}><CalendarDays className="w-3.5"/>Next Shift Plan</button><button onClick={()=>setActiveTab('forecast')} className="px-3 py-1.5 text-xs font-bold">Next Shift Readiness</button><button onClick={()=>{void refreshHistory();void operationalRepository.loadOperationalEvents(UNIT_ID,currentShift.date,currentShift.shiftType).then(result=>setEvents(result.data));setActiveTab('history')}} className="px-3 py-1.5 text-xs font-bold flex gap-1"><History className="w-3.5"/>History</button><button onClick={openPrint} className="px-3 py-1.5 text-xs font-bold flex gap-1"><Printer className="w-3.5"/>Print View</button></div><button onClick={reset}><RotateCcw className="w-4"/></button></div></nav>
  <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
   {activeTab==='current'&&<CurrentStaffing currentShift={currentShift} onCurrentShiftChange={setCurrentShift} events={events} onEventsChange={setEvents} onStartFromPlan={startCurrentFromPlan} onOpenPrint={openPrint} onDownloadExcel={downloadExcel}/>} 
   {activeTab==='plan'&&<div className="space-y-5">
     <TomorrowStaffing date={date} shiftType={shiftType} roster={roster} rooms={rooms} mtState={mtState} pctState={pctState} onCall={onCall} sourceShift={currentShift} onDateChange={value=>updatePlanningWorkspace({targetDate:value})} onShiftTypeChange={value=>updatePlanningWorkspace({shiftType:value})} onRosterChange={saveRoster} onRoomsChange={saveRooms} onMtStateChange={value=>updatePlanningWorkspace({mtState:value})} onPctStateChange={value=>updatePlanningWorkspace({pctState:value})} onSaveBaseline={savePlanBaseline}/>
     <details className="bg-white border rounded-xl p-4"><summary className="cursor-pointer flex items-center gap-2 text-xs font-black uppercase"><Settings2 className="w-4 h-4"/>Next Shift Roster / On-Call / MRS Setup</summary><div className="mt-4 space-y-4"><div className="flex flex-wrap gap-4 items-end bg-slate-50 border rounded-lg p-3"><div><label className="text-[10px] font-black uppercase block">Current MRS</label><input type="number" step=".001" value={currentMRS} onChange={e=>updatePlanningWorkspace({currentMRS:Number(e.target.value)})} className="w-28 border rounded px-3 py-2"/> <span className="text-xs">{currentStatus.color}</span></div><div><label className="text-[10px] font-black uppercase block">Projected MRS</label><input type="number" step=".001" value={projectedMRS} onChange={e=>updatePlanningWorkspace({projectedMRS:Number(e.target.value)})} className="w-28 border rounded px-3 py-2"/> <span className="text-xs">{projectedStatus.color}</span></div></div><RosterPlanner roster={roster} mtState={mtState} pctState={pctState} onRosterChange={saveRoster} onMtStateChange={value=>updatePlanningWorkspace({mtState:value})} onPctStateChange={value=>updatePlanningWorkspace({pctState:value})} onCall={onCall} pmOnCall={pmOnCall} onOnCallChange={value=>updatePlanningWorkspace({onCall:value})} onPmOnCallChange={value=>updatePlanningWorkspace({pmOnCall:value})}/></div></details>
   </div>}
   {activeTab==='forecast'&&<NextShiftForecast events={forecastEvents} roster={roster} rooms={rooms} mtState={mtState} pctState={pctState} onAddEvent={e=>{const u=[...forecastEvents,e];setForecastEvents(u);StorageService.saveForecast(u)}} onDeleteEvent={id=>{const u=forecastEvents.filter(e=>e.id!==id);setForecastEvents(u);StorageService.saveForecast(u)}}/>}
   {activeTab==='history'&&<HistoryView plan={planBaseline} current={currentShift} history={history} events={events}/>} 
   {activeTab==='print'&&<div><div className="no-print mb-4 flex flex-wrap justify-between gap-3 bg-white p-4 rounded border"><span className="text-sm">Portrait daily assignment sheet: AM shift on top, AM/PM on-call coverage in the middle, PM shift on the bottom. Saved Next Shift Plan is included automatically.</span><div className="flex flex-wrap gap-2"><button onClick={downloadExcel} className="bg-emerald-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5"><Download className="w-4 h-4"/>Download Excel</button><button onClick={()=>window.print()} className="bg-blue-600 text-white px-4 py-2 rounded text-xs font-bold flex items-center gap-1.5"><Printer className="w-4 h-4"/>Print Daily Assignment Sheet</button></div></div><PrintSheet date={currentShift.date} shiftType={currentShift.shiftType} roster={currentShift.roster} rooms={currentShift.rooms} onCall={currentShift.onCall} previousShift={previousShift} nextShift={planBaseline?{date:planBaseline.date,shiftType:planBaseline.shiftType,roster:planBaseline.roster,rooms:planBaseline.rooms,onCall:planBaseline.onCall,pmOnCall:planBaseline.pmOnCall}:null}/></div>}
  </main>
 </div>;
};