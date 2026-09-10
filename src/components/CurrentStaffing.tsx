import React, { useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Play, RefreshCw, Save, Settings2, Sparkles } from 'lucide-react';
import { AssignmentWarning, CurrentShiftState, NurseStaff, OperationalEvent, PatientRoom, StaffStatus } from '../types';
import { runRecommendationEngine } from '../services/recommendationEngine';
import { postProcessRecommendation } from '../services/recommendationPostProcessor';
import { StorageService } from '../services/storage';
import { CurrentRosterPanel } from './CurrentRosterPanel';
import { FloorPlanCurrentStaffing } from './FloorPlanCurrentStaffing';
import { OperationalSnapshot } from './OperationalSnapshot';
import { RecommendationOption, RecommendationOptions } from './RecommendationOptions';

interface Props { currentShift:CurrentShiftState; onCurrentShiftChange:(state:CurrentShiftState)=>void; events:OperationalEvent[]; onEventsChange:(events:OperationalEvent[])=>void; onStartFromPlan:()=>void; }
const fmtTime=(iso:string)=>new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

export const CurrentStaffing:React.FC<Props>=({currentShift,onCurrentShiftChange,events,onEventsChange,onStartFromPlan})=>{
 const [warnings,setWarnings]=useState<AssignmentWarning[]>([]),[unassigned,setUnassigned]=useState<string[]>([]),[fitLabel,setFitLabel]=useState('NOT RUN'),[showRoster,setShowRoster]=useState(false),[recommendationOptions,setRecommendationOptions]=useState<RecommendationOption[]>([]),[semiAutoActive,setSemiAutoActive]=useState(false);
 const census=currentShift.rooms.filter(r=>r.isOccupied).length;
 const activeRNs=currentShift.roster.filter(s=>['RN','Preceptor'].includes(s.role)&&['ACTIVE','RECALLED'].includes(s.staffStatus)).length;
 const reserve=currentShift.roster.filter(s=>['ON_CALL','FLEXED'].includes(s.staffStatus)).length;
 const rosterNames=Object.fromEntries(currentShift.roster.map(s=>[s.id,s.name]));
 const fixedAssignments=Object.fromEntries(currentShift.rooms.filter(r=>r.isOccupied&&r.assignedNurseId).map(r=>[r.roomNumber,r.assignedNurseId as string]));
 const fixedRoomNumbers=Object.keys(fixedAssignments);

 const appendEvent=(e:OperationalEvent)=>{StorageService.appendOperationalEvent(e);onEventsChange(StorageService.loadOperationalEvents());};
 const saveState=(next:CurrentShiftState)=>{const stamped={...next,lastUpdatedAt:new Date().toISOString()};StorageService.saveCurrentShift(stamped);onCurrentShiftChange(stamped);};
 const updateRoster=(roster:NurseStaff[])=>{const ids=new Set(roster.map(s=>s.id));saveState({...currentShift,roster,rooms:currentShift.rooms.map(r=>r.assignedNurseId&&!ids.has(r.assignedNurseId)?{...r,assignedNurseId:null}:r)});};
 const updateRoom=(updated:PatientRoom)=>{const before=currentShift.rooms.find(r=>r.roomNumber===updated.roomNumber);saveState({...currentShift,rooms:currentShift.rooms.map(r=>r.roomNumber===updated.roomNumber?updated:r)});if(before&&before.acuity!==updated.acuity)appendEvent({id:`evt-${Date.now()}-acuity`,timestamp:new Date().toISOString(),shiftDate:currentShift.date,shiftType:currentShift.shiftType,type:'ACUITY_CHANGE',roomNumber:updated.roomNumber,summary:`Room ${updated.roomNumber} acuity changed ${before.acuity} → ${updated.acuity}.`});if(before&&before.flags.join('|')!==updated.flags.join('|'))appendEvent({id:`evt-${Date.now()}-flags`,timestamp:new Date().toISOString(),shiftDate:currentShift.date,shiftType:currentShift.shiftType,type:'ROOM_FLAGS_CHANGE',roomNumber:updated.roomNumber,summary:`Room ${updated.roomNumber} flags updated: ${updated.flags.join(', ')||'none'}.`});};
 const assignRoom=(roomNumber:string,nurseId:string|null)=>{saveState({...currentShift,rooms:currentShift.rooms.map(r=>r.roomNumber===roomNumber?{...r,assignedNurseId:nurseId}:r)});appendEvent({id:`evt-${Date.now()}`,timestamp:new Date().toISOString(),shiftDate:currentShift.date,shiftType:currentShift.shiftType,type:'ASSIGNMENT_CHANGE',roomNumber,summary:`Room ${roomNumber} ${nurseId?'assigned':'unassigned'}.`});};
 const updateStatus=(staff:NurseStaff,status:StaffStatus)=>saveState({...currentShift,roster:currentShift.roster.map(s=>s.id===staff.id?{...s,staffStatus:status}:s)});
 const updateSupport=(kind:'MT'|'PCT',value:string)=>saveState(kind==='MT'?{...currentShift,mtState:value as CurrentShiftState['mtState']}:{...currentShift,pctState:value as CurrentShiftState['pctState']});
 const recommend=(strategy:'BALANCED'|'CONSERVE_SKILL_MIX'|'CAPACITY_EXCEPTION',charge:boolean,quad:boolean,fixed:Record<string,string>={})=>postProcessRecommendation(runRecommendationEngine(currentShift.roster,currentShift.rooms,charge,quad,strategy,fixed),currentShift.roster,currentShift.rooms,Object.keys(fixed));

 const generate=(semiAuto=false)=>{
   const fixed=semiAuto?fixedAssignments:{};
   const balanced=recommend('BALANCED',false,false,fixed);
   const conserve=recommend('CONSERVE_SKILL_MIX',false,false,fixed);
   const capacityNormal=recommend('CAPACITY_EXCEPTION',false,false,fixed);
   const capacity=capacityNormal.unassignedRooms.length===0?capacityNormal:recommend('CAPACITY_EXCEPTION',true,true,fixed);
   const prefix=semiAuto&&fixedRoomNumbers.length?`Keeps ${fixedRoomNumbers.length} CN-set room${fixedRoomNumbers.length===1?'':'s'} fixed, then `:'';
   const options:RecommendationOption[]=[
     {id:'BALANCED',title:'Balanced / Spread ICU',subtitle:`${prefix}spreads ICU workload when skill mix allows and pairs ICU with lower-acuity patients when appropriate.`,result:balanced},
     {id:'CONSERVE_SKILL_MIX',title:'Preserve Critical-Care Skill Mix',subtitle:`${prefix}is more willing to pair two ICU patients on one qualified RN so another ICU/CVICU-capable RN remains available.`,result:conserve},
     {id:'CAPACITY_EXCEPTION',title:'Capacity Exception',subtitle:capacityNormal.unassignedRooms.length===0?`${prefix}normal staffing covers current census, so no Charge-patient or TELE-quad exception is used.`:`${prefix}normal staffing leaves uncovered demand; this option may use one TELE patient for Charge and/or a TELE quad. CN approval remains required.`,result:capacity},
   ];
   setRecommendationOptions(options);
   setSemiAutoActive(semiAuto);
   setFitLabel(semiAuto?`SEMI-AUTO • ${fixedRoomNumbers.length} FIXED`:'3 OPTIONS');
   setWarnings([]);
   setUnassigned([]);
 };

 const applyOption=(option:RecommendationOption)=>{
   const result=option.result;
   saveState({...currentShift,rooms:currentShift.rooms.map(r=>({...r,assignedNurseId:result.assignments[r.roomNumber]||null}))});
   setWarnings(result.warnings);setUnassigned(result.unassignedRooms);setFitLabel(result.fitLabel);setRecommendationOptions([]);
   appendEvent({id:`evt-${Date.now()}-option`,timestamp:new Date().toISOString(),shiftDate:currentShift.date,shiftType:currentShift.shiftType,type:'RECOMMENDATION_GENERATED',summary:`Applied ${semiAutoActive?'Semi-Auto ':''}${option.title} recommendation: ${result.fitLabel}; ${result.unassignedRooms.length} unassigned room(s).${semiAutoActive?` Preserved ${fixedRoomNumbers.length} CN-set room(s).`:''}`});
   setSemiAutoActive(false);
 };

 const snapshot=()=>StorageService.saveFinalizedShift({id:`actual-${Date.now()}`,date:currentShift.date,shiftType:currentShift.shiftType,finalizedAt:new Date().toISOString(),roster:currentShift.roster,rooms:currentShift.rooms,onCall:currentShift.onCall,fitScore:unassigned.length?Math.max(10,100-unassigned.length*15):100,warnings,mtState:currentShift.mtState,pctState:currentShift.pctState,currentMRS:0,projectedMRS:0});
 const shiftEvents=useMemo(()=>events.filter(e=>e.shiftDate===currentShift.date&&e.shiftType===currentShift.shiftType).slice(0,12),[events,currentShift.date,currentShift.shiftType]);

 return <div className="space-y-5"><OperationalSnapshot currentCensus={census} rooms={currentShift.rooms} capacity={22}/>
  <div className="bg-slate-900 text-white rounded-xl p-4"><div className="flex flex-wrap justify-between gap-4"><div><div className="flex items-center gap-2"><Clock3 className="w-4 h-4 text-emerald-300"/><span className="text-xs uppercase font-black text-slate-300">Live Current Staffing</span></div><div className="text-xl font-black mt-1">{currentShift.date} • {currentShift.shiftType} Shift</div><div className="text-xs text-slate-400 mt-1">Last updated {fmtTime(currentShift.lastUpdatedAt)}</div></div><div className="flex flex-wrap gap-2 text-xs"><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Census <b>{census}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Active bedside RNs <b>{activeRNs}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Reserve <b>{reserve}</b></div><div className={`rounded px-3 py-2 border ${currentShift.clinicalSupervisorPresent?'bg-emerald-950 border-emerald-700 text-emerald-200':'bg-slate-800 border-slate-700 text-slate-300'}`}>Clinical Supervisor <b>{currentShift.clinicalSupervisorPresent?'PRESENT':'NOT PRESENT'}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Auto Recommendation <b>{fitLabel}</b></div></div></div></div>
  <div className="bg-white rounded-xl border p-4 flex flex-wrap justify-between gap-3 items-end"><div className="flex flex-wrap gap-3 items-end"><div><label className="text-[10px] uppercase font-black text-slate-500 block">MT Coverage</label><select value={currentShift.mtState} onChange={e=>updateSupport('MT',e.target.value)} className="border rounded-lg px-3 py-2 text-xs"><option value="MT_PRESENT">MT Present</option><option value="RN_COVERING_MT">RN Covering MT</option><option value="MT_UNFILLED">MT Unfilled</option></select></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">PCT Support</label><select value={currentShift.pctState} onChange={e=>updateSupport('PCT',e.target.value)} className="border rounded-lg px-3 py-2 text-xs"><option value="PCT_PRESENT">PCT Present</option><option value="PCT_NONE">No PCT</option></select></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">Clinical Supervisor</label><select value={currentShift.clinicalSupervisorPresent?'PRESENT':'NOT_PRESENT'} onChange={e=>saveState({...currentShift,clinicalSupervisorPresent:e.target.value==='PRESENT'})} className="border rounded-lg px-3 py-2 text-xs"><option value="PRESENT">Present</option><option value="NOT_PRESENT">Not Present</option></select></div><button onClick={()=>setShowRoster(v=>!v)} className="px-3 py-2 rounded-lg border text-xs font-bold flex gap-1"><Settings2 className="w-3.5 h-3.5"/> {showRoster?'Hide':'Edit'} Current Roster</button><button onClick={onStartFromPlan} className="px-3 py-2 rounded-lg border text-xs font-bold flex gap-1"><RefreshCw className="w-3.5 h-3.5"/>Reset from Saved Plan</button></div><div className="flex flex-wrap gap-2"><button onClick={()=>generate(false)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-black flex gap-1"><Play className="w-3.5 h-3.5"/>Generate 3 Options</button><button disabled={fixedRoomNumbers.length===0} onClick={()=>generate(true)} className="bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-black flex gap-1" title={fixedRoomNumbers.length?`Keep ${fixedRoomNumbers.length} current room assignment(s) fixed and auto-fill the rest`:'Assign one or more rooms on the Live Assignment Board first'}><Sparkles className="w-3.5 h-3.5"/>Semi-Auto Fill Rest{fixedRoomNumbers.length?` (${fixedRoomNumbers.length} fixed)`:''}</button><button onClick={snapshot} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex gap-1"><Save className="w-3.5 h-3.5"/>Snapshot</button></div></div>
  {fixedRoomNumbers.length>0&&<div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-xs text-indigo-900"><b>Semi-Auto ready:</b> the {fixedRoomNumbers.length} room{fixedRoomNumbers.length===1?'':'s'} currently assigned on the Live Assignment Board can be treated as CN-fixed anchors. Click <b>Semi-Auto Fill Rest</b> to keep them and let the engine assign everyone else. Previous-nurse continuity is still checked and any CN override is shown as an advisory.</div>}
  {showRoster&&<CurrentRosterPanel roster={currentShift.roster} onRosterChange={updateRoster}/>} 
  <RecommendationOptions options={recommendationOptions} rosterNames={rosterNames} onApply={applyOption}/>
  {unassigned.length>0&&<div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/><div><b className="text-sm">Auto-assignment needs CN review for {unassigned.join(', ')}.</b><div className="text-xs mt-1">Use the Live Assignment Board below to correct the selected recommendation manually. Unassigned rooms remain highlighted.</div></div></div>}
  <FloorPlanCurrentStaffing currentShift={currentShift} onRoomChange={updateRoom} onAssignRoom={assignRoom} onStaffStatusChange={updateStatus}/>
  <details className="bg-white rounded-xl border p-4"><summary className="font-black text-xs uppercase cursor-pointer">Midshift Operational Event Log</summary><div className="mt-3 space-y-2">{shiftEvents.map(e=><div key={e.id} className="text-xs border-b pb-2"><span className="font-mono text-slate-500 mr-3">{fmtTime(e.timestamp)}</span>{e.summary}</div>)}</div></details>
 </div>;
};