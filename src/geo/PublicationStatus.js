import React from "react";
import { Box, Chip, Tooltip, Typography } from "@material-ui/core";
import { useModulesManager, useTranslations } from "@openimis/fe-core";
import { publicationState } from "./publication";

export default function PublicationStatus({ reference, result, loading, error }) {
  const manager = useModulesManager();
  const { formatDateTimeFromISO } = useTranslations("mapping", manager);
  const state = publicationState(result, manager.getConf("fe-mapping", "staleAfterDays", null));
  const date = (value) => value ? <Tooltip title={value}><span>{formatDateTimeFromISO(value)}</span></Tooltip> : "unknown";
  return <Box my={1}>
    <Typography><strong>{reference.name}</strong> · {reference.code} · {reference.matched ? "Matched" : "Unmatched"}</Typography>
    <Chip size="small" color={state.warning ? "secondary" : "default"} label={loading ? "Reading CoreMIS publication…" : error ? "CoreMIS read failed" : state.label} />
    {error && <Typography color="error" role="alert">{error}</Typography>}
    {!loading && !error && state.detail && <Typography variant="body2" role={state.warning ? "status" : undefined}>{state.detail}</Typography>}
    {result && <Typography variant="body2">Last imported publication revision: {result.observedRevision ?? reference.revision ?? "unknown"}
      {result.status === "available" && ` · displayed boundary revision: ${result.revision}`}
      {` · relation: ${result.relation === "source_area_association" ? "source-area association" : result.relation || "unspecified"} · geometry source: ${result.source || "unspecified"}`}</Typography>}
    <Typography variant="body2">Last imported: {date(result?.importedAt || reference.syncedAt)}
      {result?.status === "available" && <> · Geometry accepted: {date(result.acceptedAt)}</>}</Typography>
    <Typography variant="caption">Source: {reference.sourceInstance} · Source ID: {reference.externalId}
      {result?.refreshStatus && ` · last geometry import status: ${result.refreshStatus}`}</Typography>
  </Box>;
}
