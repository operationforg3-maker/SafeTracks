"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { Radio, Satellite, Train, CheckCircle2, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import type { Position } from '@/hooks/use-geolocation';
import type { GeocodedStation } from '@/services/pkp-api';
import type { Train as TrainType } from '@/lib/types';

interface RadarLoaderProps {
  userPosition?: Position | null;
  geoLoading: boolean;
  activeStation?: GeocodedStation | null;
  trains: TrainType[];
  isLoadingTrains: boolean;
  onFinish?: () => void;
}

export function RadarLoader({
  userPosition,
  geoLoading,
  activeStation,
  trains,
  isLoadingTrains,
  onFinish,
}: RadarLoaderProps) {
  const [showSkipButton, setShowSkipButton] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [minTimeElapsed, setMinTimeElapsed] = useState(false);
  const [gpsTimedOut, setGpsTimedOut] = useState(false);

  // Minimalny czas wyświetlenia (1.2s), aby uniknąć brzydkiego mignięcia
  useEffect(() => {
    const timer = setTimeout(() => {
      setMinTimeElapsed(true);
    }, 1200);

    const skipTimer = setTimeout(() => {
      setShowSkipButton(true);
    }, 2800);

    const gpsTimeout = setTimeout(() => {
      setGpsTimedOut(true);
    }, 3800);

    return () => {
      clearTimeout(timer);
      clearTimeout(skipTimer);
      clearTimeout(gpsTimeout);
    };
  }, []);

  // Statusy etapów
  const gpsDone = Boolean(userPosition) || (!geoLoading && !userPosition) || gpsTimedOut;
  const stationDone = Boolean(activeStation);
  const trainsDone = !isLoadingTrains || trains.length > 0;

  const allReady = minTimeElapsed && gpsDone && stationDone && trainsDone;

  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;
  const hasTriggeredExitRef = React.useRef(false);

  useEffect(() => {
    if (allReady && !hasTriggeredExitRef.current) {
      hasTriggeredExitRef.current = true;
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(() => {
          setIsDismissed(true);
          onFinishRef.current?.();
        }, 500);
      }, 400);

      return () => clearTimeout(exitTimer);
    }
  }, [allReady]);

  const handleManualSkip = () => {
    if (hasTriggeredExitRef.current && isDismissed) return;
    hasTriggeredExitRef.current = true;
    setIsExiting(true);
    setTimeout(() => {
      setIsDismissed(true);
      onFinishRef.current?.();
    }, 250);
  };

  if (isDismissed) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 sm:p-6 bg-background/98 backdrop-blur-xl transition-all duration-500 ${
        isExiting ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Tło radarowe z poświatą */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center justify-center">
        <div className="w-[500px] h-[500px] rounded-full bg-primary/10 blur-[100px] animate-pulse" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-auto flex flex-col items-center text-center">
        {/* Stylizowany radar HUD */}
        <div className="relative w-48 h-48 sm:w-56 sm:h-56 mb-6 flex items-center justify-center">
          {/* Pierścienie odległości */}
          <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
          <div className="absolute inset-4 rounded-full border border-primary/30" />
          <div className="absolute inset-12 rounded-full border border-primary/40 border-dashed" />
          <div className="absolute inset-20 rounded-full border border-primary/50" />

          {/* Oś współrzędnych radaru */}
          <div className="absolute inset-x-0 top-1/2 h-[1px] bg-primary/20" />
          <div className="absolute inset-y-0 left-1/2 w-[1px] bg-primary/20" />

          {/* Obracająca się wiązka radaru */}
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <div
              className="w-full h-full animate-radar-sweep"
              style={{
                background:
                  'conic-gradient(from 0deg at 50% 50%, rgba(37, 99, 235, 0.45) 0deg, rgba(37, 99, 235, 0.08) 60deg, transparent 70deg)',
              }}
            />
          </div>

          {/* Środek radaru: Ikona SafeTracks */}
          <div className="relative z-10 w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30">
            <Train className="w-8 h-8 animate-bounce" />
          </div>

          {/* Pulsujące punkty wykrytych obiektów */}
          {trains.length > 0 && (
            <>
              <span className="absolute top-10 right-12 h-3 w-3 rounded-full bg-purple-500 shadow-[0_0_10px_#a855f7] animate-ping" />
              <span className="absolute bottom-12 left-10 h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#22c55e] animate-ping" />
              <span className="absolute top-16 left-14 h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] animate-pulse" />
            </>
          )}
        </div>

        {/* Tytuł nagłówka */}
        <div className="space-y-1 mb-6">
          <h2 className="text-2xl font-extrabold font-headline tracking-tight text-foreground">
            Inicjalizacja Radaru Szlakowego
          </h2>
          <p className="text-xs text-muted-foreground font-mono">
            SafeTracks v2.0 • System Aktywnej Ochrony Torowisk
          </p>
        </div>

        {/* Lista kontrolna kalibracji telemetrii */}
        <div className="w-full space-y-2.5 bg-card/80 border border-border/80 p-4 rounded-2xl shadow-xl backdrop-blur-md text-left text-xs">
          {/* Krok 1: GPS */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  gpsDone ? 'bg-emerald-500/15 text-emerald-500' : 'bg-primary/15 text-primary'
                }`}
              >
                <Satellite className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-foreground">Namierzanie sygnału GPS</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {userPosition
                    ? `${userPosition.lat.toFixed(4)}°N, ${userPosition.lng.toFixed(4)}°E`
                    : gpsTimedOut
                    ? 'Brak sygnału GPS (Tryb domyślny)'
                    : 'Pobieranie koordynatów z satelitów...'}
                </div>
              </div>
            </div>
            {gpsDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            )}
          </div>

          {/* Krok 2: Posterunek PLK */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  stationDone ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Radio className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-foreground">Najbliższy posterunek PKP PLK</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {activeStation
                    ? `${activeStation.name} (węzeł #${activeStation.id})`
                    : 'Lokalizacja węzła kolejowego...'}
                </div>
              </div>
            </div>
            {stationDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            )}
          </div>

          {/* Krok 3: Wektory pociągów */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`p-1.5 rounded-lg shrink-0 ${
                  trainsDone ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Train className="w-4 h-4" />
              </div>
              <div className="truncate">
                <div className="font-semibold text-foreground">Skanowanie szlaków kolejowych</div>
                <div className="text-[11px] text-muted-foreground font-mono truncate">
                  {trainsDone
                    ? `Wykryto składów: ${trains.length} w zasięgu radaru`
                    : 'Pobieranie pozycji składów w czasie rzeczywistym...'}
                </div>
              </div>
            </div>
            {trainsDone ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
            )}
          </div>
        </div>

        {/* Informacja o gotowości lub przycisk pominięcia */}
        <div className="mt-5 flex flex-col items-center gap-2">
          {allReady ? (
            <div className="inline-flex items-center gap-2 text-emerald-500 font-semibold text-xs animate-pulse">
              <ShieldCheck className="w-4 h-4" />
              <span>Kalibracja zakończona pomyślnie. Uruchamianie...</span>
            </div>
          ) : showSkipButton ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleManualSkip}
              className="text-xs h-8 px-4 gap-1.5 border-border hover:bg-muted font-medium"
            >
              <span>Przejdź od razu do mapy</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Oczekiwanie na uprawnienia geolokalizacji w przeglądarce...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
