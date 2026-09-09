import { NurseStaff, PatientRoom, RecommendationResult, AssignmentWarning, NurseRecommendationDetail } from '../types';
import { ROOM_METADATA_MAP, evaluateGeographicCluster } from '../config/geography';
import { StorageService } from './storage';

const isClinicallyQualified = (nurse: NurseStaff, room: PatientRoom): boolean =>
  nurse.capability === 'CVICU' ? true :
  nurse.capability === 'ICU' ? ['ICU', 'PCU', 'TELE'].includes(room.acuity) :
  ['PCU', 'TELE'].includes(room.acuity);

const workloadBlockReason = (nurse: NurseStaff, assigned: PatientRoom[], room: PatientRoom, allowTeleQuad: boolean): string | null => {
  const cvicuCount = assigned.filter(r => r.acuity === 'CVICU').length;
  const icuCount = assigned.filter(r => r.acuity === 'ICU').length;
  const pcuTeleCount = assigned.filter(r => ['PCU', 'TELE'].includes(r.acuity)).length;
  const assignmentLabel = assigned.length
    ? assigned.map(r => `${r.roomNumber} ${r.acuity}`).join(', ')
    : 'no current patients';

  if (room.acuity === 'CVICU') {
    if (assigned.length > 0) return `${nurse.name} already has ${assignmentLabel}; CVICU is configured 1:1.`;
    return null;
  }

  if (room.acuity === 'ICU') {
    if (cvicuCount > 0) return `${nurse.name} has ${assignmentLabel}; a CVICU assignment cannot be paired with ICU.`;
    if (icuCount >= 2) return `${nurse.name} already has ${assignmentLabel}; ICU limit is 1:2.`;
    if (icuCount === 1 && pcuTeleCount >= 1) return `${nurse.name} already has ${assignmentLabel}; mixed-acuity limit is 1 ICU + 1 PCU/TELE.`;
    return null;
  }

  if (cvicuCount > 0) return `${nurse.name} has ${assignmentLabel}; a CVICU assignment is protected 1:1.`;
  if (icuCount === 2) return `${nurse.name} already has ${assignmentLabel}; 2 ICU patients reaches baseline capacity.`;
  if (icuCount === 1 && pcuTeleCount >= 1) return `${nurse.name} already has ${assignmentLabel}; mixed-acuity limit is 1 ICU + 1 PCU/TELE.`;

  const assignedAreTeleOnly = assigned.every(r => r.acuity === 'TELE');
  const teleQuadEligible = allowTeleQuad && nurse.capability === 'PCU_TELE' && room.acuity === 'TELE' && assignedAreTeleOnly;
  const maxPcuTele = teleQuadEligible ? 4 : 3;
  if (pcuTeleCount >= maxPcuTele) {
    return `${nurse.name} already has ${assignmentLabel}; ${teleQuadEligible ? 'approved TELE quad limit is 1:4' : 'PCU/TELE baseline ratio is 1:3'}.`;
  }
  return null;
};

