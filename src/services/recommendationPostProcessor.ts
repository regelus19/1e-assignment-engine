import { NurseStaff, PatientRoom, RecommendationResult } from '../types';
import { GEOGRAPHY_BANDS, clusterSpread, evaluateGeographicCluster, walkingDistance } from '../config/geography';

/*
 * Unsafe and preferred ICU pairings are DERIVED from floor-plan walking
 * distance, not listed by room number. The previous hard-coded lists had to be
 * extended by hand every time the CN found another bad combination, and they
 * disagreed with each other (122+113 was on the "preferred" list in the engine
 * while being one of the longest walks on the unit).
 */
const ICU_TOO_FAR = GEOGRAPHY_BANDS.WORKABLE;   // beyond a workable walk
const ICU_CLOSE = GEOGRAPHY_BANDS.NEAR;         // genuinely nearby

const isCriticalCareCapable = (n: NurseStaff) => n.capability === 'ICU' || n.capability === 'CVICU';
const isActiveBedside = (n: NurseStaff) => ['RN', 'Preceptor'].includes(n.role) && ['ACTIVE', 'RECALLED'].includes(n.staffStatus);

const assignedRoomsFor = (result: RecommendationResult, nurseId: string, rooms: PatientRoom[]) =>
  rooms.filter(r => r.isOccupied && result.assignments[r.roomNumber] === nurseId);

const criticalRoomNumbers = (roomNumbers: string[], rooms: PatientRoom[]) =>
  roomNumbers.filter(num => rooms.some(r => r.roomNumber === num && r.isOccupied && ['ICU', 'CVICU'].includes(r.acuity)));

const widestCriticalWalk = (roomNumbers: string[], rooms: PatientRoom[]): { distance: number; pair: [string, string] | null } => {
  const critical = criticalRoomNumbers(roomNumbers, rooms);
  let distance = 0;
  let pair: [string, string] | null = null;
  for (let i = 0; i < critical.length; i += 1) {
    for (let j = i + 1; j < critical.length; j += 1) {
      const d = walkingDistance(critical[i], critical[j]);
      if (d > distance) { distance = d; pair = [critical[i], critical[j]]; }
    }
  }
  return { distance, pair };
};

const isUnsafePair = (roomNumbers: string[], rooms: PatientRoom[]) =>
  widestCriticalWalk(roomNumbers, rooms).distance > ICU_TOO_FAR;

const isPreferredPair = (roomNumbers: string[], rooms: PatientRoom[]) => {
  const { distance, pair } = widestCriticalWalk(roomNumbers, rooms);
  return !!pair && distance <= ICU_CLOSE;
};

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

/**
 * Two nurses each holding a pair of ICU rooms, cross-paired so both walk the
 * length of the unit, when simply swapping one room would give each nurse a
 * tight pair. Detected geometrically for any four rooms, not just 103/104/113/114.
 */
