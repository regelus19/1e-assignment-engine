import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, Ban, Brain, CircleDot, Droplets, HeartPulse, Home, LogIn, LogOut, MoveRight, RotateCcw, ShieldAlert, Users, Wind, X } from 'lucide-react';
import floorPlanImage from '../assets/1e-floorplan.png';
import { AcuityLevel, ComplexityFlag, CurrentShiftState, NurseStaff, PatientRoom, StaffStatus } from '../types';
import { RapidRoomTools } from './RapidRoomTools';

interface Props { currentShift: CurrentShiftState; onRoomChange: (room: PatientRoom) => void; onAssignRoom: (roomNumber: string, nurseId: string | null) => void; onStaffStatusChange: (staff: NurseStaff, status: StaffStatus) => void; onRecallPrevious: () => void; }
type RoomPosition = { left: number; top: number };

const ROOM_POSITIONS: Record<string, RoomPosition> = {
  '101': { left: 85.2, top: 88.5 }, '102': { left: 85.2, top: 74.2 }, '103': { left: 85.2, top: 61.4 }, '104': { left: 85.2, top: 48.0 }, '105': { left: 85.2, top: 35.5 }, '106': { left: 85.2, top: 17.4 },
  '107': { left: 57.0, top: 24.0 }, '108': { left: 57.0, top: 34.0 }, '109': { left: 57.0, top: 44.0 }, '110': { left: 57.0, top: 58.8 }, '111': { left: 57.0, top: 68.8 }, '112': { left: 57.0, top: 78.8 }, '113': { left: 57.0, top: 88.6 },
  '114': { left: 17.2, top: 88.4 }, '115': { left: 17.2, top: 78.2 }, '116': { left: 17.2, top: 68.4 }, '117': { left: 17.2, top: 59.0 }, '118': { left: 17.2, top: 50.4 }, '119': { left: 17.2, top: 40.7 }, '120': { left: 17.2, top: 33.0 }, '121': { left: 17.2, top: 24.0 }, '122': { left: 17.2, top: 14.8 },
};

