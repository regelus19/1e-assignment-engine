import React from 'react';
import { FinalizedShiftSnapshot, NurseStaff, PatientRoom, OnCallProviders } from '../types';

interface ShiftData { date:string; shiftType:string; roster:NurseStaff[]; rooms:PatientRoom[]; onCall?:OnCallProviders; }
interface PrintSheetProps { date:string; shiftType:string; roster:NurseStaff[]; rooms:PatientRoom[]; onCall:OnCallProviders; previousShift?:FinalizedShiftSnapshot|null; nextShift?:ShiftData|null; }
const first=(n:string)=>n.trim().split(/\s+/)[0]||n;
const pairName=(s:NurseStaff,roster:NurseStaff[])=>{if(s.role!=='Preceptor'||!s.orientationPartnerId)return first(s.name);const p=roster.find(x=>x.id===s.orientationPartnerId);return p?`${first(s.name)}/${first(p.name)}`:first(s.name);};
const rows=(roster:NurseStaff[],rooms:PatientRoom[])=>roster.filter(s=>s.role!=='Orientee').map(s=>{const assigned=rooms.filter(r=>r.assignedNurseId===s.id&&r.isOccupied).map(r=>r.roomNumber).sort((a,b)=>Number(a)-Number(b));let assignment=s.role==='CHG'?(assigned.length?`CHG, ${assigned.join(',')}`:'CHG'):s.role==='MT'?'MT':s.role==='PCT'?'PCT':s.staffStatus==='FLEXED'?'FLEXED':s.staffStatus==='ON_CALL'?'ON CALL':assigned.length?assigned.join(','):'—';return {id:s.id,name:pairName(s,roster),assignment,phone:s.assignedPhone||''};});

const ShiftTable:React.FC<{title:string;date:string;roster:NurseStaff[];rooms:PatientRoom[]}>=({title,date,roster,rooms})=>{
 const data=rows(roster,rooms);
 const padded=[...data,...Array.from({length:Math.max(0,10-data.length)},(_,i)=>({id:`blank-${i}`,name:'',assignment:'',phone:''}))].slice(0,12);
 return <section>
   <div className="flex justify-between items-end mb-1"><div className="text-[14px] font-black uppercase">{title}</div><div className="text-[14px] font-black">{date}</div></div>
   <table className="w-full border-collapse border-2 border-black text-[13px] leading-tight table-fixed">
     <colgroup><col className="w-[37%]"/><col className="w-[40%]"/><col className="w-[23%]"/></colgroup>
     <thead><tr><th className="border border-black px-2 py-1 text-left">Staff</th><th className="border border-black px-2 py-1 text-left">Assignment</th><th className="border border-black px-2 py-1 text-center">Phone</th></tr></thead>
     <tbody>{padded.map((r,i)=><tr key={r.id||i}><td className="border border-black px-2 py-[4px] font-bold h-[24px]">{r.name}</td><td className="border border-black px-2 py-[4px] font-semibold">{r.assignment}</td><td className="border border-black px-2 py-[4px] text-center font-semibold">{r.phone}</td></tr>)}</tbody>
   </table>
 </section>;
};

const provider=(v:string|undefined)=>v||'';
const OnCallTable:React.FC<{am:OnCallProviders;pm:OnCallProviders}>=({am,pm})=><section className="my-2">
 <table className="w-full border-collapse border-2 border-black text-[12px] leading-tight table-fixed">
  <colgroup><col className="w-[29%]"/><col className="w-[35.5%]"/><col className="w-[35.5%]"/></colgroup>
  <thead><tr><th className="border border-black px-2 py-1"></th><th className="border border-black px-2 py-1 text-center font-black">AM</th><th className="border border-black px-2 py-1 text-center font-black">PM</th></tr></thead>
  <tbody>
   <tr><td className="border border-black px-2 py-1 font-black">INTENSIVIST</td><td className="border border-black px-2 py-1 whitespace-pre-wrap min-h-[28px]">{provider(am.intensivist)}</td><td className="border border-black px-2 py-1 whitespace-pre-wrap">{provider(pm.intensivist)}</td></tr>
   <tr><td className="border border-black px-2 py-2 font-black">CARDIOTHORACIC</td><td className="border border-black px-2 py-2 whitespace-pre-wrap h-[42px] align-top">{provider(am.cardiothoracic)}</td><td className="border border-black px-2 py-2 whitespace-pre-wrap h-[42px] align-top">{provider(pm.cardiothoracic)}</td></tr>
   <tr><td className="border border-black px-2 py-1 font-black">ACUTE MI</td><td className="border border-black px-2 py-1 whitespace-pre-wrap">{provider(am.acuteMI)}</td><td className="border border-black px-2 py-1 whitespace-pre-wrap">{provider(pm.acuteMI)}</td></tr>
   <tr><td className="border border-black px-2 py-1 font-black">CARDIOLOGY</td><td className="border border-black px-2 py-1 whitespace-pre-wrap">{provider(am.cardiology)}</td><td className="border border-black px-2 py-1 whitespace-pre-wrap">{provider(pm.cardiology)}</td></tr>
   <tr><td className="border border-black px-2 py-2 font-black">HOSPITALIST</td><td className="border border-black px-2 py-2 whitespace-pre-wrap h-[38px] align-top">{provider(am.hospitalist)}</td><td className="border border-black px-2 py-2 whitespace-pre-wrap h-[38px] align-top">{provider(pm.hospitalist)}</td></tr>
  </tbody>
 </table>
</section>;

export const PrintSheet:React.FC<PrintSheetProps>=({date,shiftType,roster,rooms,onCall,previousShift,nextShift})=>{
 const current:ShiftData={date,shiftType,roster,rooms,onCall};
 const prev:ShiftData|null=previousShift?{date:previousShift.date,shiftType:previousShift.shiftType,roster:previousShift.roster,rooms:previousShift.rooms,onCall:previousShift.onCall}:null;
 const candidates=[current,nextShift,prev].filter(Boolean) as ShiftData[];
 const targetDate=nextShift?.date||current.date;
 const day=candidates.find(x=>x.date===targetDate&&x.shiftType==='Day')||candidates.find(x=>x.shiftType==='Day')||null;
 const night=candidates.find(x=>x.date===targetDate&&x.shiftType==='Night')||candidates.find(x=>x.shiftType==='Night')||null;
 const emptyRoster:NurseStaff[]=[];const emptyRooms:PatientRoom[]=[];
 const amCall=day?.onCall||onCall,pmCall=night?.onCall||onCall;
 return <div className="bg-white text-black px-2 py-1 font-serif mx-auto print:p-0 print-sheet-portrait" style={{maxWidth:'7.8in'}}>
   <div className="text-center mb-1"><h1 className="text-[17px] font-black tracking-wide">1 EAST DAILY STAFFING ASSIGNMENTS</h1><div className="text-[11px] font-bold">Cardiac Universal Bed (CUB) Unit</div></div>
   <ShiftTable title="AM SHIFT" date={day?.date||targetDate} roster={day?.roster||emptyRoster} rooms={day?.rooms||emptyRooms}/>
   <OnCallTable am={amCall} pm={pmCall}/>
   <ShiftTable title="PM SHIFT" date={night?.date||targetDate} roster={night?.roster||emptyRoster} rooms={night?.rooms||emptyRooms}/>
 </div>;
};
