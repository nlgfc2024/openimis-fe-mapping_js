const UNUSABLE_POINTS = ["unavailable", "invalid", "removed", "withdrawn", "withheld", "missing"];

export function usablePoint(reference) {
  return Number.isFinite(reference.latitude) && Number.isFinite(reference.longitude)
    && Math.abs(reference.latitude) <= 90 && Math.abs(reference.longitude) <= 180
    && !UNUSABLE_POINTS.includes(String(reference.pointStatus || "").trim().toLowerCase());
}

export function revisionBehind(accepted, observed) {
  if (!/^\d+$/.test(String(accepted)) || !/^\d+$/.test(String(observed))) return false;
  const a = String(accepted).replace(/^0+(?=\d)/, ""), b = String(observed).replace(/^0+(?=\d)/, "");
  return a.length < b.length || (a.length === b.length && a < b);
}

export function publicationState(result, staleAfterDays = null, now = Date.now()) {
  if (!result) return { label: "Publication status unknown", warning: false };
  const available = result.status === "available";
  const failed = result.refreshStatus && !["available", "unavailable", "not_downloaded"].includes(result.refreshStatus);
  if (available && (failed || revisionBehind(result.revision, result.observedRevision))) {
    return { label: "Last accepted boundary retained", warning: true,
      detail: "The latest imported publication has not replaced the stored boundary. Check the import results." };
  }
  if (!available && failed) return { label: "Boundary import needs attention", warning: true,
    detail: "No accepted boundary is available for display. Geographic coordinates may still be available." };
  if (result.status === "invalid_local_geometry") return { label: "Stored boundary cannot be displayed", warning: true };
  const imported = Date.parse(result.importedAt);
  if (available && typeof staleAfterDays === "number" && Number.isFinite(staleAfterDays) && staleAfterDays > 0
      && Number.isFinite(imported) && now - imported > staleAfterDays * 86400000) {
    return { label: "Import age exceeds configured threshold", warning: true,
      detail: `The last import is older than ${staleAfterDays} days. Refreshing this map does not synchronize its source.` };
  }
  return available ? { label: "Accepted boundary available", warning: false }
    : { label: "No accepted boundary", warning: false };
}
