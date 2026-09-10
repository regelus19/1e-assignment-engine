import { NurseStaff, PatientRoom, RecommendationResult, AssignmentWarning, NurseRecommendationDetail } from '../types';
import { ROOM_METADATA_MAP, evaluateGeographicCluster } from '../config/geography';
import { StorageService } from './storage';

export type RecommendationStrategy = 'BALANCED' | 'CONSERVE_SKILL_MIX' | 'CAPACITY_EXCEPTION';

const isClinicallyQualified = (n: NurseStaff, r: PatientRoom) =>
  n.capability === 'CVICU' ||
  (n.capability === 'ICU' ? ['ICU', 'PCU', 'TELE'].includes(r.acuity) : ['PCU', 'TELE'].includes(r.acuity));

const createsNonIdeal103IcuPair = (assigned: PatientRoom[], room: PatientRoom): boolean => {
  if (room.acuity !== 'ICU') return false;
  const candidateRooms = [...assigned, room];
  const has103Icu = candidateRooms.some(r => r.roomNumber === '103' && r.acuity === 'ICU');
  if (!has103Icu) return false;
  return candidateRooms.some(r => r.roomNumber !== '103' && r.acuity === 'ICU' && ROOM_METADATA_MAP[r.roomNumber]?.hall === 'A');
};

const createsNonIdeal122114IcuPair = (assigned: PatientRoom[], room: PatientRoom): boolean => {
  if (room.acuity !== 'ICU') return false;
  const candidateRooms = [...assigned, room];
  return candidateRooms.some(r => r.roomNumber === '122' && r.acuity === 'ICU') && candidateRooms.some(r => r.roomNumber === '114' && r.acuity === 'ICU');
};

const createsPreferred122LowerAcuityPair = (assigned: PatientRoom[], room: PatientRoom): boolean => {
  const candidateRooms = [...assigned, room];
  const has122Icu = candidateRooms.some(r => r.roomNumber === '122' && r.acuity === 'ICU');
  if (!has122Icu) return false;
  return candidateRooms.some(r => ['113', '120', '121'].includes(r.roomNumber) && ['PCU', 'TELE'].includes(r.acuity));
};

const expectedDischargeCount = (rooms: PatientRoom[]) => rooms.filter(r => r.flags.includes('Expected DC')).length;

const workloadBlockReason = (n: NurseStaff, assigned: PatientRoom[], room: PatientRoom, allowTeleQuad: boolean): string | null => {
  const cvicu = assigned.filter(x => x.acuity === 'CVICU').length;
  const icu = assigned.filter(x => x.acuity === 'ICU').length;
  const pcuTele = assigned.filter(x => ['PCU', 'TELE'].includes(x.acuity)).length;
  const label = assigned.length ? assigned.map(x => `${x.roomNumber} ${x.acuity}`).join(', ') : 'no current patients';

  if (n.role === 'CHG') {
    if (room.acuity !== 'TELE') return 'Charge RN exception is limited to one TELE patient.';
    if (assigned.length >= 1) return 'Charge RN exception is limited to one TELE patient.';
  }

  if (room.acuity === 'CVICU') return assigned.length ? `${n.name} already has ${label}; CVICU is configured 1:1.` : null;
  if (room.acuity === 'ICU') {
    if (cvicu) return `${n.name} has ${label}; CVICU is protected 1:1.`;
    if (icu >= 2) return `${n.name} has ${label}; ICU limit is 1:2.`;
    if (icu === 1 && pcuTele >= 1) return `${n.name} has ${label}; mixed limit is 1 ICU + 1 PCU/TELE.`;
    return null;
  }
  if (cvicu) return `${n.name} has ${label}; CVICU is protected 1:1.`;
  if (icu === 2) return `${n.name} has ${label}; 2 ICU reaches capacity.`;
  if (icu === 1 && pcuTele >= 1) return `${n.name} has ${label}; mixed limit is 1 ICU + 1 PCU/TELE.`;
  const teleQuad = allowTeleQuad && n.capability === 'PCU_TELE' && room.acuity === 'TELE' && assigned.every(x => x.acuity === 'TELE');
  const max = teleQuad ? 4 : 3;
  return pcuTele >= max ? `${n.name} has ${label}; ${teleQuad ? 'TELE quad 1:4' : 'PCU/TELE baseline 1:3'} reached.` : null;
};

const bedside = (s: NurseStaff) => ['RN', 'Preceptor', 'CHG'].includes(s.role);

