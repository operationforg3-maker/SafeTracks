"use client";

import { useState, useMemo } from 'react';
import { ShieldAlert, AlertTriangle, Volume2, VolumeX, PhoneCall, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Train } from '@/lib/types';
import { evaluateProximitySafety } from '@/services/proximity-engine';
import { useGeolocation } from '@/hooks/use-geolocation';
import { alertAudio } from '@/services/alert-audio';
import { GeocodedStation } from '@/services/pkp-api';
import { useGeofenceRadius } from '@/services/geofence-settings';

interface ProximityAlertBannerProps {
  trains: Train[];
  onOpenSos?: () => void;
  activeStation?: GeocodedStation | null;
}

export function ProximityAlertBanner({ trains, onOpenSos, activeStation }: ProximityAlertBannerProps) {
  const { position: userPosition } = useGeolocation();
  const [geofenceRadius] = useGeofenceRadius();
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);

  const alertState = useMemo(() => {
    const isTemporarilyDismissed = Date.now() < dismissedUntil;
    return evaluateProximitySafety(
      userPosition,
      trains,
      isMuted || isTemporarilyDismissed,
      activeStation,
      geofenceRadius
    );
  }, [userPosition, trains, isMuted, dismissedUntil, activeStation, geofenceRadius]);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    alertAudio.setSoundEnabled(!nextMuted);
  };

  const handleDismiss = () => {
    alertAudio.stopAlarm();
    setDismissedUntil(Date.now() + 60000);
  };

  const isCritical = alertState.level === 'critical';
  const isWarning = alertState.level === 'warning';

  // KLUCZOWE: nie renderuj nic w stanie safe — zero szumu wizualnego
  if (!isCritical && !isWarning) return null;

  return (
    <div
      className={`w-full transition-colors duration-300 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 text-xs border-b ${
        isCritical
          ? 'bg-destructive text-destructive-foreground animate-pulse border-white/40'
          : 'bg-amber-500 text-amber-950 font-medium border-amber-600/30'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {isCritical ? (
          <ShieldAlert className="h-4 w-4 text-white animate-bounce shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-amber-900 shrink-0" />
        )}

        <div className="flex items-center gap-2 truncate text-xs">
          <span className="font-bold truncate">
            {isCritical ? 'ZAGROŻENIE!' : 'UWAGA'}
          </span>
          <span className="truncate opacity-90">{alertState.message}</span>
          {alertState.estimatedTimeToArrivalSeconds && (
            <span className="bg-black/20 font-mono font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0">
              ETA {alertState.estimatedTimeToArrivalSeconds}s
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          onClick={toggleSound}
          className="h-6 w-6 p-0 hover:bg-black/10"
          title={isMuted ? 'Włącz dźwięki' : 'Wycisz'}
        >
          {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
        </Button>

        {isCritical && (
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-[10px] font-bold bg-white text-destructive hover:bg-slate-100 gap-1 shadow"
            onClick={onOpenSos}
          >
            <PhoneCall className="h-3 w-3" />
            <span>112</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="h-6 px-1.5 text-[10px] hover:bg-black/10"
          title="Wycisz na 1 minutę"
        >
          <CheckCircle2 className="h-3 w-3 mr-0.5" />
          <span>OK</span>
        </Button>
      </div>
    </div>
  );
}
