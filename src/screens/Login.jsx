import { useState } from 'react';
import { login } from '../api.js';
import logo from '../assets/oems-logo.svg';
import { LockIcon, UserIcon } from '../icons.jsx';

export default function Login({ onDone }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      onDone(await login(username.trim(), password));
    } catch (err) {
      setError(err.code === 401 ? 'That username or password is not right.' : err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <section className="login-brand">
        <div className="login-logo">
          <img src={logo} alt="North Carolina Office of EMS" />
          <span>NC EMS Expo</span>
        </div>
        <h1>Registration<br />and check-in</h1>
        <p>Check attendees in, print badges and track attendance for the North Carolina EMS Expo.</p>
      </section>
      <section className="login-form">
        <form onSubmit={submit}>
          <h2>Staff sign in</h2>
          <p className="hint">Use your Expo site account.</p>
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
          {error && <p className="notice error">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
        </form>
      </section>
    </div>
  );
}
