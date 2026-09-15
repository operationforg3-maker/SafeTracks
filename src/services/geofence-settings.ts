"use client";

import { useState, useEffect, useCallback } from 'react';

export const GEOFENCE_RADIUS_KEY = 'safetracks_geofence_radius';
export const DEFAULT_GEOFENCE_RADIUS = 150; // Domyślnie 150m (bezpieczna odległość pieszego)

export function getStoredGeofenceRadius(): number {
  if (typeof window === 'undefined') return DEFAULT_GEOFENCE_RADIUS;
  const stored = localStorage.getItem(GEOFENCE_RADIUS_KEY);
  if (!stored) return DEFAULT_GEOFENCE_RADIUS;
  const val = parseInt(stored, 10);
  return isNaN(val) ? DEFAULT_GEOFENCE_RADIUS : Math.max(50, Math.min(1000, val));
}

export function setStoredGeofenceRadius(radius: number): void {
  if (typeof window === 'undefined') return;
  const clamped = Math.max(50, Math.min(1000, Math.round(radius)));
  localStorage.setItem(GEOFENCE_RADIUS_KEY, String(clamped));
  window.dispatchEvent(new CustomEvent('safetracks_geofence_change', { detail: clamped }));
}

/**
 * React hook zapewniający zsynchronizowany, reaktywny promień strefy ostrzegawczej w całej aplikacji.
 */
export function useGeofenceRadius(): [number, (radius: number) => void] {
  const [radius, setRadius] = useState<number>(getStoredGeofenceRadius);

  useEffect(() => {
    const handleSync = (e: Event) => {
      const customEvent = e as CustomEvent<number>;
      if (typeof customEvent.detail === 'number') {
        setRadius(customEvent.detail);
      } else {
        setRadius(getStoredGeofenceRadius());
      }
    };

    window.addEventListener('safetracks_geofence_change', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('safetracks_geofence_change', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  const updateRadius = useCallback((newRadius: number) => {
    setRadius(newRadius);
    setStoredGeofenceRadius(newRadius);
  }, []);

  return [radius, updateRadius];
}
