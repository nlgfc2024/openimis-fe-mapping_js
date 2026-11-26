export async function collectGeoPages(request, variables, field, active = () => true, limit = 50) {
  let offset = 0, data = null;
  const items = [], seen = new Set();
  while (active()) {
    const page = await request({ ...variables, offset, limit });
    if (!active()) return null;
    const collection = page?.[field];
    if (!collection || !Array.isArray(collection.items) || !Number.isInteger(collection.totalCount)
        || collection.totalCount < 0 || (collection.items.length === 0 && offset < collection.totalCount)) {
      throw new Error("Incomplete geographic collection");
    }
    data = page;
    collection.items.forEach((item) => { if (!seen.has(item.id)) { seen.add(item.id); items.push(item); } });
    offset += collection.items.length;
    if (offset >= collection.totalCount) {
      if (items.length !== collection.totalCount) throw new Error("Collection changed while paging");
      return { ...data, [field]: { ...collection, items } };
    }
  }
  return null;
}

export async function eachConcurrent(items, worker, active = () => true, concurrency = 4) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (active() && next < items.length) {
      const item = items[next++];
      await worker(item);
    }
  }));
}

export function catchmentColor(index) {
  return `hsl(${Math.round(index * 137.508) % 360}, 65%, 38%)`;
}
