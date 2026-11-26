import { useEffect, useMemo } from 'react';
import { hasTicket, isCheckedIn, meta, uniqueId } from '../api.js';
import { groupPeople, usePeople } from '../people.js';

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
const MAX_ROWS = 100;

// The Attendees menu: one row per person, across every event they are registered for.
// The top search box narrows the list. Picking a row opens that person's page.
export default function People({ query = '', refreshKey, onOpen, onStats }) {
  const { people, error } = usePeople(refreshKey);
  const persons = useMemo(() => groupPeople(people), [people]);

  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => (!needle ? persons : persons.filter((p) => (
    `${p.name} ${p.email} ${p.regs.map((r) => `${uniqueId(r.attendee)} ${meta(r.attendee, '_attendee_phone')}`).join(' ')}`.toLowerCase().includes(needle)
  ))), [persons, needle]);

  useEffect(() => {
    const checkedIn = persons.filter((p) => p.regs.some((r) => isCheckedIn(r.attendee))).length;
    onStats?.({ label: 'Attendees', registered: persons.length, checkedIn });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persons]);

  return (
    <div className="screen">
      <div className="section-head">
        <h1 className="page-title">Attendees</h1>
        <span className="hint">{needle ? `${shown.length} of ${persons.length}` : `${persons.length} people`}</span>
      </div>
      {error && <p className="notice error">{error}</p>}
      {shown.length === 0 ? <p className="empty">{people ? 'No attendees found.' : 'Loading attendees'}</p> : (
        <ul className="rows">
          {shown.slice(0, MAX_ROWS).map((p, i) => {
            const first = p.regs[0];
            const anyIn = p.regs.some((r) => isCheckedIn(r.attendee));
            const noTicket = p.regs.every((r) => !hasTicket(r.attendee));
            return (
              <li key={p.key}>
                <button className="row-card" onClick={() => onOpen(first.attendee, first.event)}>
                  <span className="row-num">{i + 1}</span>
                  <span className="thumb">{initials(p.name)}</span>
                  <span className="row-main">{p.name}</span>
                  <span className="row-sub">{p.email || first.event.name}</span>
                  <span className="row-end">{noTicket ? 'Needs ticket' : anyIn ? 'Checked in' : `${p.regs.length} registration${p.regs.length === 1 ? '' : 's'}`}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {shown.length > MAX_ROWS && <p className="hint">Showing the first {MAX_ROWS} of {shown.length}. Use the search box to narrow it down.</p>}
    </div>
  );
}
