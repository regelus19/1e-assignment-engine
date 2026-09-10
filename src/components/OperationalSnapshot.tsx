import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, BedDouble, Building2, Save } from 'lucide-react';
import { PatientRoom } from '../types';

export interface OperationalSnapshotData { incomingTransfers: number; edAdmissions: number; orReturns: number; cathEpReturns: number; otherIncoming: number; outgoingTransfers: number; }
interface Props { currentCensus: number; rooms: PatientRoom[]; capacity?: number; }
const KEY = '1E_OPERATIONAL_SNAPSHOT_V2';
const defaults: OperationalSnapshotData = { incomingTransfers: 0, edAdmissions: 0, orReturns: 0, cathEpReturns: 0, otherIncoming: 0, outgoingTransfers: 0 };
const load = (): OperationalSnapshotData => { try { const raw = localStorage.getItem(KEY); return raw ? { ...defaults, ...JSON.parse(raw) } : defaults; } catch { return defaults; } };
const Metric: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => <label className="min-w-[92px] flex-1"><span className="block text-[9px] uppercase font-black tracking-wide text-slate-500 mb-1">{label}</span><input type="number" min="0" value={value} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-black text-center" /></label>;
const ReadOnlyMetric: React.FC<{ label: string; value: number; note: string; emphasis?: string }> = ({ label, value, note, emphasis = 'bg-slate-50 border-slate-200 text-slate-900' }) => <div className={`min-w-[100px] flex-1 border rounded-lg px-2 py-1.5 ${emphasis}`}><div className="text-[9px] uppercase font-black tracking-wide opacity-70">{label}</div><div className="text-lg font-black leading-5">{value}</div><div className="text-[8px] opacity-70">{note}</div></div>;

export const OperationalSnapshot: React.FC<Props> = ({ currentCensus, rooms, capacity = 22 }) => {
  const [data, setData] = useState<OperationalSnapshotData>(load);
  const [saved, setSaved] = useState(false);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(data)); setSaved(false); }, [data]);
  const possibleDC = rooms.filter(r => r.isOccupied && r.flags.includes('Possible DC')).length;
  const expectedDC = rooms.filter(r => r.isOccupied && r.flags.includes('Expected DC')).length;
  const staffedOpenBeds = rooms.filter(r => !r.isOccupied && !!r.assignedNurseId && !r.flags.includes('BLOCKED')).length;
  const staffedBeds = Math.min(capacity, currentCensus + staffedOpenBeds);
  const staffedAvailable = Math.max(0, staffedBeds - currentCensus);
  const incoming = data.incomingTransfers + data.edAdmissions + data.orReturns + data.cathEpReturns + data.otherIncoming;
  const leaving = expectedDC + data.outgoingTransfers;
  const projectedCensus = Math.max(0, currentCensus + incoming - leaving);
  const availableNow = Math.max(0, capacity - currentCensus);
  const projectedAvailable = Math.max(0, capacity - projectedCensus);
  const deficit = Math.max(0, projectedCensus - capacity);
  const pressure = useMemo(() => deficit > 0 ? 'ALERT' : projectedCensus >= 20 ? 'WATCH' : 'OK', [deficit, projectedCensus]);
  const patch = (key: keyof OperationalSnapshotData, value: number) => setData(prev => ({ ...prev, [key]: value }));

  return <section className="bg-white border border-slate-200 rounded-xl no-print shadow-sm overflow-hidden">
    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2"><div><div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-blue-700"/><h2 className="text-xs font-black uppercase tracking-wider text-slate-800">1E Operational Snapshot</h2></div><p className="text-[10px] text-slate-500 mt-0.5">Physical bed availability and staffed bed capacity are shown separately. Staffed open beds come from admission-ready nurse assignments.</p></div><button type="button" onClick={() => { localStorage.setItem(KEY, JSON.stringify(data)); setSaved(true); }} className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-[10px] font-bold flex items-center gap-1"><Save className="w-3 h-3"/>{saved ? 'Saved' : 'Save Flow Inputs'}</button></div>
    <div className="p-3"><div className="flex flex-wrap gap-2 items-stretch">
      <ReadOnlyMetric label="Current Census" value={currentCensus} note={`of ${capacity} physical beds`} emphasis="bg-slate-900 border-slate-900 text-white" />
      <ReadOnlyMetric label="Beds Available" value={availableNow} note="physical empty beds" />
      <ReadOnlyMetric label="Staffed Beds" value={staffedBeds} note={`${staffedAvailable} open & staffed`} emphasis="bg-blue-50 border-blue-300 text-blue-900" />
      <Metric label="Incoming Xfers" value={data.incomingTransfers} onChange={v => patch('incomingTransfers', v)} />
      <Metric label="ED / Direct" value={data.edAdmissions} onChange={v => patch('edAdmissions', v)} />
      <Metric label="OR Returns" value={data.orReturns} onChange={v => patch('orReturns', v)} />
      <Metric label="Cath / EP" value={data.cathEpReturns} onChange={v => patch('cathEpReturns', v)} />
      <ReadOnlyMetric label="Possible DC" value={possibleDC} note="does not reduce projection" emphasis="bg-amber-50 border-amber-300 text-amber-900" />
      <ReadOnlyMetric label="Expected DC" value={expectedDC} note="reduces projection" emphasis="bg-emerald-50 border-emerald-300 text-emerald-900" />
      <Metric label="Outgoing Xfers" value={data.outgoingTransfers} onChange={v => patch('outgoingTransfers', v)} />
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]"><span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2 py-1"><ArrowDownToLine className="w-3 h-3"/>Incoming <b>{incoming}</b></span><span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-1"><ArrowUpFromLine className="w-3 h-3"/>Expected leaving <b>{leaving}</b></span><span className="inline-flex items-center gap-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-full px-2 py-1"><ArrowRightLeft className="w-3 h-3"/>Net flow <b>{incoming - leaving >= 0 ? '+' : ''}{incoming - leaving}</b></span><span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2 py-1"><BedDouble className="w-3 h-3"/>Staffed available <b>{staffedAvailable}</b></span><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border font-black ${pressure === 'ALERT' ? 'bg-rose-50 text-rose-800 border-rose-300' : pressure === 'WATCH' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}><Building2 className="w-3 h-3"/>Projected Census {projectedCensus}/{capacity} • {pressure}</span><span className="inline-flex items-center gap-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-full px-2 py-1"><BedDouble className="w-3 h-3"/>Projected physical available <b>{projectedAvailable}</b></span>{deficit > 0 && <span className="font-black text-rose-700">Projected deficit: {deficit} bed{deficit === 1 ? '' : 's'}</span>}</div></div>
  </section>;
};
