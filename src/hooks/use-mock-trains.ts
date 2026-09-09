"use client";

import { useState, useEffect, useCallback } from 'react';
import type { Train } from '@/lib/types';
import { fetchLiveTrains, initialPlkTrains } from '@/services/pkp-api';

export const useMockTrains = () => {
  const [trains, setTrains] = useState<Train[]>(initialPlkTrains);

  const addSpottedTrain = useCallback((newTrain: Train) => {
    setTrains((prev) => [newTrain, ...prev.filter((t) => t.id !== newTrain.id)]);
  }, []);

  useEffect(() => {
    // Okresowe odpytywanie i interpolacja ruchu pociągów po szlakach co 3.5 sekundy
    const interval = setInterval(async () => {
      try {
        setTrains((current) => {
          fetchLiveTrains(current).then((updated) => {
            setTrains(updated);
          });
          return current;
        });
      } catch (err) {
        console.warn('[useLiveTrains] Błąd aktualizacji pozycji pociągów:', err);
      }
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return { trains, addSpottedTrain };
};

export const useLiveTrains = useMockTrains;
