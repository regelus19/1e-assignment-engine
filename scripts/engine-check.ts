import { runRecommendationEngine } from '../src/services/recommendationEngine';
import { postProcessRecommendation } from '../src/services/recommendationPostProcessor';
import { INITIAL_STAFF, INITIAL_ROOMS } from '../src/services/storage';
import { NurseStaff, PatientRoom } from '../src/types';
import { clusterSpread } from '../src/config/geography';

const staff: NurseStaff[] = JSON.parse(JSON.stringify(INITIAL_STAFF));
staff.push({ id:'n10', name:'Renee Cole', role:'Preceptor', assignedPhone:'44-4100', capability:'ICU', staffStatus:'ACTIVE', orientationPartnerId:'n11' });
staff.push({ id:'n11', name:'Mark Alvarez', role:'Orientee', assignedPhone:'', capability:'PCU_TELE', staffStatus:'ACTIVE', orientationPartnerId:'n10' });
staff.find(s=>s.id==='n7')!.staffStatus='ACTIVE';

const rooms: PatientRoom[] = JSON.parse(JSON.stringify(INITIAL_ROOMS));
const name = (id?: string|null) => staff.find(s=>s.id===id)?.name.split(' ')[0] ?? '—';

const show = (title: string, res: ReturnType<typeof runRecommendationEngine>) => {
  console.log(`\n=== ${title} — ${res.fitLabel} (${res.fitScore})`);
  const byNurse = new Map<string,string[]>();
  Object.entries(res.assignments).forEach(([room,id]) => byNurse.set(id, [...(byNurse.get(id)||[]), room]));
  [...byNurse.entries()].forEach(([id, rs]) => {
    const occ = rs.filter(r => rooms.find(x=>x.roomNumber===r)?.isOccupied);
    const spread = clusterSpread(occ);
    const acu = occ.map(r => `${r}/${rooms.find(x=>x.roomNumber===r)!.acuity}`).join(' ');
    console.log(`  ${name(id).padEnd(11)} ${acu.padEnd(34)} spread ${spread.toFixed(0).padStart(3)}${spread>62?'   <-- LONG WALK':''}`);
  });
  if (res.unassignedRooms.length) console.log('  UNASSIGNED:', res.unassignedRooms.join(', '));
  res.warnings.filter(w=>w.severity!=='INFO').forEach(w=>console.log(`  ! ${w.severity} ${w.message.slice(0,110)}`));
};

const run = (fixed = {}, locked: string[] = []) =>
  postProcessRecommendation(
    runRecommendationEngine(staff, rooms, false, false, 'BALANCED', fixed, locked),
    staff, rooms, Object.keys(fixed), locked);

show('AUTO — balanced, nothing preassigned', run());

// Semi-Auto: CN seeds one room on Elena, does NOT lock her.
show('SEMI-AUTO — 116 preassigned to Halley, UNLOCKED (should still fill to ratio)', run({'116':'n6'}));

// Semi-Auto: CN seeds one room on Halley and LOCKS her.
show('SEMI-AUTO — 116 preassigned to Halley, LOCKED (must stay at 1 room)', run({'116':'n6'}, ['n6']));
