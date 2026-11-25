// Exact stored coordinates only: never round, displace or merge nearby locations.
export function householdMarkerGroups(markers) {
  const groups = [], locations = new Map();
  markers.forEach((marker) => {
    if (marker.kind !== "household") {
      groups.push({ id: marker.id, point: marker.point, members: [marker] });
      return;
    }
    const key = JSON.stringify([marker.latitude, marker.longitude]);
    let group = locations.get(key);
    if (!group) {
      group = { id: `household-location:${key}`, point: marker.point, members: [] };
      locations.set(key, group);
      groups.push(group);
    }
    group.members.push(marker);
  });
  return groups;
}
