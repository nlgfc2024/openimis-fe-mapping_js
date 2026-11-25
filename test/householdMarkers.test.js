const assert = require('assert');
const path = require('path');
const { householdMarkerGroups } = require('./load')(path.resolve(__dirname, '../src/geo/householdMarkers.js'));

const households = Array.from({length:10}, (_, index) => ({id:`household:${index}`,kind:'household',
  latitude:-14,longitude:33,point:[400,240],code:`H${index}`}));
const original = JSON.stringify(households);
const grouped = householdMarkerGroups(households);
assert.equal(grouped.length,1);
assert.equal(grouped[0].members.length,10);
assert.deepEqual(grouped[0].point,[400,240]);
assert.equal(JSON.stringify(households),original,'Grouping never modifies stored coordinates or input records');
assert.strictEqual(grouped[0].members[9],households[9]);

const nearby = {...households[0],id:'nearby',longitude:33.000000001};
const geographic = {...households[0],id:'village',kind:'village'};
const mixed = householdMarkerGroups([...households,nearby,geographic]);
assert.equal(mixed.length,3,'Nearby locations and geographic references must not join household groups');
assert.equal(mixed[0].members.length,10);
assert.equal(mixed[1].members[0].id,'nearby');
assert.equal(mixed[2].members[0].id,'village');
assert.deepEqual(householdMarkerGroups([]),[]);
assert.equal(householdMarkerGroups([households[0]])[0].members.length,1);
console.log('Exact-coordinate household grouping and coordinate preservation checks passed.');
