"use client";

import { useState, useEffect } from 'react';

export type Position = {
  lat: number;
  lng: number;
};

export const useGeolocation = (options?: PositionOptions) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<GeolocationPositionError>();
  const [position, setPosition] = useState<Position>();

  useEffect(() => {
    let isMounted = true;

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000,
      ...options,
    };

    const successHandler: PositionCallback = (pos) => {
      if (isMounted) {
        setLoading(false);
        setError(undefined);
        setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      }
    };

    const errorHandler: PositionErrorCallback = (err) => {
      if (isMounted) {
        setLoading(false);
        setError(err);
      }
    };

    if (!navigator.geolocation) {
      setError({
        code: 0,
        message: "Geolocation is not supported by your browser.",
        PERMISSION_DENIED: 1,
        POSITION_UNAVAILABLE: 2,
        TIMEOUT: 3
      });
      setLoading(false);
      return;
    }

    // Natychmiastowe jednorazowe pobranie pozycji dla szybkiego wycentrowania mapy
    navigator.geolocation.getCurrentPosition(successHandler, errorHandler, defaultOptions);

    // Ciągłe śledzenie pozycji GPS (np. podczas spaceru w stronę torów)
    const id = navigator.geolocation.watchPosition(successHandler, errorHandler, defaultOptions);

    return () => {
      isMounted = false;
      navigator.geolocation.clearWatch(id);
    };
  }, [options]);

  return { loading, error, position };
};
