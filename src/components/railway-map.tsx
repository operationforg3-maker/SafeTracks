"use client";

import { useEffect, useRef, useState } from 'react';
import type { Train, RailwayCrossing, HazardReport } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { railwayCrossings, initialHazardReports } from '@/lib/data';
import { TrainFront, Locate, Layers, ShieldAlert } from 'lucide-react';
import { Button } from './ui/button';
import 'leaflet/dist/leaflet.css';

interface RailwayMapProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
}

export function RailwayMap({ trains, enthusiastMode, onTrainSelect }: RailwayMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const trainMarkersRef = useRef<Map<string, any>>(new Map());
  const userMarkerRef = useRef<any>(null);
  const userRadiusCircleRef = useRef<any>(null);
  const railwayLayerRef = useRef<any>(null);

  const { position: userPosition } = useGeolocation();
  const [showRailwayOverlay, setShowRailwayOverlay] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  // Inicjalizacja instancji Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    let L: any;
    let isMounted = true;

    import('leaflet').then((leafletModule) => {
      if (!isMounted || !mapContainerRef.current) return;
      L = leafletModule.default || leafletModule;

      // Naprawa domyślnych ikon Leaflet dla bundlerów
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const initialCenter: [number, number] = userPosition
        ? [userPosition.lat, userPosition.lng]
        : [52.231, 21.006]; // Warszawa centrum / linia średnicowa

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 13,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // 1. Podkład bazowy: CartoDB Voyager (estetyczny, przejrzysty)
      const baseLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; OpenStreetMap &copy; CARTO',
          maxZoom: 19,
          subdomains: 'abcd',
        }
      ).addTo(map);

      // 2. Oficjalna darmowa warstwa kolejowa: OpenRailwayMap
      const railwayLayer = L.tileLayer(
        'https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png',
        {
          attribution: 'Infrastruktura: &copy; OpenRailwayMap &copy; OpenStreetMap',
          maxZoom: 19,
          subdomains: ['a', 'b', 'c'],
          opacity: 0.9,
        }
      ).addTo(map);

      railwayLayerRef.current = railwayLayer;
      mapInstanceRef.current = map;

      // 3. Dodaj znaczniki przejazdów i dzikich przejść
      railwayCrossings.forEach((crossing: RailwayCrossing) => {
        const isWild = crossing.isWildCrossing;
        const iconHtml = isWild
          ? `<div style="background-color: #EF4444; color: white; border: 2px solid white; border-radius: 9999px; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
               <span style="font-size: 16px; font-weight: bold;">⚠️</span>
             </div>`
          : `<div style="background-color: #3B82F6; color: white; border: 2px solid white; border-radius: 9999px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);">
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
          <div style="font-family: sans-serif; font-size: 13px; line-height: 1.4;">
            <div style="font-weight: 700; color: ${isWild ? '#DC2626' : '#1E3A8A'};">
              ${isWild ? '🚨 DZIKIE PRZEJŚCIE (NIELEGALNE)' : 'Przejazd Kolejowy ' + crossing.category}
            </div>
            <div>${crossing.name}</div>
            <div style="color: #64748B; font-size: 11px; margin-top: 4px;">Linia: ${crossing.line} (km ${crossing.km})</div>
            ${isWild ? '<div style="background:#FEE2E2; color:#991B1B; padding:4px 6px; border-radius:4px; margin-top:6px; font-size:11px; font-weight:600;">Strefa podwyższonego ryzyka wypadków pieszych!</div>' : ''}
          </div>
        `);
      });

      // 4. Dodaj zgłoszenia o przeszkodach
      initialHazardReports.forEach((report: HazardReport) => {
        const hazardIcon = L.divIcon({
          html: `<div style="background-color: #F59E0B; color: black; border: 2px solid white; border-radius: 6px; padding: 2px 6px; font-weight: bold; font-size: 11px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); white-space: nowrap;">
                  🚧 ZGŁOSZENIE
                 </div>`,
          className: 'hazard-marker',
          iconSize: [80, 24],
          iconAnchor: [40, 12],
        });

        L.marker([report.location.lat, report.location.lng], { icon: hazardIcon })
          .addTo(map)
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px;">
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

  // Aktualizacja pozycji użytkownika i strefy geofencingu (200m)
  useEffect(() => {
    if (!mapInstanceRef.current || !userPosition) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      const userLatLng: [number, number] = [userPosition.lat, userPosition.lng];

      const userIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: #2563EB; opacity: 0.4; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
            <div style="position: absolute; top: 4px; left: 4px; width: 16px; height: 16px; border-radius: 50%; background: #2563EB; border: 2.5px solid white; box-shadow: 0 0 8px rgba(37,99,235,0.8);"></div>
          </div>
        `,
        className: 'user-location-marker',
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(userLatLng, { icon: userIcon, zIndexOffset: 1000 }).addTo(map);
        userMarkerRef.current.bindTooltip('Twoja pozycja', { permanent: false, direction: 'top' });
      } else {
        userMarkerRef.current.setLatLng(userLatLng);
      }

      // Krąg strefy ostrzegawczej wokół pieszego (200m)
      if (!userRadiusCircleRef.current) {
        userRadiusCircleRef.current = L.circle(userLatLng, {
          radius: 200,
          color: '#F59E0B',
          fillColor: '#F59E0B',
          fillOpacity: 0.08,
          weight: 1.5,
          dashArray: '4, 6',
        }).addTo(map);
      } else {
        userRadiusCircleRef.current.setLatLng(userLatLng);
      }
    });
  }, [userPosition, mapReady]);

  // Aktualizacja pozycji pociągów
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;
      const existingIds = new Set(trains.map((t) => t.id));

      // Usunięcie pociągów, których już nie ma
      trainMarkersRef.current.forEach((marker, id) => {
        if (!existingIds.has(id)) {
          marker.remove();
          trainMarkersRef.current.delete(id);
        }
      });

      trains.forEach((train) => {
        const trainPos: [number, number] = [train.currentPosition.lat, train.currentPosition.lng];
        const kmh = Math.round(train.speed * 3.6);

        // Kolorystyka zależna od operatora/typu
        let badgeBg = '#2E3148';
        if (train.type === 'EIP') badgeBg = '#0F172A'; // Pendolino
        else if (train.type === 'IC') badgeBg = '#1E40AF'; // Intercity
        else if (train.type === 'KM') badgeBg = '#15803D'; // Koleje Mazowieckie
        else if (train.type === 'Polregio') badgeBg = '#B91C1C'; // Polregio
        else if (train.type === 'Cargo') badgeBg = '#374151'; // Cargo

        const headingRotation = train.heading || 0;

        const iconHtml = `
          <div style="display: flex; flex-direction: column; align-items: center; cursor: pointer;">
            <div style="position: relative; background: ${badgeBg}; color: white; border: 2px solid white; border-radius: 8px; padding: 4px 8px; font-weight: 700; font-size: 11px; box-shadow: 0 4px 8px rgba(0,0,0,0.4); display: flex; align-items: center; gap: 4px; white-space: nowrap;">
              <span style="display: inline-block; transform: rotate(${headingRotation}deg); font-size: 12px;">➔</span>
              <span>🚆 ${train.id}</span>
              <span style="background: rgba(255,255,255,0.25); font-size: 9px; padding: 1px 4px; border-radius: 4px;">${kmh} km/h</span>
            </div>
            ${
              enthusiastMode && train.rollingStock
                ? `<div style="background: rgba(15,23,42,0.85); color: #F1F5F9; font-size: 9px; padding: 1px 6px; border-radius: 4px; margin-top: 2px; font-weight: 500; border: 1px solid rgba(255,255,255,0.3);">${train.rollingStock}</div>`
                : ''
            }
          </div>
        `;

        const trainIcon = L.divIcon({
          html: iconHtml,
          className: 'train-icon-container',
          iconSize: [120, 36],
          iconAnchor: [60, 18],
        });

        if (trainMarkersRef.current.has(train.id)) {
          const marker = trainMarkersRef.current.get(train.id);
          marker.setLatLng(trainPos);
          marker.setIcon(trainIcon);
        } else {
          const marker = L.marker(trainPos, { icon: trainIcon, zIndexOffset: 500 }).addTo(map);

          marker.on('click', () => {
            if (onTrainSelect) onTrainSelect(train);
          });

          marker.bindPopup(`
            <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
              <div style="font-size: 14px; font-weight: bold; color: ${badgeBg};">🚆 ${train.name || train.id}</div>
              <div style="color: #475569; margin-top: 2px;"><b>Relacja:</b> ${train.route}</div>
              <div style="color: #475569;"><b>Prędkość:</b> ${kmh} km/h (${train.speed} m/s)</div>
              ${train.rollingStock ? `<div style="color: #0284C7; margin-top: 4px;"><b>Tabor:</b> ${train.rollingStock}</div>` : ''}
              ${train.operator ? `<div style="color: #64748B;"><b>Przewoźnik:</b> ${train.operator}</div>` : ''}
              ${train.delayMinutes ? `<div style="color: #DC2626; font-weight: 600; margin-top: 2px;">Opóźnienie: +${train.delayMinutes} min</div>` : '<div style="color: #16A34A; font-weight: 600; margin-top: 2px;">Punktualnie</div>'}
            </div>
          `);

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
    <div className="relative w-full h-full min-h-[300px]">
      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Pływające przyciski sterowania mapą */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <Button
          size="sm"
          variant={showRailwayOverlay ? 'default' : 'outline'}
          className="h-9 px-3 text-xs gap-1.5 shadow-md backdrop-blur-sm bg-card/90 text-card-foreground border hover:bg-accent"
          onClick={handleToggleRailwayOverlay}
          title="Przełącz widok torów kolejowych (OpenRailwayMap)"
        >
          <Layers className="h-4 w-4" />
          <span className="hidden sm:inline">Tory (PLK/ORM)</span>
        </Button>

        {userPosition && (
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0 shadow-md backdrop-blur-sm bg-card/90 text-card-foreground border hover:bg-accent self-end"
            onClick={handleCenterOnUser}
            title="Wyśrodkuj na mojej pozycji GPS"
          >
            <Locate className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>

      {/* Legenda strefy bezpieczeństwa */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-lg border text-[11px] shadow-md flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block animate-pulse"></span>
          <span>Dzikie przejście</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
          <span>Strefa torów (200m)</span>
        </div>
      </div>
    </div>
  );
}
