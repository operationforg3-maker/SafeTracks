"use client";

import { useState } from 'react';
import { Siren, Menu, Train, MessageSquarePlus, Github } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { SosDialog } from '@/components/sos-dialog';
import { HazardReportDialog } from '@/components/hazard-report-dialog';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

interface HeaderProps {
  enthusiastMode: boolean;
  onEnthusiastModeChange: (value: boolean) => void;
}

export function Header({ enthusiastMode, onEnthusiastModeChange }: HeaderProps) {
  const [isSosOpen, setIsSosOpen] = useState(false);
  const [isHazardReportOpen, setIsHazardReportOpen] = useState(false);
  const githubUrl = "https://github.com/operationforg3-maker/SafeTracks.git";

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4">
            <Train className="h-8 w-8 text-primary" />
            <h1 className="font-headline text-2xl font-bold text-primary">
              SafeTracks
            </h1>
          </div>

          <div className="hidden items-center gap-4 md:flex">
            <Button variant="outline" size="icon" asChild>
                <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                    <Github className="h-4 w-4" />
                    <span className="sr-only">GitHub</span>
                </a>
            </Button>
            <div className="flex items-center space-x-2">
              <Switch id="enthusiast-mode" checked={enthusiastMode} onCheckedChange={onEnthusiastModeChange} />
              <Label htmlFor="enthusiast-mode" className="cursor-pointer">Tryb Pasjonata</Label>
            </div>
            <Button variant="outline" onClick={() => setIsHazardReportOpen(true)}>
              <MessageSquarePlus className="mr-2 h-4 w-4" />
              Zgłoś zagrożenie
            </Button>
            <Button variant="destructive" onClick={() => setIsSosOpen(true)}>
              <Siren className="mr-2 h-4 w-4" />
              SOS
            </Button>
          </div>
          
          <div className="md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent>
                <div className="flex flex-col gap-6 pt-8">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enthusiast-mode-mobile">Tryb Pasjonata</Label>
                    <Switch id="enthusiast-mode-mobile" checked={enthusiastMode} onCheckedChange={onEnthusiastModeChange} />
                  </div>
                  <Button asChild variant="outline" className="w-full">
                     <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                        <Github className="mr-2 h-4 w-4" />
                        GitHub
                     </a>
                  </Button>
                  <Button className="w-full" variant="outline" onClick={() => { setIsHazardReportOpen(true); }}>
                    <MessageSquarePlus className="mr-2 h-4 w-4" />
                    Zgłoś zagrożenie
                  </Button>
                  <Button className="w-full" variant="destructive" onClick={() => { setIsSosOpen(true); }}>
                    <Siren className="mr-2 h-4 w-4" />
                    SOS
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>
      <SosDialog open={isSosOpen} onOpenChange={setIsSosOpen} />
      <HazardReportDialog open={isHazardReportOpen} onOpenChange={setIsHazardReportOpen} />
    </>
  );
}
