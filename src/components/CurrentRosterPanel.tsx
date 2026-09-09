import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CapabilityLevel, NurseStaff, StaffRole, StaffStatus } from '../types';

interface Props {
  roster: NurseStaff[];
  onRosterChange: (roster: NurseStaff[]) => void;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';

export const CurrentRosterPanel: React.FC<Props> = ({ roster, onRosterChange }) => {
  const update = (id: string, patch: Partial<NurseStaff>) => {
    onRosterChange(roster.map(staff => staff.id === id ? { ...staff, ...patch } : staff));
  };

  const addStaff = () => {
    onRosterChange([
      ...roster,
      {
        id: `current-${Date.now()}`,
        name: '',
        role: 'RN',
        assignedPhone: '',
        capability: 'PCU_TELE',
        staffStatus: 'ACTIVE',
      },
    ]);
  };

  const removeStaff = (id: string) => {
    onRosterChange(roster.filter(staff => staff.id !== id));
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div>
          <h3 className="font-black text-sm uppercase tracking-wide">Current Roster</h3>
          <p className="text-xs text-slate-500 mt-1">Enter the staff actually working this shift. Changes immediately feed the floor-plan RN cards and room assignment selector.</p>
        </div>
        <button type="button" onClick={addStaff} className="text-xs font-bold bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Staff
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500 uppercase">
            <tr>
              <th className="text-left p-3">First Name</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Capability</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Phone</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {roster.map(staff => (
              <tr key={staff.id} className="border-t border-slate-100">
                <td className="p-2">
                  <input
                    value={firstName(staff.name)}
                    onChange={e => update(staff.id, { name: e.target.value })}
                    placeholder="First name"
                    className="w-32 border rounded px-2 py-1.5"
                  />
                </td>
                <td className="p-2">
                  <select value={staff.role} onChange={e => update(staff.id, { role: e.target.value as StaffRole })} className="border rounded px-2 py-1.5">
                    <option value="CHG">CHG</option>
                    <option value="RN">RN</option>
                    <option value="MT">MT</option>
                    <option value="PCT">PCT</option>
                    <option value="Resource">Resource</option>
                  </select>
                </td>
                <td className="p-2">
                  <select value={staff.capability} onChange={e => update(staff.id, { capability: e.target.value as CapabilityLevel })} className="border rounded px-2 py-1.5">
                    <option value="CVICU">CVICU</option>
                    <option value="ICU">ICU</option>
                    <option value="PCU_TELE">PCU/TELE</option>
                  </select>
                </td>
                <td className="p-2">
                  <select value={staff.staffStatus} onChange={e => update(staff.id, { staffStatus: e.target.value as StaffStatus })} className="border rounded px-2 py-1.5">
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="FLEXED">FLEXED</option>
                    <option value="ON_CALL">ON CALL</option>
                    <option value="RECALLED">RECALLED</option>
                  </select>
                </td>
                <td className="p-2">
                  <input value={staff.assignedPhone} onChange={e => update(staff.id, { assignedPhone: e.target.value })} placeholder="Phone" className="w-28 border rounded px-2 py-1.5" />
                </td>
                <td className="p-2 text-right">
                  <button type="button" onClick={() => removeStaff(staff.id)} className="text-rose-600 p-1.5 rounded hover:bg-rose-50" title={`Remove ${firstName(staff.name) || 'staff'}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {roster.length === 0 && (
              <tr><td colSpan={6} className="p-4 text-center text-slate-500">No staff entered. Click Add Staff to build the current roster.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
