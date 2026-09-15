const http = require('http');
const url = require('url');
const stationsData = require('./plk-stations-all.json');
const { getTrackSegmentBetweenPoints, enrichPathWithPhysicalRails } = require('./rail-router');

const PORT = process.env.PORT || 8080;
const PLK_API_BASE_URL = 'https://pdp-api.plk-sa.pl/api/v1';
const API_KEY =
  process.env.PKP_PLK_API_KEY ||
  'RcYrura85Lbk83OFBgHmcNfuP7t62WSppTrNUtwBVVM1DsHTzVDmNjFhjDGq6WCr-7zVpdF9l39Ug0_RhqGk1Q';

// Indeks stacji dla natychmiastowego wyszukiwania
const stationsById = new Map();
for (const st of stationsData) {
  stationsById.set(st.id, st);
}

// In-memory cache serwerowy (TTL 30 sekund)
const cache = new Map();
const CACHE_TTL_MS = 30 * 1000;

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
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

function calculateBearing(startLat, startLng, destLat, destLng) {
  const startLatRad = (startLat * Math.PI) / 180;
  const startLngRad = (startLng * Math.PI) / 180;
  const destLatRad = (destLat * Math.PI) / 180;
  const destLngRad = (destLng * Math.PI) / 180;

  const y = Math.sin(destLngRad - startLngRad) * Math.cos(destLatRad);
  const x =
    Math.cos(startLatRad) * Math.sin(destLatRad) -
    Math.sin(startLatRad) * Math.cos(destLatRad) * Math.cos(destLngRad - startLngRad);

  let brng = (Math.atan2(y, x) * 180) / Math.PI;
  return Math.round((brng + 360) % 360);
}