function repairCrossPairedIcu(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[], lockedRooms: Set<string>) {
  const pairsByNurse = new Map<string, string[]>();
  rooms.filter(r => r.isOccupied && ['ICU', 'CVICU'].includes(r.acuity)).forEach(r => {
    const nurseId = result.assignments[r.roomNumber];
    if (!nurseId) return;
    pairsByNurse.set(nurseId, [...(pairsByNurse.get(nurseId) || []), r.roomNumber]);
  });

  const twoRoomNurses = [...pairsByNurse.entries()].filter(([, rs]) => rs.length === 2);

  for (let i = 0; i < twoRoomNurses.length; i += 1) {
    for (let j = i + 1; j < twoRoomNurses.length; j += 1) {
      const [idA, roomsA] = twoRoomNurses[i];
      const [idB, roomsB] = twoRoomNurses[j];
      const quartet = [...roomsA, ...roomsB];
      if (quartet.some(r => lockedRooms.has(r))) continue;

      const a = staff.find(n => n.id === idA);
      const b = staff.find(n => n.id === idB);
      if (!a || !b || ![a, b].every(n => isActiveBedside(n) && isCriticalCareCapable(n))) continue;

      const currentWorst = Math.max(walkingDistance(roomsA[0], roomsA[1]), walkingDistance(roomsB[0], roomsB[1]));

      // Try both alternative ways of splitting the same four rooms.
      const alternatives: [string[], string[]][] = [
        [[roomsA[0], roomsB[0]], [roomsA[1], roomsB[1]]],
        [[roomsA[0], roomsB[1]], [roomsA[1], roomsB[0]]],
      ];

      type Regroup = { forA: string[]; forB: string[]; worst: number };
      let best: Regroup | undefined;
      for (const [forA, forB] of alternatives) {
        const worst = Math.max(walkingDistance(forA[0], forA[1]), walkingDistance(forB[0], forB[1]));
        if (!best || worst < best.worst) best = { forA, forB, worst };
      }

      // Only rearrange when it is a clear improvement.
      if (!best || best.worst >= currentWorst - 5) continue;

      best.forA.forEach((r: string) => { result.assignments[r] = idA; });
      best.forB.forEach((r: string) => { result.assignments[r] = idB; });
      syncNurseDetails(result, rooms);
      result.warnings.push({
        type: 'GEOGRAPHY', severity: 'INFO',
        message: `ICU proximity correction: regrouped ${quartet.sort().join(', ')} into ${best.forA.join('+')} and ${best.forB.join('+')}, cutting the longest critical-care walk from ${Math.round(currentWorst)} to ${Math.round(best.worst)}.`,
      });
      return;
    }
  }
}

function repairUnsafeIcuPairs(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[], lockedRooms: Set<string>, lockedNurses: Set<string>): RecommendationResult {
  const next: RecommendationResult = {
    ...result,
    assignments: { ...result.assignments },
    nurseDetails: result.nurseDetails.map(n => ({ ...n, assignedRooms: [...n.assignedRooms], reasons: [...n.reasons] })),
    warnings: [...result.warnings],
  };

  repairCrossPairedIcu(next, staff, rooms, lockedRooms);

  // Find any nurse whose critical-care rooms are further apart than workable.
  const offenders = new Map<string, [string, string]>();
  rooms.filter(r => r.isOccupied && ['ICU', 'CVICU'].includes(r.acuity)).forEach(r => {
    const nurseId = next.assignments[r.roomNumber];
    if (!nurseId) return;
    const held = rooms.filter(x => x.isOccupied && ['ICU', 'CVICU'].includes(x.acuity) && next.assignments[x.roomNumber] === nurseId).map(x => x.roomNumber);
    const { distance, pair } = widestCriticalWalk(held, rooms);
    if (pair && distance > ICU_TOO_FAR) offenders.set(nurseId, pair);
  });

  for (const [nurseId, [a, b]] of offenders) {
    const currentNurse = staff.find(n => n.id === nurseId);
    const roomA = rooms.find(r => r.roomNumber === a);
    const roomB = rooms.find(r => r.roomNumber === b);
    if (!roomA || !roomB) continue;

    const moveChoices = [roomB, roomA].filter(r => !lockedRooms.has(r.roomNumber));
    let best: { room: PatientRoom; nurse: NurseStaff; score: number } | null = null;

    for (const movingRoom of moveChoices) {
      for (const nurse of staff.filter(isActiveBedside).filter(isCriticalCareCapable).filter(n => n.id !== nurseId && !lockedNurses.has(n.id))) {
        const existing = assignedRoomsFor(next, nurse.id, rooms);
        if (!canSafelyTakeMovedIcu(existing)) continue;
        const proposedNumbers = [...existing.map(r => r.roomNumber), movingRoom.roomNumber];
        if (isUnsafePair(proposedNumbers, rooms)) continue;
        const geo = evaluateGeographicCluster(proposedNumbers);
        let score = geo.score * 100 + (existing.length === 0 ? 10 : 0);
        if (isPreferredPair(proposedNumbers, rooms)) score += 150;
        if (!best || score > best.score) best = { room: movingRoom, nurse, score };
      }
    }

    if (best) {
      next.assignments[best.room.roomNumber] = best.nurse.id;
      syncNurseDetails(next, rooms);
      next.warnings.push({
        type: 'GEOGRAPHY', severity: 'INFO', roomNumber: best.room.roomNumber, nurseName: best.nurse.name,
        message: `Safety correction applied: moved critical-care room ${best.room.roomNumber} from ${currentNurse?.name || 'the original RN'} to ${best.nurse.name}. Rooms ${a} and ${b} are ${Math.round(walkingDistance(a, b))} apart on the floor plan.`,
      });
    } else {
      next.warnings.push({
        type: 'GEOGRAPHY', severity: 'HIGH', roomNumber: a, nurseName: currentNurse?.name,
        message: lockedRooms.has(a) || lockedRooms.has(b)
          ? `Long critical-care split remains: rooms ${a} and ${b} are on the same RN and at least one is CN-fixed. The engine will not override the Charge Nurse; review before applying.`
          : `Long critical-care split remains: rooms ${a} and ${b} are on the same RN and ${Math.round(walkingDistance(a, b))} apart. No safer staffed alternative was found; Charge Nurse review is required.`,
      });
    }
  }

  return next;
}

