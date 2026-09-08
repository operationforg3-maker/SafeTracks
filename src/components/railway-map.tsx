"use client";

import { useEffect, useRef, useState } from 'react';
import type { Train, RailwayCrossing, HazardReport } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { railwayCrossings, initialHazardReports } from '@/lib/data';
import { TrainFront, Locate, Layers, ShieldAlert, Settings, PackageCheck, Eye, EyeOff } from 'lucide-react';
import { Button } from './ui/button';
import { MapSettingsDialog, MapStyleOption } from './map-settings-dialog';
import 'leaflet/dist/leaflet.css';

interface RailwayMapProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
  onOpenSpotDialog?: () => void;
}

const TILE_PROVIDERS: Record<MapStyleOption, { url: string; attribution: string; maxZoom: number; subdomains?: string | string[] }> = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    maxZoom: 18,
  },
  voyager: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap &copy; CARTO',
    maxZoom: 19,
    subdomains: 'abcd',
  },
  osm: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
};

export function RailwayMap({ trains, enthusiastMode, onTrainSelect, onOpenSpotDialog }: RailwayMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const trainMarkersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const userRadiusCircleRef = useRef<any>(null);
  const baseTileLayerRef = useRef<any>(null);
  const railwayLayerRef = useRef<any>(null);

  const { position: userPosition } = useGeolocation();
  const [mapStyle, setMapStyle] = useState<MapStyleOption>('dark'); // Domyślnie profesjonalny tryb Dark Radar
  const [showRailwayOverlay, setShowRailwayOverlay] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Inicjalizacja instancji Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let L: any;
    let isMounted = true;

    import('leaflet').then((leafletModule) => {
      if (!isMounted || !mapContainerRef.current) return;
      L = leafletModule.default || leafletModule;

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialCenter: [number, number] = userPosition
        ? [userPosition.lat, userPosition.lng]
        : [52.231, 21.006]; // Warszawa / szlak kolejowy

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 1. Podkład bazowy: Dark Radar
      const currentProvider = TILE_PROVIDERS[mapStyle];
      const baseLayer = L.tileLayer(currentProvider.url, {
        attribution: currentProvider.attribution,
        maxZoom: currentProvider.maxZoom,
        subdomains: currentProvider.subdomains || 'abc',
      }).addTo(map);

      baseTileLayerRef.current = baseLayer;

      // 2. Oficjalna darmowa warstwa kolejowa: OpenRailwayMap
      const railwayLayer = L.tileLayer(
        'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        {
          attribution: 'Infrastruktura: &copy; OpenRailwayMap &copy; OpenStreetMap',
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          opacity: 0.95,
        }
      ).addTo(map);

      railwayLayerRef.current = railwayLayer;
      mapInstanceRef.current = map;

      // 3. Dodaj znaczniki przejazdów i dzikich przejść
      railwayCrossings.forEach((crossing: RailwayCrossing) => {
        const isWild = crossing.isWildCrossing;
        const iconHtml = isWild
          ? `<div style="background-color: #EF4444; color: white; border: 2px solid white; border-radius: 9999px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 12px rgba(239,68,68,0.8); animation: pulse 2s infinite;">
               <span style="font-size: 16px; font-weight: bold;">⚠️</span>
             </div>`
          : `<div style="background-color: #0284C7; color: white; border: 2px solid white; border-radius: 9999px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">
               <span style="font-size: 14px;">🚊</span>
             </div>`;

        const crossingIcon = L.divIcon({
          html: iconHtml,
          className: 'crossing-marker',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([crossing.location.lat, crossing.location.lng], {
          icon: crossingIcon,
        }).addTo(map);

        marker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4; color: #1E293B;">
            <div style="font-weight: 700; color: ${isWild ? '#DC2626' : '#0369A1'};">
              ${isWild ? '🚨 DZIKIE PRZEJŚCIE (NIEBEZPIECZEŃSTWO)' : 'Przejazd Kolejowy ' + crossing.category}
            </div>
            <div style="font-weight: 600; margin-top: 2px;">${crossing.name}</div>
            <div style="color: #64748B; font-size: 11px; margin-top: 4px;">Linia: ${crossing.line} (km ${crossing.km})</div>
            ${isWild ? '<div style="background:#FEE2E2; color:#991B1B; padding:4px 6px; border-radius:4px; margin-top:6px; font-size:11px; font-weight:600;">Strefa częstych potrąceń pieszych! Zakaz przechodzenia!</div>' : ''}
          </div>
        `);
      });

      // 4. Dodaj zgłoszenia o przeszkodach
      initialHazardReports.forEach((report: HazardReport) => {
        const hazardIcon = L.divIcon({
          html: `<div style="background-color: #F59E0B; color: black; border: 2px solid white; border-radius: 6px; padding: 2px 6px; font-weight: bold; font-size: 11px; box-shadow: 0 0 10px rgba(245,158,11,0.6); white-space: nowrap;">
                  🚧 ZGŁOSZENIE
                 </div>`,
          className: 'hazard-marker',
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        });

        L.marker([report.location.lat, report.location.lng], { icon: hazardIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; color: #1E293B;">
              <b>Zgłoszona przeszkoda na torach:</b>
              <p style="margin-top: 4px;">${report.description}</p>
            </div>
          `);
      });

      setMapReady(true);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Obsługa zmiany podkładu mapy (Dark / Satellite / Voyager / OSM)
  useEffect(() => {
    if (!mapInstanceRef.current || !baseTileLayerRef.current) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      map.removeLayer(baseTileLayerRef.current);

      const provider = TILE_PROVIDERS[mapStyle];
      const newLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: provider.maxZoom,
        subdomains: provider.subdomains || 'abc',
      });

      // Wstaw podkład bazowy na sam spód
      newLayer.addTo(map);
      baseTileLayerRef.current = newLayer;

      // Jeśli warstwa kolejowa jest aktywna, upewnij się, że jest na wierzchu
      if (railwayLayerRef.current && showRailwayOverlay) {
        railwayLayerRef.current.bringToFront();
      }
    });
  }, [mapStyle]);

  // Aktualizacja pozycji użytkownika i strefy geofencingu (200m)
  useEffect(() => {
    if (!mapInstanceRef.current || !userPosition) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      const userLatLng: [number, number] = [userPosition.lat, userPosition.lng];

      const userIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 26px; height: 26px;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #38BDF8; opacity: 0.5; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 18px; height: 18px; border-radius: 50%; background: #0284C7; border: 2.5px solid white; box-shadow: 0 0 12px #38BDF8;"></div>
          </div>
        `,
        className: 'user-location-marker',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        userMarkerRef.current.bindTooltip('Twoja pozycja', { permanent: false, direction: 'top' });
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }

      if (!userRadiusCircleRef.current) {
        userRadiusCircleRef.current = L.circle(userLatLng, {
          radius: 200,
          color: '#F59E0B',
          fillColor: '#F59E0B',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '5, 8',
        }).addTo(map);
      } else {
        userRadiusCircleRef.current.setLatLng(userLatLng);
      }
    });
  }, [userPosition, mapReady]);

  // Aktualizacja pozycji i wyglądu pociągów
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      const existingIds = new Set(trains.map((t) => t.id));

      trainMarkersRef.current.forEach((marker, id) => {
        if (!existingIds.has(id)) {
          marker.remove();
          trainMarkersRef.current.delete(id);
        }
      });

      trains.forEach((train) => {
        const trainPos: [number, number] = [train.currentPosition.lat, train.currentPosition.lng];
        const kmh = Math.round(train.speed * 3.6);

        let badgeBg = 'rgba(15, 23, 42, 0.95)';
        let badgeBorder = '#38BDF8';
        let glowColor = 'rgba(56, 189, 248, 0.6)';

        if (train.type === 'EIP') {
          badgeBorder = '#A855F7';
          glowColor = 'rgba(168, 85, 247, 0.7)';
        } else if (train.type === 'IC') {
          badgeBorder = '#3B82F6';
          glowColor = 'rgba(59, 130, 246, 0.7)';
        } else if (train.type === 'KM') {
          badgeBorder = '#22C55E';
          glowColor = 'rgba(34, 197, 94, 0.7)';
        } else if (train.type === 'Polregio') {
          badgeBorder = '#EF4444';
          glowColor = 'rgba(239, 68, 68, 0.7)';
        } else if (train.type === 'Cargo') {
          badgeBorder = '#F59E0B';
          glowColor = 'rgba(245, 158, 11, 0.7)';
        }

        const headingRotation = train.heading || 0;

        const iconHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer; transition: transform 0.2s ease;">
            <div style="position: relative; background: ${badgeBg}; color: white; border: 2px solid ${badgeBorder}; border-radius: 8px; padding: 4px 8px; font-weight: 700; font-size: 11px; box-shadow: 0 0 12px ${glowColor}; display: flex; align-items: center; gap: 5px; white-space: nowrap;">
              <span style="display: inline-block; transform: rotate(${headingRotation}deg); font-size: 12px; color: ${badgeBorder};">➔</span>
              <span style="font-family: monospace; letter-spacing: 0.5px;">${train.id}</span>
              <span style="background: rgba(255,255,255,0.18); font-size: 10px; padding: 1px 5px; border-radius: 4px; font-family: monospace;">${kmh} km/h</span>
            </div>
            ${
              enthusiastMode && train.rollingStock
                ? `<div style="background: rgba(15,23,42,0.9); color: #E2E8F0; font-size: 9px; padding: 1px 6px; border-radius: 4px; margin-top: 2px; font-weight: 500; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 2px 4px rgba(0,0,0,0.5);">${train.rollingStock}</div>`
                : ''
            }
          </div>
        `;

        const trainIcon = L.divIcon({
          html: iconHtml,
          className: 'train-icon-container',
          iconSize: [130, 40],
          iconAnchor: [65, 20],
        });

        if (trainMarkersRef.current.has(train.id)) {
          const marker = trainMarkersRef.current.get(train.id);
          marker.setLatLng(trainPos);
          marker.setIcon(trainIcon);
        } else {
          const marker = L.marker(trainPos, { icon: trainIcon, zIndexOffset: 500 }).addTo(map);

          marker.on('click', () => {
            if (onTrainSelect) {
              onTrainSelect(train);
            }
          });

          trainMarkersRef.current.set(train.id, marker);
        }
      });
    });
  }, [trains, enthusiastMode, mapReady, onTrainSelect]);

  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && userPosition) {
      mapInstanceRef.current.setView([userPosition.lat, userPosition.lng], 15, {
        animate: true,
      });
    }
  };

  const handleToggleRailwayOverlay = () => {
    if (!mapInstanceRef.current || !railwayLayerRef.current) return;
    const map = mapInstanceRef.current;
    const layer = railwayLayerRef.current;

    if (showRailwayOverlay) {
      map.removeLayer(layer);
      setShowRailwayOverlay(false);
    } else {
      layer.addTo(map);
      setShowRailwayOverlay(true);
    }
  };

  return (
    <div className="relative w-full h-full min-h-[300px] overflow-hidden bg-slate-950">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Pływające przyciski kontrolne (Prawy górny róg) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-9 px-2.5 text-xs gap-1.5 shadow-lg backdrop-blur-md bg-card/90 text-card-foreground border hover:bg-accent"
          onClick={() => setIsSettingsOpen(true)}
          title="Ustawienia mapy & styl"
        >
          <Settings className="h-4 w-4 text-primary" />
          <span className="hidden sm:inline">Styl: {mapStyle === 'dark' ? 'Radar Dark' : mapStyle}</span>
        </Button>

        <Button
          size="sm"
          variant={showRailwayOverlay ? 'default' : 'outline'}
          className="h-9 px-2.5 text-xs gap-1.5 shadow-lg backdrop-blur-md bg-card/90 text-card-foreground border hover:bg-accent"
          onClick={handleToggleRailwayOverlay}
          title="Przełącz warstwę torów kolejowych (OpenRailwayMap)"
        >
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Tory PLK</span>
        </Button>

        {onOpenSpotDialog && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-2.5 text-xs gap-1.5 shadow-lg backdrop-blur-md bg-amber-500/15 border-amber-500/40 text-amber-400 hover:bg-amber-500/25"
            onClick={onOpenSpotDialog}
            title="Zgłoś pociąg towarowy (Trainspotting)"
          >
            <PackageCheck className="h-4 w-4 text-amber-400" />
            <span className="hidden sm:inline font-bold">Spotuj skład</span>
          </Button>
        )}

        {userPosition && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 shadow-lg backdrop-blur-md bg-card/90 text-card-foreground border hover:bg-accent self-end"
            onClick={handleCenterOnUser}
            title="Wyśrodkuj na mojej pozycji GPS"
          >
            <Locate className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>

      {/* Dolny HUD: Status i legenda radarowa */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700/60 text-[11px] text-slate-200 shadow-xl flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block shadow-[0_0_8px_#ef4444] animate-pulse"></span>
          <span>Dzikie przejście</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block shadow-[0_0_8px_#f59e0b]"></span>
          <span>Strefa kolizji (200m)</span>
        </div>
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
          <span>Szlaki PLK</span>
        </div>
      </div>

      <MapSettingsDialog
        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        currentStyle={mapStyle}
        onStyleChange={setMapStyle}
        showTracksOverlay={showRailwayOverlay}
        onTracksOverlayToggle={setShowRailwayOverlay}
      />
    </div>
  );
}
