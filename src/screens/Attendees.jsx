import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkinByTicketCode, fullName, getAttendee, isCheckedIn, listAttendees, meta, setCheckin, uniqueId, withCheckin } from '../api.js';
import { readCache, writeCache } from '../cache.js';
import Scanner from '../components/Scanner.jsx';
import Badge from '../components/Badge.jsx';
import { primeFeedback, signal } from '../feedback.js';
import { useWedgeScanner } from '../wedge.js';

const TICKET_CODE = /^(\d+)-(\d+)-(\d+)$/;

export default function Attendees({ event, refreshKey, onBusy, registerBack }) {
  const key = `attendees:${event.id}`;
  const [attendees, setAttendees] = useState(() => readCache(key) || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [scanning, setScanning] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [message, setMessage] = useState(null);
  const latest = useRef(0);
  const list = useRef(attendees);

  // Every change to the list goes through here so the cache stays in step.
  const update = useCallback(
    (next) => {
      list.current = typeof next === 'function' ? next(list.current) : next;
      writeCache(key, list.current);
      setAttendees(list.current);
    },
    [key]
  );

  const put = useCallback(
    (fresh) => update((all) => (all.some((a) => a.id === fresh.id) ? all.map((a) => (a.id === fresh.id ? fresh : a)) : [fresh, ...all])),
    [update]
  );

  useEffect(() => {
    const run = ++latest.current;
    setBusy(true);
    onBusy?.(true);
    setError('');
    listAttendees(event.id)
      .then((all) => run === latest.current && update(all))
      .catch((err) => run === latest.current && setError(err.message))
      .finally(() => {
        if (run !== latest.current) return;
        setBusy(false);
        onBusy?.(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, refreshKey]);

  // Back closes an open attendee first, then leaves the event.
  useEffect(() => {
    registerBack?.(() => {
      if (selectedId === null) return false;
      setSelectedId(null);
      setMessage(null);
      return true;
    });
    return () => registerBack?.(null);
  }, [registerBack, selectedId]);

  const selected = useMemo(() => attendees.find((a) => a.id === selectedId) || null, [attendees, selectedId]);

  // Show the change at once, then confirm with the server. Undo it if the server refuses.
  async function toggle(attendee, checkedIn) {
    setMessage({ ok: true, text: checkedIn ? `${fullName(attendee)} is checked in.` : `Check-in undone for ${fullName(attendee)}.` });
    put(withCheckin(attendee, checkedIn));
    try {
      await setCheckin(event.id, attendee.id, checkedIn);
    } catch (err) {
      put(attendee);
      setMessage({ ok: false, text: err.message });
    }
  }

  const handleScan = useCallback(
    async (text) => {
      // Every scan result goes through here so it is seen, heard and felt.
      const report = (ok, msg) => {
        setMessage({ ok, text: msg });
        signal(ok);
      };
      setMessage(null);
      const ticket = text.match(TICKET_CODE);
      try {
        if (ticket) {
          // Stock ticket QR: event-order-attendee.
          const [, scannedEvent, , rawId] = ticket;
          const attendeeId = Number(rawId);
          if (Number(scannedEvent) !== Number(event.id)) {
            report(false, 'That ticket is for a different event than the one selected.');
            return;
          }
          let already = false;
          try {
            await checkinByTicketCode(event.id, attendeeId, text);
          } catch (err) {
            if (err.code !== 418) throw err;
            already = true;
          }
          const known = list.current.find((a) => Number(a.id) === attendeeId);
          const record = known || (await getAttendee(event.id, attendeeId));
          put(already && isCheckedIn(record) ? record : withCheckin(record, true));
          setSelectedId(record.id);
          report(!already, already ? `${fullName(record)} is already checked in.` : `${fullName(record)} is checked in.`);
          return;
        }

        // Badge code: 16 random characters issued by the site.
        const code = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        const match = list.current.find((a) => uniqueId(a) && uniqueId(a) === code);
        if (!match) {
          report(false, 'No attendee on this event matches that code.');
          return;
        }
        setSelectedId(match.id);
        if (isCheckedIn(match)) {
          report(false, `${fullName(match)} is already checked in.`);
          return;
        }
        report(true, `${fullName(match)} is checked in.`);
        put(withCheckin(match, true));
        try {
          await setCheckin(event.id, match.id, true);
        } catch (err) {
          put(match);
          throw err;
        }
      } catch (err) {
        report(false, err.message);
      }
    },
    [event.id, put]
  );

  // Handheld scanners type the code and press Enter. If the cursor was in the
  // search box, remove what the scanner typed there.
  useWedgeScanner(
    useCallback(
      (text) => {
        setFilter((current) => (current.endsWith(text) ? current.slice(0, -text.length) : current));
        handleScan(text.trim());
      },
      [handleScan]
    )
  );

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return attendees;
    return attendees.filter((a) => `${fullName(a)} ${meta(a, '_attendee_email')} ${uniqueId(a)}`.toLowerCase().includes(term));
  }, [attendees, filter]);

  const checkedIn = attendees.filter(isCheckedIn).length;

  return (
    <div className="panel">
      <h1>{event.name}</h1>
      <p className="hint">{attendees.length} registered, {checkedIn} checked in{busy && attendees.length > 0 ? ' · updating' : ''}</p>

      <div className="row">
        <button className="btn" onClick={() => { primeFeedback(); setScanning((s) => !s); }}>{scanning ? 'Hide scanner' : 'Scan a badge or ticket'}</button>
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
            <button className="btn secondary" onClick={() => { setSelectedId(null); setMessage(null); }}>Close</button>
          </div>
          <Badge attendee={selected} event={event} />
        </section>
      )}

      <input placeholder="Find by name, email or badge code" value={filter} onChange={(e) => setFilter(e.target.value)} />
      {shown.length === 0 ? <p>{busy ? 'Loading attendees' : 'No attendees found.'}</p> : (
        <ul className="list">
          {shown.map((a) => (
            <li key={a.id}>
              <button className="list-item" onClick={() => { setSelectedId(a.id); setMessage(null); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
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
