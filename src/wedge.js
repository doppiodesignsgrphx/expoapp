import { useEffect, useRef } from 'react';
import { primeFeedback } from './feedback.js';

// Support for handheld USB or Bluetooth barcode scanners. These act as a
// keyboard: they type the code very quickly and press Enter. A burst of fast
// keystrokes ending in Enter is treated as a scan, wherever the cursor is.
// Nobody types six characters in a row at under 60 thousandths of a second each,
// so normal typing is left alone.
export function useWedgeScanner(onScan, { minLength = 6, maxGap = 60 } = {}) {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let buffer = '';
    let last = 0;

    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      if (now - last > maxGap) buffer = '';
      last = now;

      if (e.key === 'Enter') {
        const text = buffer;
        buffer = '';
        if (text.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          primeFeedback();
          handler.current(text);
        }
        return;
      }
      if (e.key.length === 1) buffer += e.key;
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [minLength, maxGap]);
}
