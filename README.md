# openIMIS / CoreMIS Mapping frontend

Package `@openimis/fe-mapping`, export `MappingModule`, published component
`mapping.MappingMap`. Extracted from the working CoreMIS location map.

```bash
npm ci --ignore-scripts --legacy-peer-deps
npm test
npm run build
```

The committed lockfile pins this package's build tools. React 17, React Redux 7,
Material UI 4 and the host's `@openimis/fe-core` are peer dependencies. Do not
install another React runtime into a deployed host. Cross-host support must be
verified against each assembly's exact dependency baseline.

Local assembly manifest entry:

```json
{"name":"MappingModule","npm":"@openimis/fe-mapping@file:../openimis-fe-mapping_js"}
```

Safe frontend configuration uses module key `fe-mapping`:

```json
{
  "enabled": true,
  "viewRights": ["954001"],
  "syncRights": ["954002"],
  "projectRights": ["954004"],
  "sources": [{"id": "msr-malawi", "label": "MSR"}],
  "menuContributionKey": "openSearchReports.MainMenu"
}
```

An omitted/disabled configuration or empty viewRights registers no route or menu.
The component reference remains available, but every backend request is still
authorized. Configure the backend `mapping` module independently with registered
capabilities, repository and district scope. The route is `/mapping/dashboard`.
CoreMIS uses the existing Dashboards extension; an upstream host can configure a
different installed submenu. Custom menu allowlists must also include the stable
entry ID `mapping.dashboard`. No OpenSearch package is a hard dependency.

The dashboard reuses `location.MwDistrictPicker` and sends its CoreMIS UUID to
the backend. Mapping sync uses core mutation tracking, `useAsyncJob` and the
published `core.AsyncJobProgress` component for progress and cancellation. It
checks for an existing active mapping job on mount and blocks duplicate local
submissions. An unconfirmed scheduling response stays blocked for reconciliation.
Source options contain only safe identifiers and labels; credentials stay in the
backend configuration.

The map currently calls `mappingReferences` and `mappingGeometryAccess`. It
supports district/micro-catchment selection, bounded polygon display, source-area
labels, zoom/pan/fit, publication state and stale-request cleanup. Project context
can pass `microCatchmentUuid` through the CoreMIS repository bridge. The existing
pilot SVG renderer is retained; basemap, independent point layers, programme
totals, beneficiary markers and wider localization remain later chunks.

The old `/location/geospatial` URL and published location map reference delegate
to `mapping.MappingMap` when mapping is enabled. They use the legacy component
when disabled. The project Boundary map tab uses the new published component and
requires both viewRights and projectRights when enabled. It passes the project's
existing micro-catchment UUID; projects and payroll links are preserved.

Set `fe-location.useMappingDashboard` to hide the duplicate legacy menu entry.
Update any host menu allowlist from `location.geospatial` to `mapping.dashboard`
in the existing Dashboards group. The backend command can configure these pieces
together for the current CoreMIS host:

```bash
python manage.py configure_coremis_mapping --source-instance msr-malawi --district-id 13
python manage.py configure_coremis_mapping --source-instance msr-malawi --district-id 13 --apply
# Roll back to the legacy frontend:
python manage.py configure_coremis_mapping --disable --apply
```

The command previews by default, reuses backend credentials, grants no roles and
keeps other menu entries. Restart backend/workers and reload the frontend session
after applying configuration. Assign ordinary users' rights through existing
Roles Management. The legacy URL still has its existing location route permission;
the new route uses mapping view rights.

Host component checks use the assembly's React/jsdom:

```bash
NODE_PATH=../openimis-fe_js/node_modules node test/ui.test.js
```

These checks cover disabled/view-only access, UUID submission, duplicate guards,
progress reuse, project permissions and legacy fallback. Full browser acceptance,
GPS overlays, point layers and streaming delivery remain later work. No installed
node_modules sources are edited.

See the backend repository's docs/IMPLEMENTATION.md for the extraction sequence.
