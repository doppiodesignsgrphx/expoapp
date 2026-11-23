import { useState } from 'react';
import { session } from './api.js';
import { useDesktop } from './desktop.js';
import Login from './screens/Login.jsx';
import Events from './screens/Events.jsx';
import Attendees from './screens/Attendees.jsx';
import PrinterSettings from './components/PrinterSettings.jsx';

export default function App() {
  const [user, setUser] = useState(session.token ? session.user : null);
  const [event, setEvent] = useState(null);
  const [showPrinter, setShowPrinter] = useState(false);
  const desktop = useDesktop();

  function signOut() {
    session.clear();
    setUser(null);
    setEvent(null);
  }

  return (
    <div className="app">
      <header className="bar">
        <span className="brand">NC EMS Expo</span>
        <span className="bar-links">
          {desktop && <button className="link light" onClick={() => setShowPrinter((s) => !s)}>Printer</button>}
          {user && <button className="link light" onClick={signOut}>Sign out</button>}
        </span>
      </header>
      <main>
        {desktop && showPrinter && <PrinterSettings onClose={() => setShowPrinter(false)} />}
        {!user ? <Login onDone={setUser} /> : !event ? <Events onPick={setEvent} /> : <Attendees event={event} onBack={() => setEvent(null)} />}
      </main>
    </div>
  );
}
