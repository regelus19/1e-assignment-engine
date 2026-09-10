import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Play, Save, Sparkles } from 'lucide-react';
import { AssignmentWarning, CurrentShiftState, NurseStaff, OnCallProviders, PatientRoom, MTCoverageState, PCTCoverageState } from '../types';
import { runRecommendationEngine } from '../services/recommendationEngine';
import { postProcessRecommendation } from '../services/recommendationPostProcessor';
import { StorageService } from '../services/storage';
import { FloorPlanCurrentStaffing } from './FloorPlanCurrentStaffing';
import { RecommendationOption, RecommendationOptions } from './RecommendationOptions';

interface Props {
  date: string;
  shiftType: 'Day'|'Night';
  roster: NurseStaff[];
  rooms: PatientRoom[];
  mtState: MTCoverageState;
  pctState: PCTCoverageState;
  onCall: OnCallProviders;
  onDateChange: (value:string)=>void;
  onShiftTypeChange: (value:'Day'|'Night')=>void;
  onRosterChange: (value:NurseStaff[])=>void;
  onRoomsChange: (value:PatientRoom[])=>void;
  onMtStateChange: (value:MTCoverageState)=>void;
  onPctStateChange: (value:PCTCoverageState)=>void;
  onSaveBaseline: ()=>void;
}