function addAdmissionReadyBeds(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[], lockedNurses: Set<string>): RecommendationResult {
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
    if (!nurse || !isActiveBedside(nurse) || lockedNurses.has(nurse.id)) continue;
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


/**
 * Geographic tightening pass.
 *
 * The main engine places rooms greedily by acuity, so the last few rooms land
 * wherever ratio still permits — which is how a nurse ends up holding 111, 118
 * and 122. This pass looks for a straight swap of one room between two nurses
 * that lowers the worst walk on the unit, and only accepts it when capability
 * and workload still hold for both nurses. Locked nurses and CN-fixed rooms
 * are never touched.
 */
function tightenGeography(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[], lockedRooms: Set<string>, lockedNurses: Set<string>): RecommendationResult {
  const next: RecommendationResult = {
    ...result,
    assignments: { ...result.assignments },
    nurseDetails: result.nurseDetails.map(n => ({ ...n, assignedRooms: [...n.assignedRooms], reasons: [...n.reasons] })),
    warnings: [...result.warnings],
  };

  const roomOf = (num: string) => rooms.find(r => r.roomNumber === num);
  const occupiedFor = (nurseId: string) => rooms.filter(r => r.isOccupied && next.assignments[r.roomNumber] === nurseId);

  // Ratio check for a proposed room set, mirroring the engine's limits.
  const workloadOk = (set: PatientRoom[]) => {
    const cvicu = set.filter(r => r.acuity === 'CVICU').length;
    const icu = set.filter(r => r.acuity === 'ICU').length;
    const lower = set.filter(r => r.acuity === 'PCU' || r.acuity === 'TELE').length;
    if (cvicu > 1 || (cvicu === 1 && set.length > 1)) return false;
    if (icu > 2) return false;
    if (icu === 1 && lower > 1) return false;
    if (icu === 2 && lower > 0) return false;
    return lower <= 3;
  };
  const capableOf = (nurse: NurseStaff, set: PatientRoom[]) => set.every(r =>
    nurse.capability === 'CVICU'
      ? true
      : nurse.capability === 'ICU'
        ? ['ICU', 'PCU', 'TELE'].includes(r.acuity)
        : ['PCU', 'TELE'].includes(r.acuity));

  const movable = (nurseId: string) => !lockedNurses.has(nurseId);

  for (let pass = 0; pass < 4; pass += 1) {
    const nurseIds = Array.from(new Set(Object.values(next.assignments))).filter(movable);
    let improved = false;

    for (const idA of nurseIds) {
      for (const idB of nurseIds) {
        if (idA >= idB) continue;
        const nurseA = staff.find(n => n.id === idA);
        const nurseB = staff.find(n => n.id === idB);
        if (!nurseA || !nurseB) continue;

        const roomsA = occupiedFor(idA);
        const roomsB = occupiedFor(idB);
        if (roomsA.length < 1 || roomsB.length < 1) continue;

        const before = Math.max(
          clusterSpread(roomsA.map(r => r.roomNumber)),
          clusterSpread(roomsB.map(r => r.roomNumber)),
        );
        if (before <= GEOGRAPHY_BANDS.NEAR) continue;

        for (const ra of roomsA) {
          if (lockedRooms.has(ra.roomNumber)) continue;
          for (const rb of roomsB) {
            if (lockedRooms.has(rb.roomNumber)) continue;

            const proposedA = [...roomsA.filter(r => r !== ra), rb];
            const proposedB = [...roomsB.filter(r => r !== rb), ra];
            if (!capableOf(nurseA, proposedA) || !capableOf(nurseB, proposedB)) continue;
            if (!workloadOk(proposedA) || !workloadOk(proposedB)) continue;

            const after = Math.max(
              clusterSpread(proposedA.map(r => r.roomNumber)),
              clusterSpread(proposedB.map(r => r.roomNumber)),
            );
            if (after >= before - 3) continue;

            next.assignments[ra.roomNumber] = idB;
            next.assignments[rb.roomNumber] = idA;
            syncNurseDetails(next, rooms);
            next.warnings.push({
              type: 'GEOGRAPHY', severity: 'INFO',
              message: `Geographic tightening: swapped room ${ra.roomNumber} and room ${rb.roomNumber} between ${nurseA.name} and ${nurseB.name}, cutting the worst walk from ${Math.round(before)} to ${Math.round(after)}.`,
            });
            improved = true;
            break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
      if (improved) break;
    }
    if (!improved) break;
  }

  // Drop stale long-walk advisories that the tightening pass has resolved.
  const stillLong = new Set(
    Array.from(new Set(Object.values(next.assignments)))
      .filter(id => clusterSpread(occupiedFor(id).map(r => r.roomNumber)) > GEOGRAPHY_BANDS.WORKABLE)
      .map(id => staff.find(n => n.id === id)?.name || ''),
  );
  next.warnings = next.warnings.filter(w => !(w.type === 'GEOGRAPHY' && w.severity === 'MEDIUM' && w.nurseName && !stillLong.has(w.nurseName)));

  void roomOf;
  return next;
}

/**
 * Two distinct protections, deliberately kept separate:
 *
 *  - `fixedRoomNumbers` — rooms the Charge Nurse assigned by hand. These are
 *    NEVER moved by any pass, full stop.
 *  - `lockedNurseIds`   — nurses the Charge Nurse explicitly locked. These
 *    receive no further patients.
 *
 * Previously the second was inferred from the first, so pre-assigning a single
 * room silently capped that nurse. The CN normally seeds a nurse's sickest
 * patient and still expects Semi-Auto to fill them to ratio.
 */
export function postProcessRecommendation(result: RecommendationResult, staff: NurseStaff[], rooms: PatientRoom[], fixedRoomNumbers: string[] = [], lockedNurseIds: string[] = []): RecommendationResult {
  const lockedRooms = new Set(fixedRoomNumbers);
  const lockedNurses = new Set(lockedNurseIds);
  const repaired = repairUnsafeIcuPairs(result, staff, rooms, lockedRooms, lockedNurses);
  const tightened = tightenGeography(repaired, staff, rooms, lockedRooms, lockedNurses);
  return addAdmissionReadyBeds(tightened, staff, rooms, lockedNurses);
}
