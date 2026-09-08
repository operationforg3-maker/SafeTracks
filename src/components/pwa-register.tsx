"use client";

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV !== 'development') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] Service Worker zarejestrowany ze zakresem:', registration.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Rejestracja Service Workera nie powiodła się:', err);
          });
      });
    }
  }, []);

  return null;
}