const ACUITY_STYLES: Record<AcuityLevel, { badge: string; room: string }> = {
  CVICU: { badge: 'bg-rose-100 text-rose-800 border-rose-200', room: 'bg-rose-200/90 border-rose-500 text-rose-950' },
  ICU: { badge: 'bg-orange-100 text-orange-800 border-orange-200', room: 'bg-orange-200/90 border-orange-500 text-orange-950' },
  PCU: { badge: 'bg-blue-100 text-blue-800 border-blue-200', room: 'bg-blue-200/90 border-blue-500 text-blue-950' },
  TELE: { badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', room: 'bg-emerald-200/90 border-emerald-500 text-emerald-950' },
};

const FLAGS: { flag: ComplexityFlag; label: string; icon: React.ReactNode }[] = [
  { flag: 'Vent', label: 'Vent', icon: <Wind className="w-3.5 h-3.5" /> }, { flag: 'Pressors', label: 'Pressors', icon: <Activity className="w-3.5 h-3.5" /> },
  { flag: 'Impella/IABP', label: 'Impella/IABP', icon: <HeartPulse className="w-3.5 h-3.5" /> }, { flag: 'Fresh Post-Op', label: 'Fresh Post Op', icon: <CircleDot className="w-3.5 h-3.5" /> },
  { flag: 'HD/Dialysis', label: 'HD/Dialysis', icon: <Droplets className="w-3.5 h-3.5" /> }, { flag: 'Isolation', label: 'Isolation', icon: <ShieldAlert className="w-3.5 h-3.5" /> },
  { flag: 'Sitter/Safety', label: 'Sitter/Safety', icon: <Users className="w-3.5 h-3.5" /> }, { flag: 'High Fall Risk', label: 'High Fall Risk', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
  { flag: 'Confused', label: 'Confused', icon: <Brain className="w-3.5 h-3.5" /> }, { flag: 'Admission', label: 'Recent Admission', icon: <LogIn className="w-3.5 h-3.5" /> },
  { flag: 'Transfer', label: 'Pending Transfer', icon: <MoveRight className="w-3.5 h-3.5" /> },
  { flag: 'Possible DC', label: 'Possible DC', icon: <Home className="w-3.5 h-3.5 text-amber-500" /> },
  { flag: 'Expected DC', label: 'Expected DC', icon: <Home className="w-3.5 h-3.5 text-emerald-600" /> },
  { flag: 'BLOCKED', label: 'BLOCKED', icon: <Ban className="w-3.5 h-3.5" /> },
  { flag: 'Discharge', label: 'Discharge', icon: <LogOut className="w-3.5 h-3.5" /> },
];

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const pairLabel = (staff: NurseStaff, roster: NurseStaff[]) => {
  if (staff.role !== 'Preceptor' || !staff.orientationPartnerId) return firstName(staff.name);
  const partner = roster.find(x => x.id === staff.orientationPartnerId);
  return partner ? `${firstName(staff.name)} / ${firstName(partner.name)}` : firstName(staff.name);
};
const isBedsideRole = (staff: NurseStaff) => ['RN', 'CHG', 'Preceptor'].includes(staff.role);
const canReceivePatients = (staff: NurseStaff) => isBedsideRole(staff) && ['ACTIVE', 'RECALLED'].includes(staff.staffStatus);
const dischargeHouse = (room: PatientRoom, size='w-3 h-3') => room.flags.includes('Expected DC')
  ? <Home aria-label="Expected discharge" title="Expected DC" className={`${size} inline-block text-emerald-600 fill-emerald-100`} />
  : room.flags.includes('Possible DC')
    ? <Home aria-label="Possible discharge" title="Possible DC" className={`${size} inline-block text-amber-500 fill-amber-100`} />
    : null;

export const FloorPlanCurrentStaffing: React.FC<Props> = ({ currentShift, onRoomChange, onAssignRoom, onRecallPrevious }) => {
  const occupied = currentShift.rooms.filter(r => r.isOccupied);
  const unassigned = occupied.filter(r => !r.assignedNurseId);
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(occupied[0]?.roomNumber || '101');
  const [manualStaffId, setManualStaffId] = useState<string | null>(null);
  const selectedRoom = currentShift.rooms.find(r => r.roomNumber === selectedRoomNumber) || currentShift.rooms[0];
  const assignedNurse = currentShift.roster.find(s => s.id === selectedRoom?.assignedNurseId);
  const manualStaff = currentShift.roster.find(s => s.id === manualStaffId) || null;
  const rosterRows = useMemo(() => currentShift.roster, [currentShift.roster]);
  const assignableStaff = useMemo(() => currentShift.roster.filter(canReceivePatients), [currentShift.roster]);

  const roomsFor = (id: string) => currentShift.rooms.filter(r => r.isOccupied && r.assignedNurseId === id);
  const setAcuity = (acuity: AcuityLevel) => selectedRoom && onRoomChange({ ...selectedRoom, acuity, acuityConfirmed: true, isOccupied: true });
  const toggleFlag = (flag: ComplexityFlag) => {
    if (!selectedRoom) return;
    const exists = selectedRoom.flags.includes(flag);
    let flags = exists ? selectedRoom.flags.filter(f => f !== flag) : [...selectedRoom.flags, flag];
    if (!exists && flag === 'Expected DC') flags = flags.filter(f => f !== 'Possible DC');
    if (!exists && flag === 'Possible DC') flags = flags.filter(f => f !== 'Expected DC');
    onRoomChange({ ...selectedRoom, flags });
  };
  const selectStaff = (staff: NurseStaff) => {
    if (!canReceivePatients(staff)) return;
    setManualStaffId(manualStaffId === staff.id ? null : staff.id);
  };
  const roomClick = (room: PatientRoom) => {
    setSelectedRoomNumber(room.roomNumber);
    if (manualStaffId && room.isOccupied) onAssignRoom(room.roomNumber, room.assignedNurseId === manualStaffId ? null : manualStaffId);
  };
  const clearStaff = (staffId: string) => roomsFor(staffId).forEach(room => onAssignRoom(room.roomNumber, null));
  const clearAll = () => occupied.filter(r => r.assignedNurseId).forEach(room => onAssignRoom(room.roomNumber, null));

  return <div className="grid grid-cols-1 2xl:grid-cols-[240px_minmax(0,1fr)_300px] gap-4 items-start">
    <aside className="space-y-3">
      <RapidRoomTools rooms={currentShift.rooms} onRoomChange={onRoomChange} />

      <div className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-900 text-white">
          <div className="flex items-center justify-between gap-2">
            <div><div className="text-xs font-black uppercase">Live Assignment Board</div><div className="text-[9px] text-slate-300">Mirrors all {rosterRows.length} staffing-roster rows in the same order. Only active bedside nurses can receive rooms.</div></div>
            <button type="button" onClick={clearAll} className="text-[9px] font-bold border border-slate-600 rounded px-2 py-1 hover:bg-slate-800">Clear All</button>
          </div>
          <button type="button" onClick={onRecallPrevious} className="mt-2 w-full flex items-center justify-center gap-1.5 text-[9px] font-black border border-indigo-300 bg-indigo-500/20 text-indigo-100 rounded px-2 py-1.5 hover:bg-indigo-500/30" title="Restore matching previous patient-to-nurse assignments without overwriting any rooms you already assigned manually"><RotateCcw className="w-3 h-3"/>Recall Previous Assignments</button>
        </div>
        <div className="divide-y divide-slate-100">{rosterRows.map(staff => {
          const rs = roomsFor(staff.id), selected = manualStaffId === staff.id, canAssign = canReceivePatients(staff);
          const rowStatus = canAssign
            ? (selected ? 'SELECTED — TAP ROOMS' : 'RAPID ASSIGN')
            : isBedsideRole(staff)
              ? `${staff.staffStatus} — NOT ASSIGNABLE`
              : staff.role === 'Orientee'
                ? 'ORIENTEE — PAIRED / NO INDEPENDENT LOAD'
                : `${staff.role.toUpperCase()} — SUPPORT / NO PATIENT LOAD`;
          return <div key={staff.id} className={`p-2 ${selected ? 'bg-indigo-50' : !canAssign ? 'bg-slate-50/70' : ''}`}>
            <div className="flex items-center justify-between gap-1"><button disabled={!canAssign} onClick={() => selectStaff(staff)} className="text-left disabled:cursor-default"><div className={`text-xs font-black ${selected ? 'text-indigo-800' : canAssign ? 'text-slate-900' : 'text-slate-500'}`}>{pairLabel(staff, currentShift.roster)} <span className="font-bold">• {staff.role}</span></div><div className={`text-[8px] font-black ${selected ? 'text-indigo-700' : canAssign ? 'text-blue-700' : 'text-slate-400'}`}>{rowStatus}</div></button><div className="flex items-center gap-1">{canAssign && <span className="text-[9px] text-slate-500">{rs.length} pt</span>}{rs.length > 0 && <button type="button" onClick={() => clearStaff(staff.id)} className="text-[8px] font-bold text-rose-700 border border-rose-200 rounded px-1.5 py-0.5">Clear</button>}</div></div>
            <div className="flex flex-wrap gap-1 mt-1">{rs.map(r => <span key={r.roomNumber} className={`inline-flex items-center rounded border text-[9px] font-black ${ACUITY_STYLES[r.acuity].badge}`}><button onClick={() => setSelectedRoomNumber(r.roomNumber)} className="px-1.5 py-1 inline-flex items-center gap-0.5">{r.roomNumber}{dischargeHouse(r,'w-2.5 h-2.5')}</button><button title={`Unassign ${r.roomNumber}`} onClick={() => onAssignRoom(r.roomNumber, null)} className="px-1 border-l border-current/20">×</button></span>)}{!rs.length && <span className="text-[9px] text-slate-400">—</span>}</div>
          </div>;
        })}</div>
        <div className={`p-2 border-t ${unassigned.length ? 'bg-rose-50' : 'bg-emerald-50'}`}><div className={`text-[10px] font-black ${unassigned.length ? 'text-rose-800' : 'text-emerald-800'}`}>NEEDS ASSIGNMENT ({unassigned.length})</div><div className="flex flex-wrap gap-1 mt-1">{unassigned.map(r => <button key={r.roomNumber} onClick={() => setSelectedRoomNumber(r.roomNumber)} className="px-1.5 py-1 rounded border border-rose-300 bg-white text-[9px] font-black text-rose-800 inline-flex items-center gap-0.5">{r.roomNumber}{dischargeHouse(r,'w-2.5 h-2.5')}</button>)}{!unassigned.length && <span className="text-[9px] font-bold text-emerald-700">All assigned ✓</span>}</div></div>
      </div>
    </aside>

    <section className="min-w-0 space-y-3">
      {manualStaff && <div className="bg-indigo-50 border-2 border-indigo-400 rounded-xl px-4 py-3 flex justify-between gap-3"><div><div className="text-xs font-black uppercase text-indigo-900">Rapid Manual Assignment Active</div><div className="text-sm text-indigo-900"><b>{pairLabel(manualStaff, currentShift.roster)}</b> selected — click occupied rooms in succession. Clicking one of the same nurse's rooms again unassigns it.</div></div><button onClick={() => setManualStaffId(null)} className="bg-white border border-indigo-300 rounded-lg px-3 py-2 text-xs font-bold text-indigo-800 flex items-center gap-1"><X className="w-3.5 h-3.5" />Done</button></div>}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b flex justify-between"><div><h2 className="font-black text-sm">1 East Floor Plan — Current Staffing</h2><p className="text-[11px] text-slate-500">✓ assigned • red outline needs assignment • yellow house = Possible DC • green house = Expected DC.</p></div><div className="text-[11px] text-slate-500">Selected: <b>{selectedRoom?.roomNumber}</b></div></div>
        <div className="relative bg-slate-50 overflow-hidden" style={{ aspectRatio: '1365 / 1152' }}>
          <img src={floorPlanImage} alt="1 East unit floor plan" className="absolute inset-0 w-full h-full object-contain opacity-75" />
          {currentShift.rooms.map(r => {
            const pos = ROOM_POSITIONS[r.roomNumber]; if (!pos) return null;
            const nurse = currentShift.roster.find(s => s.id === r.assignedNurseId);
            const need = r.isOccupied && !r.assignedNurseId;
            const selected = r.roomNumber === selectedRoom?.roomNumber;
            const belongs = !!manualStaffId && r.assignedNurseId === manualStaffId;
            const acuityMissing = r.isOccupied && r.acuityConfirmed === false;
            const style = !r.isOccupied ? 'bg-white/90 border-slate-400 text-slate-500' : acuityMissing ? 'bg-amber-100 border-amber-500 text-amber-950' : ACUITY_STYLES[r.acuity].room;
            return <button key={r.roomNumber} onClick={() => roomClick(r)} className={`absolute -translate-x-1/2 -translate-y-1/2 w-[5.7%] min-w-[44px] rounded-md border-2 shadow-sm px-1 py-1 text-center ${style} ${selected ? 'ring-4 ring-slate-900/20 z-20' : 'z-10'} ${need ? 'outline outline-4 outline-rose-500/70' : ''} ${belongs ? 'ring-4 ring-indigo-500/70' : ''}`} style={{ left: `${pos.left}%`, top: `${pos.top}%` }}>
              <div className="font-black text-[11px] flex items-center justify-center gap-0.5">{r.roomNumber}{r.isOccupied && r.assignedNurseId ? ' ✓' : ''}{r.isOccupied && dischargeHouse(r)}</div>
              <div className="text-[8px] font-bold">{r.isOccupied ? (acuityMissing ? 'ACUITY?' : r.acuity) : 'EMPTY'}</div>
              {r.isOccupied && <div className={`text-[8px] truncate ${need ? 'font-black text-rose-800' : ''}`}>{nurse ? pairLabel(nurse, currentShift.roster) : 'UNASSIGNED'}</div>}
              {r.flags.includes('BLOCKED') && <div className="text-[7px] font-black text-rose-900">BLOCKED</div>}
            </button>;
          })}
        </div>
      </div>

      <div className={`rounded-xl border p-3 ${unassigned.length ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300'}`}><div className="flex justify-between"><div><div className="text-xs font-black uppercase">Rooms Needing Assignment</div><div className="text-[10px] text-slate-600">Occupied rooms only.</div></div><div className="text-lg font-black">{unassigned.length}</div></div><div className="flex flex-wrap gap-1 mt-2">{unassigned.map(r => <button key={r.roomNumber} onClick={() => setSelectedRoomNumber(r.roomNumber)} className={`px-2 py-1 rounded border text-[10px] font-black inline-flex items-center gap-1 ${r.acuityConfirmed === false ? 'bg-amber-100 border-amber-300 text-amber-900' : ACUITY_STYLES[r.acuity].badge}`}>{r.roomNumber} • {r.acuityConfirmed === false ? 'ACUITY?' : r.acuity}{dischargeHouse(r)}</button>)}</div></div>

      <div className="bg-white border border-slate-200 rounded-xl p-3"><div className="flex items-center justify-between gap-2"><div><div className="text-xs font-black uppercase text-slate-900">On-Call / QGenda</div><div className="text-[9px] text-slate-500">Displayed from current on-call data. Automation target: QGenda → Outlook calendar → app data source.</div></div><span className="text-[9px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded px-2 py-1">MANUAL SOURCE NOW</span></div><div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-[10px]">{Object.entries({ Intensivist: currentShift.onCall.intensivist, Cardiothoracic: currentShift.onCall.cardiothoracic, 'Acute MI': currentShift.onCall.acuteMI, Cardiology: currentShift.onCall.cardiology, Hospitalist: currentShift.onCall.hospitalist }).map(([label, value]) => <div key={label} className="bg-slate-50 border rounded-lg p-2"><div className="font-black text-[8px] uppercase text-slate-500">{label}</div><div className="font-bold text-slate-800 mt-0.5">{value || '—'}</div></div>)}</div></div>
    </section>

    <aside className="bg-white border border-slate-200 rounded-xl p-4 2xl:sticky 2xl:top-4">{selectedRoom && <>
      <div className="flex justify-between border-b pb-3"><div><div className="text-xl font-black flex items-center gap-1">Room {selectedRoom.roomNumber}{selectedRoom.isOccupied && dischargeHouse(selectedRoom,'w-4 h-4')}</div><div className="text-[11px] text-slate-500">Live room detail</div></div><label className="text-[10px] font-bold"><input type="checkbox" checked={selectedRoom.isOccupied} onChange={e => onRoomChange({ ...selectedRoom, isOccupied: e.target.checked, assignedNurseId: e.target.checked ? selectedRoom.assignedNurseId : null })} /> Occupied</label></div>
      <div className="mt-3"><label className="text-[10px] uppercase font-black text-slate-500">Acuity</label>{selectedRoom.isOccupied && selectedRoom.acuityConfirmed === false && <div className="mb-1 text-[9px] font-black text-amber-700">ACUITY NOT SET — choose one below</div>}<select value={selectedRoom.acuity} onChange={e => setAcuity(e.target.value as AcuityLevel)} className={`w-full border rounded-lg px-3 py-2 text-sm font-black ${selectedRoom.acuityConfirmed === false ? 'bg-amber-50 border-amber-400 text-amber-900' : ACUITY_STYLES[selectedRoom.acuity].badge}`}><option>CVICU</option><option>ICU</option><option>PCU</option><option>TELE</option></select></div>
      <div className="mt-3"><label className="text-[10px] uppercase font-black text-slate-500">Assigned RN</label><select value={selectedRoom.assignedNurseId || ''} onChange={e => onAssignRoom(selectedRoom.roomNumber, e.target.value || null)} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">Unassigned</option>{assignableStaff.map(s => <option key={s.id} value={s.id}>{pairLabel(s, currentShift.roster)} — {s.capability} / {s.staffStatus}</option>)}</select>{assignedNurse && <div className="text-[10px] text-slate-500 mt-1">Current: <b>{pairLabel(assignedNurse, currentShift.roster)}</b></div>}</div>
      <div className="mt-3"><label className="text-[10px] uppercase font-black text-slate-500">Non-PHI Stay Token</label><input value={selectedRoom.patientStayId} onChange={e => onRoomChange({ ...selectedRoom, patientStayId: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
      <div className="mt-4"><div className="text-xs font-black mb-2">Quick Flags</div><div className="grid grid-cols-2 gap-1.5">{FLAGS.map(({ flag, label, icon }) => <button key={flag} onClick={() => toggleFlag(flag)} className={`min-h-9 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-[10px] font-bold text-left ${selectedRoom.flags.includes(flag) ? 'bg-blue-50 border-blue-400 text-blue-800' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>{icon}<span>{label}</span></button>)}</div></div>
    </>}</aside>
  </div>;
};
