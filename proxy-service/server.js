const http = require('http');
const url = require('url');
const stationsData = require('./plk-stations-all.json');
const { getTrackSegmentBetweenPoints, enrichPathWithPhysicalRails, mergeConjoinedTrains } = require('./rail-router');

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

// In-memory cache surowych odpowiedzi PLK (TTL 10 sekund)
// Pozycje pociągów są przeliczane dynamicznie dla każdego żądania (zero opóźnienia)
const rawPlkCache = new Map();
const RAW_CACHE_TTL_MS = 10 * 1000;

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

function parsePlkDate(timeStr) {
  if (!timeStr) return null;
  const hasTz = timeStr.endsWith('Z') || timeStr.includes('+') || (timeStr.length > 19 && timeStr[19] === '-');
  if (hasTz) return new Date(timeStr);
  const dApprox = new Date(timeStr + 'Z');
  const month = dApprox.getUTCMonth();
  const isSummer = month >= 3 && month <= 9;
  const tzOffset = isSummer ? '+02:00' : '+01:00';
  return new Date(timeStr + tzOffset);
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

function getRealisticCruisingSpeed(category, carrierCode, segmentSpeedKmh, trainId) {
  let hash = 0;
  const str = String(trainId || '');
  for (let c = 0; c < str.length; c++) hash = (hash * 31 + str.charCodeAt(c)) & 0xfff;
  const jitter = (hash % 9) - 4; // -4 do +4 km/h

  let baseCeiling = 98;
  let baseFloor = 72;
  const cat = (category || '').toUpperCase();
  if (cat === 'EIP') {
    baseFloor = 135;
    baseCeiling = 160;
  } else if (cat === 'EIC') {
    baseFloor = 120;
    baseCeiling = 150;
  } else if (cat === 'IC' || cat === 'TLK' || cat === 'EX') {
    baseFloor = 100;
    baseCeiling = 135;
  } else if (cat === 'IR' || cat === 'RE') {
    baseFloor = 85;
    baseCeiling = 115;
  } else if (cat === 'SKM' || cat === 'WKD') {
    baseFloor = 55;
    baseCeiling = 78;
  } else if (cat === 'CARGO' || cat === 'TOW') {
    baseFloor = 50;
    baseCeiling = 70;
  } else {
    // Koleje regionalne: KM, KD, KW, PR, KS, ŁKA
    baseFloor = 78;
    baseCeiling = 105;
  }

  if (segmentSpeedKmh && segmentSpeedKmh >= 35 && segmentSpeedKmh <= 165) {
    const cruiseEst = segmentSpeedKmh * 1.08 + jitter;
    return Math.max(baseFloor, Math.min(baseCeiling, Math.round(cruiseEst)));
  }
  return Math.round((baseFloor + baseCeiling) / 2 + jitter);
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

  const leadSecondsParam = query.leadSeconds ? parseInt(query.leadSeconds, 10) : 35;
  const leadMs = (!isNaN(leadSecondsParam) && leadSecondsParam >= 0 && leadSecondsParam <= 120 ? leadSecondsParam : 35) * 1000;
  const nowMs = Date.now();
  const effectiveNowMs = nowMs + leadMs;

  try {
    let schedulesData = null;
    let operationsData = null;

    const rawCached = rawPlkCache.get(stationId);
  if (rawCached && nowMs - rawCached.timestamp < RAW_CACHE_TTL_MS) {
    schedulesData = rawCached.schedulesData;
    operationsData = rawCached.operationsData;
  } else {
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

      if (schedulesRes && schedulesRes.ok) {
        schedulesData = await schedulesRes.json().catch(() => null);
      }
      if (operationsRes && operationsRes.ok) {
        operationsData = await operationsRes.json().catch(() => null);
      }

      if (schedulesData || operationsData) {
        rawPlkCache.set(stationId, {
          timestamp: nowMs,
          schedulesData,
          operationsData,
        });
      }
    } catch (fetchErr) {
      console.warn('[PLK Fetch Warning]:', fetchErr);
    }
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

      const stopTimeDate = parsePlkDate(depTimeStr);
      if (!stopTimeDate) continue;
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

      const trainId = `${category} ${nationalNum}`;
      const operator = getCarrierFullName(carrierCode);
      const rollingStock = mapRollingStock(category, carrierCode, trainName);

      let trainLat = station.lat;
      let trainLng = station.lng;
      let calculatedHeading = 0;
      let estimatedSpeedKmh = 0; // Domyślnie 0 (postój / oczekiwanie)

      // Wyznaczanie segmentu między stacjami z uwzględnieniem kompensacji opóźnienia telemetrii (effectiveNowMs)
      let lastVisitedIndex = -1;
      for (let i = 0; i < opStations.length; i++) {
        const st = opStations[i];
        const tStr = st.actualDeparture || st.actualArrival || st.plannedDeparture || st.plannedArrival;
        if (tStr) {
          const tDate = parsePlkDate(tStr)?.getTime();
          if (st.isConfirmed || (tDate && tDate <= effectiveNowMs)) {
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
          const prevDepTime = parsePlkDate(
            prevStop.actualDeparture || prevStop.plannedDeparture || prevStop.actualArrival || prevStop.plannedArrival
          )?.getTime() || effectiveNowMs;
          const nextArrTime = parsePlkDate(
            nextStop.actualArrival || nextStop.plannedArrival || nextStop.actualDeparture || nextStop.plannedDeparture
          )?.getTime() || (effectiveNowMs + 600000);

          // Sprawdzenie czy pociąg faktycznie odjechał ze stacji, czy ma postój na peronie
          if (effectiveNowMs < prevDepTime) {
            // Postój na stacji (dwell time)
            trainLat = prevStation.lat;
            trainLng = prevStation.lng;
            estimatedSpeedKmh = 0;
            calculatedHeading = calculateBearing(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);
          } else {
            const totalDuration = Math.max(5000, nextArrTime - prevDepTime);
            const elapsed = Math.max(0, Math.min(totalDuration, effectiveNowMs - prevDepTime));
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
              trainLat = prevStation.lat + (nextStation.lat - prevStation.lat) * progressRatio;
              trainLng = prevStation.lng + (nextStation.lng - prevStation.lng) * progressRatio;
              calculatedHeading = calculateBearing(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);
            }

            const distanceMeters = calculateDistanceMeters(prevStation.lat, prevStation.lng, nextStation.lat, nextStation.lng);
            const segmentAvgKmh = Math.round((distanceMeters / (totalDuration / 1000)) * 3.6);
            const cruiseSpeed = getRealisticCruisingSpeed(category, carrierCode, segmentAvgKmh, trainId);

            // Płynna faza przyspieszania po stacji / hamowania przed kolejną stacją
            if (progressRatio < 0.08) {
              const accelFactor = 0.35 + 0.65 * (progressRatio / 0.08);
              estimatedSpeedKmh = Math.max(20, Math.round(cruiseSpeed * accelFactor));
            } else if (progressRatio > 0.92) {
              const decelFactor = 0.30 + 0.70 * ((1 - progressRatio) / 0.08);
              estimatedSpeedKmh = Math.max(15, Math.round(cruiseSpeed * decelFactor));
            } else {
              estimatedSpeedKmh = cruiseSpeed;
            }
          }
        } else if (prevStation) {
          trainLat = prevStation.lat;
          trainLng = prevStation.lng;
          estimatedSpeedKmh = 0;
        }
      } else if (lastVisitedIndex >= opStations.length - 1 && opStations.length > 0) {
        // Pociąg na stacji końcowej
        const lastSt = stationsById.get(opStations[opStations.length - 1].stationId);
        if (lastSt) {
          trainLat = lastSt.lat;
          trainLng = lastSt.lng;
        }
        estimatedSpeedKmh = 0;
      } else if (pathPoints.length > 0) {
        // Pociąg na stacji początkowej oczekujący na odjazd
        trainLat = pathPoints[0].lat;
        trainLng = pathPoints[0].lng;
        estimatedSpeedKmh = 0;
        if (pathPoints.length > 1) {
          calculatedHeading = calculateBearing(pathPoints[0].lat, pathPoints[0].lng, pathPoints[1].lat, pathPoints[1].lng);
        }
      }

      // Budowa szczegółowego rozkładu stacji i opóźnień (timetable)
      const timetable = [];
      const formatTime = (timeStr) => {
        if (!timeStr) return undefined;
        const d = parsePlkDate(timeStr);
        if (!d || isNaN(d.getTime())) return undefined;
        return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Warsaw' });
      };

      for (let i = 0; i < opStations.length; i++) {
        const st = opStations[i];
        const knownSt = stationsById.get(st.stationId);
        const stationName = getStationName(st.stationId);
        const delay = st.departureDelayMinutes ?? st.arrivalDelayMinutes ?? 0;

        let stopStatus = 'upcoming';
        if (i < lastVisitedIndex) {
          stopStatus = 'passed';
        } else if (i === lastVisitedIndex) {
          const depTime = parsePlkDate(st.actualDeparture || st.plannedDeparture)?.getTime() || effectiveNowMs;
          stopStatus = (effectiveNowMs < depTime) ? 'current' : 'passed';
        } else if (i === lastVisitedIndex + 1) {
          stopStatus = 'next';
        }

        timetable.push({
          stationId: st.stationId,
          stationName,
          lat: knownSt ? knownSt.lat : undefined,
          lng: knownSt ? knownSt.lng : undefined,
          plannedArrival: formatTime(st.plannedArrival),
          plannedDeparture: formatTime(st.plannedDeparture),
          actualArrival: formatTime(st.actualArrival),
          actualDeparture: formatTime(st.actualDeparture),
          delayMinutes: delay,
          isConfirmed: Boolean(st.isConfirmed),
          status: stopStatus,
        });
      }

      // Wzbogacenie pełnego korytarza pociągu o fizyczne tory
      const physicalFullPath = pathPoints.length > 1
        ? enrichPathWithPhysicalRails(pathPoints)
        : [{ lat: trainLat, lng: trainLng }];

      // Wyznacz dokładny indeks na fizycznej ścieżce (waypoint) dla płynnego dead-reckoningu
      let currentPathIndex = 0;
      if (physicalFullPath.length > 1) {
        let minDist = Infinity;
        for (let p = 0; p < physicalFullPath.length; p++) {
          const d = calculateDistanceMeters(trainLat, trainLng, physicalFullPath[p].lat, physicalFullPath[p].lng);
          if (d < minDist) {
            minDist = d;
            currentPathIndex = p;
          }
        }
      }

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
        speed: estimatedSpeedKmh > 0 ? Number((estimatedSpeedKmh / 3.6).toFixed(2)) : 0,
        heading: calculatedHeading,
        lastUpdate: nowMs,
        path: physicalFullPath,
        pathIndex: currentPathIndex,
        origin: originName,
        destination: destinationName,
        delayMinutes: delayMin,
        timetable,
      });
    }

    // 1. Łączenie składów sprzężonych (trakcja wielokrotna / ukrotniona)
    const mergedTrains = mergeConjoinedTrains(trains);

    // 2. Sortowanie według odległości od badanej stacji
    mergedTrains.sort((a, b) => {
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
      trains: mergedTrains,
      totalFound: mergedTrains.length,
      generatedAt: new Date().toISOString(),
      leadSeconds: Math.round(leadMs / 1000),
      cached: Boolean(rawCached),
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
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

server.listen(PORT, '0.0.0.0', () => {
  console.log(`SafeTracks PLK Proxy running on port ${PORT}`);
});
