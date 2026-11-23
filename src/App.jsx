import { useCallback, useRef, useState } from 'react';
import { session } from './api.js';
import { useDesktop } from './desktop.js';
import Login from './screens/Login.jsx';
import Events from './screens/Events.jsx';
import Attendees from './screens/Attendees.jsx';
import PrinterSettings from './components/PrinterSettings.jsx';

const BackIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M15 4l-8 8 8 8" />
  </svg>
);

const RefreshIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square">
    <path d="M20 11a8 8 0 1 0-2.3 6.3" />
    <path d="M20 4v7h-7" />
  </svg>
);

export default function App() {
  const [user, setUser] = useState(session.token ? session.user : null);
  const [event, setEvent] = useState(null);
  const [showPrinter, setShowPrinter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const desktop = useDesktop();

  // A screen can register a handler that gets first refusal on Back
  // (for example, closing an open attendee before leaving the event).
  const screenBack = useRef(null);
  const registerBack = useCallback((fn) => {
    screenBack.current = fn;
  }, []);

  function back() {
    if (showPrinter) return setShowPrinter(false);
    if (screenBack.current && screenBack.current()) return undefined;
    return setEvent(null);
  }

  function signOut() {
    session.clear();
    setUser(null);
    setEvent(null);
  }

  const canGoBack = Boolean(user && (event || showPrinter)) || (!user && showPrinter);

  return (
    <div className="app">
      <header className="bar">
        <span className="bar-side">
          {canGoBack && <button className="icon-btn" onClick={back} aria-label="Back" title="Back"><BackIcon /></button>}
          <span className="brand">NC EMS Expo</span>
        </span>
        <span className="bar-links">
          {user && (
            <button className={`icon-btn${busy ? ' spinning' : ''}`} onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh" title="Refresh">
              <RefreshIcon />
            </button>
          )}
          {desktop && <button className="link light" onClick={() => setShowPrinter((s) => !s)}>Printer</button>}
          {user && <button className="link light" onClick={signOut}>Sign out</button>}
        </span>
      </header>
      <main>
        {desktop && showPrinter && <PrinterSettings onClose={() => setShowPrinter(false)} />}
        {!user ? <Login onDone={setUser} />
          : !event ? <Events onPick={setEvent} refreshKey={refreshKey} onBusy={setBusy} />
          : <Attendees event={event} refreshKey={refreshKey} onBusy={setBusy} registerBack={registerBack} />}
      </main>
    </div>
  );
}
