/**
 * Serwis integracji z oficjalnym API PKP PLK (Otwarte Dane Kolejowe - pdp-api.plk-sa.pl)
 * z automatyczną detekcją autoryzacji nagłówka X-API-Key oraz płynnym fallbackiem do silnika szlakowego.
 */

import { Train, RailwayCrossing, HazardReport } from '@/lib/types';
import { mockTrains, railwayCrossings, initialHazardReports } from '@/lib/data';

const PLK_API_BASE_URL = 'https://pdp-api.plk-sa.pl/api/v1';

export interface PkpApiConfig {
  apiKey: string;
  isLive: boolean;
  statusText: string;
}

export function getPkpConfig(): PkpApiConfig {
  let key =
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_PKP_PLK_API_KEY) ||
    (typeof process !== 'undefined' && process.env?.PKP_PLK_API_KEY) ||
    '';

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
    statusText: hasKey ? 'Klucz PKP zarejestrowany (X-API-Key)' : 'Tryb symulacji szlakowej (brak aktywnego klucza)',
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
 * Pobiera bieżące pociągi (z API PKP PLK lub realistycznego silnika szlakowego)
 */
export async function fetchLiveTrains(
  previousTrains: Train[] = mockTrains
): Promise<Train[]> {
  const config = getPkpConfig();

  // Jeśli użytkownik podał klucz API PKP PLK, odpytujemy oficjalne API z nagłówkiem X-API-Key oraz Authorization
  if (config.apiKey) {
    try {
      const response = await fetch(`${PLK_API_BASE_URL}/operations/trains`, {
        headers: {
          'X-API-Key': config.apiKey,
          'Authorization': `Bearer ${config.apiKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
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
      } else {
        // Status 401 lub oczekiwanie na aktywację klucza przez PKP PLK
        // Płynny fallback do predykcji szlakowej
      }
    } catch (apiError) {
      // Błąd sieciowy lub CORS — kontynuujemy z silnikiem lokalnym
    }
  }

  // Realistyczny silnik symulacji ruchu po szlakach kolejowych
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
      heading: bearing,
      lastUpdate: Date.now(),
      currentPosition: {
        lat: currentWaypoint.lat + (Math.random() - 0.5) * 0.0004,
        lng: currentWaypoint.lng + (Math.random() - 0.5) * 0.0004,
      },
      pathIndex: nextIndex,
    };
  });
}