const exactLimitingFactor = (
  room: PatientRoom,
  staffList: NurseStaff[],
  nurseState: Record<string, { nurse: NurseStaff; assignedRooms: PatientRoom[]; reasons: string[] }>,
  chargeTakingPatients: boolean,
  allowTeleQuad: boolean,
): string => {
  const bedside = staffList.filter(s => s.role === 'RN' || s.role === 'CHG');
  const qualified = bedside.filter(s => isClinicallyQualified(s, room));

  if (qualified.length === 0) {
    if (room.acuity === 'CVICU') return `No CVICU-capable RN is on the roster for Room ${room.roomNumber}.`;
    if (room.acuity === 'ICU') return `No ICU- or CVICU-capable RN is on the roster for Room ${room.roomNumber}.`;
    return `No RN with PCU/TELE-or-higher capability is on the roster for Room ${room.roomNumber}.`;
  }

  const inactiveQualified = qualified.filter(s => s.staffStatus === 'FLEXED' || s.staffStatus === 'ON_CALL');
  const activeQualified = qualified.filter(s => s.staffStatus === 'ACTIVE' || s.staffStatus === 'RECALLED');
  const protectedCharge = activeQualified.filter(s => s.role === 'CHG' && !chargeTakingPatients);
  const eligibleActive = activeQualified.filter(s => s.role === 'RN' || (s.role === 'CHG' && chargeTakingPatients));

  if (eligibleActive.length === 0) {
    const reserveText = inactiveQualified.length
      ? ` Qualified reserve: ${inactiveQualified.map(s => `${s.name} (${s.staffStatus === 'ON_CALL' ? 'ON CALL' : 'FLEXED'})`).join(', ')}.`
      : '';
    const chargeText = protectedCharge.length
      ? ` ${protectedCharge.map(s => s.name).join(', ')} is qualified but Charge is protected from bedside assignment.`
      : '';
    return `No qualified ACTIVE/RECALLED bedside RN is available for Room ${room.roomNumber}.${reserveText}${chargeText}`;
  }

  const blockers = eligibleActive.map(nurse => {
    const assigned = nurseState[nurse.id]?.assignedRooms || [];
    return workloadBlockReason(nurse, assigned, room, allowTeleQuad);
  }).filter((reason): reason is string => Boolean(reason));

  if (blockers.length === eligibleActive.length) {
    const prefix = room.acuity === 'CVICU'
      ? 'All active CVICU-qualified RNs are already committed at the configured 1:1 limit.'
      : room.acuity === 'ICU'
        ? 'All active ICU-qualified RNs are at their ICU or mixed-acuity workload limit.'
        : 'All clinically qualified active RNs are at their current workload limit; the PCU/TELE baseline ratio is 1:3 unless an approved exception applies.';
    const reserveText = inactiveQualified.length
      ? ` Qualified reserve exists: ${inactiveQualified.map(s => `${s.name} (${s.staffStatus === 'ON_CALL' ? 'ON CALL' : 'FLEXED'})`).join(', ')}.`
      : '';
    return `${prefix} ${blockers.join(' ')}${reserveText}`;
  }

  return `Qualified staff exist, but no eligible assignment satisfied all configured capability and baseline workload constraints for Room ${room.roomNumber}.`;
};

