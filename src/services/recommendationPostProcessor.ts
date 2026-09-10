import { NurseStaff, PatientRoom, RecommendationResult } from '../types';
import { evaluateGeographicCluster } from '../config/geography';

// These ICU pairs are operationally poor because the nurse must cover opposite ends/zones.
const UNSAFE_ICU_PAIRS: [string, string][] = [
  ['103', '113'],
  ['104', '114'],
  ['122', '114'],
];

// When two ICU patients must be paired, these are specifically preferred because they are close.
// This does NOT mean the engine should pair ICU patients when spreading them is feasible.
const PREFERRED_ICU_PAIRS: [string, string][] = [
  ['103', '104'],
  ['113', '114'],
];

const isCriticalCareCapable = (n: NurseStaff) => n.capability === 'ICU' || n.capability === 'CVICU';
const isActiveBedside = (n: NurseStaff) => ['RN', 'Preceptor'].includes(n.role) && ['ACTIVE', 'RECALLED'].includes(n.staffStatus);

const assignedRoomsFor = (result: RecommendationResult, nurseId: string, rooms: PatientRoom[]) =>
  rooms.filter(r => r.isOccupied && result.assignments[r.roomNumber] === nurseId);

const isUnsafePair = (roomNumbers: string[]) =>
  UNSAFE_ICU_PAIRS.some(([a, b]) => roomNumbers.includes(a) && roomNumbers.includes(b));

const isPreferredPair = (roomNumbers: string[]) =>
  PREFERRED_ICU_PAIRS.some(([a, b]) => roomNumbers.length === 2 && roomNumbers.includes(a) && roomNumbers.includes(b));

const canSafelyTakeMovedIcu = (candidateRooms: PatientRoom[]) => {
  const cvicu = candidateRooms.filter(r => r.acuity === 'CVICU').length;
  const icu = candidateRooms.filter(r => r.acuity === 'ICU').length;
  const lower = candidateRooms.filter(r => r.acuity === 'PCU' || r.acuity === 'TELE').length;
  if (cvicu > 0) return false;
  if (icu >= 2) return false;
  if (icu === 1 && lower >= 1) return false;
  return candidateRooms.length <= 1;
};

const syncNurseDetails = (result: RecommendationResult, rooms: PatientRoom[]) => {
  result.nurseDetails.forEach(detail => {
    detail.assignedRooms = rooms
      .filter(r => r.isOccupied && result.assignments[r.roomNumber] === detail.nurseId)
      .map(r => r.roomNumber);
  });
};

// Special four-room correction seen in real 1E workflow:
// if 103/104/113/114 are all ICU and the engine cross-pairs 103+113 and 104+114,
// keep the same two qualified nurses but regroup the patients as 103+104 and 113+114.
function repairFourRoomIcuCrossPair(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[]) {
  const quartet = ['103', '104', '113', '114'];
  const allIcu = quartet.every(num => rooms.some(r => r.roomNumber === num && r.isOccupied && r.acuity === 'ICU'));
  if (!allIcu) return;

  const nurse103 = result.assignments['103'];
  const nurse104 = result.assignments['104'];
  const nurse113 = result.assignments['113'];
  const nurse114 = result.assignments['114'];
  const crossPaired = nurse103 && nurse104 && nurse103 === nurse113 && nurse104 === nurse114 && nurse103 !== nurse104;
  if (!crossPaired) return;

  const a = staff.find(n => n.id === nurse103);
  const b = staff.find(n => n.id === nurse104);
  if (!a || !b || !isActiveBedside(a) || !isActiveBedside(b) || !isCriticalCareCapable(a) || !isCriticalCareCapable(b)) return;

  result.assignments['103'] = a.id;
  result.assignments['104'] = a.id;
  result.assignments['113'] = b.id;
  result.assignments['114'] = b.id;
  syncNurseDetails(result, rooms);
  result.warnings.push({
    type: 'GEOGRAPHY', severity: 'INFO',
    message: `ICU proximity correction applied: paired 103+104 and 113+114 instead of cross-pairing 103+113 and 104+114. When ICU pairing is necessary, the engine prefers the closest feasible ICU rooms.`,
  });
}

