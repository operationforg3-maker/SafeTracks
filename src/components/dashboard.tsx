"use client";

import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrainCard } from '@/components/train-card';
import type { Train } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { AlertCircle, WifiOff, MapPin, PackageCheck, Radio, RefreshCw, Search, Loader2 } from 'lucide-react';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { calculateDistanceMeters, isTrainApproaching, GeocodedStation } from '@/services/pkp-api';

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
  onOpenSpotDialog,
  activeStation,
  onOpenStationSearch,
  isLoading,
  lastSync,
  onRefresh,
}: DashboardProps) {
  const { position, error: geoError } = useGeolocation();
  const [timeWindow, setTimeWindow] = useState([30]);
  const [operatorFilter, setOperatorFilter] = useState<string>('all');

  // Filtrowanie i sortowanie pociągów
  const sortedAndFilteredTrains = useMemo(() => {
    let list = [...trains];

    if (operatorFilter !== 'all') {
      list = list.filter((t) => {
        if (operatorFilter === 'cargo') return t.type.toLowerCase() === 'cargo';
        if (operatorFilter === 'ic') return t.type.toLowerCase() === 'eip' || t.type.toLowerCase() === 'ic' || t.type.toLowerCase() === 'tlk';
        if (operatorFilter === 'regional') return t.type.toLowerCase() === 'km' || t.type.toLowerCase() === 'polregio' || t.type.toLowerCase() === 'kd' || t.type.toLowerCase() === 'ks' || t.type.toLowerCase() === 'wkd';
        return t.type.toLowerCase() === operatorFilter.toLowerCase() || t.operator?.toLowerCase().includes(operatorFilter.toLowerCase());
      });
    }

    if (position) {
      const maxSeconds = timeWindow[0] * 60;
      list = list.filter((t) => {
        const dist = calculateDistanceMeters(position.lat, position.lng, t.currentPosition.lat, t.currentPosition.lng);
        const speed = Math.max(t.speed, 8);
        const eta = dist / speed;
        return eta <= maxSeconds;
      });

      list.sort((a, b) => {
        const aApproaching = isTrainApproaching(position.lat, position.lng, a.currentPosition.lat, a.currentPosition.lng, a.heading || 0);
        const bApproaching = isTrainApproaching(position.lat, position.lng, b.currentPosition.lat, b.currentPosition.lng, b.heading || 0);

        // Zbliżające się pociągi ZAWSZE na samej górze radaru
        if (aApproaching && !bApproaching) return -1;
        if (!aApproaching && bApproaching) return 1;

        const distA = calculateDistanceMeters(position.lat, position.lng, a.currentPosition.lat, a.currentPosition.lng);
        const distB = calculateDistanceMeters(position.lat, position.lng, b.currentPosition.lat, b.currentPosition.lng);
        return distA - distB;
      });
    }

    return list;
  }, [trains, operatorFilter, position, timeWindow]);

  const stationDistKm = useMemo(() => {
    if (!position || !activeStation) return null;
    const dist = calculateDistanceMeters(position.lat, position.lng, activeStation.lat, activeStation.lng);
    return (dist / 1000).toFixed(1);
  }, [position, activeStation]);

  return (
    <div className="flex h-full flex-col bg-card/95 backdrop-blur-sm">
      <div className="p-3 sm:p-4 border-b space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-base sm:text-lg font-bold">Radar Szlakowy</h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {sortedAndFilteredTrains.length} w zasięgu
            </Badge>
          </div>

          <div className="flex items-center gap-1.5">
            {onRefresh && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1"
                onClick={onRefresh}
                disabled={isLoading}
                title="Pobierz najświeższe dane z PKP PLK"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-primary' : 'text-muted-foreground'}`} />
                <span className="hidden sm:inline">Odśwież</span>
              </Button>
            )}

            {onOpenSpotDialog && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs gap-1 border-amber-500/40 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
                onClick={onOpenSpotDialog}
              >
                <PackageCheck className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">+ Spotuj</span>
              </Button>
            )}
          </div>
        </div>

        {/* Pasek aktywnej stacji / posterunku PLK */}
        {activeStation && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/70 border text-xs gap-2">
            <div className="flex items-center gap-1.5 truncate flex-1 min-w-0">
              <Radio className="h-3.5 w-3.5 text-emerald-500 shrink-0 animate-pulse" />
              <span className="text-muted-foreground shrink-0 hidden xs:inline">Posterunek:</span>
              <strong className="text-foreground font-semibold truncate">{activeStation.name}</strong>
              {stationDistKm && (
                <span className="font-mono text-[10px] text-primary shrink-0 font-bold">
                  ({stationDistKm} km)
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {onOpenStationSearch && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] gap-1 text-primary hover:bg-primary/15 font-semibold"
                  onClick={onOpenStationSearch}
                >
                  <Search className="h-3 w-3" />
                  <span>Zmień stację</span>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Szybkie filtry operatorów */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5 scrollbar-none">
          <Button
            size="sm"
            variant={operatorFilter === 'all' ? 'default' : 'ghost'}
            className="h-6 px-2 text-[11px]"
            onClick={() => setOperatorFilter('all')}
          >
            Wszystkie
          </Button>
          <Button
            size="sm"
            variant={operatorFilter === 'ic' ? 'default' : 'ghost'}
            className="h-6 px-2 text-[11px]"
            onClick={() => setOperatorFilter(operatorFilter === 'ic' ? 'all' : 'ic')}
          >
            Intercity / Pendolino
          </Button>
          <Button
            size="sm"
            variant={operatorFilter === 'regional' ? 'default' : 'ghost'}
            className="h-6 px-2 text-[11px]"
            onClick={() => setOperatorFilter(operatorFilter === 'regional' ? 'all' : 'regional')}
          >
            Regio / KM / KD
          </Button>
          <Button
            size="sm"
            variant={operatorFilter === 'cargo' ? 'default' : 'ghost'}
            className="h-6 px-2 text-[11px] text-amber-500 font-semibold"
            onClick={() => setOperatorFilter(operatorFilter === 'cargo' ? 'all' : 'cargo')}
          >
            📦 Towarowe
          </Button>
        </div>

        <div className="pt-0.5">
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <Label htmlFor="time-window-slider" className="text-[11px]">Horyzont czasowy</Label>
            <span className="font-bold font-mono text-foreground text-[11px]">{timeWindow[0]} min</span>
          </div>
          <Slider
            id="time-window-slider"
            min={10}
            max={60}
            step={5}
            value={timeWindow}
            onValueChange={setTimeWindow}
            className="w-full"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-2.5">
          {isLoading && sortedAndFilteredTrains.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
              <Loader2 className="w-8 h-8 mb-3 animate-spin text-primary" />
              <p className="text-sm font-medium">Łączenie z PKP PLK OpenDataAPI...</p>
              <p className="text-xs text-muted-foreground mt-1">Pobieranie rzeczywistych składów na szlaku</p>
            </div>
          ) : sortedAndFilteredTrains.length > 0 ? (
            sortedAndFilteredTrains.map((train) => (
              <TrainCard
                key={train.id}
                train={train}
                userPosition={position}
                enthusiastMode={enthusiastMode}
                onSelect={onTrainSelect}
              />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-center">
              <WifiOff className="w-8 h-8 mb-2 opacity-60" />
              <p className="text-sm font-medium">Brak pociągów dla wybranego okna czasowego.</p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-8"
                  onClick={() => setTimeWindow([60])}
                >
                  Zwiększ horyzont (60 min)
                </Button>
                {onOpenStationSearch && (
                  <Button
                    variant="default"
                    size="sm"
                    className="text-xs h-8"
                    onClick={onOpenStationSearch}
                  >
                    Wybierz inny węzeł
                  </Button>
                )}
              </div>
            </div>
          )}

          {geoError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>Włącz lokalizację GPS w telefonie, aby aktywować ostrzeganie przed potrąceniem.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
