const network = require('./pl-rail-network.json');

let isInitialized = false;
let adj = [];
const grid = new Map();

function ensureInitialized() {
  if (isInitialized) return;

  const nodeCount = network.nodes.length;
  adj = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    adj[i] = [];
  }

  for (const way of network.ways) {
    for (let i = 0; i < way.length - 1; i++) {
      const u = way[i];
      const v = way[i + 1];
      if (u < nodeCount && v < nodeCount) {
        adj[u].push(v);
        adj[v].push(u);
      }
    }
  }

  for (let i = 0; i < nodeCount; i++) {
    const [latE5, lonE5] = network.nodes[i];
    const gx = Math.floor(latE5 / 2000);
    const gy = Math.floor(lonE5 / 2000);
    const k = `${gx},${gy}`;
    let cell = grid.get(k);
    if (!cell) {
      cell = [];
      grid.set(k, cell);
    }
    cell.push(i);
  }

  isInitialized = true;
}

function findNearestTrackNodeIndex(lat, lng) {
  ensureInitialized();

  const latE5 = Math.round(lat * 100000);
  const lonE5 = Math.round(lng * 100000);
  const gx = Math.floor(latE5 / 2000);
  const gy = Math.floor(lonE5 / 2000);

  let bestIdx = -1;
  let bestDistSq = Infinity;

  for (let dx = -3; dx <= 3; dx++) {
    for (let dy = -3; dy <= 3; dy++) {
      const k = `${gx + dx},${gy + dy}`;
      const candidates = grid.get(k);
      if (!candidates) continue;

      for (let c = 0; c < candidates.length; c++) {
        const idx = candidates[c];
        const [clat, clon] = network.nodes[idx];
        const d = (clat - latE5) ** 2 + (clon - lonE5) ** 2;
        if (d < bestDistSq) {
          bestDistSq = d;
          bestIdx = idx;
        }
      }
    }
  }

  return bestIdx;
}

function getTrackSegmentBetweenPoints(startLat, startLng, endLat, endLng) {
  ensureInitialized();

  const startIdx = findNearestTrackNodeIndex(startLat, startLng);
  const endIdx = findNearestTrackNodeIndex(endLat, endLng);

  if (startIdx === -1 || endIdx === -1 || startIdx === endIdx) {
    return [
      { lat: Number(startLat.toFixed(5)), lng: Number(startLng.toFixed(5)) },
      { lat: Number(endLat.toFixed(5)), lng: Number(endLng.toFixed(5)) },
    ];
  }

  const queue = [startIdx];
  const parent = new Map();
  parent.set(startIdx, null);
  let found = false;

  let steps = 0;
  const maxSteps = 40000;

  while (queue.length > 0 && steps < maxSteps) {
    steps++;
    const curr = queue.shift();
    if (curr === endIdx) {
      found = true;
      break;
    }

    const neighbors = adj[curr];
    if (neighbors) {
      for (let i = 0; i < neighbors.length; i++) {
        const n = neighbors[i];
        if (!parent.has(n)) {
          parent.set(n, curr);
          queue.push(n);
        }
      }
    }
  }

  if (!found) {
    return [
      { lat: Number(startLat.toFixed(5)), lng: Number(startLng.toFixed(5)) },
      { lat: Number(endLat.toFixed(5)), lng: Number(endLng.toFixed(5)) },
    ];
  }

  const result = [];
  let curr = endIdx;
  while (curr !== null && curr !== undefined) {
    const [clat, clon] = network.nodes[curr];
    result.push({
      lat: Number((clat / 100000).toFixed(5)),
      lng: Number((clon / 100000).toFixed(5)),
    });
    curr = parent.get(curr) ?? null;
  }

  result.reverse();
  return result;
}

function enrichPathWithPhysicalRails(sparseStations) {
  if (!sparseStations || sparseStations.length < 2) {
    return sparseStations || [];
  }

  const fullTrack = [];

  for (let i = 0; i < sparseStations.length - 1; i++) {
    const p1 = sparseStations[i];
    const p2 = sparseStations[i + 1];

    const segment = getTrackSegmentBetweenPoints(p1.lat, p1.lng, p2.lat, p2.lng);

    if (i === 0) {
      fullTrack.push(...segment);
    } else {
      fullTrack.push(...segment.slice(1));
    }
  }

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180, p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180, dl = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mergeConjoinedTrains(trains) {
  if (!trains || trains.length <= 1) return trains;

  const used = new Set();
  const result = [];

  for (let i = 0; i < trains.length; i++) {
    const t1 = trains[i];
    if (used.has(t1.id)) continue;

    const group = [t1];
    used.add(t1.id);

    for (let j = i + 1; j < trains.length; j++) {
      const t2 = trains[j];
      if (used.has(t2.id)) continue;

      const dist = calculateDistanceMeters(
        t1.currentPosition.lat,
        t1.currentPosition.lng,
        t2.currentPosition.lat,
        t2.currentPosition.lng
      );

      const speedDiff = Math.abs(t1.speed - t2.speed);
      const isClose = dist <= 150;
      const isSimilarSpeed = speedDiff <= 5;
      const sameOrigin = t1.origin && t2.origin && t1.origin === t2.origin;
      const sameCategory = t1.type === t2.type;

      if (isClose && isSimilarSpeed && (sameOrigin || sameCategory || dist < 50)) {
        group.push(t2);
        used.add(t2.id);
      }
    }

    if (group.length === 1) {
      result.push(group[0]);
    } else {
      const primary = group[0];

      const prefix = primary.id.split(' ')[0] || primary.type;
      const numbers = group.map((t) => {
        const parts = t.id.split(' ');
        return parts.length > 1 ? parts.slice(1).join(' ') : t.id;
      });
      const combinedId = `${prefix} ${numbers.join(' / ')}`;

      const origins = Array.from(new Set(group.map((t) => t.origin).filter(Boolean)));
      const destinations = Array.from(new Set(group.map((t) => t.destination).filter(Boolean)));

      const originStr = origins.length > 0 ? origins.join(' / ') : primary.route.split('➔')[0]?.trim();
      const destStr = destinations.length > 0 ? destinations.join(' / ') : primary.route.split('➔')[1]?.trim();
      const combinedRoute = `${originStr} ➔ ${destStr}`;

      const combinedRollingStock =
        group.length > 1
          ? `${group.length}x ${primary.operator || 'Tabor'} (Skład łączony)`
          : primary.rollingStock;

      const mergedTrain = {
        ...primary,
        id: combinedId,
        route: combinedRoute,
        rollingStock: combinedRollingStock,
        conjoinedCount: group.length,
        conjoinedUnits: group.map((t) => ({
          id: t.id,
          name: t.name,
          destination: t.destination || t.route.split('➔')[1]?.trim(),
          delayMinutes: t.delayMinutes,
        })),
        delayMinutes: Math.max(...group.map((t) => t.delayMinutes || 0)),
      };

      result.push(mergedTrain);
    }
  }

  return result;
}

module.exports = {
  findNearestTrackNodeIndex,
  getTrackSegmentBetweenPoints,
  enrichPathWithPhysicalRails,
  mergeConjoinedTrains,
};
