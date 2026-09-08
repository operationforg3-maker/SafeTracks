import type { Train, RailwayCrossing, HazardReport } from './types';

// Linia Kolejowa nr 1 / 447 (Warszawa Zachodnia - Włochy - Pruszków - Grodzisk)
const lineWawaGrodzisk = [
  { lat: 52.2198, lng: 20.9634 }, // Warszawa Zachodnia
  { lat: 52.2132, lng: 20.9321 }, // Warszawa Czyste
  { lat: 52.2045, lng: 20.9082 }, // Warszawa Włochy
  { lat: 52.1931, lng: 20.8712 }, // Warszawa Ursus
  { lat: 52.1795, lng: 20.8410 }, // Piastów
  { lat: 52.1672, lng: 20.8065 }, // Pruszków
  { lat: 52.1481, lng: 20.7381 }, // Brwinów
  { lat: 52.1124, lng: 20.6358 }, // Grodzisk Mazowiecki
];

// Linia Średnicowa & Linia nr 9 (Warszawa Zachodnia -> Centralna -> Wschodnia -> Praga -> Legionowo)
const lineWawaGdansk = [
  { lat: 52.2198, lng: 20.9634 }, // Warszawa Zachodnia
  { lat: 52.2288, lng: 21.0032 }, // Warszawa Centralna
  { lat: 52.2355, lng: 21.0360 }, // Most Średnicowy
  { lat: 52.2512, lng: 21.0520 }, // Warszawa Wschodnia
  { lat: 52.2685, lng: 21.0335 }, // Warszawa Praga (Towarowa)
  { lat: 52.2982, lng: 21.0112 }, // Warszawa Żerań
  { lat: 52.3312, lng: 20.9785 }, // Warszawa Płudy
  { lat: 52.3725, lng: 20.9341 }, // Legionowo
  { lat: 52.4110, lng: 20.8850 }, // Nowy Dwór Mazowiecki
];

// Linia nr 2 (Warszawa Wschodnia -> Rembertów -> Sulejówek -> Mińsk Maz.)
const lineWawaSiedlce = [
  { lat: 52.2512, lng: 21.0520 }, // Warszawa Wschodnia
  { lat: 52.2562, lng: 21.1150 }, // Warszawa Rembertów
  { lat: 52.2520, lng: 21.1710 }, // Warszawa Wesoła
  { lat: 52.2450, lng: 21.2320 }, // Sulejówek Miłosna
  { lat: 52.1850, lng: 21.5710 }, // Mińsk Mazowiecki
];

