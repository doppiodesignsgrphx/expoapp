import { useCallback, useEffect, useRef, useState } from 'react';
import { session } from './api.js';
import { useDesktop } from './desktop.js';
import Login from './screens/Login.jsx';
import Events from './screens/Events.jsx';
import Attendees from './screens/Attendees.jsx';
import Search from './screens/Search.jsx';
import People from './screens/People.jsx';
import Sessions from './screens/Sessions.jsx';
import AttendeeDetail from './screens/AttendeeDetail.jsx';
import AttendeePreview from './screens/AttendeePreview.jsx';
import PrinterSettings from './components/PrinterSettings.jsx';
import logo from './assets/oems-logo.svg';
import {
  BackIcon, BellIcon, CalendarIcon, ChartIcon, CheckIcon, ClockIcon, CloseIcon, FlagIcon, HomeIcon, LogOutIcon,
  MenuIcon, MessageIcon, PlusIcon, PrinterIcon, RefreshIcon, SearchIcon, SettingsIcon, TicketIcon, TransferIcon, UsersIcon,
} from './icons.jsx';

// Menu items for features that are not built yet. They hold their place in the
// layout and do nothing.
const PLACEHOLDERS = [
  { label: 'Tickets', Icon: TicketIcon },
  { label: 'Transfers', Icon: TransferIcon },
  { label: 'Staff schedule', Icon: ClockIcon },
  { label: 'Messages', Icon: MessageIcon },
  { label: 'Alerts', Icon: BellIcon },
  { label: 'Reports', Icon: ChartIcon },
  { label: 'Analytics', Icon: ChartIcon },
  { label: 'Escalate', Icon: FlagIcon },
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
  const [openAttendee, setOpenAttendee] = useState(null);
  const [page, setPage] = useState('home'); // home | people | sessions
  const [profile, setProfile] = useState(null); // { attendee, event } while an attendee's own page is open
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
  useEffect(() => setQuery(''), [event?.id, page, profile?.attendee?.id]);

  function pick(ev, attendeeId = null) {
    setProfile(null);
    setOpenAttendee(attendeeId);
    setEvent(ev);
  }

  function openProfile(attendee, ev) {
    setProfile({ attendee, event: ev });
  }

  function back() {
    if (showPrinter) return setShowPrinter(false);
    if (profile) return setProfile(null);
    if (screenBack.current && screenBack.current()) return undefined;
    if (event) return setEvent(null);
    return setPage('home');
  }

  function go(next) {
    setShowPrinter(false);
    setProfile(null);
    setEvent(null);
    setPage(next);
    setNavOpen(false);
  }

  function signOut() {
    session.clear();
    setUser(null);
    setEvent(null);
    setProfile(null);
    setPage('home');
    setShowPrinter(false);
    setNavOpen(false);
  }

  if (!user) return <Login onDone={setUser} />;
  if (user.preview) return <AttendeePreview onSignOut={() => setUser(null)} />;

  const name = displayName(user);
  const remaining = Math.max(0, stats.registered - stats.checkedIn);
  // Which menu item is lit: an open attendee page belongs to Attendees, an open event to Check-in.
  const here = profile ? 'people' : event ? 'checkin' : page;
  const canGoBack = Boolean(showPrinter || profile || event || page !== 'home');
  const hint = profile ? 'Search is off on this page' : event ? 'Find in this event by name, email or badge code'
    : page === 'people' ? 'Find an attendee by name, email, phone or badge code' : page === 'sessions' ? 'Find a session by name, room or type' : 'Search attendees and sessions';

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
          <button className={`nav-item${here === 'home' ? ' active' : ''}`} onClick={() => go('home')}><HomeIcon /><span>Home</span></button>
          <button className={`nav-item${here === 'checkin' ? ' active' : ''}`} onClick={() => { setProfile(null); setNavOpen(false); }} disabled={!event} title={event ? '' : 'Pick an event or session first'}>
            <CheckIcon /><span>Check-in</span>
          </button>
          <button className={`nav-item${here === 'people' ? ' active' : ''}`} onClick={() => go('people')}><UsersIcon /><span>Attendees</span></button>
          <button className={`nav-item${here === 'sessions' ? ' active' : ''}`} onClick={() => go('sessions')}><CalendarIcon /><span>Sessions</span></button>
          <p className="nav-head">Coming soon</p>
          {PLACEHOLDERS.map(({ label, Icon }) => (
            <button key={label} className="nav-item placeholder" disabled><Icon /><span>{label}</span></button>
          ))}
        </nav>
        <button className="nav-item placeholder bottom" disabled><PlusIcon /><span>Register a new attendee</span></button>
        <button className="nav-item" onClick={signOut}><LogOutIcon /><span>Sign out</span></button>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn nav-toggle" onClick={() => setNavOpen(true)} aria-label="Menu"><MenuIcon /></button>
          <button className="icon-btn" onClick={back} disabled={!canGoBack} aria-label="Back" title="Back"><BackIcon /></button>
          <button className={`icon-btn${busy ? ' spinning' : ''}`} onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh" title="Refresh"><RefreshIcon /></button>
          <label className="search">
            <SearchIcon />
            <span className="sr-only">Search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={hint}
              disabled={Boolean(profile)}
            />
          </label>
          <span className="topbar-space" />
          <button className="icon-btn placeholder" disabled aria-label="Alerts (coming soon)" title="Alerts (coming soon)"><BellIcon /></button>
          <button className="icon-btn" onClick={() => setShowPrinter((s) => !s)} aria-label="Settings" title="Settings"><SettingsIcon /></button>
        </header>

        <div className="content">
          {showPrinter && <PrinterSettings onClose={() => setShowPrinter(false)} />}
          {profile
            ? <AttendeeDetail key={`${profile.event.id}:${profile.attendee.id}`} attendee={profile.attendee} event={profile.event} refreshKey={refreshKey} onOpenEvent={pick} />
            : event
              ? <Attendees key={event.id} event={event} openId={openAttendee} refreshKey={refreshKey} onBusy={setBusy} registerBack={registerBack} query={query} onQuery={setQuery} onStats={setStats} onOpenProfile={openProfile} />
              : page === 'people'
                ? <People query={query} refreshKey={refreshKey} onOpen={openProfile} onStats={setStats} />
                : page === 'sessions'
                  ? <Sessions query={query} refreshKey={refreshKey} onBusy={setBusy} onPick={pick} onStats={setStats} />
                  : query.trim()
                    ? <Search query={query} refreshKey={refreshKey} onBusy={setBusy} onPickEvent={pick} onPickAttendee={pick} />
                    : <Events onPick={pick} refreshKey={refreshKey} onBusy={setBusy} onStats={setStats} />}
        </div>
      </div>

      <aside className="profile">
        <div className="avatar" aria-hidden="true">{initials(name)}</div>
        <h2>{name}</h2>
        <p className="hint">{user.user_email || user.email || 'OEMS staff'}</p>
        <ul className="stats">
          <li><i className="chip"><UsersIcon /></i><span>Registered</span><strong>{stats.registered}</strong></li>
          <li><i className="chip green"><CheckIcon /></i><span>Checked in</span><strong>{stats.checkedIn}</strong></li>
          <li><i className="chip"><TicketIcon /></i><span>Remaining</span><strong>{remaining}</strong></li>
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
