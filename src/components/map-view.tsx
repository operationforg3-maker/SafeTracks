"use client";

import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import type { Train } from '@/lib/types';
import { useGeolocation } from '@/hooks/use-geolocation';
import { TrainFront, User } from 'lucide-react';
import { Card, CardContent } from './ui/card';

interface MapViewProps {
  trains: Train[];
  enthusiastMode: boolean;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

export function MapView({ trains, enthusiastMode }: MapViewProps) {
  const { position: userPosition } = useGeolocation();
  const mapCenter = userPosition || { lat: 52.237, lng: 21.017 }; // Default to Warsaw center

  if (!API_KEY) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted">
        <Card className="max-w-md text-center">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold">Mapa jest niedostępna</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Aby wyświetlić interaktywną mapę, musisz skonfigurować klucz API Google Maps.
            </p>
            <code className="mt-4 block rounded bg-slate-200 dark:bg-slate-800 p-2 text-sm">
              NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=...
            </code>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY}>
      <Map
        mapId="safetracks-map"
        style={{ width: '100%', height: '100%' }}
        defaultCenter={mapCenter}
        center={mapCenter}
        defaultZoom={13}
        gestureHandling={'greedy'}
        disableDefaultUI={true}
        mapTypeId='roadmap'
        styles={[
            {
                "featureType": "poi",
                "stylers": [{ "visibility": "off" }]
            },
            {
                "featureType": "road",
                "elementType": "labels",
                "stylers": [{ "visibility": "off" }]
            },
            {
                "featureType": "transit",
                "stylers": [{ "visibility": "off" }]
            }
        ]}
      >
        {trains.map(train => (
          <AdvancedMarker key={train.id} position={train.currentPosition}>
            <div className='flex flex-col items-center group'>
              <div className="rounded-full bg-primary/80 p-2 shadow-lg backdrop-blur-sm transition-transform group-hover:scale-110">
                <TrainFront className="h-6 w-6 text-primary-foreground" />
              </div>
              {enthusiastMode && <span className='mt-1 text-xs font-bold text-foreground bg-background/70 px-1.5 py-0.5 rounded'>{train.id}</span>}
            </div>
          </AdvancedMarker>
        ))}
        {userPosition && (
          <AdvancedMarker position={userPosition}>
             <div className="relative flex items-center justify-center">
                <div className="absolute h-8 w-8 animate-ping rounded-full bg-accent" />
                <div className="relative h-4 w-4 rounded-full bg-accent border-2 border-background" />
            </div>
          </AdvancedMarker>
        )}
      </Map>
    </APIProvider>
  );
}
