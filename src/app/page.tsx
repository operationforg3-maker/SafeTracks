"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { Dashboard } from '@/components/dashboard';
import { MapView } from '@/components/map-view';
import { useMockTrains } from '@/hooks/use-mock-trains';
import { ProximityAlertBanner } from '@/components/proximity-alert-banner';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { TrainSpotDialog } from '@/components/train-spot-dialog';
import { TrainDetailDrawer } from '@/components/train-detail-drawer';
import { useGeolocation } from '@/hooks/use-geolocation';
import type { Train } from '@/lib/types';
import { Map, ListFilter, Columns2, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [enthusiastMode, setEnthusiastMode] = useState(false);
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isSpotDialogOpen, setIsSpotDialogOpen] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [mobileView, setMobileView] = useState<'split' | 'map' | 'radar'>('split');

  const { trains, addSpottedTrain } = useMockTrains();
  const { position: userPosition } = useGeolocation();

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground">
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
      <div className="flex sm:hidden items-center justify-between bg-muted/80 p-1 px-2 border-b text-xs">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={mobileView === 'split' ? 'default' : 'ghost'}
            className="h-7 text-[11px] px-2 gap-1"
            onClick={() => setMobileView('split')}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span>Podział</span>
          </Button>
          <Button
            size="sm"
            variant={mobileView === 'map' ? 'default' : 'ghost'}
            className="h-7 text-[11px] px-2 gap-1"
            onClick={() => setMobileView('map')}
          >
            <Map className="h-3.5 w-3.5" />
            <span>Mapa</span>
          </Button>
          <Button
            size="sm"
            variant={mobileView === 'radar' ? 'default' : 'ghost'}
            className="h-7 text-[11px] px-2 gap-1"
            onClick={() => setMobileView('radar')}
          >
            <ListFilter className="h-3.5 w-3.5" />
            <span>Radar ({trains.length})</span>
          </Button>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-[11px] px-2 gap-1 border-amber-500/40 text-amber-500 bg-amber-500/10"
          onClick={() => setIsSpotDialogOpen(true)}
        >
          <PackageCheck className="h-3.5 w-3.5" />
          <span>Spotuj</span>
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
          <MapView
            trains={trains}
            enthusiastMode={enthusiastMode}
            onTrainSelect={(train) => setSelectedTrain(train)}
            onOpenSpotDialog={() => setIsSpotDialogOpen(true)}
          />
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
          <Dashboard
            trains={trains}
            enthusiastMode={enthusiastMode}
            onTrainSelect={(train) => setSelectedTrain(train)}
            onOpenSpotDialog={() => setIsSpotDialogOpen(true)}
          />
        </div>
      </main>

      {/* Szybki dialog spotowania składu towarowego/pasażerskiego */}
      <TrainSpotDialog
        open={isSpotDialogOpen}
        onOpenChange={setIsSpotDialogOpen}
        onTrainSpotted={(newTrain) => {
          addSpottedTrain(newTrain);
        }}
      />

      {/* Drawer ze szczegółami wybranego pociągu (Flightradar style) */}
      <TrainDetailDrawer
        train={selectedTrain}
        isOpen={Boolean(selectedTrain)}
        onClose={() => setSelectedTrain(null)}
        userPosition={userPosition}
      />

      {/* Baner instalacji PWA na telefonie */}
      <PwaInstallBanner />
    </div>
  );
}
