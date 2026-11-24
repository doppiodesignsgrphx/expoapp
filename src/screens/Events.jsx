import { useEffect, useRef, useState } from 'react';
import { listEvents } from '../api.js';
import { readCache, writeCache } from '../cache.js';

const imageOf = (ev) => (Array.isArray(ev.images) ? ev.images[0] : ev.images) || '';

// The home screen: events shown as cards. Typing in the top bar search looks
// up any event or session by name.
export default function Events({ onPick, refreshKey, onBusy, query = '', onStats }) {
  const [term, setTerm] = useState('');
  const key = `events:${term || '*'}`;
  const [events, setEvents] = useState(() => readCache(key) || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);

  // Wait for a pause in typing before asking the site.
  useEffect(() => {
    const t = setTimeout(() => setTerm((query || '').trim()), 400);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const run = ++latest.current;
    setEvents(readCache(key) || []);
    setBusy(true);
    onBusy?.(true);
    setError('');
    listEvents(term ? { search: term } : { withRegistrations: true })
      .then((list) => {
        if (run !== latest.current) return;
        writeCache(key, list);
        setEvents(list);
      })
      .catch((err) => run === latest.current && setError(err.message))
      .finally(() => {
        if (run !== latest.current) return;
        setBusy(false);
        onBusy?.(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey]);

  useEffect(() => {
    const registered = events.reduce((n, ev) => n + Number(ev.registrations?.total_registrations || 0), 0);
    const checkedIn = events.reduce((n, ev) => n + Number(ev.registrations?.total_checkin || 0), 0);
    onStats?.({ label: term ? 'Search results' : 'All events', registered, checkedIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, term]);

  return (
    <div className="screen">
      <div className="section-head">
        <h1 className="page-title">Events</h1>
        <span className="hint">{busy && events.length > 0 ? 'Updating' : `${events.length} shown`}</span>
      </div>
      {!term && <p className="hint">Events with registrations. Use the search above to find any other event or session.</p>}
      {error && <p className="notice error">{error}</p>}
      {events.length === 0 ? <p className="empty">{busy ? 'Loading events' : 'No events found.'}</p> : (
        <ul className="cards">
          {events.map((ev) => (
            <li key={ev.id}>
              <button className="card" onClick={() => onPick(ev)}>
                <span className="card-art" style={imageOf(ev) ? { backgroundImage: `url("${imageOf(ev)}")` } : undefined} />
                <span className="card-caption">
                  <strong>{ev.name}</strong>
                  <span>
                    {ev.meta_data?._event_start_date} {ev.meta_data?._event_start_time}
                    {ev.meta_data?._event_location ? ` · ${ev.meta_data._event_location}` : ''}
                  </span>
                </span>
                <span className="card-meta">
                  {ev.registrations?.total_registrations ?? 0} registered, {ev.registrations?.total_checkin ?? 0} checked in
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
