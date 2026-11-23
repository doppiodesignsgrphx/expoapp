import { useEffect, useState } from 'react';
import { listEvents } from '../api.js';

export default function Events({ onPick }) {
  const [events, setEvents] = useState([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');

  async function load(term) {
    setBusy(true);
    setError('');
    try {
      setEvents(await listEvents(term ? { search: term } : { withRegistrations: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load('');
  }, []);

  return (
    <div className="panel">
      <h1>Choose an event</h1>
      <form className="row" onSubmit={(e) => { e.preventDefault(); load(search.trim()); }}>
        <input placeholder="Search events and sessions" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button className="btn">Search</button>
      </form>
      {!search && <p className="hint">Showing events that have registrations. Search to find any other event or session.</p>}
      {error && <p className="notice error">{error}</p>}
      {busy ? <p>Loading</p> : events.length === 0 ? <p>No events found.</p> : (
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
