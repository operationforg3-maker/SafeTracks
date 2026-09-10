/**
 * Serwis integracji z oficjalnym API PKP PLK (Otwarte Dane Kolejowe - pdp-api.plk-sa.pl)
 * Obsługuje komunikację przez backendowy Route Handler Next.js z pamięcią podręczną
 * oraz pełną bazę ponad 3000 stacji i posterunków ruchu z dokładnymi współrzędnymi GPS.
 */

import { Train } from '@/lib/types';
import allStationsData from '@/lib/plk-stations-all.json';

export interface PkpApiConfig {
  apiKey: string;
  isLive: boolean;
  statusText: string;
}

export interface PlkStatistics {
  totalTrains: number;
  inProgress: number;
  completed: number;
  cancelled: number;
}

export interface GeocodedStation {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export const allStations: GeocodedStation[] = allStationsData;
export const geocodedStations: GeocodedStation[] = allStations; // Kompatybilność wsteczna

export function getPkpConfig(): PkpApiConfig {
  let key =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PKP_PLK_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.PKP_PLK_API_KEY) ||
    'RcYrura85Lbk83OFBgHmcNfuP7t62WSppTrNUtwBVVM1DsHTzVDmNjFhjDGq6WCr-7zVpdF9l39Ug0_RhqGk1Q';

  if (typeof window !== 'undefined') {
    const userStoredKey = localStorage.getItem('safetracks_pkp_api_key');
    if (userStoredKey && userStoredKey.trim().length > 0) {
      key = userStoredKey.trim();
    }
  }

  const hasKey = Boolean(key && key.trim().length > 0);

  return {
    apiKey: key,
    isLive: hasKey,
    statusText: hasKey ? 'Połączono z PKP PLK OpenDataAPI' : 'Tryb buforowy / offline',
  };
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
  const R = 6371e3;
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
 * Znajduje najbliższy posterunek / stację PKP PLK dla podanej pozycji GPS
 */
export function findNearestStation(
  userLat: number,
  userLng: number
): GeocodedStation & { distanceMeters: number } {
  let nearest = allStations[0];
  let minDistance = calculateDistanceMeters(userLat, userLng, nearest.lat, nearest.lng);

  for (let i = 1; i < allStations.length; i++) {
    const st = allStations[i];
    const dist = calculateDistanceMeters(userLat, userLng, st.lat, st.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearest = st;
    }
  }

  return {
    ...nearest,
    distanceMeters: Math.round(minDistance),
  };
}

/**
 * Znajduje N najbliższych posterunków / stacji PKP PLK dla podanej pozycji GPS
 */
export function findNearestStations(
  userLat: number,
  userLng: number,
  count: number = 3
): (GeocodedStation & { distanceMeters: number })[] {
  const withDistance = allStations.map((st) => ({
    ...st,
    distanceMeters: calculateDistanceMeters(userLat, userLng, st.lat, st.lng),
  }));

  withDistance.sort((a, b) => a.distanceMeters - b.distanceMeters);
  return withDistance.slice(0, count);
}

/**
 * Wyszukuje stacje po fragmencie nazwy
 */
export function searchStations(query: string, limit: number = 10): GeocodedStation[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.trim().toLowerCase();
  return allStations
    .filter((st) => st.name.toLowerCase().includes(q))
    .slice(0, limit);
}

/**
 * Oblicza kąt namiaru (bearing w stopniach 0-360)
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
 * Sprawdza czy pociąg faktycznie ZBLIŻA SIĘ do użytkownika na podstawie wektora kursu.
 * Zwraca true jeśli pociąg zmierza w kierunku pieszego, false jeśli już go minął.
 */
export function isTrainApproaching(
  userLat: number,
  userLng: number,
  trainLat: number,
  trainLng: number,
  trainHeading: number
): boolean {
  const bearingToUser = calculateBearing(trainLat, trainLng, userLat, userLng);
  let diff = Math.abs(trainHeading - bearingToUser);
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff <= 95;
}

/**
 * Pobiera bieżące statystyki ruchu kolejowego z proxy API
 */
export async function fetchLivePlkStats(): Promise<PlkStatistics | null> {
  try {
    const res = await fetch('/api/plk/station-trains?stationId=33605');
    if (res.ok) {
      const data = await res.json();
      return {
        totalTrains: data.totalFound || 0,
        inProgress: data.trains?.filter((t: Train) => t.speed > 0).length || 0,
        completed: 0,
        cancelled: 0,
      };
    }
  } catch (err) {}
  return null;
}

export interface StationTrainsResponse {
  station: GeocodedStation;
  trains: Train[];
  totalFound: number;
  generatedAt: string;
  cached?: boolean;
}

/**
 * Główna funkcja pobierania rzeczywistych pociągów z backendu proxy Next.js
 */
export async function fetchLiveStationTrains(
  stationId?: number,
  userPosition?: { lat: number; lng: number }
): Promise<StationTrainsResponse | null> {
  try {
    const params = new URLSearchParams();
    if (stationId) {
      params.append('stationId', String(stationId));
    }
    if (userPosition) {
      params.append('lat', String(userPosition.lat));
      params.append('lng', String(userPosition.lng));
    }

    const response = await fetch(`/api/plk/station-trains?${params.toString()}`);
    if (response.ok) {
      const data: StationTrainsResponse = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[PKP API] Błąd sieciowy pobierania pociągów:', err);
  }
  return null;
}

/**
 * Płynna mikro-interpolacja pozycji składów na szlaku między zapytaniami serwerowymi
 */
export function advanceTrainsPosition(trains: Train[], deltaSeconds: number = 1): Train[] {
  return trains.map((train) => {
    if (!train.path || train.path.length <= 1 || train.speed <= 0) {
      return train;
    }

    const currentPos = train.currentPosition;
    const nextIdx = (train.pathIndex + 1) % train.path.length;
    const targetWaypoint = train.path[nextIdx];

    const distToTarget = calculateDistanceMeters(currentPos.lat, currentPos.lng, targetWaypoint.lat, targetWaypoint.lng);
    const movedMeters = train.speed * deltaSeconds;

    if (distToTarget <= Math.max(movedMeters, 50)) {
      // Osiągnięto waypoint, przejdź do kolejnego
      return {
        ...train,
        currentPosition: { ...targetWaypoint },
        pathIndex: nextIdx,
        lastUpdate: Date.now(),
      };
    }

    // Ruch wzdłuż wektora
    const ratio = Math.min(1, movedMeters / Math.max(distToTarget, 1));
    const newLat = currentPos.lat + (targetWaypoint.lat - currentPos.lat) * ratio;
    const newLng = currentPos.lng + (targetWaypoint.lng - currentPos.lng) * ratio;
    const heading = calculateBearing(currentPos.lat, currentPos.lng, targetWaypoint.lat, targetWaypoint.lng);

    return {
      ...train,
      currentPosition: {
        lat: Number(newLat.toFixed(5)),
        lng: Number(newLng.toFixed(5)),
      },
      heading,
      lastUpdate: Date.now(),
    };
  });
}

// Początkowa lista pociągów (np. dla Warszawy Centralnej)
export const initialPlkTrains: Train[] = [];
