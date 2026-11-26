import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { graphqlWithVariables } from "@openimis/fe-core";
import { eachConcurrent } from "./geoCollections";

const GEOMETRY = `query GeoGeometry($id:ID!){mappingGeometryAccess(referenceId:$id){status revision relation source geojson refreshStatus acceptedAt importedAt observedRevision}}`;

export default function useBoundaryLayers(references, refresh) {
  const dispatch = useDispatch();
  const identity = useSelector((state) => state.core?.user?.id);
  const rights = useSelector((state) => state.core?.user?.i_user?.rights || state.core?.user?.rights || []);
  const key = JSON.stringify([references.map((r) => [r.id,r.boundaryStatus,r.revision,r.syncedAt]), refresh, identity, rights]);
  const [state, setState] = useState({ key: null, records: {} });
  useEffect(() => {
    let active = true;
    const records = {};
    references.forEach((r) => { records[r.id] = r.boundaryStatus === "unavailable"
      ? { loading: false, result: { status: "unavailable", refreshStatus: r.refreshStatus,
        relation: r.geometryRelation, source: r.geometrySource, revision: r.geometryRevision,
        observedRevision: r.revision, importedAt: r.syncedAt } }
      : { loading: true }; });
    setState({ key, records });
    eachConcurrent(references.filter((r) => r.boundaryStatus !== "unavailable"), async (r) => {
      let record;
      try {
        const response = await dispatch(graphqlWithVariables(GEOMETRY, { id: r.id }));
        if (response.error || response.payload?.errors?.length || !response.payload?.data?.mappingGeometryAccess) throw new Error("Read failed");
        record = { loading: false, result: response.payload.data.mappingGeometryAccess };
      } catch (_) { record = { loading: false, error: "Stored boundary could not be loaded. Refresh to retry." }; }
      if (active) setState((current) => ({ key, records: { ...current.records, [r.id]: record } }));
    }, () => active);
    return () => { active = false; };
  }, [key]);
  return state.key === key ? state.records : {};
}
