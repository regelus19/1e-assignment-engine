import { walkingDistance, evaluateGeographicCluster, nearestRooms } from '../src/config/geography';

const cases: [string[], string][] = [
  [['103','104'], 'GOOD (CN: nearby ICU pair)'],
  [['113','114'], 'OK-ish (CN: when proximity permits)'],
  [['107','108'], 'GOOD'],
  [['121','122'], 'GOOD'],
  [['109','118'], 'GOOD (CN: acceptable)'],
  [['109','117'], 'GOOD (CN: acceptable)'],
  [['107','108','120'], 'ACCEPTABLE (CN: acceptable)'],
  [['110','117'], 'WORKABLE not first priority'],
  [['103','113'], 'BAD (CN: too far)'],
  [['104','114'], 'BAD (CN: too far)'],
  [['122','114'], 'BAD (CN: avoid)'],
  [['122','120','121'], 'GOOD (CN: 122 w/ nearby lower acuity)'],
  [['122','113'], 'should be BAD (old code called this preferred!)'],
  [['101','106'], 'whole east wing'],
  [['106','109','121'], 'BAD (three-way spread)'],
];

console.log('PAIR / CLUSTER        DIST   SCORE  LABEL                        EXPECTED');
for (const [rooms, expected] of cases) {
  const g = evaluateGeographicCluster(rooms);
  const d = rooms.length === 2 ? walkingDistance(rooms[0], rooms[1]) : NaN;
  console.log(
    rooms.join('+').padEnd(20),
    (isNaN(d) ? '  -' : d.toFixed(0).padStart(5)),
    g.score.toFixed(2).padStart(7),
    ' ' + g.label.padEnd(28),
    expected,
  );
}
console.log('\nNearest rooms (derived adjacency):');
['103','109','113','114','120','122'].forEach(r => console.log(' ', r, '→', nearestRooms(r, 4).join(', ')));
