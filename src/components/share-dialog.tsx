"use client";

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Share2, Copy, Check, MessageCircle, Send, Facebook, Twitter, HeartHandshake } from 'lucide-react';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = typeof window !== 'undefined' ? window.location.origin : 'https://safetracks-ec029.web.app';
  const shareTitle = 'SafeTracks — Aktywne Ostrzeganie Przed Nadjeżdżającym Pociągiem';
  const shareText = 'Zainstaluj SafeTracks na telefonie. Aplikacja ostrzega pieszych przed potrąceniem na torach i dzikich przejściach:';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        onOpenChange(false);
      } catch (err) {}
    }
  };

  const shareWhatsApp = () => {
    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`;
    window.open(url, '_blank');
  };

  const shareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] bg-slate-900 border-slate-800 text-slate-100">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold font-headline text-white">
                Udostępnij SafeTracks
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-400">
                Przekaż aplikację bliskim, dzieciom lub znajomym mieszkającym w pobliżu linii kolejowych.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Bezpośrednie udostępnienie systemowe (jeśli obsługiwane np. na telefonie) */}
          {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
            <Button
              onClick={handleNativeShare}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 text-xs sm:text-sm gap-2 shadow-lg shadow-red-600/25"
            >
              <Share2 className="h-4 w-4" />
              <span>Udostępnij przez telefon (SMS, Messenger, AirDrop)</span>
            </Button>
          )}

          {/* Szybkie przyciski social */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={shareWhatsApp}
              className="border-slate-800 hover:bg-slate-800 text-xs gap-1.5 h-10 text-emerald-400"
            >
              <MessageCircle className="h-4 w-4" />
              <span>WhatsApp</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shareFacebook}
              className="border-slate-800 hover:bg-slate-800 text-xs gap-1.5 h-10 text-blue-400"
            >
              <Facebook className="h-4 w-4" />
              <span>Facebook</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={shareTwitter}
              className="border-slate-800 hover:bg-slate-800 text-xs gap-1.5 h-10 text-sky-400"
            >
              <Twitter className="h-4 w-4" />
              <span>X / Twitter</span>
            </Button>
          </div>

          {/* Kopiowanie bezpośredniego linku */}
          <div className="space-y-1.5 pt-1">
            <div className="text-[11px] font-semibold text-slate-300">Bezpośredni link do aplikacji:</div>
            <div className="flex gap-2">
              <Input
                readOnly
                value={shareUrl}
                className="h-9 bg-slate-950 border-slate-800 text-xs font-mono text-slate-200"
              />
              <Button
                size="sm"
                onClick={handleCopy}
                className="h-9 px-3 text-xs bg-slate-800 hover:bg-slate-700 text-white gap-1.5 shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Skopiowano!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Kopiuj</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-400 hover:text-white"
          >
            Zamknij
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
