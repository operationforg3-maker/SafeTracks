"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import type { Train, RailwayCrossing, HazardReport } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { railwayCrossings, initialHazardReports } from '@/lib/data';
import { Locate, Settings, Target } from 'lucide-react';
import { findNearestStations, calculateDistanceMeters, isTrainApproaching } from '@/services/pkp-api';
import { alertAudio } from '@/services/alert-audio';
import { Button } from './ui/button';
import { MapSettingsDialog, MapStyleOption, DEFAULT_GEOFENCE_RADIUS } from './map-settings-dialog';
import { useGeofenceRadius } from '@/services/geofence-settings';
import { useTheme } from '@/components/theme-provider';

import 'leaflet/dist/leaflet.css';

interface RailwayMapProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
  onOpenSpotDialog?: () => void;
  selectedTrain?: Train | null;
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

export function RailwayMap({ trains, enthusiastMode, onTrainSelect, onOpenSpotDialog, selectedTrain }: RailwayMapProps) {
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
  const hasPlayedPassSoundRef = useRef<Set<string>>(new Set());
  const selectedTrainRouteRef = useRef<any>(null);
  const selectedTrainMarkerRef = useRef<any>(null);

  const { effectiveTheme } = useTheme();
  const { position: userPosition } = useGeolocation();
  const [mapStyle, setMapStyle] = useState<MapStyleOption>(() =>
    effectiveTheme === 'light' ? 'voyager' : 'dark'
  );
  const [showRailwayOverlay, setShowRailwayOverlay] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [geofenceRadius, setGeofenceRadius] = useGeofenceRadius();

  // Znajdź najbliższy pociąg w strefie geofencingu lub zbliżający się

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

    // Priorytet 1: pociąg WEWNĄTRZ strefy geofencingu (<=geofenceRadius) zbliżający się
    const inZoneApproaching = list.filter((item) => item.approaching && item.dist <= geofenceRadius);
    if (inZoneApproaching.length > 0) {
      inZoneApproaching.sort((a, b) => a.dist - b.dist);
      return inZoneApproaching[0];
    }

    // Priorytet 2: pociąg w strefie (niekoniecznie zbliżający się wektorem - może mijać)
    const inZone = list.filter((item) => item.dist <= geofenceRadius);
    if (inZone.length > 0) {
      inZone.sort((a, b) => a.dist - b.dist);
      return inZone[0];
    }

    // Priorytet 3 (informacyjny, bez alarmu): najbliższy zbliżający się poza strefą
    const approachingOutside = list.filter((item) => item.approaching);
    if (approachingOutside.length > 0) {
      approachingOutside.sort((a, b) => a.dist - b.dist);
      return approachingOutside[0];
    }

    // Priorytet 4: najbliższy ogólnie
    list.sort((a, b) => a.dist - b.dist);
    return list[0] || null;
  }, [trains, userPosition, geofenceRadius]);

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
        : [52.231, 21.006];

      const map = L.map(mapContainerRef.current, {
        center: initialCenter,
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      L.control.scale({ metric: true, imperial: false, position: 'bottomleft' }).addTo(map);

      const updateZoomClasses = () => {
        if (!mapContainerRef.current) return;
        if (map.getZoom() < 12) {
          mapContainerRef.current.classList.add('zoom-low');
        } else {
          mapContainerRef.current.classList.remove('zoom-low');
        }
      };

      map.on('zoomstart', () => {
        mapContainerRef.current?.classList.add('map-is-zooming');
      });
      map.on('zoomend', () => {
        mapContainerRef.current?.classList.remove('map-is-zooming');
        updateZoomClasses();
      });
      updateZoomClasses();


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

      // 3. Dodaj estetyczne znaczniki przejazdów i dzikich przejść
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
        map.fitBounds(bounds.pad(0.35), { maxZoom: 15, minZoom: 11, animate: true });
      } else {
        map.setView([userPosition.lat, userPosition.lng], 16, { animate: true });
      }
    });
  }, [userPosition, nearestApproachingTrain, trains]);

  // Automatyczne pierwsze wycentrowanie na użytkowniku w przybliżeniu (zoom 16: ~1cm = 100m)
  useEffect(() => {
    if (mapReady && userPosition && !hasInitialFramedRef.current) {
      mapInstanceRef.current?.setView([userPosition.lat, userPosition.lng], 16, { animate: true });
      hasInitialFramedRef.current = true;
    }
  }, [mapReady, userPosition]);


  // Aktualizacja pozycji użytkownika i strefy geofencingu (regulowany promień)
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
          radius: geofenceRadius,
          color: '#F59E0B',
          fillColor: '#F59E0B',
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '5, 8',
        }).addTo(map);
      } else {
        userRadiusCircleRef.current.setLatLng(userLatLng);
        userRadiusCircleRef.current.setRadius(geofenceRadius);
      }

      // Wyświetlenie najbliższego posterunku / węzła PKP PLK dla pozycji użytkownika
      const nearest = findNearestStations(userPosition.lat, userPosition.lng, 2);
      nearestStationMarkersRef.current.forEach((m) => m.remove());
      nearestStationMarkersRef.current = [];

      nearest.forEach((st) => {
        const distKm = (st.distanceMeters / 1000).toFixed(1);
        const beaconIcon = L.divIcon({
          html: `
            <div style="background: rgba(16, 185, 129, 0.9); color: white; border: 1.5px solid white; border-radius: 9999px; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); font-size: 11px; cursor: pointer;">
              🚉
            </div>
          `,
          className: 'station-beacon-marker',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });

        const stMarker = L.marker([st.lat, st.lng], { icon: beaconIcon, zIndexOffset: 300 }).addTo(map);
        stMarker.bindTooltip(`${st.name} (${distKm} km)`, { direction: 'top', offset: [0, -10] });
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
  }, [userPosition, mapReady, geofenceRadius]);


  // Podświetlenie szlaku kolejowego zbliżającego się / wybranego pociągu (STRICTLY PO TORACH)
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;

      if (approachVectorLineRef.current) {
        map.removeLayer(approachVectorLineRef.current);
        approachVectorLineRef.current = null;
      }

      if (nearestApproachingTrain) {
        const train = nearestApproachingTrain.train;
        const distMeters = nearestApproachingTrain.dist;
        const isApproaching = nearestApproachingTrain.approaching;

        // Rysuj korytarz szlaku kolejowego pociągu (punkty stacji na trasie)
        if (train.path && train.path.length >= 2) {
          const latLngs = train.path.map((p) => [p.lat, p.lng]);
          const strokeColor = distMeters <= 200 ? '#EF4444' : isApproaching ? '#F97316' : '#0284C7';

          const polyline = L.polyline(latLngs, {
            className: 'rail-corridor-line',
            color: strokeColor,
            weight: 4,
            opacity: 0.85,
            dashArray: '6, 8',
            lineCap: 'round',
          }).addTo(map);

          approachVectorLineRef.current = polyline;
        }
      }
    });

    return () => {
      if (mapInstanceRef.current && approachVectorLineRef.current) {
        mapInstanceRef.current.removeLayer(approachVectorLineRef.current);
        approachVectorLineRef.current = null;
      }
    };
  }, [nearestApproachingTrain, mapReady]);

  // Wyświetlenie trasy i pozycji wybranego pociągu (klik na marker)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return;
    const map = mapInstanceRef.current;

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule;

      // Wyczyść poprzednią trasę i marker
      if (selectedTrainRouteRef.current) {
        map.removeLayer(selectedTrainRouteRef.current);
        selectedTrainRouteRef.current = null;
      }
      if (selectedTrainMarkerRef.current) {
        map.removeLayer(selectedTrainMarkerRef.current);
        selectedTrainMarkerRef.current = null;
      }

      if (!selectedTrain) return;

      // Kolor linii wg przewoźnika
      let routeColor = '#0EA5E9';
      if (selectedTrain.type === 'EIP') routeColor = '#A855F7';
      else if (selectedTrain.type === 'IC' || selectedTrain.type === 'TLK') routeColor = '#3B82F6';
      else if (['KM', 'KW', 'KD', 'SKM'].includes(selectedTrain.type || '')) routeColor = '#22C55E';
      else if (selectedTrain.type === 'Polregio' || selectedTrain.type === 'Regio') routeColor = '#EF4444';
      else if (selectedTrain.type === 'Cargo') routeColor = '#F59E0B';

      // Rysuj pełną trasę pociągu
      if (selectedTrain.path && selectedTrain.path.length >= 2) {
        const latLngs = selectedTrain.path.map((p) => [p.lat, p.lng]);
        const routeLine = L.polyline(latLngs, {
          color: routeColor,
          weight: 5,
          opacity: 0.9,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);

        // Półprzezroczysta obwódka dla czytelności
        const routeOutline = L.polyline(latLngs, {
          color: '#ffffff',
          weight: 8,
          opacity: 0.35,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(map);
        routeOutline.bringToBack();

        selectedTrainRouteRef.current = L.layerGroup([routeOutline, routeLine]).addTo(map);
      }

      // Specjalny marker pozycji wybranego pociągu
      const trainPos: [number, number] = [selectedTrain.currentPosition.lat, selectedTrain.currentPosition.lng];
      const kmh = Math.round((selectedTrain.speed || 0) * 3.6);
      const selectedIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 40px; height: 40px;">
            <div style="position: absolute; inset: -8px; border-radius: 9999px; border: 3px solid ${routeColor}; animation: ping 1s cubic-bezier(0,0,0.2,1) infinite; opacity: 0.8;"></div>
            <div style="width: 40px; height: 40px; border-radius: 9999px; background: #0F172A; border: 3px solid #FCD34D; box-shadow: 0 0 20px ${routeColor}, 0 0 40px rgba(252,211,77,0.5); display: flex; align-items: center; justify-content: center; position: relative; z-index: 5;">
              <svg viewBox="0 0 24 24" width="20" height="20" style="transform: rotate(${selectedTrain.heading || 0}deg);" fill="${routeColor}">
                <polygon points="12,2 21,20 12,15 3,20"/>
              </svg>
            </div>
            <div style="position: absolute; bottom: 44px; left: 50%; transform: translateX(-50%); white-space: nowrap; background: #FCD34D; color: #0F172A; font-weight: 900; font-size: 11px; padding: 3px 8px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
              🎯 ${selectedTrain.id} · ${kmh > 0 ? `${kmh} km/h` : 'Postój'}
            </div>
          </div>
        `,
        className: 'selected-train-marker',
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      selectedTrainMarkerRef.current = L.marker(trainPos, {
        icon: selectedIcon,
        zIndexOffset: 2000,
      }).addTo(map);

      // Rysuj punkty stacji na trasie jeśli dostępne
      if (selectedTrain.timetable && selectedTrainRouteRef.current) {
        selectedTrain.timetable.forEach((st) => {
          if (st.lat && st.lng) {
            const isCurrentOrNext = st.status === 'current' || st.status === 'next';
            const dot = L.circleMarker([st.lat, st.lng], {
              radius: isCurrentOrNext ? 5 : 3.5,
              color: isCurrentOrNext ? '#F59E0B' : '#0F172A',
              weight: 2,
              fillColor: isCurrentOrNext ? '#FCD34D' : '#FFFFFF',
              fillOpacity: 1,
            });
            const delayText = (st.delayMinutes || 0) > 0 ? ` (+${st.delayMinutes}')` : '';
            dot.bindTooltip(
              `<div style="font-size: 10px; font-weight: 700; font-family: sans-serif;">${st.stationName}${delayText}</div>`,
              { direction: 'top', offset: [0, -4] }
            );
            dot.addTo(selectedTrainRouteRef.current);
          }
        });
      }

      // Dopasuj widok z uwzględnieniem bezpiecznych marginesów (żeby dolna/boczna karta nie zasłaniała trasy)
      const boundsPoints: [number, number][] = [trainPos];
      if (userPosition) boundsPoints.push([userPosition.lat, userPosition.lng]);
      if (selectedTrain.path && selectedTrain.path.length >= 2) {
        selectedTrain.path.forEach((p) => boundsPoints.push([p.lat, p.lng]));
      }
      const bounds = L.latLngBounds(boundsPoints);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
      map.fitBounds(bounds.pad(0.18), {
        maxZoom: 14,
        minZoom: 9,
        animate: true,
        paddingBottomRight: [20, isMobile ? 300 : 30],
        paddingTopLeft: [30, 30],
      });
    });
  }, [selectedTrain, mapReady, userPosition]);

  // Precyzyjne znaczniki pociągów: Snop świateł reflektorów czołowych + animacja ciągłego sunięcia po szynie + fale mijania
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
        } else if (train.type === 'KM' || train.type === 'KW' || train.type === 'KD') {
          carrierColor = '#22C55E';
          glowColor = 'rgba(34, 197, 94, 0.8)';
        } else if (train.type === 'Polregio' || train.type === 'Regio') {
          carrierColor = '#EF4444';
          glowColor = 'rgba(239, 68, 68, 0.8)';
        } else if (train.type === 'Cargo') {
          carrierColor = '#F59E0B';
          glowColor = 'rgba(245, 158, 11, 0.8)';
        }

        const headingRotation = train.heading || 0;
        const distToUser = userPosition
          ? calculateDistanceMeters(userPosition.lat, userPosition.lng, trainPos[0], trainPos[1])
          : Infinity;

        const isApproachingThisTrain =
          userPosition &&
          isTrainApproaching(
            userPosition.lat,
            userPosition.lng,
            train.currentPosition.lat,
            train.currentPosition.lng,
            train.heading || 0
          );

        const isPassingNow = distToUser <= geofenceRadius * 0.6;

        // Dźwięk syreny pociągu przy mijaniu
        if (isPassingNow && !hasPlayedPassSoundRef.current.has(train.id)) {
          hasPlayedPassSoundRef.current.add(train.id);
          alertAudio.playTrainPassingSound();
        } else if (!isPassingNow && hasPlayedPassSoundRef.current.has(train.id) && distToUser > geofenceRadius * 1.5) {
          hasPlayedPassSoundRef.current.delete(train.id);
        }

        // Styl ramki markera wg poziomu zaufania pozycji:
        // high   = pełna linia (dane potwierdzone z obwodów torowych)
        // medium = linia z małymi przerwami
        // low    = mocno przerywana (szacowana z rozkładu jazdy)
        const conf = (train as any).positionConfidence || 'medium';
        const borderStyle = isPassingNow ? 'solid' : conf === 'high' ? 'solid' : conf === 'medium' ? 'dashed' : 'dotted';
        const borderColor = isPassingNow ? '#EF4444' : carrierColor;

        // Precyzyjny znacznik z reflektorami, animacją mijania i mikro-badge'em
        const iconHtml = `
          <div style="position: relative; width: 32px; height: 32px; cursor: pointer; user-select: none;">
            <!-- Snop świateł reflektorów czołowych oświetlający tory przed pociągiem -->
            <div style="position: absolute; top: 16px; left: 16px; width: 0; height: 0; transform: rotate(${headingRotation}deg); transform-origin: 0 0; pointer-events: none; z-index: 1;">
              <div style="position: absolute; top: -75px; left: -24px; width: 48px; height: 75px; background: linear-gradient(to top, rgba(254, 240, 138, 0.5) 0%, rgba(253, 224, 71, 0.18) 50%, rgba(255, 255, 255, 0) 100%); clip-path: polygon(30% 100%, 70% 100%, 100% 0%, 0% 0%); filter: blur(0.5px); animation: trainLightPulse 2s infinite ease-in-out;"></div>
              <div style="position: absolute; top: -16px; left: -4px; width: 8px; height: 8px; border-radius: 50%; background: #FEF08A; box-shadow: 0 0 10px #FEF08A, 0 0 20px #EAB308;"></div>
            </div>

            ${
              isPassingNow
                ? `<!-- Efekt gwałtownego mijania pieszego (Doppler shockwave) -->
                   <div style="position: absolute; inset: -14px; border-radius: 9999px; border: 3px solid #EF4444; animation: ping 0.75s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.9; pointer-events: none;"></div>
                   <div style="position: absolute; inset: -26px; border-radius: 9999px; border: 2px dashed #F59E0B; animation: ping 1.1s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.7; pointer-events: none;"></div>`
                : isApproachingThisTrain
                ? `<div style="position: absolute; inset: -5px; border-radius: 9999px; border: 2px solid ${carrierColor}; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75; pointer-events: none;"></div>`
                : ''
            }

            <!-- Okrągły puck lokomotywy — styl ramki wg poziomu zaufania pozycji -->
            <div style="width: 32px; height: 32px; border-radius: 9999px; background: #0F172A; border: 2.5px ${borderStyle} ${borderColor}; box-shadow: 0 0 14px ${isPassingNow ? 'rgba(239,68,68,0.9)' : glowColor}; display: flex; align-items: center; justify-content: center; position: relative; z-index: 5;">
              <svg viewBox="0 0 24 24" width="18" height="18" style="transform: rotate(${headingRotation}deg); transition: transform 0.3s ease; display: block;" fill="${isPassingNow ? '#EF4444' : carrierColor}">
                <polygon points="12,2 21,20 12,15 3,20" />
              </svg>
            </div>

            <!-- Zawieszony micro-badge 36px powyżej pucka -->
            <div class="train-badge-pill" style="position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); white-space: nowrap; pointer-events: none; z-index: 10; display: flex; flex-direction: column; align-items: center;">

              ${
                isPassingNow
                  ? `<div style="background: #DC2626; color: white; border: 1.5px solid white; border-radius: 6px; padding: 2px 7px; font-weight: 900; font-size: 10px; box-shadow: 0 0 16px rgba(220,38,38,0.9); animation: pulse 0.6s infinite; letter-spacing: 0.3px;">
                       ⚡ MIJA CIĘ! ${kmh} km/h
                     </div>`
                  : `<div style="background: rgba(15, 23, 42, 0.94); color: #F8FAFC; border: 1.5px solid ${carrierColor}; border-radius: 6px; padding: 2px 6px; font-weight: 700; font-size: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.6); display: flex; align-items: center; gap: 4px; backdrop-filter: blur(4px);">
                       <span style="font-family: monospace; letter-spacing: 0.3px;">${train.conjoinedCount && train.conjoinedCount > 1 ? `${train.id.split(' ')[0]} ${train.id.split(' ')[1]} (+${train.conjoinedCount - 1})` : train.id}</span>
                       ${train.conjoinedCount && train.conjoinedCount > 1 ? `<span style="background: rgba(59, 130, 246, 0.3); color: #93C5FD; font-size: 8.5px; padding: 1px 4px; border-radius: 3px; font-weight: 800;">x${train.conjoinedCount}</span>` : ''}
                       <span style="opacity: 0.4;">•</span>
                       <span style="background: ${kmh > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(245, 158, 11, 0.25)'}; color: ${kmh > 0 ? '#F8FAFC' : '#FBBF24'}; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-family: monospace; font-weight: ${kmh > 0 ? 'normal' : 'bold'};">${kmh > 0 ? `${kmh} km/h` : 'Postój'}</span>
                     </div>`
              }
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

          const lastState = marker._renderState;
          const headingDiff = Math.abs((lastState?.heading ?? 0) - headingRotation);
          const speedDiff = Math.abs((lastState?.kmh ?? 0) - kmh);
          const needsIconUpdate =
            !lastState ||
            lastState.isPassingNow !== isPassingNow ||
            headingDiff > 15 ||
            speedDiff > 6 ||
            lastState.enthusiastMode !== enthusiastMode;

          if (needsIconUpdate) {
            marker.setIcon(trainIcon);
            marker._renderState = { isPassingNow, heading: headingRotation, kmh, enthusiastMode };
          }
        } else {
          const marker = L.marker(trainPos, { icon: trainIcon, zIndexOffset: 500 }).addTo(map);
          marker._renderState = { isPassingNow, heading: headingRotation, kmh, enthusiastMode };

          marker.on('click', () => {
            if (onTrainSelect) {
              onTrainSelect(train);
            }
          });

          trainMarkersRef.current.set(train.id, marker);
        }
      });
    });
  }, [trains, enthusiastMode, mapReady, onTrainSelect, userPosition, geofenceRadius]);


  const handleCenterOnUser = () => {
    if (mapInstanceRef.current && userPosition) {
      mapInstanceRef.current.setView([userPosition.lat, userPosition.lng], 16, {
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
      {/* Globalne style animacji ciągłego ruchu 60 FPS dla markerów i wektora zbliżania */}
      <style>{`
        .train-icon-container {
          transition: transform 0.6s linear !important;
          will-change: transform;
        }
        .map-is-zooming .train-icon-container {
          transition: none !important;
        }
        @keyframes approachDashFlow {
          to {
            stroke-dashoffset: -28px;
          }
        }
        .approach-vector-line {
          animation: approachDashFlow 0.75s linear infinite;
        }
        @keyframes trainLightPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        .zoom-low .train-badge-pill {
          display: none !important;
        }
        .zoom-low .train-icon-container:hover .train-badge-pill {
          display: flex !important;
        }
        .selected-train-marker .train-badge-pill {
          display: flex !important;
        }
      `}</style>


      <div ref={mapContainerRef} className="w-full h-full" />

      {/* Status pill — only when relevant */}
      {(selectedTrain || (nearestApproachingTrain && nearestApproachingTrain.dist <= geofenceRadius)) && (
        <div className="absolute top-3 left-3 z-[1000] bg-card/95 backdrop-blur-md px-2.5 py-1 rounded-lg border border-border/80 text-[11px] shadow-lg flex items-center gap-2 max-w-[calc(100%-100px)]">
          {selectedTrain ? (
            <>
              <div className="w-2 h-2 rounded-full shrink-0 bg-amber-400" />
              <span className="font-medium truncate">
                <span className="font-mono font-bold">{selectedTrain.id}</span>
                {typeof selectedTrain.speed === 'number' && selectedTrain.speed > 0 ? ` · ${Math.round(selectedTrain.speed * 3.6)} km/h` : ' · Postój'}
              </span>
            </>
          ) : nearestApproachingTrain ? (
            <>
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                nearestApproachingTrain.dist <= geofenceRadius * 0.5
                  ? 'bg-destructive animate-ping'
                  : 'bg-amber-500 animate-pulse'
              }`} />
              <span className="font-medium truncate">
                <span className="font-mono font-bold">{nearestApproachingTrain.train.id}</span>
                {' '}{Math.round(nearestApproachingTrain.dist)}m
              </span>
            </>
          ) : null}
          <button
            onClick={frameOnApproachingTrain}
            className="text-primary text-[10px] font-semibold ml-auto shrink-0 hover:underline"
          >
            Pokaż
          </button>
        </div>
      )}

      {/* Floating controls — minimal */}
      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-1.5">
        {userPosition && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 shadow-lg backdrop-blur-md bg-card/90 border hover:bg-accent"
            onClick={frameOnApproachingTrain}
            title="Kadruj na pociąg"
          >
            <Target className="h-4 w-4 text-emerald-500" />
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 shadow-lg backdrop-blur-md bg-card/90 border hover:bg-accent"
          onClick={() => setIsSettingsOpen(true)}
          title="Ustawienia mapy"
        >
          <Settings className="h-4 w-4 text-primary" />
        </Button>

        {userPosition && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 w-8 p-0 shadow-lg backdrop-blur-md bg-card/90 border hover:bg-accent"
            onClick={handleCenterOnUser}
            title="Centruj na mnie"
          >
            <Locate className="h-4 w-4 text-primary" />
          </Button>
        )}
      </div>

      <MapSettingsDialog

        open={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        currentStyle={mapStyle}
        onStyleChange={setMapStyle}
        showTracksOverlay={showRailwayOverlay}
        onTracksOverlayToggle={setShowRailwayOverlay}
        geofenceRadius={geofenceRadius}
        onGeofenceRadiusChange={setGeofenceRadius}
      />
    </div>
  );
}
