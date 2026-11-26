import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { graphqlWithVariables } from "@openimis/fe-core";
import { collectGeoPages } from "./geoCollections";

export default function useGeoCollection(operation, variables, field, refresh, skip = false) {
  const dispatch = useDispatch();
  const identity = useSelector((state) => state.core?.user?.id);
  const rights = useSelector((state) => state.core?.user?.i_user?.rights || state.core?.user?.rights || []);
  const key = JSON.stringify([operation, variables, field, refresh, identity, rights]);
  const [state, setState] = useState({ key: null, loading: true, data: null, error: null });
  useEffect(() => {
    if (skip) return undefined;
    let active = true;
    setState({ key, loading: true, data: null, error: null });
    collectGeoPages(async (page) => {
      const result = await dispatch(graphqlWithVariables(operation, page));
      if (result.error || result.payload?.errors?.length || !result.payload?.data) throw new Error("Read failed");
      return result.payload.data;
    }, variables, field, () => active).then((data) => {
      if (active) setState({ key, loading: false, data, error: null });
    }).catch(() => {
      if (active) setState({ key, loading: false, data: null, error: "The complete authorised list could not be loaded. Refresh to retry." });
    });
    return () => { active = false; };
  }, [key, skip]);
  if (skip) return { loading: false, data: null, error: null };
  return state.key === key ? state : { loading: true, data: null, error: null };
}
