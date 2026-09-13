import { RoomMetadata } from '../types';

export const PROXIMITY_GROUPS = {
  GROUP_A: ['101', '102', '103', '104', '105', '106'],
  GROUP_B: ['107', '108', '109', '110', '111', '112', '113'],
  GROUP_C: ['114', '115', '116', '117', '118', '119', '120', '121', '122'],

  // Human-like compact working zones derived from unit practice.
  // These are intentionally stronger than generic hall membership.
  GROUP_A_B_BRIDGE_COMPACT: ['103', '104', '105', '106', '109', '110', '111'],
  GROUP_B_C_UPPER_COMPACT: ['110', '111', '112', '113', '114', '115', '116'],
  GROUP_C_UPPER_MID: ['114', '115', '116', '117', '118', '119'],
  GROUP_C_LOWER: ['118', '119', '120', '121', '122'],

  // Preferred cross-hall working zone identified by unit workflow:
  // combinations of Hall B 107-110 with Hall C 117-122 can be workable.
  GROUP_BC_PREFERRED: ['107', '108', '109', '110', '117', '118', '119', '120', '121', '122'],

  // Secondary cross-hall working zone. Doable, but not a first-priority cluster.
  GROUP_BC_SECONDARY: ['110', '111', '112', '113', '114', '115', '116', '117'],
  GROUP_AB_BRIDGE: ['103', '104', '109', '110', '111'],
};

