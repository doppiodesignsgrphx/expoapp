import { useEffect, useState } from 'react';

// The desktop app (desktop/app.py) shows this web app in its own window and
// exposes a few functions as window.pywebview.api. In a normal browser that
// object does not exist, and the app falls back to the browser print dialog.

export const desktopApi = () => (typeof window !== 'undefined' && window.pywebview && window.pywebview.api) || null;

export function useDesktop() {
  const [ready, setReady] = useState(Boolean(desktopApi()));
  useEffect(() => {
    if (ready) return undefined;
    const on = () => setReady(Boolean(desktopApi()));
    window.addEventListener('pywebviewready', on);
    on();
    return () => window.removeEventListener('pywebviewready', on);
  }, [ready]);
  return ready;
}
