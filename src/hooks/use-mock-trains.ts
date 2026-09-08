"use client";

import { useState, useEffect, useCallback } from 'react';
import { mockTrains as initialTrains } from '@/lib/data';
import type { Train } from '@/lib/types';
import { fetchLiveTrains } from '@/services/pkp-api';

export const useMockTrains = () => {
  const [trains, setTrains] = useState<Train[]>(initialTrains);

  const addSpottedTrain = useCallback((newTrain: Train) => {
    setTrains((prev) => [newTrain, ...prev.filter((t) => t.id !== newTrain.id)]);
  }, []);

  useEffect(() => {
    // Okresowe odpytywanie API PKP PLK / silnika predykcyjnego co 3.5 sekundy
    const interval = setInterval(async () => {
      try {
        setTrains((current) => {
          fetchLiveTrains(current).then((updated) => {
            setTrains(updated);
          });
          return current;
        });
      } catch (err) {
        console.warn('[useMockTrains] Błąd aktualizacji pozycji pociągów:', err);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return { trains, addSpottedTrain };
};

export const useLiveTrains = useMockTrains;
