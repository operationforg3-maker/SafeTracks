"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Siren, Menu, Train, MessageSquarePlus, Sparkles, Home, Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SosDialog } from '@/components/sos-dialog';
import { HazardReportDialog } from '@/components/hazard-report-dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getPkpConfig, fetchLivePlkStats, PlkStatistics } from '@/services/pkp-api';
import { useTheme } from '@/components/theme-provider';

interface HeaderProps {
  enthusiastMode: boolean;
  onEnthusiastModeChange: (value: boolean) => void;
  isSosOpen?: boolean;
  onSosOpenChange?: (open: boolean) => void;
  alertLevel?: 'safe' | 'warning' | 'critical';
}

export function Header({
  enthusiastMode,
  onEnthusiastModeChange,
  isSosOpen: externalSosOpen,
  onSosOpenChange: setExternalSosOpen,
  alertLevel = 'safe',
}: HeaderProps) {
  const [internalSosOpen, setInternalSosOpen] = useState(false);
  const [isHazardReportOpen, setIsHazardReportOpen] = useState(false);
  const [plkStats, setPlkStats] = useState<PlkStatistics | null>(null);
  const { effectiveTheme, toggleTheme } = useTheme();

  const isSosOpen = externalSosOpen !== undefined ? externalSosOpen : internalSosOpen;
  const setIsSosOpen = setExternalSosOpen || setInternalSosOpen;

  useEffect(() => {
    fetchLivePlkStats().then((stats) => {
      if (stats) setPlkStats(stats);
    });
  }, []);

  const isCritical = alertLevel === 'critical';

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 transition-colors select-none">
        <div className="w-full max-w-7xl mx-auto flex h-12 items-center justify-between px-3 sm:px-6">
          {/* Logo & LIVE status */}
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/"
              className="rounded-lg bg-primary p-1.5 text-primary-foreground shadow-sm hover:opacity-90 transition shrink-0"
              title="Strona główna"
            >
              <Train className="h-4 w-4" />
            </Link>
            <Link
              href="/app"
              className="font-headline text-base font-bold text-foreground tracking-tight hover:opacity-90 shrink-0"
            >
              SafeTracks
            </Link>
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-mono shrink-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <span className="font-semibold">LIVE</span>
              {plkStats && (
                <span className="hidden sm:inline opacity-75">· {plkStats.inProgress}</span>
              )}
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden items-center gap-2 md:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              title={effectiveTheme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny'}
            >
              {effectiveTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )}
            </Button>

            <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-full border border-border/80">
              <Switch
                id="enthusiast-mode"
                checked={enthusiastMode}
                onCheckedChange={onEnthusiastModeChange}
                className="scale-90"
              />
              <Label htmlFor="enthusiast-mode" className="cursor-pointer text-[11px] font-medium flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>Pasjonat</span>
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHazardReportOpen(true)}
              className="text-[11px] h-8 gap-1"
            >
              <MessageSquarePlus className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>Zgłoś</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsSosOpen(true)}
              className={`text-[11px] h-8 font-bold gap-1.5 shadow-sm px-3 ${isCritical ? 'animate-pulse' : ''}`}
            >
              <Siren className="h-3.5 w-3.5" />
              <span>SOS 112</span>
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-1 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-foreground hover:bg-muted"
              title={effectiveTheme === 'dark' ? 'Motyw jasny' : 'Motyw ciemny'}
            >
              {effectiveTheme === 'dark' ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-500" />
              )}
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsSosOpen(true)}
              className={`h-8 px-2.5 text-xs font-bold gap-1 shadow-sm ${isCritical ? 'animate-pulse' : ''}`}
            >
              <Siren className="h-3.5 w-3.5" />
              <span>112</span>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 ml-0.5">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] bg-card text-card-foreground p-5 flex flex-col justify-between">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
                      <Train className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="font-bold text-sm font-headline block leading-tight">SafeTracks</span>
                      <span className="text-[10px] text-muted-foreground">Radar Kolejowy PLK</span>
                    </div>
                    <Badge variant="outline" className="text-[9px] ml-auto text-emerald-500 border-emerald-500/40 font-mono">
                      LIVE {plkStats ? `(${plkStats.inProgress})` : ''}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between bg-muted/60 p-3 rounded-xl border border-border/70">
                    <div className="flex flex-col">
                      <Label htmlFor="enthusiast-mode-mobile" className="text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                        <span>Tryb Pasjonata</span>
                      </Label>
                      <span className="text-[10px] text-muted-foreground">Numery pociągów, wagony, relacje</span>
                    </div>
                    <Switch
                      id="enthusiast-mode-mobile"
                      checked={enthusiastMode}
                      onCheckedChange={onEnthusiastModeChange}
                    />
                  </div>

                  <Button
                    className="w-full justify-start text-xs h-10 gap-2 border-amber-500/30 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    variant="outline"
                    onClick={() => setIsHazardReportOpen(true)}
                  >
                    <MessageSquarePlus className="h-4 w-4 text-amber-500" />
                    <span>Zgłoś dzikie przejście / usterkę</span>
                  </Button>

                  <Link href="/" className="w-full">
                    <Button variant="outline" className="w-full justify-start text-xs h-10 gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <span>Strona Główna</span>
                    </Button>
                  </Link>
                </div>

                <div className="border-t pt-3 text-[10px] text-muted-foreground text-center space-y-1">
                  <p>SafeTracks Radar © 2026</p>
                  <p>Dane: PKP PLK S.A. Portal Pasażera</p>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <SosDialog open={isSosOpen} onOpenChange={setIsSosOpen} />
      <HazardReportDialog open={isHazardReportOpen} onOpenChange={setIsHazardReportOpen} />
    </>
  );
}
