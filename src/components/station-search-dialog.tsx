"use client";

import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MapPin, Locate, Check, Train } from 'lucide-react';
import { GeocodedStation, searchStations, findNearestStation, calculateDistanceMeters, allStations } from '@/services/pkp-api';
import type { Position } from '@/hooks/use-geolocation';

interface StationSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeStation: GeocodedStation | null;
  onSelectStation: (station: GeocodedStation) => void;
  userPosition?: Position;
}

export function StationSearchDialog({
  open,
  onOpenChange,
  activeStation,
  onSelectStation,
  userPosition,
}: StationSearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Wyniki wyszukiwania
  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      // Domyślnie najbliższe lub popularne
      if (userPosition) {
        const sorted = allStations.map((st) => ({
          ...st,
          distanceMeters: calculateDistanceMeters(userPosition.lat, userPosition.lng, st.lat, st.lng),
        }));
        sorted.sort((a, b) => a.distanceMeters - b.distanceMeters);
        return sorted.slice(0, 8);
      }
      const popular = ['Warszawa Centralna', 'Kraków Główny', 'Poznań Główny', 'Wrocław Główny', 'Gdańsk Główny', 'Katowice'];
      return allStations.filter((s) => popular.includes(s.name));
    }
    return searchStations(searchQuery, 15);
  }, [searchQuery, userPosition]);

  const handleAutoLocate = () => {
    if (userPosition) {
      const nearest = findNearestStation(userPosition.lat, userPosition.lng);
      onSelectStation(nearest);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-950 border-slate-800 text-slate-100 p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-white">
            <Train className="h-5 w-5 text-primary" />
            <span>Wybierz posterunek / stację PKP PLK</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Radar pobiera na żywo pociągi, opóźnienia i wektory ruchu dla wybranego rejonu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Wpisz nazwę stacji (np. Wołomin, Pruszków, Sopot)..."
              className="pl-9 bg-slate-900 border-slate-700 text-xs text-white placeholder:text-slate-500 h-9"
              autoFocus
            />
          </div>

          {userPosition && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoLocate}
              className="w-full justify-start text-xs h-8 gap-2 border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
            >
              <Locate className="h-3.5 w-3.5" />
              <span>Wykryj najbliższy posterunek z mojego GPS</span>
            </Button>
          )}

          <div className="text-[11px] font-semibold text-slate-400 pt-1">
            {searchQuery ? `Wyniki wyszukiwania (${searchResults.length}):` : 'Proponowane posterunki i stacje:'}
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
            {searchResults.length > 0 ? (
              searchResults.map((st) => {
                const isSelected = activeStation?.id === st.id;
                const distM = userPosition
                  ? calculateDistanceMeters(userPosition.lat, userPosition.lng, st.lat, st.lng)
                  : null;

                return (
                  <button
                    key={st.id}
                    onClick={() => {
                      onSelectStation(st);
                      onOpenChange(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg border text-xs flex items-center justify-between transition ${
                      isSelected
                        ? 'border-primary bg-primary/20 text-white font-bold'
                        : 'border-slate-800 bg-slate-900/60 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <MapPin className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-slate-500'}`} />
                      <span className="truncate">{st.name}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {distM !== null && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {distM > 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`}
                        </span>
                      )}
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-slate-500">
                Nie znaleziono stacji dla frazy &quot;{searchQuery}&quot;
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
