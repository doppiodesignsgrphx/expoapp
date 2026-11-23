import { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';

// Camera QR scanner. Calls onScan(text) once per distinct code, ignoring
// repeats of the same code for three seconds so a held badge is not read twice.
export default function Scanner({ onScan, onClose, scanned = false }) {
  const videoRef = useRef(null);
  const last = useRef({ text: '', at: 0 });
  const handler = useRef(onScan);
  const [error, setError] = useState('');

  // Keep the latest callback without restarting the camera on every render.
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        const text = String(result?.data || '').trim();
        const now = Date.now();
        if (!text || (text === last.current.text && now - last.current.at < 3000)) return;
        last.current = { text, at: now };
        handler.current(text);
      },
      { preferredCamera: 'environment', highlightScanRegion: true, highlightCodeOutline: true, maxScansPerSecond: 8 }
    );
    scanner.start().catch(() => setError('The camera could not be opened. Allow camera access for this site, and make sure the address starts with https.'));
    return () => {
      scanner.stop();
      scanner.destroy();
    };
  }, []);

  return (
    <div className={`scanner${scanned ? ' scanned' : ''}`}>
      <video ref={videoRef} muted playsInline />
      {error && <p className="notice error">{error}</p>}
      <button className="btn secondary" onClick={onClose}>Close scanner</button>
    </div>
  );
}
