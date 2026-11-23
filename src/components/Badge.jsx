import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import { badgeCode, fullName, meta } from '../api.js';

// The badge is drawn twice: once on screen as a preview, and once into
// #print-root, which is the only thing visible when the page prints.
// Sized for Brother DK continuous 62mm tape (see @page in styles.css).
function BadgeFace({ attendee, event, qr, code }) {
  return (
    <div className="badge">
      <div className="badge-event">{event?.name}</div>
      <div className="badge-first">{meta(attendee, '_attendee_name') || attendee?.name}</div>
      <div className="badge-last">{meta(attendee, '_attendee_last_name')}</div>
      <div className="badge-ticket">{meta(attendee, '_ticket_name')}</div>
      {qr && <img className="badge-qr" src={qr} alt="" />}
      <div className="badge-code">{code}</div>
    </div>
  );
}

export default function Badge({ attendee, event }) {
  const code = badgeCode(event.id, attendee);
  const [qr, setQr] = useState('');

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(code, { errorCorrectionLevel: 'M', margin: 0, width: 600 }).then((url) => live && setQr(url));
    return () => {
      live = false;
    };
  }, [code]);

  return (
    <div className="badge-wrap">
      <BadgeFace attendee={attendee} event={event} qr={qr} code={code} />
      <button className="btn" disabled={!qr} onClick={() => window.print()}>
        Print badge
      </button>
      <p className="hint">Printing {fullName(attendee)}. In the print dialog choose the Brother printer and the 62mm roll, with margins set to none.</p>
      {createPortal(<BadgeFace attendee={attendee} event={event} qr={qr} code={code} />, document.getElementById('print-root'))}
    </div>
  );
}
