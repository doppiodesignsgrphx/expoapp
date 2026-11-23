import { useEffect, useRef, useState } from 'react';
import { listEvents } from '../api.js';
import { readCache, writeCache } from '../cache.js';

export default function Events({ onPick, refreshKey, onBusy }) {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const key = `events:${term || '*'}`;
  const [events, setEvents] = useState(() => readCache(key) || []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);

  useEffect(() => {
    const run = ++latest.current;
    const cachedList = readCache(key);
    setEvents(cachedList || []);
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

  return (
    <div className="panel">
      <h1>Choose an event</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); setTerm(search.trim()); }}>
        <input placeholder="Search events and sessions" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn">Search</button>
        {term && <button type="button" className="btn secondary" onClick={() => { setSearch(''); setTerm(''); }}>Clear</button>}
      </form>
      {!term && <p className="hint">Showing events that have registrations. Search to find any other event or session.</p>}
      {error && <p className="notice error">{error}</p>}
      {events.length === 0 ? <p>{busy ? 'Loading' : 'No events found.'}</p> : (
        <ul className="list">
          {events.map((ev) => (
            <li key={ev.id}>
              <button className="list-item" onClick={() => onPick(ev)}>
                <strong>{ev.name}</strong>
                <span>
                  {ev.meta_data?._event_start_date} {ev.meta_data?._event_start_time}
                  {ev.meta_data?._event_location ? ` · ${ev.meta_data._event_location}` : ''}
                </span>
                <span>{ev.registrations?.total_registrations ?? 0} registered, {ev.registrations?.total_checkin ?? 0} checked in</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
