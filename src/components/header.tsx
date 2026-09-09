"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Siren, Menu, Train, MessageSquarePlus, Sparkles, Home, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SosDialog } from '@/components/sos-dialog';
import { HazardReportDialog } from '@/components/hazard-report-dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { getPkpConfig, fetchLivePlkStats, PlkStatistics } from '@/services/pkp-api';

interface HeaderProps {
  enthusiastMode: boolean;
  onEnthusiastModeChange: (value: boolean) => void;
  isSosOpen?: boolean;
  onSosOpenChange?: (open: boolean) => void;
}

export function Header({
  enthusiastMode,
  onEnthusiastModeChange,
  isSosOpen: externalSosOpen,
  onSosOpenChange: setExternalSosOpen,
}: HeaderProps) {
  const [internalSosOpen, setInternalSosOpen] = useState(false);
  const [isHazardReportOpen, setIsHazardReportOpen] = useState(false);
  const [plkStats, setPlkStats] = useState<PlkStatistics | null>(null);

  const isSosOpen = externalSosOpen !== undefined ? externalSosOpen : internalSosOpen;
  const setIsSosOpen = setExternalSosOpen || setInternalSosOpen;

  const pkpConfig = getPkpConfig();

  useEffect(() => {
    fetchLivePlkStats().then((stats) => {
      if (stats) setPlkStats(stats);
    });
  }, []);

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 sm:h-16 items-center justify-between px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/" className="rounded-lg bg-primary p-1.5 sm:p-2 text-primary-foreground shadow-sm hover:opacity-90 transition">
              <Train className="h-5 w-5 sm:h-6 sm:w-6" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link href="/app" className="font-headline text-lg sm:text-xl font-bold text-primary tracking-tight hover:opacity-90">
                  SafeTracks
                </Link>
                <Badge
                  variant="default"
                  className="text-[10px] px-2 py-0.5 h-5 font-mono hidden xs:flex items-center gap-1.5 bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 shadow-sm"
                  title="Oficjalny klucz OpenDataAPI PKP PLK został aktywowany dla SafeTrack"
                >
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>PKP PLK Live: {plkStats ? `${plkStats.inProgress} na szlaku` : 'Autoryzowany'}</span>
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground hidden sm:block">
                System Ochrony Pieszych & Radar Kolejowy
              </p>
            </div>
          </div>

          <div className="hidden items-center gap-2.5 md:flex">
            <Link href="/">
              <Button variant="ghost" size="sm" className="text-xs h-9 gap-1.5 text-muted-foreground hover:text-foreground">
                <Home className="h-4 w-4" />
                <span>Strona Główna</span>
              </Button>
            </Link>

            <div className="flex items-center space-x-2 bg-muted/60 px-3 py-1.5 rounded-full border">
              <Switch
                id="enthusiast-mode"
                checked={enthusiastMode}
                onCheckedChange={onEnthusiastModeChange}
              />
              <Label htmlFor="enthusiast-mode" className="cursor-pointer text-xs font-medium flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>Tryb Pasjonata</span>
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsHazardReportOpen(true)}
              className="text-xs h-9 gap-1.5"
            >
              <MessageSquarePlus className="h-4 w-4 text-amber-600" />
              <span>Zgłoś przejście</span>
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsSosOpen(true)}
              className="text-xs h-9 font-bold gap-1.5 shadow-md shadow-destructive/20 animate-pulse"
            >
              <Siren className="h-4 w-4" />
              <span>SOS 112</span>
            </Button>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsSosOpen(true)}
              className="h-8 px-2.5 text-xs font-bold gap-1 shadow-sm animate-pulse"
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
              <SheetContent side="right" className="w-[280px]">
                <div className="flex flex-col gap-5 pt-6">
                  <div className="flex items-center gap-2 border-b pb-4">
                    <Train className="h-5 w-5 text-primary" />
                    <span className="font-bold text-base">SafeTracks</span>
                    <Badge variant="outline" className="text-[10px] ml-auto text-emerald-400 border-emerald-500/40">
                      PKP PLK Live
                    </Badge>
                  </div>

                  <Link href="/" className="w-full">
                    <Button variant="outline" className="w-full justify-start text-xs h-9 gap-2">
                      <Home className="h-4 w-4 text-primary" />
                      <span>Strona Główna / O Projekcie</span>
                    </Button>
                  </Link>

                  <div className="flex items-center justify-between bg-muted/60 p-3 rounded-lg">
                    <Label htmlFor="enthusiast-mode-mobile" className="text-sm font-medium flex items-center gap-1.5">
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
                    className="w-full justify-start text-sm"
                    variant="outline"
                    onClick={() => {
                      setIsHazardReportOpen(true);
                    }}
                  >
                    <MessageSquarePlus className="mr-2 h-4 w-4 text-amber-600" />
                    Zgłoś dzikie przejście / przeszkodę
                  </Button>

                  <Button
                    className="w-full justify-start text-sm"
                    variant="destructive"
                    onClick={() => {
                      setIsSosOpen(true);
                    }}
                  >
                    <Siren className="mr-2 h-4 w-4" />
                    Moduł SOS (112 / PLK)
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
