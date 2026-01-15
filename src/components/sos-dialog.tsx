"use client";

import { Copy, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "./ui/skeleton";

interface SosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SosDialog({ open, onOpenChange }: SosDialogProps) {
  const { position, error, loading } = useGeolocation();
  const { toast } = useToast();

  const handleCopy = () => {
    if (position) {
      const textToCopy = `Moja lokalizacja: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
      navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Skopiowano!",
        description: "Twoja lokalizacja została skopiowana do schowka.",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Siren className="h-6 w-6 text-destructive" />
            Moduł SOS
          </DialogTitle>
          <DialogDescription>
            W razie zagrożenia, przekaż operatorowi 112 poniższe dane.
          </DialogDescription>
        </DialogHeader>
        <div className="my-4 flex flex-col items-center justify-center gap-4 rounded-lg border bg-muted p-4">
          <p className="text-sm font-medium text-muted-foreground">Twoja lokalizacja GPS</p>
          {loading && <Skeleton className="h-8 w-48" />}
          {error && <p className="text-sm text-destructive">{error.message}</p>}
          {position && !loading && (
            <div className="flex items-center gap-4">
                <code className="text-lg font-bold text-primary">{`${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`}</code>
                <Button size="icon" variant="ghost" onClick={handleCopy}>
                    <Copy className="h-4 w-4" />
                </Button>
            </div>
          )}
        </div>
        <div className="text-center text-xs text-muted-foreground">
          Dane o najbliższym pociągu zostaną dodane automatycznie, gdy będą dostępne.
        </div>
      </DialogContent>
    </Dialog>
  );
}
