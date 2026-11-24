// Run against the host's React 17/jsdom, without installing another React copy:
// NODE_PATH=../openimis-fe_js/node_modules node test/ui.test.js
const assert = require('assert');
const path = require('path');
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost', pretendToBeVisual: true });
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
const React = require('react');
const ReactDOM = require('react-dom');
const { act, Simulate } = require('react-dom/test-utils');
const load = require('./load');
const root = document.createElement('div');
document.body.append(root);
let config = { enabled: true, viewRights: ['954001'], syncRights: ['954002'], projectRights: ['954004'], sources: [{ id: 'msr-malawi' }] };
let rights = [954001];
let state = { job: null, isTerminal: false };
const operations = [];
const refs = [];
let geographicFixture = false;
const district={id:'geo:10',externalId:'13',sourceInstance:'local-survey',districtUuid:'district-uuid',kind:'district',name:'Dedza',code:'213',matched:true,revision:'1'};
const micro={...district,id:'geo:20',externalId:'265',kind:'micro_catchment',name:'MTANTHO',code:'213009',microCatchmentUuid:'micro-uuid'};
let pointRows=[{id:'geo:30',externalId:'village-1',name:'Village reference',code:'V1',kind:'village',sourceInstance:'local-survey',pointStatus:'available',latitude:-14,longitude:33}];
const manager = { getConf: (module, key, fallback) => module === 'fe-mapping' ? config[key] ?? fallback : fallback };
const dispatch = (action) => {
  operations.push(action);
  if (action.mutation) return Promise.resolve({ status: 2, clientMutationId: 'request-1' });
  if (geographicFixture) {
    let data;
    if (action.query.includes('query GeoOptions')) data={mappingAreas:{totalCount:1,items:[action.variables.micro ? micro : district]}};
    if (action.query.includes('query GeoScope')) data={district:{items:[district]},catchments:{totalCount:1,items:[micro]}};
    if (action.query.includes('query GeoGeometry')) data={mappingGeometryAccess:{status:'unavailable',revision:'1',observedRevision:'1',refreshStatus:'unavailable',geojson:null,importedAt:'2026-11-23T10:00:00Z'}};
    if (action.query.includes('query GeographicPoints')) data={mappingPoints:{totalCount:pointRows.length,scopedCount:67,items:pointRows}};
    if (data) return Promise.resolve({payload:{data}});
  }
  return Promise.resolve({ payload: { data: { mappingAreas: { items: [], totalCount: 0 } } } });
};
const core = {
  useModulesManager: () => manager,
  useTranslations: () => ({formatDateTimeFromISO:(value)=>`Host date: ${value}`}),
  useAsyncJob: () => state,
  useGraphqlQuery: () => ({ data: { asyncJobs: { edges: [] } }, isLoading: false }),
  graphqlWithVariables: (query, variables) => ({ query, variables }),
  graphqlMutation: (query, variables) => { variables.input.clientMutationId = 'request-1'; return { mutation: query, variables }; },
  PublishedComponent: ({ pubRef, onChange, ...props }) => {
    refs.push({ pubRef, ...props });
    return pubRef === 'location.MwDistrictPicker'
      ? React.createElement('button', { onClick: () => onChange({ uuid: 'district-uuid', name: 'Dedza' }) }, 'Pick Dedza')
      : React.createElement('div', { 'data-pubref': pubRef });
  },
};
const mocks = {
  '@openimis/fe-core': core,
  'react-redux': { useDispatch: () => dispatch, useSelector: (selector) => selector({ core: { user: { id: 'actor', i_user: { rights } } } }) },
};
const MappingMap = load(path.resolve(__dirname, '../src/geo/MappingMap.js'), mocks).default;
const render = async (props = {}) => act(async () => { ReactDOM.render(React.createElement(MappingMap, props), root); await Promise.resolve(); });
(async () => {
  config.enabled = false;
  await render();
  assert.equal(operations.length, 0);
  assert(root.textContent.includes('not enabled'));
  config.enabled = true;
  await render();
  assert(refs.some((item) => item.pubRef === 'location.MwDistrictPicker'));
  assert(!root.textContent.includes('Synchronize selected district'));
  rights = [954001, 954002];
  await render();
  await act(async () => { Simulate.click([...root.querySelectorAll('button')].find((button) => button.textContent === 'Pick Dedza')); await Promise.resolve(); });
  assert(operations.some((operation) => operation.variables?.districtUuid === 'district-uuid'));
  assert(!root.textContent.includes('Synchronize selected district'));
  assert(operations.every((operation) => !operation.mutation));
  assert(operations.some((operation) => operation.query?.includes('mappingAreas')));
  geographicFixture = true;
  await render({microCatchmentUuid:'micro-uuid'});
  assert(root.querySelector('circle'), 'Point-only records render without a boundary');
  assert.equal(root.querySelectorAll('[aria-label="Geographic boundary and point map"] path').length,0);
  assert(operations.some((operation) => operation.query?.includes('mappingPoints') && operation.variables.id==='geo:20'));
  assert(root.textContent.includes('1 of 67 geographic records'));
  assert(root.textContent.includes('Host date:'), 'Use the host date formatter');
  await act(async () => { Simulate.keyDown(root.querySelector('svg g[role="button"]'),{key:'Enter'}); });
  assert(root.textContent.includes('Latitude: -14'));
  assert(root.textContent.includes('Longitude: 33'));
  const toggle=[...root.querySelectorAll('label')].find((label)=>label.textContent.includes('Geographic points')).querySelector('input');
  await act(async () => { Simulate.change(toggle,{target:{checked:false}}); });
  assert.equal(root.querySelectorAll('circle').length,0);
  assert(!root.querySelector('[aria-label="Geographic point details"]'));
  pointRows=[];
  await act(async () => { Simulate.click([...root.querySelectorAll('button')].find((button)=>button.textContent==='Refresh map')); });
  assert(root.textContent.includes('No usable geographic coordinates are stored'));
  assert.equal(root.querySelectorAll('circle').length,0);

  act(() => { ReactDOM.unmountComponentAtNode(root); });
  const project = load(path.resolve(__dirname, '../../openimis-fe-project_social_protection_js/src/components/ProjectBoundaryTab.js'), mocks);
  const props = { value: 'geospatial-boundary', project: { id: 'project', microCatchment: { uuid: 'micro-uuid' } }, rights: [954001] };
  act(() => { ReactDOM.render(React.createElement(project.ProjectBoundaryTabPanel, props), root); });
  assert.equal(root.textContent, '');
  act(() => { ReactDOM.render(React.createElement(project.ProjectBoundaryTabPanel, { ...props, rights: [954001, 954004] }), root); });
  assert(refs.some((item) => item.pubRef === 'mapping.MappingMap' && item.microCatchmentUuid === 'micro-uuid'));
  config.enabled = false;
  act(() => { ReactDOM.render(React.createElement(project.ProjectBoundaryTabPanel, { ...props, rights: [121901] }), root); });
  assert(refs.some((item) => item.pubRef === 'location.GeospatialDashboard'));
  const bridge = load(path.resolve(__dirname, '../../openimis-fe-location_js/src/geo/GeospatialBridge.js'), {
    ...mocks, './GeospatialDashboard': () => React.createElement('div', null, 'Legacy map'),
  }).default;
  act(() => { ReactDOM.render(React.createElement(bridge), root); });
  assert.equal(root.textContent, 'Legacy map');
  config.enabled = true;
  act(() => { ReactDOM.render(React.createElement(bridge), root); });
  assert(root.querySelector('[data-pubref="mapping.MappingMap"]'));
  act(() => { ReactDOM.unmountComponentAtNode(root); });
  console.log('Host UI checks passed: district picker, scoped sync variables, read-only provider-neutral queries, project rights and legacy bridge.');
  dom.window.close();
  process.exit(0);
})().catch((error) => { console.error(error); dom.window.close(); process.exit(1); });
