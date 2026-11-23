import { useEffect, useState } from 'react';
import { desktopApi, useDesktop } from '../desktop.js';
import { getAutoPrint, setAutoPrint } from '../prefs.js';

// Settings are saved on this computer. The printer address and roll only apply in the desktop app.
export default function PrinterSettings({ onClose }) {
  const [ip, setIp] = useState('');
  const [roll, setRoll] = useState('2205');
  const [rolls, setRolls] = useState({});
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [auto, setAuto] = useState(getAutoPrint);
  const desktop = useDesktop();

  useEffect(() => {
    if (!desktop) return;
    desktopApi().get_settings().then((s) => {
      setIp(s.printer_ip || '');
      setRoll(s.roll || '2205');
      setRolls(s.rolls || {});
      setVersion(s.version || '');
    });
  }, [desktop]);

  const autoToggle = (
    <label className="check">
      <input type="checkbox" checked={auto} onChange={(e) => { setAuto(e.target.checked); setAutoPrint(e.target.checked); }} />
      <span>Print the badge automatically when a scan checks someone in</span>
    </label>
  );

  if (!desktop) {
    return (
      <section className="panel settings">
        <h2>Badge printer</h2>
        {autoToggle}
        <p className="hint">In a browser each badge opens the print dialog. The desktop app sends badges straight to the Brother printer.</p>
        <div className="row"><button className="btn secondary" onClick={onClose}>Close</button></div>
      </section>
    );
  }

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
      <h2>Badge printer</h2>
      {autoToggle}
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
