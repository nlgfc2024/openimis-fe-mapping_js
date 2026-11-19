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
  "viewRights": ["ALLOCATED_MAPPING_VIEW_RIGHT"],
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

The map currently calls `mappingReferences` and `mappingGeometryAccess`. It
supports district/micro-catchment selection, bounded polygon display, source-area
labels, zoom/pan/fit, publication state and stale-request cleanup. Project context
can pass `microCatchmentUuid` through the CoreMIS repository bridge. The existing
pilot SVG renderer is retained; basemap, independent point layers, programme
totals, beneficiary markers and wider localization remain later chunks.

The former CoreMIS location route and project tab are not removed in this first
chunk. No sources under installed node_modules are edited.

See the backend repository's docs/IMPLEMENTATION.md for the extraction sequence.