function repairUnsafeIcuPairs(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[]): RecommendationResult {
  const next: RecommendationResult = {
    ...result,
    assignments: { ...result.assignments },
    nurseDetails: result.nurseDetails.map(n => ({ ...n, assignedRooms: [...n.assignedRooms], reasons: [...n.reasons] })),
    warnings: [...result.warnings],
  };

  repairFourRoomIcuCrossPair(next, staff, rooms);

  for (const [a, b] of UNSAFE_ICU_PAIRS) {
    const roomA = rooms.find(r => r.roomNumber === a && r.isOccupied && r.acuity === 'ICU');
    const roomB = rooms.find(r => r.roomNumber === b && r.isOccupied && r.acuity === 'ICU');
    if (!roomA || !roomB) continue;
    const nurseId = next.assignments[a];
    if (!nurseId || next.assignments[b] !== nurseId) continue;

    const currentNurse = staff.find(n => n.id === nurseId);
    const moveChoices = [roomB, roomA];
    let best: { room: PatientRoom; nurse: NurseStaff; score: number } | null = null;

    for (const movingRoom of moveChoices) {
      for (const nurse of staff.filter(isActiveBedside).filter(isCriticalCareCapable).filter(n => n.id !== nurseId)) {
        const existing = assignedRoomsFor(next, nurse.id, rooms);
        if (!canSafelyTakeMovedIcu(existing)) continue;
        const proposedNumbers = [...existing.map(r => r.roomNumber), movingRoom.roomNumber];
        if (isUnsafePair(proposedNumbers)) continue;
        const geo = evaluateGeographicCluster(proposedNumbers);
        let score = geo.score * 100 + (existing.length === 0 ? 10 : 0);
        if (isPreferredPair(proposedNumbers)) score += 150;
        if (!best || score > best.score) best = { room: movingRoom, nurse, score };
      }
    }

    if (best) {
      next.assignments[best.room.roomNumber] = best.nurse.id;
      syncNurseDetails(next, rooms);
      next.warnings.push({
        type: 'GEOGRAPHY', severity: 'INFO', roomNumber: best.room.roomNumber, nurseName: best.nurse.name,
        message: `Safety correction applied: moved ICU room ${best.room.roomNumber} from ${currentNurse?.name || 'the original RN'} to ${best.nurse.name} to avoid unsafe ICU pairing ${a}+${b}.`,
      });
    } else {
      next.warnings.push({
        type: 'GEOGRAPHY', severity: 'HIGH', roomNumber: a, nurseName: currentNurse?.name,
        message: `Unsafe ICU pairing remains: rooms ${a} and ${b} are both ICU on the same RN. No safer staffed alternative was found; Charge Nurse review is required.`,
      });
    }
  }

  return next;
}

function addAdmissionReadyBeds(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[]): RecommendationResult {
  const next: RecommendationResult = {
    ...result,
    assignments: { ...result.assignments },
    nurseDetails: result.nurseDetails.map(n => ({ ...n, assignedRooms: [...n.assignedRooms], reasons: [...n.reasons] })),
    warnings: [...result.warnings],
  };

  const emptyRooms = rooms.filter(r => !r.isOccupied && !r.flags.includes('BLOCKED'));
  const used = new Set<string>();

  for (const detail of next.nurseDetails) {
    const nurse = staff.find(n => n.id === detail.nurseId);
    if (!nurse || !isActiveBedside(nurse)) continue;
    const assigned = detail.assignedRooms.map(num => rooms.find(r => r.roomNumber === num)).filter(Boolean) as PatientRoom[];
    if (assigned.length !== 2 || !assigned.every(r => r.acuity === 'PCU' || r.acuity === 'TELE')) continue;

    let bestRoom: PatientRoom | null = null;
    let bestScore = -1;
    for (const room of emptyRooms) {
      if (used.has(room.roomNumber)) continue;
      const geo = evaluateGeographicCluster([...assigned.map(r => r.roomNumber), room.roomNumber]);
      const score = geo.score;
      if (score > bestScore) { bestScore = score; bestRoom = room; }
    }

    if (bestRoom) {
      used.add(bestRoom.roomNumber);
      next.assignments[bestRoom.roomNumber] = nurse.id;
      next.warnings.push({
        type: 'WORKLOAD_RATIO', severity: 'INFO', roomNumber: bestRoom.roomNumber, nurseName: nurse.name,
        message: `Admission-ready staffed bed: room ${bestRoom.roomNumber} is recommended for ${nurse.name}, who has 2 non-ICU patients. This reserves one geographically appropriate bed for a possible PCU/TELE admission.`,
      });
    }
  }

  return next;
}

export function postProcessRecommendation(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[]): RecommendationResult {
  return addAdmissionReadyBeds(repairUnsafeIcuPairs(result, staff, rooms), staff, rooms);
}
