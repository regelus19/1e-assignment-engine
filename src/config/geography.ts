import { RoomMetadata } from '../types';

/*
 * ============================================================================
 * 1 EAST GEOGRAPHY — SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * Everything below is derived from the architectural floor plan committed at
 * src/assets/1e-floorplan.png. Room tile positions and walking distance now
 * come from the SAME coordinates, so the map the Charge Nurse sees and the
 * geography the engine reasons about cannot drift apart.
 *
 * Previously geography was scored by hall membership (A = 101-106,
 * B = 107-113, C = 114-122). That produced known-wrong answers: 122 + 114
 * scored "very good cluster" because both are Hall C, even though they sit at
 * opposite ends of the long west wing. Hard-coded room-number exception lists
 * were then bolted on to patch the symptoms.
 *
 * This model walks the corridors instead.
 */

export type RoomPosition = { left: number; top: number };

/**
 * Room tile centres as a percentage of the floor-plan image.
 * These are the coordinates the map renders with — do not fork this table.
 */
export const ROOM_POSITIONS: Record<string, RoomPosition> = {
  // East wing (101-106), running 106 north -> 101 south.
  '101': { left: 88, top: 89 },
  '102': { left: 88, top: 76 },
  '103': { left: 88, top: 64 },
  '104': { left: 88, top: 45 },
  '105': { left: 88, top: 33 },
  '106': { left: 88, top: 18 },

  // Central pods: 107-109 north of the core, 110-113 south of it.
  '107': { left: 57, top: 21 },
  '108': { left: 57, top: 32 },
  '109': { left: 57, top: 41 },
  '110': { left: 57, top: 59 },
  '111': { left: 57, top: 68 },
  '112': { left: 57, top: 79 },
  '113': { left: 57, top: 90 },

  // West wing (114-122), running 122 north -> 114 south.
  '114': { left: 17, top: 91 },
  '115': { left: 13, top: 79 },
  '116': { left: 13, top: 70 },
  '117': { left: 13, top: 60 },
  '118': { left: 13, top: 52 },
  '119': { left: 17, top: 42 },
  '120': { left: 17, top: 33 },
  '121': { left: 13, top: 21 },
  '122': { left: 13, top: 9 },
};

export const ALL_ROOMS = Object.keys(ROOM_POSITIONS);

/*
 * ---------------------------------------------------------------------------
 * CORRIDOR TOPOLOGY — the tunable part
 * ---------------------------------------------------------------------------
 * Three north-south corridor spines, plus the east-west corridors that
 * actually connect them on the plan.
 *
 * The east wing (101-106) is a spur: the courtyard sits between it and the
 * central pods, so it only joins the rest of the unit at the mid corridor and
 * across the south end. That single fact is what makes 103+113 and 104+114
 * expensive — without any room-number rule existing anywhere.
 */
const SPINE_X = { EAST: 81, CENTRE: 44.5, WEST: 22.5 } as const;
type SpineKey = keyof typeof SPINE_X;

/** Door-to-corridor stub cost. Small: the door opens onto the corridor. */
const STUB = 2;

/** East-west corridors: y position, and which spines each actually links. */
const CROSS_CORRIDORS: { y: number; spines: SpineKey[] }[] = [
  // Corridor 1400K / 1400F / 1400E. The one place the east wing joins the
  // unit: past the nurse core, under the courtyard, into corridor 1400C.
  { y: 51, spines: ['WEST', 'CENTRE', 'EAST'] },
  // Nurse station 1440 and alcoves 1400H / 1400J. Stops at the 110-113 block;
  // the east wing runs to the south exterior wall with no opening westward.
  { y: 90, spines: ['WEST', 'CENTRE'] },
  // NOTE: there is deliberately no north cross corridor. Guest Lounge 1420
  // occupies the full width between corridor 1400L and the 107-109 pod, so
  // 122 and 107 are not the short hop their map positions suggest.
];

const spineForRoom = (roomNumber: string): SpineKey => {
  const n = Number(roomNumber);
  if (n <= 106) return 'EAST';
  if (n <= 113) return 'CENTRE';
  return 'WEST';
};

type Graph = Record<string, Record<string, number>>;

