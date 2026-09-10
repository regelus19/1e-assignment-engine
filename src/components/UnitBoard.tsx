import React, { useMemo, useState } from 'react';
import { PatientRoom, NurseStaff, AssignmentWarning, ComplexityFlag } from '../types';
import { ROOM_METADATA_MAP } from '../config/geography';
import { StorageService } from '../services/storage';
import { AlertCircle, RotateCcw, X } from 'lucide-react';

interface UnitBoardProps {
  rooms: PatientRoom[];
  roster: NurseStaff[];
  warnings: AssignmentWarning[];
  onRoomChange: (updatedRoom: PatientRoom) => void;
  onAssignRoom: (roomNumber: string, nurseId: string | null) => void;
}

const FLAG_OPTIONS: ComplexityFlag[] = ['Vent', 'Pressors', 'Impella/IABP', 'Fresh Post-Op', 'HD/Dialysis', 'Isolation', 'Sitter/Safety', 'High Fall Risk', 'Confused', 'Admission', 'Transfer', 'Possible DC', 'Expected DC', 'BLOCKED'];
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const pairLabel = (staff: NurseStaff, roster: NurseStaff[]) => {
  if (staff.role !== 'Preceptor' || !staff.orientationPartnerId) return firstName(staff.name);
  const partner = roster.find(x => x.id === staff.orientationPartnerId);
  return partner ? `${firstName(staff.name)} / ${firstName(partner.name)}` : firstName(staff.name);
};