export const ROOM_METADATA_MAP: Record<string, RoomMetadata> = {
  // Hall A
  '101': { roomNumber: '101', hall: 'A', zone: 'Lower', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_A'], adjacentRooms: ['102', '103'] },
  '102': { roomNumber: '102', hall: 'A', zone: 'Lower', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_A'], adjacentRooms: ['101', '103', '104'] },
  '103': { roomNumber: '103', hall: 'A', zone: 'Mid', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_A', 'GROUP_AB_BRIDGE'], adjacentRooms: ['101', '102', '104', '109'] },
  '104': { roomNumber: '104', hall: 'A', zone: 'Mid', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_A', 'GROUP_AB_BRIDGE'], adjacentRooms: ['102', '103', '105', '109', '110'] },
  '105': { roomNumber: '105', hall: 'A', zone: 'Upper', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_A'], adjacentRooms: ['104', '106', '110'] },
  '106': { roomNumber: '106', hall: 'A', zone: 'Upper', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_A'], adjacentRooms: ['105', '107', '111'] },

  // Hall B
  '107': { roomNumber: '107', hall: 'B', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_PREFERRED'], adjacentRooms: ['106', '108', '114'] },
  '108': { roomNumber: '108', hall: 'B', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_PREFERRED'], adjacentRooms: ['107', '109', '115'] },
  '109': { roomNumber: '109', hall: 'B', zone: 'Mid', isICUCapable: false, isSafetyPreferred: true, proximityGroups: ['GROUP_B', 'GROUP_BC_PREFERRED', 'GROUP_AB_BRIDGE'], adjacentRooms: ['103', '104', '108', '110', '118', '119'] },
  '110': { roomNumber: '110', hall: 'B', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_PREFERRED', 'GROUP_BC_SECONDARY', 'GROUP_AB_BRIDGE'], adjacentRooms: ['104', '105', '109', '111', '119'] },
  '111': { roomNumber: '111', hall: 'B', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SECONDARY', 'GROUP_AB_BRIDGE'], adjacentRooms: ['106', '110', '112', '120'] },
  '112': { roomNumber: '112', hall: 'B', zone: 'Lower', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SECONDARY'], adjacentRooms: ['111', '113', '115', '121'] },
  '113': { roomNumber: '113', hall: 'B', zone: 'Lower', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SECONDARY'], adjacentRooms: ['112', '122'] },

  // Hall C
  '114': { roomNumber: '114', hall: 'C', zone: 'Upper', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SECONDARY'], adjacentRooms: ['107', '115'] },
  '115': { roomNumber: '115', hall: 'C', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SECONDARY'], adjacentRooms: ['108', '112', '114', '116'] },
  '116': { roomNumber: '116', hall: 'C', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SECONDARY'], adjacentRooms: ['115', '117'] },
  '117': { roomNumber: '117', hall: 'C', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_PREFERRED', 'GROUP_BC_SECONDARY'], adjacentRooms: ['116', '118'] },
  '118': { roomNumber: '118', hall: 'C', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_PREFERRED'], adjacentRooms: ['109', '117', '119'] },
  '119': { roomNumber: '119', hall: 'C', zone: 'Mid', isICUCapable: false, isSafetyPreferred: true, proximityGroups: ['GROUP_C', 'GROUP_BC_PREFERRED'], adjacentRooms: ['109', '110', '118', '120'] },
  '120': { roomNumber: '120', hall: 'C', zone: 'Lower', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_PREFERRED'], adjacentRooms: ['111', '119', '121'] },
  '121': { roomNumber: '121', hall: 'C', zone: 'Lower', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_PREFERRED'], adjacentRooms: ['112', '120', '122'] },
  '122': { roomNumber: '122', hall: 'C', zone: 'Lower', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_PREFERRED'], adjacentRooms: ['113', '121'] },
};

const allIn = (rooms: string[], group: string[]) => rooms.every(r => group.includes(r));

export function evaluateGeographicCluster(rooms: string[]): { score: number; label: string; reason: string; advisory?: string } {
  if (rooms.length <= 1) {
    return { score: 1.0, label: 'Single room', reason: 'Single room assigned' };
  }

  // Specific tight cross-hall adjacency.
  if (rooms.length === 2 && rooms.includes('112') && rooms.includes('115')) {
    return { score: 1.0, label: 'Excellent cluster', reason: 'Direct adjacency 112 ↔ 115 across South bridge' };
  }

  const metas = rooms.map(r => ROOM_METADATA_MAP[r]).filter(Boolean);
  const halls = new Set(metas.map(m => m.hall));

  // HARD HUMAN-FACTOR GUARDRAILS.
  // Hall A + Hall C without a Hall B bridge is a long split and should almost never be auto-generated.
  // Example: 104 + 119 + 120. The CN can still create it manually in Semi-Auto if operationally required.
  if (halls.has('A') && halls.has('C') && !halls.has('B')) {
    return {
      score: -5.5,
      label: 'Very poor split',
      reason: 'Hall A-to-Hall C assignment without a Hall B bridge',
      advisory: '⚠ A↔C SPLIT — AVOID IN AUTO ASSIGNMENT; CN OVERRIDE ONLY'
    };
  }

  // Spanning all three halls is also strongly disfavored. Example: 106 + 109 + 121.
  if (halls.size === 3) {
    return {
      score: -4.5,
      label: 'Very poor split',
      reason: 'Assignment spans Halls A, B, and C',
      advisory: '⚠ THREE-HALL ASSIGNMENT — AVOID WHEN ANY COMPACT ALTERNATIVE EXISTS'
    };
  }

  // Compact human-like clusters get the highest preference.
  if (allIn(rooms, PROXIMITY_GROUPS.GROUP_A_B_BRIDGE_COMPACT) && halls.has('A') && halls.has('B')) {
    return { score: 1.0, label: 'Excellent operational cluster', reason: 'Compact Hall A/B bridge cluster' };
  }
  if (allIn(rooms, PROXIMITY_GROUPS.GROUP_B_C_UPPER_COMPACT) && halls.has('B') && halls.has('C')) {
    return { score: 1.0, label: 'Excellent operational cluster', reason: 'Compact Hall B/C upper cluster' };
  }
  if (allIn(rooms, PROXIMITY_GROUPS.GROUP_C_UPPER_MID)) {
    return { score: 1.0, label: 'Excellent operational cluster', reason: 'Compact Hall C upper/mid cluster' };
  }
  if (allIn(rooms, PROXIMITY_GROUPS.GROUP_C_LOWER)) {
    return { score: 1.0, label: 'Excellent operational cluster', reason: 'Compact Hall C lower cluster' };
  }

  // Same-hall assignments remain highly preferred.
  if (halls.size === 1) {
    return { score: 0.94, label: 'Very good cluster', reason: `Rooms remain within Hall ${Array.from(halls)[0]}` };
  }

  // First-priority Hall B/C cross-hall zone: 107-110 combined with 117-122.
  // Unit workflow has identified combinations such as 107/108/120 or 109/118/117 as workable.
  if (allIn(rooms, PROXIMITY_GROUPS.GROUP_BC_PREFERRED) && halls.has('B') && halls.has('C')) {
    return { score: 0.90, label: 'Good cross-hall cluster', reason: 'Preferred Hall B/C cross-hall zone (107-110 with 117-122)' };
  }

  // Secondary Hall B/C zone: 110-117. Operationally workable but lower priority.
  if (allIn(rooms, PROXIMITY_GROUPS.GROUP_BC_SECONDARY) && halls.has('B') && halls.has('C')) {
    return { score: 0.78, label: 'Acceptable cross-hall cluster', reason: 'Secondary Hall B/C working zone (110-117)' };
  }

  // A/B bridge-supported cross-hall cluster.
  if (rooms.some(r => PROXIMITY_GROUPS.GROUP_AB_BRIDGE.includes(r)) && halls.has('A') && halls.has('B')) {
    return { score: 0.82, label: 'Good cluster', reason: 'Assignment uses the A/B bridge zone' };
  }

  return {
    score: -1.5,
    label: 'Split geography',
    reason: 'Rooms span disconnected halls/zones',
    advisory: '⚠ SPLIT GEOGRAPHIC ASSIGNMENT — CHARGE NURSE REVIEW'
  };
}
