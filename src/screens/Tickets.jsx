import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { createPosOrder, isCheckedIn, listAttendees, listTickets, markOrderPaid, textOrderAgain } from '../api.js';
import { clearCache, readCache, writeCache } from '../cache.js';

// The point of sale. One page, top to bottom:
//   1. pick ticket quantities from the open event's ticket options
//   2. enter the buyer
//   3. choose who fills in the attendee details: the customer on their phone, or staff here
//   4. choose how it is paid
// The site creates the order. Card numbers are never typed into the app: a card
// is paid on the site's own payment page, opened from a QR code or a texted link.

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const blank = () => ({ first_name: '', last_name: '', email: '', phone: '' });

const PAYMENTS = [
  { id: 'card', label: 'Card' },
  { id: 'pay_later', label: 'Pay at registration' },
  { id: 'cash', label: 'Cash received' },
  { id: 'check', label: 'Check received' },
];

function Qr({ value, label }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: 360 }).then((url) => live && setSrc(url));
    return () => { live = false; };
  }, [value]);
  return src ? <img className="pos-qr" src={src} alt={label} /> : null;
}

// Sells for the event that is open, the same one Check-in works on.
export default function Tickets({ event, refreshKey, onBusy, onStats }) {
  const eventId = event.id;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState({});
  const [buyer, setBuyer] = useState(blank);
  const [fill, setFill] = useState('text'); // text | here
  const [people, setPeople] = useState([]);
  const [payment, setPayment] = useState('card');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sale, setSale] = useState(null);
  const [note, setNote] = useState('');
  const [sold, setSold] = useState(0);

  // The side panel keeps this event's counts, and picks up each new sale.
  useEffect(() => {
    let live = true;
    const key = `attendees:${event.id}`;
    const show = (list) => onStats?.({ label: event.name, registered: list.length, checkedIn: list.filter(isCheckedIn).length });
    const cached = readCache(key);
    if (cached) show(cached);
    listAttendees(event.id).then((list) => { if (live) { writeCache(key, list); show(list); } }).catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id, refreshKey, sold]);

  useEffect(() => {
    let live = true;
    onBusy?.(true);
    setLoading(true);
    setTickets([]);
    setQty({});
    listTickets(eventId)
      .then((list) => live && setTickets(list))
      .catch((err) => live && setError(err.message))
      .finally(() => { if (live) { setLoading(false); onBusy?.(false); } });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, refreshKey]);

  const lines = useMemo(() => tickets.filter((t) => (qty[t.id] || 0) > 0).map((t) => ({ ticket: t, quantity: qty[t.id] })), [tickets, qty]);
  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const total = lines.reduce((n, l) => n + l.quantity * Number(l.ticket.price || 0), 0);

  // One attendee form per ticket when staff fill the details in here.
  const units = useMemo(() => lines.flatMap((l) => Array.from({ length: l.quantity }, () => l.ticket.name)), [lines]);
  useEffect(() => {
    setPeople((current) => units.map((_, i) => current[i] || blank()));
  }, [units.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const step = (ticket, by) => setQty((q) => {
    const max = ticket.manage_stock ? Number(ticket.stock_quantity ?? 0) : 99;
    return { ...q, [ticket.id]: Math.max(0, Math.min(max, (q[ticket.id] || 0) + by)) };
  });
  const setPerson = (i, key, value) => setPeople((list) => list.map((p, n) => (n === i ? { ...p, [key]: value } : p)));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await createPosOrder({
        event_id: eventId,
        items: lines.map((l) => ({ ticket_id: l.ticket.id, quantity: l.quantity })),
        buyer,
        attendees: fill === 'here' ? people : [],
        payment,
        send_text: fill === 'text' || payment === 'card',
      });
      clearCache(); // new registrations: lists must be read again
      setSale(result);
      setSold((n) => n + 1);
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function act(fn, done) {
    setBusy(true);
    setError('');
    try {
      const result = await fn();
      setSale((s) => ({ ...s, ...result }));
      setNote(done(result));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setSale(null);
    setQty({});
    setBuyer(blank());
    setPeople([]);
    setFill('text');
    setPayment('card');
    setError('');
    setNote('');
  }

  if (sale) {
    const owes = !sale.paid;
    return (
      <div className="screen">
        <h1 className="page-title">Order {sale.order_id}</h1>
        {error && <p className="notice error" role="status">{error}</p>}
        {note && <p className="notice ok" role="status">{note}</p>}
        <section className="panel wide">
          <dl>
            <dt>Total</dt><dd>{money(sale.total)}</dd>
            <dt>Payment</dt><dd>{sale.paid ? 'Paid' : sale.payment_method === 'cod' ? 'Outstanding balance, pay at registration' : 'Pending'}</dd>
            <dt>Tickets</dt><dd>{sale.tickets}</dd>
            <dt>Attendee details</dt><dd>{sale.details_missing > 0 ? `${sale.details_missing} still to be filled in by the customer` : 'Complete'}</dd>
            <dt>Text to customer</dt><dd>{sale.text_sent ? `Sent to ${buyer.phone}` : 'Not sent'}</dd>
          </dl>
          <div className="pos-codes">
            {sale.details_missing > 0 && (
              <figure>
                <Qr value={sale.form_url} label="Registration form link" />
                <figcaption>Customer scans to fill in attendee details</figcaption>
              </figure>
            )}
            {sale.pay_url && sale.payment_method !== 'cod' && (
              <figure>
                <Qr value={sale.pay_url} label="Payment link" />
                <figcaption>Customer scans to pay by card</figcaption>
              </figure>
            )}
          </div>
          <div className="row">
            {(sale.details_missing > 0 || sale.pay_url) && (
              <button className="btn secondary" disabled={busy} onClick={() => act(() => textOrderAgain(sale.order_id), (r) => (r.text_sent ? 'Text sent.' : 'The text could not be sent.'))}>Text the link again</button>
            )}
            {owes && <button className="btn secondary" disabled={busy} onClick={() => act(() => markOrderPaid(sale.order_id, 'cash'), () => 'Marked paid: cash.')}>Mark paid: cash</button>}
            {owes && <button className="btn secondary" disabled={busy} onClick={() => act(() => markOrderPaid(sale.order_id, 'check'), () => 'Marked paid: check.')}>Mark paid: check</button>}
            <button className="btn" onClick={reset}>New sale</button>
          </div>
        </section>
      </div>
    );
  }

  const ready = count > 0 && buyer.first_name && buyer.last_name && buyer.phone;

  return (
    <form className="screen" onSubmit={submit}>
      <div className="section-head">
        <h1 className="page-title">Tickets</h1>
        <span className="hint">{event.name}</span>
      </div>
      {error && <p className="notice error" role="status">{error}</p>}

      <section className="panel wide">
        <h2 className="section-title">1. Tickets</h2>
        {tickets.length === 0 ? <p className="empty">{loading ? 'Loading tickets' : 'No tickets are set up for this event.'}</p> : (
          <ul className="pos-tickets">
            {tickets.map((t) => (
              <li key={t.id}>
                <span className="pos-name">{t.name}</span>
                <span className="pos-price">{money(t.price)}</span>
                <span className="hint">{t.manage_stock ? `${t.stock_quantity} left` : ''}</span>
                <span className="qty">
                  <button type="button" onClick={() => step(t, -1)} aria-label={`One fewer ${t.name}`} disabled={!qty[t.id]}>-</button>
                  <output aria-label={`${t.name} quantity`}>{qty[t.id] || 0}</output>
                  <button type="button" onClick={() => step(t, 1)} aria-label={`One more ${t.name}`}>+</button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="pos-total">{count} {count === 1 ? 'ticket' : 'tickets'} <strong>{money(total)}</strong></p>
      </section>

      <section className="panel wide">
        <h2 className="section-title">2. Buyer</h2>
        <div className="form-grid">
          <label>First name<input value={buyer.first_name} onChange={(e) => setBuyer({ ...buyer, first_name: e.target.value })} required /></label>
          <label>Last name<input value={buyer.last_name} onChange={(e) => setBuyer({ ...buyer, last_name: e.target.value })} required /></label>
          <label>Mobile phone<input type="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} required /></label>
          <label>Email (optional)<input type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} /></label>
        </div>
      </section>

      <section className="panel wide">
        <h2 className="section-title">3. Attendee details</h2>
        <div className="choices">
          <label className={`choice${fill === 'text' ? ' on' : ''}`}>
            <input type="radio" name="fill" checked={fill === 'text'} onChange={() => setFill('text')} />
            <span><strong>Text it to the customer</strong>They fill in each attendee on their phone.</span>
          </label>
          <label className={`choice${fill === 'here' ? ' on' : ''}`}>
            <input type="radio" name="fill" checked={fill === 'here'} onChange={() => setFill('here')} />
            <span><strong>Fill it in here</strong>Enter each attendee now.</span>
          </label>
        </div>
        {fill === 'here' && units.map((ticketName, i) => (
          <fieldset className="attendee-set" key={i}>
            <legend>
              Ticket {i + 1}: {ticketName}
              {i === 0 && <button type="button" className="link" onClick={() => setPeople((list) => list.map((p, n) => (n === 0 ? { ...buyer } : p)))}>Same as buyer</button>}
            </legend>
            <div className="form-grid">
              <label>First name<input value={people[i]?.first_name || ''} onChange={(e) => setPerson(i, 'first_name', e.target.value)} required /></label>
              <label>Last name<input value={people[i]?.last_name || ''} onChange={(e) => setPerson(i, 'last_name', e.target.value)} required /></label>
              <label>Email<input type="email" value={people[i]?.email || ''} onChange={(e) => setPerson(i, 'email', e.target.value)} required /></label>
              <label>Mobile phone<input type="tel" value={people[i]?.phone || ''} onChange={(e) => setPerson(i, 'phone', e.target.value)} /></label>
            </div>
          </fieldset>
        ))}
        {fill === 'here' && count === 0 && <p className="hint">Add tickets above to enter attendees.</p>}
      </section>

      <section className="panel wide">
        <h2 className="section-title">4. Payment</h2>
        <div className="choices">
          {PAYMENTS.map((p) => (
            <label key={p.id} className={`choice${payment === p.id ? ' on' : ''}`}>
              <input type="radio" name="payment" checked={payment === p.id} onChange={() => setPayment(p.id)} />
              <span><strong>{p.label}</strong></span>
            </label>
          ))}
        </div>
      </section>

      <div className="row">
        <button className="btn" disabled={!ready || busy}>{busy ? 'Creating order' : `Create order, ${money(total)}`}</button>
      </div>
    </form>
  );
}
