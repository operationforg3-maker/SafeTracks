"use client";

import { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Gauge, Route, Train, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import type { Train as TrainType, AlertLevel } from '@/lib/types';
import type { Position } from '@/hooks/use-geolocation';
import { calculateETA, type PredictiveETAOutput } from '@/ai/flows/predictive-eta-calculation';

interface TrainCardProps {
  train: TrainType;
  userPosition?: Position;
  enthusiastMode: boolean;
}

const alertStyles: Record<AlertLevel, string> = {
  safe: 'border-transparent',
  warning: 'border-accent bg-accent/10',
  critical: 'border-destructive bg-destructive/10 animate-pulse',
};

const alertIcons: Record<AlertLevel, React.ReactNode> = {
    safe: <ShieldCheck className="h-5 w-5 text-green-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-accent" />,
    critical: <AlertTriangle className="h-5 w-5 text-destructive" />,
}

export function TrainCard({ train, userPosition, enthusiastMode }: TrainCardProps) {
  const [etaData, setEtaData] = useState<PredictiveETAOutput | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (userPosition) {
      const getETA = async () => {
        setIsLoading(true);
        try {
          const result = await calculateETA({
            userLatitude: userPosition.lat,
            userLongitude: userPosition.lng,
            trainLatitude: train.currentPosition.lat,
            trainLongitude: train.currentPosition.lng,
            trainSpeed: train.speed,
            timeSinceLastUpdate: (Date.now() - train.lastUpdate) / 1000,
          });
          setEtaData(result);
        } catch (error) {
          console.error("Error calculating ETA:", error);
          setEtaData(null);
        } finally {
          setIsLoading(false);
        }
      };
      const debounceTimer = setTimeout(getETA, 500);
      return () => clearTimeout(debounceTimer);
    }
  }, [train, userPosition]);

  const alertLevel = useMemo(() => {
    if(!userPosition) return 'safe';
    return etaData?.alertLevel || 'safe';
  }, [etaData, userPosition]);
  
  const formattedETA = useMemo(() => {
    if (!etaData || !userPosition) return '--:--';
    const seconds = etaData.estimatedArrivalTime;
    if (seconds < 0) return '0s';
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }, [etaData, userPosition]);

  return (
    <motion.div layout>
      <Card className={cn("transition-colors", alertStyles[alertLevel])}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{train.id}</CardTitle>
          {isLoading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" /> : (userPosition && alertIcons[alertLevel])}
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-2xl font-bold">
                <Clock className="h-6 w-6 text-accent" />
                <span>{formattedETA}</span>
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Route className="h-3 w-3" /> {train.route}
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm">
               <Gauge className="h-4 w-4" /> {Math.round(train.speed * 3.6)} km/h
            </div>
          </div>
          <AnimatePresence>
            {enthusiastMode && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: 'auto', marginTop: '1rem' }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="flex items-center gap-2 pt-4 border-t mt-4">
                  <Train className="h-4 w-4 text-muted-foreground" />
                  <Badge variant="secondary">{train.type}</Badge>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
