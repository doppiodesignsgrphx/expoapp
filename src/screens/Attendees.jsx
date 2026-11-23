import { useCallback, useEffect, useMemo, useState } from 'react';
import { checkinByTicketCode, fullName, getAttendee, isCheckedIn, listAttendees, meta, setCheckin, uniqueId } from '../api.js';
import Scanner from '../components/Scanner.jsx';
import Badge from '../components/Badge.jsx';

const TICKET_CODE = /^(\d+)-(\d+)-(\d+)$/;

export default function Attendees({ event, onBack }) {
  const [attendees, setAttendees] = useState([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [scanning, setScanning] = useState(false);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      setAttendees(await listAttendees(event.id));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }, [event.id]);

  useEffect(() => {
    load();
  }, [load]);

  const replace = (fresh) => {
    setAttendees((list) => (list.some((a) => a.id === fresh.id) ? list.map((a) => (a.id === fresh.id ? fresh : a)) : [fresh, ...list]));
    setSelected(fresh);
  };

  async function refresh(attendeeId) {
    replace(await getAttendee(event.id, attendeeId));
  }

  async function toggle(attendee, checkedIn) {
    setMessage(null);
    try {
      await setCheckin(event.id, attendee.id, checkedIn);
      await refresh(attendee.id);
      setMessage({ ok: true, text: checkedIn ? `${fullName(attendee)} is checked in.` : `Check-in undone for ${fullName(attendee)}.` });
    } catch (err) {
      setMessage({ ok: false, text: err.message });
    }
  }

  const handleScan = useCallback(
    async (text) => {
      setMessage(null);
      const ticket = text.match(TICKET_CODE);
      try {
        if (ticket) {
          // Stock ticket QR: event-order-attendee.
          const [, scannedEvent, , attendeeId] = ticket;
          if (Number(scannedEvent) !== Number(event.id)) {
            setMessage({ ok: false, text: 'That ticket is for a different event than the one selected.' });
            return;
          }
          try {
            await checkinByTicketCode(event.id, attendeeId, text);
            setMessage({ ok: true, text: 'Checked in.' });
          } catch (err) {
            if (err.code !== 418) throw err;
            setMessage({ ok: false, text: 'Already checked in.' });
          }
          await refresh(attendeeId);
          return;
        }

        // Badge code: 16 random characters issued by the site.
        const code = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const match = attendees.find((a) => uniqueId(a) && uniqueId(a) === code);
        if (!match) {
          setMessage({ ok: false, text: 'No attendee on this event matches that code.' });
          return;
        }
        if (isCheckedIn(match)) {
          setSelected(match);
          setMessage({ ok: false, text: `${fullName(match)} is already checked in.` });
          return;
        }
        await setCheckin(event.id, match.id, true);
        await refresh(match.id);
        setMessage({ ok: true, text: `${fullName(match)} is checked in.` });
      } catch (err) {
        setMessage({ ok: false, text: err.message });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attendees, event.id]
  );

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return attendees;
    return attendees.filter((a) => `${fullName(a)} ${meta(a, '_attendee_email')} ${uniqueId(a)}`.toLowerCase().includes(term));
  }, [attendees, filter]);

  const checkedIn = attendees.filter(isCheckedIn).length;

  return (
    <div className="panel">
      <button className="link" onClick={onBack}>Change event</button>
      <h1>{event.name}</h1>
      <p className="hint">{attendees.length} registered, {checkedIn} checked in</p>

      <div className="row">
        <button className="btn" onClick={() => setScanning((s) => !s)}>{scanning ? 'Hide scanner' : 'Scan a badge or ticket'}</button>
        <button className="btn secondary" onClick={load} disabled={busy}>Refresh</button>
      </div>

      {scanning && <Scanner onScan={handleScan} onClose={() => setScanning(false)} />}
      {message && <p className={`notice ${message.ok ? 'ok' : 'error'}`} role="status">{message.text}</p>}
      {error && <p className="notice error">{error}</p>}

      {selected && (
        <section className="detail">
          <h2>{fullName(selected)}</h2>
          <dl>
            <dt>Email</dt><dd>{meta(selected, '_attendee_email')}</dd>
            <dt>Ticket</dt><dd>{meta(selected, '_ticket_name')}</dd>
            <dt>Order</dt><dd>{meta(selected, '_order_id')}</dd>
            <dt>Status</dt><dd>{selected.status}</dd>
            <dt>Check-in</dt><dd>{isCheckedIn(selected) ? `Checked in ${meta(selected, '_checkin_time')}` : 'Not checked in'}</dd>
          </dl>
          <div className="row">
            {isCheckedIn(selected)
              ? <button className="btn secondary" onClick={() => toggle(selected, false)}>Undo check-in</button>
              : <button className="btn" onClick={() => toggle(selected, true)}>Check in</button>}
            <button className="btn secondary" onClick={() => setSelected(null)}>Close</button>
          </div>
          <Badge attendee={selected} event={event} />
        </section>
      )}

      <input placeholder="Find by name, email or badge code" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {busy ? <p>Loading attendees</p> : shown.length === 0 ? <p>No attendees found.</p> : (
        <ul className="list">
          {shown.map((a) => (
            <li key={a.id}>
              <button className="list-item" onClick={() => { setSelected(a); setMessage(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <strong>{fullName(a)}</strong>
                <span>{meta(a, '_attendee_email')}</span>
                <span className={isCheckedIn(a) ? 'tag in' : 'tag'}>{isCheckedIn(a) ? 'Checked in' : 'Not checked in'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
