import { Train, ProximityAlertState, AlertLevel } from '@/lib/types';
import { railwayCrossings } from '@/lib/data';
import { calculateDistanceMeters, findNearestStation, isTrainApproaching, GeocodedStation } from './pkp-api';
import { alertAudio } from './alert-audio';
import { getStoredGeofenceRadius } from './geofence-settings';

export interface UserCoordinates {
  lat: number;
  lng: number;
}

/**
 * Silnik bezpieczeństwa SafeTracks v3.
 *
 * ZASADA: alarm wyzwala się TYLKO gdy spełnione są OBA warunki jednocześnie:
 *   1. Użytkownik jest blisko infrastruktury kolejowej (torów / przejazdu / stacji)
 *   2. Pociąg zbliża się na tych torach w strefie geofencingu
 *
 * Sama bliskość pociągu BEZ bliskości torów = brak alarmu.
 * Użytkownik 2 km od torów nie dostanie alarmu nawet jeśli pociąg jedzie 100m równolegle.
 */
export function evaluateProximitySafety(
  userPos: UserCoordinates | undefined,
  trains: Train[],
  alertMuted = false,
  activeStation?: GeocodedStation | null,
  customGeofenceRadius?: number
): ProximityAlertState {
  if (!userPos) {
    return {
      level: 'safe',
      isInsideHazardZone: false,
      message: 'Oczekiwanie na sygnał GPS...',
    };
  }

  const geofenceRadius = customGeofenceRadius || getStoredGeofenceRadius();

  // ─── 1. Odległość użytkownika od infrastruktury kolejowej ───
  let minInfraDist = Infinity;

  // Przejazdy i dzikie przejścia
  for (const crossing of railwayCrossings) {
    const dist = calculateDistanceMeters(
      userPos.lat, userPos.lng,
      crossing.location.lat, crossing.location.lng
    );
    if (dist < minInfraDist) {
      minInfraDist = dist;
    }
  }

  // Stacje PKP PLK (reprezentują oś torowiska)
  const nearestPLKStation = activeStation || findNearestStation(userPos.lat, userPos.lng);
  if (nearestPLKStation) {
    const distToStation = calculateDistanceMeters(
      userPos.lat, userPos.lng,
      nearestPLKStation.lat, nearestPLKStation.lng
    );
    if (distToStation < minInfraDist) {
      minInfraDist = distToStation;
    }
  }

  // ─── WARUNEK KONIECZNY: czy user jest w pobliżu torów? ───
  const userNearTracks = minInfraDist <= geofenceRadius;

  // Jeśli user jest daleko od jakiejkolwiek infrastruktury kolejowej → SAFE, koniec.
  if (!userNearTracks) {
    return {
      level: 'safe',
      isInsideHazardZone: false,
      message: 'Bezpiecznie — brak torowiska w pobliżu.',
    };
  }

  // ─── 2. User jest blisko torów — szukamy zagrożeń pociągowych ───
  let mostCriticalTrain: Train | null = null;
  let minTrainDist = Infinity;
  let minEtaSeconds = Infinity;
  let hasApproachingInZone = false;

  for (const train of trains) {
    const dist = calculateDistanceMeters(
      userPos.lat, userPos.lng,
      train.currentPosition.lat, train.currentPosition.lng
    );

    const speed = Math.max(train.speed, 8);
    const eta = dist / speed;

    const approaching = isTrainApproaching(
      userPos.lat, userPos.lng,
      train.currentPosition.lat, train.currentPosition.lng,
      train.heading || 0
    );

    // Pociąg kwalifikuje się do alarmu jeśli jest w strefie geofencingu
    const inZone = dist <= geofenceRadius;
    const imminentlyApproaching = dist <= geofenceRadius * 1.2 && approaching && eta <= 30;

    if (inZone || imminentlyApproaching) {
      if (eta < minEtaSeconds || !mostCriticalTrain) {
        minEtaSeconds = eta;
        minTrainDist = dist;
        mostCriticalTrain = train;
        if (approaching) hasApproachingInZone = true;
      }
    }

    if (dist < minTrainDist && !mostCriticalTrain) {
      minTrainDist = dist;
    }
  }

  // User jest przy torach ale żaden pociąg nie jest w strefie
  if (!mostCriticalTrain) {
    return {
      level: 'safe',
      isInsideHazardZone: true,
      distanceMeters: minTrainDist !== Infinity ? Math.round(minTrainDist) : undefined,
      message: 'Jesteś w pobliżu torowiska. Brak pociągów w strefie.',
    };
  }

  // ─── 3. Klasyfikacja zagrożenia ───
  const trainLabel = mostCriticalTrain.name
    ? `${mostCriticalTrain.id} "${mostCriticalTrain.name}"`
    : mostCriticalTrain.id;

  let level: AlertLevel = 'safe';
  let message = '';

  // KRYTYCZNY: pociąg bardzo blisko LUB zbliża się w < 15s
  if (minTrainDist <= geofenceRadius * 0.5 || (hasApproachingInZone && minEtaSeconds <= 15)) {
    level = 'critical';
    message = `UWAGA! ${trainLabel} — ${Math.round(minTrainDist)}m (ETA ${Math.round(minEtaSeconds)}s)! OPUŚĆ TOROWISKO!`;

    if (!alertMuted) {
      alertAudio.playCriticalAlarm();
    }
  }
  // OSTRZEGAWCZY: pociąg w strefie
  else if (minTrainDist <= geofenceRadius || (hasApproachingInZone && minEtaSeconds <= 30)) {
    level = 'warning';
    message = `Pociąg ${trainLabel} — ${Math.round(minTrainDist)}m, ETA ~${Math.round(minEtaSeconds)}s`;

    if (!alertMuted) {
      alertAudio.playWarningSound();
    }
  }

  return {
    level,
    nearestTrain: mostCriticalTrain || undefined,
    distanceMeters: Math.round(minTrainDist),
    estimatedTimeToArrivalSeconds: minEtaSeconds !== Infinity ? Math.round(minEtaSeconds) : undefined,
    isInsideHazardZone: true,
    message,
  };
}
