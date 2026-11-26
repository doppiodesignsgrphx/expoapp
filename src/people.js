// Everyone registered for anything, with the event each registration belongs to.
// Loaded once for every event that has registrations, kept in the cache, and
// shared by search, the Attendees list and the attendee page.
import { useEffect, useState } from 'react';
import { fullName, listAttendees, listEvents, meta } from './api.js';
import { readCache, writeCache } from './cache.js';

export function usePeople(refreshKey) {
  const [people, setPeople] = useState(() => readCache('search:people') || null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const events = await listEvents({ withRegistrations: true });
        const lists = await Promise.all(events.map(async (ev) => {
          const cached = refreshKey ? null : readCache(`attendees:${ev.id}`);
          const all = cached || await listAttendees(ev.id);
          if (!cached) writeCache(`attendees:${ev.id}`, all);
          return all.map((a) => ({ attendee: a, event: ev }));
        }));
        if (!live) return;
        const flat = lists.flat();
        writeCache('search:people', flat);
        setPeople(flat);
      } catch (err) {
        if (live) setError(err.message);
      }
    })();
    return () => { live = false; };
  }, [refreshKey]);

  return { people, error };
}

// The same person can hold several registrations (the Expo plus sessions).
// Email is what ties them together; a registration with no email stands alone.
export const personKey = (a) => String(meta(a, '_attendee_email') || '').trim().toLowerCase() || `id:${a.id}`;

export function groupPeople(people) {
  const map = new Map();
  (people || []).forEach((reg) => {
    const key = personKey(reg.attendee);
    if (!map.has(key)) map.set(key, { key, name: fullName(reg.attendee), email: meta(reg.attendee, '_attendee_email'), regs: [] });
    map.get(key).regs.push(reg);
  });
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}
