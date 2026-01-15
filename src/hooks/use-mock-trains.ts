"use client";

import { useState, useEffect } from 'react';
import { mockTrains as initialTrains } from '@/lib/data';
import type { Train } from '@/lib/types';

export const useMockTrains = () => {
  const [trains, setTrains] = useState<Train[]>(initialTrains);

  useEffect(() => {
    const interval = setInterval(() => {
      setTrains(currentTrains => 
        currentTrains.map(train => {
          if (train.path.length <= 1) return train;

          const { pathIndex } = train;
          const nextPathIndex = (pathIndex + 1) % train.path.length;

          // Simple movement along the path
          const newPosition = train.path[nextPathIndex];
          
          return {
            ...train,
            currentPosition: newPosition,
            pathIndex: nextPathIndex,
            lastUpdate: Date.now()
          };
        })
      );
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return trains;
};
