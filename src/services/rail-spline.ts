/**
 * Płynna interpolacja szlaków kolejowych metodą Catmull-Rom Spline.
 * Zamiast łamanych linii prostych między stacjami, generuje naturalnie zaokrągloną
 * krzywą toru kolejowego zgodną ze stycznymi wejścia i wyjścia ze stacji.
 */

import { calculateDistanceMeters, calculateBearing } from './pkp-api';

export interface SplinePoint {
  lat: number;
  lng: number;
}

// Znane punkty kluczowej infrastruktury szlakowej (np. Most Średnicowy w Warszawie)
const RAIL_WAYPOINTS: { condition: (a: SplinePoint, b: SplinePoint) => boolean; waypoints: SplinePoint[] }[] = [
  {
    // Szlak Warszawa Centralna / Śródmieście <-> Warszawa Wschodnia (przejazd przez Most Średnicowy)
    condition: (a, b) => {
      const isCentralna = Math.abs(a.lat - 52.2288) < 0.015 && Math.abs(a.lng - 21.0032) < 0.02;
      const isWschodnia = Math.abs(b.lat - 52.2512) < 0.015 && Math.abs(b.lng - 21.0520) < 0.02;
      const revCentralna = Math.abs(b.lat - 52.2288) < 0.015 && Math.abs(b.lng - 21.0032) < 0.02;
      const revWschodnia = Math.abs(a.lat - 52.2512) < 0.015 && Math.abs(a.lng - 21.0520) < 0.02;
      return (isCentralna && isWschodnia) || (revCentralna && revWschodnia);
    },
    waypoints: [
      { lat: 52.2315, lng: 21.0185 }, // Powiśle tunel
      { lat: 52.2355, lng: 21.0360 }, // Most Średnicowy przez Wisłę
      { lat: 52.2425, lng: 21.0475 }, // Stadion
    ],
  },
  {
    // Szlak Warszawa Zachodnia <-> Warszawa Centralna
    condition: (a, b) => {
      const isZach = Math.abs(a.lat - 52.2198) < 0.015 && Math.abs(a.lng - 20.9634) < 0.02;
      const isCent = Math.abs(b.lat - 52.2288) < 0.015 && Math.abs(b.lng - 21.0032) < 0.02;
      const revZach = Math.abs(b.lat - 52.2198) < 0.015 && Math.abs(b.lng - 20.9634) < 0.02;
      const revCent = Math.abs(a.lat - 52.2288) < 0.015 && Math.abs(a.lng - 21.0032) < 0.02;
      return (isZach && isCent) || (revZach && revCent);
    },
    waypoints: [
      { lat: 52.2220, lng: 20.9780 }, // Czyste / linia średnicowa zachodnia
      { lat: 52.2255, lng: 20.9920 }, // Wykop Towarowa
    ],
  },
];

/**
 * Wstawia kluczowe punkty geodezyjne torów między stacjami jeśli są znane
 */
function injectKnownRailWaypoints(points: SplinePoint[]): SplinePoint[] {
  if (points.length < 2) return points;
  const result: SplinePoint[] = [points[0]];

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    let injected = false;
    for (const rule of RAIL_WAYPOINTS) {
      if (rule.condition(p1, p2)) {
        // Określ kierunek wstawiania
        const forward = p1.lng < p2.lng;
        const wps = forward ? rule.waypoints : [...rule.waypoints].reverse();
        result.push(...wps);
        injected = true;
        break;
      }
    }

    result.push(p2);
  }

  return result;
}

/**
 * Catmull-Rom Spline interpolator.
 * Oblicza punkt na krzywej między p1 i p2 na podstawie 4 punktów kontrolnych [p0, p1, p2, p3] i parametru t (0..1).
 */
function catmullRom(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number
): number {
  const v0 = (p2 - p0) * 0.5;
  const v1 = (p3 - p1) * 0.5;
  const t2 = t * t;
  const t3 = t * t2;
  return (
    (2 * p1 - 2 * p2 + v0 + v1) * t3 +
    (-3 * p1 + 3 * p2 - 2 * v0 - v1) * t2 +
    v0 * t +
    p1
  );
}

/**
 * Generuje naturalnie wygładzoną, zakrzywioną ścieżkę szlaku kolejowego
 * bez ostrych załamań i bez prostych przecinających budynki.
 */
export function generateRailSpline(rawPoints: SplinePoint[], targetStepMeters = 35): SplinePoint[] {
  if (!rawPoints || rawPoints.length < 2) return rawPoints || [];

  // 1. Wstrzyknij znane punkty charakterystyczne (np. mosty kolejowe)
  const basePoints = injectKnownRailWaypoints(rawPoints);
  if (basePoints.length < 2) return basePoints;

  // 2. Dodaj punkty wirtualne na początku i końcu dla obliczenia stycznych Catmull-Rom
  const pStart: SplinePoint = {
    lat: basePoints[0].lat - (basePoints[1].lat - basePoints[0].lat),
    lng: basePoints[0].lng - (basePoints[1].lng - basePoints[0].lng),
  };
  const lastIdx = basePoints.length - 1;
  const pEnd: SplinePoint = {
    lat: basePoints[lastIdx].lat + (basePoints[lastIdx].lat - basePoints[lastIdx - 1].lat),
    lng: basePoints[lastIdx].lng + (basePoints[lastIdx].lng - basePoints[lastIdx - 1].lng),
  };

  const extended: SplinePoint[] = [pStart, ...basePoints, pEnd];
  const smoothed: SplinePoint[] = [];

  for (let i = 1; i < extended.length - 2; i++) {
    const p0 = extended[i - 1];
    const p1 = extended[i];
    const p2 = extended[i + 1];
    const p3 = extended[i + 2];

    const distSegment = calculateDistanceMeters(p1.lat, p1.lng, p2.lat, p2.lng);
    const numSubSteps = Math.max(2, Math.min(60, Math.round(distSegment / targetStepMeters)));

    for (let step = 0; step < numSubSteps; step++) {
      const t = step / numSubSteps;
      const lat = catmullRom(p0.lat, p1.lat, p2.lat, p3.lat, t);
      const lng = catmullRom(p0.lng, p1.lng, p2.lng, p3.lng, t);
      smoothed.push({
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
      });
    }
  }

  // Dodaj ostatni punkt
  const finalPoint = basePoints[basePoints.length - 1];
  smoothed.push({
    lat: Number(finalPoint.lat.toFixed(5)),
    lng: Number(finalPoint.lng.toFixed(5)),
  });

  return smoothed;
}

/**
 * Znajduje najbliższy punkt na wygładzonym szlaku i rzutuje pozycję pociągu na tor
 */
export function snapTrainToPath(
  pos: SplinePoint,
  path: SplinePoint[]
): { position: SplinePoint; pathIndex: number; heading: number } {
  if (!path || path.length === 0) {
    return { position: pos, pathIndex: 0, heading: 0 };
  }
  if (path.length === 1) {
    return { position: path[0], pathIndex: 0, heading: 0 };
  }

  let minDistance = Infinity;
  let bestIndex = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const dist = calculateDistanceMeters(pos.lat, pos.lng, path[i].lat, path[i].lng);
    if (dist < minDistance) {
      minDistance = dist;
      bestIndex = i;
    }
  }

  const nextIdx = Math.min(path.length - 1, bestIndex + 1);
  const heading = calculateBearing(path[bestIndex].lat, path[bestIndex].lng, path[nextIdx].lat, path[nextIdx].lng);

  return {
    position: { lat: path[bestIndex].lat, lng: path[bestIndex].lng },
    pathIndex: bestIndex,
    heading,
  };
}

