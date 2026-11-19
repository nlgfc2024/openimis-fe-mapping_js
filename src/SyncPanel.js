import React, { useEffect, useRef, useState } from "react";
import { Box, Button, MenuItem, TextField, Typography } from "@material-ui/core";
import { PublishedComponent, useAsyncJob, useGraphqlQuery, graphqlMutation } from "@openimis/fe-core";
import { useDispatch } from "react-redux";

const START = `mutation MappingStart($input:MappingStartSyncMutationInput!){
  mappingStartSync(input:$input){clientMutationId internalId}}`;

export default function SyncPanel({ district, sources = [], onComplete }) {
  const dispatch = useDispatch();
  const [source, setSource] = useState(sources.length === 1 ? sources[0].id : "");
  const [request, setRequest] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setLoading] = useState(false);
  const submitted = useRef(false);
  const completed = useRef(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const active = useGraphqlQuery(`{asyncJobs(module:"mapping",jobType:"mapping_locations_import",
    status_In:[RECEIVED,QUEUED,RUNNING],first:1,orderBy:["-created_at"]){edges{node{clientMutationId}}}}`);
  const activeRequest = active.data?.asyncJobs?.edges?.[0]?.node?.clientMutationId;
  useEffect(() => {
    if (activeRequest && !request) {
      setRequest(activeRequest);
      submitted.current = true;
    }
  }, [activeRequest, request]);
  const { job, isTerminal, error: jobError } = useAsyncJob({ clientMutationId: request || undefined });
  // The shared hook retains stale data while changing requests. Only the
  // correlated job may release the guard or trigger a publication refresh.
  const terminal = !!request && job?.clientMutationId === request && isTerminal;
  useEffect(() => {
    if (terminal && completed.current !== request) {
      completed.current = request;
      submitted.current = false;
      onComplete();
    }
  }, [terminal, request, onComplete]);
  const start = async () => {
    if (submitted.current || !district?.uuid || !sources.some((item) => item.id === source)) return;
    submitted.current = true;
    setLoading(true);
    setError(null);
    const input = { sourceInstance: source, districtUuid: district.uuid };
    try {
      // Core generates the correlation ID and waits for its mutation log. Its
      // public job component handles progress, terminal state and cancellation.
      const action = graphqlMutation(START, { input });
      setRequest(input.clientMutationId);
      const result = await dispatch(action);
      if (!mounted.current) return;
      if (result?.status === 1) {
        setError("Synchronization was rejected. Check your permissions, reviewed district link and mutation history.");
        submitted.current = false;
        setRequest(null);
        return;
      }
      if (!result || result.status !== 2) {
        setError("Scheduling could not be confirmed. Check the mutation history before trying again.");
        return; // Keep blocked: an unconfirmed request may still create a job.
      }
    } catch (err) {
      if (!mounted.current) return;
      setError("Synchronization could not be scheduled. Check your permissions and the mutation history.");
      // Delivery may have succeeded even if the browser lost the response.
      // Preserve correlation and block another submission until reconciled.
    } finally {
      if (mounted.current) setLoading(false);
    }
  };
  const busy = active.isLoading || !!active.error || isLoading || submitted.current || (!!request && !terminal);
  return <Box my={2}>
    <Typography variant="h6">Synchronize MSR publications</Typography>
    <Typography variant="body2">Updates this district's publications and verified village memberships.</Typography>
    <TextField select fullWidth label="MSR source" value={source} disabled={busy} onChange={(event) => setSource(event.target.value)}>
      <MenuItem value="">Select an MSR source</MenuItem>
      {sources.map((item) => <MenuItem key={item.id} value={item.id}>{item.label || item.id}</MenuItem>)}
    </TextField>
    <Button color="primary" variant="outlined" disabled={busy || !district?.uuid || !sources.some((item) => item.id === source)} onClick={start}>Synchronize selected district</Button>
    {!district && <Typography variant="body2">Select a CoreMIS district first.</Typography>}
    {!sources.length && <Typography variant="body2">No synchronization source has been configured.</Typography>}
    {active.error && <Typography color="error" role="alert">Active jobs could not be checked. Reload before starting a synchronization.</Typography>}
    {(error || jobError) && <Typography color="error" role="alert">{error || "Job progress could not be loaded. Check your access."}</Typography>}
    {request && <PublishedComponent key={request} pubRef="core.AsyncJobProgress" clientMutationId={request} progressUnit="locations" />}
    {job && <Typography variant="caption">Request: {request}</Typography>}
  </Box>;
}