const buildGraph = (): Graph => {
  const graph: Graph = {};
  const link = (a: string, b: string, w: number) => {
    graph[a] = graph[a] || {};
    graph[b] = graph[b] || {};
    graph[a][b] = Math.min(graph[a][b] ?? Infinity, w);
    graph[b][a] = Math.min(graph[b][a] ?? Infinity, w);
  };

  // Every y position each spine needs a node at: rooms it serves plus the
  // cross corridors it participates in.
  const spineYs: Record<SpineKey, number[]> = { EAST: [], CENTRE: [], WEST: [] };
  ALL_ROOMS.forEach(room => spineYs[spineForRoom(room)].push(ROOM_POSITIONS[room].top));
  CROSS_CORRIDORS.forEach(({ y, spines }) => spines.forEach(s => spineYs[s].push(y)));

  const node = (spine: string, y: number) => `${spine}@${y.toFixed(1)}`;

  // Walk each spine end to end.
  (Object.keys(spineYs) as SpineKey[]).forEach(spine => {
    const sorted = Array.from(new Set(spineYs[spine])).sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      link(node(spine, sorted[i - 1]), node(spine, sorted[i]), sorted[i] - sorted[i - 1]);
    }
  });

  // Rooms hang off their spine.
  ALL_ROOMS.forEach(room => {
    link(room, node(spineForRoom(room), ROOM_POSITIONS[room].top), STUB);
  });

  // Cross corridors join neighbouring spines at that y.
  CROSS_CORRIDORS.forEach(({ y, spines }) => {
    for (let i = 1; i < spines.length; i += 1) {
      link(node(spines[i - 1], y), node(spines[i], y), Math.abs(SPINE_X[spines[i - 1]] - SPINE_X[spines[i]]));
    }
  });

  return graph;
};

const GRAPH = buildGraph();
const distanceCache: Record<string, Record<string, number>> = {};

const shortestPathsFrom = (origin: string): Record<string, number> => {
  if (distanceCache[origin]) return distanceCache[origin];

  const dist: Record<string, number> = { [origin]: 0 };
  const visited = new Set<string>();
  const queue: string[] = [origin];

  while (queue.length) {
    let bestIndex = 0;
    for (let i = 1; i < queue.length; i += 1) {
      if (dist[queue[i]] < dist[queue[bestIndex]]) bestIndex = i;
    }
    const current = queue.splice(bestIndex, 1)[0];
    if (visited.has(current)) continue;
    visited.add(current);

    Object.entries(GRAPH[current] || {}).forEach(([next, weight]) => {
      const candidate = dist[current] + weight;
      if (candidate < (dist[next] ?? Infinity)) {
        dist[next] = candidate;
        queue.push(next);
      }
    });
  }

  distanceCache[origin] = dist;
  return dist;
};

/**
 * Corridor walking distance between two rooms, in floor-plan percentage units.
 * Roughly: under 25 is next door or nearly, 40 is a short cross-corridor hop,
 * 60 is a real walk, 80+ is opposite ends of the unit.
 */
export function walkingDistance(roomA: string, roomB: string): number {
  if (roomA === roomB) return 0;
  if (!ROOM_POSITIONS[roomA] || !ROOM_POSITIONS[roomB]) return Infinity;
  return shortestPathsFrom(roomA)[roomB] ?? Infinity;
}

/** Widest walk between any two rooms in a cluster — the nurse's worst case. */
export function clusterSpread(rooms: string[]): number {
  let worst = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    for (let j = i + 1; j < rooms.length; j += 1) {
      worst = Math.max(worst, walkingDistance(rooms[i], rooms[j]));
    }
  }
  return worst;
}

/** Rooms within easy reach of the given room, nearest first. */
export function nearestRooms(roomNumber: string, limit = 4): string[] {
  return ALL_ROOMS
    .filter(r => r !== roomNumber)
    .sort((a, b) => walkingDistance(roomNumber, a) - walkingDistance(roomNumber, b))
    .slice(0, limit);
}

/*
 * ---------------------------------------------------------------------------
 * DISTANCE BANDS — tune these numbers, never room lists
 * ---------------------------------------------------------------------------
 * Scores keep the scale the recommendation engine already multiplies against
 * (about 1.0 good, negative bad), so existing weighting behaviour is preserved.
 */
export const GEOGRAPHY_BANDS = {
  ADJACENT: 25,   // 103+104, 107+108, 121+122
  NEAR: 40,       // 109+118, 113+114, 110+117
  WORKABLE: 62,   // 107/108+120 — fine, not first choice
  STRETCHED: 80,  // 103+113, 122+114 — advisory
} as const;