export const mockTrains: Train[] = [
  {
    id: 'EIP 1300',
    name: 'Pendolino',
    route: 'Gdynia Główna — Warszawa — Kraków Główny',
    type: 'EIP',
    operator: 'PKP Intercity',
    rollingStock: 'ED250-001 (Alstom Pendolino)',
    currentPosition: lineWawaGdansk[3],
    speed: 36, // ~130 km/h
    heading: 210,
    lastUpdate: Date.now(),
    path: lineWawaGdansk,
    pathIndex: 3,
    origin: 'Gdynia Główna',
    destination: 'Kraków Główny',
    delayMinutes: 0,
  },
  {
    id: 'IC 18104',
    name: 'Błękitna Fala',
    route: 'Warszawa Wschodnia — Poznań Główny',
    type: 'IC',
    operator: 'PKP Intercity',
    rollingStock: 'EU44-006 (Siemens Husarz)',
    currentPosition: lineWawaGrodzisk[1],
    speed: 28, // ~100 km/h
    heading: 245,
    lastUpdate: Date.now(),
    path: lineWawaGrodzisk,
    pathIndex: 1,
    origin: 'Warszawa Wschodnia',
    destination: 'Świnoujście / Poznań',
    delayMinutes: 3,
  },
  {
    id: 'KM 19432',
    name: 'Koleje Mazowieckie',
    route: 'Grodzisk Maz. — Warszawa Wschodnia',
    type: 'KM',
    operator: 'Koleje Mazowieckie',
    rollingStock: 'ED160-012 (Stadler FLIRT)',
    currentPosition: lineWawaGrodzisk[5],
    speed: 22, // ~80 km/h
    heading: 65,
    lastUpdate: Date.now(),
    path: [...lineWawaGrodzisk].reverse(),
    pathIndex: 2,
    origin: 'Grodzisk Mazowiecki',
    destination: 'Warszawa Wschodnia',
    delayMinutes: 0,
  },
  {
    id: 'R 12340',
    name: 'Polregio',
    route: 'Siedlce — Warszawa Zachodnia',
    type: 'Polregio',
    operator: 'POLREGIO',
    rollingStock: 'EN57-AKM (Zmodernizowany Kibel)',
    currentPosition: lineWawaSiedlce[2],
    speed: 20, // ~72 km/h
    heading: 260,
    lastUpdate: Date.now(),
    path: [...lineWawaSiedlce].reverse(),
    pathIndex: 2,
    origin: 'Siedlce',
    destination: 'Warszawa Zachodnia',
    delayMinutes: 1,
  },
  {
    id: 'CARGO 66401',
    name: 'Skład Węglowy',
    route: 'Śląsk — Port Gdańsk',
    type: 'Cargo',
    operator: 'PKP Cargo',
    rollingStock: 'Newag Dragon 2 (ET26)',
    currentPosition: lineWawaGdansk[5],
    speed: 16, // ~60 km/h
    heading: 10,
    lastUpdate: Date.now(),
    path: lineWawaGdansk,
    pathIndex: 5,
    origin: 'Dąbrowa Górnicza',
    destination: 'Gdańsk Port Północny',
    delayMinutes: 12,
  },
];

export const railwayCrossings: RailwayCrossing[] = [
  {
    id: 'cross-1',
    name: 'Przejazd kat. B — ul. Płudowska (Warszawa)',
    category: 'B',
    line: 'Linia 9 Warszawa - Gdańsk',
    km: '15.420',
    location: { lat: 52.3312, lng: 20.9785 },
  },
  {
    id: 'cross-2',
    name: 'Przejazd kat. A — ul. Karczunkowska (Jeziorki)',
    category: 'A',
    line: 'Linia 8 Warszawa - Radom',
    km: '21.110',
    location: { lat: 52.1154, lng: 21.0112 },
  },
  {
    id: 'cross-wild-1',
    name: 'Dzikie Przejście — Warszawa Włochy (przy ogródkach działkowych)',
    category: 'D',
    line: 'Linia 1 Warszawa - Katowice',
    km: '7.850',
    location: { lat: 52.2045, lng: 20.9082 },
    isWildCrossing: true,
  },
  {
    id: 'cross-wild-2',
    name: 'Dzikie Przejście — Warszawa Praga Północ (szlak towarowy)',
    category: 'D',
    line: 'Linia 20 Warszawa Główna Towarowa',
    km: '4.200',
    location: { lat: 52.2685, lng: 21.0335 },
    isWildCrossing: true,
  },
];

export const initialHazardReports: HazardReport[] = [
  {
    id: 'rep-1',
    type: 'unofficial_crossing',
    description: 'Wydeptane przejście przez 3 tory, brak widoczności zza łuku. Duży ruch pieszych do przystanku autobusowego.',
    location: { lat: 52.2045, lng: 20.9082 },
    reportedAt: Date.now() - 3600000 * 24,
    verified: true,
  },
  {
    id: 'rep-2',
    type: 'obstacle',
    description: 'Uszkodzona siatka zabezpieczająca torowisko, dzieci przechodzą na skróty do szkoły.',
    location: { lat: 52.2685, lng: 21.0335 },
    reportedAt: Date.now() - 3600000 * 4,
    verified: true,
  },
];

export const geoFencedZones = railwayCrossings.map(c => ({
  lat: c.location.lat,
  lng: c.location.lng,
  radius: c.isWildCrossing ? 250 : 150,
  name: c.name,
  isWild: c.isWildCrossing,
}));
