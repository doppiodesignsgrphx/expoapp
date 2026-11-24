import { useCallback, useEffect, useRef, useState } from 'react';
import { session } from './api.js';
import { useDesktop } from './desktop.js';
import Login from './screens/Login.jsx';
import Events from './screens/Events.jsx';
import Attendees from './screens/Attendees.jsx';
import AttendeePreview from './screens/AttendeePreview.jsx';
import PrinterSettings from './components/PrinterSettings.jsx';
import logo from './assets/oems-logo.svg';
import {
  BackIcon, BellIcon, CalendarIcon, CardIcon, ChartIcon, CheckIcon, CloseIcon, HomeIcon, LogOutIcon,
  MenuIcon, PrinterIcon, RefreshIcon, SearchIcon, SettingsIcon, TicketIcon, UsersIcon,
} from './icons.jsx';

// Menu items for features that are not built yet. They hold their place in the
// layout and do nothing.
const PLACEHOLDERS = [
  { label: 'Sessions', Icon: CalendarIcon },
  { label: 'Attendees', Icon: UsersIcon },
  { label: 'Orders', Icon: CardIcon },
  { label: 'Tickets', Icon: TicketIcon },
  { label: 'Reports', Icon: ChartIcon },
  { label: 'Alerts', Icon: BellIcon },
];

// The site's sign-in reply does not always carry a name, so try the likely
// fields and fall back to the username typed at sign-in.
function displayName(user) {
  if (!user) return 'OEMS staff';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return full || user.display_name || user.user_display_name || user.name || user.nicename || user.user_nicename
    || user.username || user.user_login || user.login || user.user_email || user.email || 'OEMS staff';
}
const initials = (name) => name.split(/[\s._@-]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'OS';

export default function App() {
  const [user, setUser] = useState(session.token ? session.user : null);
  const [event, setEvent] = useState(null);
  const [showPrinter, setShowPrinter] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [stats, setStats] = useState({ label: 'All events', registered: 0, checkedIn: 0 });
  const [navOpen, setNavOpen] = useState(false);
  const desktop = useDesktop();

  // A screen can register a handler that gets first refusal on Back
  // (for example, closing an open attendee before leaving the event).
  const screenBack = useRef(null);
  const registerBack = useCallback((fn) => {
    screenBack.current = fn;
  }, []);

  // The search box means something different on each screen, so clear it on the way in and out.
  useEffect(() => setQuery(''), [event?.id]);

  function back() {
    if (showPrinter) return setShowPrinter(false);
    if (screenBack.current && screenBack.current()) return undefined;
    return setEvent(null);
  }

  function goHome() {
    setShowPrinter(false);
    setEvent(null);
    setNavOpen(false);
  }

  function signOut() {
    session.clear();
    setUser(null);
    setEvent(null);
    setShowPrinter(false);
    setNavOpen(false);
  }

  if (!user) return <Login onDone={setUser} />;
  if (user.preview) return <AttendeePreview onSignOut={() => setUser(null)} />;

  const name = displayName(user);
  const remaining = Math.max(0, stats.registered - stats.checkedIn);

  return (
    <div className={`shell${navOpen ? ' nav-open' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src={logo} alt="North Carolina Office of EMS" />
          <span>OEMS EXPO</span>
          <button className="icon-btn nav-close" onClick={() => setNavOpen(false)} aria-label="Close menu"><CloseIcon /></button>
        </div>
        <nav aria-label="Main">
          <p className="nav-head">Menu</p>
          <button className={`nav-item${!event ? ' active' : ''}`} onClick={goHome}><HomeIcon /><span>Home</span></button>
          <button className={`nav-item${event ? ' active' : ''}`} onClick={() => setNavOpen(false)} disabled={!event} title={event ? '' : 'Pick an event on Home first'}>
            <CheckIcon /><span>Check-in</span>
          </button>
          <p className="nav-head">Coming soon</p>
          {PLACEHOLDERS.map(({ label, Icon }) => (
            <button key={label} className="nav-item placeholder" disabled><Icon /><span>{label}</span></button>
          ))}
        </nav>
        <button className="nav-item signout" onClick={signOut}><LogOutIcon /><span>Sign out</span></button>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn nav-toggle" onClick={() => setNavOpen(true)} aria-label="Menu"><MenuIcon /></button>
          <button className="icon-btn" onClick={back} disabled={!event && !showPrinter} aria-label="Back" title="Back"><BackIcon /></button>
          <button className={`icon-btn${busy ? ' spinning' : ''}`} onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh" title="Refresh"><RefreshIcon /></button>
          <label className="search">
            <SearchIcon />
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={event ? 'Find by name, email or badge code' : 'Search events and sessions'}
            />
          </label>
          <button className="icon-btn placeholder" disabled aria-label="Alerts (coming soon)" title="Alerts (coming soon)"><BellIcon /></button>
          <button className="icon-btn" onClick={() => setShowPrinter((s) => !s)} aria-label="Settings" title="Settings"><SettingsIcon /></button>
        </header>

        <div className="content">
          {showPrinter && <PrinterSettings onClose={() => setShowPrinter(false)} />}
          {!event
            ? <Events onPick={setEvent} refreshKey={refreshKey} onBusy={setBusy} query={query} onStats={setStats} />
            : <Attendees event={event} refreshKey={refreshKey} onBusy={setBusy} registerBack={registerBack} query={query} onQuery={setQuery} onStats={setStats} />}
        </div>
      </div>

      <aside className="profile">
        <div className="avatar" aria-hidden="true">{initials(name)}</div>
        <h2>{name}</h2>
        <p className="hint">{user.user_email || user.email || 'OEMS staff'}</p>
        <ul className="stats">
          <li><UsersIcon /><strong>{stats.registered}</strong><span>Registered</span></li>
          <li><CheckIcon /><strong>{stats.checkedIn}</strong><span>Checked in</span></li>
          <li><TicketIcon /><strong>{remaining}</strong><span>Remaining</span></li>
        </ul>
        <div className="promo">
          <PrinterIcon />
          <h3>Badge printer</h3>
          <p>{desktop ? 'Badges print straight to the Brother printer from this computer.' : 'Badges print through the browser print dialog. The desktop app prints directly.'}</p>
          <button className="btn" onClick={() => setShowPrinter(true)}>Printer settings</button>
        </div>
      </aside>
    </div>
  );
}
