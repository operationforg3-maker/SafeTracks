"use client";

import { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Volume2, VolumeX, PhoneCall, CheckCircle } from 'lucide-react';
import { Button } from './ui/button';
import { ProximityAlertState, Train } from '@/lib/types';
import { evaluateProximitySafety } from '@/services/proximity-engine';
import { useGeolocation } from '@/hooks/use-geolocation';
import { alertAudio } from '@/services/alert-audio';

import { GeocodedStation } from '@/services/pkp-api';

interface ProximityAlertBannerProps {
  trains: Train[];
  onOpenSos?: () => void;
  activeStation?: GeocodedStation | null;
}

export function ProximityAlertBanner({ trains, onOpenSos, activeStation }: ProximityAlertBannerProps) {
  const { position: userPosition } = useGeolocation();
  const [alertState, setAlertState] = useState<ProximityAlertState>({
    level: 'safe',
    isInsideHazardZone: false,
    message: 'Radar aktywny.',
  });
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedUntil, setDismissedUntil] = useState<number>(0);

  useEffect(() => {
    const isTemporarilyDismissed = Date.now() < dismissedUntil;
    const evaluated = evaluateProximitySafety(userPosition, trains, isMuted || isTemporarilyDismissed, activeStation);
    setAlertState(evaluated);
  }, [userPosition, trains, isMuted, dismissedUntil, activeStation]);

  const toggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    alertAudio.setSoundEnabled(!nextMuted);
  };

  const handleDismiss = () => {
    alertAudio.stopAlarm();
    // Wyciszenie na 60 sekund jeśli użytkownik świadomie potwierdził bezpieczeństwo
    setDismissedUntil(Date.now() + 60000);
  };

  if (alertState.level === 'safe' && !alertState.isInsideHazardZone) {
    return null;
  }

  const isCritical = alertState.level === 'critical';
  const isWarning = alertState.level === 'warning';

  return (
    <div
      className={`w-full transition-all duration-300 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-white shadow-lg ${
        isCritical
          ? 'bg-destructive animate-pulse border-b-2 border-white'
          : isWarning
          ? 'bg-amber-600 border-b border-amber-400'
          : 'bg-slate-800 border-b border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3 min-w-[280px] flex-1">
        {isCritical ? (
          <ShieldAlert className="h-6 w-6 text-white animate-bounce shrink-0" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-amber-200 shrink-0" />
        )}
        <div>
          <div className="font-bold text-sm leading-tight flex items-center gap-2">
            <span>{isCritical ? 'ZAGROŻENIE ŻYCIA! POCIĄG NA TORACH' : 'OSTRZEŻENIE ZBLIŻENIOWE'}</span>
            {alertState.estimatedTimeToArrivalSeconds && (
              <span className="bg-black/30 text-xs px-2 py-0.5 rounded-full font-mono font-black">
                ETA: {alertState.estimatedTimeToArrivalSeconds}s
              </span>
            )}
          </div>
          <p className="text-xs text-white/90 leading-snug mt-0.5">{alertState.message}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={toggleSound}
          className="h-8 px-2.5 text-xs bg-black/20 hover:bg-black/40 border-white/30 text-white"
          title={isMuted ? 'Włącz dźwięk alarmu' : 'Wycisz dźwięk alarmu'}
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>

        {isCritical && (
          <Button
            size="sm"
            variant="default"
            className="h-8 px-3 text-xs bg-white text-destructive font-bold hover:bg-slate-100 shadow-md gap-1"
            onClick={onOpenSos}
          >
            <PhoneCall className="h-3.5 w-3.5" />
            <span>SOS 112</span>
          </Button>
        )}

        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="h-8 px-2.5 text-xs text-white hover:bg-white/20"
        >
          <CheckCircle className="h-4 w-4 mr-1" />
          <span>Wiem</span>
        </Button>
      </div>
    </div>
  );
}
