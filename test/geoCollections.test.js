const assert = require('assert');
const path = require('path');
const { collectGeoPages, eachConcurrent, catchmentColor } = require('./load')(path.resolve(__dirname,'../src/geo/geoCollections.js'));

(async () => {
  const rows=Array.from({length:123},(_,id)=>({id:String(id)}));
  const offsets=[];
  const data=await collectGeoPages(async({offset,limit})=>{
    offsets.push(offset);return {areas:{totalCount:rows.length,items:rows.slice(offset,offset+limit)}};
  },{},'areas');
  assert.deepEqual(offsets,[0,50,100]);
  assert.equal(data.areas.items.length,123);
  await assert.rejects(()=>collectGeoPages(async()=>({areas:{totalCount:2,items:[]}}),{},'areas'));
  await assert.rejects(()=>collectGeoPages(async()=>({areas:{totalCount:2,items:[{id:'duplicate'},{id:'duplicate'}]}}),{},'areas'));
  let active=true,calls=0;
  const cancelled=await collectGeoPages(async()=>{calls++;active=false;return {areas:{totalCount:123,items:rows.slice(0,50)}};},{},'areas',()=>active);
  assert.equal(cancelled,null);assert.equal(calls,1);
  let inFlight=0,maximum=0,completed=0;
  await eachConcurrent(rows,async()=>{
    maximum=Math.max(maximum,++inFlight);
    await new Promise((resolve)=>setTimeout(resolve,1));
    inFlight--;completed++;
  });
  assert(maximum<=4);assert.equal(completed,123);
  assert.equal(new Set(rows.slice(0,48).map((_,i)=>catchmentColor(i))).size,48);
  console.log('Complete paging, cancellation, bounded geometry concurrency and catchment colour checks passed.');
})().catch((error)=>{console.error(error);process.exitCode=1;});
