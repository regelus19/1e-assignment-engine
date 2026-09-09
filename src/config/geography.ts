import { RoomMetadata } from '../types';

export const PROXIMITY_GROUPS = {
  GROUP_A: ['101', '102', '103', '104', '105', '106'],
  GROUP_B: ['107', '108', '109', '110', '111', '112', '113'],
  GROUP_C: ['114', '115', '116', '117', '118', '119', '120', '121', '122'],
  GROUP_BC_NORTH: ['107', '108', '109', '118', '119', '120', '121', '122'],
  GROUP_BC_SOUTH: ['110', '111', '112', '113', '114', '115', '116', '117'],
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
  '107': { roomNumber: '107', hall: 'B', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_NORTH'], adjacentRooms: ['106', '108', '114'] },
  '108': { roomNumber: '108', hall: 'B', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_NORTH'], adjacentRooms: ['107', '109', '115'] },
  '109': { roomNumber: '109', hall: 'B', zone: 'Mid', isICUCapable: false, isSafetyPreferred: true, proximityGroups: ['GROUP_B', 'GROUP_BC_NORTH', 'GROUP_AB_BRIDGE'], adjacentRooms: ['103', '104', '108', '110', '118', '119'] },
  '110': { roomNumber: '110', hall: 'B', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SOUTH', 'GROUP_AB_BRIDGE'], adjacentRooms: ['104', '105', '109', '111', '119'] },
  '111': { roomNumber: '111', hall: 'B', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SOUTH', 'GROUP_AB_BRIDGE'], adjacentRooms: ['106', '110', '112', '120'] },
  '112': { roomNumber: '112', hall: 'B', zone: 'Lower', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SOUTH'], adjacentRooms: ['111', '113', '115', '121'] },
  '113': { roomNumber: '113', hall: 'B', zone: 'Lower', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_B', 'GROUP_BC_SOUTH'], adjacentRooms: ['112', '122'] },

  // Hall C
  '114': { roomNumber: '114', hall: 'C', zone: 'Upper', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SOUTH'], adjacentRooms: ['107', '115'] },
  '115': { roomNumber: '115', hall: 'C', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SOUTH'], adjacentRooms: ['108', '112', '114', '116'] },
  '116': { roomNumber: '116', hall: 'C', zone: 'Upper', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SOUTH'], adjacentRooms: ['115', '117'] },
  '117': { roomNumber: '117', hall: 'C', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_SOUTH'], adjacentRooms: ['116', '118'] },
  '118': { roomNumber: '118', hall: 'C', zone: 'Mid', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_NORTH'], adjacentRooms: ['109', '117', '119'] },
  '119': { roomNumber: '119', hall: 'C', zone: 'Mid', isICUCapable: false, isSafetyPreferred: true, proximityGroups: ['GROUP_C', 'GROUP_BC_NORTH'], adjacentRooms: ['109', '110', '118', '120'] },
  '120': { roomNumber: '120', hall: 'C', zone: 'Lower', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_NORTH'], adjacentRooms: ['111', '119', '121'] },
  '121': { roomNumber: '121', hall: 'C', zone: 'Lower', isICUCapable: false, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_NORTH'], adjacentRooms: ['112', '120', '122'] },
  '122': { roomNumber: '122', hall: 'C', zone: 'Lower', isICUCapable: true, isSafetyPreferred: false, proximityGroups: ['GROUP_C', 'GROUP_BC_NORTH'], adjacentRooms: ['113', '121'] },
};

export function evaluateGeographicCluster(rooms: string[]): { score: number; label: string; reason: string; advisory?: string } {
  if (rooms.length <= 1) {
    return { score: 1.0, label: 'Single room', reason: 'Single room assigned' };
  }

  // Check 112 <-> 115 specific tight cross-hall adjacency
  if (rooms.length === 2 && rooms.includes('112') && rooms.includes('115')) {
    return { score: 1.0, label: 'Excellent cluster', reason: 'Direct adjacency 112 ↔ 115 across South bridge' };
  }

  const metas = rooms.map(r => ROOM_METADATA_MAP[r]).filter(Boolean);
  
  // Find common proximity groups
  const commonGroups = Object.entries(PROXIMITY_GROUPS).filter(([_, groupRooms]) => 
    rooms.every(r => groupRooms.includes(r))
  );

  if (commonGroups.length > 0) {
    const groupName = commonGroups[0][0].replace('_', ' ');
    return { score: 0.95, label: 'Very good cluster', reason: `All rooms share ${groupName}` };
  }

  // Same hall check
  const halls = new Set(metas.map(m => m.hall));
  if (halls.size === 1) {
    return { score: 0.75, label: 'Acceptable cluster', reason: `Rooms within Hall ${Array.from(halls)[0]}` };
  }

  // Cross hall with bridge overlap
  if (rooms.some(r => PROXIMITY_GROUPS.GROUP_AB_BRIDGE.includes(r)) && halls.has('A') && halls.has('B')) {
    return { score: 0.85, label: 'Very good cluster', reason: 'Cluster supported by AB Bridge' };
  }

  return {
    score: 0.35,
    label: 'Split geography',
    reason: 'Rooms span disconnected halls/zones',
    advisory: '⚠ SPLIT GEOGRAPHIC ASSIGNMENT — CHARGE NURSE REVIEW'
  };
}
