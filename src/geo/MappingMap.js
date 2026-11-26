import React, { useState } from "react";
import { Box, Button, MenuItem, Paper, TextField, Typography, TablePagination, Checkbox, FormControlLabel } from "@material-ui/core";
import useGeoQuery from "./useGeoQuery";
import useGeoCollection from "./useGeoCollection";
import useBoundaryLayers from "./useBoundaryLayers";
import { catchmentColor } from "./geoCollections";
import CatchmentPanel from "./CatchmentPanel";
import { makeStyles } from "@material-ui/core/styles";
import BoundaryMap from "./BoundaryMap";
import PublicationStatus from "./PublicationStatus";
import { usablePoint } from "./publication";
import { Autocomplete, PublishedComponent, useModulesManager } from "@openimis/fe-core";
import { useSelector } from "react-redux";
import { hasCapability, mappingConfiguration } from "../configuration";

const FIELDS = `id sourceInstance externalId districtUuid name code kind matched microCatchmentUuid
  boundaryStatus revision geometryRelation geometrySource syncedAt refreshStatus geometryRevision geometryUpdatedAt latitude longitude pointStatus`;
const OPTIONS = `query GeoOptions($kind:String,$micro:String,$offset:Int!,$districtUuid:String){
  mappingAreas(kind:$kind,microCatchmentUuid:$micro,districtUuid:$districtUuid,offset:$offset,limit:100){totalCount items{${FIELDS}}}}`;
const SCOPE = `query GeoScope($source:String!,$district:String!,$offset:Int!,$limit:Int!,$micro:String){
  district:mappingAreas(sourceInstance:$source,kind:"district",districtUuid:$district,limit:1){items{${FIELDS}}}
  catchments:mappingAreas(sourceInstance:$source,kind:"micro_catchment",microCatchmentUuid:$micro,districtUuid:$district,offset:$offset,limit:$limit){totalCount items{${FIELDS}}}}`;
const POINTS = `query GeographicPoints($id:ID!,$offset:Int!,$limit:Int!){
  mappingPoints(areaReferenceId:$id,offset:$offset,limit:$limit){totalCount scopedCount items{${FIELDS}}}}`;
const HOUSEHOLDS = `query ProjectHouseholdPoints($id:UUID!,$offset:Int!,$limit:Int!){
  mappingProjectHouseholds(projectId:$id,offset:$offset,limit:$limit){totalCount scopedCount
    items{id code name kind sourceInstance latitude longitude accuracy elevation syncedAt pointStatus}}}`;
const EMPTY = [];
const OVERVIEW = { id: "", name: "All catchments — district overview" };
const useOverviewStyles = makeStyles((theme) => ({
  mapLayout: { display: "flex", alignItems: "flex-start", gap: 16, marginTop: 12,
    [theme.breakpoints.down("sm")]: { flexDirection: "column" } },
  catchmentPanel: { width: 260, flexShrink: 0, [theme.breakpoints.down("sm")]: { width: "100%" } },
  mapArea: { flex: 1, minWidth: 0, width: "100%" },
}));

function BoundaryPublication({ reference, record = {} }) {
  return <Box>
    <PublicationStatus reference={reference} result={record.result} loading={record.loading !== false} error={record.error} />
    {usablePoint(reference) && record.result?.status !== "available" &&
      <Typography variant="body2">Geographic coordinates are available independently of a boundary.</Typography>}
  </Box>;
}

const PROJECTS = `query CatchmentProjects($id:ID!,$offset:Int!,$limit:Int!){
  mappingCatchmentProjects(referenceId:$id,offset:$offset,limit:$limit){totalCount items{id code name status}}}`;