const exact = (
  r: PatientRoom,
  staff: NurseStaff[],
  state: Record<string, { nurse: NurseStaff; assignedRooms: PatientRoom[]; reasons: string[] }>,
  charge: boolean,
  quad: boolean,
) => {
  const qualified = staff.filter(s => bedside(s) && isClinicallyQualified(s, r));
  if (!qualified.length) return r.acuity === 'CVICU' ? 'No CVICU-capable RN/Preceptor is on the roster.' : r.acuity === 'ICU' ? 'No ICU- or CVICU-capable RN/Preceptor is on the roster.' : 'No PCU/TELE-or-higher RN/Preceptor is on the roster.';
  const reserve = qualified.filter(s => ['FLEXED', 'ON_CALL'].includes(s.staffStatus));
  const active = qualified.filter(s => ['ACTIVE', 'RECALLED'].includes(s.staffStatus));
  const eligible = active.filter(s => s.role !== 'CHG' || charge);
  if (!eligible.length) return `No qualified ACTIVE/RECALLED bedside RN is available.${reserve.length ? ` Qualified reserve: ${reserve.map(s => `${s.name} (${s.staffStatus})`).join(', ')}.` : ''}`;
  const blocks = eligible.map(n => workloadBlockReason(n, state[n.id]?.assignedRooms || [], r, quad)).filter(Boolean) as string[];
  return blocks.length === eligible.length
    ? `${r.acuity === 'CVICU' ? 'All active CVICU-qualified staff are at 1:1.' : r.acuity === 'ICU' ? 'All active ICU-qualified staff are at ICU/mixed workload limits.' : 'All qualified active staff are at workload limits.'} ${blocks.join(' ')}${reserve.length ? ` Reserve: ${reserve.map(s => `${s.name} (${s.staffStatus})`).join(', ')}.` : ''}`
    : 'No eligible assignment satisfied all configured constraints.';
};

