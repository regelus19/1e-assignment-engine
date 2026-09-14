import React, { useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, Ban, Brain, ChevronDown, CircleDot, Droplets, HeartPulse, Home,
  Lock, LogIn, LogOut, MoveRight, ShieldAlert, Unlock, Users, Wind, X,
} from 'lucide-react';
import floorPlanImage from '../assets/1e-floorplan.png';
import { ROOM_POSITIONS } from '../config/geography';
import { AcuityLevel, ComplexityFlag, CurrentShiftState, NurseStaff, PatientRoom, StaffStatus } from '../types';

interface Props {
  currentShift: CurrentShiftState;
  onRoomChange: (room: PatientRoom) => void;
  onAssignRoom: (roomNumber: string, nurseId: string | null) => void;
  onStaffStatusChange: (staff: NurseStaff, status: StaffStatus) => void;
  onRecallPrevious: () => void;
  quickMode?: boolean;
  lockedNurseIds?: string[];
  onToggleLock?: (nurseId: string) => void;
  /** Rendered in the Operations tab on phones; shown by the parent on desktop. */
  actions?: React.ReactNode;
}

/*
 * One board, one interaction model, used by BOTH Current Staffing and Next
 * Shift Plan. Previously Current Staffing rendered a cut-down `quickMode`
 * variant that hid rapid acuity coding and every flag control, so the Charge
 * Nurse could not code a room at all on the screen they actually work on.
 */

type Tool =
  | { kind: 'acuity'; value: AcuityLevel }
  | { kind: 'flag'; value: ComplexityFlag }
  | { kind: 'status'; value: 'OCCUPIED' | 'VACANT' }
  | null;

const ACUITIES: AcuityLevel[] = ['CVICU', 'ICU', 'PCU', 'TELE'];

