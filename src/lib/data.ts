import type { Train } from './types';

const trainPath1: { lat: number; lng: number }[] = [
  { lat: 52.237, lng: 21.017 },
  { lat: 52.24, lng: 21.02 },
  { lat: 52.245, lng: 21.025 },
  { lat: 52.25, lng: 21.03 },
  { lat: 52.255, lng: 21.035 },
  { lat: 52.26, lng: 21.04 },
];

const trainPath2: { lat: number; lng: number }[] = [
    { lat: 52.22, lng: 21.00 },
    { lat: 52.225, lng: 21.005 },
    { lat: 52.23, lng: 21.01 },
    { lat: 52.235, lng: 21.015 },
    { lat: 52.237, lng: 21.017 },
];


export const mockTrains: Train[] = [
  {
    id: 'IC 1700',
    route: 'Warszawa - Kraków',
    type: 'InterCity',
    currentPosition: trainPath1[0],
    speed: 25, // ~90 km/h
    lastUpdate: Date.now(),
    path: trainPath1,
    pathIndex: 0,
  },
  {
    id: 'R 931',
    route: 'Grodzisk Maz. - Warszawa',
    type: 'Regional',
    currentPosition: trainPath2[0],
    speed: 20, // ~72 km/h
    lastUpdate: Date.now(),
    path: trainPath2,
    pathIndex: 0,
  },
  {
    id: 'TLK 53104',
    route: 'Gdynia - Zakopane',
    type: 'TLK',
    currentPosition: { lat: 52.24, lng: 20.98 },
    speed: 30, // ~108 km/h
    lastUpdate: Date.now(),
    path: [
        { lat: 52.24, lng: 20.98 },
        { lat: 52.24, lng: 20.99 },
        { lat: 52.24, lng: 21.00 },
        { lat: 52.24, lng: 21.01 },
        { lat: 52.24, lng: 21.02 },
    ],
    pathIndex: 0,
  }
];

export const geoFencedZones = [
    { lat: 52.237, lng: 21.017, radius: 200 }, // near a track
    { lat: 52.25, lng: 21.03, radius: 200 }
];
