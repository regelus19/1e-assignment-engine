import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { CapabilityLevel, NurseStaff, StaffRole, StaffStatus } from '../types';

interface Props { roster: NurseStaff[]; onRosterChange: (roster: NurseStaff[]) => void; }
const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';

export const CurrentRosterPanel: React.FC<Props> = ({ roster, onRosterChange }) => {
  const update = (id: string, patch: Partial<NurseStaff>) => onRosterChange(roster.map(staff => staff.id === id ? { ...staff, ...patch } : staff));
  const addStaff = () => onRosterChange([...roster, { id: `current-${Date.now()}`, name: '', role: 'RN', assignedPhone: '', capability: 'PCU_TELE', staffStatus: 'ACTIVE' }]);
  const removeStaff = (id: string) => onRosterChange(roster.filter(staff => staff.id !== id).map(s => s.orientationPartnerId === id ? { ...s, orientationPartnerId: undefined } : s));

  const setRole = (id: string, role: StaffRole) => {
    const leavingPair = !['Preceptor','Orientee'].includes(role);
    onRosterChange(roster.map(s => {
      if (s.id === id) return { ...s, role, orientationPartnerId: leavingPair ? undefined : s.orientationPartnerId };
      if (leavingPair && s.orientationPartnerId === id) return { ...s, orientationPartnerId: undefined };
      return s;
    }));
  };

  const setOrientationPartner = (staffId: string, partnerId: string) => {
    let next = roster.map(s => {
      if (s.id === staffId) return { ...s, orientationPartnerId: partnerId || undefined };
      if (s.orientationPartnerId === staffId) return { ...s, orientationPartnerId: undefined };
      return s;
    });
    if (partnerId) {
      next = next.map(s => {
        if (s.id === partnerId) return { ...s, orientationPartnerId: staffId };
        if (s.id !== staffId && s.orientationPartnerId === partnerId) return { ...s, orientationPartnerId: undefined };
        return s;
      });
    }
    onRosterChange(next);
  };

  const orientationCandidates = (staff: NurseStaff) => roster.filter(s => {
    if (s.id === staff.id) return false;
    if (staff.role === 'Preceptor') return s.role === 'Orientee';
    if (staff.role === 'Orientee') return s.role === 'Preceptor';
    return false;
  });

  return <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
    <div className="p-4 border-b border-slate-200 flex flex-wrap justify-between items-center gap-3"><div><h3 className="font-black text-base uppercase tracking-wide">Current Roster</h3><p className="text-sm text-slate-500 mt-1">Pair a Preceptor with an Orientee/Preceptee once. The pairing is reciprocal and displays as one combined assignment row, e.g. Renee / Mark.</p></div><button type="button" onClick={addStaff} className="text-sm font-bold bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"><Plus className="w-4 h-4"/> Add Staff</button></div>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="text-left p-3">First Name</th><th className="text-left p-3">Role</th><th className="text-left p-3">Orientation Pair</th><th className="text-left p-3">Capability</th><th className="text-left p-3">Status</th><th className="text-left p-3">Phone</th><th className="p-3"></th></tr></thead><tbody>
      {roster.map(staff => <tr key={staff.id} className="border-t border-slate-100"><td className="p-2"><input value={firstName(staff.name)} onChange={e => update(staff.id,{name:e.target.value})} placeholder="First name" className="w-32 border rounded px-2 py-2"/></td><td className="p-2"><select value={staff.role} onChange={e => setRole(staff.id,e.target.value as StaffRole)} className="border rounded px-2 py-2"><option value="CHG">CHG</option><option value="RN">RN</option><option value="Preceptor">Preceptor</option><option value="Orientee">Orientee/Preceptee</option><option value="MT">MT</option><option value="PCT">PCT</option><option value="Resource">Resource</option></select></td><td className="p-2">{['Preceptor','Orientee'].includes(staff.role) ? <select value={staff.orientationPartnerId || ''} onChange={e => setOrientationPartner(staff.id,e.target.value)} className="border rounded px-2 py-2 min-w-40"><option value="">Select partner</option>{orientationCandidates(staff).map(p => <option key={p.id} value={p.id}>{firstName(p.name)} — {p.role}</option>)}</select> : <span className="text-slate-400">—</span>}</td><td className="p-2"><select value={staff.capability} onChange={e => update(staff.id,{capability:e.target.value as CapabilityLevel})} className="border rounded px-2 py-2"><option value="CVICU">CVICU</option><option value="ICU">ICU</option><option value="PCU_TELE">PCU/TELE</option></select></td><td className="p-2"><select value={staff.staffStatus} onChange={e => update(staff.id,{staffStatus:e.target.value as StaffStatus})} className="border rounded px-2 py-2"><option value="ACTIVE">ACTIVE</option><option value="FLEXED">FLEXED</option><option value="ON_CALL">ON CALL</option><option value="RECALLED">RECALLED</option></select></td><td className="p-2"><input value={staff.assignedPhone} onChange={e => update(staff.id,{assignedPhone:e.target.value})} placeholder="Phone" className="w-28 border rounded px-2 py-2"/></td><td className="p-2 text-right"><button type="button" onClick={() => removeStaff(staff.id)} className="text-rose-600 p-1.5 rounded hover:bg-rose-50"><Trash2 className="w-4 h-4"/></button></td></tr>)}
      {roster.length===0 && <tr><td colSpan={7} className="p-4 text-center text-slate-500">No staff entered. Click Add Staff to build the current roster.</td></tr>}
    </tbody></table></div>
  </div>;
};
