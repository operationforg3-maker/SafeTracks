"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShareDialog } from '@/components/share-dialog';
import { 
  ShieldAlert, 
  Train, 
  Smartphone, 
  Radio, 
  BellRing, 
  Compass, 
  ArrowRight, 
  Download, 
  Activity, 
  CheckCircle2, 
  Volume2, 
  PackageCheck,
  Share2,
  HeartHandshake
} from 'lucide-react';

export default function LandingPage() {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const router = useRouter();

  // Jeśli użytkownik otworzył zainstalowaną aplikację PWA (tryb standalone), natychmiast przenieś do radaru /app
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isStandalone =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      if (isStandalone) {
        window.location.replace('/app');
      }
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-red-500 selection:text-white">
      {/* Pasek nawigacyjny */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="rounded-xl bg-gradient-to-br from-red-500 to-amber-600 p-2 text-white shadow-lg shadow-red-500/20">
              <Train className="h-5 w-5" />
            </div>
            <div>
              <span className="text-xl font-bold font-headline tracking-tight text-white">SafeTracks</span>
              <span className="text-[10px] block text-slate-400 font-mono -mt-1">LIFE SAVING & TRAIN RADAR</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
            <a href="#misja" className="hover:text-white transition">Misja</a>
            <a href="#funkcje" className="hover:text-white transition">Funkcje</a>
            <a href="#pwa" className="hover:text-white transition">Aplikacja Mobile</a>
            <a href="#trainspotting" className="hover:text-white transition">Trainspotting</a>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsShareOpen(true)}
              className="border-slate-800 hover:bg-slate-900 text-slate-200 text-xs h-9 gap-1.5"
            >
              <Share2 className="h-3.5 w-3.5 text-red-400" />
              <span className="hidden xs:inline">Udostępnij</span>
            </Button>

            <Link href="/app">
              <Button className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm px-4 h-9 shadow-lg shadow-red-600/30 gap-1.5">
                <span>Uruchom Aplikację</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-32">
        {/* Glow efekty w tle */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-red-600/15 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[350px] h-[350px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-8 relative z-10 text-center max-w-4xl">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-semibold mb-6">
            <ShieldAlert className="h-4 w-4" />
            <span>Technologia, która ratuje ludzkie życie</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight font-headline text-white leading-tight mb-6">
            Aktywne Ostrzeganie <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-red-500 via-amber-400 to-red-400 bg-clip-text text-transparent">
              Przed Nadjeżdżającym Pociągiem
            </span>
          </h1>

          <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed mb-10">
            Aplikacja webowa i mobilna (PWA), która wykrywa Twoją bliskość torów kolejowych i dzikich przejść, 
            oblicza wektor zbliżania się pociągu w czasie rzeczywistym i włącza akustyczny sygnał ostrzegawczy zanim będzie za późno.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/app" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8 text-base shadow-xl shadow-red-600/30 gap-2">
                <Activity className="h-5 w-5" />
                <span>Włącz Radar Online</span>
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setIsShareOpen(true)}
              className="w-full sm:w-auto border-slate-700 hover:bg-slate-900 text-slate-200 h-12 px-6 text-base gap-2"
            >
              <Share2 className="h-5 w-5 text-red-400" />
              <span>Udostępnij bliskim</span>
            </Button>
            <a href="#pwa" className="w-full sm:w-auto">
              <Button size="lg" variant="ghost" className="w-full text-slate-400 hover:text-white h-12 px-5 text-base gap-2">
                <Download className="h-4 w-4 text-amber-400" />
                <span>Instalacja PWA</span>
              </Button>
            </a>
          </div>

          {/* Statystyki / Trust marks */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 pt-12 border-t border-slate-800/80">
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-red-400">~200</div>
              <div className="text-xs text-slate-400 mt-1">Potrąceń pieszych rocznie na torach w Polsce</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-amber-400">&lt; 35 s</div>
              <div className="text-xs text-slate-400 mt-1">Krytyczny próg alarmowy potrącenia</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-blue-400">200 m</div>
              <div className="text-xs text-slate-400 mt-1">Automatyczna strefa geofencingu torowisk</div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
              <div className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">100%</div>
              <div className="text-xs text-slate-400 mt-1">Darmowy dostęp bez reklam i barier</div>
            </div>
          </div>
        </div>
      </section>

      {/* Dlaczego to robimy (Misja) */}
      <section id="misja" className="py-16 sm:py-24 bg-slate-900/40 border-y border-slate-800/80">
        <div className="container mx-auto px-4 sm:px-8 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="space-y-5">
              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs font-semibold px-3 py-1">
                Dlaczego SafeTracks?
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold font-headline text-white leading-tight">
                Pociąg z prędkością 140 km/h pokonuje 40 metrów w zaledwie jedną sekundę.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                Większość śmiertelnych wypadków ma miejsce na <b>dzikich przejściach</b>, gdzie piesi przechodzą na skróty w słuchawkach lub przy ograniczonej widoczności na łuku torowiska.
              </p>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                SafeTracks powstał, by dać pieszemu szansę: telefon w kieszeni monitoruje obecność torów kolejowych i uruchamia wibracje oraz przenikliwy ryk syreny kolejowej, gdy w Twoim kierunku zbliża się stalowy kolos.
              </p>
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Działa w tle na telefonie dzięki technologii Progressive Web App</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Synteza audio Web Audio API — przenikliwy dźwięk trąbki lokomotywy</span>
                </div>
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-slate-300">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Dedykowany przycisk ratunkowy SOS z bezpośrednim wybieraniem 112</span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="p-6 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                    <ShieldAlert className="h-5 w-5 animate-pulse" />
                    <span>SYMULACJA ZDARZENIA SZLAKOWEGO</span>
                  </div>
                  <Badge variant="destructive" className="font-mono text-xs">KRYTYCZNY</Badge>
                </div>

                <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/40 space-y-2">
                  <div className="flex justify-between items-center text-xs text-red-200">
                    <span>Zbliżający się skład:</span>
                    <span className="font-bold font-mono">EIP 1300 (Pendolino)</span>
                  </div>
                  <div className="text-3xl font-extrabold font-mono text-white tracking-wider">
                    ETA: 00:24s
                  </div>
                  <div className="w-full bg-red-950 rounded-full h-2 overflow-hidden">
                    <div className="bg-red-500 h-full w-3/4 animate-pulse"></div>
                  </div>
                  <p className="text-[11px] text-red-300 pt-1">
                    UWAGA! Pociąg jedzie z prędkością 130 km/h w odległości 850 metrów. Natychmiast opuść torowisko!
                  </p>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1.5">
                    <Volume2 className="h-4 w-4 text-amber-400" />
                    Alarm akustyczny: <b>AKTYWNY</b>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Radio className="h-4 w-4 text-blue-400" />
                    Geofencing: <b>200m strefa</b>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Główne Funkcjonalności */}
      <section id="funkcje" className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-8 max-w-6xl">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs font-semibold px-3 py-1 mb-3">
              Funkcjonalności Systemu
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold font-headline text-white">
              Zaawansowany Radar Kolejowy w Twojej Kieszeni
            </h2>
            <p className="text-slate-400 text-sm sm:text-base mt-3">
              Połączenie ochrony życia z funkcjonalnościami dla miłośników kolei (Trainspotterów).
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <div className="h-12 w-12 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <BellRing className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Algorytm Zbliżeniowy & ETA</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Przelicza w czasie rzeczywistym odległość, prędkość lokomotywy i kąt zbliżania, kompensując opóźnienia telemetrii.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <div className="h-12 w-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-4">
                <Compass className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Mapa Szlaków & OpenRailwayMap</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Precyzyjna siatka linii kolejowych PKP PLK, rozjazdy, semafory, kładki, przejazdy kat. A-D oraz oznaczone dzikie przejścia.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <div className="h-12 w-12 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
                <PackageCheck className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Trainspotting & Składy Towarowe</h3>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Społecznościowe zgłaszanie pociągów towarowych i niemonitorowanych w 1 kliknięcie, aby ostrzec innych pieszych w okolicy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sekcja Mobile / PWA */}
      <section id="pwa" className="py-16 sm:py-24 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 border-t border-slate-800">
        <div className="container mx-auto px-4 sm:px-8 max-w-5xl">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="order-2 md:order-1 relative">
              <div className="relative mx-auto w-[280px] sm:w-[320px] rounded-[40px] border-[8px] border-slate-800 bg-slate-950 p-4 shadow-2xl">
                <div className="w-24 h-4 bg-slate-800 rounded-full mx-auto mb-4" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="font-bold text-xs text-white">SafeTracks Mobile</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <div className="h-36 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center p-3 text-center">
                    <span className="text-xs text-slate-400 font-mono">Radar Szlakowy 24/7 (GPS Aktywny)</span>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/15 border border-amber-500/40 text-[11px] text-amber-300">
                    ⚠️ Przejście dzikie w odległości 90m
                  </div>
                  <Button className="w-full bg-red-600 text-white font-bold text-xs h-9">
                    SOS 112
                  </Button>
                </div>
              </div>
            </div>

            <div className="order-1 md:order-2 space-y-5">
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-semibold px-3 py-1">
                Wersja Web & Mobile (PWA)
              </Badge>
              <h2 className="text-3xl sm:text-4xl font-bold font-headline text-white leading-tight">
                Jedna aplikacja na komputerze, tablecie i smartfonie.
              </h2>
              <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
                SafeTracks jest zbudowany w architekturze <b>Progressive Web App (PWA)</b>. Oznacza to, że nie musisz pobierać dziesiątek megabajtów ze sklepu:
              </p>
              <div className="space-y-3">
                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                  <Smartphone className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-white">Instalacja w 1 sekundę</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Na iPhone (Safari: Udostępnij ➔ Do ekranu początkowego) lub Android (Chrome: Zainstaluj aplikację).
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-start gap-3">
                  <Radio className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-sm font-bold text-white">Praca offline i w trudnym terenie</div>
                    <div className="text-xs text-slate-400 mt-0.5">
                      Service Worker buforuje mapy i procedury ratunkowe, działając nawet przy słabym zasięgu GSM w lesie przy torach.
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3">
                <Link href="/app">
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 px-6 text-sm gap-2">
                    <Smartphone className="h-4 w-4" />
                    <span>Otwórz i dodaj do telefonu</span>
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  onClick={() => setIsShareOpen(true)}
                  className="border-slate-700 hover:bg-slate-800 text-slate-200 h-11 px-5 text-sm gap-2"
                >
                  <Share2 className="h-4 w-4 text-emerald-400" />
                  <span>Udostępnij aplikację</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stopka */}
      <footer className="mt-auto border-t border-slate-800/80 bg-slate-950 py-8 text-xs text-slate-500">
        <div className="container mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Train className="h-4 w-4 text-red-500" />
            <span className="font-bold text-slate-300">SafeTracks</span>
            <span>— Otwarte bezpieczeństwo na szlakach kolejowych</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsShareOpen(true)}
              className="hover:text-slate-300 transition flex items-center gap-1"
            >
              <Share2 className="h-3.5 w-3.5 text-red-400" />
              <span>Udostępnij</span>
            </button>
            <Link href="/app" className="hover:text-slate-300 transition">Radar Live</Link>
            <a href="https://pdp.plk-sa.pl" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">Dane PKP PLK</a>
            <a href="https://112.gov.pl" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">Numer Alarmowy 112</a>
          </div>
        </div>
      </footer>

      {/* Dialog udostępniania aplikacji */}
      <ShareDialog open={isShareOpen} onOpenChange={setIsShareOpen} />
    </div>
  );
}
