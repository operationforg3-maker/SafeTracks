import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { PwaRegister } from "@/components/pwa-register";

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#2E3148',
};

export const metadata: Metadata = {
  title: 'SafeTracks — Bezpieczeństwo i Radar Kolejowy',
  description: 'Aktywne ostrzeganie pieszych przed potrąceniem na torach kolejowych oraz radar dla pasjonatów trainspottingu.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'SafeTracks',
  },
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/icon-192.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased selection:bg-accent selection:text-accent-foreground overscroll-none">
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
