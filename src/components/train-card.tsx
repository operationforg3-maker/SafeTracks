import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Gauge, Route, Train, AlertTriangle, ShieldCheck, Zap, ChevronRight } from 'lucide-react';
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
  onSelect?: (train: TrainType) => void;
}

const alertStyles: Record<AlertLevel, string> = {
  safe: 'border-border/60 hover:border-primary/40 bg-card/80',
  warning: 'border-amber-500/60 bg-amber-500/10 shadow-sm',
  critical: 'border-destructive bg-destructive/15 animate-pulse shadow-md',
};

const alertIcons: Record<AlertLevel, React.ReactNode> = {
  safe: <ShieldCheck className="h-4 w-4 text-emerald-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  critical: <AlertTriangle className="h-4 w-4 text-destructive animate-bounce" />,
};

export function TrainCard({ train, userPosition, enthusiastMode, onSelect }: TrainCardProps) {
  const [etaData, setEtaData] = useState<PredictiveETAOutput | null>(null);

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

  let typeBadgeColor = 'border-slate-500/40 text-slate-300';
  if (train.type === 'EIP') typeBadgeColor = 'border-purple-500/60 bg-purple-500/10 text-purple-400';
  else if (train.type === 'IC') typeBadgeColor = 'border-blue-500/60 bg-blue-500/10 text-blue-400';
  else if (train.type === 'KM') typeBadgeColor = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400';
  else if (train.type === 'Polregio') typeBadgeColor = 'border-red-500/60 bg-red-500/10 text-red-400';
  else if (train.type === 'Cargo') typeBadgeColor = 'border-amber-500/60 bg-amber-500/10 text-amber-400';

  return (
    <motion.div layout>
      <Card
        onClick={() => onSelect && onSelect(train)}
        className={cn(
          "transition-all cursor-pointer border hover:shadow-lg backdrop-blur-sm",
          alertStyles[alertLevel]
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-bold flex items-center gap-1.5 font-headline">
              <span>{train.name ? `${train.name} (${train.id})` : train.id}</span>
            </CardTitle>
            <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 h-4", typeBadgeColor)}>
              {train.type}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {userPosition && alertIcons[alertLevel]}
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-2xl font-bold font-mono">
                <Clock className={cn("h-5 w-5", alertLevel === 'critical' ? 'text-destructive animate-pulse' : 'text-accent')} />
                <span>{formattedETA}</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Route className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate max-w-[210px]">{train.route}</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-1 text-sm font-semibold font-mono">
                <Gauge className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{kmh} km/h</span>
              </div>
              {directDistanceMeters !== null && (
                <span className="text-[11px] text-muted-foreground font-mono">
                  {directDistanceMeters > 1000 ? `${(directDistanceMeters / 1000).toFixed(1)} km` : `${Math.round(directDistanceMeters)} m`}
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
                className="overflow-hidden border-t pt-2.5"
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
