// Line icons in the style of the design template (24px grid, 2px stroke).
const base = { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const make = (children) => (props) => <svg {...base} {...props}>{children}</svg>;

export const HomeIcon = make(<><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></>);
export const CheckIcon = make(<><path d="M9 11l3 3 8-8" /><path d="M20 12v7a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h10" /></>);
export const UsersIcon = make(<><path d="M17 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9.5" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
export const CalendarIcon = make(<><rect x="3" y="4" width="18" height="17" /><path d="M16 2v4M8 2v4M3 10h18" /></>);
export const CardIcon = make(<><rect x="2" y="5" width="20" height="14" /><path d="M2 10h20" /></>);
export const ChartIcon = make(<><path d="M5 20V10M12 20V4M19 20v-7" /></>);
export const BellIcon = make(<><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>);
export const SettingsIcon = make(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>);
export const PrinterIcon = make(<><path d="M6 9V3h12v6" /><path d="M6 18H4a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2" /><rect x="6" y="14" width="12" height="7" /></>);
export const LogOutIcon = make(<><path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>);
export const SearchIcon = make(<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>);
export const BackIcon = make(<path d="M15 5l-7 7 7 7" />);
export const RefreshIcon = make(<><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 4v7h-7" /></>);
export const ScanIcon = make(<><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M8 12h8" /></>);
export const UserIcon = make(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>);
export const LockIcon = make(<><rect x="4" y="11" width="16" height="10" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>);
export const MenuIcon = make(<path d="M3 6h18M3 12h18M3 18h18" />);
export const CloseIcon = make(<path d="M6 6l12 12M18 6L6 18" />);
export const ListIcon = make(<><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>);
export const TicketIcon = make(<><path d="M3 9V6a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a3 3 0 0 0 0 6v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a3 3 0 0 0 0-6z" /><path d="M14 5v14" strokeDasharray="2 3" /></>);
export const MailIcon = make(<><rect x="3" y="5" width="18" height="14" /><path d="M3 7l9 6 9-6" /></>);
export const KeyIcon = make(<><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16 7l3 3" /></>);
export const PlusIcon = make(<><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>);
