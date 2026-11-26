// Integration against the host's React/MUI, with scoped GraphQL fixtures.
const assert=require('assert');
const path=require('path');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost',pretendToBeVisual:true});
global.window=dom.window;global.document=dom.window.document;global.navigator=dom.window.navigator;
const React=require('react'),ReactDOM=require('react-dom');
const {act,Simulate}=require('react-dom/test-utils');
const load=require('./load');
const root=document.createElement('div');document.body.append(root);
let rights=[954001,954004,954005],failPage=false;
const operations=[];
const district={id:'geo:district',kind:'district',sourceInstance:'local-survey',districtUuid:'district',name:'Dedza',code:'213',boundaryStatus:'available',revision:'1'};
const alpha={...district,id:'geo:alpha',kind:'micro_catchment',name:'Alpha',code:'A',microCatchmentUuid:'alpha',matched:true,geometryRelation:'source_area_association'};
const beta={...alpha,id:'geo:beta',name:'Beta',code:'B',microCatchmentUuid:'beta',geometryRelation:'boundary'};
const unavailable={...alpha,id:'geo:missing',name:'Missing geometry',code:'M',boundaryStatus:'unavailable'};
const references=[alpha,beta,unavailable,...Array.from({length:48},(_,index)=>({...unavailable,id:`geo:missing-${index}`,name:`Unavailable ${index}`,code:`U${index}`}))];
const polygon=(x,y,size)=>({type:'Polygon',coordinates:[[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]]});
const geometries={'geo:district':polygon(0,0,10),'geo:alpha':polygon(1,1,0.1),'geo:beta':polygon(9.9,1,0.2)};
const original=JSON.stringify(geometries);
const project={id:'11111111-1111-4111-8111-111111111111',name:'Alpha project',code:'P1',status:'PREPARATION'};
const dispatch=async(action)=>{
  operations.push(action);let data;
  if(action.query.includes('query GeoOptions'))data={mappingAreas:{totalCount:1,items:[district]}};
  if(action.query.includes('query GeoScope')){
    if(failPage&&action.variables.offset===50)return {error:true};
    data={district:{items:[district]},catchments:{totalCount:references.length,items:references.slice(action.variables.offset,action.variables.offset+action.variables.limit)}};
  }
  if(action.query.includes('query GeoGeometry'))data={mappingGeometryAccess:{status:'available',revision:'1',observedRevision:'1',
    relation:action.variables.id==='geo:alpha'?'source_area_association':'boundary',geojson:geometries[action.variables.id]}};
  if(action.query.includes('query GeographicPoints'))data={mappingPoints:{totalCount:0,scopedCount:67,items:[]}};
  if(action.query.includes('query CatchmentProjects'))data={mappingCatchmentProjects:{totalCount:action.variables.id==='geo:alpha'?1:0,items:action.variables.id==='geo:alpha'?[project]:[]}};
  if(action.query.includes('query ProjectHouseholdPoints'))data={mappingProjectHouseholds:{totalCount:1,scopedCount:1,
    items:[{id:'household:1',code:'H1',name:'Household H1',kind:'household',sourceInstance:'ubr',latitude:1.02,longitude:1.02}]}};
  return {payload:{data}};
};
const config={enabled:true,viewRights:['954001'],projectRights:['954004'],gpsRights:['954005'],projectOverlayEnabled:true};
const mocks={
  '@openimis/fe-core':{
    useModulesManager:()=>({getConf:(module,key,fallback)=>module==='fe-mapping'?config[key]??fallback:fallback}),
    useTranslations:()=>({formatDateTimeFromISO:(value)=>value}),
    graphqlWithVariables:(query,variables)=>({query,variables}),
    PublishedComponent:({onChange})=>React.createElement('button',{onClick:()=>onChange({uuid:'district'})},'Pick Dedza'),
  },
  'react-redux':{useDispatch:()=>dispatch,useSelector:(selector)=>selector({core:{user:{id:'actor',i_user:{rights}}}})},
};
const MappingMap=load(path.resolve(__dirname,'../src/geo/MappingMap.js'),mocks).default;
const render=()=>act(async()=>{ReactDOM.render(React.createElement(MappingMap),root);await Promise.resolve();});
const click=(element)=>act(async()=>{assert(element);Simulate.click(element);await Promise.resolve();});
const button=(text)=>[...root.querySelectorAll('button')].find((node)=>node.textContent===text);
const boundary=(name)=>root.querySelector(`svg g[aria-label="Select ${name}"]`);
const catchmentSelect=()=>root.querySelector('select[aria-label="Micro-catchment"]');

