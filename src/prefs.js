// Small per-computer settings. Storage can be unavailable, so every call is guarded.
import { desktopApi } from './desktop.js';

const KEY = 'expoapp.autoprint';

// On by default in the desktop app, where a badge prints with no dialog.
// Off by default in a browser, where every print opens the print dialog.
export function getAutoPrint() {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) return saved === '1';
  } catch { /* fall through to the default */ }
  return Boolean(desktopApi());
}

export function setAutoPrint(on) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch { /* not saved, still applies until the page reloads */ }
}
