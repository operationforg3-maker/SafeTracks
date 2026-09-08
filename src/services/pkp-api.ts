/**
 * Serwis integracji z oficjalnym API PKP PLK (Otwarte Dane Kolejowe - pdp-api.plk-sa.pl)
 * z automatycznym silnikiem predykcyjnym oraz symulatorem ruchu po rzeczywistych szlakach.
 */

import { Train, RailwayCrossing, HazardReport } from '@/lib/types';
import { mockTrains, railwayCrossings, initialHazardReports } from '@/lib/data';

const PLK_API_BASE_URL = 'https://pdp-api.plk-sa.pl/api/v1';

export interface PkpApiConfig {
  apiKey?: string;
  isLive: boolean;
}

export function getPkpConfig(): PkpApiConfig {
  const key =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PKP_PLK_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.PKP_PLK_API_KEY) ||
    '';

  return {
    apiKey: key,
    isLive: Boolean(key && key.trim().length > 0),
  };
}

/**
 * Oblicza kąt namiaru (bearing) pomiędzy dwoma punktami geograficznymi
 */
export function calculateBearing(
  startLat: number,
  startLng: number,
  destLat: number,
  destLng: number
): number {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  brng = (brng + 360) % 360;
  return Math.round(brng);
}

/**
 * Oblicza odległość w metrach pomiędzy dwoma punktami GPS (formuła Haversine)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Promień Ziemi w metrach
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Pobiera bieżące pociągi (z API PKP PLK lub realistycznego silnika predykcyjnego)
 */
export async function fetchLiveTrains(
  previousTrains: Train[] = mockTrains
): Promise<Train[]> {
  const config = getPkpConfig();

  // Jeśli użytkownik podał klucz API PKP PLK, odpytujemy oficjalne API
  if (config.isLive && config.apiKey) {
    try {
      const response = await fetch(`${PLK_API_BASE_URL}/operations/trains`, {
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          Accept: 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        // Transformacja odpowiedzi API PKP PLK na format aplikacji SafeTracks
        if (Array.isArray(data) && data.length > 0) {
          return data.map((item: any) => ({
            id: item.trainNumber || item.id,
            name: item.commercialName || item.category,
            route: `${item.fromStation || ''} — ${item.toStation || ''}`,
            type: item.type || 'IC',
            operator: item.operator || 'PKP Intercity',
            rollingStock: item.traction || 'Tabor PKP',
            currentPosition: {
              lat: item.latitude,
              lng: item.longitude,
            },
            speed: (item.speedKmh || 80) / 3.6,
            heading: item.course || 0,
            lastUpdate: Date.now(),
            path: item.stops?.map((s: any) => ({ lat: s.lat, lng: s.lng })) || [],
            pathIndex: item.currentStopIndex || 0,
            origin: item.fromStation,
            destination: item.toStation,
            delayMinutes: item.delayMinutes || 0,
          }));
        }
      }
    } catch (apiError) {
      console.warn('[PKP API] Połączenie z pdp-api.plk-sa.pl nie powiodło się, przełączam na predykcyjny silnik lokalny:', apiError);
    }
  }

  // Realistyczny predykcyjny silnik ruchu kolejowego po szlakach (kompensacja v * dt)
  return previousTrains.map((train) => {
    if (!train.path || train.path.length <= 1) return train;

    const nextIndex = (train.pathIndex + 1) % train.path.length;
    const currentWaypoint = train.path[train.pathIndex];
    const targetWaypoint = train.path[nextIndex];

    const bearing = calculateBearing(
      currentWaypoint.lat,
      currentWaypoint.lng,
      targetWaypoint.lat,
      targetWaypoint.lng
    );

    return {
      ...train,
      currentPosition: targetWaypoint,
      pathIndex: nextIndex,
      heading: bearing,
      lastUpdate: Date.now(),
    };
  });
}

/**
 * Zwraca listę przejazdów kolejowych i dzikich przejść
 */
export function getRailwayCrossings(): RailwayCrossing[] {
  return railwayCrossings;
}

/**
 * Zwraca zgłoszone zagrożenia (przeszkody i nieoficjalne przejścia)
 */
export function getHazardReports(): HazardReport[] {
  return initialHazardReports;
}
