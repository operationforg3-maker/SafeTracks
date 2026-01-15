"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useGeolocation } from "@/hooks/use-geolocation";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus } from "lucide-react";

interface HazardReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const formSchema = z.object({
  type: z.enum(["obstacle", "unofficial_crossing"], { required_error: "Wybierz typ zgłoszenia." }),
  description: z.string().min(10, { message: "Opis musi mieć co najmniej 10 znaków." }).max(200),
});

export function HazardReportDialog({ open, onOpenChange }: HazardReportDialogProps) {
  const { position } = useGeolocation();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      description: "",
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log({ ...values, location: position });
    toast({
      title: "Zgłoszenie wysłane!",
      description: "Dziękujemy za pomoc w dbaniu o bezpieczeństwo.",
    });
    form.reset();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><MessageSquarePlus className="h-6 w-6 text-primary"/>Zgłoś zagrożenie</DialogTitle>
          <DialogDescription>
            Twoje zgłoszenie pomoże innym użytkownikom i służbom kolejowym. Twoja przybliżona lokalizacja zostanie dołączona.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ zagrożenia</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz z listy..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="obstacle">Przeszkoda na torach</SelectItem>
                      <SelectItem value="unofficial_crossing">"Dzikie przejście"</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Krótki opis</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Np. powalone drzewo, duży kamień..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="submit">Wyślij zgłoszenie</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
