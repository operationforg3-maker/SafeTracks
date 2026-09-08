export type Train = {
  id: string;
  name?: string;
  route: string;
  type: string; // 'EIP', 'IC', 'TLK', 'KM', 'Polregio', 'Cargo'
  operator?: string; // 'PKP Intercity', 'Koleje Mazowieckie', 'Polregio', 'PKP Cargo'
  rollingStock?: string; // 'ED250 (Pendolino)', 'EU44 (Husarz)', 'ED161 (Dart)', 'EN57-AKM', 'Dragon 2'
  currentPosition: {
    lat: number;
    lng: number;
  };
  speed: number; // in m/s (e.g. 25 m/s = 90 km/h)
  heading?: number; // bearing in degrees (0-360)
  lastUpdate: number; // timestamp
  path: { lat: number; lng: number }[];
  pathIndex: number;
  destination?: string;
  origin?: string;
  delayMinutes?: number;
};

export type HazardReport = {
  id: string;
  location: {
    lat: number;
    lng: number;
  };
  description: string;
  type: 'obstacle' | 'unofficial_crossing' | 'poor_visibility' | 'broken_gate';
  reportedAt: number;
  verified?: boolean;
};

export type RailwayCrossing = {
  id: string;
  name: string;
  category: 'A' | 'B' | 'C' | 'D'; // A: guarded with gates, B: automatic gates+lights, C: automatic lights, D: cross of St. Andrew
  line: string;
  km: string;
  location: {
    lat: number;
    lng: number;
  };
  isWildCrossing?: boolean;
};

export type AlertLevel = 'safe' | 'warning' | 'critical';

export type PredictiveETAOutput = {
  estimatedArrivalTime: number;
  isSafe: boolean;
  alertLevel: AlertLevel;
};

export type ProximityAlertState = {
  level: AlertLevel;
  nearestTrain?: Train;
  distanceMeters?: number;
  estimatedTimeToArrivalSeconds?: number;
  isInsideHazardZone: boolean;
  message: string;
};
