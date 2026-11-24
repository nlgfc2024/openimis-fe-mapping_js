const assert=require('assert');
const path=require('path');
const {usablePoint,revisionBehind,publicationState}=require('./load')(path.resolve(__dirname,'../src/geo/publication.js'));
assert(usablePoint({latitude:0,longitude:0,pointStatus:'available'}));
assert(usablePoint({latitude:-14,longitude:33,pointStatus:null}));
for(const row of [{latitude:null,longitude:33},{latitude:91,longitude:33},{latitude:-14,longitude:181},
 {latitude:NaN,longitude:33},{latitude:-14,longitude:33,pointStatus:' Unavailable '}])assert(!usablePoint(row));
assert(revisionBehind('9007199254740992','9007199254740993'));
assert(!revisionBehind('3','2'));
assert(!revisionBehind(null,'2'));
assert(!revisionBehind('0002','2'));
const available={status:'available',revision:'2',observedRevision:'2',refreshStatus:'available',importedAt:'2026-11-01T00:00:00Z'};
const now=Date.parse('2026-11-23T00:00:00Z');
assert(!publicationState(available,null,now).warning); // No arbitrary freshness threshold.
assert(publicationState(available,7,now).warning);
assert(!publicationState({...available,importedAt:null},7,now).warning);
assert.equal(publicationState({...available,observedRevision:'3'}).label,'Last accepted boundary retained');
assert.equal(publicationState({...available,refreshStatus:'integrity_failure'}).label,'Last accepted boundary retained');
assert.equal(publicationState({status:'unavailable',refreshStatus:'unavailable'}).label,'No accepted boundary');
assert.equal(publicationState({status:'delivery_unavailable',refreshStatus:'integrity_failure'}).label,'Boundary import needs attention');
console.log('Coordinate eligibility and explicit publication/freshness checks passed.');
