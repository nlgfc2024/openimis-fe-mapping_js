import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { graphqlWithVariables } from "@openimis/fe-core";

export default function useGeoQuery(operation, variables, refresh = 0, skip = false) {
  const dispatch = useDispatch();
  const identity = useSelector((state) => state.core?.user?.id);
  const rights = useSelector((state) => state.core?.user?.i_user?.rights || state.core?.user?.rights || state.core?.rights);
  const variablesKey = JSON.stringify(variables);
  const key = JSON.stringify([identity, rights, variables, operation, refresh]);
  const [state, setState] = useState({ loading: true, data: null, error: null, key: null });
  useEffect(() => {
    if (skip) return undefined;
    let active = true;
    setState({ loading: true, data: null, error: null, key });
    dispatch(graphqlWithVariables(operation, JSON.parse(variablesKey))).then((action) => {
      if (!active) return;
      const failed = action.error || action.payload?.errors?.length;
      setState({ loading: false, data: failed ? null : action.payload?.data,
        error: failed ? "Geospatial data could not be loaded. Check your access and try again." : null, key });
    }).catch(() => {
      if (active) setState({ loading: false, data: null, error: "Geospatial request failed. Try again.", key });
    });
    return () => { active = false; };
  }, [operation, key, refresh, identity, skip]);
  if (skip) return { loading: false, data: null, error: null };
  return state.key === key ? state : { loading: true, data: null, error: null };
}
