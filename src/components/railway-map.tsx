"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { Train, RailwayCrossing, HazardReport } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { railwayCrossings, initialHazardReports } from '@/lib/data';
import { Locate, Layers, Settings, PackageCheck, Target } from 'lucide-react';
import { findNearestStations, calculateDistanceMeters, isTrainApproaching } from '@/services/pkp-api';
import { Button } from './ui/button';
import { MapSettingsDialog, MapStyleOption } from './map-settings-dialog';
import { useTheme } from '@/components/theme-provider';
import 'leaflet/dist/leaflet.css';

interface RailwayMapProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
  onOpenSpotDialog?: () => void;
}

const TILE_PROVIDERS: Record<MapStyleOption, { url: string; attribution: string; maxZoom: number; subdomains?: string | string[] }> = {
  dark: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Podkład: &copy; Esri Dark Canvas',
    maxZoom: 18,
  },
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Satelita: &copy; Esri World Imagery',
    maxZoom: 18,
  },
  voyager: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Podkład: &copy; Esri Street Map',
    maxZoom: 18,
  },
  osm: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Podkład: &copy; Esri Light Gray',
    maxZoom: 18,
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
  const hasInitialFramedRef = useRef<boolean>(false);
  const nearestStationMarkersRef = useRef<any[]>([]);
  const approachVectorLineRef = useRef<any>(null);
  const approachVectorMarkerRef = useRef<any>(null);

  const { effectiveTheme } = useTheme();
  const { position: userPosition } = useGeolocation();
  const [mapStyle, setMapStyle] = useState<MapStyleOption>(() =>
    effectiveTheme === 'light' ? 'voyager' : 'dark'
  );
  const [showRailwayOverlay, setShowRailwayOverlay] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  // Znajdź najbliższy pociąg (ze szczególnym uwzględnieniem zbliżających się)
  const nearestApproachingTrain = useMemo(() => {
    if (!userPosition || trains.length === 0) return null;
    const list = trains.map((t) => {
      const dist = calculateDistanceMeters(
        userPosition.lat,
        userPosition.lng,
        t.currentPosition.lat,
        t.currentPosition.lng
      );
      const approaching = isTrainApproaching(
        userPosition.lat,
        userPosition.lng,
        t.currentPosition.lat,
        t.currentPosition.lng,
        t.heading || 0
      );
      return { train: t, dist, approaching };
    });

    const approachingOnly = list.filter((item) => item.approaching);
    if (approachingOnly.length > 0) {
      approachingOnly.sort((a, b) => a.dist - b.dist);
      return approachingOnly[0];
    }
    // Jeśli żaden nie jedzie prosto na nas, weź najbliższy ogółem
    list.sort((a, b) => a.dist - b.dist);
    return list[0] || null;
  }, [trains, userPosition]);

  // Synchronizacja stylu mapy z motywem jasnym/ciemnym
  useEffect(() => {
    setMapStyle((prev) => {
      if (prev === 'satellite' || prev === 'osm') return prev;
      return effectiveTheme === 'light' ? 'voyager' : 'dark';
    });
  }, [effectiveTheme]);

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
        : [52.231, 21.006]; // Domyślnie centrum kolejowe

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13, // Szeroki podgląd ~6km
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 1. Podkład bazowy: Czysty podkład Esri
      const currentProvider = TILE_PROVIDERS[mapStyle];
      const baseLayer = L.tileLayer(currentProvider.url, {
        attribution: currentProvider.attribution,
        maxZoom: currentProvider.maxZoom,
        subdomains: currentProvider.subdomains || 'abc',
      }).addTo(map);

      baseTileLayerRef.current = baseLayer;

      // 2. Oficjalna warstwa kolejowa: OpenRailwayMap ze zrównoważoną przezroczystością
      const railwayLayer = L.tileLayer(
        'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        {
          attribution: 'Infrastruktura: &copy; OpenRailwayMap &copy; OpenStreetMap',
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          opacity: 0.78,
        }
      ).addTo(map);

      railwayLayerRef.current = railwayLayer;
      mapInstanceRef.current = map;

      // 3. Dodaj estetyczne, dyskretne znaczniki przejazdów i dzikich przejść
      railwayCrossings.forEach((crossing: RailwayCrossing) => {
        const isWild = crossing.isWildCrossing;
        const iconHtml = isWild
          ? `<div style="background: #DC2626; color: white; border: 1.5px solid #FEE2E2; border-radius: 6px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 8px rgba(220,38,38,0.8);">
               <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
             </div>`
          : `<div style="background: #0284C7; color: white; border: 1.5px solid #BAE6FD; border-radius: 9999px; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
               <span style="font-size: 11px; font-weight: 800; font-family: monospace; line-height: 1;">✕</span>
             </div>`;

        const crossingIcon = L.divIcon({
          html: iconHtml,
          className: 'crossing-marker',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
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
          html: `<div style="background-color: #F59E0B; color: black; border: 1.5px solid white; border-radius: 6px; padding: 2px 6px; font-weight: bold; font-size: 10px; box-shadow: 0 0 10px rgba(245,158,11,0.6); white-space: nowrap;">
                  🚧 ZGŁOSZENIE
                 </div>`,
          className: 'hazard-marker',
          iconSize: [80, 22],
          iconAnchor: [40, 11],
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

      newLayer.addTo(map);
      baseTileLayerRef.current = newLayer;

      if (railwayLayerRef.current && showRailwayOverlay) {
        railwayLayerRef.current.bringToFront();
      }
    });
  }, [mapStyle]);

  // Inteligentne kadrowanie: obejmuje pozycję użytkownika oraz zbliżający się pociąg
  const frameOnApproachingTrain = useCallback(() => {
    if (!mapInstanceRef.current || !userPosition) return;
    const map = mapInstanceRef.current;
    const targetTrain = nearestApproachingTrain?.train || (trains.length > 0 ? trains[0] : null);

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      if (targetTrain) {
        const bounds = L.latLngBounds([
          [userPosition.lat, userPosition.lng],
          [targetTrain.currentPosition.lat, targetTrain.currentPosition.lng],
        ]);
        // Margines pad(0.35) zapewnia, że zarówno użytkownik jak i pociąg są widoczni z ładnym odstępem
        map.fitBounds(bounds.pad(0.35), { maxZoom: 15, minZoom: 11, animate: true });
      } else {
        map.setView([userPosition.lat, userPosition.lng], 13, { animate: true });
      }
    });
  }, [userPosition, nearestApproachingTrain, trains]);

  // Automatyczne pierwsze wykadrowanie po załadowaniu pozycji GPS i pociągów
  useEffect(() => {
    if (mapReady && userPosition && !hasInitialFramedRef.current) {
      if (trains.length > 0) {
        frameOnApproachingTrain();
        hasInitialFramedRef.current = true;
      } else {
        mapInstanceRef.current?.setView([userPosition.lat, userPosition.lng], 13, { animate: true });
      }
    }
  }, [mapReady, userPosition, trains.length, frameOnApproachingTrain]);

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

      // Wyświetlenie najbliższego posterunku / węzła PKP PLK dla pozycji użytkownika
      const nearest = findNearestStations(userPosition.lat, userPosition.lng, 2);
      nearestStationMarkersRef.current.forEach((m) => m.remove());
      nearestStationMarkersRef.current = [];

      nearest.forEach((st) => {
        const distKm = (st.distanceMeters / 1000).toFixed(1);
        const beaconIcon = L.divIcon({
          html: `
            <div style="background: rgba(16, 185, 129, 0.95); color: white; border: 1.5px solid white; border-radius: 6px; padding: 2px 6px; font-weight: 700; font-size: 10px; box-shadow: 0 0 10px rgba(16, 185, 129, 0.7); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span>📡 ${st.name}</span>
              <span style="background: rgba(0,0,0,0.25); font-size: 9px; padding: 1px 3px; border-radius: 3px; font-family: monospace;">${distKm} km</span>
            </div>
          `,
          className: 'station-beacon-marker',
          iconSize: [130, 24],
          iconAnchor: [65, 12],
        });

        const stMarker = L.marker([st.lat, st.lng], { icon: beaconIcon, zIndexOffset: 300 }).addTo(map);
        stMarker.bindPopup(`
          <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; color: #1E293B;">
            <div style="font-weight: bold; color: #047857;">📡 Węzeł PKP PLK: ${st.name}</div>
            <div style="color: #64748B; font-size: 11px; margin-top: 2px;">Odległość od Ciebie: <b>${distKm} km</b></div>
            <div style="color: #64748B; font-size: 11px;">ID w systemie PLK: <b>#${st.id}</b></div>
          </div>
        `);
        nearestStationMarkersRef.current.push(stMarker);
      });
    });
  }, [userPosition, mapReady]);

  // Wektor zbliżania: Linia przerywana łącząca pieszego z pociągiem + badge z ETA
  useEffect(() => {
    if (!mapInstanceRef.current || !userPosition) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;

      if (approachVectorLineRef.current) {
        map.removeLayer(approachVectorLineRef.current);
        approachVectorLineRef.current = null;
      }
      if (approachVectorMarkerRef.current) {
        map.removeLayer(approachVectorMarkerRef.current);
        approachVectorMarkerRef.current = null;
      }

      if (nearestApproachingTrain) {
        const train = nearestApproachingTrain.train;
        const distMeters = nearestApproachingTrain.dist;
        const speedMs = train.speed > 0 ? train.speed : 15;
        const etaSeconds = Math.max(5, Math.round(distMeters / speedMs));
        const etaFormatted =
          etaSeconds < 60
            ? `${etaSeconds}s`
            : `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s`;
        const distFormatted =
          distMeters >= 1000
            ? `${(distMeters / 1000).toFixed(1)} km`
            : `${Math.round(distMeters)} m`;

        const isApproaching = nearestApproachingTrain.approaching;
        const strokeColor = isApproaching ? '#EF4444' : '#F59E0B';

        const polyline = L.polyline(
          [
            [userPosition.lat, userPosition.lng],
            [train.currentPosition.lat, train.currentPosition.lng],
          ],
          {
            color: strokeColor,
            weight: 2.5,
            opacity: 0.85,
            dashArray: '6, 8',
            lineCap: 'round',
          }
        ).addTo(map);

        approachVectorLineRef.current = polyline;

        const midLat = (userPosition.lat + train.currentPosition.lat) / 2;
        const midLng = (userPosition.lng + train.currentPosition.lng) / 2;

        const etaBadgeIcon = L.divIcon({
          html: `
            <div style="background: rgba(15, 23, 42, 0.92); color: #F8FAFC; border: 1.5px solid ${strokeColor}; border-radius: 9999px; padding: 2px 8px; font-size: 10px; font-weight: 700; white-space: nowrap; box-shadow: 0 0 10px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; pointer-events: none; backdrop-filter: blur(4px);">
              <span style="color: ${strokeColor}; font-size: 11px;">${isApproaching ? '🎯' : '⚡'}</span>
              <span>ETA ~${etaFormatted}</span>
              <span style="opacity: 0.4;">|</span>
              <span style="font-family: monospace; opacity: 0.85;">${distFormatted}</span>
            </div>
          `,
          className: 'approach-vector-badge',
          iconSize: [120, 24],
          iconAnchor: [60, 12],
        });

        const midMarker = L.marker([midLat, midLng], {
          icon: etaBadgeIcon,
          zIndexOffset: 800,
          interactive: false,
        }).addTo(map);

        approachVectorMarkerRef.current = midMarker;
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        if (approachVectorLineRef.current) {
          mapInstanceRef.current.removeLayer(approachVectorLineRef.current);
          approachVectorLineRef.current = null;
        }
        if (approachVectorMarkerRef.current) {
          mapInstanceRef.current.removeLayer(approachVectorMarkerRef.current);
          approachVectorMarkerRef.current = null;
        }
      }
    };
  }, [nearestApproachingTrain, userPosition, mapReady]);

  // Precyzyjne znaczniki pociągów (Puck lokomotywy 32x32px + kierunkowy grot SVG + wiszący mikro-badge)
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

        let carrierColor = '#0EA5E9';
        let glowColor = 'rgba(14, 165, 233, 0.7)';

        if (train.type === 'EIP') {
          carrierColor = '#A855F7';
          glowColor = 'rgba(168, 85, 247, 0.8)';
        } else if (train.type === 'IC') {
          carrierColor = '#3B82F6';
          glowColor = 'rgba(59, 130, 246, 0.8)';
        } else if (train.type === 'KM') {
          carrierColor = '#22C55E';
          glowColor = 'rgba(34, 197, 94, 0.8)';
        } else if (train.type === 'Polregio') {
          carrierColor = '#EF4444';
          glowColor = 'rgba(239, 68, 68, 0.8)';
        } else if (train.type === 'Cargo') {
          carrierColor = '#F59E0B';
          glowColor = 'rgba(245, 158, 11, 0.8)';
        }

        const headingRotation = train.heading || 0;
        const isApproachingThisTrain =
          userPosition &&
          isTrainApproaching(
            userPosition.lat,
            userPosition.lng,
            train.currentPosition.lat,
            train.currentPosition.lng,
            train.heading || 0
          );

        // Precyzyjny znacznik: 32x32px okrągły puck wycentrowany dokładnie na torach + mikrozawieszka powyżej
        const iconHtml = `
          <div style="position: relative; width: 32px; height: 32px; cursor: pointer; user-select: none;">
            ${
              isApproachingThisTrain
                ? `<div style="position: absolute; inset: -5px; border-radius: 9999px; border: 2px solid ${carrierColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75; pointer-events: none;"></div>`
                : ''
            }
            <!-- Okrągły puck lokomotywy zakotwiczony co do metra -->
            <div style="width: 32px; height: 32px; border-radius: 9999px; background: #0F172A; border: 2.5px solid ${carrierColor}; box-shadow: 0 0 12px ${glowColor}; display: flex; align-items: center; justify-content: center; position: relative;">
              <svg viewBox="0 0 24 24" width="18" height="18" style="transform: rotate(${headingRotation}deg); transition: transform 0.3s ease; display: block;" fill="${carrierColor}">
                <polygon points="12,2 21,20 12,15 3,20" />
              </svg>
            </div>

            <!-- Zawieszony micro-badge 36px powyżej pucka, niezasłaniający szyn -->
            <div style="position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); white-space: nowrap; pointer-events: none; z-index: 10; display: flex; flex-direction: column; align-items: center;">
              <div style="background: rgba(15, 23, 42, 0.94); color: #F8FAFC; border: 1.5px solid ${carrierColor}; border-radius: 6px; padding: 2px 6px; font-weight: 700; font-size: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px);">
                <span style="font-family: monospace; letter-spacing: 0.3px;">${train.id}</span>
                <span style="opacity: 0.4;">•</span>
                <span style="background: rgba(255,255,255,0.15); font-size: 9px; padding: 1px 4px; border-radius: 3px; font-family: monospace;">${kmh} km/h</span>
              </div>
              ${
                enthusiastMode && train.rollingStock
                  ? `<div style="background: rgba(15, 23, 42, 0.9); color: #CBD5E1; font-size: 8.5px; padding: 1px 5px; border-radius: 4px; margin-top: 2px; text-align: center; border: 1px solid rgba(255,255,255,0.2); white-space: nowrap;">${train.rollingStock}</div>`
                  : ''
              }
            </div>
          </div>
        `;

        const trainIcon = L.divIcon({
          html: iconHtml,
          className: 'train-icon-container',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
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
  }, [trains, enthusiastMode, mapReady, onTrainSelect, userPosition]);

  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && userPosition) {
      mapInstanceRef.current.setView([userPosition.lat, userPosition.lng], 14, {
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

      {/* Pływający pasek statusu zbliżającego się pociągu (Lewy górny róg) */}
      {nearestApproachingTrain && (
        <div className="absolute top-3 left-3 z-[1000] bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 text-xs shadow-xl flex items-center gap-2 max-w-[calc(100%-160px)] sm:max-w-md">
          <div
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              nearestApproachingTrain.approaching
                ? 'bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse'
                : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
            }`}
          />
          <span className="font-semibold truncate text-card-foreground text-[11px] sm:text-xs">
            {nearestApproachingTrain.approaching ? '🚨 Zbliża się: ' : 'ℹ️ W pobliżu: '}
            <span className="font-mono font-bold">{nearestApproachingTrain.train.id}</span>
            {' '}
            (
            {nearestApproachingTrain.dist >= 1000
              ? `${(nearestApproachingTrain.dist / 1000).toFixed(1)} km`
              : `${Math.round(nearestApproachingTrain.dist)} m`}
            )
          </span>
          <button
            onClick={frameOnApproachingTrain}
            className="text-primary hover:text-primary/80 text-[11px] underline font-semibold ml-auto whitespace-nowrap cursor-pointer shrink-0"
          >
            Pokaż
          </button>
        </div>
      )}

      {/* Pływające przyciski kontrolne (Prawy górny róg) */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        {/* Przycisk autokadrowania na pociągu i pozycji użytkownika */}
        {userPosition && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 px-2.5 text-xs gap-1.5 shadow-lg backdrop-blur-md bg-card/90 text-card-foreground border hover:bg-accent"
            onClick={frameOnApproachingTrain}
            title="Dopasuj widok do mnie i zbliżającego się pociągu"
          >
            <Target className="h-4 w-4 text-emerald-500 animate-pulse" />
            <span className="hidden sm:inline font-bold">Śledź skład</span>
          </Button>
        )}

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
      <div className="absolute bottom-3 left-3 z-[1000] bg-card/95 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 text-[11px] text-card-foreground shadow-xl flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-destructive inline-block shadow-[0_0_6px_rgba(239,68,68,0.8)] animate-pulse"></span>
          <span>Dzikie przejście</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block shadow-[0_0_6px_rgba(245,158,11,0.8)]"></span>
          <span>Strefa 200m</span>
        </div>
        <div className="flex items-center gap-1.5 hidden sm:flex">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
          <span>Wektor zbliżania</span>
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
