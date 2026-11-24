import { useState } from 'react';
import { login, requestCode, verifyCode } from '../api.js';
import logo from '../assets/oems-logo.svg';
import { KeyIcon, LockIcon, MailIcon, UserIcon } from '../icons.jsx';

// Typing this in the attendee box opens the attendee side with sample data only.
// It is in the page source, so it must never unlock anything real.
const PREVIEW_CODE = import.meta.env.VITE_PREVIEW_CODE || 'expo-preview-2027';

const REGISTER_URL = 'https://oems.nc.gov/programs-and-services/expo';

// Words on the left panel change with who is signing in.
const INTRO = {
  attendee: 'Enter the email or mobile number you registered with. We will send a one-time code to sign you in to your schedule, sessions and badge.',
  code: 'Enter the one-time code we just sent you. It works once and expires after a few minutes.',
  staff: 'OEMS staff: sign in with your Expo site username and password to check attendees in, print badges and manage registration.',
};

export default function Login({ onDone }) {
  const [mode, setMode] = useState('attendee'); // attendee | code | staff
  const [contact, setContact] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function go(next) {
    setMode(next);
    setError('');
    setCode('');
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (mode === 'staff') {
        onDone(await login(username.trim(), password));
      } else if (mode === 'attendee' && contact.trim() === PREVIEW_CODE) {
        onDone({ preview: true });
      } else if (mode === 'attendee') {
        await requestCode(contact.trim());
        go('code');
      } else {
        // The attendee side of the app is not built yet, so there is nowhere to go after this.
        await verifyCode(contact.trim(), code.trim());
        setError('Signed in. The attendee area is not available yet.');
      }
    } catch (err) {
      setError(err.code === 401 ? (mode === 'staff' ? 'That username or password is not right.' : 'That code is not right or has expired.') : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-brand">
        <img src={logo} alt="North Carolina Office of EMS" />
        <h1>OEMS<br />EXPO</h1>
        <p>{INTRO[mode]}</p>
        <a href={REGISTER_URL} target="_blank" rel="noreferrer">Haven't registered for Expo?</a>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <h2>{mode === 'staff' ? 'OEMS staff sign in' : 'Attendee sign in'}</h2>
          {mode === 'attendee' && (
            <label className="field">
              <span className="sr-only">Email or mobile number</span>
              <MailIcon />
              <input placeholder="Email or mobile number" value={contact} onChange={(e) => setContact(e.target.value)} autoCapitalize="none" autoComplete="username" required />
            </label>
          )}
          {mode === 'code' && (
            <>
              <p className="hint">Code sent to {contact}.</p>
              <label className="field">
                <span className="sr-only">One-time code</span>
                <KeyIcon />
                <input placeholder="One-time code" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required />
              </label>
            </>
          )}
          {mode === 'staff' && (
            <>
              <label className="field">
                <span className="sr-only">Username</span>
                <UserIcon />
                <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
              </label>
              <label className="field">
                <span className="sr-only">Password</span>
                <LockIcon />
                <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
              </label>
            </>
          )}
          {error && <p className="notice error" role="status">{error}</p>}
          <button className="btn" disabled={busy}>
            {busy ? 'Working' : mode === 'attendee' ? 'Send my code' : 'Sign in'}
          </button>
          {mode === 'code' && <button type="button" className="link" onClick={() => go('attendee')}>Use a different email or number</button>}
          {mode === 'staff'
            ? <button type="button" className="link" onClick={() => go('attendee')}>Attendee login</button>
            : <button type="button" className="link" onClick={() => go('staff')}>OEMS staff login</button>}
        </form>
      </section>
    </div>
  );
}
