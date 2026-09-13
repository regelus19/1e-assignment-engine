import React, { useState } from 'react';
import { Home } from 'lucide-react';
import { AcuityLevel, ComplexityFlag, PatientRoom } from '../types';

interface Props { rooms: PatientRoom[]; onRoomChange: (room: PatientRoom) => void; }
type Tool =
  | { kind:'acuity'; value:AcuityLevel }
  | { kind:'flag'; value:ComplexityFlag }
  | { kind:'status'; value:'OCCUPIED'|'VACANT' }
  | null;

const acuities:AcuityLevel[]=['CVICU','ICU','PCU','TELE'];
const flags:{value:ComplexityFlag;label:string}[]=[
  {value:'Possible DC',label:'Possible DC'}, {value:'Expected DC',label:'Expected DC'}, {value:'Fresh Post-Op',label:'Fresh Post Op'}, {value:'Pending Surgery',label:'Pending Surgery'},
  {value:'Transfer',label:'Pending Transfer'}, {value:'Admission',label:'Recent Admission'}, {value:'BLOCKED',label:'BLOCKED'},
  {value:'Vent',label:'Vent'}, {value:'Vasoactive Support',label:'Vasoactive Support'}, {value:'Inotropic Support',label:'Inotropic Support'}, {value:'Impella/IABP',label:'Impella/IABP'}, {value:'HD/Dialysis',label:'HD/Dialysis'},
  {value:'Isolation',label:'Isolation'}, {value:'Sitter/Safety',label:'Sitter/Safety'}, {value:'High Fall Risk',label:'High Fall Risk'}, {value:'Confused',label:'Confused'}
];
const acuityStyle:Record<AcuityLevel,string>={CVICU:'bg-rose-100 border-rose-300 text-rose-800',ICU:'bg-orange-100 border-orange-300 text-orange-800',PCU:'bg-blue-100 border-blue-300 text-blue-800',TELE:'bg-emerald-100 border-emerald-300 text-emerald-800'};
const roomHasFlag=(room:PatientRoom,flag:ComplexityFlag)=>flag==='Vasoactive Support'?room.flags.includes('Vasoactive Support')||room.flags.includes('Pressors'):room.flags.includes(flag);

