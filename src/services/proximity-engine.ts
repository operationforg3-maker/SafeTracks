import { Train, ProximityAlertState, AlertLevel } from '@/lib/types';
import { railwayCrossings } from '@/lib/data';
import { calculateDistanceMeters, calculateBearing } from './pkp-api';
import { alertAudio } from './alert-audio';

export interface UserCoordinates {
  lat: number;
  lng: number;
}

/**
 * Analizuje odległość i wektory ruchu pociągów względem użytkownika.
 * Zwraca status zagrożenia i w razie potrzeby wyzwala sygnalizację alarmową.
 */
export function evaluateProximitySafety(
  userPos: UserCoordinates | undefined,
  trains: Train[],
  alertMuted = false
): ProximityAlertState {
  if (!userPos) {
    return {
      level: 'safe',
      isInsideHazardZone: false,
      message: 'Oczekiwanie na sygnał GPS...',
    };
  }

  // 1. Sprawdź czy użytkownik znajduje się w strefie torowiska / dzikiego przejścia (< 200m)
  let nearestCrossingDistance = Infinity;
  let nearestCrossingName = '';
  let isNearWildCrossing = false;

  for (const crossing of railwayCrossings) {
    const dist = calculateDistanceMeters(
      userPos.lat,
      userPos.lng,
      crossing.location.lat,
      crossing.location.lng
    );
    if (dist < nearestCrossingDistance) {
      nearestCrossingDistance = dist;
      nearestCrossingName = crossing.name;
      isNearWildCrossing = Boolean(crossing.isWildCrossing);
    }
  }

  const isInsideHazardZone = nearestCrossingDistance <= 250;

  // 2. Znajdź najbardziej zagrażający pociąg (najkrótszy czas do przyjazdu / najmniejsza odległość)
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

    const speed = Math.max(train.speed, 5); // min 5 m/s
    const etaSeconds = dist / speed;

    // Sprawdź czy pociąg faktycznie zbliża się do pieszego (odległość maleje)
    const isApproaching = train.heading !== undefined
      ? (calculateBearing(train.currentPosition.lat, train.currentPosition.lng, userPos.lat, userPos.lng) - train.heading + 360) % 360
      : 0;
    const isMovingTowards = isApproaching <= 90 || isApproaching >= 270;

    if (dist < minDistanceMeters) {
      minDistanceMeters = dist;
    }

    // Alarmujemy tylko o pociągach, które zbliżają się (lub są w bezpośredniej strefie kolizyjnej < 50m)
    if (isMovingTowards || dist < 50) {
      if (etaSeconds < minEtaSeconds) {
        minEtaSeconds = etaSeconds;
        mostCriticalTrain = train;
      }
    }
  }

  // 3. Klasyfikacja poziomu alarmowego
  let level: AlertLevel = 'safe';
  let message = 'Tory w bezpiecznej odległości.';

  if (mostCriticalTrain) {
    // Krytyczny: Pociąg < 35 sekund lub < 250m w strefie torowiska
    if (minEtaSeconds <= 35 || (isInsideHazardZone && minDistanceMeters <= 400)) {
      level = 'critical';
      message = `UWAGA! Nadjeżdża ${mostCriticalTrain.name || mostCriticalTrain.id}! ETA: ${Math.round(minEtaSeconds)}s! ZEJJDŹ Z TORÓW!`;

      if (!alertMuted) {
        alertAudio.playCriticalAlarm();
      }
    } else if (minEtaSeconds <= 120 || (isInsideHazardZone && minDistanceMeters <= 1000)) {
      level = 'warning';
      message = `Zbliża się pociąg ${mostCriticalTrain.name || mostCriticalTrain.id} (${Math.round(minDistanceMeters)}m, ~${Math.round(minEtaSeconds / 60)} min). Zachowaj ostrożność.`;

      if (!alertMuted) {
        alertAudio.playWarningSound();
      }
    } else if (isInsideHazardZone) {
      message = `Jesteś blisko torów (${Math.round(nearestCrossingDistance)}m - ${nearestCrossingName}).`;
    }
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