export const TomorrowStaffing:React.FC<Props>=({date,shiftType,roster,rooms,mtState,pctState,onCall,onDateChange,onShiftTypeChange,onRosterChange,onRoomsChange,onMtStateChange,onPctStateChange,onSaveBaseline})=>{
  const [warnings,setWarnings]=useState<AssignmentWarning[]>([]);
  const [unassigned,setUnassigned]=useState<string[]>([]);
  const [fitLabel,setFitLabel]=useState('NOT RUN');
  const [recommendationOptions,setRecommendationOptions]=useState<RecommendationOption[]>([]);
  const [semiAutoActive,setSemiAutoActive]=useState(false);
  const [recallMessage,setRecallMessage]=useState('');

  const census=rooms.filter(r=>r.isOccupied).length;
  const activeRNs=roster.filter(s=>['RN','Preceptor'].includes(s.role)&&['ACTIVE','RECALLED'].includes(s.staffStatus)).length;
  const reserve=roster.filter(s=>['ON_CALL','FLEXED'].includes(s.staffStatus)).length;
  const rosterNames=Object.fromEntries(roster.map(s=>[s.id,s.name]));
  const fixedAssignments=Object.fromEntries(rooms.filter(r=>r.isOccupied&&r.assignedNurseId).map(r=>[r.roomNumber,r.assignedNurseId as string]));
  const fixedRoomNumbers=Object.keys(fixedAssignments);

  const pseudoShift:CurrentShiftState=useMemo(()=>({date,shiftType,roster,rooms,mtState,pctState,onCall,lastUpdatedAt:new Date().toISOString()}),[date,shiftType,roster,rooms,mtState,pctState,onCall]);

  const updateRoom=(updated:PatientRoom)=>onRoomsChange(rooms.map(r=>r.roomNumber===updated.roomNumber?updated:r));
  const assignRoom=(roomNumber:string,nurseId:string|null)=>onRoomsChange(rooms.map(r=>r.roomNumber===roomNumber?{...r,assignedNurseId:nurseId}:r));
  const updateStatus=(staff:NurseStaff,status:NurseStaff['staffStatus'])=>onRosterChange(roster.map(s=>s.id===staff.id?{...s,staffStatus:status}:s));

  const recallPreviousAssignments=()=>{
    let recalled=0,missingToken=0,noMatch=0,alreadyAssigned=0;
    const next=rooms.map(room=>{
      if(!room.isOccupied) return room;
      if(room.assignedNurseId){alreadyAssigned+=1;return room;}
      if(!room.patientStayId){missingToken+=1;return room;}
      const continuity=StorageService.findContinuity(room.patientStayId,roster);
      if(!continuity){noMatch+=1;return room;}
      recalled+=1;
      return {...room,assignedNurseId:continuity.nurseId};
    });
    onRoomsChange(next);
    const message=recalled
      ? `Recalled ${recalled} previous assignment${recalled===1?'':'s'}. Existing manual assignments were preserved.`
      : `No previous assignments recalled — ${missingToken} missing Stay Token • ${noMatch} no active prior-nurse match • ${alreadyAssigned} already assigned.`;
    setRecallMessage(message);
    setFitLabel(recalled?`RECALLED ${recalled} PREVIOUS`:'NO PRIOR MATCHES');
  };

  const recommend=(strategy:'BALANCED'|'CONSERVE_SKILL_MIX'|'CAPACITY_EXCEPTION',charge:boolean,quad:boolean,fixed:Record<string,string>={})=>postProcessRecommendation(runRecommendationEngine(roster,rooms,charge,quad,strategy,fixed),roster,rooms,Object.keys(fixed));

  const generate=(semiAuto=false)=>{
    const fixed=semiAuto?fixedAssignments:{};
    const balanced=recommend('BALANCED',false,false,fixed);
    const conserve=recommend('CONSERVE_SKILL_MIX',false,false,fixed);
    const capacityNormal=recommend('CAPACITY_EXCEPTION',false,false,fixed);
    const capacity=capacityNormal.unassignedRooms.length===0?capacityNormal:recommend('CAPACITY_EXCEPTION',true,true,fixed);
    const prefix=semiAuto&&fixedRoomNumbers.length?`Keeps ${fixedRoomNumbers.length} CN-set room${fixedRoomNumbers.length===1?'':'s'} fixed, then `:'';
    setRecommendationOptions([
      {id:'BALANCED',title:'Balanced / Spread ICU',subtitle:`${prefix}spreads ICU workload when skill mix allows and pairs ICU with lower-acuity patients when appropriate.`,result:balanced},
      {id:'CONSERVE_SKILL_MIX',title:'Preserve Critical-Care Skill Mix',subtitle:`${prefix}is more willing to pair two ICU patients on one qualified RN so another ICU/CVICU-capable RN remains available.`,result:conserve},
      {id:'CAPACITY_EXCEPTION',title:'Capacity Exception',subtitle:capacityNormal.unassignedRooms.length===0?`${prefix}normal staffing covers planned census, so no Charge-patient or TELE-quad exception is used.`:`${prefix}normal staffing leaves uncovered demand; this option may use one TELE patient for Charge and/or a TELE quad. CN approval remains required.`,result:capacity},
    ]);
    setSemiAutoActive(semiAuto);
    setFitLabel(semiAuto?`SEMI-AUTO • ${fixedRoomNumbers.length} FIXED`:'3 OPTIONS');
    setWarnings([]);setUnassigned([]);
  };

  const applyOption=(option:RecommendationOption)=>{
    const result=option.result;
    onRoomsChange(rooms.map(r=>({...r,assignedNurseId:result.assignments[r.roomNumber]||null})));
    setWarnings(result.warnings);setUnassigned(result.unassignedRooms);setFitLabel(result.fitLabel);setRecommendationOptions([]);setSemiAutoActive(false);
  };

  return <div className="space-y-5">
    <div className="bg-slate-900 text-white rounded-xl p-4"><div className="flex flex-wrap justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-300"/><span className="text-xs uppercase font-black text-slate-300">Tomorrow Plan</span></div><div className="text-xl font-black mt-1">{date} • {shiftType} Shift</div><div className="text-xs text-slate-400 mt-1">Same assignment workflow as Current Staffing; this remains a plan until Save Baseline.</div></div><div className="flex flex-wrap gap-2 text-xs"><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Planned Census <b>{census}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Active bedside RNs <b>{activeRNs}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Reserve <b>{reserve}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Recommendation <b>{fitLabel}</b></div></div></div></div>

    <div className="bg-white rounded-xl border p-4 flex flex-wrap justify-between gap-3 items-end"><div className="flex flex-wrap gap-3 items-end"><div><label className="text-[10px] uppercase font-black text-slate-500 block">Planning Date</label><input type="date" value={date} onChange={e=>{onDateChange(e.target.value);setRecommendationOptions([]);}} className="border rounded-lg px-3 py-2 text-xs"/></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">Shift</label><select value={shiftType} onChange={e=>{onShiftTypeChange(e.target.value as 'Day'|'Night');setRecommendationOptions([]);}} className="border rounded-lg px-3 py-2 text-xs"><option value="Day">Day</option><option value="Night">Night</option></select></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">MT Coverage</label><select value={mtState} onChange={e=>onMtStateChange(e.target.value as MTCoverageState)} className="border rounded-lg px-3 py-2 text-xs"><option value="MT_PRESENT">MT Present</option><option value="RN_COVERING_MT">RN Covering MT</option><option value="MT_UNFILLED">MT Unfilled</option></select></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">PCT Support</label><select value={pctState} onChange={e=>onPctStateChange(e.target.value as PCTCoverageState)} className="border rounded-lg px-3 py-2 text-xs"><option value="PCT_PRESENT">PCT Present</option><option value="PCT_NONE">No PCT</option></select></div></div><div className="flex flex-wrap gap-2"><button onClick={()=>generate(false)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-black flex gap-1"><Play className="w-3.5 h-3.5"/>Generate 3 Options</button><button disabled={fixedRoomNumbers.length===0} onClick={()=>generate(true)} className="bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-black flex gap-1"><Sparkles className="w-3.5 h-3.5"/>Semi-Auto Fill Rest{fixedRoomNumbers.length?` (${fixedRoomNumbers.length} fixed)`:''}</button><button onClick={onSaveBaseline} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex gap-1"><Save className="w-3.5 h-3.5"/>Save Baseline</button></div></div>

    {recallMessage&&<div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-900">{recallMessage}</div>}
    {fixedRoomNumbers.length>0&&<div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-xs text-indigo-900"><b>Semi-Auto ready:</b> current assignments on the board become CN-fixed loads. Recall previous, adjust manually, then fill the rest.</div>}
    <RecommendationOptions options={recommendationOptions} rosterNames={rosterNames} onApply={applyOption}/>
    {unassigned.length>0&&<div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/><div><b className="text-sm">Recommendation needs CN review for {unassigned.join(', ')}.</b></div></div>}
    <FloorPlanCurrentStaffing currentShift={pseudoShift} onRoomChange={updateRoom} onAssignRoom={assignRoom} onStaffStatusChange={updateStatus} onRecallPrevious={recallPreviousAssignments}/>
  </div>;
};
