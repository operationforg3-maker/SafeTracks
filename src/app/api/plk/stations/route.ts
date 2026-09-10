import { NextRequest, NextResponse } from 'next/server';
import stationsData from '@/lib/plk-stations-all.json';
import { calculateDistanceMeters } from '@/services/pkp-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    // Wyszukiwanie po nazwie
    if (q && q.trim().length > 0) {
      const query = q.trim().toLowerCase();
      const results = stationsData
        .filter((st) => st.name.toLowerCase().includes(query))
        .slice(0, limit);

      return NextResponse.json({
        stations: results,
        total: results.length,
      });
    }

    // Wyszukiwanie najbliższych stacji wg współrzędnych GPS
    if (latParam && lngParam) {
      const lat = parseFloat(latParam);
      const lng = parseFloat(lngParam);
      if (!isNaN(lat) && !isNaN(lng)) {
        const sorted = stationsData.map((st) => ({
          ...st,
          distanceMeters: calculateDistanceMeters(lat, lng, st.lat, st.lng),
        }));

        sorted.sort((a, b) => a.distanceMeters - b.distanceMeters);
        return NextResponse.json({
          stations: sorted.slice(0, limit),
          total: limit,
        });
      }
    }

    // Domyślnie: zwróć popularne węzły kolejowe w Polsce
    const popularNames = [
      'Warszawa Centralna',
      'Kraków Główny',
      'Poznań Główny',
      'Wrocław Główny',
      'Gdańsk Główny',
      'Katowice',
      'Łódź Fabryczna',
      'Szczecin Główny',
      'Gdynia Główna',
      'Białystok',
    ];

    const popular = stationsData.filter((s) => popularNames.includes(s.name));
    return NextResponse.json({
      stations: popular,
      total: popular.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 });
  }
}
