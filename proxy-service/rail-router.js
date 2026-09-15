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

  return fullTrack;
}

module.exports = {
  findNearestTrackNodeIndex,
  getTrackSegmentBetweenPoints,
  enrichPathWithPhysicalRails,
};
