import React from 'react';
import { CheckCircle2, ShieldAlert, UsersRound } from 'lucide-react';
import { RecommendationResult } from '../types';
import { RecommendationStrategy } from '../services/recommendationEngine';

export interface RecommendationOption {
  id: RecommendationStrategy;
  title: string;
  subtitle: string;
  result: RecommendationResult;
}

interface Props {
  options: RecommendationOption[];
  rosterNames: Record<string, string>;
  onApply: (option: RecommendationOption) => void;
}

const iconFor = (id: RecommendationStrategy) => id === 'BALANCED' ? <UsersRound className="w-4 h-4"/> : id === 'CONSERVE_SKILL_MIX' ? <CheckCircle2 className="w-4 h-4"/> : <ShieldAlert className="w-4 h-4"/>;

export const RecommendationOptions: React.FC<Props> = ({ options, rosterNames, onApply }) => {
  if (!options.length) return null;
  return <section className="bg-white border border-slate-200 rounded-xl p-4">
    <div className="mb-3"><h3 className="font-black text-sm uppercase tracking-wide text-slate-900">Auto Recommendation Options</h3><p className="text-xs text-slate-500 mt-1">Compare staffing patterns, safety, workload, skill mix, and geography, then apply one. Previous-shift continuity is intentionally not used by Auto Generate; preserve it manually with Semi-Auto when desired.</p></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">{options.map((option, index) => {
      const patientRooms = new Set(option.result.nurseDetails.flatMap(n=>n.assignedRooms));
      const assignedCount = patientRooms.size;
      const admissionReady = Object.entries(option.result.assignments).filter(([room])=>!patientRooms.has(room));
      const exceptions = option.result.warnings.filter(w => w.type === 'WORKLOAD_RATIO' && w.severity !== 'INFO').map(w => w.message);
      const safety = option.result.warnings.filter(w => w.type === 'GEOGRAPHY' && w.severity === 'HIGH').map(w => w.message);
      const fixedCount = option.result.nurseDetails.reduce((sum,n)=>sum+n.reasons.filter(r=>r.includes('CN-set assignment preserved')).length,0);
      return <div key={option.id} className={`rounded-xl border-2 p-3 ${index===0?'border-emerald-300 bg-emerald-50/40':'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-start gap-2"><span className="mt-0.5 text-slate-700">{iconFor(option.id)}</span><div><div className="font-black text-sm text-slate-900">Option {index+1}: {option.title}</div><div className="text-[11px] text-slate-600 mt-0.5">{option.subtitle}</div></div></div>
        <div className="mt-2 flex flex-wrap gap-2 text-[10px]"><span className="rounded bg-white border px-2 py-1">Patients Assigned <b>{assignedCount}</b></span><span className={`rounded border px-2 py-1 ${option.result.unassignedRooms.length?'bg-rose-50 border-rose-200 text-rose-800':'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>Unassigned <b>{option.result.unassignedRooms.length}</b></span><span className="rounded bg-white border px-2 py-1">Staffed Beds <b>{assignedCount + admissionReady.length}</b></span>{fixedCount>0&&<span className="rounded border px-2 py-1 bg-indigo-50 border-indigo-200 text-indigo-800">CN Fixed <b>{fixedCount}</b></span>}<span className="rounded bg-white border px-2 py-1">Fit <b>{option.result.fitLabel}</b></span></div>
        <div className="mt-2 space-y-1">{option.result.nurseDetails.filter(n=>n.assignedRooms.length).map(n => { const fixed=n.reasons.filter(r=>r.includes('CN-set assignment preserved')).length; return <div key={n.nurseId} className="text-[10px] bg-white border rounded px-2 py-1"><b>{rosterNames[n.nurseId] || n.nurseName}</b>: {n.assignedRooms.join(', ')}{fixed>0&&<span className="ml-2 text-indigo-800 font-black">🔒 {fixed} CN-set</span>}</div>; })}</div>
        {admissionReady.length>0 && <div className="mt-2 rounded-lg border border-blue-200 bg-blue-50 p-2"><div className="text-[9px] font-black uppercase text-blue-900">Admission-ready staffed beds</div>{admissionReady.map(([room,nurseId])=><div key={room} className="text-[9px] text-blue-900 mt-0.5"><b>Room {room}</b> → {rosterNames[nurseId] || nurseId} <span className="text-blue-700">(possible PCU/TELE admission)</span></div>)}</div>}
        {safety.length>0 && <div className="mt-2 rounded-lg border border-rose-300 bg-rose-50 p-2"><div className="text-[9px] font-black uppercase text-rose-900">Safety review required</div>{safety.map((e,i)=><div key={i} className="text-[9px] text-rose-900 mt-0.5">{e}</div>)}</div>}
        {exceptions.length>0 && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2"><div className="text-[9px] font-black uppercase text-amber-900">Exception used</div>{exceptions.map((e,i)=><div key={i} className="text-[9px] text-amber-900 mt-0.5">{e}</div>)}</div>}
        {option.result.unassignedRooms.length>0 && <div className="mt-2 text-[10px] font-bold text-rose-700">Needs CN decision: {option.result.unassignedRooms.join(', ')}</div>}
        <button type="button" onClick={()=>onApply(option)} className="mt-3 w-full rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-black hover:bg-slate-800">Apply Option {index+1}</button>
      </div>;
    })}</div>
  </section>;
};