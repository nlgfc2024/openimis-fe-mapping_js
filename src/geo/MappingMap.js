import React, { useState } from "react";
import { Box, Button, MenuItem, Paper, TextField, Typography, TablePagination } from "@material-ui/core";
import useGeoQuery from "./useGeoQuery";
import BoundaryMap from "./BoundaryMap";
import PublicationStatus from "./PublicationStatus";
import { usablePoint } from "./publication";
import { PublishedComponent, useModulesManager } from "@openimis/fe-core";
import { useSelector } from "react-redux";
import { hasCapability, mappingConfiguration } from "../configuration";

const FIELDS = `id sourceInstance externalId districtUuid name code kind matched microCatchmentUuid
  boundaryStatus revision geometryRelation geometrySource syncedAt refreshStatus geometryRevision geometryUpdatedAt latitude longitude pointStatus`;
const OPTIONS = `query GeoOptions($kind:String,$micro:String,$offset:Int!,$districtUuid:String){
  mappingAreas(kind:$kind,microCatchmentUuid:$micro,districtUuid:$districtUuid,offset:$offset,limit:100){totalCount items{${FIELDS}}}}`;
const SCOPE = `query GeoScope($source:String!,$district:String!,$offset:Int!,$micro:String){
  district:mappingAreas(sourceInstance:$source,kind:"district",districtUuid:$district,limit:1){items{${FIELDS}}}
  catchments:mappingAreas(sourceInstance:$source,kind:"micro_catchment",microCatchmentUuid:$micro,districtUuid:$district,offset:$offset,limit:100){totalCount items{${FIELDS}}}}`;
const GEOMETRY = `query GeoGeometry($id:ID!){mappingGeometryAccess(referenceId:$id){status revision relation source geojson refreshStatus acceptedAt importedAt observedRevision}}`;
const POINTS = `query GeographicPoints($id:ID!,$offset:Int!,$limit:Int!){
  mappingPoints(areaReferenceId:$id,offset:$offset,limit:$limit){totalCount scopedCount items{${FIELDS}}}}`;
const HOUSEHOLDS = `query ProjectHouseholdPoints($id:UUID!,$offset:Int!,$limit:Int!){
  mappingProjectHouseholds(projectId:$id,offset:$offset,limit:$limit){totalCount scopedCount
    items{id code name kind sourceInstance latitude longitude accuracy elevation syncedAt pointStatus}}}`;
const EMPTY = [];

function GeometryLayer({ reference, color, refresh, onLayer }) {
  const state = useGeoQuery(GEOMETRY, { id: reference.id }, refresh);
  const result = state.data?.mappingGeometryAccess;
  React.useEffect(() => {
    onLayer(reference.id, result?.status === "available" ? { id: reference.id, color,
      name: `${reference.name} (${result.relation === "source_area_association" ? "source-area association" : result.relation || "unspecified relation"})`,
      geojson: result.geojson } : null);
    return () => onLayer(reference.id, null);
  }, [result, reference.id, color]);
  return <Box>
    <PublicationStatus reference={reference} result={result} loading={state.loading} error={state.error} />
    {usablePoint(reference) && result?.status !== "available" &&
      <Typography variant="body2">Geographic coordinates are available independently of a boundary.</Typography>}
  </Box>;
}

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

function DistrictView({ district, microUuid, refresh, householdPoints, householdPanel }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState("");
  const [layers, setLayers] = useState({});
  const [pointPage, setPointPage] = useState(0);
  const [pointPageSize, setPointPageSize] = useState(50);
  const state = useGeoQuery(SCOPE, { source: district.sourceInstance, district: district.districtUuid, offset, micro: microUuid || null }, refresh);
  const refs = state.data?.catchments?.items?.filter((r) => r.kind === "micro_catchment" && (!microUuid || r.microCatchmentUuid === microUuid)) || [];
  const micro = refs.find((r) => r.id === selected) || (microUuid ? refs[0] : null);
  const districtRef = state.data?.district?.items?.[0];
  const pointArea = micro || districtRef;
  const pointState = useGeoQuery(POINTS, { id: pointArea?.id || "", offset: pointPage * pointPageSize, limit: pointPageSize },
    refresh, state.loading || !!state.error || !pointArea);
  const pointData = pointState.data?.mappingPoints;
  const points = pointData?.items || EMPTY;
  const lastPointPage = Math.max(0, Math.ceil((pointData?.totalCount || 0) / pointPageSize) - 1);
  React.useEffect(() => {
    if (pointData && pointPage > lastPointPage) setPointPage(0);
  }, [pointData, pointPage, lastPointPage]);


  const update = React.useCallback((id, layer) => setLayers((current) => {
    const next = { ...current }; if (layer) next[id] = layer; else delete next[id]; return next;
  }), []);
  const key = `${district.id}:${micro?.id || ""}:${refresh}:${offset}`;
  const visibleLayers = [districtRef, micro].filter(Boolean).map((r) => layers[r.id]).filter(Boolean);
  return <Box>
    {state.error && <Typography color="error" role="alert">{state.error}</Typography>}
    {!microUuid && <TextField select fullWidth label="Micro-catchment" value={micro?.id || ""}
      onChange={(e) => { setSelected(e.target.value); setLayers({}); setPointPage(0); }}>
      <MenuItem value="">District only</MenuItem>
      {refs.map((r) => <MenuItem key={r.id} value={r.id}>{r.name} — {r.code}{r.matched ? "" : " (unmatched)"}</MenuItem>)}
    </TextField>}
    {!microUuid && <Box>
      <Button disabled={!offset} onClick={() => { setSelected(""); setPointPage(0); setOffset(Math.max(0, offset - 100)); }}>Previous catchments</Button>
      <Button disabled={offset + 100 >= (state.data?.catchments?.totalCount || 0)} onClick={() => { setSelected(""); setPointPage(0); setOffset(offset + 100); }}>Next catchments</Button>
    </Box>}
    <BoundaryMap key={key} layers={state.loading || state.error ? EMPTY : visibleLayers} points={points} householdPoints={householdPoints} />
    {householdPanel}
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
    {districtRef && <GeometryLayer key={`d${key}`} reference={districtRef} color="#1565c0" refresh={refresh} onLayer={update} />}
    {micro && <GeometryLayer key={`m${key}`} reference={micro} color="#c65102" refresh={refresh} onLayer={update} />}
    {!state.loading && !refs.length && <Typography>No matching micro-catchment references on this page.</Typography>}
  </Box>;
}

function MappingContent({ microCatchmentUuid, projectId, householdAccess }) {
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
    <ProjectHouseholds key={`${projectId || ""}:${refresh}`} projectId={projectId} refresh={refresh} householdAccess={householdAccess}>
      {(householdPoints, householdPanel) => district
        ? <DistrictView key={`${district.id}:${refresh}`} district={district} microUuid={microCatchmentUuid}
            refresh={refresh} householdPoints={householdPoints} householdPanel={householdPanel} />
        : <>{projectId && householdAccess && <BoundaryMap householdPoints={householdPoints} />}{householdPanel}</>}
    </ProjectHouseholds>
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
    {...props} householdAccess={householdAccess} />;
}
