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
  const toggleTool=(next:Exclude<Tool,null>)=>setTool(current=>current?.kind===next.kind&&current.value===next.value?null:next);
  const apply=(room:PatientRoom)=>{
    if(!tool) return;
    if(tool.kind==='acuity') {
      const active=room.isOccupied && room.acuityConfirmed!==false && room.acuity===tool.value;
      if(active) {
        onRoomChange({...room,acuityConfirmed:false});
      } else {
        onRoomChange({...room,isOccupied:true,acuity:tool.value,acuityConfirmed:true});
      }
      return;
    }
    const active=room.flags.includes(tool.value);
    let nextFlags=active?room.flags.filter(f=>f!==tool.value):[...room.flags,tool.value];
    if(!active&&tool.value==='Expected DC') nextFlags=nextFlags.filter(f=>f!=='Possible DC');
    if(!active&&tool.value==='Possible DC') nextFlags=nextFlags.filter(f=>f!=='Expected DC');
    onRoomChange({...room,flags:nextFlags});
  };
  const uncoded=occupied.filter(r=>r.acuityConfirmed===false);

  return <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
    <div><div className="font-black text-xs uppercase text-slate-800">Rapid Room Coding</div><div className="text-[9px] text-slate-500 mt-0.5">Pick a tool, then tap rooms in succession. Checked acuity rooms now toggle OFF to UNCoded without changing census. Pick another acuity to recode them.</div></div>
    <div><div className="text-[9px] font-black uppercase text-slate-500 mb-1">Acuity</div><div className="grid grid-cols-2 gap-1">{acuities.map(a=>{const active=tool?.kind==='acuity'&&tool.value===a;return <button key={a} onClick={()=>toggleTool({kind:'acuity',value:a})} className={`rounded border px-2 py-1.5 text-[10px] font-black ${acuityStyle[a]} ${active?'ring-2 ring-slate-800':''}`}>{a}{active?' ✓':''}</button>})}</div></div>
    <div><div className="text-[9px] font-black uppercase text-slate-500 mb-1">Flow / Clinical Flags</div><div className="grid grid-cols-2 gap-1">{flags.map(f=>{const active=tool?.kind==='flag'&&tool.value===f.value;return <button key={f.value} onClick={()=>toggleTool({kind:'flag',value:f.value})} className={`rounded border px-1.5 py-1.5 text-[9px] font-bold text-left ${active?'bg-slate-800 text-white border-slate-800':'bg-slate-50 text-slate-700 border-slate-200'}`}>{f.label}{active?' ✓':''}</button>})}</div></div>
    {tool && <div className="border-t pt-2"><div className="text-[9px] font-black text-slate-700 mb-1">{tool.kind==='acuity'?`Toggle ${tool.value} for:`:`Toggle ${flags.find(f=>f.value===tool.value)?.label} for:`}</div><div className="flex flex-wrap gap-1">{occupied.map(r=>{const active=tool.kind==='acuity'?(r.acuityConfirmed!==false&&r.acuity===tool.value):r.flags.includes(tool.value);return <button key={r.roomNumber} onClick={()=>apply(r)} className={`rounded border px-1.5 py-1 text-[9px] font-black ${active?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-700 border-slate-300'}`}>{r.roomNumber}{active?' ✓':''}</button>})}</div><div className="text-[8px] text-slate-500 mt-1">Click a checked acuity room to remove that acuity code. The patient stays in census and is marked UNCoded until you assign a new acuity.</div><button onClick={()=>setTool(null)} className="mt-2 text-[9px] font-bold text-slate-500 underline">Clear rapid tool</button></div>}
    {uncoded.length>0&&<div className="bg-amber-50 border border-amber-300 rounded-lg p-2"><div className="text-[9px] font-black text-amber-900">NEEDS ACUITY ({uncoded.length})</div><div className="flex flex-wrap gap-1 mt-1">{uncoded.map(r=><span key={r.roomNumber} className="rounded border border-amber-300 bg-white px-1.5 py-1 text-[9px] font-black text-amber-900">{r.roomNumber}</span>)}</div></div>}
  </div>;
};
