import React from 'react';
import { NurseStaff, MTCoverageState, PCTCoverageState, StaffRole, CapabilityLevel, StaffStatus, OnCallProviders } from '../types';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  roster: NurseStaff[];
  mtState: MTCoverageState;
  pctState: PCTCoverageState;
  onRosterChange: (roster: NurseStaff[]) => void;
  onMtStateChange: (state: MTCoverageState) => void;
  onPctStateChange: (state: PCTCoverageState) => void;
  onCall: OnCallProviders;
  pmOnCall: OnCallProviders;
  onOnCallChange: (onCall: OnCallProviders) => void;
  onPmOnCallChange: (onCall: OnCallProviders) => void;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] || '';
const onCallFields = ([
  ['intensivist','Intensivist'],
  ['cardiothoracic','Cardiothoracic'],
  ['acuteMI','Acute MI'],
  ['cardiology','Cardiology'],
  ['hospitalist','Hospitalist']
] as const);

export const RosterPlanner: React.FC<Props> = ({ roster, mtState, pctState, onRosterChange, onMtStateChange, onPctStateChange, onCall, pmOnCall, onOnCallChange, onPmOnCallChange }) => {
  const update = (id: string, patch: Partial<NurseStaff>) => onRosterChange(roster.map(s => s.id === id ? { ...s, ...patch } : s));

  const addStaff = () => {
    const id = `n-${Date.now()}`;
    onRosterChange([...roster, { id, name: 'New Staff', role: 'RN', assignedPhone: '', capability: 'PCU_TELE', staffStatus: 'ACTIVE' }]);
  };

  const removeStaff = (id: string) => onRosterChange(roster.filter(s => s.id !== id).map(s => s.orientationPartnerId === id ? { ...s, orientationPartnerId: undefined } : s));

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

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="text-sm font-black uppercase text-slate-500">Monitor Tech Coverage</label>
          <select value={mtState} onChange={e => onMtStateChange(e.target.value as MTCoverageState)} className="mt-2 w-full border rounded-lg px-3 py-2 text-base">
            <option value="MT_PRESENT">MT Present</option><option value="RN_COVERING_MT">RN Covering MT</option><option value="MT_UNFILLED">MT Unfilled</option>
          </select>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <label className="text-sm font-black uppercase text-slate-500">PCT Support</label>
          <select value={pctState} onChange={e => onPctStateChange(e.target.value as PCTCoverageState)} className="mt-2 w-full border rounded-lg px-3 py-2 text-base">
            <option value="PCT_PRESENT">PCT Present</option><option value="PCT_NONE">No PCT</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 className="font-black text-base uppercase tracking-wide">Next Shift Staffing Roster</h3>
            <p className="text-sm text-slate-500 mt-1">Pair a Preceptor with an Orientee/Preceptee once. They will display together as one assignment row, e.g. Renee / Mark.</p>
          </div>
          <button onClick={addStaff} className="text-sm font-bold bg-blue-600 text-white px-3 py-2 rounded-lg flex items-center gap-1"><Plus className="w-4 h-4"/> Add Staff</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase"><tr><th className="text-left p-3">First Name</th><th className="text-left p-3">Role</th><th className="text-left p-3">Orientation Pair</th><th className="text-left p-3">Capability</th><th className="text-left p-3">Status</th><th className="text-left p-3">Phone</th><th className="text-left p-3">MT Coverage</th><th className="p-3"></th></tr></thead>
            <tbody>
              {roster.map(staff => (
                <tr key={staff.id} className="border-t border-slate-100">
                  <td className="p-2"><input value={firstName(staff.name)} onChange={e => update(staff.id, { name: e.target.value })} className="w-28 border rounded px-2 py-2" /></td>
                  <td className="p-2"><select value={staff.role} onChange={e => setRole(staff.id,e.target.value as StaffRole)} className="border rounded px-2 py-2"><option>CHG</option><option>RN</option><option>Preceptor</option><option value="Orientee">Orientee/Preceptee</option><option>MT</option><option>PCT</option><option>Resource</option></select></td>
                  <td className="p-2">{['Preceptor','Orientee'].includes(staff.role) ? <select value={staff.orientationPartnerId || ''} onChange={e => setOrientationPartner(staff.id,e.target.value)} className="border rounded px-2 py-2 min-w-40"><option value="">Select partner</option>{orientationCandidates(staff).map(p => <option key={p.id} value={p.id}>{firstName(p.name)} — {p.role}</option>)}</select> : <span className="text-slate-400">—</span>}</td>
                  <td className="p-2"><select value={staff.capability} onChange={e => update(staff.id, { capability: e.target.value as CapabilityLevel })} className="border rounded px-2 py-2"><option value="CVICU">CVICU</option><option value="ICU">ICU</option><option value="PCU_TELE">PCU/TELE</option></select></td>
                  <td className="p-2"><select value={staff.staffStatus} onChange={e => update(staff.id, { staffStatus: e.target.value as StaffStatus })} className="border rounded px-2 py-2"><option>ACTIVE</option><option>FLEXED</option><option>ON_CALL</option><option>RECALLED</option></select></td>
                  <td className="p-2"><input value={staff.assignedPhone} onChange={e => update(staff.id, { assignedPhone: e.target.value })} className="w-24 border rounded px-2 py-2" /></td>
                  <td className="p-2 text-center"><input type="checkbox" disabled={staff.role !== 'RN'} checked={!!staff.coveringMT} onChange={e => update(staff.id, { coveringMT: e.target.checked })} /></td>
                  <td className="p-2 text-right"><button onClick={() => removeStaff(staff.id)} className="text-rose-600"><Trash2 className="w-4 h-4"/></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="mb-3"><h3 className="font-black text-base uppercase tracking-wide">Next Shift On-Call Providers</h3><p className="text-sm text-slate-500 mt-1">Fill both AM and PM coverage for the planned calendar day. Use separate lines when more than one provider shares coverage.</p></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse table-fixed">
            <colgroup><col className="w-[24%]"/><col className="w-[38%]"/><col className="w-[38%]"/></colgroup>
            <thead><tr className="bg-slate-50"><th className="border p-2 text-left">Service</th><th className="border p-2 text-center font-black">AM Coverage</th><th className="border p-2 text-center font-black">PM Coverage</th></tr></thead>
            <tbody>{onCallFields.map(([key,label]) => (
              <tr key={key}>
                <td className="border p-2 font-black uppercase text-slate-600">{label}</td>
                <td className="border p-2"><textarea rows={key==='cardiothoracic'||key==='hospitalist'?3:2} value={onCall[key]} onChange={e => onOnCallChange({ ...onCall, [key]: e.target.value })} className="w-full border rounded px-2 py-2 text-sm resize-y" placeholder="AM provider(s) / coverage" /></td>
                <td className="border p-2"><textarea rows={key==='cardiothoracic'||key==='hospitalist'?3:2} value={pmOnCall[key]} onChange={e => onPmOnCallChange({ ...pmOnCall, [key]: e.target.value })} className="w-full border rounded px-2 py-2 text-sm resize-y" placeholder="PM provider(s) / coverage" /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