function ProjectHouseholds({ projectId, refresh, householdAccess, children }) {
  const [householdPage, setHouseholdPage] = useState(0);
  const [householdPageSize, setHouseholdPageSize] = useState(50);
  const householdState = useGeoQuery(HOUSEHOLDS, { id: projectId || "", offset: householdPage * householdPageSize, limit: householdPageSize },
    refresh, !projectId || !householdAccess);
  const householdData = householdState.data?.mappingProjectHouseholds;
  const householdPoints = householdData?.items || EMPTY;
  const lastHouseholdPage = Math.max(0, Math.ceil((householdData?.totalCount || 0) / householdPageSize) - 1);
  React.useEffect(() => {
    if (householdData && householdPage > lastHouseholdPage) setHouseholdPage(0);
  }, [householdData, householdPage, lastHouseholdPage]);
  const householdPanel = <>
    {projectId && householdAccess && <Box my={1}>
      <Typography variant="subtitle1">Enrolled household locations</Typography>
      <Typography variant="body2">Authorised households linked to active project enrolments. Households sharing exact GPS on this page use a counted marker. Household GPS does not establish polygon coverage or an individual measurement.</Typography>
      {householdState.loading && <Typography role="status">Reading enrolled household coordinates…</Typography>}
      {householdState.error && <Typography color="error" role="alert">{householdState.error}</Typography>}
      {householdData && <>
        <Typography variant="body2">{householdData.totalCount} of {householdData.scopedCount} enrolled households have usable stored GPS.
          {householdData.totalCount === 0 && " No household markers are available for this project within your access scope."}</Typography>
        <TablePagination component="div" count={householdData.totalCount} page={Math.min(householdPage, lastHouseholdPage)}
          rowsPerPage={householdPageSize} rowsPerPageOptions={[25, 50, 100]} labelRowsPerPage="Households per page"
          onPageChange={(_, page) => setHouseholdPage(page)}
          onRowsPerPageChange={(event) => { setHouseholdPageSize(Number(event.target.value)); setHouseholdPage(0); }} />
      </>}
    </Box>}
    {projectId && !householdAccess && <Typography variant="body2">Household GPS layer is unavailable. It requires project GPS access and an enabled household overlay.</Typography>}
  </>;
  return children(householdPoints, householdPanel);
}

