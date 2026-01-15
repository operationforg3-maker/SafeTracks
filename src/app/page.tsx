"use client";

import { useState } from 'react';
import { Header } from '@/components/header';
import { Dashboard } from '@/components/dashboard';
import { MapView } from '@/components/map-view';
import { useMockTrains } from '@/hooks/use-mock-trains';

export default function Home() {
  const [enthusiastMode, setEnthusiastMode] = useState(false);
  const trains = useMockTrains();

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <Header enthusiastMode={enthusiastMode} onEnthusiastModeChange={setEnthusiastMode} />
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="relative flex-[3] border-b">
          <MapView trains={trains} enthusiastMode={enthusiastMode} />
        </div>
        <div className="relative flex-[2]">
          <Dashboard trains={trains} enthusiastMode={enthusiastMode} />
        </div>
      </main>
    </div>
  );
}
