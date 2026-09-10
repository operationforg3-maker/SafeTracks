import { useMemo } from 'react';
import { Clock, Gauge, Route, Train, AlertTriangle, ShieldCheck, Zap, ChevronRight, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import type { Train as TrainType, AlertLevel } from '@/lib/types';
import type { Position } from '@/hooks/use-geolocation';
import { calculateDistanceMeters, isTrainApproaching } from '@/services/pkp-api';

interface TrainCardProps {
  train: TrainType;
  userPosition?: Position;
  enthusiastMode: boolean;
  onSelect?: (train: TrainType) => void;
}

const alertStyles: Record<AlertLevel, string> = {
  safe: 'border-border/60 hover:border-primary/40 bg-card/85',
  warning: 'border-amber-500/60 bg-amber-500/10 shadow-sm',
  critical: 'border-destructive bg-destructive/15 animate-pulse shadow-md',
};

const alertIcons: Record<AlertLevel, React.ReactNode> = {
  safe: <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />,
  critical: <AlertTriangle className="h-4 w-4 text-destructive animate-bounce shrink-0" />,
};

export function TrainCard({ train, userPosition, enthusiastMode, onSelect }: TrainCardProps) {
  const directDistanceMeters = useMemo(() => {
    if (!userPosition) return null;
    return calculateDistanceMeters(
      userPosition.lat,
      userPosition.lng,
      train.currentPosition.lat,
      train.currentPosition.lng
    );
  }, [userPosition, train.currentPosition]);

  const isApproaching = useMemo(() => {
    if (!userPosition) return true;
    return isTrainApproaching(
      userPosition.lat,
      userPosition.lng,
      train.currentPosition.lat,
      train.currentPosition.lng,
      train.heading || 0
    );
  }, [userPosition, train.currentPosition, train.heading]);

  const directEtaSeconds = useMemo(() => {
    if (!directDistanceMeters) return null;
    const speed = Math.max(train.speed, 8); // min 8 m/s
    return Math.round(directDistanceMeters / speed);
  }, [directDistanceMeters, train.speed]);

  const alertLevel: AlertLevel = useMemo(() => {
    if (!userPosition || directEtaSeconds === null) return 'safe';
    if (isApproaching) {
      if (directEtaSeconds <= 35) return 'critical';
      if (directEtaSeconds <= 120) return 'warning';
    }
    return 'safe';
  }, [directEtaSeconds, isApproaching, userPosition]);

  const formattedETA = useMemo(() => {
    if (directEtaSeconds === null || !userPosition) return '--:--';
    if (!isApproaching && directDistanceMeters !== null && directDistanceMeters > 150) {
      return 'Minął stację';
    }
    if (directEtaSeconds < 15) return 'Tuż obok';
    if (directEtaSeconds < 60) return `${Math.round(directEtaSeconds)}s`;
    const minutes = Math.floor(directEtaSeconds / 60);
    const remainingSeconds = Math.round(directEtaSeconds % 60);
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s`;
  }, [directEtaSeconds, isApproaching, directDistanceMeters, userPosition]);

  const kmh = Math.round(train.speed * 3.6);

  let typeBadgeColor = 'border-slate-500/40 text-slate-300';
  if (train.type === 'EIP') typeBadgeColor = 'border-purple-500/60 bg-purple-500/10 text-purple-400';
  else if (train.type === 'IC') typeBadgeColor = 'border-blue-500/60 bg-blue-500/10 text-blue-400';
  else if (train.type === 'KM') typeBadgeColor = 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400';
  else if (train.type === 'Polregio') typeBadgeColor = 'border-red-500/60 bg-red-500/10 text-red-400';
  else if (train.type === 'Cargo') typeBadgeColor = 'border-amber-500/60 bg-amber-500/10 text-amber-400';

  const hasDelay = (train.delayMinutes || 0) > 0;

  return (
    <div className="transition-all duration-150">
      <Card
        onClick={() => onSelect && onSelect(train)}
        className={cn(
          "transition-all cursor-pointer border hover:shadow-md backdrop-blur-sm",
          alertStyles[alertLevel]
        )}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <CardTitle className="text-sm font-bold flex items-center gap-1 font-headline">
              <Activity className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              <span>{train.name ? `${train.id} "${train.name}"` : train.id}</span>
            </CardTitle>

            <Badge variant="outline" className={cn("text-[10px] font-mono px-1.5 py-0 h-4", typeBadgeColor)}>
              {train.type}
            </Badge>

            {hasDelay ? (
              <span className="bg-amber-500/15 text-amber-400 border border-amber-500/40 text-[9px] px-1.5 py-0 rounded font-mono font-bold">
                +{train.delayMinutes} min
              </span>
            ) : (
              <span className="text-emerald-400/90 text-[9px] font-mono bg-emerald-500/10 border border-emerald-500/30 px-1 py-0 rounded">
                o czasie
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {userPosition && alertIcons[alertLevel]}
            <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
          </div>
        </CardHeader>

        <CardContent className="p-3 pt-0">
          <div className="flex items-end justify-between gap-2 mt-1">
            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-xl font-bold font-mono">
                <Clock className={cn("h-4 w-4", alertLevel === 'critical' ? 'text-destructive animate-pulse' : 'text-primary')} />
                <span className={alertLevel === 'critical' ? 'text-destructive' : 'text-foreground'}>{formattedETA}</span>
                {userPosition && (
                  <span className="text-[10px] font-normal text-muted-foreground font-sans ml-1">
                    {isApproaching ? '➔ zbliża się' : '⬅ minął posterunek'}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                <Route className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{train.route}</span>
              </p>
            </div>

            <div className="flex flex-col items-end gap-0.5 shrink-0">
              <div className="flex items-center gap-1 text-xs font-semibold font-mono">
                <Gauge className="h-3 w-3 text-muted-foreground" />
                <span>{kmh} km/h</span>
              </div>
              {directDistanceMeters !== null && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {directDistanceMeters > 1000 ? `${(directDistanceMeters / 1000).toFixed(1)} km` : `${Math.round(directDistanceMeters)} m`}
                </span>
              )}
            </div>
          </div>

          {enthusiastMode && (
            <div className="mt-2 pt-2 border-t text-[11px] grid grid-cols-2 gap-2 text-muted-foreground">
              {train.rollingStock && (
                <div className="flex items-center gap-1 truncate">
                  <Train className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate font-medium text-foreground">{train.rollingStock}</span>
                </div>
              )}
              {train.operator && (
                <div className="flex items-center gap-1 truncate">
                  <Zap className="h-3 w-3 shrink-0 text-amber-500" />
                  <span className="truncate font-medium text-foreground">{train.operator}</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
