import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-static';
import stationsData from '@/lib/plk-stations-all.json';
import { calculateBearing, calculateDistanceMeters } from '@/services/pkp-api';
import type { Train } from '@/lib/types';

const PLK_API_BASE_URL = 'https://pdp-api.plk-sa.pl/api/v1';

interface CacheEntry {
  timestamp: number;
  data: {
    station: { id: number; name: string; lat: number; lng: number };
    trains: Train[];
    generatedAt: string;
    totalFound: number;
  };
}

// In-memory cache serwerowy (TTL 30 sekund) chroniący przed przekroczeniem limitu zapytań (500 req/h)
const cache = new Map<number, CacheEntry>();
const CACHE_TTL_MS = 30 * 1000;

// Indeks stacji dla szybkiego wyszukiwania po ID
const stationsById = new Map<number, { id: number; name: string; lat: number; lng: number }>();
for (const st of stationsData) {
  stationsById.set(st.id, st);
}

function getApiKey(): string {
  return (
    process.env.PKP_PLK_API_KEY ||
    process.env.NEXT_PUBLIC_PKP_PLK_API_KEY ||
    'RcYrura85Lbk83OFBgHmcNfuP7t62WSppTrNUtwBVVM1DsHTzVDmNjFhjDGq6WCr-7zVpdF9l39Ug0_RhqGk1Q'
  );
}

function getCarrierFullName(code: string): string {
  const map: Record<string, string> = {
    'IC': 'PKP Intercity',
    'KM': 'Koleje Mazowieckie',
    'PR': 'POLREGIO',
    'WKD': 'Warszawska Kolej Dojazdowa',
    'KD': 'Koleje Dolnośląskie',
    'KS': 'Koleje Śląskie',
    'KSL': 'Koleje Śląskie',
    'ŁKA': 'Łódzka Kolej Aglomeracyjna',
    'SKM': 'Szybka Kolej Miejska',
    'KW': 'Koleje Wielkopolskie',
    'CARGO': 'PKP Cargo',
  };
  return map[code.toUpperCase()] || code;
}

