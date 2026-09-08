"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Train, PackageCheck, AlertTriangle, ShieldCheck, MapPin } from 'lucide-react';
import { useGeolocation } from '@/hooks/use-geolocation';
import type { Train as TrainType } from '@/lib/types';

interface TrainSpotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrainSpotted?: (train: TrainType) => void;
}

export function TrainSpotDialog({ open, onOpenChange, onTrainSpotted }: TrainSpotDialogProps) {
  const { position } = useGeolocation();
  const [trainType, setTrainType] = useState<'Cargo' | 'IC' | 'KM' | 'Polregio'>('Cargo');
  const [trainId, setTrainId] = useState('');
  const [direction, setDirection] = useState<'east' | 'west' | 'north' | 'south'>('east');
  const [speedEstimated, setSpeedEstimated] = useState('60');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const lat = position ? position.lat : 52.231;
    const lng = position ? position.lng : 21.006;
    const speedKmh = parseFloat(speedEstimated) || 60;
    const speedMs = speedKmh / 3.6;

    let heading = 90;
    if (direction === 'west') heading = 270;
    if (direction === 'north') heading = 0;
    if (direction === 'south') heading = 180;

    const generatedId = trainId.trim() || `${trainType === 'Cargo' ? 'CARGO' : trainType}-${Math.floor(10000 + Math.random() * 90000)}`;

    const newTrain: TrainType = {
      id: generatedId,
      name: trainType === 'Cargo' ? 'Pociąg Towarowy (Live Spot)' : `Skład ${trainType}`,
      route: 'Zgłoszony na żywo przez Trainspottera',
      type: trainType,
      operator: trainType === 'Cargo' ? 'PKP Cargo / Prywatny' : 'Przewoźnik Regionalny',
      rollingStock: trainType === 'Cargo' ? 'Ciężki skład towarowy (Dragon/Vectron)' : 'Skład pasażerski',
      currentPosition: { lat, lng },
      speed: speedMs,
      heading,
      lastUpdate: Date.now(),
      path: [
        { lat: lat - 0.01, lng: lng - 0.01 },
        { lat, lng },
        { lat: lat + 0.01, lng: lng + 0.01 },
      ],
      pathIndex: 1,
      delayMinutes: 0,
    };

    setTimeout(() => {
      if (onTrainSpotted) {
        onTrainSpotted(newTrain);
      }
      setIsSubmitting(false);
      setSuccessMessage(true);
      setTimeout(() => {
        setSuccessMessage(false);
        onOpenChange(false);
      }, 1400);
    }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-card border-border/80 text-card-foreground">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-500">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-headline">
                Spotting: Zgłoś pociąg na żywo
              </DialogTitle>
              <DialogDescription className="text-xs">
                Oznacz pociąg towarowy lub niemonitorowany, aby ostrzec pieszych w pobliżu torów.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {successMessage ? (
          <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
            <div className="h-12 w-12 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <ShieldCheck className="h-7 w-7" />
            </div>
            <div className="text-base font-bold text-foreground">Pociąg dodany do radaru!</div>
            <p className="text-xs text-muted-foreground max-w-[280px]">
              Wszyscy piesi w promieniu 2 km otrzymują natychmiastowe ostrzeżenie kolizyjne.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Rodzaj pociągu</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={trainType === 'Cargo' ? 'default' : 'outline'}
                  className="h-10 text-xs justify-start gap-2"
                  onClick={() => setTrainType('Cargo')}
                >
                  <PackageCheck className="h-4 w-4 text-amber-500" />
                  <span>Towarowy (Cargo)</span>
                </Button>
                <Button
                  type="button"
                  variant={trainType === 'IC' ? 'default' : 'outline'}
                  className="h-10 text-xs justify-start gap-2"
                  onClick={() => setTrainType('IC')}
                >
                  <Train className="h-4 w-4 text-blue-500" />
                  <span>Pasażerski / IC</span>
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="train-id" className="text-xs font-semibold">
                  Nr / Oznaczenie lokomotywy
                </Label>
                <Input
                  id="train-id"
                  placeholder="np. ET22-1200 / Dragon"
                  value={trainId}
                  onChange={(e) => setTrainId(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="speed" className="text-xs font-semibold">
                  Szacowana prędkość (km/h)
                </Label>
                <Input
                  id="speed"
                  type="number"
                  min="10"
                  max="200"
                  value={speedEstimated}
                  onChange={(e) => setSpeedEstimated(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Kierunek jazdy po szlaku</Label>
              <RadioGroup
                value={direction}
                onValueChange={(v: any) => setDirection(v)}
                className="grid grid-cols-4 gap-2 text-xs"
              >
                <div className="flex items-center space-x-1.5 border rounded-md p-2 hover:bg-muted/40 cursor-pointer">
                  <RadioGroupItem value="east" id="dir-east" />
                  <Label htmlFor="dir-east" className="cursor-pointer text-[11px]">Wschód ➔</Label>
                </div>
                <div className="flex items-center space-x-1.5 border rounded-md p-2 hover:bg-muted/40 cursor-pointer">
                  <RadioGroupItem value="west" id="dir-west" />
                  <Label htmlFor="dir-west" className="cursor-pointer text-[11px]">Zachód ⬅</Label>
                </div>
                <div className="flex items-center space-x-1.5 border rounded-md p-2 hover:bg-muted/40 cursor-pointer">
                  <RadioGroupItem value="north" id="dir-north" />
                  <Label htmlFor="dir-north" className="cursor-pointer text-[11px]">Północ ⬆</Label>
                </div>
                <div className="flex items-center space-x-1.5 border rounded-md p-2 hover:bg-muted/40 cursor-pointer">
                  <RadioGroupItem value="south" id="dir-south" />
                  <Label htmlFor="dir-south" className="cursor-pointer text-[11px]">Południe ⬇</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] text-muted-foreground flex items-center gap-2 border">
              <MapPin className="h-4 w-4 text-primary shrink-0" />
              <span>
                Lokalizacja zostanie pobrana z Twojego GPS{' '}
                {position ? `(${position.lat.toFixed(4)}, ${position.lng.toFixed(4)})` : '(domyślnie centrum węzła kolejowego)'}
              </span>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-xs"
              >
                Anuluj
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow"
              >
                <PackageCheck className="h-4 w-4" />
                <span>{isSubmitting ? 'Rozgłaszanie...' : 'Rozgłoś na radarze'}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
