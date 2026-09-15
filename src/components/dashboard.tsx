"use client";

import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrainCard } from '@/components/train-card';
import type { Train } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { WifiOff, Radio, RefreshCw, Search, Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { calculateDistanceMeters, isTrainApproaching, GeocodedStation } from '@/services/pkp-api';
import { useGeofenceRadius } from '@/services/geofence-settings';

interface DashboardProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
  onOpenSpotDialog?: () => void;
  activeStation?: GeocodedStation | null;
  onOpenStationSearch?: () => void;
  isLoading?: boolean;
  lastSync?: Date | null;
  onRefresh?: () => void;
}

export function Dashboard({
  trains,
  enthusiastMode,
  onTrainSelect,
  activeStation,
  onOpenStationSearch,
  isLoading,
  onRefresh,
}: DashboardProps) {
  const { position, error: geoError } = useGeolocation();
  const [geofenceRadius] = useGeofenceRadius();

  // Sortowanie: w strefie > zbliżające się > reszta (stabilne z bucketing)
  const sortedTrains = useMemo(() => {
    let list = [...trains];

    if (position) {
      // Filtruj do max 30 minut horyzontu
      list = list.filter((t) => {
        const dist = calculateDistanceMeters(position.lat, position.lng, t.currentPosition.lat, t.currentPosition.lng);
        const speed = Math.max(t.speed, 8);
        return dist / speed <= 1800; // 30 min
      });

      list.sort((a, b) => {
        const distA = calculateDistanceMeters(position.lat, position.lng, a.currentPosition.lat, a.currentPosition.lng);
        const distB = calculateDistanceMeters(position.lat, position.lng, b.currentPosition.lat, b.currentPosition.lng);

        // W strefie geofencingu
        const inA = distA <= geofenceRadius;
        const inB = distB <= geofenceRadius;
        if (inA && !inB) return -1;
        if (!inA && inB) return 1;

        // Zbliżające się
        const appA = isTrainApproaching(position.lat, position.lng, a.currentPosition.lat, a.currentPosition.lng, a.heading || 0);
        const appB = isTrainApproaching(position.lat, position.lng, b.currentPosition.lat, b.currentPosition.lng, b.heading || 0);
        if (appA && !appB) return -1;
        if (!appA && appB) return 1;

        // Bucketing co 200m
        const bucketA = Math.floor(distA / 200);
        const bucketB = Math.floor(distB / 200);
        if (bucketA !== bucketB) return bucketA - bucketB;

        return a.id.localeCompare(b.id);
      });
    }

    return list;
  }, [trains, position, geofenceRadius]);

  const stationDistKm = useMemo(() => {
    if (!position || !activeStation) return null;
    return (calculateDistanceMeters(position.lat, position.lng, activeStation.lat, activeStation.lng) / 1000).toFixed(1);
  }, [position, activeStation]);

  return (
    <div className="flex h-full flex-col bg-card/95 backdrop-blur-sm">
      {/* Compact header */}
      <div className="p-2.5 sm:p-3 border-b space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-sm font-bold">Radar</h2>
            <Badge variant="secondary" className="font-mono text-[10px] h-5 px-1.5">
              {sortedTrains.length}
            </Badge>
          </div>

          <div className="flex items-center gap-1">
            {onRefresh && (
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Station info — single line */}
        {activeStation && (
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate min-w-0">
              <Radio className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="font-medium text-foreground truncate">{activeStation.name}</span>
              {stationDistKm && <span className="font-mono text-[10px] shrink-0">({stationDistKm} km)</span>}
            </div>
            {onOpenStationSearch && (
              <button
                onClick={onOpenStationSearch}
                className="text-primary text-[10px] font-semibold hover:underline shrink-0 ml-2"
              >
                Zmień
              </button>
            )}
          </div>
        )}
      </div>

      {/* Train list */}
      <ScrollArea className="flex-1">
        <div className="p-2.5 sm:p-3 space-y-1.5">
          {isLoading && sortedTrains.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center">
              <Loader2 className="w-6 h-6 mb-2 animate-spin text-primary" />
              <p className="text-xs">Łączenie z PKP PLK...</p>
            </div>
          ) : sortedTrains.length > 0 ? (
            sortedTrains.map((train) => (
              <TrainCard
                key={train.id}
                train={train}
                userPosition={position}
                enthusiastMode={enthusiastMode}
                onSelect={onTrainSelect}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-center">
              <WifiOff className="w-6 h-6 mb-2 opacity-50" />
              <p className="text-xs">Brak pociągów w zasięgu.</p>
              {onOpenStationSearch && (
                <Button variant="outline" size="sm" className="text-[11px] h-7 mt-2" onClick={onOpenStationSearch}>
                  Zmień stację
                </Button>
              )}
            </div>
          )}

          {geoError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-[11px] text-destructive">
              <span>📍 Włącz GPS aby aktywować ostrzeganie.</span>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
