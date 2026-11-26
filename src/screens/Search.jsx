import { useEffect, useRef, useState } from 'react';
import { fullName, hasTicket, isCheckedIn, listEvents, meta, uniqueId } from '../api.js';
import { usePeople } from '../people.js';

const imageOf = (ev) => (Array.isArray(ev.images) ? ev.images[0] : ev.images) || '';
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const MAX_ROWS = 25;

// One search across everything staff can look up: attendees and sessions.
// Sessions are searched on the site. Attendees are loaded once for every event
// that has registrations, kept in the cache, and filtered here.
export default function Search({ query, refreshKey, onBusy, onPickEvent, onPickAttendee }) {
  const [term, setTerm] = useState('');
  const [sessions, setSessions] = useState([]);
  const { people, error: peopleError } = usePeople(refreshKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setTerm(query.trim()), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!term) return undefined;
    const run = ++latest.current;
    setBusy(true);
    onBusy?.(true);
    setError('');
    listEvents({ search: term })
      .then((list) => run === latest.current && setSessions(list))
      .catch((err) => run === latest.current && setError(err.message))
      .finally(() => {
        if (run !== latest.current) return;
        setBusy(false);
        onBusy?.(false);
      });
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, refreshKey]);

  const needle = term.toLowerCase();
  const matches = !needle || !people ? [] : people.filter(({ attendee: a }) => `${fullName(a)} ${meta(a, '_attendee_email')} ${uniqueId(a)}`.toLowerCase().includes(needle));

  return (
    <div className="screen">
      <h1 className="page-title">Search results for &ldquo;{query.trim()}&rdquo;</h1>
      {(error || peopleError) && <p className="notice error">{error || peopleError}</p>}

      <h2 className="section-title">Attendees</h2>
      {matches.length === 0 ? <p className="empty">{people ? 'No attendees found.' : 'Loading attendees'}</p> : (
        <ul className="rows">
          {matches.slice(0, MAX_ROWS).map(({ attendee: a, event: ev }, i) => (
            <li key={`${ev.id}-${a.id}`}>
              <button className="row-card" onClick={() => onPickAttendee(ev, a.id)}>
                <span className="row-num">{i + 1}</span>
                <span className="thumb">{initials(fullName(a))}</span>
                <span className="row-main">{fullName(a)}</span>
                <span className="row-sub">{meta(a, '_attendee_email') || ev.name}</span>
                <span className="row-end">{!hasTicket(a) ? 'Needs ticket' : isCheckedIn(a) ? 'Checked in' : 'Not checked in'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {matches.length > MAX_ROWS && <p className="hint">Showing the first {MAX_ROWS} of {matches.length}. Keep typing to narrow it down.</p>}

      <h2 className="section-title">Sessions</h2>
      {sessions.length === 0 ? <p className="empty">{busy || term !== query.trim() ? 'Searching sessions' : 'No sessions found.'}</p> : (
        <ul className="rows">
          {sessions.slice(0, MAX_ROWS).map((ev, i) => (
            <li key={ev.id}>
              <button className="row-card" onClick={() => onPickEvent(ev)}>
                <span className="row-num">{i + 1}</span>
                <span className="thumb" style={imageOf(ev) ? { backgroundImage: `url("${imageOf(ev)}")` } : undefined} />
                <span className="row-main">{ev.name}</span>
                <span className="row-sub">{ev.meta_data?._event_location || ''}</span>
                <span className="row-end">{ev.meta_data?._event_start_date || ''}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
