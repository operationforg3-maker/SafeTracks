"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Map, Layers, Key, ShieldAlert, Sparkles, Check, ShieldCheck } from 'lucide-react';

import {
  GEOFENCE_RADIUS_KEY,
  DEFAULT_GEOFENCE_RADIUS,
  getStoredGeofenceRadius as loadGeofenceRadius,
  setStoredGeofenceRadius,
} from '@/services/geofence-settings';

export { GEOFENCE_RADIUS_KEY, DEFAULT_GEOFENCE_RADIUS, loadGeofenceRadius };

export type MapStyleOption = 'dark' | 'satellite' | 'voyager' | 'osm';


interface MapSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentStyle: MapStyleOption;
  onStyleChange: (style: MapStyleOption) => void;
  showTracksOverlay: boolean;
  onTracksOverlayToggle: (show: boolean) => void;
  geofenceRadius: number;
  onGeofenceRadiusChange: (radius: number) => void;
}

export function MapSettingsDialog({
  open,
  onOpenChange,
  currentStyle,
  onStyleChange,
  showTracksOverlay,
  onTracksOverlayToggle,
  geofenceRadius,
  onGeofenceRadiusChange,
}: MapSettingsDialogProps) {
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('safetracks_map_key') || '';
    }
    return '';
  });
  const [savedKeySuccess, setSavedKeySuccess] = useState(false);

  const handleSaveApiKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('safetracks_map_key', apiKey.trim());
      setSavedKeySuccess(true);
      setTimeout(() => setSavedKeySuccess(false), 2000);
    }
  };

  const handleGeofenceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    onGeofenceRadiusChange(val);
    setStoredGeofenceRadius(val);
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border/80 text-card-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/20 text-primary">
              <Map className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-headline">
                Ustawienia Mapy & Radar24
              </DialogTitle>
              <DialogDescription className="text-xs">
                Dostosuj wygląd mapy szlakowej, podkłady satelitarne oraz klucze API.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Wybór stylu podkładu */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">Podkład mapowy (Gotowy, bezpłatny, bez limitów)</Label>
            <RadioGroup
              value={currentStyle}
              onValueChange={(val: any) => onStyleChange(val)}
              className="grid grid-cols-2 gap-2"
            >
              <div
                onClick={() => onStyleChange('dark')}
                className={`p-3 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all ${
                  currentStyle === 'dark' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">🌙 Radar Dark (Nocny)</span>
                  {currentStyle === 'dark' && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Styl Flightradar24, maksymalna widoczność neonowych pociągów i torów.
                </span>
              </div>

              <div
                onClick={() => onStyleChange('satellite')}
                className={`p-3 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all ${
                  currentStyle === 'satellite' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">🛰️ Satelita HD</span>
                  {currentStyle === 'satellite' && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Zdjęcia satelitarne ESRI Clarity z dokładnym widokiem torowisk i ścieżek.
                </span>
              </div>

              <div
                onClick={() => onStyleChange('voyager')}
                className={`p-3 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all ${
                  currentStyle === 'voyager' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">🏙️ Jasny (Positron)</span>
                  {currentStyle === 'voyager' && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Jasna, czysta mapa wektorowa ułatwiająca czytanie nazw stacji i torów.
                </span>
              </div>

              <div
                onClick={() => onStyleChange('osm')}
                className={`p-3 rounded-lg border flex flex-col gap-1 cursor-pointer transition-all ${
                  currentStyle === 'osm' ? 'border-primary bg-primary/10 ring-1 ring-primary' : 'hover:bg-muted/40'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs">🗺️ OpenStreetMap</span>
                  {currentStyle === 'osm' && <Check className="h-3.5 w-3.5 text-primary" />}
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Standardowa mapa społecznościowa z kompletną siatką ulic.
                </span>
              </div>
            </RadioGroup>
          </div>

          {/* Strefa geofencingu — regulowany promień */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-amber-500" />
                <span>Strefa ostrzegania (geofencing)</span>
              </Label>
              <span className="text-xs font-mono font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/30">
                {geofenceRadius} m
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={1000}
              step={25}
              value={geofenceRadius}
              onChange={handleGeofenceChange}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
              <span>50 m</span>
              <span>250 m</span>
              <span>500 m</span>
              <span>1 km</span>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Pociąg w tej odległości od Ciebie wywoła <b>alarm dźwiękowy</b> i animację na mapie.
            </p>
          </div>

          {/* Opcjonalny klucz API zewnętrznego dostawcy */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="map-api-key" className="text-xs font-semibold flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Opcjonalny klucz API (Google Maps / Mapbox)</span>
              </Label>
              {savedKeySuccess && (
                <span className="text-[11px] text-emerald-500 font-semibold flex items-center gap-1">
                  <Check className="h-3 w-3" /> Zapisano!
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="map-api-key"
                type="password"
                placeholder="Wklej API Key (np. AIzaSy... lub pk.ey...)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="h-9 text-xs font-mono"
              />
              <Button size="sm" onClick={handleSaveApiKey} className="h-9 text-xs px-3">
                Zapisz
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Aplikacja <b>nie wymaga żadnego klucza do pełnego działania</b> — podkłady Dark Radar, Satelita oraz OpenRailwayMap działają natywnie i bezpłatnie.
            </p>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button size="sm" onClick={() => onOpenChange(false)} className="w-full text-xs">
            Gotowe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