function DistrictView({ district, microUuid, refresh, projectId, projectAccess, householdAccess }) {
  const classes = useOverviewStyles();
  const [selected, setSelected] = useState("");
  const [focusRevision, setFocusRevision] = useState(0);
  const [pointPage, setPointPage] = useState(0);
  const [pointPageSize, setPointPageSize] = useState(50);
  const [showProjects, setShowProjects] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const state = useGeoCollection(SCOPE, { source: district.sourceInstance, district: district.districtUuid,
    micro: microUuid || null }, "catchments", refresh);
  const refs = state.data?.catchments?.items?.filter((r) => r.kind === "micro_catchment" && (!microUuid || r.microCatchmentUuid === microUuid)) || EMPTY;
  const micro = microUuid ? refs.find((r) => r.microCatchmentUuid === microUuid) : refs.find((r) => r.id === selected);
  const districtRef = state.data?.district?.items?.[0];
  const references = [districtRef, ...refs].filter(Boolean);
  const records = useBoundaryLayers(references, refresh);
  const layers = references.flatMap((r) => {
    const result = records[r.id]?.result;
    if (result?.status !== "available") return [];
    return [{ id: r.id, color: r.kind === "district" ? "#1565c0" : catchmentColor(refs.indexOf(r)),
      name: `${r.name} (${result.relation === "source_area_association" ? "source-area association" : result.relation || "unspecified relation"})`,
      selectable: r.kind === "micro_catchment", geojson: result.geojson }];
  });
  const chooseCatchment = (id) => { setSelected(id); setFocusRevision((value) => value + 1); setSelectedProject(null); setPointPage(0); };
  const pointArea = micro || districtRef;
  const pointState = useGeoQuery(POINTS, { id: pointArea?.id || "", offset: pointPage * pointPageSize, limit: pointPageSize },
    refresh, state.loading || !!state.error || !pointArea);
  const pointData = pointState.data?.mappingPoints;
  const lastPointPage = Math.max(0, Math.ceil((pointData?.totalCount || 0) / pointPageSize) - 1);
  React.useEffect(() => { if (pointData && pointPage > lastPointPage) setPointPage(0); }, [pointData, pointPage, lastPointPage]);
  const projectState = useGeoCollection(PROJECTS, { id: micro?.id || "" }, "mappingCatchmentProjects", refresh,
    !micro || !micro.matched || !projectAccess || !showProjects || !!projectId);
  const projects = projectState.data?.mappingCatchmentProjects?.items || EMPTY;
  const project = projects.find((r) => r.id === selectedProject) || (selectedProject === null && projects.length === 1 ? projects[0] : null);
  const effectiveProjectId = projectId || project?.id || null;
  const focus = records[micro?.id]?.result?.status === "available" ? micro?.id : null;
  const statusLabel = (r) => {
    const record = records[r.id];
    if (record?.error) return "Read failed";
    if (record?.loading !== false) return "Loading publication";
    return record.result?.status === "available" ? "Available" : "Unavailable";
  };
  const relationLabel = (r) => {
    const result = records[r.id]?.result;
    const relation = result ? result.relation : r.geometryRelation;
    return relation === "source_area_association" ? "source-area association" : relation || "unspecified relation";
  };
  return <Box>
    {state.loading && <Typography role="status">Loading all authorised catchments…</Typography>}
    {state.error && <Typography color="error" role="alert">{state.error}</Typography>}
    {!microUuid && <Box my={2}>
      <Autocomplete label="Micro-catchment" value={micro || OVERVIEW} options={[OVERVIEW, ...refs]}
        getOptionLabel={(r) => r.id ? `${r.code} ${r.name} · ${statusLabel(r)}${r.matched ? "" : " (unmatched)"}` : r.name}
        getOptionSelected={(option, value) => option.id === value?.id}
        onInputChange={() => {}} onChange={(value) => chooseCatchment(value?.id || "")} />
    </Box>}
    {micro && !microUuid && <Button onClick={() => chooseCatchment("")}>Back to district</Button>}
    {micro && <Typography variant="subtitle1">Selected catchment: {micro.name} — {micro.code}</Typography>}
    {micro && !focus && records[micro.id]?.loading === false && <Typography variant="body2">
      No accepted geometry can be displayed for this catchment. Its publication remains listed; the available district layers provide context.
    </Typography>}
    {!state.loading && refs.length > 0 && <Typography variant="body2">
      {refs.length} authorised catchments listed · {refs.filter((r) => records[r.id]?.result?.status === "available").length} with available geometry.
      {!micro && " Select a catchment on the map or from the list to zoom to it."}
      {micro && focus && " Fitted to the selected geometry; Fit all layers restores the full visible extent."}
    </Typography>}
    {!projectId && projectAccess && <FormControlLabel control={<Checkbox checked={showProjects}
      onChange={() => { setShowProjects((value) => !value); setSelectedProject(null); }} />} label="Explore catchment projects" />}
    {!projectId && showProjects && projectAccess && micro && <Box my={1}>
      {projectState.loading && <Typography role="status">Loading authorised catchment projects…</Typography>}
      {projectState.error && <Typography role="alert" color="error">{projectState.error}</Typography>}
      {!micro.matched && <Typography>This catchment has no CoreMIS match for project exploration.</Typography>}
      {projects.length > 0 && <TextField select fullWidth label="Project in selected catchment" value={project?.id || ""}
        variant="outlined" margin="normal" InputLabelProps={{ shrink: true }}
        SelectProps={{ native: true }} inputProps={{ "aria-label": "Project in selected catchment" }}
        onChange={(event) => setSelectedProject(event.target.value)}>
        <option value="">Select a project for enrolled household locations</option>
        {projects.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.status}</option>)}
      </TextField>}
      {micro.matched && !projectState.loading && !projectState.error && !projects.length &&
        <Typography>No authorised linked projects are available for this catchment.</Typography>}
    </Box>}
    <Box className={classes.mapLayout}>
      {!microUuid && <Box className={classes.catchmentPanel}>
        <CatchmentPanel references={refs} records={records} district={districtRef} selectedId={micro?.id} onSelect={chooseCatchment} />
      </Box>}
      <Box className={classes.mapArea}>
        <ProjectHouseholds key={`${effectiveProjectId || ""}:${refresh}`} projectId={effectiveProjectId} refresh={refresh} householdAccess={householdAccess}>
          {(householdPoints, householdPanel) => <>
            <BoundaryMap key={`${district.id}:${micro?.id || "overview"}:${refresh}:${focusRevision}`} layers={layers}
              compactLegend focusLayerId={focus} selectedLayerId={micro?.id} onSelectLayer={microUuid ? undefined : chooseCatchment}
              points={pointState.data?.mappingPoints?.items || EMPTY} householdPoints={householdPoints} />
            {householdPanel}
          </>}
        </ProjectHouseholds>
      </Box>
    </Box>
    {pointArea && <Box my={1}>
      <Typography variant="body2">{micro ? "Points for the selected micro-catchment and its verified members." : "Geographic points in the selected district and source."} Coordinates are geographic reference data.</Typography>
      {pointState.loading && <Typography role="status">Reading stored geographic coordinates…</Typography>}
      {pointState.error && <Typography color="error" role="alert">{pointState.error}</Typography>}
      {pointData && <>
        <Typography variant="body2">{pointData.totalCount} of {pointData.scopedCount} geographic records have usable coordinates.
          {pointData.totalCount === 0 && " No usable geographic coordinates are stored for this selection."}</Typography>
        <TablePagination component="div" count={pointData.totalCount} page={Math.min(pointPage, lastPointPage)} rowsPerPage={pointPageSize}
          rowsPerPageOptions={[25, 50, 100]} labelRowsPerPage="Points per page" onPageChange={(_, page) => setPointPage(page)}
          onRowsPerPageChange={(event) => { setPointPageSize(Number(event.target.value)); setPointPage(0); }} />
      </>}
    </Box>}
    {districtRef && <BoundaryPublication reference={districtRef} record={records[districtRef.id]} />}
    {micro && <BoundaryPublication reference={micro} record={records[micro.id]} />}
    {refs.length > 0 && <details><summary>Catchment publications ({refs.length})</summary>
      {refs.map((r) => <Box key={r.id} my={1}>
        <Button disabled={!!microUuid} onClick={() => chooseCatchment(r.id)}>{r.name} — {r.code}</Button>
        <Typography variant="caption">{statusLabel(r)} · {relationLabel(r)}</Typography>
      </Box>)}
    </details>}
    {!state.loading && !state.error && !refs.length && <Typography>No authorised micro-catchment references are available for this selection.</Typography>}
  </Box>;
}