(async()=>{
  await render();await click(button('Pick Dedza'));
  assert(root.textContent.includes('51 authorised catchments listed'));
  assert.deepEqual(operations.filter((op)=>op.query.includes('query GeoScope')).map((op)=>op.variables.offset),[0,50]);
  assert.equal(root.querySelectorAll('[aria-label="Geographic boundary and point map"] path').length,3,'District and both published catchments render together');
  assert.equal(catchmentSelect().options.length,52,'Unavailable catchments remain listed beyond the first page');
  assert([...catchmentSelect().options].some((option)=>option.textContent.includes('Missing geometry')&&option.textContent.includes('Unavailable')));
  assert(!operations.some((op)=>op.query.includes('query GeoGeometry')&&op.variables.id==='geo:missing'));
  const overview=boundary('Alpha (source-area association)').querySelector('path').getAttribute('d');
  await click(boundary('Alpha (source-area association)'));
  assert.equal(catchmentSelect().value,'geo:alpha');
  assert(root.textContent.includes('Selected catchment: Alpha'));
  assert.equal(boundary('Alpha (source-area association)').querySelector('path').getAttribute('stroke-width'),'4');
  assert.notEqual(boundary('Alpha (source-area association)').querySelector('path').getAttribute('d'),overview,'Selecting fits the catchment, not the district');
  assert(root.querySelector('select[aria-label="Project in selected catchment"]'));
  assert(root.textContent.includes('1 of 1 enrolled households'));
  assert.equal(root.querySelectorAll('circle').length,1);
  await act(async()=>{Simulate.change(root.querySelector('select[aria-label="Project in selected catchment"]'),{target:{value:''}});await Promise.resolve();});
  assert.equal(root.querySelectorAll('circle').length,0,'Clearing the project clears its household layer');
  await act(async()=>{Simulate.change(root.querySelector('select[aria-label="Project in selected catchment"]'),{target:{value:project.id}});await Promise.resolve();});
  assert.equal(root.querySelectorAll('circle').length,1);
  await click(button('Fit all layers'));
  assert.equal(boundary('Alpha (source-area association)').querySelector('path').getAttribute('d'),overview);
  await click(boundary('Alpha (source-area association)'));
  assert.notEqual(boundary('Alpha (source-area association)').querySelector('path').getAttribute('d'),overview,'Clicking the already selected catchment refits it');
  await click(button('Back to district'));
  assert.equal(catchmentSelect().value,'');
  assert.equal(boundary('Alpha (source-area association)').querySelector('path').getAttribute('d'),overview);
  assert.equal(root.querySelectorAll('circle').length,0,'Back clears the project household layer');
  await act(async()=>{Simulate.change(catchmentSelect(),{target:{value:'geo:missing'}});await Promise.resolve();});
  assert(root.textContent.includes('No accepted geometry can be displayed'));
  assert(root.textContent.includes('No accepted boundary'));
  await act(async()=>{Simulate.keyDown(boundary('Beta (boundary)'),{key:'Enter'});await Promise.resolve();});
  assert.equal(catchmentSelect().value,'geo:beta');
  assert.equal(JSON.stringify(geometries),original,'Cross-district geometry remains unmodified');
  const before=operations.length;
  rights=[954001];await render();await click(button('Pick Dedza'));
  await click(boundary('Alpha (source-area association)'));
  assert(!operations.slice(before).some((op)=>op.query.includes('mappingCatchmentProjects')||op.query.includes('mappingProjectHouseholds')),'Map-only users do not request projects or household GPS');
  failPage=true;await click(button('Refresh map'));
  assert(root.textContent.includes('complete authorised list could not be loaded'));
  assert.equal(root.querySelectorAll('[aria-label="Geographic boundary and point map"] path').length,0,'An incomplete page is not presented as a complete overview');
  act(()=>{ReactDOM.unmountComponentAtNode(root);});
  dom.window.close();
  console.log('District overview, all-page loading, click/keyboard drill-down, project/GPS exploration, unavailable geometry and Back checks passed.');
  process.exit(0);
})().catch((error)=>{ReactDOM.unmountComponentAtNode(root);dom.window.close();console.error(error);process.exit(1);});
