import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { badgeCode, fullName, meta } from '../api.js';
import { desktopApi, useDesktop } from '../desktop.js';
import { renderBadgePng } from '../badgeImage.js';

// The badge is drawn on screen as a preview and into #print-root, which is the
// only thing visible when the page prints through the browser dialog.
// In the desktop app, Print sends an image straight to the printer instead.
function BadgeFace({ attendee, event, qr, code }) {
  return (
    <div className="badge">
      <div className="badge-band">{event?.name}</div>
      <div className="badge-body">
        <div className="badge-first">{meta(attendee, '_attendee_name') || attendee?.name}</div>
        <div className="badge-last">{meta(attendee, '_attendee_last_name')}</div>
        <div className="badge-ticket">{meta(attendee, '_ticket_name')}</div>
        <div className="badge-rule" />
        {qr && <img className="badge-qr" src={qr} alt="" />}
        <div className="badge-code">{code}</div>
      </div>
    </div>
  );
}

export default function Badge({ attendee, event }) {
  const code = badgeCode(event.id, attendee);
  const desktop = useDesktop();
  const [qr, setQr] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    setResult(null);
    QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 0, width: 600 }).then((url) => live && setQr(url));
    return () => {
      live = false;
    };
  }, [code]);

  async function print() {
    if (!desktop) {
      setResult({ ok: true, message: `Printing ${fullName(attendee)}. In the print dialog choose the Brother printer and the 62mm roll, with margins set to none.` });
      window.print();
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const png = await renderBadgePng({
        eventName: event?.name,
        first: meta(attendee, '_attendee_name') || attendee?.name,
        last: meta(attendee, '_attendee_last_name'),
        ticket: meta(attendee, '_ticket_name'),
        code,
        qrUrl: qr,
      });
      const reply = await desktopApi().print_badge(png);
      setResult(reply.ok ? { ok: true, message: `Sent ${fullName(attendee)} straight to the badge printer.` } : reply);
    } catch (err) {
      setResult({ ok: false, message: err.message || 'Printing failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="badge-wrap">
      <BadgeFace attendee={attendee} event={event} qr={qr} code={code} />
      <button className="btn" disabled={!qr || busy} onClick={print}>
        {busy ? 'Printing' : 'Print badge'}
      </button>
      {result && !result.ok && <p className="notice error" role="status">{result.message}</p>}
      {result && result.ok && <p className="hint" role="status">{result.message}</p>}
      {createPortal(<BadgeFace attendee={attendee} event={event} qr={qr} code={code} />, document.getElementById('print-root'))}
    </div>
  );
}
