"use client";

import { useState, useEffect, useRef } from 'react';

export type Position = {
  lat: number;
  lng: number;
};

const STORAGE_KEY = 'safetracks_last_position';

export const useGeolocation = (options?: PositionOptions) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<GeolocationPositionError | Error>();
  const [position, setPosition] = useState<Position | undefined>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (typeof parsed?.lat === 'number' && typeof parsed?.lng === 'number') {
            return { lat: parsed.lat, lng: parsed.lng };
          }
        }
      } catch {}
    }
    return undefined;
  });

  const hasReceivedFreshGpsRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    let watchId: number | null = null;
    let fallbackTimer: NodeJS.Timeout | null = null;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError(new Error("Geolocation is not supported by your browser."));
      setLoading(false);
      return;
    }

    const saveAndSetPosition = (coords: { latitude: number; longitude: number }) => {
      if (!isMounted) return;
      hasReceivedFreshGpsRef.current = true;
      const newPos = { lat: coords.latitude, lng: coords.longitude };
      setPosition(newPos);
      setLoading(false);
      setError(undefined);

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newPos));
      } catch {}
    };

    // 1. Próba pobrania lokalizacji standardowej (szybka lokalizacja z sieci Wi-Fi/IP/Cell)
    // Daje natychmiastowe współrzędne w ułamku sekundy
    navigator.geolocation.getCurrentPosition(
      (pos) => saveAndSetPosition(pos.coords),
      (err) => {
        // Ignoruj błąd wstępny - watchPosition nadal próbuje
        console.warn('[Geo Fast Initial Warning]:', err.message);
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );

    // 2. Precyzyjne śledzenie z wysoką dokładnością (GPS satelitarny / obwody torowe)
    const highAccuracyOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
      ...options,
    };

    watchId = navigator.geolocation.watchPosition(
      (pos) => saveAndSetPosition(pos.coords),
      (err) => {
        if (!isMounted) return;
        console.warn('[Geo Watch Error]:', err.code, err.message);
        // Jeśli nie mamy jeszcze żadnej pozycji, spróbuj zapasowego odpytania o małej dokładności
        if (!hasReceivedFreshGpsRef.current) {
          navigator.geolocation.getCurrentPosition(
            (pos) => saveAndSetPosition(pos.coords),
            (fallbackErr) => {
              if (isMounted && !hasReceivedFreshGpsRef.current) {
                setError(fallbackErr);
                setLoading(false);
              }
            },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
          );
        }
      },
      highAccuracyOptions
    );

    // 3. Fallback bezpieczeństwa: jeśli po 3 sekundach brak świeżej pozycji, ponów zapytanie standardowe
    fallbackTimer = setTimeout(() => {
      if (!hasReceivedFreshGpsRef.current && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => saveAndSetPosition(pos.coords),
          () => {},
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
        );
      }
    }, 3000);

    return () => {
      isMounted = false;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (fallbackTimer !== null) clearTimeout(fallbackTimer);
    };
  }, [options]);

  return { loading, error, position };
};
