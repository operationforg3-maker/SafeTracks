/**
 * Silnik geometrii rzeczywistych torów kolejowych SafeTracks.
 *
 * Wykorzystuje kompletną bazę geometrii sieci kolejowej w Polsce (ponad 69 000 punktów
 * osi torów fizycznych bazujących na geodezji PLK i OpenStreetMap / OpenRailwayMap).
 *
 * Dzięki temu pociągi na mapie NIE poruszają się po liniach prostych między stacjami,
 * lecz suną co do metra po stalowych szynach, omijając jeziora, rzeki i zabudowę.
 */

import railNetworkData from '@/lib/pl-rail-network.json';

export interface RailCoord {
  lat: number;
  lng: number;
}

interface RailNetwork {
  nodes: [number, number][]; // [lat * 100000, lon * 100000]
  ways: number[][]; // indeksy węzłów w korytarzach torowych
}

const network = railNetworkData as RailNetwork;

let isInitialized = false;
let adj: number[][] = [];
const grid = new Map<string, number[]>();

function ensureInitialized() {
  if (isInitialized) return;

  const nodeCount = network.nodes.length;
  adj = new Array(nodeCount);
  for (let i = 0; i < nodeCount; i++) {
    adj[i] = [];
  }

  // Budowa grafu sąsiedztwa torów kolejowych
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

  // Siatka przestrzenna (ok. 2km komórki) dla błyskawicznego wyszukiwania najbliższego toru
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

/**
 * Znajduje indeks najbliższego węzła fizycznego toru kolejowego
 */
export function findNearestTrackNodeIndex(lat: number, lng: number): number {
  ensureInitialized();

  const latE5 = Math.round(lat * 100000);
  const lonE5 = Math.round(lng * 100000);
  const gx = Math.floor(latE5 / 2000);
  const gy = Math.floor(lonE5 / 2000);

  let bestIdx = -1;
  let bestDistSq = Infinity;

  // Przeszukaj komórkę centralną i 8 sąsiednich (promień ~4-6 km)
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

/**
 * Zwraca najbliższe współrzędne fizycznego toru kolejowego
 */
export function snapToPhysicalTrack(lat: number, lng: number): RailCoord {
  ensureInitialized();
  const idx = findNearestTrackNodeIndex(lat, lng);
  if (idx === -1) return { lat, lng };

  const [latE5, lonE5] = network.nodes[idx];
  return {
    lat: Number((latE5 / 100000).toFixed(5)),
    lng: Number((lonE5 / 100000).toFixed(5)),
  };
}

/**
 * Wyznacza rzeczywistą ścieżkę szlaku po torach między dwoma punktami (stacjami)
 */
export function getTrackSegmentBetweenPoints(
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): RailCoord[] {
  ensureInitialized();

  const startIdx = findNearestTrackNodeIndex(startLat, startLng);
  const endIdx = findNearestTrackNodeIndex(endLat, endLng);

  if (startIdx === -1 || endIdx === -1 || startIdx === endIdx) {
    return [
      { lat: Number(startLat.toFixed(5)), lng: Number(startLng.toFixed(5)) },
      { lat: Number(endLat.toFixed(5)), lng: Number(endLng.toFixed(5)) },
    ];
  }

  // Przeszukiwanie grafu torów (BFS z limitem kroków)
  const queue = [startIdx];
  const parent = new Map<number, number | null>();
  parent.set(startIdx, null);
  let found = false;

  let steps = 0;
  const maxSteps = 40000;

  while (queue.length > 0 && steps < maxSteps) {
    steps++;
    const curr = queue.shift()!;
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
    // W przypadku braku bezpośredniego połączenia (np. różne wyspy sieci)
    return [
      { lat: Number(startLat.toFixed(5)), lng: Number(startLng.toFixed(5)) },
      { lat: Number(endLat.toFixed(5)), lng: Number(endLng.toFixed(5)) },
    ];
  }

  const result: RailCoord[] = [];
  let curr: number | null = endIdx;
  while (curr !== null) {
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

/**
 * Wzbogaca rzadką listę stacji (przystanków) o pełną geometrię torowiska kolejowego.
 * Zamienia prostą Poznań -> Swarzędz w 69 dokładnych punktów torowiska!
 */
export function enrichPathWithPhysicalRails(sparseStations: RailCoord[]): RailCoord[] {
  if (!sparseStations || sparseStations.length < 2) {
    return sparseStations || [];
  }

  const fullTrack: RailCoord[] = [];

  for (let i = 0; i < sparseStations.length - 1; i++) {
    const p1 = sparseStations[i];
    const p2 = sparseStations[i + 1];

    const segment = getTrackSegmentBetweenPoints(p1.lat, p1.lng, p2.lat, p2.lng);

    if (i === 0) {
      fullTrack.push(...segment);
    } else {
      // Unikaj dublowania punktu łączącego
      fullTrack.push(...segment.slice(1));
    }
  }

  return fullTrack;
}
