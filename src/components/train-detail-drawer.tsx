"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gauge, Route, Train, Clock, AlertTriangle, ShieldCheck, MapPin, Zap, Info } from 'lucide-react';
import type { Train as TrainType } from '@/lib/types';
import type { Position } from '@/hooks/use-geolocation';
import { calculateDistanceMeters } from '@/services/pkp-api';

interface TrainDetailDrawerProps {
  train: TrainType | null;
  isOpen: boolean;
  onClose: () => void;
  userPosition?: Position;
}

export function TrainDetailDrawer({ train, isOpen, onClose, userPosition }: TrainDetailDrawerProps) {
  if (!train) return null;

  const distMeters = userPosition
    ? calculateDistanceMeters(
        userPosition.lat,
        userPosition.lng,
        train.currentPosition.lat,
        train.currentPosition.lng
      )
    : null;

  const speedKmh = Math.round(train.speed * 3.6);
  const etaSeconds = distMeters && train.speed > 0 ? Math.round(distMeters / train.speed) : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="sm:max-w-lg mx-auto rounded-t-2xl border-t border-border/80 bg-card p-4 sm:p-6 shadow-2xl">
        <SheetHeader className="pb-3 border-b">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs uppercase px-2 py-0.5 border-primary/40 bg-primary/10 text-primary">
                  {train.type}
                </Badge>
                {train.delayMinutes ? (
                  <Badge variant="destructive" className="text-xs">
                    +{train.delayMinutes} min opóźnienia
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs text-emerald-500 bg-emerald-500/10 border-emerald-500/30">
                    Punktualnie (0 min)
                  </Badge>
                )}
              </div>
              <SheetTitle className="text-xl font-bold font-headline flex items-center gap-2">
                <span>{train.name || train.id}</span>
                <span className="text-xs font-mono text-muted-foreground font-normal">#{train.id}</span>
              </SheetTitle>
              <SheetDescription className="text-xs flex items-center gap-1 text-muted-foreground">
                <Route className="h-3.5 w-3.5 text-primary shrink-0" />
                <span>{train.route}</span>
              </SheetDescription>
            </div>

            <div className="text-right">
              <div className="text-2xl font-bold font-mono tracking-tight text-foreground flex items-center justify-end gap-1">
                <Gauge className="h-5 w-5 text-accent" />
                <span>{speedKmh}</span>
                <span className="text-xs font-normal text-muted-foreground">km/h</span>
              </div>
              <span className="text-[10px] text-muted-foreground font-mono">
                {train.speed.toFixed(1)} m/s
              </span>
            </div>
          </div>
        </SheetHeader>

        <div className="grid grid-cols-2 gap-3 py-4">
          <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-accent" />
              <span>Czas do Twojej pozycji</span>
            </div>
            <div className="text-lg font-bold font-mono text-foreground">
              {etaSeconds !== null ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : '--'}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {distMeters !== null
                ? `Odległość w linii prostej: ${(distMeters / 1000).toFixed(2)} km`
                : 'Brak aktywnego GPS'}
            </div>
          </div>

          <div className="p-3 rounded-xl bg-muted/40 border space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Train className="h-3.5 w-3.5 text-primary" />
              <span>Przewoźnik i Tabor</span>
            </div>
            <div className="text-sm font-bold text-foreground truncate">
              {train.operator || 'PKP Intercity'}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground truncate">
              {train.rollingStock || 'Tabor serii EU/ED/ET'}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2.5 text-xs">
          <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground">Status szlakowy:</span>
            <p className="text-muted-foreground text-[11px]">
              Pociąg porusza się zgodnie z profilem linii kolejowej PKP PLK. Przy przechodzeniu przez torowisko zachowaj szczególną ostrożność.
            </p>
          </div>
        </div>

        <div className="pt-4 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            Zamknij
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
