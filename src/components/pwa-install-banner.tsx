"use client";

import { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
import { Button } from './ui/button';

export function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showIosPrompt, setShowIosPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Sprawdź czy już uruchomiono w trybie standalone (zainstalowane PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Obsługa Android/Chrome BeforeInstallPrompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Wykrywanie iOS Safari (który nie wspiera beforeinstallprompt, ale wspiera instalację przez "Dodaj do ekranu początkowego")
    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isSafari =
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

    if (isIos && isSafari && !isStandalone) {
      // Pokaż po 3 sekundach od wejścia
      const timer = setTimeout(() => setShowIosPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  if (dismissed) return null;

  // Android / Desktop Chrome PWA Banner
  if (deferredPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[2000] sm:max-w-md bg-primary text-primary-foreground p-3.5 rounded-xl shadow-2xl border border-primary/20 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
        <div className="flex items-center gap-3">
          <div className="bg-white/10 p-2 rounded-lg">
            <Download className="h-5 w-5 text-accent" />
          </div>
          <div>
            <div className="font-bold text-sm">Zainstaluj SafeTracks</div>
            <div className="text-xs text-primary-foreground/80">
              Szybki dostęp na telefonie i alarmy w kieszeni
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstallClick}
            className="h-8 text-xs font-bold bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Zainstaluj
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 text-primary-foreground/70 hover:text-white"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // iOS Safari "Dodaj do ekranu początkowego" banner
  if (showIosPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[2000] sm:max-w-md bg-card text-card-foreground p-3.5 rounded-xl shadow-2xl border border-border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-5">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-lg text-primary">
            <Share className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold text-sm">Zainstaluj na iPhone</div>
            <div className="text-xs text-muted-foreground">
              Kliknij <span className="font-bold text-primary">Udostępnij ⎙</span>, a potem <span className="font-bold text-primary">„Do ekranu początkowego”</span>.
            </div>
          </div>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setShowIosPrompt(false);
            setDismissed(true);
          }}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return null;
}
