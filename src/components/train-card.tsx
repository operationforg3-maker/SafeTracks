import { useMemo } from 'react';
import { Clock, Gauge, Route, ChevronRight, AlertTriangle } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { cn } from '@/lib/utils';
import type { Train as TrainType, AlertLevel } from '@/lib/types';
import type { Position } from '@/hooks/use-geolocation';
import { calculateDistanceMeters, isTrainApproaching } from '@/services/pkp-api';
import { useGeofenceRadius } from '@/services/geofence-settings';

interface TrainCardProps {
  train: TrainType;
  userPosition?: Position;
  enthusiastMode: boolean;
  onSelect?: (train: TrainType) => void;
}

const TYPE_COLORS: Record<string, string> = {
  EIP: 'border-purple-500/50 bg-purple-500/10 text-purple-700 dark:text-purple-300',
  IC: 'border-blue-500/50 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  TLK: 'border-blue-400/50 bg-blue-400/10 text-blue-600 dark:text-blue-300',
  KM: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  Polregio: 'border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-300',
  Cargo: 'border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300',
};

export function TrainCard({ train, userPosition, enthusiastMode, onSelect }: TrainCardProps) {
  const [geofenceRadius] = useGeofenceRadius();

  const dist = useMemo(() => {
    if (!userPosition) return null;
    return calculateDistanceMeters(
      userPosition.lat, userPosition.lng,
      train.currentPosition.lat, train.currentPosition.lng
    );
  }, [userPosition, train.currentPosition]);

  const approaching = useMemo(() => {
    if (!userPosition) return true;
    return isTrainApproaching(
      userPosition.lat, userPosition.lng,
      train.currentPosition.lat, train.currentPosition.lng,
      train.heading || 0
    );
  }, [userPosition, train.currentPosition, train.heading]);

  const eta = useMemo(() => {
    if (!dist) return null;
    const speed = Math.max(train.speed, 8);
    return Math.round(dist / speed);
  }, [dist, train.speed]);

  const alertLevel: AlertLevel = useMemo(() => {
    if (!dist) return 'safe';
    if (dist <= geofenceRadius * 0.5 || (dist <= geofenceRadius && approaching && (eta ?? 999) <= 15)) return 'critical';
    if (dist <= geofenceRadius || (dist <= geofenceRadius * 1.2 && approaching && (eta ?? 999) <= 30)) return 'warning';
    return 'safe';
  }, [dist, eta, approaching, geofenceRadius]);

  const etaLabel = useMemo(() => {
    if (!eta || !userPosition) return null;
    if (!approaching && dist && dist > 200) return null;
    if (eta < 15) return 'Tuż obok';
    if (eta < 60) return `${eta}s`;
    const m = Math.floor(eta / 60);
    const s = eta % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }, [eta, approaching, dist, userPosition]);

  const kmh = Math.round(train.speed * 3.6);
  const distLabel = dist
    ? dist > 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist)} m`
    : null;

  const typeBadgeColor = TYPE_COLORS[train.type] || 'border-border text-foreground';

  return (
    <div
      onClick={() => onSelect?.(train)}
      className={cn(
        "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-colors",
        alertLevel === 'critical'
          ? 'border-destructive bg-destructive/10 animate-pulse'
          : alertLevel === 'warning'
          ? 'border-amber-500/60 bg-amber-500/5'
          : 'border-border/60 bg-card hover:bg-muted/40'
      )}
    >
      {/* Left: type badge + train ID */}
      <div className="flex flex-col items-center gap-0.5 shrink-0 w-12">
        <Badge variant="outline" className={cn("text-[9px] font-mono px-1.5 py-0 h-4 rounded-full font-bold", typeBadgeColor)}>
          {train.type}
        </Badge>
        {alertLevel !== 'safe' && (
          <AlertTriangle className={cn("h-3 w-3", alertLevel === 'critical' ? 'text-destructive' : 'text-amber-500')} />
        )}
      </div>

      {/* Center: train info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold font-headline truncate">{train.id}</span>
          {train.conjoinedCount && train.conjoinedCount > 1 && (
            <Badge variant="secondary" className="text-[8px] font-mono px-1 py-0 h-3.5 bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0">
              x{train.conjoinedCount} składy
            </Badge>
          )}
          {train.name && <span className="text-xs text-muted-foreground truncate hidden sm:inline">"{train.name}"</span>}
          {(train.delayMinutes || 0) > 0 && (
            <span className="text-[9px] text-amber-600 dark:text-amber-400 font-mono font-bold">+{train.delayMinutes}'</span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
          <Route className="h-3 w-3 shrink-0 text-primary/60" />
          <span className="truncate">{train.route}</span>
        </p>
        {enthusiastMode && train.rollingStock && (
          <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5">{train.rollingStock}</p>
        )}
      </div>

      {/* Right: ETA + speed + distance */}
      <div className="flex flex-col items-end gap-0.5 shrink-0">
        {etaLabel && (
          <span className={cn(
            "text-sm font-bold font-mono",
            alertLevel === 'critical' ? 'text-destructive' : 'text-foreground'
          )}>
            {etaLabel}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground font-mono">{kmh} km/h</span>
        {distLabel && <span className="text-[10px] text-muted-foreground/70 font-mono">{distLabel}</span>}
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
    </div>
  );
}