export function runRecommendationEngine(
  staffList: NurseStaff[],
  roomsList: PatientRoom[],
  chargeTakingPatients: boolean,
  allowTeleQuad: boolean
): RecommendationResult {
  const warnings: AssignmentWarning[] = [];
  const assignments: Record<string, string> = {};
  const occupiedRooms = roomsList.filter(r => r.isOccupied);

  const availableNurses = staffList.filter(s => {
    if (s.staffStatus !== 'ACTIVE' && s.staffStatus !== 'RECALLED') return false;
    if (s.role === 'CHG' && !chargeTakingPatients) return false;
    return s.role === 'RN' || s.role === 'CHG';
  });

  const nurseState: Record<string, {
    nurse: NurseStaff;
    assignedRooms: PatientRoom[];
    reasons: string[];
  }> = {};

  availableNurses.forEach(n => {
    nurseState[n.id] = { nurse: n, assignedRooms: [], reasons: [] };
  });

  occupiedRooms.forEach(r => {
    if (r.flags.includes('HD/Dialysis')) {
      const meta = ROOM_METADATA_MAP[r.roomNumber];
      if (!meta || !meta.isICUCapable) {
        warnings.push({
          type: 'DIALYSIS_ROOM',
          severity: 'HIGH',
          roomNumber: r.roomNumber,
          message: `Room ${r.roomNumber} has HD/Dialysis in non-ICU capable room (101-106, 113, 114, 122).`
        });
      }
    }
  });

  occupiedRooms.forEach(r => {
    const hasSafetyRisk = r.flags.some(f => ['High Fall Risk', 'Confused', 'Sitter/Safety'].includes(f));
    if (hasSafetyRisk && !['109', '119'].includes(r.roomNumber)) {
      warnings.push({
        type: 'SAFETY_ROOM',
        severity: 'INFO',
        roomNumber: r.roomNumber,
        message: `Room ${r.roomNumber} has fall/confused safety flags; 109 & 119 preferred for close observation.`
      });
    }
  });

  const sortedRooms = [...occupiedRooms].sort((a, b) => {
    const rank: Record<string, number> = { CVICU: 4, ICU: 3, PCU: 2, TELE: 1 };
    return rank[b.acuity] - rank[a.acuity];
  });

  const unassignedRooms: string[] = [];

  for (const room of sortedRooms) {
    const continuity = StorageService.findContinuity(room.patientStayId, availableNurses);
    let bestNurseId: string | null = null;
    let bestScore = -9999;
    let bestReasons: string[] = [];

    for (const nurse of availableNurses) {
      const state = nurseState[nurse.id];
      const assigned = state.assignedRooms;

      if (!isClinicallyQualified(nurse, room)) continue;
      if (workloadBlockReason(nurse, assigned, room, allowTeleQuad)) continue;

      let score = 50;
      const reasons: string[] = [`✓ ${nurse.capability} clinically qualified`];

      if (continuity && continuity.nurseId === nurse.id) {
        score += 80;
        reasons.push(`✓ Continuity preserved — cared for patient ${continuity.daysAgo}d ago`);
      }

      if (assigned.length > 0) {
        const candidateRooms = [...assigned.map(r => r.roomNumber), room.roomNumber];
        const geo = evaluateGeographicCluster(candidateRooms);
        score += geo.score * 40;
        reasons.push(geo.score >= 0.8 ? `✓ ${geo.reason}` : `⚠ ${geo.reason}`);
      } else {
        score += 20;
      }

      if (nurse.role === 'CHG') score -= 30;
      if (nurse.coveringMT) score -= 25;

      if (score > bestScore) {
        bestScore = score;
        bestNurseId = nurse.id;
        bestReasons = reasons;
      }
    }

    if (bestNurseId) {
      assignments[room.roomNumber] = bestNurseId;
      const targetState = nurseState[bestNurseId];
      targetState.assignedRooms.push(room);
      targetState.reasons.push(`Rm ${room.roomNumber}: ${bestReasons.join('; ')}`);
    } else {
      unassignedRooms.push(room.roomNumber);
      warnings.push({
        type: 'CAPABILITY',
        severity: 'HIGH',
        roomNumber: room.roomNumber,
        message: exactLimitingFactor(room, staffList, nurseState, chargeTakingPatients, allowTeleQuad)
      });
    }
  }

  Object.values(nurseState).forEach(st => {
    if (st.assignedRooms.length === 0) return;
    const roomNums = st.assignedRooms.map(r => r.roomNumber);
    const geo = evaluateGeographicCluster(roomNums);

    if (geo.advisory) {
      warnings.push({
        type: 'GEOGRAPHY',
        severity: 'MEDIUM',
        nurseName: st.nurse.name,
        message: `${st.nurse.name}'s assignment (${roomNums.join(', ')}) spans separated zones: ${geo.reason}.`
      });
    }

    if (st.assignedRooms.length === 4 && st.assignedRooms.every(r => r.acuity === 'TELE')) {
      warnings.push({
        type: 'WORKLOAD_RATIO',
        severity: 'MEDIUM',
        nurseName: st.nurse.name,
        message: `⚠ TELE QUAD ASSIGNMENT — CHARGE NURSE APPROVAL ACTIVE for ${st.nurse.name}.`
      });
    }
  });

  let fitScore = 100;
  warnings.forEach(w => {
    if (w.severity === 'HIGH') fitScore -= 20;
    if (w.severity === 'MEDIUM') fitScore -= 8;
    if (w.severity === 'INFO') fitScore -= 2;
  });
  fitScore = Math.max(10, Math.min(100, fitScore));
  const fitLabel = fitScore >= 85 ? 'HIGH FIT' : fitScore >= 65 ? 'MODERATE FIT' : 'REQUIRES REVIEW';

  const nurseDetails: NurseRecommendationDetail[] = Object.values(nurseState).map(st => ({
    nurseId: st.nurse.id,
    nurseName: st.nurse.name,
    assignedRooms: st.assignedRooms.map(r => r.roomNumber),
    reasons: st.reasons,
    workloadScore: st.assignedRooms.length
  }));

  return { assignments, nurseDetails, warnings, fitScore, fitLabel, unassignedRooms };
}
