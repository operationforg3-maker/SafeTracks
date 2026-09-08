"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { Dashboard } from '@/components/dashboard';
import { MapView } from '@/components/map-view';
import { useMockTrains } from '@/hooks/use-mock-trains';
import { ProximityAlertBanner } from '@/components/proximity-alert-banner';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { Map, ListFilter, Columns2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [enthusiastMode, setEnthusiastMode] = useState(false);
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [mobileView, setMobileView] = useState<'split' | 'map' | 'radar'>('split');
  const trains = useMockTrains();

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
      <Header
        enthusiastMode={enthusiastMode}
        onEnthusiastModeChange={setEnthusiastMode}
        isSosOpen={isSosOpen}
        onSosOpenChange={setIsSosOpen}
      />

      {/* Krytyczny pasek ostrzegawczy o zbliżających się pociągach */}
      <ProximityAlertBanner
        trains={trains}
        onOpenSos={() => setIsSosOpen(true)}
      />

      {/* Przełącznik widoku na urządzeniach mobilnych */}
      <div className="flex sm:hidden items-center justify-center gap-1 bg-muted/80 p-1 border-b text-xs">
        <Button
          size="sm"
          variant={mobileView === 'split' ? 'default' : 'ghost'}
          className="h-7 text-[11px] px-2.5 gap-1"
          onClick={() => setMobileView('split')}
        >
          <Columns2 className="h-3.5 w-3.5" />
          <span>Podział</span>
        </Button>
        <Button
          size="sm"
          variant={mobileView === 'map' ? 'default' : 'ghost'}
          className="h-7 text-[11px] px-2.5 gap-1"
          onClick={() => setMobileView('map')}
        >
          <Map className="h-3.5 w-3.5" />
          <span>Pełna Mapa</span>
        </Button>
        <Button
          size="sm"
          variant={mobileView === 'radar' ? 'default' : 'ghost'}
          className="h-7 text-[11px] px-2.5 gap-1"
          onClick={() => setMobileView('radar')}
        >
          <ListFilter className="h-3.5 w-3.5" />
          <span>Radar ({trains.length})</span>
        </Button>
      </div>

      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Kontener Mapy */}
        <div
          className={`relative transition-all duration-200 border-b ${
            mobileView === 'radar'
              ? 'hidden sm:flex sm:flex-[3]'
              : mobileView === 'map'
              ? 'flex-1'
              : 'flex-[3]'
          }`}
        >
          <MapView trains={trains} enthusiastMode={enthusiastMode} />
        </div>

        {/* Kontener Radaru / Dashboardu */}
        <div
          className={`relative transition-all duration-200 ${
            mobileView === 'map'
              ? 'hidden sm:flex sm:flex-[2]'
              : mobileView === 'radar'
              ? 'flex-1'
              : 'flex-[2]'
          }`}
        >
          <Dashboard trains={trains} enthusiastMode={enthusiastMode} />
        </div>
      </main>

      {/* Baner instalacji PWA na telefonie */}
      <PwaInstallBanner />
    </div>
  );
}