export const UnitBoard: React.FC<UnitBoardProps> = ({ rooms, roster, warnings, onRoomChange, onAssignRoom }) => {
  const [manualStaffId, setManualStaffId] = useState<string | null>(null);
  const [recallMessage, setRecallMessage] = useState<string>('');
  const occupied = rooms.filter(r => r.isOccupied);
  const unassigned = occupied.filter(r => !r.assignedNurseId);
  const bedside = useMemo(() => roster.filter(s => ['RN', 'CHG', 'Preceptor'].includes(s.role)), [roster]);
  const activeNurses = bedside.filter(s => s.staffStatus === 'ACTIVE' || s.staffStatus === 'RECALLED');
  const manualStaff = roster.find(s => s.id === manualStaffId) || null;
  const roomsFor = (id: string) => rooms.filter(r => r.isOccupied && r.assignedNurseId === id);

  const selectStaff = (staff: NurseStaff) => {
    if (!['ACTIVE', 'RECALLED'].includes(staff.staffStatus)) return;
    setManualStaffId(manualStaffId === staff.id ? null : staff.id);
  };
  const rapidAssign = (room: PatientRoom) => {
    if (!manualStaffId || !room.isOccupied) return;
    onAssignRoom(room.roomNumber, room.assignedNurseId === manualStaffId ? null : manualStaffId);
  };
  const clearStaff = (staffId: string) => roomsFor(staffId).forEach(r => onAssignRoom(r.roomNumber, null));
  const clearAll = () => occupied.filter(r => r.assignedNurseId).forEach(r => onAssignRoom(r.roomNumber, null));
  const recallPrevious = () => {
    let recalled = 0;
    let noToken = 0;
    let noActiveMatch = 0;
    let alreadyAssigned = 0;
    occupied.forEach(room => {
      if (room.assignedNurseId) { alreadyAssigned += 1; return; }
      if (!room.patientStayId) { noToken += 1; return; }
      const continuity = StorageService.findContinuity(room.patientStayId, roster);
      if (continuity) {
        onAssignRoom(room.roomNumber, continuity.nurseId);
        recalled += 1;
      } else noActiveMatch += 1;
    });
    if (recalled > 0) {
      setRecallMessage(`Recalled ${recalled} previous assignment${recalled === 1 ? '' : 's'}. Existing manual assignments were preserved.`);
    } else {
      const detail = [noToken ? `${noToken} room${noToken === 1 ? '' : 's'} missing a Stay Token` : '', noActiveMatch ? `${noActiveMatch} with no active prior-nurse match` : '', alreadyAssigned ? `${alreadyAssigned} already assigned` : ''].filter(Boolean).join(' • ');
      setRecallMessage(`No previous assignments recalled${detail ? ` — ${detail}.` : '.'}`);
    }
  };

  const renderRoomCard = (room: PatientRoom) => {
    const meta = ROOM_METADATA_MAP[room.roomNumber];
    const roomWarnings = warnings.filter(w => w.roomNumber === room.roomNumber);
    const continuity = StorageService.findContinuity(room.patientStayId, roster);
    const assigned = roster.find(n => n.id === room.assignedNurseId);
    const acuityColor = {
      CVICU: 'bg-rose-100 text-rose-800 border-rose-300',
      ICU: 'bg-amber-100 text-amber-800 border-amber-300',
      PCU: 'bg-blue-100 text-blue-800 border-blue-300',
      TELE: 'bg-emerald-100 text-emerald-800 border-emerald-300'
    }[room.acuity];

    return <div key={room.roomNumber} className={`p-3 rounded-lg border text-sm shadow-sm ${room.isOccupied ? 'bg-white border-slate-200' : 'bg-slate-50 border-dashed border-slate-300 opacity-70'}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <button type="button" onClick={() => rapidAssign(room)} className={`font-black text-base tracking-tight rounded px-2 py-1 ${manualStaffId && room.isOccupied ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-300' : 'text-slate-900'}`} title={manualStaffId && room.isOccupied ? `Assign ${room.roomNumber} to ${manualStaff?.name}` : undefined}>{room.roomNumber}{room.assignedNurseId ? ' ✓' : ''}</button>
        <button onClick={() => onRoomChange({ ...room, isOccupied: !room.isOccupied, assignedNurseId: room.isOccupied ? null : room.assignedNurseId })} className={`text-xs px-2 py-0.5 rounded font-medium ${room.isOccupied ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-200 text-slate-600'}`}>{room.isOccupied ? 'Occupied' : 'Empty'}</button>
      </div>

      {room.isOccupied && <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <input value={room.patientStayId} onChange={e => onRoomChange({ ...room, patientStayId: e.target.value })} placeholder="Stay token" className="min-w-0 flex-1 text-[11px] text-slate-500 font-mono border border-slate-200 rounded px-1.5 py-1 bg-white" />
          <select value={room.acuity} onChange={e => onRoomChange({ ...room, acuity: e.target.value as PatientRoom['acuity'], acuityConfirmed: true })} className={`text-xs font-bold px-2 py-1 rounded border ${acuityColor}`}><option>CVICU</option><option>ICU</option><option>PCU</option><option>TELE</option></select>
        </div>

        <div className="flex flex-wrap gap-1">{FLAG_OPTIONS.map(flag => { const active = room.flags.includes(flag); return <button key={flag} type="button" onClick={() => { let next = active ? room.flags.filter(f => f !== flag) : [...room.flags, flag]; if (!active && flag === 'Expected DC') next = next.filter(f => f !== 'Possible DC'); if (!active && flag === 'Possible DC') next = next.filter(f => f !== 'Expected DC'); onRoomChange({ ...room, flags: next }); }} className={`text-[9px] px-1.5 py-0.5 rounded font-medium border ${active ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-slate-400 border-slate-200'}`}>{flag}</button>; })}</div>

        {continuity && <div className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded">↩ Previous: {firstName(continuity.nurseName)} ({continuity.daysAgo} shift{continuity.daysAgo === 1 ? '' : 's'} back)</div>}
        {roomWarnings.map((w, idx) => <div key={idx} className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded flex gap-1"><AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />{w.message}</div>)}

        <div><label className="text-[9px] uppercase font-bold text-slate-400 block">Assigned RN</label><select value={room.assignedNurseId || ''} onChange={e => onAssignRoom(room.roomNumber, e.target.value || null)} className="w-full text-xs bg-slate-50 border border-slate-300 rounded px-2 py-1"><option value="">-- Unassigned --</option>{activeNurses.map(n => <option key={n.id} value={n.id}>{pairLabel(n, roster)} ({n.role}) - {n.capability}</option>)}</select>{assigned && <div className="text-[9px] text-slate-500 mt-0.5">Current: <b>{pairLabel(assigned, roster)}</b></div>}</div>
      </div>}
    </div>;
  };

  return <div className="grid grid-cols-1 xl:grid-cols-[250px_minmax(0,1fr)] gap-4 items-start">
    <aside className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden xl:sticky xl:top-4">
      <div className="px-3 py-2 bg-slate-900 text-white"><div className="flex items-center justify-between gap-2"><div><div className="text-xs font-black uppercase">Tomorrow Assignment Board</div><div className="text-[9px] text-slate-300">Select RN → tap room numbers. Recall continuity first if useful.</div></div><button onClick={clearAll} className="text-[9px] border border-slate-600 rounded px-2 py-1">Clear All</button></div><button onClick={recallPrevious} className="mt-2 w-full bg-emerald-700 hover:bg-emerald-600 rounded px-2 py-1.5 text-[10px] font-black flex items-center justify-center gap-1"><RotateCcw className="w-3 h-3"/>Recall Previous Assignments</button>{recallMessage && <div className="mt-2 rounded bg-slate-800 px-2 py-1.5 text-[9px] text-slate-200">{recallMessage}</div>}</div>
      <div className="divide-y divide-slate-100">{bedside.map(staff => { const rs = roomsFor(staff.id), selected = manualStaffId === staff.id, canAssign = ['ACTIVE','RECALLED'].includes(staff.staffStatus); return <div key={staff.id} className={`p-2 ${selected ? 'bg-indigo-50' : ''}`}><div className="flex items-center justify-between gap-1"><button disabled={!canAssign} onClick={() => selectStaff(staff)} className="text-left disabled:opacity-40"><div className={`text-xs font-black ${selected ? 'text-indigo-800' : 'text-slate-900'}`}>{pairLabel(staff, roster)}{staff.role === 'CHG' ? ' • CHG' : ''}</div><div className={`text-[8px] font-black ${selected ? 'text-indigo-700' : 'text-blue-700'}`}>{selected ? 'SELECTED — TAP ROOMS' : 'RAPID ASSIGN'}</div></button><div className="flex items-center gap-1"><span className="text-[9px] text-slate-500">{rs.length} pt</span>{rs.length > 0 && <button onClick={() => clearStaff(staff.id)} className="text-[8px] font-bold text-rose-700 border border-rose-200 rounded px-1.5 py-0.5">Clear</button>}</div></div><div className="flex flex-wrap gap-1 mt-1">{rs.map(r => <span key={r.roomNumber} className="inline-flex rounded border bg-slate-50 text-[9px] font-black"><span className="px-1.5 py-1">{r.roomNumber}</span><button onClick={() => onAssignRoom(r.roomNumber, null)} className="px-1 border-l"><X className="w-2.5 h-2.5"/></button></span>)}{!rs.length && <span className="text-[9px] text-slate-400">—</span>}</div></div>; })}</div>
      <div className={`p-2 border-t ${unassigned.length ? 'bg-rose-50' : 'bg-emerald-50'}`}><div className={`text-[10px] font-black ${unassigned.length ? 'text-rose-800' : 'text-emerald-800'}`}>NEEDS ASSIGNMENT ({unassigned.length})</div><div className="flex flex-wrap gap-1 mt-1">{unassigned.map(r => <button key={r.roomNumber} onClick={() => rapidAssign(r)} className="px-1.5 py-1 rounded border border-rose-300 bg-white text-[9px] font-black text-rose-800">{r.roomNumber}</button>)}</div></div>
    </aside>

    <section className="space-y-3">
      {manualStaff && <div className="bg-indigo-50 border-2 border-indigo-300 rounded-xl px-4 py-3 flex justify-between gap-3"><div><div className="text-xs font-black uppercase text-indigo-900">Rapid Tomorrow Assignment Active</div><div className="text-sm text-indigo-900"><b>{pairLabel(manualStaff, roster)}</b> selected — tap room numbers to assign/unassign.</div></div><button onClick={() => setManualStaffId(null)} className="bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-indigo-800">Done</button></div>}
      <div className="bg-white border border-slate-200 rounded-xl p-4"><div className="mb-3"><h3 className="font-black text-sm uppercase text-slate-900">Tomorrow Rooms 101–122</h3><p className="text-[10px] text-slate-500">One continuous planning board. Hall divider columns removed; geography is still used by the recommendation engine.</p></div><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3">{[...rooms].sort((a,b)=>Number(a.roomNumber)-Number(b.roomNumber)).map(renderRoomCard)}</div></div>
    </section>
  </div>;
};
