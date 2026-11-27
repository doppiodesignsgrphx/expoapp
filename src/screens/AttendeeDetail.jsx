import { useEffect, useMemo, useRef, useState } from 'react';
import { eventTypes, fullName, isCheckedIn, meta, setCheckin, ticketCode, uniqueId, withCheckin } from '../api.js';
import { readCache, writeCache } from '../cache.js';
import { personKey, usePeople } from '../people.js';
import Badge from '../components/Badge.jsx';
import StatusTag, { useOrder } from '../components/StatusTag.jsx';

// Fields with their own place on the page. Everything else a registration
// carries is listed under More details, so new fields show up without code changes.
const KNOWN = new Set([
  '_attendee_name', '_attendee_last_name', '_attendee_email', '_attendee_phone', '_attendee_unique_id', '_ticket_name', '_ticket_id',
  '_ticket_type', '_order_id', '_check_in', '_checkin_time', '_checkin_source', '_total_ticket', '_total_ticket_price', '_registration_type',
  '_event_id', '_attendee_user_id', '_registration_email_sent', '_checkin_device_id', '_oems_badge_code',
]);
const labelOf = (key) => key.replace(/^_+/, '').replace(/^attendee_/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
const show = (v) => (Array.isArray(v) ? v.join(', ') : String(v ?? ''));

// One attendee's own page: who they are, their ticket and payment, their badge,
// and every session they are registered for or have attended.
export default function AttendeeDetail({ attendee, event, refreshKey, onOpenEvent }) {
  const { people } = usePeople(refreshKey);
  const [focus, setFocus] = useState(attendee);
  const [overrides, setOverrides] = useState({});
  const [badge, setBadge] = useState({ ready: false, busy: false });
  const [message, setMessage] = useState(null);
  const badgeRef = useRef(null);
  const order = useOrder(event.id, focus);

  useEffect(() => setFocus(attendee), [attendee]);

  // Every registration this person holds, the one that was opened first.
  const regs = useMemo(() => {
    const key = personKey(attendee);
    const mine = (people || []).filter((r) => personKey(r.attendee) === key && !(r.event.id === event.id && r.attendee.id === attendee.id));
    return [{ attendee: focus, event }, ...mine].map((r) => ({ ...r, attendee: overrides[`${r.event.id}:${r.attendee.id}`] || r.attendee }));
  }, [people, attendee, event, focus, overrides]);
  const attended = regs.filter((r) => isCheckedIn(r.attendee));

  // Show the change at once, then confirm with the site. Undo it if the site refuses.
  async function toggle(reg, checkedIn) {
    const before = reg.attendee;
    const after = withCheckin(before, checkedIn);
    const apply = (value) => {
      setOverrides((o) => ({ ...o, [`${reg.event.id}:${before.id}`]: value }));
      if (reg.event.id === event.id && before.id === focus.id) setFocus(value);
      const list = readCache(`attendees:${reg.event.id}`);
      if (list) writeCache(`attendees:${reg.event.id}`, list.map((a) => (a.id === before.id ? value : a)));
    };
    apply(after);
    setMessage({ ok: true, text: checkedIn ? `Checked in to ${reg.event.name}.` : `Check-in undone for ${reg.event.name}.` });
    try {
      await setCheckin(reg.event.id, before.id, checkedIn);
    } catch (err) {
      apply(before);
      setMessage({ ok: false, text: err.message });
    }
  }

  const extra = Object.entries(focus.meta_data || {}).filter(([k, v]) => !KNOWN.has(k) && show(v).trim() !== '');
  const main = regs[0];

  return (
    <div className="screen">
      <div className="section-head">
        <h1 className="page-title">{fullName(focus)}</h1>
        <StatusTag attendee={focus} order={order} />
      </div>
      {message && <p className={`notice ${message.ok ? 'ok' : 'error'}`} role="status">{message.text}</p>}

      <section className="detail">
        <div className="detail-info">
          <h3>Details</h3>
          <dl>
            <dt>Email</dt><dd>{meta(focus, '_attendee_email')}</dd>
            <dt>Phone</dt><dd>{meta(focus, '_attendee_phone')}</dd>
            <dt>Event</dt><dd>{event.name}</dd>
            <dt>Ticket</dt><dd>{meta(focus, '_ticket_name')}</dd>
            <dt>Order</dt><dd>{meta(focus, '_order_id')}</dd>
            <dt>Payment</dt><dd>{order ? `${order.payment_method_title || order.payment_method || 'Unknown'}, ${order.status}` : ''}</dd>
            <dt>Badge code</dt><dd>{uniqueId(focus) || ticketCode(event.id, focus)}</dd>
            <dt>Check-in</dt><dd>{isCheckedIn(focus) ? `Checked in ${meta(focus, '_checkin_time')}` : 'Not checked in'}</dd>
          </dl>
          <div className="row bottom">
            {isCheckedIn(focus)
              ? <button className="btn secondary" onClick={() => toggle(main, false)}>Undo check-in</button>
              : <button className="btn" onClick={() => toggle(main, true)}>Check in</button>}
            <button className="btn secondary" disabled={!badge.ready || badge.busy} onClick={() => badgeRef.current?.print()}>{badge.busy ? 'Printing' : 'Print badge'}</button>
            <button className="btn secondary" onClick={() => onOpenEvent(event, focus.id)}>Open in check-in</button>
          </div>
        </div>
        <div className="detail-badge">
          <Badge ref={badgeRef} onState={setBadge} attendee={focus} event={event} />
        </div>
      </section>

      <div className="preview-grid stacked">
        <section className="session-box">
          <h4>Registered sessions <span>{regs.length}</span></h4>
          <ul>
            {regs.map((r) => (
              <li key={`${r.event.id}:${r.attendee.id}`} className="reg-row">
                <span>
                  {r.event.name}
                  {eventTypes(r.event).map((t) => <span key={t} className="type-tag">{t}</span>)}
                </span>
                {isCheckedIn(r.attendee)
                  ? <button className="link" onClick={() => toggle(r, false)}>Undo check-in</button>
                  : <button className="link" onClick={() => toggle(r, true)}>Check in</button>}
              </li>
            ))}
          </ul>
        </section>
        <section className="session-box">
          <h4>Sessions attended <span>{attended.length}</span></h4>
          {attended.length === 0 ? <p className="hint">None yet. A session counts once the badge is scanned or the attendee is checked in.</p> : (
            <ul>{attended.map((r) => <li key={`${r.event.id}:${r.attendee.id}`}>{r.event.name}<span className="hint"> {meta(r.attendee, '_checkin_time')}</span></li>)}</ul>
          )}
        </section>
        <section className="session-box">
          <h4>More details <span>{extra.length}</span></h4>
          {extra.length === 0 ? <p className="hint">Other registration fields appear here as they are added to the form.</p> : (
            <dl>{extra.map(([k, v]) => [<dt key={`${k}-t`}>{labelOf(k)}</dt>, <dd key={`${k}-d`}>{show(v)}</dd>])}</dl>
          )}
        </section>
        <section className="session-box">
          <h4>Attendee log</h4>
          <p className="hint">The history for this account will appear here once the log is built on the site.</p>
        </section>
      </div>
    </div>
  );
}
