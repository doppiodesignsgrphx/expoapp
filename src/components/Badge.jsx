import { useEffect, useRef, useState } from 'react';
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

// autoPrint is a token that changes each time a scan asks for a badge. Each token prints once.
export default function Badge({ attendee, event, autoPrint = null }) {
  const code = badgeCode(event.id, attendee);
  const desktop = useDesktop();
  const [made, setMade] = useState({ code: '', url: '' });
  const [busy, setBusy] = useState(false);
  const printed = useRef(null);
  // Only use the QR image once it matches this attendee's code.
  const qr = made.code === code ? made.url : '';
  const [result, setResult] = useState(null);

  useEffect(() => {
    let live = true;
    setResult(null);
    QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 0, width: 600 }).then((url) => live && setMade({ code, url }));
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

  useEffect(() => {
    if (!autoPrint || !qr || printed.current === autoPrint) return;
    printed.current = autoPrint;
    print();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPrint, qr]);

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
