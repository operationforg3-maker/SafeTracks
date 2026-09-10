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

  // Automatyczne ustawienie najbliższej stacji gdy GPS jest po raz pierwszy dostępny
  useEffect(() => {
    if (userPosition && !hasManuallyChosenStation.current) {
      const nearest = findNearestStation(userPosition.lat, userPosition.lng);
      if (!activeStationRef.current || activeStationRef.current.id !== nearest.id) {
        setActiveStationState(nearest);
      }
    } else if (!activeStationRef.current && !userPosition) {
      // Domyślna Warszawa Centralna do czasu złapania GPS
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
          // Zachowaj ciągły ruch jadących pociągów, aby nie cofać ich co 15 sekund
          const existingMap = new Map(prevTrains.map((t) => [t.id, t]));
          return response.trains.map((newTrain) => {
            const existing = existingMap.get(newTrain.id);
            if (existing && existing.path && existing.path.length > 1) {
              return {
                ...newTrain,
                currentPosition: existing.currentPosition,
                pathIndex: existing.pathIndex,
                heading: existing.heading,
                path: existing.path,
                speed: existing.speed,
              };
            }
            return newTrain;
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

  // Cykliczne odpytywanie serwera co 20 sekund
  useEffect(() => {
    const serverSyncInterval = setInterval(() => {
      fetchTrains();
    }, 20000);

    return () => clearInterval(serverSyncInterval);
  }, [fetchTrains]);

  // Ciągła, jedwabiście płynna mikro-interpolacja pozycji składów co 600ms (60 FPS feel)
  useEffect(() => {
    const deadReckoningInterval = setInterval(() => {
      setTrains((prevTrains) => {
        if (prevTrains.length === 0) return prevTrains;
        return advanceTrainsPosition(prevTrains, 0.6);
      });
    }, 600);

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
