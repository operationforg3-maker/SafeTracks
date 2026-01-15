"use client";

import { ScrollArea } from '@/components/ui/scroll-area';
import { TrainCard } from '@/components/train-card';
import type { Train } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { AlertCircle, WifiOff } from 'lucide-react';
import { Slider } from './ui/slider';
import { Label } from './ui/label';
import { useState } from 'react';

interface DashboardProps {
  trains: Train[];
  enthusiastMode: boolean;
}

export function Dashboard({ trains, enthusiastMode }: DashboardProps) {
  const { position, error: geoError } = useGeolocation();
  const [timeWindow, setTimeWindow] = useState([60]);

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="p-4 border-b">
        <h2 className="font-headline text-lg font-semibold">Radar Pociągów</h2>
        <div className='mt-4'>
            <Label htmlFor='time-window-slider'>Okno czasowe: {timeWindow[0]} min</Label>
            <Slider
                id="time-window-slider"
                min={5}
                max={120}
                step={5}
                value={timeWindow}
                onValueChange={setTimeWindow}
                className="mt-2"
            />
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {trains.length > 0 ? (
            trains.map(train => (
              <TrainCard key={train.id} train={train} userPosition={position} enthusiastMode={enthusiastMode} />
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground pt-16">
                <WifiOff className="w-12 h-12 mb-4" />
                <p className='text-center'>Brak danych o pociągach.<br/>Sprawdź połączenie z internetem.</p>
            </div>
          )}

          {geoError && (
             <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <p>Nie można uzyskać lokalizacji. Funkcje ostrzegania są wyłączone.</p>
             </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
