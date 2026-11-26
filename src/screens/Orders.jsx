import { useEffect, useMemo, useState } from 'react';
import { addOrderNote, cancelOrder, listAttendees, listOrders, markOrderPaid, orderState, readOrder, textOrderAgain } from '../api.js';
import { clearCache, readCache, writeCache } from '../cache.js';

// Order management for the Expo's ticket orders.
//   The list: every order holding an Expo ticket, searched from the top bar and
//   filtered by state.
//   The order page: buyer, tickets, payment, attendees and notes, with the
//   actions staff can take: mark paid (cash or check), text the customer their
//   link again, add a note, cancel an unpaid order.
// Refunds are not done here. They move money and stay on the site for now.

const MAX_ROWS = 200;
const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Outstanding balance' },
  { id: 'waiting', label: 'Waiting for payment' },
  { id: 'paid', label: 'Paid' },
  { id: 'closed', label: 'Cancelled' },
];
const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const buyerName = (o) => `${o.buyer?.first_name || ''} ${o.buyer?.last_name || ''}`.trim() || 'No name';
const day = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '';
};
const dayTime = (iso) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
};
const digits = (s) => String(s || '').replace(/\D+/g, '');

function State({ order }) {
  const s = orderState(order);
  return <span className={`status ${s.tone}`}>{s.label}</span>;
}

