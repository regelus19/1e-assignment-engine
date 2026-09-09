import React from 'react';
import { PatientRoom, NurseStaff, AssignmentWarning, ComplexityFlag } from '../types';
import { ROOM_METADATA_MAP } from '../config/geography';
import { StorageService } from '../services/storage';
import { AlertCircle, AlertTriangle, Info, Bed, Phone, ShieldCheck } from 'lucide-react';

interface UnitBoardProps {
  rooms: PatientRoom[];
  roster: NurseStaff[];
  warnings: AssignmentWarning[];
  onRoomChange: (updatedRoom: PatientRoom) => void;
  onAssignRoom: (roomNumber: string, nurseId: string | null) => void;
}

const FLAG_OPTIONS: ComplexityFlag[] = ['Vent', 'Pressors', 'Impella/IABP', 'Fresh Post-Op', 'HD/Dialysis', 'Isolation', 'Sitter/Safety', 'High Fall Risk', 'Confused', 'Admission', 'Transfer', 'Discharge'];

export const UnitBoard: React.FC<UnitBoardProps> = ({
  rooms,
  roster,
  warnings,
  onRoomChange,
  onAssignRoom
}) => {
  const activeNurses = roster.filter(s => s.staffStatus === 'ACTIVE' || s.staffStatus === 'RECALLED');

  const renderRoomCard = (room: PatientRoom) => {
    const meta = ROOM_METADATA_MAP[room.roomNumber];
    const roomWarnings = warnings.filter(w => w.roomNumber === room.roomNumber);
    const continuity = StorageService.findContinuity(room.patientStayId, roster);

    const acuityColor = {
      CVICU: 'bg-rose-100 text-rose-800 border-rose-300',
      ICU: 'bg-amber-100 text-amber-800 border-amber-300',
      PCU: 'bg-blue-100 text-blue-800 border-blue-300',
      TELE: 'bg-slate-100 text-slate-800 border-slate-300'
    }[room.acuity];

    return (
      <div 
        key={room.roomNumber}
        className={`p-3 rounded-lg border text-sm transition-all shadow-sm ${
          room.isOccupied ? 'bg-white border-slate-200 hover:border-blue-400' : 'bg-slate-50/70 border-dashed border-slate-300 opacity-60'
        }`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-black text-base text-slate-900 tracking-tight">{room.roomNumber}</span>
            {meta?.isICUCapable && (
              <span className="text-[10px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                ICU-Cap
              </span>
            )}
            {meta?.isSafetyPreferred && (
              <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                Safety
              </span>
            )}
          </div>
          <button
            onClick={() => onRoomChange({ ...room, isOccupied: !room.isOccupied })}
            className={`text-xs px-2 py-0.5 rounded font-medium ${
              room.isOccupied ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-slate-200 text-slate-600'
            }`}
          >
            {room.isOccupied ? 'Occupied' : 'Empty'}
          </button>
        </div>

        {room.isOccupied && (
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-between">
              <input
                value={room.patientStayId}
                onChange={(e) => onRoomChange({ ...room, patientStayId: e.target.value })}
                placeholder="Stay token (optional)"
                className="w-32 text-[11px] text-slate-500 font-mono border border-slate-200 rounded px-1.5 py-0.5 bg-white"
                title="Non-PHI continuity token only"
              />
              <select
                value={room.acuity}
                onChange={(e) => onRoomChange({ ...room, acuity: e.target.value as any })}
                className={`text-xs font-bold px-2 py-0.5 rounded border ${acuityColor}`}
              >
                <option value="CVICU">CVICU</option>
                <option value="ICU">ICU</option>
                <option value="PCU">PCU</option>
                <option value="TELE">TELE</option>
              </select>
            </div>

            {/* Quick Flag Chips */}
            <div className="flex flex-wrap gap-1">
              {FLAG_OPTIONS.map(flag => {
                const active = room.flags.includes(flag);
                return (
                  <button
                    key={flag}
                    type="button"
                    onClick={() => onRoomChange({
                      ...room,
                      flags: active ? room.flags.filter(f => f !== flag) : [...room.flags, flag]
                    })}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium border ${active ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                  >
                    {flag}
                  </button>
                );
              })}
            </div>

            {/* Continuity Tag */}
            {continuity && (
              <div className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded flex items-center gap-1">
                <span>↩ {continuity.nurseName}</span>
                <span className="text-[10px] text-emerald-600 font-normal">({continuity.daysAgo}d ago)</span>
              </div>
            )}

            {/* Warnings */}
            {roomWarnings.map((w, idx) => (
              <div key={idx} className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded flex items-start gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-600" />
                <span>{w.message}</span>
              </div>
            ))}

            {/* Assigned RN Dropdown */}
            <div className="pt-1">
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Assigned RN</label>
              <select
                value={room.assignedNurseId || ''}
                onChange={(e) => onAssignRoom(room.roomNumber, e.target.value || null)}
                className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded px-2 py-1 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                <option value="">-- Unassigned --</option>
                {activeNurses.filter(n => n.role === 'RN' || n.role === 'CHG').map(n => (
                  <option key={n.id} value={n.id}>
                    {n.name} ({n.role}) - {n.capability}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    );
  };

  const hallA = rooms.filter(r => ROOM_METADATA_MAP[r.roomNumber]?.hall === 'A');
  const hallB = rooms.filter(r => ROOM_METADATA_MAP[r.roomNumber]?.hall === 'B');
  const hallC = rooms.filter(r => ROOM_METADATA_MAP[r.roomNumber]?.hall === 'C');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Hall A */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Hall A (101 - 106)</h3>
          <span className="text-xs text-slate-500 font-medium">CVICU / ICU Focus</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {hallA.map(renderRoomCard)}
        </div>
      </div>

      {/* Hall B */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Hall B (107 - 113)</h3>
          <span className="text-xs text-slate-500 font-medium">Mid / South Zones</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {hallB.map(renderRoomCard)}
        </div>
      </div>

      {/* Hall C */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">Hall C (114 - 122)</h3>
          <span className="text-xs text-slate-500 font-medium">North / Station Central</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {hallC.map(renderRoomCard)}
        </div>
      </div>
    </div>
  );
};