export const RapidRoomTools:React.FC<Props>=({rooms,onRoomChange})=>{
  const [tool,setTool]=useState<Tool>(null);
  const occupied=rooms.filter(r=>r.isOccupied);
  const vacant=rooms.filter(r=>!r.isOccupied);
  const toggleTool=(next:Exclude<Tool,null>)=>setTool(current=>current?.kind===next.kind&&current.value===next.value?null:next);

  const apply=(room:PatientRoom)=>{
    if(!tool) return;

    if(tool.kind==='status') {
      if(tool.value==='OCCUPIED') onRoomChange({...room,isOccupied:true});
      else onRoomChange({...room,isOccupied:false,assignedNurseId:null});
      return;
    }

    if(tool.kind==='acuity') {
      const active=room.acuityConfirmed!==false && room.acuity===tool.value;
      if(active) onRoomChange({...room,acuityConfirmed:false});
      else onRoomChange({...room,acuity:tool.value,acuityConfirmed:true});
      return;
    }

    const active=roomHasFlag(room,tool.value);
    let nextFlags=room.flags.filter(f=>!(tool.value==='Vasoactive Support'&&(f==='Pressors'||f==='Vasoactive Support'))&&f!==tool.value);
    if(!active) nextFlags=[...nextFlags,tool.value];
    if(!active&&tool.value==='Expected DC') nextFlags=nextFlags.filter(f=>f!=='Possible DC');
    if(!active&&tool.value==='Possible DC') nextFlags=nextFlags.filter(f=>f!=='Expected DC');
    onRoomChange({...room,flags:nextFlags});
  };

  const targetRooms = tool?.kind==='flag' && tool.value!=='BLOCKED' ? occupied : rooms;
  const uncoded=occupied.filter(r=>r.acuityConfirmed===false);
  const vacantWithPlannedAcuity=vacant.filter(r=>r.acuityConfirmed!==false);

  return <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-3">
    <div><div className="font-black text-xs uppercase text-slate-800">Rapid Room Coding</div><div className="text-[9px] text-slate-500 mt-0.5">Choose acuity, room status, or a flag, then tap rooms in succession. Acuity can be pre-coded on vacant rooms without increasing census.</div></div>

    <div><div className="text-[9px] font-black uppercase text-slate-500 mb-1">Acuity — all rooms</div><div className="grid grid-cols-2 gap-1">{acuities.map(a=>{const active=tool?.kind==='acuity'&&tool.value===a;return <button key={a} onClick={()=>toggleTool({kind:'acuity',value:a})} className={`rounded border px-2 py-1.5 text-[10px] font-black ${acuityStyle[a]} ${active?'ring-2 ring-slate-800':''}`}>{a}{active?' ✓':''}</button>})}</div></div>

    <div><div className="text-[9px] font-black uppercase text-slate-500 mb-1">Room Status — rapid census</div><div className="grid grid-cols-2 gap-1"><button onClick={()=>toggleTool({kind:'status',value:'OCCUPIED'})} className={`rounded border px-2 py-1.5 text-[10px] font-black ${tool?.kind==='status'&&tool.value==='OCCUPIED'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-700 border-slate-300'}`}>Occupied</button><button onClick={()=>toggleTool({kind:'status',value:'VACANT'})} className={`rounded border px-2 py-1.5 text-[10px] font-black ${tool?.kind==='status'&&tool.value==='VACANT'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-700 border-slate-300'}`}>Vacant</button></div></div>

    <div>
      <div className="flex items-center justify-between gap-2 mb-1"><div className="text-[9px] font-black uppercase text-slate-500">Rapid Flags</div><div className="text-[8px] text-slate-400">Select flag → tap multiple rooms</div></div>
      <div className="grid grid-cols-2 gap-1">{flags.map(f=>{const active=tool?.kind==='flag'&&tool.value===f.value;const isPossible=f.value==='Possible DC',isExpected=f.value==='Expected DC';return <button key={f.value} onClick={()=>toggleTool({kind:'flag',value:f.value})} className={`rounded border px-1.5 py-1.5 text-[9px] font-bold text-left flex items-center gap-1 ${active?'bg-slate-800 text-white border-slate-800':isPossible?'bg-amber-50 text-amber-800 border-amber-200':isExpected?'bg-emerald-50 text-emerald-800 border-emerald-200':'bg-slate-50 text-slate-700 border-slate-200'}`}>{(isPossible||isExpected)&&<Home className={`w-3 h-3 ${active?'text-white':isExpected?'text-emerald-600':'text-amber-500'}`}/>}<span>{f.label}{active?' ✓':''}</span></button>})}</div>
    </div>

    {tool && <div className="border-t pt-2"><div className="text-[9px] font-black text-slate-700 mb-1">{tool.kind==='acuity'?`Set / toggle ${tool.value} for:`:tool.kind==='status'?`Mark rooms ${tool.value==='OCCUPIED'?'occupied':'vacant'}:`:`Rapid assign ${flags.find(f=>f.value===tool.value)?.label} to:`}</div><div className="flex flex-wrap gap-1">{targetRooms.map(r=>{const active=tool.kind==='acuity'?(r.acuityConfirmed!==false&&r.acuity===tool.value):tool.kind==='status'?(tool.value==='OCCUPIED'?r.isOccupied:!r.isOccupied):roomHasFlag(r,tool.value);return <button key={r.roomNumber} onClick={()=>apply(r)} className={`rounded border px-1.5 py-1 text-[9px] font-black ${active?'bg-slate-800 text-white border-slate-800':'bg-white text-slate-700 border-slate-300'}`}>{r.roomNumber}{!r.isOccupied?' · V':''}{active?' ✓':''}</button>})}</div><div className="text-[8px] text-slate-500 mt-1">Tap as many rooms as needed. Tap a checked room again to remove the selected flag. Possible DC and Expected DC remain mutually exclusive.</div><button onClick={()=>setTool(null)} className="mt-2 text-[9px] font-bold text-slate-500 underline">Clear rapid tool</button></div>}

    {uncoded.length>0&&<div className="bg-amber-50 border border-amber-300 rounded-lg p-2"><div className="text-[9px] font-black text-amber-900">NEEDS ACUITY ({uncoded.length})</div><div className="flex flex-wrap gap-1 mt-1">{uncoded.map(r=><span key={r.roomNumber} className="rounded border border-amber-300 bg-white px-1.5 py-1 text-[9px] font-black text-amber-900">{r.roomNumber}</span>)}</div></div>}
    {vacantWithPlannedAcuity.length>0&&<div className="bg-blue-50 border border-blue-200 rounded-lg p-2"><div className="text-[9px] font-black text-blue-900">VACANT ROOMS WITH PLANNED ACUITY ({vacantWithPlannedAcuity.length})</div><div className="flex flex-wrap gap-1 mt-1">{vacantWithPlannedAcuity.map(r=><span key={r.roomNumber} className="rounded border border-blue-200 bg-white px-1.5 py-1 text-[9px] font-black text-blue-900">{r.roomNumber} · {r.acuity}</span>)}</div></div>}
  </div>;
};
