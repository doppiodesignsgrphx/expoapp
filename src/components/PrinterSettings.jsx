import { useEffect, useState } from 'react';
import { desktopApi } from '../desktop.js';

// Shown only inside the desktop app. Settings are saved on this computer.
export default function PrinterSettings({ onClose }) {
  const [ip, setIp] = useState('');
  const [roll, setRoll] = useState('2205');
  const [rolls, setRolls] = useState({});
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    desktopApi().get_settings().then((s) => {
      setIp(s.printer_ip || '');
      setRoll(s.roll || '2205');
      setRolls(s.rolls || {});
      setVersion(s.version || '');
    });
  }, []);

  async function run(action) {
    setBusy(true);
    setResult(null);
    try {
      const saved = await desktopApi().save_settings(ip, roll);
      setResult(saved.ok && action === 'test' ? await desktopApi().test_print() : saved);
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Something went wrong.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel settings">
      <h1>Badge printer</h1>
      <label>
        Printer address
        <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.4.36" inputMode="decimal" autoCapitalize="none" />
      </label>
      <p className="hint">Shown on the printer's screen under its network settings. This computer and the printer must be on the same network.</p>
      <label>
        Roll loaded in the printer
        <select value={roll} onChange={(e) => setRoll(e.target.value)}>
          {Object.entries(rolls).map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
      {result && <p className={`notice ${result.ok ? 'ok' : 'error'}`} role="status">{result.message}</p>}
      <div className="row">
        <button className="btn" disabled={busy} onClick={() => run('save')}>Save</button>
        <button className="btn secondary" disabled={busy} onClick={() => run('test')}>{busy ? 'Working' : 'Save and test print'}</button>
        <button className="btn secondary" onClick={onClose}>Close</button>
      </div>
      {version && <p className="hint">Desktop app version {version}</p>}
    </section>
  );
}
