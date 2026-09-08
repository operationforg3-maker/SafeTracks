"use client";

import { useState, useEffect } from 'react';
import { mockTrains as initialTrains } from '@/lib/data';
import type { Train } from '@/lib/types';
import { fetchLiveTrains } from '@/services/pkp-api';

export const useMockTrains = () => {
  const [trains, setTrains] = useState<Train[]>(initialTrains);

  useEffect(() => {
    // Okresowe odpytywanie API PKP PLK / silnika predykcyjnego co 4 sekundy
    const interval = setInterval(async () => {
      try {
        setTrains((current) => {
          // Asynchroniczne wywołanie z zachowaniem płynności
          fetchLiveTrains(current).then((updated) => {
            setTrains(updated);
          });
          return current;
        });
      } catch (err) {
        console.warn('[useMockTrains] Błąd aktualizacji pozycji pociągów:', err);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return trains;
};

export const useLiveTrains = useMockTrains;
