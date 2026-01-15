export type Train = {
  id: string;
  route: string;
  type: string;
  currentPosition: {
    lat: number;
    lng: number;
  };
  speed: number; // in m/s
  lastUpdate: number; // timestamp
  path: { lat: number; lng: number }[];
  pathIndex: number;
};

export type HazardReport = {
  location: {
    lat: number;
    lng: number;
  };
  description: string;
  type: 'obstacle' | 'unofficial_crossing';
};

export type AlertLevel = 'safe' | 'warning' | 'critical';
