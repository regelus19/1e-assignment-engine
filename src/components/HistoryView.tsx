import React from 'react';
import { CurrentShiftState, OperationalEvent, PlanBaseline, FinalizedShiftSnapshot } from '../types';

interface Props {
  plan: PlanBaseline | null;
  current: CurrentShiftState;
  history: FinalizedShiftSnapshot[];
  events: OperationalEvent[];
}

const countByAcuity = (rooms: CurrentShiftState['rooms']) => ({
  CVICU: rooms.filter(r => r.isOccupied && r.acuity === 'CVICU').length,
  ICU: rooms.filter(r => r.isOccupied && r.acuity === 'ICU').length,
  PCU: rooms.filter(r => r.isOccupied && r.acuity === 'PCU').length,
  TELE: rooms.filter(r => r.isOccupied && r.acuity === 'TELE').length,
});

export const HistoryView: React.FC<Props> = ({ plan, current, history, events }) => {
  const currentCensus = current.rooms.filter(r => r.isOccupied).length;
  const planCensus = plan?.rooms.filter(r => r.isOccupied).length ?? 0;
  const currentActiveRNs = current.roster.filter(s => s.role === 'RN' && ['ACTIVE','RECALLED'].includes(s.staffStatus)).length;
  const plannedActiveRNs = plan?.roster.filter(s => s.role === 'RN' && ['ACTIVE','RECALLED'].includes(s.staffStatus)).length ?? 0;
  const currentAcuity = countByAcuity(current.rooms);
  const planAcuity = plan ? countByAcuity(plan.rooms) : { CVICU: 0, ICU: 0, PCU: 0, TELE: 0 };
  const relevantEvents = events.filter(e => e.shiftDate === current.date && e.shiftType === current.shiftType);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h2 className="font-black text-base uppercase tracking-wide">Planned vs Actual</h2>
        <p className="text-xs text-slate-500 mt-1">This comparison is the foundation for future throughput and staffing analytics.</p>
        {!plan ? <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-900">No saved plan baseline yet. Finalize tomorrow's plan first, then initialize Current Staffing from it.</div> : <div className="overflow-x-auto mt-4"><table className="w-full text-sm"><thead className="bg-slate-50 text-slate-500 uppercase text-xs"><tr><th className="text-left p-3">Measure</th><th className="text-left p-3">Planned</th><th className="text-left p-3">Current Actual</th><th className="text-left p-3">Variance</th></tr></thead><tbody>
          <tr className="border-t"><td className="p-3 font-bold">Census</td><td className="p-3">{planCensus}</td><td className="p-3">{currentCensus}</td><td className="p-3 font-bold">{currentCensus - planCensus >= 0 ? '+' : ''}{currentCensus - planCensus}</td></tr>
          <tr className="border-t"><td className="p-3 font-bold">Active bedside RNs</td><td className="p-3">{plannedActiveRNs}</td><td className="p-3">{currentActiveRNs}</td><td className="p-3 font-bold">{currentActiveRNs - plannedActiveRNs >= 0 ? '+' : ''}{currentActiveRNs - plannedActiveRNs}</td></tr>
          {(['CVICU','ICU','PCU','TELE'] as const).map(level => <tr key={level} className="border-t"><td className="p-3 font-bold">{level} patients</td><td className="p-3">{planAcuity[level]}</td><td className="p-3">{currentAcuity[level]}</td><td className="p-3">{currentAcuity[level] - planAcuity[level] >= 0 ? '+' : ''}{currentAcuity[level] - planAcuity[level]}</td></tr>)}
          <tr className="border-t"><td className="p-3 font-bold">Recorded midshift changes</td><td className="p-3">—</td><td className="p-3">{relevantEvents.length}</td><td className="p-3">Operational history</td></tr>
        </tbody></table></div>}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-black text-sm uppercase tracking-wide mb-3">Saved Shift Snapshots</h3>
        {history.length === 0 ? <p className="text-xs text-slate-500">No finalized actual snapshots yet.</p> : <div className="space-y-2">{history.slice(0, 12).map(s => <div key={s.id} className="border border-slate-200 rounded-lg p-3 flex flex-wrap justify-between gap-2 text-xs"><div><b>{s.date} • {s.shiftType}</b><div className="text-slate-500">Saved {new Date(s.finalizedAt).toLocaleString()}</div></div><div className="flex gap-4"><span>Census <b>{s.rooms.filter(r => r.isOccupied).length}</b></span><span>Warnings <b>{s.warnings.length}</b></span></div></div>)}</div>}
      </div>
    </div>
  );
};
