import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Checkbox, FormControlLabel, Paper, Typography } from "@material-ui/core";
import { fitPaths, polygonPaths, projectPoint } from "./geometry";
import { useModulesManager, useTranslations } from "@openimis/fe-core";

const EMPTY = [];
const POINT_COLOR = "#6a1b9a";

export default function BoundaryMap({ layers = EMPTY, points = EMPTY, householdPoints = EMPTY }) {
  const manager = useModulesManager();
  const { formatDateTimeFromISO } = useTranslations("mapping", manager);
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 });
  const [hidden, setHidden] = useState({});
  const [showPoints, setShowPoints] = useState(true);
  const [showHouseholds, setShowHouseholds] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const prepared = useMemo(() => {
    const valid = [], markers = [], errors = [];
    layers.filter((layer) => !hidden[layer.id]).forEach((layer) => {
      try { valid.push({ ...layer, paths: polygonPaths(layer.geojson) }); }
      catch (_) { errors.push(`${layer.name}: the stored geometry cannot be rendered.`); }
    });
    const visiblePoints = [...(showPoints ? points : EMPTY), ...(showHouseholds ? householdPoints : EMPTY)];
    visiblePoints.forEach((point) => {
      try { markers.push({ ...point, point: projectPoint([point.longitude, point.latitude]) }); }
      catch (_) { errors.push(`${point.name}: the stored coordinates cannot be rendered.`); }
    });
    return { ...fitPaths(valid, markers), errors };
  }, [layers, points, householdPoints, hidden, showPoints, showHouseholds]);
  useEffect(() => { setView({ zoom: 1, x: 0, y: 0 }); }, [layers, points, householdPoints, hidden, showPoints, showHouseholds]);
  const move = (x, y) => setView((v) => ({ ...v, x: v.x + x, y: v.y + y }));
  const selected = prepared.markers.find((point) => point.id === selectedId);
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selectedId, selected]);
  const describe = (point) => `${point.name} · ${point.kind.replace(/_/g, " ")} · ${point.sourceInstance} · ${point.latitude}, ${point.longitude}`;
  return <Box>
    <Box display="flex" flexWrap="wrap">
      <Button onClick={() => setView((v) => ({ ...v, zoom: Math.min(16, v.zoom * 1.5) }))}>Zoom in</Button>
      <Button onClick={() => setView((v) => ({ ...v, zoom: Math.max(1, v.zoom / 1.5) }))}>Zoom out</Button>
      <Button onClick={() => setView({ zoom: 1, x: 0, y: 0 })}>Fit map</Button>
      <Button onClick={() => move(40, 0)} aria-label="Pan west">←</Button>
      <Button onClick={() => move(-40, 0)} aria-label="Pan east">→</Button>
      <Button onClick={() => move(0, 40)} aria-label="Pan north">↑</Button>
      <Button onClick={() => move(0, -40)} aria-label="Pan south">↓</Button>
    </Box>
    {prepared.errors.map((error) => <Typography key={error} color="error" role="alert">{error}</Typography>)}
    <svg viewBox="0 0 800 480" role="group" aria-label="Geographic boundary and point map"
      style={{ width: "100%", maxHeight: 550, background: "#f0f5f8", border: "1px solid #b0bec5" }}>
      <g transform={`translate(${view.x},${view.y}) translate(400,240) scale(${view.zoom}) translate(-400,-240)`}>
        {prepared.layers.map((layer) => layer.paths.map((path, i) =>
          <path key={`${layer.id}-${i}`} d={path} fill={layer.color} fillOpacity="0.2" stroke={layer.color}
            strokeWidth="2" vectorEffect="non-scaling-stroke" fillRule="evenodd"><title>{layer.name}</title></path>))}
        {prepared.markers.map((point) => <g key={point.id} role="button" tabIndex={0} aria-label={describe(point)}
          onClick={() => setSelectedId(point.id)} onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelectedId(point.id); }
          }} style={{ cursor: "pointer" }}>
          <title>{describe(point)}</title>
          <circle cx={point.point[0]} cy={point.point[1]} r={(point.id === selectedId ? 7 : 5) / view.zoom}
            fill={point.id === selectedId ? (point.kind === "household" ? "#008577" : POINT_COLOR) : "white"}
            stroke={point.kind === "household" ? "#008577" : POINT_COLOR} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </g>)}
      </g>
    </svg>
    {!prepared.markers.length && !prepared.layers.some((layer) => layer.paths.length) &&
      <Typography>No visible boundaries or geographic points. See availability information below.</Typography>}
    {layers.map((layer) => <FormControlLabel key={layer.id}
      control={<Checkbox checked={!hidden[layer.id]} onChange={() => setHidden((s) => ({ ...s, [layer.id]: !s[layer.id] }))} />}
      label={<span style={{ color: layer.color }}>{layer.name}</span>} />)}
    <FormControlLabel control={<Checkbox checked={showPoints} onChange={() => setShowPoints((value) => !value)} />}
      label={<span style={{ color: POINT_COLOR }}>Geographic points</span>} />
    {householdPoints.length > 0 && <FormControlLabel control={<Checkbox checked={showHouseholds} onChange={() => setShowHouseholds((value) => !value)} />}
      label={<span style={{ color: "#008577" }}>Enrolled households</span>} />}
    {selected && <Paper variant="outlined" style={{ padding: 12 }} role="status" aria-label="Geographic point details">
      <Typography><strong>{selected.name}</strong> · {selected.code}</Typography>
      <Typography variant="body2">Type: {selected.kind.replace(/_/g, " ")} · Source: {selected.sourceInstance}
        {selected.externalId && ` · Source ID: ${selected.externalId}`}</Typography>
      <Typography variant="body2">Latitude: {selected.latitude} · Longitude: {selected.longitude} · Coordinate status: {selected.pointStatus || "not specified"}</Typography>
      <Typography variant="body2">Last imported: {selected.syncedAt ? formatDateTimeFromISO(selected.syncedAt) : "unknown"}</Typography>
      {selected.kind === "household" && <>
        <Typography variant="body2">Household location shared by enrolled members; this is not an individual GPS measurement.</Typography>
        <Typography variant="body2">Source accuracy: {selected.accuracy ?? "unspecified"} · Source elevation: {selected.elevation ?? "unspecified"}</Typography>
      </>}
      <Button size="small" onClick={() => setSelectedId(null)}>Close point details</Button>
    </Paper>}
    <Typography variant="caption">Geographic overlay · north up · WGS84 coordinates · Mercator display · no basemap</Typography>
    {prepared.markers.some((point) => Math.abs(point.latitude) > 85) &&
      <Typography variant="caption"> Latitudes beyond 85° are projected at the map limit; details retain the original coordinates.</Typography>}
  </Box>;
}
