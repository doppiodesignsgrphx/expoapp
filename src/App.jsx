import { useState } from 'react';
import { session } from './api.js';
import Login from './screens/Login.jsx';
import Events from './screens/Events.jsx';
import Attendees from './screens/Attendees.jsx';

export default function App() {
  const [user, setUser] = useState(session.token ? session.user : null);
  const [event, setEvent] = useState(null);

  function signOut() {
    session.clear();
    setUser(null);
    setEvent(null);
  }

  return (
    <div className="app">
      <header className="bar">
        <span className="brand">NC EMS Expo</span>
        {user && <button className="link light" onClick={signOut}>Sign out</button>}
      </header>
      <main>
        {!user ? <Login onDone={setUser} /> : !event ? <Events onPick={setEvent} /> : <Attendees event={event} onBack={() => setEvent(null)} />}
      </main>
    </div>
  );
}
