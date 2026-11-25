import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import logo from '../assets/oems-logo.svg';
import {
  BagIcon, BellIcon, BookmarkIcon, CalendarIcon, CardIcon, CheckIcon, CloseIcon, FlagIcon, HelpIcon, HomeIcon, ListIcon, LogOutIcon,
  MapIcon, MenuIcon, MessageIcon, NoteIcon, PhoneIcon, SearchIcon, SettingsIcon, TicketIcon,
} from '../icons.jsx';

// A look at the attendee side using made-up data. Nothing here talks to the site.
// It exists so the layout can be reviewed before attendee sign-in is built.
const SAMPLE = {
  first: 'Sample',
  last: 'Attendee',
  email: 'attendee@example.org',
  code: 'SAMPLE0000000000',
  // The emailed ticket's QR holds the event, order and attendee numbers in this form.
  ticketCode: '7816-1001-2001',
  ticketName: 'Early Bird Ticket',
  eventName: 'EXPO 2027',
  registered: ['Sample session one', 'Sample session two', 'Sample session three'],
  attended: ['Sample session one'],
};

// Features on the checklist that are not built yet. They hold their place and do nothing.
const MENU = [
  { label: 'Sessions', Icon: ListIcon },
  { label: 'Registered sessions', Icon: CalendarIcon },
  { label: 'Bookmarked sessions', Icon: BookmarkIcon },
  { label: 'Notebook', Icon: NoteIcon },
  { label: 'Expo map', Icon: MapIcon },
  { label: 'Merch', Icon: BagIcon },
  { label: 'Messages', Icon: MessageIcon },
  { label: 'Alerts', Icon: BellIcon },
  { label: 'Buy a ticket', Icon: CardIcon },
  { label: 'Help', Icon: HelpIcon },
  { label: 'Contact registration desk', Icon: PhoneIcon },
  { label: 'Report an issue', Icon: FlagIcon },
];

export default function AttendeePreview({ onSignOut }) {
  const [navOpen, setNavOpen] = useState(false);
  const [qr, setQr] = useState('');
  const [ticketQr, setTicketQr] = useState('');
  const [view, setView] = useState('home'); // home | ticket

  function go(next) {
    setView(next);
    setNavOpen(false);
  }

  useEffect(() => {
    QRCode.toDataURL(SAMPLE.code, { errorCorrectionLevel: 'M', margin: 0, width: 360 }).then(setQr);
    QRCode.toDataURL(SAMPLE.ticketCode, { errorCorrectionLevel: 'M', margin: 0, width: 520 }).then(setTicketQr);
  }, []);

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
          <button className={`nav-item${view === 'home' ? ' active' : ''}`} onClick={() => go('home')}><HomeIcon /><span>Home</span></button>
          <button className={`nav-item${view === 'ticket' ? ' active' : ''}`} onClick={() => go('ticket')}><TicketIcon /><span>My ticket</span></button>
          <p className="nav-head">Coming soon</p>
          {MENU.map(({ label, Icon }) => <button key={label} className="nav-item placeholder" disabled><Icon /><span>{label}</span></button>)}
        </nav>
        <button className="nav-item bottom" onClick={onSignOut}><LogOutIcon /><span>Sign out</span></button>
      </aside>
      <div className="scrim" onClick={() => setNavOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="icon-btn nav-toggle" onClick={() => setNavOpen(true)} aria-label="Menu"><MenuIcon /></button>
          <label className="search">
            <SearchIcon />
            <span className="sr-only">Search</span>
            <input type="search" placeholder="Search sessions" disabled />
          </label>
          <span className="topbar-space" />
          <button className="icon-btn placeholder" disabled aria-label="Alerts (coming soon)"><BellIcon /></button>
          <button className="icon-btn" disabled aria-label="Settings (coming soon)"><SettingsIcon /></button>
        </header>
        <div className="content">
          {view === 'ticket' ? (
            <div className="screen">
              <h1 className="page-title">My ticket</h1>
              <section className="ticket-card">
                <div className="ticket-top">
                  <span>{SAMPLE.eventName}</span>
                  <strong>{SAMPLE.ticketName}</strong>
                </div>
                <div className="ticket-body">
                  {ticketQr && <img src={ticketQr} alt={`Ticket code ${SAMPLE.ticketCode}`} />}
                  <h2>{SAMPLE.first} {SAMPLE.last}</h2>
                  <p className="ticket-code">{SAMPLE.ticketCode}</p>
                  <p className="hint">This is the same code as the ticket in your email. Show it at registration to check in and pick up your badge.</p>
                </div>
              </section>
            </div>
          ) : (
            <div className="screen">
              <h1 className="page-title">Welcome, {SAMPLE.first}</h1>
              <div className="preview-grid">
                <section className="badge-card">
                  <h3>My badge</h3>
                  {qr && <img src={qr} alt="Sample badge code" />}
                  <p className="hint">Show this at registration and at each session door.</p>
                </section>
                <section className="session-box">
                  <h4>Registered sessions <span>{SAMPLE.registered.length}</span></h4>
                  <ul>{SAMPLE.registered.map((s) => <li key={s}>{s}</li>)}</ul>
                </section>
                <section className="session-box">
                  <h4>Sessions attended <span>{SAMPLE.attended.length}</span></h4>
                  <ul>{SAMPLE.attended.map((s) => <li key={s}>{s}</li>)}</ul>
                </section>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside className="profile">
        <div className="avatar" aria-hidden="true">SA</div>
        <h2>{SAMPLE.first} {SAMPLE.last}</h2>
        <p className="hint">{SAMPLE.email}</p>
        <ul className="stats">
          <li><i className="chip"><CalendarIcon /></i><span>Registered sessions</span><strong>{SAMPLE.registered.length}</strong></li>
          <li><i className="chip green"><CheckIcon /></i><span>Sessions attended</span><strong>{SAMPLE.attended.length}</strong></li>
        </ul>
      </aside>
    </div>
  );
}
