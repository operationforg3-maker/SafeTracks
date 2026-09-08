"use client";

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Train } from '@/lib/types';

interface MapViewProps {
  trains: Train[];
  enthusiastMode: boolean;
  onTrainSelect?: (train: Train) => void;
  onOpenSpotDialog?: () => void;
}

const DynamicRailwayMap = dynamic(
  () => import('./railway-map').then((mod) => mod.RailwayMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-mono">Inicjalizacja radaru szlakowego SafeTracks...</span>
        </div>
      </div>
    ),
  }
);

export function MapView({ trains, enthusiastMode, onTrainSelect, onOpenSpotDialog }: MapViewProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-xs font-mono">Inicjalizacja radaru szlakowego SafeTracks...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <DynamicRailwayMap
        trains={trains}
        enthusiastMode={enthusiastMode}
        onTrainSelect={onTrainSelect}
        onOpenSpotDialog={onOpenSpotDialog}
      />
    </div>
  );
}