const ACUITY_STYLES: Record<AcuityLevel, { chip: string; badge: string; room: string }> = {
  CVICU: { chip: 'bg-rose-100 border-rose-400 text-rose-900', badge: 'bg-rose-100 text-rose-800 border-rose-200', room: 'bg-rose-200/90 border-rose-500 text-rose-950' },
  ICU: { chip: 'bg-orange-100 border-orange-400 text-orange-900', badge: 'bg-orange-100 text-orange-800 border-orange-200', room: 'bg-orange-200/90 border-orange-500 text-orange-950' },
  PCU: { chip: 'bg-blue-100 border-blue-400 text-blue-900', badge: 'bg-blue-100 text-blue-800 border-blue-200', room: 'bg-blue-200/90 border-blue-500 text-blue-950' },
  TELE: { chip: 'bg-emerald-100 border-emerald-400 text-emerald-900', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200', room: 'bg-emerald-200/90 border-emerald-500 text-emerald-950' },
};

type FlagDef = { flag: ComplexityFlag; label: string; short: string; icon: React.ReactNode; primary?: boolean; vacantOnly?: boolean };

const FLAGS: FlagDef[] = [
  { flag: 'Fresh Post-Op', label: 'Fresh Post-Op', short: 'Post-Op', icon: <CircleDot />, primary: true },
  { flag: 'Possible DC', label: 'Possible DC', short: 'Poss DC', icon: <Home />, primary: true },
  { flag: 'Expected DC', label: 'Expected DC', short: 'Exp DC', icon: <Home />, primary: true },
  { flag: 'Admission', label: 'Recent Admission', short: 'Admit', icon: <LogIn />, primary: true },
  { flag: 'Transfer', label: 'Pending Transfer', short: 'Xfer', icon: <MoveRight />, primary: true },
  { flag: 'Expected Admission', label: 'Expected Admission', short: 'Exp Admit', icon: <LogIn />, primary: true, vacantOnly: true },
  { flag: 'Vent', label: 'Vent', short: 'Vent', icon: <Wind />, primary: true },
  { flag: 'BLOCKED', label: 'BLOCKED', short: 'Blocked', icon: <Ban />, primary: true },
  { flag: 'Pending Surgery', label: 'Pending Surgery', short: 'Pend Surg', icon: <CircleDot /> },
  { flag: 'Pending Procedure', label: 'Pending Procedure', short: 'Pend Proc', icon: <CircleDot /> },
  { flag: 'Vasoactive Support', label: 'Vasoactive Support', short: 'Vasoactive', icon: <Activity /> },
  { flag: 'Inotropic Support', label: 'Inotropic Support', short: 'Inotrope', icon: <HeartPulse /> },
  { flag: 'Impella/IABP', label: 'Impella/IABP', short: 'Impella', icon: <HeartPulse /> },
  { flag: 'HD/Dialysis', label: 'HD/Dialysis', short: 'HD', icon: <Droplets /> },
  { flag: 'Isolation', label: 'Isolation', short: 'Iso', icon: <ShieldAlert /> },
  { flag: 'Sitter/Safety', label: 'Sitter/Safety', short: 'Sitter', icon: <Users /> },
  { flag: 'High Fall Risk', label: 'High Fall Risk', short: 'Fall', icon: <AlertTriangle /> },
  { flag: 'Confused', label: 'Confused', short: 'Confused', icon: <Brain /> },
  { flag: 'Discharge', label: 'Discharged', short: 'DC\u2019d', icon: <LogOut /> },
];

const FLAG_TINT: Partial<Record<ComplexityFlag, string>> = {
  'Expected DC': 'text-emerald-600',
  'Possible DC': 'text-amber-500',
  'Expected Admission': 'text-sky-600',
  BLOCKED: 'text-slate-900',
};

/*
 * Phone layout: the floor plan is positioned by percentage, so below about
 * 1024px the tiles overlap into an unreadable pile. Instead we draw the three
 * wings as columns, in true north-to-south order taken from ROOM_POSITIONS.
 * Geography is preserved (which wing, which end of it); only the drawing goes.
 */
const WINGS: { label: string; rooms: string[] }[] = [
  { label: 'West wing', rooms: [] },
  { label: 'Central', rooms: [] },
  { label: 'East wing', rooms: [] },
];
Object.keys(ROOM_POSITIONS).forEach(r => {
  const n = Number(r);
  WINGS[n <= 106 ? 2 : n <= 113 ? 1 : 0].rooms.push(r);
});
WINGS.forEach(w => w.rooms.sort((a, b) => ROOM_POSITIONS[a].top - ROOM_POSITIONS[b].top));

const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

const linkedPartner = (staff: NurseStaff, roster: NurseStaff[]) =>
  staff.orientationPartnerId
    ? roster.find(x => x.id === staff.orientationPartnerId)
    : roster.find(x => x.orientationPartnerId === staff.id && ['Preceptor', 'Orientee'].includes(x.role));

/** Preceptor and orientee always render on one line: "Renee / Mark". */
const pairLabel = (staff: NurseStaff, roster: NurseStaff[]) => {
  const partner = linkedPartner(staff, roster);
  return partner && staff.role === 'Preceptor' ? `${firstName(staff.name)} / ${firstName(partner.name)}` : firstName(staff.name);
};

const isPairedOrientee = (s: NurseStaff, roster: NurseStaff[]) => s.role === 'Orientee' && linkedPartner(s, roster)?.role === 'Preceptor';
const isBedsideRole = (s: NurseStaff) => ['RN', 'CHG', 'Preceptor'].includes(s.role);
const canReceivePatients = (s: NurseStaff) => isBedsideRole(s) && ['ACTIVE', 'RECALLED'].includes(s.staffStatus);

const roomHasFlag = (r: PatientRoom, f: ComplexityFlag) =>
  f === 'Vasoactive Support' ? r.flags.includes('Vasoactive Support') || r.flags.includes('Pressors') : r.flags.includes(f);

const dischargeHouse = (r: PatientRoom, size = 'w-3 h-3') =>
  r.flags.includes('Expected DC') ? <Home className={`${size} inline-block text-emerald-600 fill-emerald-100`} />
    : r.flags.includes('Possible DC') ? <Home className={`${size} inline-block text-amber-500 fill-amber-100`} />
      : null;

/** Applies a flag toggle, keeping the mutually exclusive discharge states sane. */
const withFlagToggled = (room: PatientRoom, flag: ComplexityFlag): PatientRoom => {
  const active = roomHasFlag(room, flag);
  let flags = room.flags.filter(f => !(flag === 'Vasoactive Support' && (f === 'Pressors' || f === 'Vasoactive Support')) && f !== flag);
  if (!active) {
    flags = [...flags, flag];
    if (flag === 'Expected DC') flags = flags.filter(f => f !== 'Possible DC');
    if (flag === 'Possible DC') flags = flags.filter(f => f !== 'Expected DC');
  }
  return { ...room, flags };
};

const roomFlagIcons = (r: PatientRoom, inline = false) => {
  const items = FLAGS.filter(({ flag }) => flag !== 'Discharge' && roomHasFlag(r, flag));
  if (!items.length) return null;
  return (
    <span className={inline
      ? 'flex gap-0.5 pointer-events-none'
      : 'absolute left-full ml-1 top-1/2 -translate-y-1/2 flex flex-col gap-0.5 pointer-events-none'}>
      {items.slice(0, inline ? 3 : 5).map(({ flag, icon }) => (
        <span key={flag} title={flag} className={`w-4 h-4 rounded bg-white/95 border shadow-sm flex items-center justify-center [&>svg]:w-2.5 [&>svg]:h-2.5 ${FLAG_TINT[flag] || 'text-slate-700'}`}>
          {icon}
        </span>
      ))}
    </span>
  );
};

export const FloorPlanCurrentStaffing: React.FC<Props> = ({
  currentShift, onRoomChange, onAssignRoom, quickMode = false, lockedNurseIds = [], onToggleLock, actions,
}) => {
  const [selectedRoomNumber, setSelectedRoomNumber] = useState(
    () => currentShift.rooms.find(r => r.isOccupied)?.roomNumber || '101',
  );
  const [manualStaffId, setManualStaffId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>(null);
  const [showAllFlags, setShowAllFlags] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<'roster' | 'map' | 'ops'>('map');
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  React.useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 1024);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const occupied = currentShift.rooms.filter(r => r.isOccupied);
  const unassigned = occupied.filter(r => !r.assignedNurseId);
  const uncoded = occupied.filter(r => r.acuityConfirmed === false);
  const locked = new Set(lockedNurseIds);

  const selectedRoom = currentShift.rooms.find(r => r.roomNumber === selectedRoomNumber) || currentShift.rooms[0];
  const manualStaff = currentShift.roster.find(s => s.id === manualStaffId) || null;

  const rosterRows = useMemo(
    () => currentShift.roster.filter(s => !isPairedOrientee(s, currentShift.roster)),
    [currentShift.roster],
  );
  const assignableStaff = useMemo(() => currentShift.roster.filter(canReceivePatients), [currentShift.roster]);
  const roomsFor = (id: string) => currentShift.rooms.filter(r => r.isOccupied && r.assignedNurseId === id);

  // Rapid coding and rapid assignment are mutually exclusive modes, so a tap
  // on a room tile is never ambiguous.
  const pickTool = (next: Exclude<Tool, null>) => {
    setManualStaffId(null);
    setTool(current => (current?.kind === next.kind && current.value === next.value ? null : next));
  };
  const selectStaff = (s: NurseStaff) => {
    if (!canReceivePatients(s)) return;
    setTool(null);
    setManualStaffId(current => (current === s.id ? null : s.id));
  };

  const applyTool = (room: PatientRoom) => {
    if (!tool) return;
    if (tool.kind === 'status') {
      onRoomChange(tool.value === 'OCCUPIED' ? { ...room, isOccupied: true } : { ...room, isOccupied: false, assignedNurseId: null });
      return;
    }
    if (tool.kind === 'acuity') {
      const already = room.acuityConfirmed !== false && room.acuity === tool.value;
      onRoomChange(already ? { ...room, acuityConfirmed: false } : { ...room, acuity: tool.value, acuityConfirmed: true });
      return;
    }
    onRoomChange(withFlagToggled(room, tool.value));
  };

  /*
   * One tap, three meanings, decided by the mode you are already in:
   *   a coding tool is selected -> apply it
   *   a nurse is selected       -> assign or unassign that room
   *   neither                   -> open the room. This is the default,
   *                                because "I tapped a room and nothing
   *                                happened" is the worst possible answer.
   */
  const roomClick = (room: PatientRoom) => {
    setSelectedRoomNumber(room.roomNumber);
    if (tool) { applyTool(room); return; }
    if (manualStaffId && room.isOccupied) {
      onAssignRoom(room.roomNumber, room.assignedNurseId === manualStaffId ? null : manualStaffId);
      return;
    }
    setDetailOpen(true);
  };

  const clearStaff = (id: string) => roomsFor(id).forEach(r => onAssignRoom(r.roomNumber, null));
  const clearAll = () => {
    if (!window.confirm('Clear every RN assignment on this board? Acuity and flags are kept.')) return;
    occupied.filter(r => r.assignedNurseId).forEach(r => onAssignRoom(r.roomNumber, null));
  };

  const toolActive = (candidate: Exclude<Tool, null>) => tool?.kind === candidate.kind && tool.value === candidate.value;
  const visibleFlags = showAllFlags ? FLAGS : FLAGS.filter(f => f.primary);

  const toolBanner = !tool ? null
    : tool.kind === 'acuity' ? `Tap rooms to set ${tool.value} · tap again to clear`
      : tool.kind === 'status' ? `Tap rooms to mark ${tool.value === 'OCCUPIED' ? 'occupied' : 'vacant'}`
        : `Tap rooms to toggle ${FLAGS.find(f => f.flag === tool.value)?.label}`;

  const nurseRail = (
      <aside className="bg-white border-2 border-slate-300 rounded-xl overflow-hidden">
        <div className="px-3 py-2 bg-slate-900 text-white flex justify-between gap-2">
          <div>
            <div className="text-base font-black uppercase leading-none">Quick Assign</div>
            <div className="text-[11px] text-slate-300 mt-0.5">Tap nurse → tap rooms. Repeat.</div>
          </div>
          <button onClick={clearAll} className="text-[10px] font-bold border border-slate-600 rounded px-2 self-start py-1">Clear All</button>
        </div>

        <div className="divide-y">
          {rosterRows.map(staff => {
            const assigned = roomsFor(staff.id);
            const selected = manualStaffId === staff.id;
            const canAssign = canReceivePatients(staff);
            const partner = linkedPartner(staff, currentShift.roster);
            const isLocked = locked.has(staff.id);
            return (
              <div key={staff.id} className={`px-3 py-2 ${selected ? 'bg-indigo-100 ring-2 ring-inset ring-indigo-400' : !canAssign ? 'bg-slate-50' : ''}`}>
                <div className="flex justify-between items-start gap-1">
                  <button disabled={!canAssign} onClick={() => selectStaff(staff)} className="text-left disabled:cursor-default min-w-0">
                    <div className={`text-sm font-black truncate ${selected ? 'text-indigo-900' : canAssign ? 'text-slate-900' : 'text-slate-400'}`}>
                      {pairLabel(staff, currentShift.roster)}
                      <span className="text-[10px] font-bold"> • {staff.role === 'Preceptor' && partner ? 'Preceptor/Orientee' : staff.role}</span>
                    </div>
                    <div className={`text-[9px] font-black ${selected ? 'text-indigo-700' : 'text-blue-700'}`}>
                      {canAssign ? (selected ? 'SELECTED — TAP ROOMS' : 'TAP TO ASSIGN') : `${staff.role} • ${staff.staffStatus}`}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    {canAssign && onToggleLock && (
                      <button
                        onClick={() => onToggleLock(staff.id)}
                        title={isLocked ? 'Unlock — Semi-Auto may add patients' : 'Lock — Semi-Auto will not add patients to this nurse'}
                        className={`rounded border px-1 py-1 ${isLocked ? 'bg-amber-100 border-amber-400 text-amber-800' : 'border-slate-200 text-slate-400'}`}
                      >
                        {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    )}
                    {assigned.length > 0 && (
                      <button onClick={() => clearStaff(staff.id)} className="text-[9px] font-bold text-rose-700 border border-rose-200 rounded px-1.5 py-1">Clear</button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {assigned.map(r => (
                    <span key={r.roomNumber} className={`inline-flex rounded border text-xs font-black ${ACUITY_STYLES[r.acuity].badge}`}>
                      <span className="px-1.5 py-0.5">{r.roomNumber}{dischargeHouse(r)}</span>
                      <button onClick={() => onAssignRoom(r.roomNumber, null)} className="px-1 border-l hover:bg-white/60" title={`Remove ${r.roomNumber}`}>×</button>
                    </span>
                  ))}
                  {!assigned.length && <span className="text-xs text-slate-400">—</span>}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
  );

  const mapColumn = (
      <section className="min-w-0 space-y-1.5">
        {/* Rapid coding strip — available on every board, not just planning. */}
        <div className="bg-white border rounded-xl px-2 py-1.5">
          <div className={isNarrow ? "flex items-center gap-x-3 overflow-x-auto pb-1 [&>div]:shrink-0 [&_button]:shrink-0" : "flex flex-wrap items-center gap-x-3 gap-y-1"}>
            <div className="flex items-center gap-1">
              <span className="text-[9px] font-black uppercase text-slate-500 mr-0.5">Acuity</span>
              {ACUITIES.map(a => (
                <button
                  key={a}
                  onClick={() => pickTool({ kind: 'acuity', value: a })}
                  className={`rounded border-2 px-2 py-1 text-[11px] font-black ${ACUITY_STYLES[a].chip} ${toolActive({ kind: 'acuity', value: a }) ? 'ring-2 ring-slate-900' : 'opacity-80'}`}
                >{a}</button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <span className="text-[9px] font-black uppercase text-slate-500 mr-0.5">Bed</span>
              {(['OCCUPIED', 'VACANT'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => pickTool({ kind: 'status', value: v })}
                  className={`rounded border px-2 py-1 text-[11px] font-black ${toolActive({ kind: 'status', value: v }) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-300'}`}
                >{v === 'OCCUPIED' ? 'Occ' : 'Vac'}</button>
              ))}
            </div>

            <div className={isNarrow ? "flex items-center gap-1" : "flex items-center gap-1 flex-wrap"}>
              <span className="text-[9px] font-black uppercase text-slate-500 mr-0.5">Flag</span>
              {visibleFlags.map(({ flag, short, icon }) => (
                <button
                  key={flag}
                  onClick={() => pickTool({ kind: 'flag', value: flag })}
                  title={FLAGS.find(f => f.flag === flag)?.label}
                  className={`rounded border px-1.5 py-1 text-[10px] font-bold flex items-center gap-1 [&>svg]:w-3 [&>svg]:h-3 ${toolActive({ kind: 'flag', value: flag }) ? 'bg-slate-900 text-white border-slate-900' : `bg-slate-50 border-slate-200 ${FLAG_TINT[flag] || 'text-slate-700'}`}`}
                >{icon}{short}</button>
              ))}
              <button onClick={() => setShowAllFlags(v => !v)} className="rounded border border-slate-200 px-1.5 py-1 text-[10px] font-bold text-slate-500 flex items-center gap-0.5">
                <ChevronDown className={`w-3 h-3 transition-transform ${showAllFlags ? 'rotate-180' : ''}`} />{showAllFlags ? 'Less' : 'More'}
              </button>
            </div>

            {uncoded.length > 0 && !tool && (
              <span className="text-[10px] font-black text-amber-800 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                {uncoded.length} need acuity: {uncoded.map(r => r.roomNumber).join(' ')}
              </span>
            )}
          </div>

          {tool && (
            <div className="mt-1 flex items-center justify-between gap-2 bg-slate-900 text-white rounded px-2 py-1">
              <span className="text-[11px] font-black uppercase">{toolBanner}</span>
              <button onClick={() => setTool(null)} className="border border-slate-600 rounded px-1.5 text-[10px] font-bold flex items-center gap-1"><X className="w-3 h-3" />Done</button>
            </div>
          )}
        </div>

        {manualStaff && (
          <div className="bg-indigo-50 border-2 border-indigo-400 rounded-lg px-3 py-1.5 flex justify-between items-center">
            <div>
              <div className="text-xs font-black uppercase text-indigo-900">Assigning to {pairLabel(manualStaff, currentShift.roster)}</div>
              <div className="text-[11px] text-indigo-900">Tap occupied rooms repeatedly. Tap an assigned room to remove it.</div>
            </div>
            <button onClick={() => setManualStaffId(null)} className="bg-white border rounded px-2 py-1 font-bold"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* ------------------------------------------- FLOOR PLAN */}
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-3 py-1.5 border-b">
            <div className={`rounded-lg border px-2 py-1.5 ${unassigned.length ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300'}`}>
              <div className={isNarrow ? "flex items-center gap-2 overflow-x-auto [&>*]:shrink-0" : "flex items-center gap-2 flex-wrap"}>
                <div className={`text-[11px] font-black uppercase ${unassigned.length ? 'text-rose-800' : 'text-emerald-800'}`}>
                  Needs Assignment — {unassigned.length}
                </div>
                {unassigned.map(r => (
                  <button
                    key={r.roomNumber}
                    onClick={() => roomClick(r)}
                    className="px-2 py-0.5 rounded border-2 border-rose-300 bg-white text-sm font-black text-rose-800 hover:bg-rose-100"
                  >{r.roomNumber}{dischargeHouse(r)}</button>
                ))}
                {!unassigned.length && <span className="text-xs font-bold text-emerald-700">Every occupied room has an RN. ✓</span>}
              </div>
            </div>
          </div>

          {isNarrow ? (
          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50">
            {WINGS.map(wing => (
              <div key={wing.label}>
                <div className="text-[9px] font-black uppercase text-slate-400 text-center pb-1">{wing.label}</div>
                <div className="space-y-1">
                  {wing.rooms.map(roomNumber => {
                    const room = currentShift.rooms.find(r => r.roomNumber === roomNumber);
                    if (!room) return null;
                    const nurse = currentShift.roster.find(x => x.id === room.assignedNurseId);
                    const needsRn = room.isOccupied && !room.assignedNurseId;
                    const acuityMissing = room.isOccupied && room.acuityConfirmed === false;
                    const tone = !room.isOccupied
                      ? 'bg-white border-slate-300 text-slate-400'
                      : acuityMissing ? 'bg-amber-100 border-amber-500 text-amber-950'
                      : ACUITY_STYLES[room.acuity].room;
                    return (
                      <button key={roomNumber} onClick={() => roomClick(room)}
                        className={`w-full rounded-lg border-2 px-1 py-1.5 text-center ${tone}
                          ${needsRn ? 'ring-2 ring-rose-500' : ''}
                          ${room.assignedNurseId === manualStaffId && manualStaffId ? 'ring-2 ring-indigo-500' : ''}
                          ${room.roomNumber === selectedRoom?.roomNumber ? 'ring-2 ring-slate-900' : ''}`}>
                        <div className="font-black text-base leading-none">
                          {room.roomNumber}{room.isOccupied && room.assignedNurseId ? ' ✓' : ''}
                        </div>
                        <div className="text-[9px] font-bold leading-tight">
                          {room.isOccupied ? (acuityMissing ? 'ACUITY?' : room.acuity) : 'empty'}
                        </div>
                        <div className={`text-[9px] leading-tight truncate ${needsRn ? 'font-black text-rose-800' : ''}`}>
                          {room.isOccupied ? (nurse ? firstName(nurse.name) : 'no RN') : '\u00A0'}
                        </div>
                        <div className="flex justify-center gap-0.5 min-h-[10px]">{roomFlagIcons(room, true)}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          ) : (
          <div className="flex justify-center bg-slate-50 overflow-hidden">
            <div className="relative" style={{ width: 'min(100%, calc(62vh * 1.2062))', aspectRatio: '1568 / 1300' }}>
              <img src={floorPlanImage} alt="1 East floor plan" className="absolute inset-0 w-full h-full object-contain opacity-70" />
              {currentShift.rooms.map(room => {
                const pos = ROOM_POSITIONS[room.roomNumber];
                if (!pos) return null;
                const nurse = currentShift.roster.find(s => s.id === room.assignedNurseId);
                const needsRn = room.isOccupied && !room.assignedNurseId;
                const isSelected = room.roomNumber === selectedRoom?.roomNumber;
                const belongsToSelection = !!manualStaffId && room.assignedNurseId === manualStaffId;
                const acuityMissing = room.isOccupied && room.acuityConfirmed === false;
                const style = !room.isOccupied
                  ? 'bg-white/95 border-slate-400 text-slate-500'
                  : acuityMissing
                    ? 'bg-amber-100 border-amber-500 text-amber-950'
                    : ACUITY_STYLES[room.acuity].room;
                return (
                  <button
                    key={room.roomNumber}
                    onClick={() => roomClick(room)}
                                        className={`absolute -translate-x-1/2 -translate-y-1/2 w-[8.5%] min-w-[62px] rounded-md border-2 shadow-md px-1 py-1.5 ${style} ${isSelected ? 'ring-4 ring-slate-900/20 z-20' : 'z-10'} ${needsRn ? 'outline outline-2 outline-rose-500/80' : ''} ${belongsToSelection ? 'ring-4 ring-indigo-500/70' : ''}`}
                    style={{ left: `${pos.left}%`, top: `${pos.top}%` }}
                  >
                    <div className="font-black text-base leading-none">
                      {room.roomNumber}{room.isOccupied && room.assignedNurseId ? ' ✓' : ''}
                    </div>
                    <div className="text-[10px] font-bold leading-tight mt-0.5">
                      {room.isOccupied ? (acuityMissing ? 'ACUITY?' : room.acuity) : room.acuityConfirmed !== false ? `EMPTY · ${room.acuity}` : 'EMPTY'}
                    </div>
                    {room.isOccupied && (
                      <div className={`text-[9px] leading-tight truncate ${needsRn ? 'font-black text-rose-800' : ''}`}>
                        {nurse ? pairLabel(nurse, currentShift.roster) : 'UNASSIGNED'}
                      </div>
                    )}
                    {roomFlagIcons(room)}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          <div className="px-3 py-1 border-t text-[10px] text-slate-500 flex justify-between gap-2">
            <span>{isNarrow ? 'Tap a room to open it. Pick a nurse first to assign.' : 'Tap a room to open it. Select a nurse first to assign instead. Positions come from the 1 East floor plan.'}</span>
            <button onClick={() => setDetailOpen(true)} className="font-bold text-slate-700 underline whitespace-nowrap">Open {selectedRoom?.roomNumber}</button>
          </div>
        </div>
      </section>
  );

  /* Room detail is a real screen, not a hidden gesture. Full-bleed on a
     phone, a side panel on a desktop. */
  const roomDetail = detailOpen && selectedRoom && (
        <>
          <div className="fixed inset-0 bg-slate-900/30 z-40" onClick={() => setDetailOpen(false)} />
          <aside className={isNarrow
            ? 'fixed inset-0 bg-white z-50 overflow-y-auto p-4'
            : 'fixed right-3 top-3 bottom-3 w-[330px] bg-white border-2 border-slate-300 rounded-xl p-4 z-50 overflow-y-auto shadow-2xl'}>
            <div className="flex justify-between items-start border-b pb-3">
              <div>
                <div className="text-2xl font-black">Room {selectedRoom.roomNumber}{dischargeHouse(selectedRoom, 'w-4 h-4')}</div>
                <div className="text-xs text-slate-500">{selectedRoom.isOccupied ? 'Occupied' : 'Vacant'} · tap Done when finished</div>
              </div>
              <button onClick={() => setDetailOpen(false)} className="border rounded p-1"><X className="w-4 h-4" /></button>
            </div>

            <label className="flex items-center gap-2 text-sm font-bold mt-3">
              <input
                type="checkbox"
                checked={selectedRoom.isOccupied}
                onChange={e => onRoomChange({ ...selectedRoom, isOccupied: e.target.checked, assignedNurseId: e.target.checked ? selectedRoom.assignedNurseId : null })}
              />
              Occupied
            </label>

            <div className="mt-3">
              <label className="text-xs font-black uppercase text-slate-500">Acuity</label>
              <div className="grid grid-cols-4 gap-1 mt-1">
                {ACUITIES.map(a => (
                  <button
                    key={a}
                    onClick={() => onRoomChange({ ...selectedRoom, acuity: a, acuityConfirmed: true })}
                    className={`rounded border-2 py-2 text-[11px] font-black ${ACUITY_STYLES[a].chip} ${selectedRoom.acuity === a && selectedRoom.acuityConfirmed !== false ? 'ring-2 ring-slate-900' : 'opacity-70'}`}
                  >{a}</button>
                ))}
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-black uppercase text-slate-500">Assigned RN</label>
              <select
                value={selectedRoom.assignedNurseId || ''}
                onChange={e => onAssignRoom(selectedRoom.roomNumber, e.target.value || null)}
                className="w-full border rounded px-3 py-2 mt-1"
              >
                <option value="">Unassigned</option>
                {assignableStaff.map(s => <option key={s.id} value={s.id}>{pairLabel(s, currentShift.roster)}</option>)}
              </select>
            </div>

            <div className="mt-4">
              <div className="text-xs font-black uppercase text-slate-500 mb-1.5">Flags</div>
              <div className="grid grid-cols-2 gap-1.5">
                {FLAGS.map(({ flag, label, icon }) => (
                  <button
                    key={flag}
                    onClick={() => onRoomChange(withFlagToggled(selectedRoom, flag))}
                    className={`min-h-9 flex items-center gap-1.5 px-2 rounded border text-[11px] font-bold text-left [&>svg]:w-3.5 [&>svg]:h-3.5 [&>svg]:shrink-0 ${roomHasFlag(selectedRoom, flag) ? 'bg-blue-50 border-blue-400' : 'bg-slate-50 border-slate-200'}`}
                  >{icon}{label}</button>
                ))}
              </div>
            </div>
            <button onClick={() => setDetailOpen(false)}
              className="w-full mt-5 bg-blue-600 text-white rounded-lg py-3 font-black text-sm">Done</button>
          </aside>
        </>
  );

  /* ---------------- PHONE: three tabs, because a nurse rail and a floor
     plan cannot share a 390px screen. Same actions, same data, same rules. */
  if (isNarrow) {
    const tabs: { id: typeof mobileTab; label: string; badge?: number }[] = [
      { id: 'roster', label: 'Roster' },
      { id: 'map', label: 'Unit Map', badge: unassigned.length || undefined },
      { id: 'ops', label: 'Operations' },
    ];
    return (
      <div className="relative">
        <div className="grid grid-cols-3 gap-1 bg-slate-200 p-1 rounded-xl sticky top-0 z-30">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setMobileTab(t.id)}
              className={`rounded-lg py-2.5 text-xs font-black flex items-center justify-center gap-1.5 ${mobileTab === t.id ? 'bg-blue-600 text-white shadow' : 'text-slate-600'}`}>
              {t.label}
              {t.badge ? <span className="bg-rose-500 text-white rounded-full px-1.5 text-[10px] leading-4">{t.badge}</span> : null}
            </button>
          ))}
        </div>
        <div className="mt-2">
          {mobileTab === 'roster' && nurseRail}
          {mobileTab === 'map' && mapColumn}
          {mobileTab === 'ops' && (
            <div className="bg-white border-2 border-slate-300 rounded-xl p-3">
              {actions || <p className="text-sm text-slate-500">No actions available on this screen.</p>}
            </div>
          )}
        </div>
        {roomDetail}
      </div>
    );
  }

  /* ---------------- DESKTOP: unchanged side-by-side workspace. */
  return (
    <div className={`grid grid-cols-1 ${quickMode ? 'xl:grid-cols-[270px_minmax(0,1fr)]' : '2xl:grid-cols-[270px_minmax(0,1fr)]'} gap-2 items-start relative`}>
      {nurseRail}
      {mapColumn}
      {roomDetail}
    </div>
  );
};
