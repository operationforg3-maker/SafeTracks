"use client";

import { useState, useMemo } from 'react';
import { Header } from '@/components/header';
import { Dashboard } from '@/components/dashboard';
import { MapView } from '@/components/map-view';
import { useMockTrains } from '@/hooks/use-mock-trains';
import { ProximityAlertBanner } from '@/components/proximity-alert-banner';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { TrainSpotDialog } from '@/components/train-spot-dialog';
import { TrainDetailPanel } from '@/components/train-detail-panel';
import { StationSearchDialog } from '@/components/station-search-dialog';
import { RadarLoader } from '@/components/radar-loader';
import { useGeolocation } from '@/hooks/use-geolocation';
import { evaluateProximitySafety } from '@/services/proximity-engine';
import { useGeofenceRadius } from '@/services/geofence-settings';
import type { Train } from '@/lib/types';
import { List, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Home() {
  const [enthusiastMode, setEnthusiastMode] = useState(false);
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isSpotDialogOpen, setIsSpotDialogOpen] = useState(false);
  const [isStationSearchOpen, setIsStationSearchOpen] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState<Train | null>(null);
  const [showMobileList, setShowMobileList] = useState(false);
  const [isRadarReady, setIsRadarReady] = useState(false);

  const { position: userPosition, loading: geoLoading } = useGeolocation();
  const [geofenceRadius] = useGeofenceRadius();
  const {
    trains,
    activeStation,
    setActiveStation,
    isLoading: isLoadingTrains,
    lastSync,
    refreshNow,
    addSpottedTrain,
  } = useMockTrains(userPosition);

  // Determine alert level for header SOS pulse
  const alertLevel = useMemo(() => {
    const state = evaluateProximitySafety(userPosition, trains, false, activeStation, geofenceRadius);
    return state.level;
  }, [userPosition, trains, activeStation, geofenceRadius]);

  return (
    <div className="flex h-screen w-full flex-col bg-background overflow-hidden">
      {/* Loader */}
      <RadarLoader
        userPosition={userPosition}
        geoLoading={geoLoading}
        activeStation={activeStation}
        trains={trains}
        isLoadingTrains={isLoadingTrains}
        onFinish={() => setIsRadarReady(true)}
      />

      <Header
        enthusiastMode={enthusiastMode}
        onEnthusiastModeChange={setEnthusiastMode}
        isSosOpen={isSosOpen}
        onSosOpenChange={setIsSosOpen}
        alertLevel={alertLevel}
      />

      {/* Alert banner — only shows when warning/critical */}
      <ProximityAlertBanner
        trains={trains}
        onOpenSos={() => setIsSosOpen(true)}
        activeStation={activeStation}
      />

      <main className="flex flex-1 overflow-hidden relative">
        {/* Map — always full width */}
        <div className="flex-1 relative">
          <MapView
            trains={trains}
            enthusiastMode={enthusiastMode}
            onTrainSelect={(train) => setSelectedTrain(train)}
            onOpenSpotDialog={() => setIsSpotDialogOpen(true)}
            selectedTrain={selectedTrain}
          />

          {/* Mobile: floating button to open train list */}
          {!showMobileList && !selectedTrain && (
            <div className="absolute bottom-4 left-4 z-[500] sm:hidden">
              <Button
                size="sm"
                onClick={() => setShowMobileList(true)}
                className="h-10 px-4 shadow-xl bg-card text-card-foreground border border-border gap-2 font-bold text-xs hover:bg-muted"
              >
                <List className="h-4 w-4" />
                <span>Lista ({trains.length})</span>
              </Button>
            </div>
          )}

          {/* Mobile: slide-up train list overlay */}
          {showMobileList && (
            <div className="absolute inset-x-0 bottom-0 z-[1050] sm:hidden h-[55%] bg-card/98 backdrop-blur-md border-t rounded-t-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2 mb-1" />
              <Dashboard
                trains={trains}
                enthusiastMode={enthusiastMode}
                onTrainSelect={(train) => {
                  setSelectedTrain(train);
                  setShowMobileList(false);
                }}
                activeStation={activeStation}
                onOpenStationSearch={() => setIsStationSearchOpen(true)}
                isLoading={isLoadingTrains}
                lastSync={lastSync}
                onRefresh={refreshNow}
                onClose={() => setShowMobileList(false)}
              />
            </div>
          )}

          {/* Mobile: Non-blocking Floating Bottom Inspector Card */}
          {selectedTrain && (
            <div className="sm:hidden absolute inset-x-0 bottom-0 z-[1000] max-h-[42vh] flex flex-col bg-card/98 backdrop-blur-md rounded-t-2xl border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300">
              <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2 mb-1 shrink-0" />
              <TrainDetailPanel
                train={selectedTrain}
                onClose={() => setSelectedTrain(null)}
                userPosition={userPosition}
                isMobileDrawer={true}
              />
            </div>
          )}
        </div>

        {/* Desktop: sidebar (Switches to TrainDetailPanel when a train is selected, leaving map 100% visible!) */}
        <div className="hidden sm:flex sm:w-[380px] lg:w-[420px] border-l shrink-0">
          {selectedTrain ? (
            <TrainDetailPanel
              train={selectedTrain}
              onClose={() => setSelectedTrain(null)}
              userPosition={userPosition}
            />
          ) : (
            <Dashboard
              trains={trains}
              enthusiastMode={enthusiastMode}
              onTrainSelect={(train) => setSelectedTrain(train)}
              activeStation={activeStation}
              onOpenStationSearch={() => setIsStationSearchOpen(true)}
              isLoading={isLoadingTrains}
              lastSync={lastSync}
              onRefresh={refreshNow}
            />
          )}
        </div>
      </main>

      <TrainSpotDialog
        open={isSpotDialogOpen}
        onOpenChange={setIsSpotDialogOpen}
        onTrainSpotted={(newTrain) => addSpottedTrain(newTrain)}
      />

      <StationSearchDialog
        open={isStationSearchOpen}
        onOpenChange={setIsStationSearchOpen}
        activeStation={activeStation}
        onSelectStation={(station) => setActiveStation(station)}
        userPosition={userPosition}
      />

      <PwaInstallBanner />
    </div>
  );
}
