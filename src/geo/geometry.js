// Bounded Mercator projection for boundaries and geographic reference points. File properties never become executable markup.
export function polygonPaths(geojson) {
  const features = geojson?.type === "FeatureCollection" ? geojson.features : [geojson];
  if (!Array.isArray(features)) throw new Error("Invalid GeoJSON");
  let count = 0;
  return features.flatMap((feature) => {
    const geometry = feature?.type === "Feature" ? feature.geometry : feature;
    if (!["Polygon", "MultiPolygon"].includes(geometry?.type)) throw new Error("Unsupported geometry");
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.map((polygon) => polygon.map((ring) => {
      if (!Array.isArray(ring) || ring.length < 4) throw new Error("Invalid polygon ring");
      return ring.map((point) => {
        count += 1;
        const [lng, lat] = point;
        if (count > 100000 || !Number.isFinite(lng) || !Number.isFinite(lat)
            || Math.abs(lng) > 180 || Math.abs(lat) > 85) throw new Error("Invalid coordinates");
        return [lng, -Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)) * 180 / Math.PI];
      });
    }));
  });
}

export function projectPoint(point) {
  if (!Array.isArray(point) || point.length !== 2) throw new Error("Invalid coordinate pair");
  const [lng, lat] = point;
  if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng) > 180 || Math.abs(lat) > 90) {
    throw new Error("Invalid coordinates");
  }
  const projectedLatitude = Math.max(-85, Math.min(85, lat));
  return [lng, -Math.log(Math.tan(Math.PI / 4 + projectedLatitude * Math.PI / 360)) * 180 / Math.PI];
}

export function fitPaths(layers, markers = []) {
  const points = [...layers.flatMap((layer) => layer.paths.flat(2)), ...markers.map((marker) => marker.point)];
  if (!points.length) return { viewBox: "0 0 800 480", layers: [], markers: [] };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  points.forEach(([x, y]) => { minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); });
  const width = maxX - minX, height = maxY - minY;
  const scale = width || height ? Math.min(width ? 740 / width : Infinity, height ? 420 / height : Infinity) : 1;
  const xOffset = (800 - width * scale) / 2, yOffset = (480 - height * scale) / 2;
  const fit = ([x, y]) => [Number(((x - minX) * scale + xOffset).toFixed(2)), Number(((y - minY) * scale + yOffset).toFixed(2))];
  return { viewBox: "0 0 800 480", layers: layers.map((layer) => ({ ...layer,
    paths: layer.paths.map((polygon) => polygon.map((ring) => ring.map((point, i) => {
      const [x,y] = fit(point); return `${i ? "L" : "M"}${x},${y}`;
    }).join(" ") + "Z").join(" ")),
  })), markers: markers.map((marker) => ({ ...marker, point: fit(marker.point) })) };
}