function getCarrierFullName(code) {
  const map = {
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
  return map[code ? code.toUpperCase() : ''] || code || 'PKP';
}

function mapRollingStock(category, carrier, name) {
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

async function handleStationTrains(req, res, parsedUrl) {
  const query = parsedUrl.query;
  const stationIdParam = query.stationId;
  const latParam = query.lat;
  const lngParam = query.lng;

  let stationId = stationIdParam ? parseInt(stationIdParam, 10) : null;
  let station = stationId ? stationsById.get(stationId) : null;

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

  if (!station || !stationId) {
    stationId = 33605; // Warszawa Centralna
    station = stationsById.get(33605) || {
      id: 33605,
      name: 'Warszawa Centralna',
      lat: 52.2288,
      lng: 21.0032,
    };
  }

  const nowMs = Date.now();
  const cached = cache.get(stationId);
  if (cached && nowMs - cached.timestamp < CACHE_TTL_MS) {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=15',
    });
    return res.end(
      JSON.stringify({
        ...cached.data,
        cached: true,
        cacheAgeSeconds: Math.round((nowMs - cached.timestamp) / 1000),
      })
    );
  }

  try {
    const headers = {
      'X-API-Key': API_KEY,
      'Accept': 'application/json',
    };

    const [schedulesRes, operationsRes] = await Promise.all([
      fetch(`${PLK_API_BASE_URL}/schedules?stations=${stationId}&pageSize=100`, { headers }).catch(
        () => null
      ),
      fetch(
        `${PLK_API_BASE_URL}/operations?stations=${stationId}&withPlanned=true&fullRoutes=true&pageSize=100`,
        { headers }
      ).catch(() => null),
    ]);

    let schedulesData = null;
    let operationsData = null;

    if (schedulesRes && schedulesRes.ok) {
      schedulesData = await schedulesRes.json().catch(() => null);
    }
    if (operationsRes && operationsRes.ok) {
      operationsData = await operationsRes.json().catch(() => null);
    }

    const routesMap = new Map();
    if (schedulesData && schedulesData.routes) {
      for (const r of schedulesData.routes) {
        routesMap.set(r.orderId, r);
      }
    }

    const plkStationsNames = {
      ...((schedulesData && schedulesData.dictionaries && schedulesData.dictionaries.stations) || {}),
      ...((operationsData && operationsData.stations) || {}),
    };

    const getStationName = (id) => {
      const fromDict = plkStationsNames[String(id)];
      if (fromDict) return fromDict;
      const fromAll = stationsById.get(id);
      if (fromAll) return fromAll.name;
      return `Stacja #${id}`;
    };

    const trains = [];
    const currentDate = new Date();
    const todayStr = currentDate.toISOString().slice(0, 10);
    const tomorrow = new Date(currentDate.getTime() + 86400000);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);
    const yesterday = new Date(currentDate.getTime() - 86400000);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    const operationsTrains = (operationsData && operationsData.trains) || [];

    for (const opTrain of operationsTrains) {
      const opDate = opTrain.operatingDate;
      if (opDate !== todayStr && opDate !== tomorrowStr && opDate !== yesterdayStr) continue;

      const orderId = opTrain.orderId;
      const sched = routesMap.get(orderId);

      const carrierCode = sched?.carrierCode || 'PKP';
      const trainName = sched?.name || undefined;
      const nationalNum = sched?.nationalNumber || String(orderId);
      const category = sched?.commercialCategorySymbol || 'Poc';

      const opStations = opTrain.stations || [];
      if (opStations.length === 0) continue;

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

      // Okno czasowe: od -45 minut temu do +180 minut w przód, lub status w toku 'P'
      if (opTrain.trainStatus !== 'P' && (diffMinutes < -45 || diffMinutes > 180)) {
        continue;
      }

      const delayMin =
        targetStationStop.departureDelayMinutes ??
        targetStationStop.arrivalDelayMinutes ??
        0;

      const firstStop = opStations[0];
      const lastStop = opStations[opStations.length - 1];
      const originName = getStationName(firstStop.stationId);
      const destinationName = getStationName(lastStop.stationId);
      const routeDesc = `${originName} ➔ ${destinationName}`;

      // Budowanie ścieżki (path) ze znanych współrzędnych stacji wzdłuż torów
      const pathPoints = [];
      for (const st of opStations) {
        const known = stationsById.get(st.stationId);
        if (known) {
          pathPoints.push({ lat: known.lat, lng: known.lng });
        }
      }

      let trainLat = station.lat;
      let trainLng = station.lng;
      let calculatedHeading = 0;
      let estimatedSpeedKmh = 80;

      // Wyznaczanie segmentu między stacjami
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
          const prevDepTime = new Date(
            prevStop.actualDeparture || prevStop.plannedDeparture || prevStop.actualArrival || prevStop.plannedArrival
          ).getTime();
          const nextArrTime = new Date(
            nextStop.actualArrival || nextStop.plannedArrival || nextStop.actualDeparture || nextStop.plannedDeparture
          ).getTime();

          const totalDuration = Math.max(1, nextArrTime - prevDepTime);
          const elapsed = Math.max(0, Math.min(totalDuration, nowMs - prevDepTime));
          const progressRatio = elapsed / totalDuration;

          // Rzeczywista fizyczna ścieżka po torach między tymi stacjami (geodezja torowa)
          const physicalSegment = getTrackSegmentBetweenPoints(
            prevStation.lat, prevStation.lng,
            nextStation.lat, nextStation.lng
          );

          if (physicalSegment.length > 1) {
            const subIdx = Math.max(0, Math.min(physicalSegment.length - 1, Math.floor(progressRatio * (physicalSegment.length - 1))));
            trainLat = physicalSegment[subIdx].lat;
            trainLng = physicalSegment[subIdx].lng;

            const nextSubIdx = Math.min(physicalSegment.length - 1, subIdx + 1);
            calculatedHeading = calculateBearing(
              physicalSegment[subIdx].lat, physicalSegment[subIdx].lng,
              physicalSegment[nextSubIdx].lat, physicalSegment[nextSubIdx].lng
            );
          } else {
            trainLat = prevStation.lat;
            trainLng = prevStation.lng;
            calculatedHeading = calculateBearing(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);
          }

          const distanceMeters = calculateDistanceMeters(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);
          estimatedSpeedKmh = Math.min(160, Math.max(25, Math.round((distanceMeters / (totalDuration / 1000)) * 3.6)));
        } else if (prevStation) {
          trainLat = prevStation.lat;
          trainLng = prevStation.lng;
        }
      } else if (pathPoints.length > 0) {
        trainLat = pathPoints[0].lat;
        trainLng = pathPoints[0].lng;
        if (pathPoints.length > 1) {
          calculatedHeading = calculateBearing(pathPoints[0].lat, pathPoints[0].lng, pathPoints[1].lat, pathPoints[1].lng);
        }
      }

      const trainId = `${category} ${nationalNum}`;
      const operator = getCarrierFullName(carrierCode);
      const rollingStock = mapRollingStock(category, carrierCode, trainName);

      // Wzbogacenie pełnego korytarza pociągu o fizyczne tory
      const physicalFullPath = pathPoints.length > 1
        ? enrichPathWithPhysicalRails(pathPoints)
        : [{ lat: trainLat, lng: trainLng }];

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
        speed: Math.round(estimatedSpeedKmh / 3.6),
        heading: calculatedHeading,
        lastUpdate: nowMs,
        path: physicalFullPath,
        pathIndex: Math.max(0, lastVisitedIndex),
        origin: originName,
        destination: destinationName,
        delayMinutes: delayMin,
      });
    }

    // Sortowanie według odległości od badanej stacji
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
      cached: false,
    };

    cache.set(stationId, {
      timestamp: nowMs,
      data: responsePayload,
    });

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=15',
    });
    res.end(JSON.stringify(responsePayload));
  } catch (err) {
    console.error('[PLK Proxy Error]:', err);
    res.writeHead(500, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify({ error: 'Błąd pobierania danych PKP PLK', details: err.message }));
  }
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const parsedUrl = {
    pathname: reqUrl.pathname,
    query: Object.fromEntries(reqUrl.searchParams.entries()),
  };

  // Obsługa preflight CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (parsedUrl.pathname === '/health' || parsedUrl.pathname === '/') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(JSON.stringify({ status: 'ok', service: 'safetracks-plk-proxy', time: new Date().toISOString() }));
  }

  if (parsedUrl.pathname === '/api/plk/station-trains' || parsedUrl.pathname === '/station-trains') {
    return handleStationTrains(req, res, parsedUrl);
  }

  res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({ error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`SafeTracks PLK Proxy running on port ${PORT}`);
});
