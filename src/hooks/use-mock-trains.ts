"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Train } from '@/lib/types';
import {
  fetchLiveStationTrains,
  findNearestStation,
  advanceTrainsPosition,
  GeocodedStation,
  allStations,
} from '@/services/pkp-api';
import type { Position } from './use-geolocation';

export interface UseLiveTrainsReturn {
  trains: Train[];
  activeStation: GeocodedStation | null;
  setActiveStation: (st: GeocodedStation) => void;
  isLoading: boolean;
  lastSync: Date | null;
  refreshNow: () => Promise<void>;
  addSpottedTrain: (newTrain: Train) => void;
}

export const useMockTrains = (userPosition?: Position): UseLiveTrainsReturn => {
  const [trains, setTrains] = useState<Train[]>([]);
  const [activeStation, setActiveStationState] = useState<GeocodedStation | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const hasManuallyChosenStation = useRef<boolean>(false);
  const activeStationRef = useRef<GeocodedStation | null>(null);
  activeStationRef.current = activeStation;

  const setActiveStation = useCallback((st: GeocodedStation) => {
    hasManuallyChosenStation.current = true;
    setActiveStationState(st);
  }, []);

  const hasSetInitialGpsStationRef = useRef<boolean>(false);

  // Automatyczne ustawienie najbliższej stacji gdy GPS jest po raz pierwszy dostępny,
  // oraz auto-przełączanie gdy użytkownik przemieści się >3km od aktywnej stacji
  useEffect(() => {
    if (userPosition && !hasManuallyChosenStation.current) {
      const nearest = findNearestStation(userPosition.lat, userPosition.lng);

      // Pierwsza lokalizacja z GPS natychmiast ustawia rzeczywistą najbliższą stację użytkownika
      if (!hasSetInitialGpsStationRef.current) {
        hasSetInitialGpsStationRef.current = true;
        setActiveStationState(nearest);
        return;
      }

      // Kolejne aktualizacje w trakcie jazdy: auto-switch po pokonaniu >3km
      const current = activeStationRef.current;
      if (current && current.id !== nearest.id) {
        const distFromCurrent = Math.sqrt(
          ((userPosition.lat - current.lat) * 111139) ** 2 +
          ((userPosition.lng - current.lng) * 111139 * Math.cos((userPosition.lat * Math.PI) / 180)) ** 2
        );
        if (distFromCurrent > 3000) {
          setActiveStationState(nearest);
        }
      }
    } else if (!activeStationRef.current && !userPosition) {
      // Domyślna Warszawa Centralna tylko do czasu złapania GPS
      const defaultSt = allStations.find((s) => s.name === 'Warszawa Centralna') || allStations[0];
      setActiveStationState(defaultSt);
    }
  }, [userPosition]);

  // Funkcja pobierania świeżych danych z serwera PKP PLK dla aktywnej stacji
  const fetchTrains = useCallback(async () => {
    const currentSt = activeStationRef.current;
    if (!currentSt) return;

    setIsLoading(true);
    try {
      const response = await fetchLiveStationTrains(currentSt.id, userPosition);
      if (response && response.trains) {
        setTrains((prevTrains) => {
          if (prevTrains.length === 0) {
            return response.trains;
          }
          const existingMap = new Map(prevTrains.map((t) => [t.id, t]));
          return response.trains.map((newTrain) => {
            const existing = existingMap.get(newTrain.id);
            if (!existing) return newTrain;

            // Oblicz różnicę odległości między lokalną estymacją a świeżą telemetrią z serwera
            const dLat = (newTrain.currentPosition.lat - existing.currentPosition.lat) * 111139;
            const dLng =
              (newTrain.currentPosition.lng - existing.currentPosition.lng) *
              111139 *
              Math.cos((existing.currentPosition.lat * Math.PI) / 180);
            const distMeters = Math.sqrt(dLat * dLat + dLng * dLng);

            // Jeśli pociąg stoi lub nastąpił przeskok/drift > 70m (np. minięcie stacji lub wybudzenie telefonu z tła):
            // natychmiast zaadoptuj rzeczywistą pozycję z serwera
            if (newTrain.speed === 0 || distMeters > 70) {
              return newTrain;
            }

            // W ruchu płynnym: łagodnie pociągnij (blend 70%) pozycję w stronę serwera, eliminując jakiekolwiek opóźnienie
            const blendedLat = existing.currentPosition.lat * 0.3 + newTrain.currentPosition.lat * 0.7;
            const blendedLng = existing.currentPosition.lng * 0.3 + newTrain.currentPosition.lng * 0.7;

            return {
              ...newTrain,
              currentPosition: {
                lat: Number(blendedLat.toFixed(5)),
                lng: Number(blendedLng.toFixed(5)),
              },
              pathIndex: newTrain.pathIndex,
              heading: newTrain.heading,
              path: newTrain.path && newTrain.path.length > 2 ? newTrain.path : existing.path,
            };
          });
        });
        setLastSync(new Date());
      }
    } catch (err) {
      console.warn('[useLiveTrains] Błąd pobierania danych ze stacji:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userPosition]);



  // Pobranie przy zmianie aktywnej stacji
  useEffect(() => {
    if (activeStation) {
      fetchTrains();
    }
  }, [activeStation, fetchTrains]);

  // Cykliczne odpytywanie serwera co 6 sekund dla maksymalnej dokładności live
  useEffect(() => {
    const serverSyncInterval = setInterval(() => {
      fetchTrains();
    }, 6000);

    return () => clearInterval(serverSyncInterval);
  }, [fetchTrains]);

  // Ciągła, jedwabiście płynna mikro-interpolacja pozycji składów co 500ms
  // z rzeczywistym czasem delta, chroniącym przed lagiem w uśpionych kartach
  useEffect(() => {
    let lastTick = performance.now();
    const deadReckoningInterval = setInterval(() => {
      const now = performance.now();
      const deltaSeconds = Math.min(2.0, Math.max(0.1, (now - lastTick) / 1000));
      lastTick = now;

      setTrains((prevTrains) => {
        if (prevTrains.length === 0) return prevTrains;
        return advanceTrainsPosition(prevTrains, deltaSeconds);
      });
    }, 500);

    return () => clearInterval(deadReckoningInterval);
  }, []);

  const addSpottedTrain = useCallback((newTrain: Train) => {
    setTrains((prev) => [newTrain, ...prev.filter((t) => t.id !== newTrain.id)]);
  }, []);

  return {
    trains,
    activeStation,
    setActiveStation,
    isLoading,
    lastSync,
    refreshNow: fetchTrains,
    addSpottedTrain,
  };
};

export const useLiveTrains = useMockTrains;
