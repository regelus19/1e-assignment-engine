import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, BedDouble, Building2, Hospital, Save } from 'lucide-react';

export interface OperationalSnapshotData {
  expectedDischarges: number;
  incomingTransfers: number;
  edAdmissions: number;
  orReturns: number;
  cathEpReturns: number;
  otherIncoming: number;
  outgoingTransfers: number;
}

interface Props {
  currentCensus: number;
  capacity?: number;
}

const KEY = '1E_OPERATIONAL_SNAPSHOT_V1';
const defaults: OperationalSnapshotData = {
  expectedDischarges: 0,
  incomingTransfers: 0,
  edAdmissions: 0,
  orReturns: 0,
  cathEpReturns: 0,
  otherIncoming: 0,
  outgoingTransfers: 0,
};

const load = (): OperationalSnapshotData => {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch {
    return defaults;
  }
};

const Metric: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => (
  <label className="min-w-[96px] flex-1">
    <span className="block text-[9px] uppercase font-black tracking-wide text-slate-500 mb-1">{label}</span>
    <input type="number" min="0" value={value} onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))} className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 text-sm font-black text-center" />
  </label>
);

export const OperationalSnapshot: React.FC<Props> = ({ currentCensus, capacity = 22 }) => {
  const [data, setData] = useState<OperationalSnapshotData>(load);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(data));
    setSaved(false);
  }, [data]);

  const incoming = data.incomingTransfers + data.edAdmissions + data.orReturns + data.cathEpReturns + data.otherIncoming;
  const leaving = data.expectedDischarges + data.outgoingTransfers;
  const projectedCensus = Math.max(0, currentCensus + incoming - leaving);
  const availableNow = Math.max(0, capacity - currentCensus);
  const projectedAvailable = Math.max(0, capacity - projectedCensus);
  const deficit = Math.max(0, projectedCensus - capacity);

  const pressure = useMemo(() => deficit > 0 ? 'ALERT' : projectedCensus >= 20 ? 'WATCH' : 'OK', [deficit, projectedCensus]);

  const patch = (key: keyof OperationalSnapshotData, value: number) => setData(prev => ({ ...prev, [key]: value }));

  return (
    <section className="bg-white border-b border-slate-200 no-print shadow-sm">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2"><Hospital className="w-4 h-4 text-blue-700"/><h2 className="text-xs font-black uppercase tracking-wider text-slate-800">1E Operational Snapshot</h2></div>
            <p className="text-[10px] text-slate-500 mt-0.5">Manual V1 • quick view of today's patient flow. Future-ready for Operations Hub / live data integration.</p>
          </div>
          <button type="button" onClick={() => { localStorage.setItem(KEY, JSON.stringify(data)); setSaved(true); }} className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-[10px] font-bold flex items-center gap-1"><Save className="w-3 h-3"/>{saved ? 'Saved' : 'Save Snapshot'}</button>
        </div>

        <div className="flex flex-wrap gap-2 items-stretch">
          <div className="rounded-xl bg-slate-900 text-white px-3 py-2 min-w-[105px]"><div className="text-[9px] uppercase font-black text-slate-400">Current Census</div><div className="text-2xl font-black">{currentCensus}<span className="text-xs text-slate-400">/{capacity}</span></div></div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 min-w-[105px]"><div className="text-[9px] uppercase font-black text-slate-500">Beds Available</div><div className="text-2xl font-black text-slate-800">{availableNow}</div></div>
          <Metric label="Expected DC" value={data.expectedDischarges} onChange={v => patch('expectedDischarges', v)} />
          <Metric label="Incoming Xfers" value={data.incomingTransfers} onChange={v => patch('incomingTransfers', v)} />
          <Metric label="ED / Direct" value={data.edAdmissions} onChange={v => patch('edAdmissions', v)} />
          <Metric label="OR Returns" value={data.orReturns} onChange={v => patch('orReturns', v)} />
          <Metric label="Cath / EP" value={data.cathEpReturns} onChange={v => patch('cathEpReturns', v)} />
          <Metric label="Other Incoming" value={data.otherIncoming} onChange={v => patch('otherIncoming', v)} />
          <Metric label="Outgoing Xfers" value={data.outgoingTransfers} onChange={v => patch('outgoingTransfers', v)} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-800 border border-blue-200 rounded-full px-2 py-1"><ArrowDownToLine className="w-3 h-3"/>Incoming <b>{incoming}</b></span>
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-2 py-1"><ArrowUpFromLine className="w-3 h-3"/>Leaving <b>{leaving}</b></span>
          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-full px-2 py-1"><ArrowRightLeft className="w-3 h-3"/>Net flow <b>{incoming - leaving >= 0 ? '+' : ''}{incoming - leaving}</b></span>
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 border font-black ${pressure === 'ALERT' ? 'bg-rose-50 text-rose-800 border-rose-300' : pressure === 'WATCH' ? 'bg-amber-50 text-amber-800 border-amber-300' : 'bg-emerald-50 text-emerald-800 border-emerald-300'}`}><Building2 className="w-3 h-3"/>Projected Census {projectedCensus}/{capacity} • {pressure}</span>
          <span className="inline-flex items-center gap-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-full px-2 py-1"><BedDouble className="w-3 h-3"/>Projected available <b>{projectedAvailable}</b></span>
          {deficit > 0 && <span className="font-black text-rose-700">Projected deficit: {deficit} bed{deficit === 1 ? '' : 's'}</span>}
        </div>
      </div>
    </section>
  );
};
