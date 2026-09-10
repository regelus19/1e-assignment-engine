import React, { useState } from 'react';
import { AcuityLevel, ComplexityFlag, PatientRoom } from '../types';

interface Props { rooms: PatientRoom[]; onRoomChange: (room: PatientRoom) => void; }
type Tool = { kind:'acuity'; value:AcuityLevel } | { kind:'flag'; value:ComplexityFlag } | null;
const acuities:AcuityLevel[]=['CVICU','ICU','PCU','TELE'];
const flags:{value:ComplexityFlag;label:string}[]=[
  {value:'Fresh Post-Op',label:'Fresh Post Op'}, {value:'Possible DC',label:'Possible DC'}, {value:'Expected DC',label:'Expected DC'},
  {value:'Transfer',label:'Pending Transfer'}, {value:'Admission',label:'Recent Admission'}, {value:'BLOCKED',label:'BLOCKED'},
  {value:'Vent',label:'Vent'}, {value:'Pressors',label:'Pressors'}, {value:'Impella/IABP',label:'Impella/IABP'}, {value:'HD/Dialysis',label:'HD/Dialysis'},
  {value:'Isolation',label:'Isolation'}, {value:'Sitter/Safety',label:'Sitter/Safety'}, {value:'High Fall Risk',label:'High Fall Risk'}, {value:'Confused',label:'Confused'}
];
const acuityStyle:Record<AcuityLevel,string>={CVICU:'bg-rose-100 border-rose-300 text-rose-800',ICU:'bg-orange-100 border-orange-300 text-orange-800',PCU:'bg-blue-100 border-blue-300 text-blue-800',TELE:'bg-emerald-100 border-emerald-300 text-emerald-800'};

export const RapidRoomTools:React.FC<Props>=({rooms,onRoomChange})=>{
  const [tool,setTool]=useState<Tool>(null);
  const occupied=rooms.filter(r=>r.isOccupied);
  const apply=(room:PatientRoom)=>{
    if(!tool) return;
    if(tool.kind==='acuity') onRoomChange({...room,isOccupied:true,acuity:tool.value});
    else {
      const active=room.flags.includes(tool.value);
      onRoomChange({...room,flags:active?room.flags.filter(f=>f!==tool.value):[...room.flags,tool.value]});
    }
  };
  return <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
    <div><div className="font-black text-xs uppercase text-slate-800">Rapid Room Coding</div><div className="text-[9px] text-slate-500 mt-0.5">Choose a category, then tap rooms in succession. Tap again to toggle a flag.</div></div>
    <div><div className="text-[9px] font-black uppercase text-slate-500 mb-1">Acuity</div><div className="grid grid-cols-2 gap-1">{acuities.map(a=><button key={a} onClick={()=>setTool({kind:'acuity',value:a})} className={`rounded border px-2 py-1.5 text-[10px] font-black ${acuityStyle[a]} ${tool?.kind==='acuity'&&tool.value===a?'ring-2 ring-slate-800':''}`}>{a}</button>)}</div></div>
    <div><div className="text-[9px] font-black uppercase text-slate-500 mb-1">Flow / Clinical Flags</div><div className="grid grid-cols-2 gap-1">{flags.map(f=><button key={f.value} onClick={()=>setTool({kind:'flag',value:f.value})} className={`rounded border px-1.5 py-1.5 text-[9px] font-bold text-left ${tool?.kind==='flag'&&tool.value===f.value?'bg-slate-800 text-white border-slate-800':'bg-slate-50 text-slate-700 border-slate-200'}`}>{f.label}</button>)}</div></div>
    {tool && <div className="border-t pt-2"><div className="text-[9px] font-black text-slate-700 mb-1">{tool.kind==='acuity'?`Set ${tool.value}:`:`Toggle ${flags.find(f=>f.value===tool.value)?.label}:`}</div><div className="flex flex-wrap gap-1">{occupied.map(r=>{const active=tool.kind==='acuity'?r.acuity===tool.value:r.flags.includes(tool.value);return <button key={r.roomNumber} onClick={()=>apply(r)} className={`rounded border px-1.5 py-1 text-[9px] font-black ${active?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-700 border-slate-300'}`}>{r.roomNumber}{active?' ✓':''}</button>})}</div><button onClick={()=>setTool(null)} className="mt-2 text-[9px] font-bold text-slate-500 underline">Clear rapid tool</button></div>}
  </div>;
};
