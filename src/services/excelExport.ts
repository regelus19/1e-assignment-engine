import * as XLSX from 'xlsx';
import { CurrentShiftState, FinalizedShiftSnapshot, NurseStaff, OnCallProviders, PatientRoom, PlanBaseline } from '../types';

type ShiftData = {
  date: string;
  shiftType: 'Day' | 'Night';
  roster: NurseStaff[];
  rooms: PatientRoom[];
  onCall?: OnCallProviders;
  pmOnCall?: OnCallProviders;
};

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

const pairedName = (staff: NurseStaff, roster: NurseStaff[]) => {
  if (staff.role !== 'Preceptor' || !staff.orientationPartnerId) return first(staff.name);
  const partner = roster.find(s => s.id === staff.orientationPartnerId);
  return partner ? `${first(staff.name)}/${first(partner.name)}` : first(staff.name);
};

const staffingRows = (roster: NurseStaff[], rooms: PatientRoom[]) => roster
  .filter(staff => staff.role !== 'Orientee')
  .map(staff => {
    const assigned = rooms
      .filter(room => room.isOccupied && room.assignedNurseId === staff.id)
      .map(room => room.roomNumber)
      .sort((a, b) => Number(a) - Number(b));

    let assignment = '—';
    if (staff.role === 'CHG') assignment = assigned.length ? `CHG, ${assigned.join(',')}` : 'CHG';
    else if (staff.role === 'MT') assignment = 'MT';
    else if (staff.role === 'PCT') assignment = 'PCT';
    else if (staff.staffStatus === 'FLEXED') assignment = 'FLEXED';
    else if (staff.staffStatus === 'ON_CALL') assignment = 'ON CALL';
    else if (assigned.length) assignment = assigned.join(',');

    return [pairedName(staff, roster), assignment, staff.assignedPhone || ''];
  });

const provider = (value?: string) => value || '';

export function downloadDailyStaffingExcel(
  currentShift: CurrentShiftState,
  previousShift: FinalizedShiftSnapshot | null,
  nextShift: PlanBaseline | null,
) {
  const current: ShiftData = {
    date: currentShift.date,
    shiftType: currentShift.shiftType,
    roster: currentShift.roster,
    rooms: currentShift.rooms,
    onCall: currentShift.onCall,
  };

  const previous: ShiftData | null = previousShift ? {
    date: previousShift.date,
    shiftType: previousShift.shiftType,
    roster: previousShift.roster,
    rooms: previousShift.rooms,
    onCall: previousShift.onCall,
  } : null;

  const next: ShiftData | null = nextShift ? {
    date: nextShift.date,
    shiftType: nextShift.shiftType,
    roster: nextShift.roster,
    rooms: nextShift.rooms,
    onCall: nextShift.onCall,
    pmOnCall: nextShift.pmOnCall,
  } : null;

  const candidates = [current, next, previous].filter(Boolean) as ShiftData[];
  const targetDate = next?.date || current.date;
  const day = candidates.find(x => x.date === targetDate && x.shiftType === 'Day') || candidates.find(x => x.shiftType === 'Day') || null;
  const night = candidates.find(x => x.date === targetDate && x.shiftType === 'Night') || candidates.find(x => x.shiftType === 'Night') || null;
  const amCall = next?.date === targetDate && next.onCall ? next.onCall : day?.onCall || currentShift.onCall;
  const pmCall = next?.date === targetDate && next.pmOnCall ? next.pmOnCall : night?.onCall || currentShift.onCall;

  const aoa: (string | number)[][] = [];
  aoa.push(['1 EAST DAILY STAFFING ASSIGNMENTS', '', '']);
  aoa.push(['Cardiac Universal Bed (CUB) Unit', '', '']);
  aoa.push([]);
  aoa.push([`AM SHIFT — ${day?.date || targetDate}`, '', '']);
  aoa.push(['Staff', 'Assignment', 'Phone']);
  aoa.push(...staffingRows(day?.roster || [], day?.rooms || []));
  while (aoa.length < 17) aoa.push(['', '', '']);
  aoa.push([]);
  aoa.push(['ON-CALL PROVIDERS', 'AM Coverage', 'PM Coverage']);
  aoa.push(['INTENSIVIST', provider(amCall.intensivist), provider(pmCall.intensivist)]);
  aoa.push(['CARDIOTHORACIC', provider(amCall.cardiothoracic), provider(pmCall.cardiothoracic)]);
  aoa.push(['ACUTE MI', provider(amCall.acuteMI), provider(pmCall.acuteMI)]);
  aoa.push(['CARDIOLOGY', provider(amCall.cardiology), provider(pmCall.cardiology)]);
  aoa.push(['HOSPITALIST', provider(amCall.hospitalist), provider(pmCall.hospitalist)]);
  aoa.push([]);
  aoa.push([`PM SHIFT — ${night?.date || targetDate}`, '', '']);
  aoa.push(['Staff', 'Assignment', 'Phone']);
  aoa.push(...staffingRows(night?.roster || [], night?.rooms || []));
  while (aoa.length < 40) aoa.push(['', '', '']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 28 }, { wch: 34 }, { wch: 18 }];
  ws['!rows'] = aoa.map((_, index) => ({ hpt: index === 0 ? 25 : index === 1 ? 19 : 21 }));
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
    { s: { r: 24, c: 0 }, e: { r: 24, c: 2 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Daily Staffing');
  XLSX.writeFile(wb, `1E_Daily_Staffing_Assignments_${targetDate}.xlsx`, { compression: true });
}
