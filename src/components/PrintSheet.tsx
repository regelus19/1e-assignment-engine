import React from 'react';
import { FinalizedShiftSnapshot, NurseStaff, PatientRoom, OnCallProviders } from '../types';

interface PrintSheetProps { date:string; shiftType:string; roster:NurseStaff[]; rooms:PatientRoom[]; onCall:OnCallProviders; previousShift?:FinalizedShiftSnapshot|null; }
const first=(n:string)=>n.trim().split(/\s+/)[0]||n;
const pairName=(s:NurseStaff,roster:NurseStaff[])=>{if(s.role!=='Preceptor'||!s.orientationPartnerId)return first(s.name);const p=roster.find(x=>x.id===s.orientationPartnerId);return p?`${first(s.name)}/${first(p.name)}`:first(s.name);};
const rows=(roster:NurseStaff[],rooms:PatientRoom[])=>roster.filter(s=>s.role!=='Orientee').map(s=>{const assigned=rooms.filter(r=>r.assignedNurseId===s.id&&r.isOccupied).map(r=>r.roomNumber).sort((a,b)=>Number(a)-Number(b));let assignment=s.role==='CHG'?(assigned.length?`CHG, ${assigned.join(',')}`:'CHG'):s.role==='MT'?'MT':s.role==='PCT'?'PCT':s.staffStatus==='FLEXED'?'FLEXED':s.staffStatus==='ON_CALL'?'ON CALL':assigned.length?assigned.join(','):'—';return {id:s.id,name:pairName(s,roster),assignment,phone:s.assignedPhone||''};});

const ShiftTable:React.FC<{title:string;date:string;roster:NurseStaff[];rooms:PatientRoom[]}>=({title,date,roster,rooms})=>{
 const data=rows(roster,rooms);
 const padded=[...data,...Array.from({length:Math.max(0,11-data.length)},(_,i)=>({id:`blank-${i}`,name:'',assignment:'',phone:''}))].slice(0,11);
 return <section>
   <div className="flex justify-between items-end mb-1"><div className="text-[11px] font-black uppercase">{title}</div><div className="text-[11px] font-black">{date}</div></div>
   <table className="w-full border-collapse border border-black text-[10.5px] leading-tight table-fixed">
     <colgroup><col className="w-[37%]"/><col className="w-[40%]"/><col className="w-[23%]"/></colgroup>
     <thead><tr><th className="border border-black px-1.5 py-1 text-left">Staff</th><th className="border border-black px-1.5 py-1 text-left">Assignment</th><th className="border border-black px-1.5 py-1 text-center">Phone</th></tr></thead>
     <tbody>{padded.map((r,i)=><tr key={r.id||i}><td className="border border-black px-1.5 py-[3px] font-bold h-[20px]">{r.name}</td><td className="border border-black px-1.5 py-[3px]">{r.assignment}</td><td className="border border-black px-1.5 py-[3px] text-center font-semibold">{r.phone}</td></tr>)}</tbody>
   </table>
 </section>;
};

const OnCallTable:React.FC<{onCall:OnCallProviders}>=({onCall})=><section className="my-2">
 <table className="w-full border-collapse border border-black text-[9.5px] leading-tight table-fixed"><tbody>
  <tr><td className="border border-black px-1.5 py-1 font-black w-[30%]">INTENSIVIST</td><td className="border border-black px-1.5 py-1">{onCall.intensivist||''}</td></tr>
  <tr><td className="border border-black px-1.5 py-1 font-black">CARDIOTHORACIC</td><td className="border border-black px-1.5 py-1 whitespace-pre-wrap">{onCall.cardiothoracic||''}</td></tr>
  <tr><td className="border border-black px-1.5 py-1 font-black">ACUTE MI</td><td className="border border-black px-1.5 py-1">{onCall.acuteMI||''}</td></tr>
  <tr><td className="border border-black px-1.5 py-1 font-black">CARDIOLOGY</td><td className="border border-black px-1.5 py-1">{onCall.cardiology||''}</td></tr>
  <tr><td className="border border-black px-1.5 py-1 font-black">HOSPITALIST</td><td className="border border-black px-1.5 py-1">{onCall.hospitalist||''}</td></tr>
 </tbody></table>
</section>;

export const PrintSheet:React.FC<PrintSheetProps>=({date,shiftType,roster,rooms,onCall,previousShift})=>{
 const current={date,shiftType,roster,rooms};
 const prev=previousShift?{date:previousShift.date,shiftType:previousShift.shiftType,roster:previousShift.roster,rooms:previousShift.rooms}:null;
 const day=current.shiftType==='Day'?current:prev?.shiftType==='Day'?prev:null;
 const night=current.shiftType==='Night'?current:prev?.shiftType==='Night'?prev:null;
 const emptyRoster:NurseStaff[]=[];const emptyRooms:PatientRoom[]=[];
 return <div className="bg-white text-black px-3 py-2 font-sans mx-auto print:p-0 print-sheet-portrait" style={{maxWidth:'7.7in'}}>
   <div className="text-center mb-1"><h1 className="text-[14px] font-black tracking-wide">1 EAST DAILY STAFFING ASSIGNMENTS</h1><div className="text-[9px] font-semibold">Cardiac Universal Bed (CUB) Unit</div></div>
   <ShiftTable title="AM SHIFT" date={day?.date||''} roster={day?.roster||emptyRoster} rooms={day?.rooms||emptyRooms}/>
   <OnCallTable onCall={onCall}/>
   <ShiftTable title="PM SHIFT" date={night?.date||''} roster={night?.roster||emptyRoster} rooms={night?.rooms||emptyRooms}/>
 </div>;
};