function mapRollingStock(category: string, carrier: string, name?: string): string {
  if (category === 'EIP') return 'ED250 (Alstom Pendolino)';
  if (category === 'EIC') return 'EU44 (Siemens EuroSprinter)';
  if (category === 'IC') return 'ED160 (FLIRT3) / ED161 (Dart)';
  if (category === 'TLK') return 'EP07 / EP09 + wagony';
  if (carrier === 'KM') return 'ER160 (FLIRT) / EN57-AKM';
  if (carrier === 'PR') return 'EN57 / SA133 / Impuls';
  if (carrier === 'KD') return '31WE / 45WE Impuls';
  if (carrier === 'WKD') return 'EN97 / EN100';
  return `${category} ${carrier}`;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stationIdParam = searchParams.get('stationId');
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');

    let stationId: number | null = stationIdParam ? parseInt(stationIdParam, 10) : null;
    let station = stationId ? stationsById.get(stationId) : null;

    // Jeśli nie podano stationId, znajdź najbliższą stację na podstawie współrzędnych lat/lng
    if (!station && latParam && lngParam) {
      const userLat = parseFloat(latParam);
      const userLng = parseFloat(lngParam);
      if (!isNaN(userLat) && !isNaN(userLng)) {
        let minDistance = Infinity;
        let closestStation = stationsData[0];
        for (const st of stationsData) {
          const dist = calculateDistanceMeters(userLat, userLng, st.lat, st.lng);
          if (dist < minDistance) {
            minDistance = dist;
            closestStation = st;
          }
        }
        station = closestStation;
        stationId = station.id;
      }
    }

    // Domyślnie: Warszawa Centralna jeśli brak lokalizacji
    if (!station || !stationId) {
      stationId = 33605;
      station = stationsById.get(33605) || { id: 33605, name: 'Warszawa Centralna', lat: 52.2288, lng: 21.0032 };
    }

    // Sprawdź cache
    const nowMs = Date.now();
    const cached = cache.get(stationId);
    if (cached && nowMs - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAgeSeconds: Math.round((nowMs - cached.timestamp) / 1000),
      });
    }

    const apiKey = getApiKey();
    const headers = {
      'X-API-Key': apiKey,
      'Accept': 'application/json',
    };

    // Równoległe odpytanie API PKP PLK o rozkład (schedules) i wykonanie na żywo (operations)
    const [schedulesRes, operationsRes] = await Promise.all([
      fetch(`${PLK_API_BASE_URL}/schedules?stations=${stationId}&pageSize=100`, {
        headers,
        next: { revalidate: 30 },
      }).catch(() => null),
      fetch(`${PLK_API_BASE_URL}/operations?stations=${stationId}&withPlanned=true&fullRoutes=true&pageSize=100`, {
        headers,
        next: { revalidate: 30 },
      }).catch(() => null),
    ]);

    let schedulesData: any = null;
    let operationsData: any = null;

    if (schedulesRes && schedulesRes.ok) {
      schedulesData = await schedulesRes.json().catch(() => null);
    }
    if (operationsRes && operationsRes.ok) {
      operationsData = await operationsRes.json().catch(() => null);
    }

    // Słowniki z odpowiedzi PKP PLK
    const routesMap = new Map<number, any>();
    if (schedulesData?.routes) {
      for (const r of schedulesData.routes) {
        routesMap.set(r.orderId, r);
      }
    }

    const plkStationsNames: Record<string, string> = {
      ...(schedulesData?.dictionaries?.stations || {}),
      ...(operationsData?.stations || {}),
    };

    const getStationName = (id: number): string => {
      const fromDict = plkStationsNames[String(id)];
      if (fromDict) return fromDict;
      const fromAll = stationsById.get(id);
      if (fromAll) return fromAll.name;
      return `Stacja #${id}`;
    };

    const trains: Train[] = [];
    const currentDate = new Date();
    // Format daty dzisiejszej w Polsce YYYY-MM-DD
    const todayStr = currentDate.toISOString().slice(0, 10);
    const tomorrow = new Date(currentDate.getTime() + 86400000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const operationsTrains = operationsData?.trains || [];

    for (const opTrain of operationsTrains) {
      const opDate = opTrain.operatingDate;
      // Interesują nas pociągi z dziś oraz pociągi nocne z najbliższych godzin
      if (opDate !== todayStr && opDate !== tomorrowStr) continue;

      const orderId = opTrain.orderId;
      const sched = routesMap.get(orderId);

      const carrierCode = sched?.carrierCode || 'PKP';
      const trainName = sched?.name || undefined;
      const nationalNum = sched?.nationalNumber || String(orderId);
      const category = sched?.commercialCategorySymbol || (opTrain.trainStatus === 'P' ? 'Poc' : 'Poc');

      // Trasa pociągu (lista stacji)
      const opStations: any[] = opTrain.stations || [];
      if (opStations.length === 0) continue;

      // Znajdź wpis dla naszej stacji referencyjnej
      const targetStationStop = opStations.find((s) => s.stationId === stationId);
      if (!targetStationStop) continue;

      const depTimeStr =
        targetStationStop.actualDeparture ||
        targetStationStop.plannedDeparture ||
        targetStationStop.actualArrival ||
        targetStationStop.plannedArrival;

      if (!depTimeStr) continue;

      const stopTimeDate = new Date(depTimeStr);
      const diffMs = stopTimeDate.getTime() - nowMs;
      const diffMinutes = diffMs / 60000;

      // Okno czasowe: od -25 minut temu (pociągi, które właśnie odjechały) do +120 minut w przód
      // Oraz wszystkie pociągi ze statusem InProgress ('P')
      if (opTrain.trainStatus !== 'P' && (diffMinutes < -25 || diffMinutes > 120)) {
        continue;
      }

      const delayMin =
        targetStationStop.departureDelayMinutes ??
        targetStationStop.arrivalDelayMinutes ??
        0;

      // Oblicz stację początkową i końcową
      const firstStop = opStations[0];
      const lastStop = opStations[opStations.length - 1];
      const originName = getStationName(firstStop.stationId);
      const destinationName = getStationName(lastStop.stationId);
      const routeDesc = `${originName} ➔ ${destinationName}`;

      // Wyznaczanie pozycji GPS pociągu na szlaku
      let trainLat = station.lat;
      let trainLng = station.lng;
      let calculatedHeading = 0;
      let estimatedSpeedKmh = 75; // Domyślna prędkość średnia

      // Budowanie ścieżki (path) ze znanych współrzędnych stacji na trasie
      const pathPoints: { lat: number; lng: number }[] = [];
      for (const st of opStations) {
        const known = stationsById.get(st.stationId);
        if (known) {
          pathPoints.push({ lat: known.lat, lng: known.lng });
        }
      }

      // Znajdź segment szlaku, na którym aktualnie znajduje się skład
      // Ostatnia stacja z potwierdzonym odjazdem lub przeszłym czasem
      let lastVisitedIndex = -1;
      for (let i = 0; i < opStations.length; i++) {
        const st = opStations[i];
        const tStr = st.actualDeparture || st.actualArrival || st.plannedDeparture || st.plannedArrival;
        if (tStr) {
          const tDate = new Date(tStr).getTime();
          if (st.isConfirmed || tDate <= nowMs) {
            lastVisitedIndex = i;
          }
        }
      }

      if (lastVisitedIndex >= 0 && lastVisitedIndex < opStations.length - 1) {
        const prevStop = opStations[lastVisitedIndex];
        const nextStop = opStations[lastVisitedIndex + 1];
        const prevStation = stationsById.get(prevStop.stationId);
        const nextStation = stationsById.get(nextStop.stationId);

        if (prevStation && nextStation) {
          calculatedHeading = calculateBearing(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);

          const prevDepTime = new Date(prevStop.actualDeparture || prevStop.plannedDeparture || prevStop.actualArrival || prevStop.plannedArrival).getTime();
          const nextArrTime = new Date(nextStop.actualArrival || nextStop.plannedArrival || nextStop.actualDeparture || nextStop.plannedDeparture).getTime();

          const totalDuration = Math.max(1, nextArrTime - prevDepTime);
          const elapsed = Math.max(0, Math.min(totalDuration, nowMs - prevDepTime));
          const progressRatio = elapsed / totalDuration;

          trainLat = prevStation.lat + (nextStation.lat - prevStation.lat) * progressRatio;
          trainLng = prevStation.lng + (nextStation.lng - prevStation.lng) * progressRatio;

          const distanceMeters = calculateDistanceMeters(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);
          estimatedSpeedKmh = Math.min(160, Math.max(20, Math.round((distanceMeters / (totalDuration / 1000)) * 3.6)));
        } else if (prevStation) {
          trainLat = prevStation.lat;
          trainLng = prevStation.lng;
        }
      } else if (pathPoints.length > 0) {
        // Jeśli przed rozpoczęciem trasy
        trainLat = pathPoints[0].lat;
        trainLng = pathPoints[0].lng;
        if (pathPoints.length > 1) {
          calculatedHeading = calculateBearing(pathPoints[0].lat, pathPoints[0].lng, pathPoints[1].lat, pathPoints[1].lng);
        }
      }

      const trainId = `${category} ${nationalNum}`;
      const operator = getCarrierFullName(carrierCode);
      const rollingStock = mapRollingStock(category, carrierCode, trainName);

      trains.push({
        id: trainId,
        name: trainName,
        route: routeDesc,
        type: category,
        operator,
        rollingStock,
        currentPosition: {
          lat: Number(trainLat.toFixed(5)),
          lng: Number(trainLng.toFixed(5)),
        },
        speed: Math.round(estimatedSpeedKmh / 3.6), // w m/s
        heading: calculatedHeading,
        lastUpdate: nowMs,
        path: pathPoints.length > 1 ? pathPoints : [{ lat: trainLat, lng: trainLng }],
        pathIndex: Math.max(0, lastVisitedIndex),
        origin: originName,
        destination: destinationName,
        delayMinutes: delayMin,
      });
    }

    // Sortowanie: pociągi najbliżej stacji na samej górze
    trains.sort((a, b) => {
      const distA = calculateDistanceMeters(station.lat, station.lng, a.currentPosition.lat, a.currentPosition.lng);
      const distB = calculateDistanceMeters(station.lat, station.lng, b.currentPosition.lat, b.currentPosition.lng);
      return distA - distB;
    });

    const responsePayload = {
      station: {
        id: station.id,
        name: station.name,
        lat: station.lat,
        lng: station.lng,
      },
      trains,
      totalFound: trains.length,
      generatedAt: new Date().toISOString(),
    };

    // Zapis w pamięci serwera
    cache.set(stationId, {
      timestamp: nowMs,
      data: responsePayload,
    });

    return NextResponse.json({
      ...responsePayload,
      cached: false,
    });
  } catch (error: any) {
    console.error('[PLK API Route Error]:', error);
    return NextResponse.json(
      { error: 'Błąd pobierania danych PKP PLK', details: error?.message },
      { status: 500 }
    );
  }
}
