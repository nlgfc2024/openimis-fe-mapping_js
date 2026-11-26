import React, { useState } from "react";
import { Box, Button, ButtonBase, ButtonGroup, Paper, Typography } from "@material-ui/core";
import { TextInput } from "@openimis/fe-core";
import { makeStyles } from "@material-ui/core/styles";
import { catchmentColor } from "./geoCollections";

const useStyles = makeStyles((theme) => ({
  panel: { padding: 12, background: "#f7fafb", borderColor: "#d9e4e8" },
  filters: { display: "flex", width: "100%", marginBottom: 10, "& button": { flex: 1, fontSize: 12, textTransform: "none", lineHeight: 1.3 } },
  filterActive: { background: "#deefeb", color: "#075b50", fontWeight: 700 },
  list: { maxHeight: 410, overflowY: "auto", overflowX: "hidden", marginTop: 4 },
  row: { width: "100%", display: "flex", justifyContent: "flex-start", gap: 8, padding: "10px 8px", borderRadius: 6, textAlign: "left",
    color: theme.palette.text.primary, "&:hover": { background: "#eaf2f4" }, "&:focus-visible": { outline: "2px solid #00796b", outlineOffset: -2 } },
  selected: { background: "#deeeeb", fontWeight: 700 },
  name: { flex: 1, minWidth: 0, overflowWrap: "anywhere", fontSize: 14, lineHeight: 1.5 },
  swatch: { width: 9, height: 9, borderRadius: 3, flexShrink: 0 },
  badge: { flexShrink: 0, fontSize: 11, fontWeight: 600, padding: "3px 6px", borderRadius: 9,
    background: "#e0eee8", color: "#245c4a", whiteSpace: "nowrap" },
  unavailable: { background: "#e8edef", color: "#45575f" },
}));

export default function CatchmentPanel({ references, records, district, selectedId, onSelect }) {
  const classes = useStyles();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const status = (r) => {
    const record = records[r.id];
    if (record?.error) return "Read failed";
    if (record?.loading !== false) return "Loading";
    return record.result?.status === "available" ? "On map" : "No geometry";
  };
  const visible = references.filter((r) => `${r.name} ${r.code}`.toLowerCase().includes(search.trim().toLowerCase())
    && (filter === "all" || (filter === "mapped" ? status(r) === "On map" : status(r) === "No geometry")));
  return <Paper component="aside" variant="outlined" className={classes.panel} aria-label="Catchment filter">
    <TextInput module="mapping" type="search" label="filter.findCatchment" placeholder={`Search ${references.length} catchments`}
      variant="standard" margin="normal" inputProps={{ "aria-label": "Find catchment" }} value={search} onChange={setSearch} />
    <ButtonGroup className={classes.filters} size="small" aria-label="Catchment availability filter">
      {[["all", "All"], ["mapped", "On map"], ["unavailable", "No geometry"]].map(([value, label]) =>
        <Button key={value} aria-pressed={filter === value} className={filter === value ? classes.filterActive : undefined}
          onClick={() => setFilter(value)}>{label}</Button>)}
    </ButtonGroup>
    {district && <ButtonBase className={classes.row} onClick={() => onSelect("")} title="Show the district overview">
      <span className={classes.swatch} style={{ background: "#1565c0" }} aria-hidden="true" />
      <span className={classes.name}>{district.name} boundary</span><span className={classes.badge}>District</span>
    </ButtonBase>}
    <Box className={classes.list} role="list" aria-label="Micro-catchment names">
      {visible.map((r) => {
        const publication = records[r.id]?.result;
        const relation = publication ? publication.relation : r.geometryRelation;
        const relationLabel = relation === "source_area_association" ? "source-area association" : relation || "unspecified relation";
        const state = status(r);
        const selected = r.id === selectedId;
        return <Box key={r.id} role="listitem">
          <ButtonBase className={`${classes.row} ${selected ? classes.selected : ""}`} aria-pressed={selected}
            onClick={() => onSelect(r.id)} title={`${r.name} · ${r.code} · ${state} · ${relationLabel}`}>
            <span className={classes.swatch} style={{ background: catchmentColor(references.indexOf(r)) }} aria-hidden="true" />
            <span className={classes.name}>{r.name}</span>
            <span className={`${classes.badge} ${state === "On map" ? "" : classes.unavailable}`}>{selected ? "Selected" : state}</span>
          </ButtonBase>
        </Box>;
      })}
      {!visible.length && <Typography variant="body2" style={{ padding: 12 }}>No catchments match these filters.</Typography>}
    </Box>
    <Typography variant="caption">{visible.length} of {references.length} catchments shown</Typography>
  </Paper>;
}
