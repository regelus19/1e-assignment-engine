import React, { useMemo, useState } from 'react';
import { ForecastEvent, NurseStaff, PatientRoom, MTCoverageState, PCTCoverageState, AcuityLevel } from '../types';
import { Clock, Plus, Trash2 } from 'lucide-react';

interface NextShiftForecastProps {
  events: ForecastEvent[];
  roster: NurseStaff[];
  rooms: PatientRoom[];
  mtState: MTCoverageState;
  pctState: PCTCoverageState;
  onAddEvent: (event: ForecastEvent) => void;
  onDeleteEvent: (id: string) => void;
}

type DemandPoint = { time: string; census: number; cvicu: number; icu: number; pcuTele: number; requiredRNs: number; };
const timeSort = (a: string, b: string) => a.localeCompare(b);
const acuities: AcuityLevel[] = ['CVICU','ICU','PCU','TELE'];

export const NextShiftForecast: React.FC<NextShiftForecastProps> = ({ events, roster, rooms, mtState, pctState, onAddEvent, onDeleteEvent }) => {
  const [procedureType, setProcedureType] = useState<ForecastEvent['procedureType']>('Expected Admission');
  const [expectedTime, setExpectedTime] = useState('12:00');
  const [acuity, setAcuity] = useState<AcuityLevel>('PCU');
  const [notes, setNotes] = useState('');

  const activeRooms = rooms.filter(r => r.isOccupied);
  const activeRNs = roster.filter(s => ['RN','Preceptor'].includes(s.role) && (s.staffStatus === 'ACTIVE' || s.staffStatus === 'RECALLED'));
  const reserveRNs = roster.filter(s => ['RN','Preceptor'].includes(s.role) && (s.staffStatus === 'ON_CALL' || s.staffStatus === 'FLEXED'));
  const activeCvicuCapable = activeRNs.filter(s => s.capability === 'CVICU').length;
  const activeIcuOrHigher = activeRNs.filter(s => s.capability === 'CVICU' || s.capability === 'ICU').length;

  const demand = useMemo(() => {
    let census = activeRooms.length;
    let cvicu = activeRooms.filter(r => r.acuityConfirmed !== false && r.acuity === 'CVICU').length;
    let icu = activeRooms.filter(r => r.acuityConfirmed !== false && r.acuity === 'ICU').length;
    let pcuTele = activeRooms.filter(r => r.acuityConfirmed !== false && (r.acuity === 'PCU' || r.acuity === 'TELE')).length;
    const points: DemandPoint[] = [{ time: 'Start', census, cvicu, icu, pcuTele, requiredRNs: cvicu + Math.ceil(icu / 2) + Math.ceil(pcuTele / 3) }];
    [...events].sort((a,b)=>timeSort(a.expectedTime,b.expectedTime)).forEach(e => {
      if (e.procedureType === 'Expected Discharge') { census=Math.max(0,census-1); if(e.acuity==='CVICU')cvicu=Math.max(0,cvicu-1); else if(e.acuity==='ICU')icu=Math.max(0,icu-1); else pcuTele=Math.max(0,pcuTele-1); }
      else { census+=1; if(e.acuity==='CVICU')cvicu+=1; else if(e.acuity==='ICU')icu+=1; else pcuTele+=1; }
      points.push({time:e.expectedTime,census,cvicu,icu,pcuTele,requiredRNs:cvicu+Math.ceil(icu/2)+Math.ceil(pcuTele/3)});
    }); return points;
  }, [events, activeRooms]);

  const peak=demand.reduce((best,p)=>p.requiredRNs>best.requiredRNs?p:best,demand[0]);
  const rnGap=Math.max(0,peak.requiredRNs-activeRNs.length),cvicuGap=Math.max(0,peak.cvicu-activeCvicuCapable),higherAcuityNeed=peak.cvicu+Math.ceil(peak.icu/2),higherAcuityGap=Math.max(0,higherAcuityNeed-activeIcuOrHigher);
  const pressure=rnGap>0||cvicuGap>0||higherAcuityGap>0?'AT RISK':peak.requiredRNs>=activeRNs.length?'HIGH':peak.requiredRNs>=Math.max(1,activeRNs.length-1)?'MODERATE':'LOW';
  const supportNotes=[mtState==='MT_UNFILLED'?'MT gap':mtState==='RN_COVERING_MT'?'RN covering MT':null,pctState==='PCT_NONE'?'No PCT support':null].filter(Boolean).join(' • ')||'MT and PCT support present';
  const nextWindowEvents=[...events].sort((a,b)=>timeSort(a.expectedTime,b.expectedTime)).slice(0,4),firstTime=nextWindowEvents[0]?.expectedTime||'—',lastTime=nextWindowEvents[nextWindowEvents.length-1]?.expectedTime||'—';

  const addEvent=()=>{onAddEvent({id:`fe-${Date.now()}`,procedureType,expectedTime,acuity,destinationLevel:acuity==='CVICU'?'CVICU Bed':acuity==='ICU'?'ICU Bed':'Floor Bed',notes});setNotes('');};
  const quickExpectedAdmission=(level:AcuityLevel)=>onAddEvent({id:`fe-${Date.now()}-${level}`,procedureType:'Expected Admission',expectedTime:'19:00',acuity:level,destinationLevel:level==='CVICU'?'CVICU Bed':level==='ICU'?'ICU Bed':'Floor Bed',notes:'Expected admission for next-shift staffing plan'});

  return <div className="space-y-6">
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4"><div className="bg-white p-4 rounded-xl border"><span className="text-xs uppercase font-bold text-slate-500">Projected Peak Staffing Demand</span><div className={`text-xl font-black mt-1 ${pressure==='AT RISK'?'text-rose-600':pressure==='HIGH'?'text-amber-600':'text-blue-700'}`}>{peak.time} — {pressure}</div><p className="text-xs text-slate-600 mt-1">Projected census {peak.census}; baseline bedside need {peak.requiredRNs} RN(s).</p></div><div className="bg-white p-4 rounded-xl border"><span className="text-xs uppercase font-bold text-slate-500">Capability-Based Gap</span><div className={`text-xl font-black mt-1 ${rnGap||cvicuGap||higherAcuityGap?'text-rose-600':'text-emerald-700'}`}>{rnGap||cvicuGap||higherAcuityGap?'REVIEW NEEDED':'NO BASELINE GAP'}</div><p className="text-xs text-slate-600 mt-1">RN gap {rnGap} • CVICU gap {cvicuGap} • ICU/CVICU gap {higherAcuityGap}</p></div><div className="bg-white p-4 rounded-xl border"><span className="text-xs uppercase font-bold text-slate-500">Operational Reserve</span><div className="text-base font-bold mt-1">{reserveRNs.length} RN(s) flexed/on-call</div><p className="text-xs text-slate-500 mt-1">{supportNotes}</p></div></div>

    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl"><div className="font-black text-sm uppercase text-blue-900">Quick Expected Admissions</div><p className="text-xs text-blue-800 mt-1">Adds forecast demand only. It does not change current census. Tap the expected acuity for each anticipated admission.</p><div className="flex flex-wrap gap-2 mt-3">{acuities.map(level=><button key={level} onClick={()=>quickExpectedAdmission(level)} className="bg-white border border-blue-300 rounded-lg px-3 py-2 text-xs font-black text-blue-900">+ {level}</button>)}</div></div>

    <div className="bg-amber-50 border border-amber-200 p-5 rounded-xl"><div className="flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-amber-700"/><h3 className="font-black text-amber-900 text-sm uppercase">Next Action Window: {firstTime} – {lastTime}</h3></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-amber-900"><div><p className="font-bold mb-1">Upcoming Events</p>{nextWindowEvents.length?<ul className="list-disc pl-4 space-y-0.5">{nextWindowEvents.map(e=><li key={e.id}>{e.expectedTime} — {e.procedureType} ({e.acuity})</li>)}</ul>:<p>No events entered.</p>}</div><div><p className="font-bold mb-1">Operational Consideration</p><p>Reserve: {reserveRNs.map(n=>`${n.name} (${n.capability}, ${n.staffStatus})`).join(', ')||'None'}</p><p className="italic mt-1">{rnGap>0?`Baseline demand exceeds active bedside staffing by ${rnGap} RN(s).`:higherAcuityGap>0?'Higher-acuity capability may be insufficient at peak.':'No baseline staffing gap is projected from current entries.'}</p></div></div></div>

    <div className="bg-white p-4 rounded-xl border"><h3 className="font-bold text-sm uppercase mb-3">Add Tomorrow Event</h3><div className="grid grid-cols-1 md:grid-cols-5 gap-2"><select value={procedureType} onChange={e=>setProcedureType(e.target.value as ForecastEvent['procedureType'])} className="border rounded px-2 py-2 text-xs"><option>CABG</option><option>Valve Surgery</option><option>TAVR</option><option>Cath/PCI</option><option>EP</option><option>Direct/ED Admission</option><option>Expected Admission</option><option>Expected Discharge</option><option>Other</option></select><input type="time" value={expectedTime} onChange={e=>setExpectedTime(e.target.value)} className="border rounded px-2 py-2 text-xs"/><select value={acuity} onChange={e=>setAcuity(e.target.value as AcuityLevel)} className="border rounded px-2 py-2 text-xs"><option>CVICU</option><option>ICU</option><option>PCU</option><option>TELE</option></select><input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes" className="border rounded px-2 py-2 text-xs"/><button onClick={addEvent} className="bg-blue-600 text-white rounded px-3 py-2 text-xs font-bold flex items-center justify-center gap-1"><Plus className="w-3.5 h-3.5"/>Add Event</button></div></div>

    <div className="bg-white p-4 rounded-xl border overflow-x-auto"><h3 className="font-bold text-slate-800 text-sm uppercase mb-4">Incoming Procedural Demand & Expected Census</h3><table className="w-full text-xs"><thead><tr className="border-b text-slate-500"><th className="pb-2 text-left">Time</th><th className="pb-2 text-left">Event Type</th><th className="pb-2 text-left">Acuity</th><th className="pb-2 text-left">Target Bed</th><th className="pb-2 text-left">Notes</th><th className="pb-2 text-right">Action</th></tr></thead><tbody>{[...events].sort((a,b)=>timeSort(a.expectedTime,b.expectedTime)).map(e=><tr key={e.id} className="border-b"><td className="py-2.5 font-mono font-bold">{e.expectedTime}</td><td className="py-2.5 font-semibold">{e.procedureType}</td><td className="py-2.5 font-bold text-blue-700">{e.acuity}</td><td>{e.destinationLevel}</td><td className="text-slate-500">{e.notes}</td><td className="text-right"><button onClick={()=>onDeleteEvent(e.id)} className="text-rose-600"><Trash2 className="w-3.5 h-3.5 inline"/></button></td></tr>)}</tbody></table></div>
  </div>;
};
