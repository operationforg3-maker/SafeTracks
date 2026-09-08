import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Gauge, Route, Train, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import type { Train as TrainType, AlertLevel, PredictiveETAOutput } from '@/lib/types';
import type { Position } from '@/hooks/use-geolocation';
import { calculateDistanceMeters } from '@/services/pkp-api';

interface TrainCardProps {
  train: TrainType;
  userPosition?: Position;
  enthusiastMode: boolean;
}

const alertStyles: Record<AlertLevel, string> = {
  safe: 'border-border/60 hover:border-primary/40',
  warning: 'border-accent bg-accent/10 shadow-sm',
  critical: 'border-destructive bg-destructive/15 animate-pulse shadow-md',
};

const alertIcons: Record<AlertLevel, React.ReactNode> = {
  safe: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-accent" />,
  critical: <AlertTriangle className="h-4 w-4 text-destructive animate-bounce" />,
};

export function TrainCard({ train, userPosition, enthusiastMode }: TrainCardProps) {
  const [etaData, setEtaData] = useState<PredictiveETAOutput | null>(null);

  // Bezpośrednie matematyczne obliczenie odległości i predykcyjnego ETA kompensującego opóźnienia telemetrii
  const directDistanceMeters = useMemo(() => {
    if (!userPosition) return null;
    return calculateDistanceMeters(
      userPosition.lat,
      userPosition.lng,
      train.currentPosition.lat,
      train.currentPosition.lng
    );
  }, [userPosition, train.currentPosition]);

  const directEtaSeconds = useMemo(() => {
    if (!directDistanceMeters) return null;
    const speed = Math.max(train.speed, 5);
    // Kompensacja v * dt
    const timeSinceLastUpdate = (Date.now() - train.lastUpdate) / 1000;
    const compensatedDistance = Math.max(0, directDistanceMeters - speed * timeSinceLastUpdate);
    return Math.round(compensatedDistance / speed);
  }, [directDistanceMeters, train.speed, train.lastUpdate]);

  useEffect(() => {
    if (directEtaSeconds !== null) {
      setEtaData({
        estimatedArrivalTime: directEtaSeconds,
        isSafe: directEtaSeconds > 35,
        alertLevel: directEtaSeconds <= 35 ? 'critical' : directEtaSeconds <= 120 ? 'warning' : 'safe',
      });
    }
  }, [directEtaSeconds]);

  const alertLevel: AlertLevel = useMemo(() => {
    if (!userPosition) return 'safe';
    if (etaData?.alertLevel) return etaData.alertLevel;
    if (directEtaSeconds !== null) {
      if (directEtaSeconds <= 35) return 'critical';
      if (directEtaSeconds <= 120) return 'warning';
    }
    return 'safe';
  }, [etaData, directEtaSeconds, userPosition]);

  const effectiveEtaSeconds = etaData?.estimatedArrivalTime ?? directEtaSeconds;

  const formattedETA = useMemo(() => {
    if (effectiveEtaSeconds === null || !userPosition) return '--:--';
    if (effectiveEtaSeconds < 0) return '0s (tuż obok)';
    if (effectiveEtaSeconds < 60) return `${Math.round(effectiveEtaSeconds)}s`;
    const minutes = Math.floor(effectiveEtaSeconds / 60);
    const remainingSeconds = Math.round(effectiveEtaSeconds % 60);
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }, [effectiveEtaSeconds, userPosition]);

  const kmh = Math.round(train.speed * 3.6);

  return (
    <motion.div layout>
      <Card className={cn("transition-colors border", alertStyles[alertLevel])}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5">
              <span>{train.name ? `${train.name} (${train.id})` : train.id}</span>
            </CardTitle>
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
              {train.type}
            </Badge>
          </div>
          {userPosition && alertIcons[alertLevel]}
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-2xl font-bold font-mono">
                <Clock className={cn("h-5 w-5", alertLevel === 'critical' ? 'text-destructive animate-pulse' : 'text-accent')} />
                <span>{formattedETA}</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Route className="h-3 w-3 shrink-0" />
                <span className="truncate max-w-[220px]">{train.route}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 text-sm font-semibold">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{kmh} km/h</span>
              </div>
              {directDistanceMeters !== null && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  odległość: {directDistanceMeters > 1000 ? `${(directDistanceMeters / 1000).toFixed(1)} km` : `${Math.round(directDistanceMeters)} m`}
                </span>
              )}
            </div>
          </div>

          <AnimatePresence>
            {enthusiastMode && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '0.75rem' }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t pt-3"
              >
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {train.rollingStock && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Train className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="font-medium text-foreground truncate">{train.rollingStock}</span>
                    </div>
                  )}
                  {train.operator && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Zap className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span className="font-medium text-foreground truncate">{train.operator}</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
