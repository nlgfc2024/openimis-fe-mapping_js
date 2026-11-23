import React, { useState } from "react";
import { Box, Button, MenuItem, Paper, TextField, Typography } from "@material-ui/core";
import useGeoQuery from "./useGeoQuery";
import BoundaryMap from "./BoundaryMap";
import { PublishedComponent, useModulesManager } from "@openimis/fe-core";
import { useSelector } from "react-redux";
import { hasCapability, mappingConfiguration } from "../configuration";

const FIELDS = `id sourceInstance externalId districtUuid name code kind matched microCatchmentUuid
  boundaryStatus revision geometryRelation geometrySource syncedAt refreshStatus`;
const OPTIONS = `query GeoOptions($kind:String,$micro:String,$offset:Int!,$districtUuid:String){
  mappingAreas(kind:$kind,microCatchmentUuid:$micro,districtUuid:$districtUuid,offset:$offset,limit:100){totalCount items{${FIELDS}}}}`;
const SCOPE = `query GeoScope($source:String!,$district:String!,$offset:Int!,$micro:String){
  district:mappingAreas(sourceInstance:$source,kind:"district",districtUuid:$district,limit:1){items{${FIELDS}}}
  catchments:mappingAreas(sourceInstance:$source,kind:"micro_catchment",microCatchmentUuid:$micro,districtUuid:$district,offset:$offset,limit:100){totalCount items{${FIELDS}}}}`;
const GEOMETRY = `query GeoGeometry($id:ID!){mappingGeometryAccess(referenceId:$id){status revision relation source geojson refreshStatus}}`;
const STATUS_LABELS = {
  available: "Geometry available", unavailable: "No published geometry",
  delivery_unavailable: "No accepted geometry is available. Check the source import status.",
  not_downloaded: "Geometry has not been imported into CoreMIS.",
  geometry_too_large: "Geometry exceeds the supported file size.",
  integrity_failure: "Geometry did not match its published checksum.",
};

function GeometryLayer({ reference, color, refresh, onLayer }) {
  const state = useGeoQuery(GEOMETRY, { id: reference.id }, refresh);
  const result = state.data?.mappingGeometryAccess;
  React.useEffect(() => {
    onLayer(reference.id, result?.status === "available" ? { id: reference.id, color,
      name: `${reference.name} (${result.relation === "source_area_association" ? "source-area association" : result.relation || "unspecified relation"})`,
      geojson: result.geojson } : null);
    return () => onLayer(reference.id, null);
  }, [result, reference.id, color]);
  return <Box my={1}>
    <Typography><strong>{reference.name}</strong> · {reference.code} · {reference.matched ? "Matched" : "Unmatched"}</Typography>
    <Typography variant="body2">{state.loading ? "Loading current publication…" : state.error || STATUS_LABELS[result?.status] || "Unavailable"}
      {result && ` · revision ${result.revision} · ${result.relation || "no geometry relation"} · source ${result.source || "unspecified"}`}</Typography>
    {result?.refreshStatus && !['available', 'unavailable', 'not_downloaded'].includes(result.refreshStatus) &&
      <Typography variant="body2">The latest import could not replace the geometry ({result.refreshStatus}). The last accepted boundary is retained when available.</Typography>}
    <Typography variant="caption">Last synchronized: {reference.syncedAt || "unknown"} · Source ID {reference.externalId}</Typography>
  </Box>;
}

function DistrictView({ district, microUuid, refresh }) {
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState("");
  const [layers, setLayers] = useState({});
  const state = useGeoQuery(SCOPE, { source: district.sourceInstance, district: district.districtUuid, offset, micro: microUuid || null }, refresh);
  const refs = state.data?.catchments?.items?.filter((r) => r.kind === "micro_catchment" && (!microUuid || r.microCatchmentUuid === microUuid)) || [];
  const micro = refs.find((r) => r.id === selected) || (microUuid ? refs[0] : null);
  const districtRef = state.data?.district?.items?.[0];
  const update = React.useCallback((id, layer) => setLayers((current) => {
    const next = { ...current }; if (layer) next[id] = layer; else delete next[id]; return next;
  }), []);
  const key = `${district.id}:${micro?.id || ""}:${refresh}:${offset}`;
  const visibleLayers = [districtRef, micro].filter(Boolean).map((r) => layers[r.id]).filter(Boolean);
  return <Box>
    {state.error && <Typography color="error" role="alert">{state.error}</Typography>}
    {!microUuid && <TextField select fullWidth label="Micro-catchment" value={micro?.id || ""}
      onChange={(e) => { setSelected(e.target.value); setLayers({}); }}>
      <MenuItem value="">District only</MenuItem>
      {refs.map((r) => <MenuItem key={r.id} value={r.id}>{r.name} — {r.code}{r.matched ? "" : " (unmatched)"}</MenuItem>)}
    </TextField>}
    {!microUuid && <Box>
      <Button disabled={!offset} onClick={() => { setSelected(""); setOffset(Math.max(0, offset - 100)); }}>Previous catchments</Button>
      <Button disabled={offset + 100 >= (state.data?.catchments?.totalCount || 0)} onClick={() => { setSelected(""); setOffset(offset + 100); }}>Next catchments</Button>
    </Box>}
    <BoundaryMap key={key} layers={state.loading || state.error ? [] : visibleLayers} />
    {districtRef && <GeometryLayer key={`d${key}`} reference={districtRef} color="#1565c0" refresh={refresh} onLayer={update} />}
    {micro && <GeometryLayer key={`m${key}`} reference={micro} color="#c65102" refresh={refresh} onLayer={update} />}
    {!state.loading && !refs.length && <Typography>No matching micro-catchment references on this page.</Typography>}
  </Box>;
}

function MappingContent({ microCatchmentUuid }) {
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
    {!microCatchmentUuid && !localDistrict && <Typography>Select a district to display its published boundaries.</Typography>}
    {(microCatchmentUuid || localDistrict) && !state.loading && !state.error && !options.length && <Typography>No synchronized locations are available within your access scope. A reviewed CoreMIS district link is required.</Typography>}
    {district && <DistrictView key={`${district.id}:${refresh}`} district={district} microUuid={microCatchmentUuid} refresh={refresh} />}
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
  return <MappingContent key={JSON.stringify([identity, rights])} {...props} />;
}
