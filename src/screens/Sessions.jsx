import { useEffect, useMemo, useRef, useState } from 'react';
import { eventTypes, listEvents } from '../api.js';
import { readCache, writeCache } from '../cache.js';

const imageOf = (ev) => (Array.isArray(ev.images) ? ev.images[0] : ev.images) || '';

// The Sessions menu: every published event on the site, each tagged with its
// session type. Picking one opens the same check-in and scanning screen the Expo uses.
export default function Sessions({ query = '', refreshKey, onBusy, onPick, onStats }) {
  const [events, setEvents] = useState(() => readCache('sessions:all') || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);

  useEffect(() => {
    const run = ++latest.current;
    setBusy(true);
    onBusy?.(true);
    setError('');
    listEvents()
      .then((list) => {
        if (run !== latest.current) return;
        writeCache('sessions:all', list);
        setEvents(list);
      })
      .catch((err) => run === latest.current && setError(err.message))
      .finally(() => {
        if (run !== latest.current) return;
        setBusy(false);
        onBusy?.(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => (!needle ? events : events.filter((ev) => (
    `${ev.name} ${ev.meta_data?._event_location || ''} ${eventTypes(ev).join(' ')}`.toLowerCase().includes(needle)
  ))), [events, needle]);

  useEffect(() => {
    const registered = events.reduce((n, ev) => n + Number(ev.registrations?.total_registrations || 0), 0);
    const checkedIn = events.reduce((n, ev) => n + Number(ev.registrations?.total_checkin || 0), 0);
    onStats?.({ label: 'Sessions', registered, checkedIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  return (
    <div className="screen">
      <div className="section-head">
        <h1 className="page-title">Sessions</h1>
        <span className="hint">{busy && events.length > 0 ? 'Updating' : needle ? `${shown.length} of ${events.length}` : `${events.length} sessions`}</span>
      </div>
      <p className="hint">Pick a session to check attendees in or scan badges at the door.</p>
      {error && <p className="notice error">{error}</p>}
      {shown.length === 0 ? <p className="empty">{busy ? 'Loading sessions' : 'No sessions found.'}</p> : (
        <ul className="rows">
          {shown.map((ev) => (
            <li key={ev.id}>
              <button className="row-card session" onClick={() => onPick(ev)}>
                <span className="thumb" style={imageOf(ev) ? { backgroundImage: `url("${imageOf(ev)}")` } : undefined} />
                <span className="row-main">
                  {ev.name}
                  {eventTypes(ev).map((t) => <span key={t} className="type-tag">{t}</span>)}
                </span>
                <span className="row-sub">
                  {ev.meta_data?._event_start_date} {ev.meta_data?._event_start_time}
                  {ev.meta_data?._event_location ? ` · ${ev.meta_data._event_location}` : ''}
                </span>
                <span className="row-end">{ev.registrations?.total_checkin ?? 0} of {ev.registrations?.total_registrations ?? 0} in</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