const interpolate = (value: number, fromLo: number, fromHi: number, toLo: number, toHi: number) =>
  toLo + ((value - fromLo) / (fromHi - fromLo)) * (toHi - toLo);

const listRooms = (rooms: string[]) => [...rooms].sort((a, b) => Number(a) - Number(b)).join(', ');

export function evaluateGeographicCluster(rooms: string[]): { score: number; label: string; reason: string; advisory?: string } {
  const known = rooms.filter(r => ROOM_POSITIONS[r]);
  if (known.length <= 1) return { score: 1.0, label: 'Single room', reason: 'Single room assigned' };

  const spread = clusterSpread(known);
  const walk = `widest walk ${Math.round(spread)}`;

  if (spread <= GEOGRAPHY_BANDS.ADJACENT) {
    return { score: 1.0, label: 'Excellent cluster', reason: `Rooms are adjacent or near-adjacent (${walk})` };
  }
  if (spread <= GEOGRAPHY_BANDS.NEAR) {
    return {
      score: interpolate(spread, GEOGRAPHY_BANDS.ADJACENT, GEOGRAPHY_BANDS.NEAR, 1.0, 0.85),
      label: 'Very good cluster',
      reason: `Short corridor hop between rooms (${walk})`,
    };
  }
  if (spread <= GEOGRAPHY_BANDS.WORKABLE) {
    return {
      score: interpolate(spread, GEOGRAPHY_BANDS.NEAR, GEOGRAPHY_BANDS.WORKABLE, 0.85, 0.5),
      label: 'Workable cluster',
      reason: `Crosses the unit but stays in one band (${walk})`,
    };
  }
  if (spread <= GEOGRAPHY_BANDS.STRETCHED) {
    return {
      score: interpolate(spread, GEOGRAPHY_BANDS.WORKABLE, GEOGRAPHY_BANDS.STRETCHED, 0.5, -1.5),
      label: 'Stretched geography',
      reason: `Long walk between rooms (${walk})`,
      advisory: `⚠ LONG WALK — ${listRooms(known)} — CHARGE NURSE REVIEW`,
    };
  }
  return {
    score: Math.max(-5.5, interpolate(spread, GEOGRAPHY_BANDS.STRETCHED, 110, -1.5, -5.5)),
    label: 'Opposite ends of the unit',
    reason: `Rooms sit at opposite ends of 1 East (${walk})`,
    advisory: `⚠ OPPOSITE ENDS OF UNIT — ${listRooms(known)} — AVOID IN AUTO ASSIGNMENT`,
  };
}

/*
 * ---------------------------------------------------------------------------
 * ROOM METADATA
 * ---------------------------------------------------------------------------
 * hall/zone are retained for display and the dialysis capability rule.
 * adjacentRooms is now DERIVED from walking distance rather than hand-listed
 * (the hand-listed version claimed 113 was adjacent to 122, which is the full
 * length of the unit away).
 */
const HALL_OF: Record<SpineKey, 'A' | 'B' | 'C'> = { EAST: 'A', CENTRE: 'B', WEST: 'C' };
const ICU_CAPABLE = new Set(['101', '102', '103', '104', '105', '106', '113', '114', '122']);
const SAFETY_PREFERRED = new Set(['109', '119']);
const zoneFor = (top: number): 'Upper' | 'Mid' | 'Lower' => (top < 38 ? 'Upper' : top < 66 ? 'Mid' : 'Lower');

export const ROOM_METADATA_MAP: Record<string, RoomMetadata> = ALL_ROOMS.reduce((acc, roomNumber) => {
  const spine = spineForRoom(roomNumber);
  acc[roomNumber] = {
    roomNumber,
    hall: HALL_OF[spine],
    zone: zoneFor(ROOM_POSITIONS[roomNumber].top),
    isICUCapable: ICU_CAPABLE.has(roomNumber),
    isSafetyPreferred: SAFETY_PREFERRED.has(roomNumber),
    proximityGroups: [`SPINE_${spine}`],
    adjacentRooms: ALL_ROOMS.filter(r => r !== roomNumber && walkingDistance(roomNumber, r) <= GEOGRAPHY_BANDS.ADJACENT),
  };
  return acc;
}, {} as Record<string, RoomMetadata>);
