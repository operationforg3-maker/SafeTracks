"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ShareDialog } from '@/components/share-dialog';
import {
  Train,
  Smartphone,
  ArrowRight,
  Share2,
  MapPin,
  Bell,
  Shield,
  Zap,
  Download,
} from 'lucide-react';

export default function LandingPage() {
  const [isShareOpen, setIsShareOpen] = useState(false);
  const router = useRouter();

  // PWA standalone → od razu do /app
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/90 backdrop-blur-lg">
        <div className="container mx-auto flex h-14 items-center justify-between px-4 sm:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="rounded-lg bg-gradient-to-br from-red-500 to-amber-600 p-1.5 text-white">
              <Train className="h-4 w-4" />
            </div>
            <span className="text-lg font-bold tracking-tight">SafeTracks</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsShareOpen(true)}
              className="text-slate-400 hover:text-white text-xs h-8 gap-1.5 hidden sm:flex"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>Udostępnij</span>
            </Button>

            <Link href="/app">
              <Button className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-4 h-8 gap-1.5">
                <span>Uruchom</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-32">
        {/* Subtle glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-red-600/10 blur-[120px] rounded-full pointer-events-none" />

        <div className="container mx-auto px-4 sm:px-8 relative z-10 text-center max-w-3xl">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6">
            Telefon ostrzeże Cię{' '}
            <span className="bg-gradient-to-r from-red-500 to-amber-400 bg-clip-text text-transparent">
              przed pociągiem
            </span>
          </h1>

          <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto leading-relaxed mb-10">
            SafeTracks monitoruje Twoją pozycję GPS względem torów kolejowych
            i ostrzega dźwiękiem, gdy zbliża się pociąg. Bez rejestracji,
            bez instalacji ze sklepu, za darmo.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/app" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8 text-base gap-2 shadow-xl shadow-red-600/25">
                <Zap className="h-5 w-5" />
                <span>Włącz Radar</span>
              </Button>
            </Link>
            <a href="#jak-dziala" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full border-slate-700 hover:bg-slate-900 text-slate-200 h-12 px-6 text-base">
                Jak to działa?
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-slate-800/60 bg-slate-900/40">
        <div className="container mx-auto px-4 sm:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-red-400">~200</div>
              <div className="text-xs text-slate-500 mt-1">potrąceń pieszych rocznie<br/>na torach w Polsce</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-amber-400">39 m/s</div>
              <div className="text-xs text-slate-500 mt-1">prędkość pociągu 140 km/h<br/>= 39 metrów na sekundę</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-blue-400">GPS</div>
              <div className="text-xs text-slate-500 mt-1">precyzja monitorowania<br/>Twojej pozycji</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold font-mono text-emerald-400">0 zł</div>
              <div className="text-xs text-slate-500 mt-1">darmowy dostęp<br/>bez reklam</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Jak to działa ── */}
      <section id="jak-dziala" className="py-16 sm:py-24 scroll-mt-16">
        <div className="container mx-auto px-4 sm:px-8 max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Jak to działa?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Krok 1 */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/15 text-blue-400 flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-7 w-7" />
              </div>
              <div className="text-xs font-mono text-slate-500 mb-2">KROK 1</div>
              <h3 className="text-base font-bold mb-2">Wykrywamy tory</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                GPS w Twoim telefonie porównuje pozycję z bazą 3000+ stacji i przejazdów PKP PLK.
              </p>
            </div>

            {/* Krok 2 */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center mx-auto mb-4">
                <Train className="h-7 w-7" />
              </div>
              <div className="text-xs font-mono text-slate-500 mb-2">KROK 2</div>
              <h3 className="text-base font-bold mb-2">Śledzimy pociągi</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Radar pobiera w czasie rzeczywistym pozycje pociągów z API PKP PLK i oblicza wektor zbliżania.
              </p>
            </div>

            {/* Krok 3 */}
            <div className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center mx-auto mb-4">
                <Bell className="h-7 w-7" />
              </div>
              <div className="text-xs font-mono text-slate-500 mb-2">KROK 3</div>
              <h3 className="text-base font-bold mb-2">Alarm ostrzegawczy</h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Jeśli jesteś przy torach i zbliża się pociąg — uruchamiamy przenikliwy dźwięk syreny i wibracje.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Funkcje ── */}
      <section className="py-16 sm:py-24 bg-slate-900/30 border-y border-slate-800/60">
        <div className="container mx-auto px-4 sm:px-8 max-w-4xl">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Co wyróżnia SafeTracks?
          </h2>

          <div className="grid sm:grid-cols-2 gap-5">
            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <Shield className="h-6 w-6 text-red-400 mb-3" />
              <h3 className="text-sm font-bold mb-1.5">Zero fałszywych alarmów</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Alarm wyzwala się TYLKO gdy jesteś blisko torów i nadjeżdża pociąg.
                Żadnych powiadomień w domu.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <MapPin className="h-6 w-6 text-blue-400 mb-3" />
              <h3 className="text-sm font-bold mb-1.5">Mapa z torami OpenRailwayMap</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Precyzyjna warstwa torów kolejowych, przejazdów, semaforów
                i niebezpiecznych dzikich przejść.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <Zap className="h-6 w-6 text-amber-400 mb-3" />
              <h3 className="text-sm font-bold mb-1.5">Dane w czasie rzeczywistym</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Pozycje, prędkości i kierunki pociągów bezpośrednio z oficjalnego API PKP PLK.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition">
              <Smartphone className="h-6 w-6 text-emerald-400 mb-3" />
              <h3 className="text-sm font-bold mb-1.5">Działa jak natywna aplikacja</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Technologia PWA — dodaj do ekranu głównego na iPhone lub Androidzie.
                Bez pobierania ze sklepu.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section className="py-16 sm:py-24">
        <div className="container mx-auto px-4 sm:px-8 max-w-xl text-center">
          <div className="rounded-lg bg-gradient-to-br from-red-500 to-amber-600 p-1.5 text-white w-14 h-14 flex items-center justify-center mx-auto mb-6">
            <Train className="h-7 w-7" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Włącz radar i bądź bezpieczny
          </h2>
          <p className="text-sm text-slate-400 mb-8">
            Wystarczy GPS w telefonie. Otwórz stronę, zezwól na lokalizację — to wszystko.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link href="/app">
              <Button size="lg" className="bg-red-600 hover:bg-red-700 text-white font-bold h-12 px-8 text-base gap-2 shadow-xl shadow-red-600/25">
                <Zap className="h-5 w-5" />
                Uruchom SafeTracks
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              onClick={() => setIsShareOpen(true)}
              className="border-slate-700 hover:bg-slate-900 text-slate-200 h-12 px-6 text-base gap-2"
            >
              <Share2 className="h-4 w-4" />
              Udostępnij bliskim
            </Button>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span>PWA — dodaj do telefonu</span>
            </div>
            <span className="text-slate-700">•</span>
            <span>Dane PKP PLK w czasie rzeczywistym</span>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="mt-auto border-t border-slate-800/60 bg-slate-950 py-6 text-xs text-slate-500">
        <div className="container mx-auto px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Train className="h-3.5 w-3.5 text-red-500" />
            <span className="font-medium text-slate-400">SafeTracks</span>
            <span>— bezpieczeństwo na torach</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/app" className="hover:text-slate-300 transition">Radar</Link>
            <a href="https://112.gov.pl" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">112</a>
            <a href="https://pdp.plk-sa.pl" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300 transition">PKP PLK</a>
          </div>
        </div>
      </footer>

      <ShareDialog open={isShareOpen} onOpenChange={setIsShareOpen} />
    </div>
  );
}
