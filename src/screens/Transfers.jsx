import { useMemo, useState } from 'react';
import { fullName, meta, transferTicket } from '../api.js';
import { clearCache } from '../cache.js';
import { usePeople } from '../people.js';

// Move a ticket from one person to another.
//   1. find the ticket (a registration) by its current holder
//   2. choose the new holder: someone already registered, or a new person
//   3. confirm
// The registration keeps its ticket and order. The person on it changes, any
// check-in is cleared, and the old badge code stops working.

const blank = () => ({ first_name: '', last_name: '', email: '', phone: '' });
const personOf = (a) => ({
  first_name: meta(a, '_attendee_name') || '',
  last_name: meta(a, '_attendee_last_name') || '',
  email: meta(a, '_attendee_email') || '',
  phone: meta(a, '_attendee_phone') || '',
});
const matches = (rows, text) => {
  const needle = text.trim().toLowerCase();
  if (needle.length < 2) return [];
  return rows.filter(({ attendee: a, event: ev }) => `${fullName(a)} ${meta(a, '_attendee_email')} ${ev.name}`.toLowerCase().includes(needle)).slice(0, 8);
};

export default function Transfers({ refreshKey }) {
  // Counting completed transfers makes the list read fresh from the site afterwards.
  const [round, setRound] = useState(0);
  const loaded = usePeople((refreshKey || 0) + round);
  const people = loaded.people || [];
  const [find, setFind] = useState('');
  const [from, setFrom] = useState(null); // { attendee, event }
  const [mode, setMode] = useState('new'); // new | registered
  const [findTo, setFindTo] = useState('');
  const [to, setTo] = useState(blank);
  const [sendText, setSendText] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(null);

  const fromRows = useMemo(() => matches(people, find), [people, find]);
  const toRows = useMemo(() => matches(people, findTo).filter((p) => !from || p.attendee.id !== from.attendee.id), [people, findTo, from]);
  const ready = from && to.first_name && to.last_name && to.email;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await transferTicket({ registration_id: from.attendee.id, to, send_text: sendText });
      clearCache();
      setRound((n) => n + 1);
      setDone(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setDone(null);
    setFrom(null);
    setFind('');
    setFindTo('');
    setTo(blank());
    setMode('new');
    setError('');
  }

  if (done) {
    return (
      <div className="screen">
        <h1 className="page-title">Transfer complete</h1>
        <section className="panel wide">
          <p>The ticket moved from <strong>{done.from}</strong> to <strong>{done.to}</strong>.</p>
          <dl>
            <dt>New badge code</dt><dd>{done.badge_code || 'Unchanged'}</dd>
            <dt>Text to new holder</dt><dd>{done.text_sent ? 'Sent' : 'Not sent'}</dd>
          </dl>
          <p className="hint">The previous badge and check-in no longer count. Print a new badge from Check-in or the attendee page.</p>
          <div className="row"><button className="btn" onClick={reset}>Another transfer</button></div>
        </section>
      </div>
    );
  }

  return (
    <form className="screen" onSubmit={submit}>
      <h1 className="page-title">Transfers</h1>
      {(error || loaded.error) && <p className="notice error" role="status">{error || loaded.error}</p>}

      <section className="panel wide">
        <h2 className="section-title">1. Ticket to transfer</h2>
        {from ? (
          <div className="picked">
            <span><strong>{fullName(from.attendee)}</strong>{meta(from.attendee, '_attendee_email')} · {from.event.name} · {meta(from.attendee, '_ticket_name') || 'Ticket'}</span>
            <button type="button" className="link" onClick={() => setFrom(null)}>Change</button>
          </div>
        ) : (
          <>
            <label>Current ticket holder<input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Name or email" /></label>
            <ul className="pick-list">
              {fromRows.map((p) => (
                <li key={`${p.event.id}-${p.attendee.id}`}>
                  <button type="button" onClick={() => setFrom(p)}><strong>{fullName(p.attendee)}</strong><span>{meta(p.attendee, '_attendee_email')} · {p.event.name}</span></button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="panel wide">
        <h2 className="section-title">2. New ticket holder</h2>
        <div className="choices">
          <label className={`choice${mode === 'new' ? ' on' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'new'} onChange={() => setMode('new')} />
            <span><strong>New person</strong>Someone who is not registered yet.</span>
          </label>
          <label className={`choice${mode === 'registered' ? ' on' : ''}`}>
            <input type="radio" name="mode" checked={mode === 'registered'} onChange={() => setMode('registered')} />
            <span><strong>Registered attendee</strong>Copy the details of someone already in the system.</span>
          </label>
        </div>
        {mode === 'registered' && (
          <>
            <label>Find the attendee<input value={findTo} onChange={(e) => setFindTo(e.target.value)} placeholder="Name or email" /></label>
            <ul className="pick-list">
              {toRows.map((p) => (
                <li key={`${p.event.id}-${p.attendee.id}`}>
                  <button type="button" onClick={() => { setTo(personOf(p.attendee)); setFindTo(''); }}><strong>{fullName(p.attendee)}</strong><span>{meta(p.attendee, '_attendee_email')} · {p.event.name}</span></button>
                </li>
              ))}
            </ul>
          </>
        )}
        <div className="form-grid">
          <label>First name<input value={to.first_name} onChange={(e) => setTo({ ...to, first_name: e.target.value })} required /></label>
          <label>Last name<input value={to.last_name} onChange={(e) => setTo({ ...to, last_name: e.target.value })} required /></label>
          <label>Email<input type="email" value={to.email} onChange={(e) => setTo({ ...to, email: e.target.value })} required /></label>
          <label>Mobile phone<input type="tel" value={to.phone} onChange={(e) => setTo({ ...to, phone: e.target.value })} /></label>
        </div>
        <label className="check">
          <input type="checkbox" checked={sendText} onChange={(e) => setSendText(e.target.checked)} />
          <span>Text the new holder that the ticket is theirs</span>
        </label>
      </section>

      {from && (
        <p className="notice warn" role="status">
          This moves the ticket from {fullName(from.attendee)} to {to.first_name || 'the new holder'} {to.last_name}. {fullName(from.attendee)}'s badge and check-in will stop counting.
        </p>
      )}
      <div className="row">
        <button className="btn" disabled={!ready || busy}>{busy ? 'Transferring' : 'Transfer ticket'}</button>
      </div>
    </form>
  );
}
