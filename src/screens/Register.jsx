import { useEffect, useState } from 'react';
import { readRegisterForm, saveRegisterForm } from '../api.js';
import logo from '../assets/oems-logo.svg';

// The page a customer opens from the texted link. It needs no sign-in: the
// order key in the link is the pass. They enter one attendee per ticket, then
// pay if the order still needs a card payment.

const blank = () => ({ first_name: '', last_name: '', email: '', phone: '' });
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function Register({ orderId, orderKey }) {
  const [form, setForm] = useState(null);
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    readRegisterForm(orderId, orderKey)
      .then((data) => {
        if (!live) return;
        setForm(data);
        setPeople(data.tickets.map((_, i) => (i === 0 ? { ...blank(), ...data.buyer } : blank())));
      })
      .catch((err) => live && setError(err.message));
    return () => { live = false; };
  }, [orderId, orderKey]);

  const setPerson = (i, key, value) => setPeople((list) => list.map((p, n) => (n === i ? { ...p, [key]: value } : p)));

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      setForm(await saveRegisterForm(orderId, orderKey, people));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="register">
      <header className="register-head">
        <img src={logo} alt="North Carolina Office of EMS" />
        <h1>OEMS EXPO</h1>
      </header>
      <main className="register-body">
        {error && <p className="notice error" role="status">{error}</p>}
        {!form && !error && <p className="empty">Loading your order</p>}
        {form && form.details_missing === 0 && (
          <section className="panel wide">
            <h2>You are registered</h2>
            <p>{form.event_name ? `Your registration for ${form.event_name} is saved.` : 'Your registration is saved.'}</p>
            {form.pay_url
              ? <><p>Your total is <strong>{money(form.total)}</strong>. Pay by card to finish, or pay at the registration desk.</p><a className="btn" href={form.pay_url}>Pay {money(form.total)} now</a></>
              : <p className="hint">{form.paid ? 'Your order is paid. See you at registration.' : 'Any balance can be paid at the registration desk.'}</p>}
          </section>
        )}
        {form && form.details_missing > 0 && (
          <form onSubmit={submit} className="register-form">
            <p>{form.event_name}: enter the details for each attendee.</p>
            {form.tickets.map((t, i) => (
              <fieldset className="panel wide attendee-set" key={i}>
                <legend>Ticket {i + 1}: {t.ticket_name}</legend>
                <div className="form-grid">
                  <label>First name<input value={people[i]?.first_name || ''} onChange={(e) => setPerson(i, 'first_name', e.target.value)} autoComplete="given-name" required /></label>
                  <label>Last name<input value={people[i]?.last_name || ''} onChange={(e) => setPerson(i, 'last_name', e.target.value)} autoComplete="family-name" required /></label>
                  <label>Email<input type="email" value={people[i]?.email || ''} onChange={(e) => setPerson(i, 'email', e.target.value)} autoComplete="email" required /></label>
                  <label>Mobile phone<input type="tel" value={people[i]?.phone || ''} onChange={(e) => setPerson(i, 'phone', e.target.value)} autoComplete="tel" /></label>
                </div>
              </fieldset>
            ))}
            <button className="btn" disabled={busy}>{busy ? 'Saving' : 'Save registration'}</button>
          </form>
        )}
      </main>
    </div>
  );
}
