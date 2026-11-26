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

## Geographic point layers

The shared map displays stored latitude/longitude pairs alongside boundaries or
on their own. Point visibility uses Material UI layer controls; clicking or
keyboard-selecting a point shows its type, source identity, coordinates, quality
status and last import time. Fit map includes the visible boundaries and the
current point page. CoreMIS's district picker is retained, pagination uses the
existing Material UI table pagination component, and dates use CoreMIS's shared
formatter. No additional map library/runtime is installed.

Points come from `mappingPoints`. Selecting a micro-catchment restricts them to
that area and its stored verified memberships; there is no polygon-based coverage
inference. Only the current point page is drawn, with counts shown explicitly.
No coordinate pairs or polygon centres are fabricated. Boundary GeoJSON remains
polygon-based; this chunk reads points from the separate geographic coordinate
fields. Household/beneficiary GPS is a separate permissioned integration.

Publication information distinguishes the last imported revision and the displayed
boundary revision, with import/geometry-acceptance times and a retained-boundary
warning after replacement failure. CoreMIS date formatting is reused. An optional
numeric `fe-mapping.staleAfterDays` warns when an import exceeds the configured
age. The default is unset: the module does not invent an age policy or claim the
upstream source is current. Refresh map remains a local read.
## Enrolled household points

The shared map accepts an explicit `projectId` UUID. When project/GPS rights and
the configured project overlay are enabled, it requests authorised household GPS
from `mappingProjectHouseholds`. It displays one marker per household, with separate
layer controls, pagination and household-labelled details. Household GPS can be
shown without boundary references; project enrolments remain owned by CoreMIS.
Configure `fe-mapping.gpsRights` and `fe-mapping.projectOverlayEnabled` through the
backend Mapping configuration command. This module does not grant permissions.
## Households at a shared location

Households with identical stored latitude/longitude on the current page share a
counted marker. Click it or press Enter/Space, then use “Household at this location”
to inspect each household's details. Counts describe the current page, not unseen
households on other pages. Nearby coordinates are not merged, and no coordinates
are rounded or displaced. Geographic reference markers remain separate.
## District overview and catchment selection

Selecting a district loads all authorised catchment metadata pages and displays
every available local boundary. Click a catchment (or use the dropdown) to
highlight and fit its actual geometry. Back to district restores the overview.
Unavailable catchments remain listed, source-area association labels are retained,
and shapes crossing the district outline are not clipped to it.

Project-authorised users can explore explicitly linked catchment projects. Select
a project to reuse the existing separately authorised household GPS layer; clear
it or disable project exploration to remove those household points. Project-page
maps retain their pinned project/catchment context. No new basemap is introduced.

Additional host interaction checks:

```bash
NODE_PATH=../openimis-fe_js/node_modules node test/districtOverview.test.js
```
## Compact catchment filters

The district map has a responsive, scrollable catchment panel with name/code
search, All / On map / No geometry filters, colour swatches and selected/status
badges. List filtering does not hide or change source polygons. "On map" indicates
available geometry, independently of the CoreMIS record-match status. Source-area
relations and codes remain available in row tooltips and publication details.
The full layer visibility legend is collapsed below the map. Native catchment and
project selectors use explicit raised labels to avoid overlapping overview text.
