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
    <div className="mb-3"><h3 className="font-black text-sm uppercase tracking-wide text-slate-900">Auto Recommendation Options</h3><p className="text-xs text-slate-500 mt-1">Compare the staffing patterns, then apply one. Nothing changes until you choose Apply.</p></div>
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">{options.map((option, index) => {
      const assignedCount = Object.keys(option.result.assignments).length;
      const exceptions = option.result.warnings.filter(w => w.type === 'WORKLOAD_RATIO').map(w => w.message);
      return <div key={option.id} className={`rounded-xl border-2 p-3 ${index===0?'border-emerald-300 bg-emerald-50/40':'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-start gap-2"><span className="mt-0.5 text-slate-700">{iconFor(option.id)}</span><div><div className="font-black text-sm text-slate-900">Option {index+1}: {option.title}</div><div className="text-[11px] text-slate-600 mt-0.5">{option.subtitle}</div></div></div>
        <div className="mt-2 flex gap-2 text-[10px]"><span className="rounded bg-white border px-2 py-1">Assigned <b>{assignedCount}</b></span><span className={`rounded border px-2 py-1 ${option.result.unassignedRooms.length?'bg-rose-50 border-rose-200 text-rose-800':'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>Unassigned <b>{option.result.unassignedRooms.length}</b></span><span className="rounded bg-white border px-2 py-1">Fit <b>{option.result.fitLabel}</b></span></div>
        <div className="mt-2 space-y-1">{option.result.nurseDetails.filter(n=>n.assignedRooms.length).map(n => <div key={n.nurseId} className="text-[10px] bg-white border rounded px-2 py-1"><b>{rosterNames[n.nurseId] || n.nurseName}</b>: {n.assignedRooms.join(', ')}</div>)}</div>
        {exceptions.length>0 && <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 p-2"><div className="text-[9px] font-black uppercase text-amber-900">Exception used</div>{exceptions.map((e,i)=><div key={i} className="text-[9px] text-amber-900 mt-0.5">{e}</div>)}</div>}
        {option.result.unassignedRooms.length>0 && <div className="mt-2 text-[10px] font-bold text-rose-700">Needs CN decision: {option.result.unassignedRooms.join(', ')}</div>}
        <button type="button" onClick={()=>onApply(option)} className="mt-3 w-full rounded-lg bg-slate-900 text-white px-3 py-2 text-xs font-black hover:bg-slate-800">Apply Option {index+1}</button>
      </div>;
    })}</div>
  </section>;
};
