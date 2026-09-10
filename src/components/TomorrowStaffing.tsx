import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, Play, Save, Sparkles } from 'lucide-react';
import { AssignmentWarning, CurrentShiftState, NurseStaff, OnCallProviders, PatientRoom, MTCoverageState, PCTCoverageState } from '../types';
import { runRecommendationEngine } from '../services/recommendationEngine';
import { postProcessRecommendation } from '../services/recommendationPostProcessor';
import { StorageService } from '../services/storage';
import { FloorPlanCurrentStaffing } from './FloorPlanCurrentStaffing';
import { RecommendationOption, RecommendationOptions } from './RecommendationOptions';

interface Props {
  date: string; shiftType: 'Day'|'Night'; roster: NurseStaff[]; rooms: PatientRoom[]; mtState: MTCoverageState; pctState: PCTCoverageState; onCall: OnCallProviders;
  onDateChange: (value:string)=>void; onShiftTypeChange: (value:'Day'|'Night')=>void; onRosterChange: (value:NurseStaff[])=>void; onRoomsChange: (value:PatientRoom[])=>void;
  onMtStateChange: (value:MTCoverageState)=>void; onPctStateChange: (value:PCTCoverageState)=>void; onSaveBaseline: ()=>void;
}

export const TomorrowStaffing:React.FC<Props>=({date,shiftType,roster,rooms,mtState,pctState,onCall,onDateChange,onShiftTypeChange,onRosterChange,onRoomsChange,onMtStateChange,onPctStateChange,onSaveBaseline})=>{
  const [warnings,setWarnings]=useState<AssignmentWarning[]>([]);
  const [unassigned,setUnassigned]=useState<string[]>([]);
  const [fitLabel,setFitLabel]=useState('NOT RUN');
  const [recommendationOptions,setRecommendationOptions]=useState<RecommendationOption[]>([]);
  const [semiAutoActive,setSemiAutoActive]=useState(false);
  const [recallMessage,setRecallMessage]=useState('');
  const [recalledRooms,setRecalledRooms]=useState<Set<string>>(new Set());
  const [manualRooms,setManualRooms]=useState<Set<string>>(new Set());

  const census=rooms.filter(r=>r.isOccupied).length;
  const activeRNs=roster.filter(s=>['RN','Preceptor'].includes(s.role)&&['ACTIVE','RECALLED'].includes(s.staffStatus)).length;
  const reserve=roster.filter(s=>['ON_CALL','FLEXED'].includes(s.staffStatus)).length;
  const rosterNames=Object.fromEntries(roster.map(s=>[s.id,s.name]));

  // Only rooms the CN explicitly touched are hard-fixed in Semi-Auto.
  // Auto-generated or recalled continuity assignments are not closed loads.
  const fixedAssignments=Object.fromEntries(
    rooms.filter(r=>r.isOccupied&&r.assignedNurseId&&manualRooms.has(r.roomNumber))
      .map(r=>[r.roomNumber,r.assignedNurseId as string])
  );
  const fixedRoomNumbers=Object.keys(fixedAssignments);
  const recalledCount=[...recalledRooms].filter(roomNumber=>rooms.some(r=>r.roomNumber===roomNumber&&r.isOccupied&&r.assignedNurseId)).length;
  const semiAutoReadyCount=fixedRoomNumbers.length+recalledCount;

  const pseudoShift:CurrentShiftState=useMemo(()=>({date,shiftType,roster,rooms,mtState,pctState,onCall,lastUpdatedAt:new Date().toISOString()}),[date,shiftType,roster,rooms,mtState,pctState,onCall]);

  const updateRoom=(updated:PatientRoom)=>onRoomsChange(rooms.map(r=>r.roomNumber===updated.roomNumber?updated:r));
  const assignRoom=(roomNumber:string,nurseId:string|null)=>{
    // Any direct board edit is an explicit CN decision and therefore becomes hard-fixed.
    setRecalledRooms(prev=>{const next=new Set(prev);next.delete(roomNumber);return next;});
    setManualRooms(prev=>{const next=new Set(prev);if(nurseId)next.add(roomNumber);else next.delete(roomNumber);return next;});
    onRoomsChange(rooms.map(r=>r.roomNumber===roomNumber?{...r,assignedNurseId:nurseId}:r));
  };
  const updateStatus=(staff:NurseStaff,status:NurseStaff['staffStatus'])=>onRosterChange(roster.map(s=>s.id===staff.id?{...s,staffStatus:status}:s));
  const resetRecallContext=()=>{setRecalledRooms(new Set());setManualRooms(new Set());setRecallMessage('');setRecommendationOptions([]);};

  const recallPreviousAssignments=()=>{
    let recalled=0,missingToken=0,noMatch=0,manualPreserved=0;
    const recalledNow=new Set<string>();

    // Recall is intentionally a fresh continuity rebuild. This lets the CN try Full Auto first,
    // dislike it, then press Recall Previous and get the prior patient/nurse relationships back.
    // Only rooms explicitly assigned by the CN are preserved; generated plan assignments are replaced.
    const next=rooms.map(room=>{
      if(!room.isOccupied) return {...room,assignedNurseId:null};
      if(manualRooms.has(room.roomNumber) && room.assignedNurseId){manualPreserved+=1;return room;}
      if(!room.patientStayId){missingToken+=1;return {...room,assignedNurseId:null};}
      const continuity=StorageService.findContinuity(room.patientStayId,roster,date,shiftType);
      if(!continuity){noMatch+=1;return {...room,assignedNurseId:null};}
      recalled+=1;recalledNow.add(room.roomNumber);
      return {...room,assignedNurseId:continuity.nurseId};
    });

    setRecalledRooms(recalledNow);
    onRoomsChange(next);
    const message=recalled
      ? `Recalled ${recalled} previous assignment${recalled===1?'':'s'} from the most recent eligible prior shift. Auto-generated plan assignments were replaced; ${manualPreserved} CN-manual assignment${manualPreserved===1?' was':'s were'} preserved.`
      : `No previous assignments recalled — ${missingToken} missing Stay Token • ${noMatch} no active prior-nurse match • ${manualPreserved} CN-manual assignment${manualPreserved===1?'':'s'} preserved.`;
    setRecallMessage(message);
    setFitLabel(recalled?`RECALLED ${recalled} PREVIOUS`:'NO PRIOR MATCHES');
    setRecommendationOptions([]);
  };

  const recommend=(strategy:'BALANCED'|'CONSERVE_SKILL_MIX'|'CAPACITY_EXCEPTION',charge:boolean,quad:boolean,fixed:Record<string,string>={})=>postProcessRecommendation(runRecommendationEngine(roster,rooms,charge,quad,strategy,fixed),roster,rooms,Object.keys(fixed));

  const generate=(semiAuto=false)=>{
    const fixed=semiAuto?fixedAssignments:{};
    const balanced=recommend('BALANCED',false,false,fixed);
    const conserve=recommend('CONSERVE_SKILL_MIX',false,false,fixed);
    const capacityNormal=recommend('CAPACITY_EXCEPTION',false,false,fixed);
    const capacity=capacityNormal.unassignedRooms.length===0?capacityNormal:recommend('CAPACITY_EXCEPTION',true,true,fixed);
    const prefix=semiAuto?`${recalledCount?`${recalledCount} continuity anchor${recalledCount===1?'':'s'} + `:''}${fixedRoomNumbers.length?`${fixedRoomNumbers.length} CN-fixed room${fixedRoomNumbers.length===1?'':'s'}; `:''}`:'';
    setRecommendationOptions([
      {id:'BALANCED',title:'Balanced / Spread ICU',subtitle:`${prefix}prioritizes continuity, then spreads ICU workload and pairs ICU with lower-acuity patients when appropriate.`,result:balanced},
      {id:'CONSERVE_SKILL_MIX',title:'Preserve Critical-Care Skill Mix',subtitle:`${prefix}prioritizes continuity, then may pair ICU patients when needed to preserve another ICU/CVICU-capable RN.`,result:conserve},
      {id:'CAPACITY_EXCEPTION',title:'Capacity Exception',subtitle:capacityNormal.unassignedRooms.length===0?`${prefix}continuity and normal staffing cover planned census without Charge-patient or TELE-quad exceptions.`:`${prefix}normal staffing leaves uncovered demand; this option may use one TELE patient for Charge and/or a TELE quad. CN approval remains required.`,result:capacity},
    ]);
    setSemiAutoActive(semiAuto);
    setFitLabel(semiAuto?`SEMI-AUTO • ${recalledCount} CONTINUITY • ${fixedRoomNumbers.length} CN FIXED`:'3 OPTIONS');
    setWarnings([]);setUnassigned([]);
  };

  const applyOption=(option:RecommendationOption)=>{
    const result=option.result;
    onRoomsChange(rooms.map(r=>({...r,assignedNurseId:result.assignments[r.roomNumber]||null})));
    setWarnings(result.warnings);setUnassigned(result.unassignedRooms);setFitLabel(result.fitLabel);setRecommendationOptions([]);setSemiAutoActive(false);
    if(!semiAutoActive){setManualRooms(new Set());setRecalledRooms(new Set());}
  };

  return <div className="space-y-5">
    <div className="bg-slate-900 text-white rounded-xl p-4"><div className="flex flex-wrap justify-between gap-4"><div><div className="flex items-center gap-2"><CalendarDays className="w-4 h-4 text-blue-300"/><span className="text-xs uppercase font-black text-slate-300">Next Shift Plan</span></div><div className="text-xl font-black mt-1">{date} • {shiftType} Shift</div><div className="text-xs text-slate-400 mt-1">Auto first. If the CN wants more control: Recall Previous → adjust sickest/special cases → Semi-Auto Fill Rest.</div></div><div className="flex flex-wrap gap-2 text-xs"><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Planned Census <b>{census}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Active bedside RNs <b>{activeRNs}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Reserve <b>{reserve}</b></div><div className="bg-slate-800 border border-slate-700 rounded px-3 py-2">Recommendation <b>{fitLabel}</b></div></div></div></div>

    <div className="bg-white rounded-xl border p-4 flex flex-wrap justify-between gap-3 items-end"><div className="flex flex-wrap gap-3 items-end"><div><label className="text-[10px] uppercase font-black text-slate-500 block">Next Shift Date</label><input type="date" value={date} onChange={e=>{onDateChange(e.target.value);resetRecallContext();}} className="border rounded-lg px-3 py-2 text-xs"/></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">Shift</label><select value={shiftType} onChange={e=>{onShiftTypeChange(e.target.value as 'Day'|'Night');resetRecallContext();}} className="border rounded-lg px-3 py-2 text-xs"><option value="Day">Day</option><option value="Night">Night</option></select></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">MT Coverage</label><select value={mtState} onChange={e=>onMtStateChange(e.target.value as MTCoverageState)} className="border rounded-lg px-3 py-2 text-xs"><option value="MT_PRESENT">MT Present</option><option value="RN_COVERING_MT">RN Covering MT</option><option value="MT_UNFILLED">MT Unfilled</option></select></div><div><label className="text-[10px] uppercase font-black text-slate-500 block">PCT Support</label><select value={pctState} onChange={e=>onPctStateChange(e.target.value as PCTCoverageState)} className="border rounded-lg px-3 py-2 text-xs"><option value="PCT_PRESENT">PCT Present</option><option value="PCT_NONE">No PCT</option></select></div></div><div className="flex flex-wrap gap-2"><button onClick={()=>generate(false)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-black flex gap-1"><Play className="w-3.5 h-3.5"/>Generate 3 Options</button><button disabled={semiAutoReadyCount===0} onClick={()=>generate(true)} className="bg-indigo-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg text-xs font-black flex gap-1"><Sparkles className="w-3.5 h-3.5"/>Semi-Auto Fill Rest{semiAutoReadyCount?` (${recalledCount} continuity / ${fixedRoomNumbers.length} fixed)`:''}</button><button onClick={onSaveBaseline} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-bold flex gap-1"><Save className="w-3.5 h-3.5"/>Save Baseline</button></div></div>

    {recallMessage&&<div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs text-emerald-900">{recallMessage}</div>}
    {semiAutoReadyCount>0&&<div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3 text-xs text-indigo-900"><b>Semi-Auto ready:</b> recalled patients are continuity anchors; those nurses may still receive another appropriate patient. Any room you directly assign on the board is a CN-fixed load.</div>}
    <RecommendationOptions options={recommendationOptions} rosterNames={rosterNames} onApply={applyOption}/>
    {unassigned.length>0&&<div className="bg-rose-50 border border-rose-300 text-rose-900 rounded-xl p-3 flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5"/><div><b className="text-sm">Recommendation needs CN review for {unassigned.join(', ')}.</b></div></div>}
    <FloorPlanCurrentStaffing currentShift={pseudoShift} onRoomChange={updateRoom} onAssignRoom={assignRoom} onStaffStatusChange={updateStatus} onRecallPrevious={recallPreviousAssignments}/>
  </div>;
};
