import { useState } from 'react';
import { login } from '../api.js';

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
    <form className="panel narrow" onSubmit={submit}>
      <h1>Staff sign in</h1>
      <label>
        Username
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
      </label>
      <label>
        Password
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </label>
      {error && <p className="notice error">{error}</p>}
      <button className="btn" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
    </form>
  );
}