function MappingContent({ microCatchmentUuid, projectId, projectAccess, householdAccess }) {
  const [refresh, setRefresh] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState("");
  const [localDistrict, setLocalDistrict] = useState(null);
  const refreshPublications = React.useCallback(() => setRefresh((value) => value + 1), []);
  const state = useGeoQuery(OPTIONS, { kind: microCatchmentUuid ? null : "district", micro: microCatchmentUuid || null,
    districtUuid: microCatchmentUuid ? null : localDistrict?.uuid || null, offset }, refresh, !microCatchmentUuid && !localDistrict);
  const options = state.data?.mappingAreas?.items || [];
  const district = options.find((r) => r.id === selected) || (options.length === 1 ? options[0] : null);
  return <Paper style={{ padding: 20 }}>
    <Box display="flex" justifyContent="space-between"><Typography variant="h5">Mapping dashboard</Typography>
      <Button onClick={refreshPublications}>Refresh map</Button></Box>
    {!microCatchmentUuid && <PublishedComponent pubRef="location.MwDistrictPicker" value={localDistrict} label="District"
      onChange={(value) => { setLocalDistrict(value); setSelected(""); setOffset(0); }} />}
    {state.loading && <Typography>Loading permitted locations…</Typography>}
    {state.error && <Typography color="error" role="alert">{state.error}</Typography>}
    {options.length > 1 && <TextField select fullWidth label="Source match" value={district?.id || ""} onChange={(e) => setSelected(e.target.value)}>
      <MenuItem value="">Select a source match</MenuItem>
      {options.map((r) => <MenuItem key={r.id} value={r.id}>{r.name} — {r.code} ({r.sourceInstance})</MenuItem>)}
    </TextField>}
    {!microCatchmentUuid && <Box>
      <Button disabled={!offset} onClick={() => { setSelected(""); setOffset(Math.max(0, offset - 100)); }}>Previous districts</Button>
      <Button disabled={offset + 100 >= (state.data?.mappingAreas?.totalCount || 0)} onClick={() => { setSelected(""); setOffset(offset + 100); }}>Next districts</Button>
    </Box>}
    {!microCatchmentUuid && !localDistrict && <Typography>Select a district to display its geographic information.</Typography>}
    {(microCatchmentUuid || localDistrict) && !state.loading && !state.error && !options.length && <Typography>No geographic information is available for this selection within your access scope.</Typography>}
    {district ? <DistrictView key={`${district.id}:${projectId || ""}:${refresh}`} district={district}
      microUuid={microCatchmentUuid} refresh={refresh} projectId={projectId} projectAccess={projectAccess} householdAccess={householdAccess} />
      : !state.loading && <ProjectHouseholds key={`${projectId || ""}:${refresh}`} projectId={projectId} refresh={refresh} householdAccess={householdAccess}>
        {(householdPoints, householdPanel) => <>{projectId && householdAccess && <BoundaryMap householdPoints={householdPoints} />}{householdPanel}</>}
      </ProjectHouseholds>}

  </Paper>;
}

export default function MappingMap(props) {
  const manager = useModulesManager();
  const config = mappingConfiguration(manager);
  const rights = useSelector((state) => state.core?.user?.i_user?.rights || state.core?.user?.rights || []);
  const identity = useSelector((state) => state.core?.user?.id);
  if (!config.enabled || !hasCapability(rights, config.viewRights)) {
    return <Typography role="alert">Mapping is not enabled or you do not have access.</Typography>;
  }
  if (props.projectId && !hasCapability(rights, config.projectRights)) {
    return <Typography role="alert">You do not have project mapping access.</Typography>;
  }
  const householdAccess = config.projectOverlayEnabled && hasCapability(rights, config.projectRights) && hasCapability(rights, config.gpsRights);
  return <MappingContent key={JSON.stringify([identity, rights, config.gpsRights, config.projectOverlayEnabled])}
    {...props} projectAccess={hasCapability(rights, config.projectRights)} householdAccess={householdAccess} />;
}