export function runRecommendationEngine(
  staff: NurseStaff[],
  rooms: PatientRoom[],
  chargeTakingPatients = false,
  allowTeleQuad = false,
  strategy: RecommendationStrategy = 'BALANCED',
): RecommendationResult {
  const warnings: AssignmentWarning[] = [];
  const assignments: Record<string, string> = {};
  const allOccupied = rooms.filter(r => r.isOccupied);
  const uncoded = allOccupied.filter(r => r.acuityConfirmed === false);
  const occupied = allOccupied.filter(r => r.acuityConfirmed !== false);
  const allowCharge = chargeTakingPatients;
  const allowQuad = allowTeleQuad;

  const nurses = staff.filter(s => ['ACTIVE', 'RECALLED'].includes(s.staffStatus) && bedside(s) && (s.role !== 'CHG' || allowCharge));
  const state: Record<string, { nurse: NurseStaff; assignedRooms: PatientRoom[]; reasons: string[] }> = {};
  nurses.forEach(n => state[n.id] = { nurse: n, assignedRooms: [], reasons: [] });

  const unassigned: string[] = uncoded.map(r => r.roomNumber);
  uncoded.forEach(r => warnings.push({ type: 'ACUITY_MISSING', severity: 'HIGH', roomNumber: r.roomNumber, message: `Room ${r.roomNumber} is occupied but acuity is not coded. Set CVICU, ICU, PCU, or TELE before Auto Generate can assign it.` }));

  occupied.forEach(r => {
    if (r.flags.includes('HD/Dialysis') && !ROOM_METADATA_MAP[r.roomNumber]?.isICUCapable) warnings.push({ type: 'DIALYSIS_ROOM', severity: 'HIGH', roomNumber: r.roomNumber, message: `Room ${r.roomNumber} has HD/Dialysis in a non-ICU-capable room.` });
    if (r.flags.some(f => ['High Fall Risk', 'Confused', 'Sitter/Safety'].includes(f)) && !['109', '119'].includes(r.roomNumber)) warnings.push({ type: 'SAFETY_ROOM', severity: 'INFO', roomNumber: r.roomNumber, message: `Room ${r.roomNumber} has safety flags; 109/119 preferred.` });
  });

  const rank: Record<string, number> = { CVICU: 4, ICU: 3, PCU: 2, TELE: 1 };
  const sorted = [...occupied].sort((a, b) => rank[b.acuity] - rank[a.acuity]);

  for (const room of sorted) {
    const continuity = StorageService.findContinuity(room.patientStayId, nurses);
    let best: string | null = null;
    let score = -9999;
    let reasons: string[] = [];

    for (const n of nurses) {
      const assigned = state[n.id].assignedRooms;
      if (!isClinicallyQualified(n, room) || workloadBlockReason(n, assigned, room, allowQuad)) continue;

      let candidate = 50;
      const candidateReasons = [`✓ ${n.capability} qualified`];
      const assignedICU = assigned.filter(x => x.acuity === 'ICU').length;

      // Continuity is intentionally dominant after hard safety/capability/workload gates.
      // A returning RN who had this same PatientStayID in recent finalized history should normally keep the patient.
      if (continuity?.nurseId === n.id) {
        const recencyBonus = Math.max(0, 40 - ((continuity.daysAgo - 1) * 8));
        candidate += 180 + recencyBonus;
        candidateReasons.push(`✓ STRONG CONTINUITY — previous assignment (${continuity.daysAgo === 1 ? 'most recent finalized shift' : `${continuity.daysAgo} shifts back`})`);
      }
      if (assigned.length) {
        const geo = evaluateGeographicCluster([...assigned.map(x => x.roomNumber), room.roomNumber]);
        candidate += geo.score * 40;
        candidateReasons.push(geo.reason);
      } else candidate += 20;

      if (room.flags.includes('Expected DC')) {
        const existingExpectedDC = expectedDischargeCount(assigned);
        if (existingExpectedDC === 0) {
          candidate += 24;
          candidateReasons.push('✓ spreads expected discharges across nurses');
        } else if (existingExpectedDC === 1) {
          candidate -= 55;
          candidateReasons.push('⚠ avoids giving one nurse 2 expected discharges when alternatives exist');
        } else {
          candidate -= 120;
          candidateReasons.push('⚠ strongly avoids concentrating 3+ expected discharges on one nurse');
        }
      }

      if (createsNonIdeal103IcuPair(assigned, room)) {
        candidate -= 100;
        candidateReasons.push('⚠ avoids pairing Room 103 ICU with another Hall A ICU unless necessary');
      }
      if (createsNonIdeal122114IcuPair(assigned, room)) {
        candidate -= 130;
        candidateReasons.push('⚠ strongly avoids pairing Room 122 ICU with Room 114 ICU unless operationally necessary');
      }
      if (createsPreferred122LowerAcuityPair(assigned, room)) {
        candidate += 35;
        candidateReasons.push('✓ prefers Room 122 ICU with nearby PCU/TELE in 113, 120, or 121 when staffing permits');
      }

      if (strategy === 'BALANCED') {
        if (room.acuity === 'ICU' && assignedICU === 0) { candidate += 18; candidateReasons.push('✓ spreads ICU workload'); }
        if (room.acuity === 'ICU' && assignedICU === 1) { candidate -= 18; candidateReasons.push('• avoids pairing ICU when spread is available'); }
      }

      if (strategy === 'CONSERVE_SKILL_MIX') {
        if (room.acuity === 'ICU' && assignedICU === 1) { candidate += 35; candidateReasons.push('✓ pairs ICU to preserve another critical-care RN'); }
        if (['PCU', 'TELE'].includes(room.acuity) && n.capability === 'PCU_TELE') { candidate += 28; candidateReasons.push('✓ preserves ICU/CVICU skill mix'); }
        if (['PCU', 'TELE'].includes(room.acuity) && ['ICU', 'CVICU'].includes(n.capability)) candidate -= 12;
      }

      if (strategy === 'CAPACITY_EXCEPTION') {
        if (n.role === 'CHG' && room.acuity === 'TELE') { candidate -= 120; candidateReasons.push('⚠ Charge RN takes 1 TELE only as capacity exception'); }
        if (assigned.length === 3 && assigned.every(x => x.acuity === 'TELE') && room.acuity === 'TELE') { candidate -= 140; candidateReasons.push('⚠ TELE quad only as capacity exception'); }
      }

      if (n.role === 'CHG') candidate -= 80;
      if (candidate > score) { score = candidate; best = n.id; reasons = candidateReasons; }
    }

    if (best) {
      assignments[room.roomNumber] = best;
      state[best].assignedRooms.push(room);
      state[best].reasons.push(`Rm ${room.roomNumber}: ${reasons.join('; ')}`);
    } else {
      unassigned.push(room.roomNumber);
      warnings.push({ type: 'CAPABILITY', severity: 'HIGH', roomNumber: room.roomNumber, message: exact(room, staff, state, allowCharge, allowQuad) });
    }
  }

  Object.values(state).forEach(st => {
    if (!st.assignedRooms.length) return;
    const nums = st.assignedRooms.map(r => r.roomNumber);
    const geo = evaluateGeographicCluster(nums);
    if (geo.advisory) warnings.push({ type: 'GEOGRAPHY', severity: 'MEDIUM', nurseName: st.nurse.name, message: `${st.nurse.name}'s assignment (${nums.join(', ')}) spans separated zones: ${geo.reason}.` });

    const dcRooms = st.assignedRooms.filter(r => r.flags.includes('Expected DC')).map(r => r.roomNumber);
    if (dcRooms.length >= 3) {
      warnings.push({ type: 'WORKLOAD_RATIO', severity: 'MEDIUM', nurseName: st.nurse.name, message: `Discharge concentration: ${st.nurse.name} has ${dcRooms.length} expected discharges (${dcRooms.join(', ')}). This may create repeated admission turnover later in the shift; spread these discharges when staffing/geography allow, unless intentionally set by the Charge Nurse.` });
    } else if (dcRooms.length === 2) {
      warnings.push({ type: 'WORKLOAD_RATIO', severity: 'INFO', nurseName: st.nurse.name, message: `Discharge concentration advisory: ${st.nurse.name} has 2 expected discharges (${dcRooms.join(', ')}). Consider spreading expected discharges to reduce the likelihood that one nurse receives multiple replacement admissions.` });
    }

    if (st.assignedRooms.some(r => r.roomNumber === '103' && r.acuity === 'ICU') && st.assignedRooms.some(r => r.roomNumber !== '103' && r.acuity === 'ICU' && ROOM_METADATA_MAP[r.roomNumber]?.hall === 'A')) {
      const pairedHallARooms = st.assignedRooms.filter(r => r.roomNumber !== '103' && r.acuity === 'ICU' && ROOM_METADATA_MAP[r.roomNumber]?.hall === 'A').map(r => r.roomNumber);
      warnings.push({ type: 'GEOGRAPHY', severity: 'MEDIUM', nurseName: st.nurse.name, roomNumber: '103', message: `Non-ideal ICU pairing: Room 103 ICU is paired with Hall A ICU room ${pairedHallARooms.join(', ')} for ${st.nurse.name}. Prefer splitting this pair when skill mix allows.` });
    }
    if (st.assignedRooms.some(r => r.roomNumber === '122' && r.acuity === 'ICU') && st.assignedRooms.some(r => r.roomNumber === '114' && r.acuity === 'ICU')) {
      warnings.push({ type: 'GEOGRAPHY', severity: 'HIGH', nurseName: st.nurse.name, roomNumber: '122', message: `High-risk ICU pairing: Rooms 122 and 114 are both ICU and assigned to ${st.nurse.name}. Avoid this pairing when staffing permits; use only when operationally necessary with Charge Nurse review.` });
    }
    if (st.nurse.role === 'CHG' && st.assignedRooms.length) warnings.push({ type: 'WORKLOAD_RATIO', severity: 'MEDIUM', nurseName: st.nurse.name, message: `Charge RN exception: ${st.nurse.name} assigned ${st.assignedRooms.map(r => r.roomNumber).join(', ')}.` });
    if (st.assignedRooms.length === 4 && st.assignedRooms.every(r => r.acuity === 'TELE')) warnings.push({ type: 'WORKLOAD_RATIO', severity: 'MEDIUM', nurseName: st.nurse.name, message: `TELE quad exception: ${st.nurse.name} assigned ${st.assignedRooms.map(r => r.roomNumber).join(', ')}.` });
  });

  let fit = 100;
  warnings.forEach(w => fit -= w.severity === 'HIGH' ? 20 : w.severity === 'MEDIUM' ? 8 : 2);
  fit = Math.max(10, Math.min(100, fit));
  const fitLabel = fit >= 85 ? 'HIGH FIT' : fit >= 65 ? 'MODERATE FIT' : 'REQUIRES REVIEW';
  const nurseDetails: NurseRecommendationDetail[] = Object.values(state).map(st => ({ nurseId: st.nurse.id, nurseName: st.nurse.name, assignedRooms: st.assignedRooms.map(r => r.roomNumber), reasons: st.reasons, workloadScore: st.assignedRooms.length }));
  return { assignments, nurseDetails, warnings, fitScore: fit, fitLabel, unassignedRooms: unassigned };
}
