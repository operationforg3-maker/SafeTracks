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
      <header className="sticky top-0 z-40 w-full border-b bg-card/95 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 transition-colors">
        <div className="container flex h-12 items-center justify-between px-3 sm:px-6">
          {/* Logo — compact */}
          <div className="flex items-center gap-2">
            <Link href="/" className="rounded-lg bg-primary p-1.5 text-primary-foreground shadow-sm hover:opacity-90 transition">
              <Train className="h-4 w-4" />
            </Link>
            <Link href="/app" className="font-headline text-base font-bold text-foreground tracking-tight hover:opacity-90">
              SafeTracks
            </Link>
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 font-mono hidden sm:flex items-center gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span>LIVE{plkStats ? ` · ${plkStats.inProgress}` : ''}</span>
            </Badge>
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
              className={`text-[11px] h-8 font-bold gap-1 shadow-sm ${isCritical ? 'animate-pulse' : ''}`}
            >
              <Siren className="h-3.5 w-3.5" />
              <span>SOS 112</span>
            </Button>
          </div>

          {/* Mobile actions */}
          <div className="flex items-center gap-1.5 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="h-8 w-8 text-foreground hover:bg-muted"
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
              className={`h-7 px-2 text-[11px] font-bold gap-1 shadow-sm ${isCritical ? 'animate-pulse' : ''}`}
            >
              <Siren className="h-3.5 w-3.5" />
              <span>SOS</span>
            </Button>

            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] bg-card text-card-foreground">
                <div className="flex flex-col gap-3 pt-4">
                  <div className="flex items-center gap-2 border-b pb-3">
                    <div className="rounded-lg bg-primary p-1.5 text-primary-foreground">
                      <Train className="h-4 w-4" />
                    </div>
                    <span className="font-bold text-sm font-headline">SafeTracks</span>
                    <Badge variant="outline" className="text-[9px] ml-auto text-emerald-500 border-emerald-500/40">
                      LIVE
                    </Badge>
                  </div>

                  <Link href="/" className="w-full">
                    <Button variant="outline" className="w-full justify-start text-xs h-9 gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <span>Strona Główna</span>
                    </Button>
                  </Link>

                  <div className="flex items-center justify-between bg-muted/60 p-3 rounded-xl border">
                    <Label htmlFor="enthusiast-mode-mobile" className="text-xs font-medium flex items-center gap-1.5 cursor-pointer">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span>Tryb Pasjonata</span>
                    </Label>
                    <Switch
                      id="enthusiast-mode-mobile"
                      checked={enthusiastMode}
                      onCheckedChange={onEnthusiastModeChange}
                    />
                  </div>

                  <Button
                    className="w-full justify-start text-xs h-9"
                    variant="outline"
                    onClick={() => setIsHazardReportOpen(true)}
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4 text-amber-500" />
                    Zgłoś dzikie przejście
                  </Button>

                  <Button
                    className="w-full justify-start text-xs h-9"
                    variant="destructive"
                    onClick={() => setIsSosOpen(true)}
                  >
                    <Siren className="mr-2 h-4 w-4" />
                    SOS — 112
                  </Button>
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
