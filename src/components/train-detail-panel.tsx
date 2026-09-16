"use client";

import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Gauge,
  Route,
  Train as TrainIcon,
  Clock,
  ArrowLeft,
  X,
  Layers,
  ChevronDown,
  ChevronUp,
  MapPin,
  Crosshair,
  AlertCircle,
  CheckCircle2,
  CircleDot
} from 'lucide-react';
import type { Train as TrainType, TrainStop } from '@/lib/types';
import type { Position } from '@/hooks/use-geolocation';
import { calculateDistanceMeters } from '@/services/pkp-api';

interface TrainDetailPanelProps {
  train: TrainType | null;
  onClose: () => void;
  userPosition?: Position;
  onCenterOnTrain?: (train: TrainType) => void;
  onSelectStation?: (lat: number, lng: number) => void;
  isMobileDrawer?: boolean;
}

export function TrainDetailPanel({
  train,
  onClose,
  userPosition,
  onCenterOnTrain,
  onSelectStation,
  isMobileDrawer = false,
}: TrainDetailPanelProps) {
  const [isTimelineExpanded, setIsTimelineExpanded] = useState(true);

  if (!train) return null;

  const distMeters = userPosition
    ? calculateDistanceMeters(
        userPosition.lat,
        userPosition.lng,
        train.currentPosition.lat,
        train.currentPosition.lng
      )
    : null;

  const speedKmh = Math.round((train.speed || 0) * 3.6);
  const etaSeconds = distMeters && train.speed > 0 ? Math.round(distMeters / train.speed) : null;

  const timetable = train.timetable || [];

  return (
    <div className={`flex flex-col h-full bg-card/95 backdrop-blur-md text-foreground ${
      isMobileDrawer ? 'border-t border-border shadow-2xl rounded-t-2xl max-h-[65vh]' : 'border-l border-border w-full'
    }`}>
      {/* Top Header Bar */}
      <div className="p-3 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/20">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 px-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Wróć do radaru</span>
          </Button>
        </div>

        <div className="flex items-center gap-1">
          {onCenterOnTrain && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onCenterOnTrain(train)}
              className="h-8 px-2.5 text-xs flex items-center gap-1 border-primary/30 text-primary hover:bg-primary/10"
              title="Wycentruj mapę na pociągu"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">Namierz</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-4">
          {/* Train Identity & Badges */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs uppercase px-2 py-0.5 border-primary/40 bg-primary/10 text-primary font-bold">
                {train.type}
              </Badge>
              {train.delayMinutes && train.delayMinutes > 0 ? (
                <Badge variant="destructive" className="text-xs font-bold">
                  +{train.delayMinutes} min opóźnienia
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs text-emerald-500 bg-emerald-500/10 border-emerald-500/30 font-medium">
                  Punktualnie (0 min)
                </Badge>
              )}
              {train.conjoinedCount && train.conjoinedCount > 1 && (
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 font-mono text-xs font-bold">
                  {train.conjoinedCount}x skład ukrotniony
                </Badge>
              )}
            </div>

            <div>
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-black tracking-tight font-headline">
                  {train.name || train.id}
                </h2>
                {train.name && (
                  <span className="text-xs font-mono text-muted-foreground font-semibold">
                    #{train.id}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Route className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="font-medium">{train.route}</span>
              </div>
            </div>
          </div>

          {/* Live Telemetry KPI Cards */}
          <div className="grid grid-cols-2 gap-2.5">
            {/* Speedometer Card */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Prędkość live</span>
                <Gauge className={`h-3.5 w-3.5 ${speedKmh > 0 ? 'text-emerald-500 animate-pulse' : 'text-amber-500'}`} />
              </div>

              {speedKmh > 0 ? (
                <div className="my-1">
                  <div className="text-2xl font-black font-mono tracking-tight text-foreground flex items-baseline gap-1">
                    <span>{speedKmh}</span>
                    <span className="text-xs font-normal text-muted-foreground font-sans">km/h</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {train.speed.toFixed(1)} m/s na szlaku
                  </span>
                </div>
              ) : (
                <div className="my-1.5">
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-sm">
                    <span>Postój</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    stacja / semafor
                  </div>
                </div>
              )}
            </div>

            {/* ETA to User Card */}
            <div className="p-3 rounded-xl bg-muted/30 border border-border/70 flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Do Twojej pozycji</span>
                <Clock className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="my-1">
                <div className="text-xl font-bold font-mono text-foreground truncate">
                  {etaSeconds !== null ? `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s` : '--'}
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {distMeters !== null
                    ? `${(distMeters / 1000).toFixed(1)} km w linii prostej`
                    : 'Brak aktywnego GPS'}
                </div>
              </div>
            </div>
          </div>

          {/* Rolling Stock & Carrier Card */}
          <div className="p-3 rounded-xl bg-muted/20 border border-border/60 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrainIcon className="h-3.5 w-3.5 text-primary" />
              <span>Przewoźnik & Tabor</span>
            </div>
            <div className="text-sm font-bold text-foreground">
              {train.operator || 'PKP Intercity'}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              {train.rollingStock || 'Tabor kolejowy PKP'}
            </div>
          </div>

          {/* Conjoined Units (if coupled) */}
          {train.conjoinedUnits && train.conjoinedUnits.length > 1 && (
            <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400">
                  <Layers className="h-4 w-4" />
                  <span>Połączone jednostki ({train.conjoinedUnits.length})</span>
                </div>
                <span className="text-[10px] text-blue-500 font-medium">Trakcja wielokrotna</span>
              </div>
              <div className="space-y-1.5">
                {train.conjoinedUnits.map((unit, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs bg-card/90 p-2 rounded-lg border border-border/50">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-foreground">{unit.id}</span>
                      {unit.name && <span className="text-[10px] text-muted-foreground">"{unit.name}"</span>}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>➔ {unit.destination}</span>
                      {(unit.delayMinutes || 0) > 0 ? (
                        <span className="text-destructive font-mono font-bold">+{unit.delayMinutes}'</span>
                      ) : (
                        <span className="text-emerald-500 font-mono">0'</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Route Timetable Timeline */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Trasa i stacje
                </h3>
                {timetable.length > 0 && (
                  <Badge variant="secondary" className="font-mono text-[10px] px-1.5 py-0 h-4">
                    {timetable.length}
                  </Badge>
                )}
              </div>
              {timetable.length > 3 && (
                <button
                  onClick={() => setIsTimelineExpanded(!isTimelineExpanded)}
                  className="text-primary text-[11px] font-semibold hover:underline flex items-center gap-0.5"
                >
                  <span>{isTimelineExpanded ? 'Zwiń' : 'Rozwiń'}</span>
                  {isTimelineExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>

            {timetable.length > 0 ? (
              <div className={`space-y-0 relative border-l-2 border-border/80 ml-2.5 pl-3.5 py-1 ${
                !isTimelineExpanded ? 'max-h-48 overflow-hidden relative' : ''
              }`}>
                {timetable.map((stop, idx) => {
                  const isPassed = stop.status === 'passed';
                  const isCurrent = stop.status === 'current';
                  const isNext = stop.status === 'next';

                  const depTime = stop.actualDeparture || stop.plannedDeparture;
                  const arrTime = stop.actualArrival || stop.plannedArrival;
                  const hasDelay = (stop.delayMinutes || 0) > 0;

                  return (
                    <div
                      key={idx}
                      className={`relative pb-3 last:pb-0 group transition-colors ${
                        isCurrent ? 'bg-amber-500/5 -ml-3.5 pl-3.5 py-1.5 rounded-r-lg border-l-2 border-amber-500' : ''
                      }`}
                    >
                      {/* Timeline marker icon */}
                      <div className="absolute -left-[21px] top-1 flex items-center justify-center">
                        {isCurrent ? (
                          <div className="relative">
                            <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-amber-400 opacity-75"></span>
                            <CircleDot className="h-3.5 w-3.5 text-amber-500 relative" />
                          </div>
                        ) : isPassed ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground/60 bg-background rounded-full" />
                        ) : isNext ? (
                          <div className="w-2.5 h-2.5 rounded-full border-2 border-primary bg-background" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-border" />
                        )}
                      </div>

                      {/* Station Info Row */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs font-bold truncate ${
                              isCurrent ? 'text-amber-500 dark:text-amber-400' : isPassed ? 'text-muted-foreground' : 'text-foreground'
                            }`}>
                              {stop.stationName}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] uppercase font-black tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded border border-amber-500/30">
                                Teraz tutaj
                              </span>
                            )}
                            {isNext && (
                              <span className="text-[9px] uppercase font-bold tracking-wider bg-primary/20 text-primary px-1.5 py-0.2 rounded">
                                Następna
                              </span>
                            )}
                          </div>

                          <div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
                            {arrTime && <span>Przyj: <strong className="font-mono">{arrTime}</strong></span>}
                            {depTime && <span>Odj: <strong className="font-mono">{depTime}</strong></span>}
                          </div>
                        </div>

                        {/* Station Delay Tag */}
                        <div className="text-right shrink-0">
                          {hasDelay ? (
                            <span className="text-[10px] font-mono font-bold text-destructive">
                              +{stop.delayMinutes}'
                            </span>
                          ) : isPassed ? (
                            <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                              o czasie
                            </span>
                          ) : null}
                        </div>
                      </div>

                      {/* Clickable center on station if coordinates exist */}
                      {onSelectStation && stop.lat && stop.lng && (
                        <button
                          onClick={() => onSelectStation(stop.lat!, stop.lng!)}
                          className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          <span>Pokaż stację na mapie</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-muted/20 text-xs text-muted-foreground text-center">
                Szczegółowy rozkład przystanków jest aktualizowany...
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
