import { Train, ProximityAlertState, AlertLevel } from '@/lib/types';
import { railwayCrossings } from '@/lib/data';
import { calculateDistanceMeters, findNearestStation, isTrainApproaching, GeocodedStation } from './pkp-api';
import { alertAudio } from './alert-audio';

export interface UserCoordinates {
  lat: number;
  lng: number;
}

/**
 * Analizuje odległość i wektory ruchu rzeczywistych pociągów względem użytkownika.
 * Zwraca status zagrożenia i w razie potrzeby wyzwala sygnalizację alarmową.
 */
export function evaluateProximitySafety(
  userPos: UserCoordinates | undefined,
  trains: Train[],
  alertMuted = false,
  activeStation?: GeocodedStation | null
): ProximityAlertState {
  if (!userPos) {
    return {
      level: 'safe',
      isInsideHazardZone: false,
      message: 'Oczekiwanie na sygnał GPS telefonu...',
    };
  }

  // 1. Sprawdź czy pieszy znajduje się w bezpośredniej strefie torowiska / przejazdu / posterunku
  let nearestCrossingDistance = Infinity;
  let nearestHazardName = '';

  // Sprawdź zgłoszone przejazdy
  for (const crossing of railwayCrossings) {
    const dist = calculateDistanceMeters(
      userPos.lat,
      userPos.lng,
      crossing.location.lat,
      crossing.location.lng
    );
    if (dist < nearestCrossingDistance) {
      nearestCrossingDistance = dist;
      nearestHazardName = crossing.name;
    }
  }

  // Sprawdź posterunek kolejowy PLK
  const nearestPLKStation = activeStation || findNearestStation(userPos.lat, userPos.lng);
  const distToStation = calculateDistanceMeters(userPos.lat, userPos.lng, nearestPLKStation.lat, nearestPLKStation.lng);

  if (distToStation < nearestCrossingDistance) {
    nearestCrossingDistance = distToStation;
    nearestHazardName = `Stacja / Posterunek: ${nearestPLKStation.name}`;
  }

  // Pieszy jest w strefie torowiska jeśli jest w promieniu 350m od posterunku/przejazdu lub w promieniu 400m od pociągu
  let isInsideHazardZone = nearestCrossingDistance <= 350;

  // 2. Analiza zbliżających się pociągów
  let mostCriticalTrain: Train | null = null;
  let minEtaSeconds = Infinity;
  let minDistanceMeters = Infinity;

  for (const train of trains) {
    const dist = calculateDistanceMeters(
      userPos.lat,
      userPos.lng,
      train.currentPosition.lat,
      train.currentPosition.lng
    );

    if (dist < minDistanceMeters) {
      minDistanceMeters = dist;
    }

    if (dist <= 400) {
      isInsideHazardZone = true;
    }

    const speed = Math.max(train.speed, 8); // min 8 m/s (~30 km/h)
    const etaSeconds = dist / speed;

    // Sprawdź czy skład faktycznie porusza się W KIERUNKU pieszego
    const approaching = isTrainApproaching(
      userPos.lat,
      userPos.lng,
      train.currentPosition.lat,
      train.currentPosition.lng,
      train.heading || 0
    );

    // Alarmujemy o zbliżających się pociągach lub pociągach w bezpośredniej odległości < 60m
    if (approaching || dist < 60) {
      if (etaSeconds < minEtaSeconds) {
        minEtaSeconds = etaSeconds;
        mostCriticalTrain = train;
      }
    }
  }

  // 3. Klasyfikacja poziomu alarmowego
  let level: AlertLevel = 'safe';
  let message = 'Tory i szlaki w bezpiecznej odległości.';

  if (mostCriticalTrain) {
    const trainLabel = mostCriticalTrain.name
      ? `${mostCriticalTrain.id} "${mostCriticalTrain.name}"`
      : mostCriticalTrain.id;

    // Poziom krytyczny: pociąg zbliża się w czasie < 35 sekund lub jest < 250 metrów
    if (minEtaSeconds <= 35 || (isInsideHazardZone && minDistanceMeters <= 250)) {
      level = 'critical';
      message = `UWAGA! Nadjeżdża ${trainLabel}! ETA: ${Math.round(minEtaSeconds)}s (~${Math.round(minDistanceMeters)}m)! NATYCHMIAST OPUŚĆ TOROWISKO!`;

      if (!alertMuted) {
        alertAudio.playCriticalAlarm();
      }
    } else if (minEtaSeconds <= 120 || (isInsideHazardZone && minDistanceMeters <= 800)) {
      level = 'warning';
      const etaMin = Math.max(1, Math.round(minEtaSeconds / 60));
      message = `Zbliża się pociąg ${trainLabel} (odległość ${Math.round(minDistanceMeters)}m, ETA ~${etaMin} min). Zachowaj szczególną ostrożność.`;

      if (!alertMuted) {
        alertAudio.playWarningSound();
      }
    } else if (isInsideHazardZone) {
      message = `Jesteś w pobliżu torów (${Math.round(nearestCrossingDistance)}m - ${nearestHazardName}). Radar aktywny.`;
    }
  } else if (isInsideHazardZone) {
    message = `Jesteś w strefie torowiska (${nearestHazardName}). W promieniu 2 km brak zbliżających się pociągów.`;
  }

  return {
    level,
    nearestTrain: mostCriticalTrain || undefined,
    distanceMeters: minDistanceMeters !== Infinity ? Math.round(minDistanceMeters) : undefined,
    estimatedTimeToArrivalSeconds: minEtaSeconds !== Infinity ? Math.round(minEtaSeconds) : undefined,
    isInsideHazardZone,
    message,
  };
}
