# CoreMIS Mapping frontend

Package `@openimis/fe-mapping`, export `MappingModule`, published component
`mapping.MappingMap`. Displays geographic information stored in CoreMIS through
source-neutral Mapping GraphQL queries.

The map reuses `location.MwDistrictPicker`, preserves project micro-catchment
context, and displays accepted geometry with source provenance, revision and
refresh status. **Refresh map reloads CoreMIS data only.** There are no MSR source
selectors, import mutations, API URLs or credentials in this package.

MSR synchronization remains on the existing **Import Data - Filters → Location**
screen provided by `fe-msr_etl`, using its source configuration, district picker,
core background jobs and progress/cancellation components.

## Configuration

Frontend ModuleConfiguration key `fe-mapping`:

```json
{
  "enabled": true,
  "viewRights": ["954001"],
  "projectRights": ["954004"],
  "menuContributionKey": "openSearchReports.MainMenu"
}
```

Omitted/disabled configuration or empty viewRights registers no route/menu. The
component also guards access before querying. Source scopes and geographic access
are enforced by the backend. No MSR configuration is needed to open a map.

Route: `/front/mapping/dashboard`, under the existing Dashboards menu. The legacy
`/front/location/geospatial` and location map reference delegate to the shared
component when enabled. The project Boundary map tab uses the same component and
its existing micro-catchment link, with configured view/project rights. Disabling
the bridge returns those views to their legacy frontend implementation.

The API supplies opaque publication IDs. The client uses `mappingAreas` with
CoreMIS district UUIDs and `mappingGeometryAccess` for accepted local geometry.
It must not construct external source IDs or request signed source links.

## Development

```bash
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run build
NODE_PATH=../openimis-fe_js/node_modules node test/ui.test.js
```

React 17, React Redux 7, Material UI 4 and fe-core are host peers. No installed
node_modules source is edited. Host component tests cover view guards, existing
picker use, read-only queries and project/legacy bridges. The retained SVG map
supports polygons, labels, pan/zoom/fit; basemap, point layers and beneficiary GPS
remain separate implementation chunks.
