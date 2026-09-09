"use client";

import { useState, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TrainCard } from '@/components/train-card';
import type { Train } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { AlertCircle, WifiOff, MapPin, PackageCheck, Radio } from 'lucide-react';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { calculateDistanceMeters, findNearestStations } from '@/services/pkp-api';

interface DashboardProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
  onOpenSpotDialog?: () => void;
}

export function Dashboard({ trains, enthusiastMode, onTrainSelect, onOpenSpotDialog }: DashboardProps) {
  const { position, error: geoError } = useGeolocation();
  const [timeWindow, setTimeWindow] = useState([10]);
  const [operatorFilter, setOperatorFilter] = useState<string>('all');

  // Wykrywanie najbliższych posterunków / stacji PKP PLK dla pozycji GPS
  const nearestStation = useMemo(() => {
    if (!position) return null;
    const stations = findNearestStations(position.lat, position.lng, 1);
    return stations.length > 0 ? stations[0] : null;
  }, [position]);

  // Filtrowanie i sortowanie pociągów (najbliższe użytkownikowi na samej górze i w wybranym horyzoncie czasowym)
  const sortedAndFilteredTrains = useMemo(() => {
    let list = [...trains];

    if (operatorFilter !== 'all') {
      list = list.filter((t) => {
        if (operatorFilter === 'cargo') return t.type.toLowerCase() === 'cargo';
        if (operatorFilter === 'ic') return t.type.toLowerCase() === 'eip' || t.type.toLowerCase() === 'ic';
        return t.type.toLowerCase() === operatorFilter.toLowerCase() || t.operator?.toLowerCase().includes(operatorFilter.toLowerCase());
      });
    }

    if (position) {
      const maxSeconds = timeWindow[0] * 60;
      list = list.filter((t) => {
        const dist = calculateDistanceMeters(position.lat, position.lng, t.currentPosition.lat, t.currentPosition.lng);
        const speed = Math.max(t.speed, 5);
        const eta = dist / speed;
        return eta <= maxSeconds;
      });

      list.sort((a, b) => {
        const distA = calculateDistanceMeters(position.lat, position.lng, a.currentPosition.lat, a.currentPosition.lng);
        const distB = calculateDistanceMeters(position.lat, position.lng, b.currentPosition.lat, b.currentPosition.lng);
        return distA - distB;
      });
    }

    return list;
  }, [trains, operatorFilter, position, timeWindow]);

  return (
    <div className="flex h-full flex-col bg-card/95 backdrop-blur-sm">
      <div className="p-3 sm:p-4 border-b space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-headline text-base sm:text-lg font-bold">Radar Szlakowy</h2>
            <Badge variant="secondary" className="font-mono text-xs">
              {sortedAndFilteredTrains.length} w zasięgu
            </Badge>
          </div>

          {onOpenSpotDialog && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2.5 text-xs gap-1 border-amber-500/40 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20"
              onClick={onOpenSpotDialog}
            >
              <PackageCheck className="h-3.5 w-3.5" />
              <span>+ Spotuj towarowy</span>
            </Button>
          )}
        </div>

        {/* Wskaźnik najbliższego węzła / posterunku PKP PLK dla współrzędnych GPS */}
        {nearestStation && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-muted/60 border text-[11px] text-muted-foreground">
            <div className="flex items-center gap-1.5 truncate">
              <Radio className="h-3.5 w-3.5 text-emerald-500 shrink-0 animate-pulse" />
              <span>Najbliższy posterunek PLK:</span>
              <strong className="text-foreground font-semibold truncate">{nearestStation.name}</strong>
            </div>
            <span className="font-mono text-[10px] shrink-0 text-primary font-bold">
              {(nearestStation.distanceMeters / 1000).toFixed(1)} km
            </span>
          </div>
        )}

        {/* Szybkie filtry operatorów */}
        <div className="flex items-center gap-1 overflow-x-auto text-xs py-0.5 scrollbar-none">
          <Button
            size="sm"
            variant={operatorFilter === 'all' ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setOperatorFilter('all')}
          >
            Wszystkie
          </Button>
          <Button
            size="sm"
            variant={operatorFilter === 'ic' ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-[11px]"
            onClick={() => setOperatorFilter(operatorFilter === 'ic' ? 'all' : 'ic')}
          >
            Intercity / Pendolino
          </Button>
          <Button
            size="sm"
            variant={operatorFilter === 'cargo' ? 'default' : 'ghost'}
            className="h-7 px-2.5 text-[11px] text-amber-500 font-semibold"
            onClick={() => setOperatorFilter(operatorFilter === 'cargo' ? 'all' : 'cargo')}
          >
            📦 Towarowe (Cargo)
          </Button>
        </div>

        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <Label htmlFor="time-window-slider">Horyzont czasowy zbliżania</Label>
            <span className="font-bold font-mono text-foreground">{timeWindow[0]} min</span>
          </div>
          <Slider
            id="time-window-slider"
            min={5}
            max={120}
            step={5}
            value={timeWindow}
            onValueChange={setTimeWindow}
            className="w-full"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 sm:p-4 space-y-3">
          {sortedAndFilteredTrains.length > 0 ? (
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
              <WifiOff className="w-10 h-10 mb-3 opacity-60" />
              <p className="text-sm font-medium">Brak pociągów dla wybranych filtrów.</p>
              <Button
                variant="link"
                size="sm"
                className="text-xs text-primary mt-1"
                onClick={() => setOperatorFilter('all')}
              >
                Pokaż wszystkie pociągi
              </Button>
            </div>
          )}

          {geoError && (
            <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p>Włącz lokalizację GPS w telefonie, aby aktywować ostrzeganie przed potrąceniem.</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