export default function Orders({ event, query = '', refreshKey, onBusy, registerBack, onOpenProfile }) {
  const key = `orders:${event.id}`;
  const [orders, setOrders] = useState(() => readCache(key));
  const [filter, setFilter] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const [round, setRound] = useState(0);

  useEffect(() => {
    let live = true;
    onBusy?.(true);
    listOrders(event.id)
      .then((list) => {
        if (!live) return;
        writeCache(key, list);
        setOrders(list);
        setError('');
      })
      .catch((err) => live && setError(err.message))
      .finally(() => live && onBusy?.(false));
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, refreshKey, round]);

  useEffect(() => {
    if (openId === null) return undefined;
    let live = true;
    setDetail(null);
    readOrder(openId)
      .then((o) => live && setDetail(o))
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [openId, refreshKey]);

  // Back closes an open order first.
  useEffect(() => {
    registerBack?.(() => {
      if (openId === null) return false;
      close();
      return true;
    });
    return () => registerBack?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registerBack, openId]);

  function open(id) {
    setOpenId(id);
    setError('');
    setNote('');
    setDraft('');
    setCancelling(false);
    setReason('');
  }
  function close() {
    setOpenId(null);
    setDetail(null);
    setError('');
    setNote('');
  }

  const counts = useMemo(() => {
    const c = { all: 0, due: 0, waiting: 0, paid: 0, closed: 0 };
    (orders || []).forEach((o) => { c.all += 1; c[orderState(o).id] += 1; });
    return c;
  }, [orders]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const number = digits(needle);
    return (orders || []).filter((o) => {
      if (filter !== 'all' && orderState(o).id !== filter) return false;
      if (!needle) return true;
      const text = `${buyerName(o)} ${o.buyer?.email || ''} ${o.number} ${o.order_id}`.toLowerCase();
      return text.includes(needle) || (number.length >= 4 && digits(o.buyer?.phone).includes(number));
    });
  }, [orders, filter, query]);

  // Run an action on the open order, then show what the site now says about it.
  async function act(fn, done) {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const result = await fn();
      const fresh = result?.items ? result : await readOrder(openId);
      setDetail(fresh);
      setNote(typeof done === 'function' ? done(result) : done);
      clearCache(); // payment and status show on attendees too
      setRound((n) => n + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function openAttendee(row) {
    setError('');
    try {
      const cacheKey = `attendees:${row.event_id}`;
      let list = readCache(cacheKey);
      let found = (list || []).find((a) => a.id === row.id);
      if (!found) {
        list = await listAttendees(row.event_id);
        writeCache(cacheKey, list);
        found = list.find((a) => a.id === row.id);
      }
      if (!found) throw new Error('That attendee could not be opened.');
      onOpenProfile?.(found, row.event_id === event.id ? event : { id: row.event_id, name: '' });
    } catch (err) {
      setError(err.message);
    }
  }

  if (openId !== null) {
    const o = detail;
    const state = o ? orderState(o) : null;
    const owes = state && (state.id === 'due' || state.id === 'waiting');
    return (
      <div className="screen">
        <div className="section-head">
          <h1 className="page-title">Order {o?.number || openId}</h1>
          {o && <State order={o} />}
        </div>
        {error && <p className="notice error" role="status">{error}</p>}
        {note && <p className="notice ok" role="status">{note}</p>}
        {!o ? (!error && <p className="empty">Loading order</p>) : (
          <>
            <section className="panel wide">
              <h2 className="section-title">Order</h2>
              <dl>
                <dt>Buyer</dt><dd>{buyerName(o)}</dd>
                <dt>Phone</dt><dd>{o.buyer?.phone || 'None'}</dd>
                <dt>Email</dt><dd>{o.buyer?.email || 'None'}</dd>
                <dt>Placed</dt><dd>{dayTime(o.created)}{o.at_desk ? ', at the registration desk' : ', on the website'}</dd>
                <dt>Payment</dt><dd>{o.payment_method_title || (state.id === 'waiting' ? 'Card, not paid yet' : 'Not set')}</dd>
                <dt>Total</dt><dd><strong>{money(o.total)}</strong></dd>
              </dl>
              <ul className="order-lines">
                {o.items.map((item, i) => (
                  <li key={i}><span>{item.quantity} x {item.name}</span><span>{money(item.total)}</span></li>
                ))}
              </ul>
              <div className="row">
                {owes && <button className="btn" disabled={busy} onClick={() => act(() => markOrderPaid(o.order_id, 'cash'), 'Marked paid: cash.')}>Mark paid: cash</button>}
                {owes && <button className="btn" disabled={busy} onClick={() => act(() => markOrderPaid(o.order_id, 'check'), 'Marked paid: check.')}>Mark paid: check</button>}
                {state.id !== 'closed' && (o.details_missing > 0 || o.pay_url) && (
                  <button className="btn secondary" disabled={busy} onClick={() => act(() => textOrderAgain(o.order_id), (r) => (r.text_sent ? `Text sent to ${o.buyer?.phone}.` : 'The text could not be sent.'))}>Text the link to the customer</button>
                )}
                {owes && !cancelling && <button className="btn secondary danger" disabled={busy} onClick={() => setCancelling(true)}>Cancel order</button>}
              </div>
              {cancelling && (
                <div className="confirm">
                  <p><strong>Cancel this order?</strong> Its {o.attendees.length === 1 ? 'registration is' : 'registrations are'} cancelled with it. This cannot be undone from the app.</p>
                  <label>Reason (optional)<input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
                  <div className="row">
                    <button className="btn danger" disabled={busy} onClick={() => act(() => cancelOrder(o.order_id, reason), 'Order cancelled.').then(() => setCancelling(false))}>Yes, cancel the order</button>
                    <button className="btn secondary" disabled={busy} onClick={() => setCancelling(false)}>Keep the order</button>
                  </div>
                </div>
              )}
              {state.id === 'paid' && <p className="hint">A paid order needs a refund to be undone. Refunds are done on the site, not here.</p>}
            </section>

            <section className="panel wide">
              <h2 className="section-title">Attendees</h2>
              {o.attendees.length === 0 ? <p className="empty">No attendee details yet.</p> : (
                <ul className="order-people">
                  {o.attendees.map((a) => (
                    <li key={a.id}>
                      <button className="link start" onClick={() => openAttendee(a)}>{a.name || 'No name'}</button>
                      <span className="hint">{a.email}</span>
                      <span className="hint">{a.checked_in ? 'Checked in' : 'Not checked in'}</span>
                    </li>
                  ))}
                </ul>
              )}
              {o.details_missing > 0 && <p className="hint">{o.details_missing} of {o.tickets} {o.tickets === 1 ? 'ticket has' : 'tickets have'} no attendee yet. The customer fills that in from the texted link.</p>}
            </section>

            <section className="panel wide">
              <h2 className="section-title">Notes</h2>
              <form className="note-form" onSubmit={(e) => { e.preventDefault(); act(() => addOrderNote(o.order_id, draft), 'Note added.').then(() => setDraft('')); }}>
                <label>Add a note<textarea rows="2" value={draft} onChange={(e) => setDraft(e.target.value)} /></label>
                <button className="btn secondary" disabled={busy || !draft.trim()}>Add note</button>
              </form>
              {o.notes.length === 0 ? <p className="empty">No notes on this order.</p> : (
                <ul className="order-notes">
                  {o.notes.map((n, i) => (
                    <li key={i}><p>{n.content}</p><span className="hint">{[n.by, dayTime(n.date)].filter(Boolean).join(', ')}</span></li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="section-head">
        <h1 className="page-title">Orders</h1>
        <span className="hint">{event.name}{orders ? `, ${shown.length === counts.all ? `${counts.all} orders` : `${shown.length} of ${counts.all}`}` : ''}</span>
      </div>
      {error && <p className="notice error" role="status">{error}</p>}
      <div className="filters" role="group" aria-label="Filter orders">
        {FILTERS.map((f) => (
          <button key={f.id} className={`filter${filter === f.id ? ' on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}<span>{counts[f.id]}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? <p className="empty">{orders ? 'No orders found.' : error ? '' : 'Loading orders'}</p> : (
        <ul className="rows">
          {shown.slice(0, MAX_ROWS).map((o) => (
            <li key={o.order_id}>
              <button className="row-card order-row" onClick={() => open(o.order_id)}>
                <span className="row-num">{o.number}</span>
                <span className="row-main">{buyerName(o)}</span>
                <span className="row-sub">{o.tickets} {o.tickets === 1 ? 'ticket' : 'tickets'}, {day(o.created)}</span>
                <span className="row-total">{money(o.total)}</span>
                <span className="row-end"><State order={o} /></span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown.length > MAX_ROWS && <p className="hint">Showing the first {MAX_ROWS} of {shown.length}. Use the search box to narrow it down.</p>}
    </div>
  );
}
