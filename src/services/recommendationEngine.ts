import { NurseStaff, PatientRoom, RecommendationResult, AssignmentWarning, NurseRecommendationDetail } from '../types';
import { ROOM_METADATA_MAP, evaluateGeographicCluster } from '../config/geography';
import { StorageService } from './storage';

export function runRecommendationEngine(
  staffList: NurseStaff[],
  roomsList: PatientRoom[],
  chargeTakingPatients: boolean,
  allowTeleQuad: boolean
): RecommendationResult {
  const warnings: AssignmentWarning[] = [];
  const assignments: Record<string, string> = {};
  const occupiedRooms = roomsList.filter(r => r.isOccupied);

  // Eligible bedside staff
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

  // Rule: HD/Dialysis Room Validation
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

  // Rule: Safety Room Advisory
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

  // Sort rooms: High acuity & continuity first
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

      // 1. Mandatory Clinical Capability Check
      const isQualified =
        nurse.capability === 'CVICU' ? true :
        nurse.capability === 'ICU' ? ['ICU', 'PCU', 'TELE'].includes(room.acuity) :
        ['PCU', 'TELE'].includes(room.acuity);

      if (!isQualified) continue;

      // 2. Mandatory Baseline Staffing Limit Check
      const cvicuCount = assigned.filter(r => r.acuity === 'CVICU').length;
      const icuCount = assigned.filter(r => r.acuity === 'ICU').length;
      const pcuTeleCount = assigned.filter(r => ['PCU', 'TELE'].includes(r.acuity)).length;

      if (room.acuity === 'CVICU') {
        if (assigned.length > 0) continue; // CVICU is strictly 1:1
      } else if (room.acuity === 'ICU') {
        if (cvicuCount > 0) continue;
        if (icuCount >= 2) continue; // Max 2 ICU
        if (icuCount === 1 && pcuTeleCount >= 1) continue; // Max 1 ICU + 1 PCU
      } else {
        // PCU / TELE
        if (cvicuCount > 0) continue;
        if (icuCount === 1 && pcuTeleCount >= 1) continue;
        if (icuCount === 2) continue;
        const assignedAreTeleOnly = assigned.every(r => r.acuity === 'TELE');
        const teleQuadEligible = allowTeleQuad && nurse.capability === 'PCU_TELE' && room.acuity === 'TELE' && assignedAreTeleOnly;
        const maxPcuTele = teleQuadEligible ? 4 : 3;
        if (pcuTeleCount >= maxPcuTele) continue;
      }

      // Optimization Scoring
      let score = 50;
      const reasons: string[] = [`✓ ${nurse.capability} clinically qualified`];

      // Continuity Bonus
      if (continuity && continuity.nurseId === nurse.id) {
        score += 80;
        reasons.push(`✓ Continuity preserved — cared for patient ${continuity.daysAgo}d ago`);
      }

      // Geographic Clustering
      if (assigned.length > 0) {
        const candidateRooms = [...assigned.map(r => r.roomNumber), room.roomNumber];
        const geo = evaluateGeographicCluster(candidateRooms);
        score += geo.score * 40;
        reasons.push(geo.score >= 0.8 ? `✓ ${geo.reason}` : `⚠ ${geo.reason}`);
      } else {
        score += 20;
      }

      // Charge Nurse exclusion preference
      if (nurse.role === 'CHG') score -= 30;

      // MT dual role constraint buffer
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
        message: `Requires Charge Nurse review: Room ${room.roomNumber} (${room.acuity}) could not be auto-assigned within safe baseline rules.`
      });
    }
  }

  // Workload and Geographic Validation for final state
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
