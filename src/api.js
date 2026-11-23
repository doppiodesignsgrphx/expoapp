// Thin client for the WP Event Manager REST API.
// Contract taken from request logs captured on staging, 2026-11-21 to 2026-11-23.

import { clearCache } from './cache.js';

const BASE = (import.meta.env.VITE_API_BASE || 'https://upgrade.doppiodesignsgrphx.com/wp-json/wpem').replace(/\/$/, '');

const TOKEN_KEY = 'expoapp.token';
const USER_KEY = 'expoapp.user';
const DEVICE_KEY = 'expoapp.device';

// The token is kept for this browser tab only (sessionStorage), on purpose.
// The plugin's token embeds the account password, so it must not be stored long term.
export const session = {
  get token() {
    return sessionStorage.getItem(TOKEN_KEY) || '';
  },
  get user() {
    try {
      return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  },
  save(token, user) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(user || {}));
  },
  clear() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    clearCache();
  },
};

export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).toUpperCase();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export class ApiError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
  }
}

// The API reports failures inside the body ("code": 418) while still answering HTTP 200,
// so the body code is what decides success.
async function request(path, { method = 'GET', query, json, form, auth = true } = {}) {
  const url = new URL(BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });

  const headers = { Accept: 'application/json' };
  if (auth && session.token) headers.Authorization = `Bearer ${session.token}`;

  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  } else if (form) {
    body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body });
  } catch {
    throw new ApiError('Could not reach the server. Check the connection and try again.', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    throw new ApiError(`The server sent an unreadable reply (HTTP ${res.status}).`, res.status);
  }

  const code = Number(data?.code ?? res.status);
  if (!res.ok || code >= 400) {
    if (code === 401 || res.status === 401) session.clear();
    throw new ApiError(data?.message || `Request failed (${code}).`, code);
  }
  return data?.data ?? data;
}

export async function login(username, password) {
  const data = await request('/applogin', { method: 'POST', json: { username, password }, auth: false });
  if (!data?.token) throw new ApiError('Sign-in did not return a token.', 0);
  session.save(data.token, data.user);
  return data.user;
}

// How many records to ask for per request. The site caps this (100 by default).
// If the cap is raised on the site, set VITE_PAGE_SIZE to match; the app falls
// back to 100 on its own if the site refuses the larger size.
const PAGE_SIZE = Math.max(1, Number(import.meta.env.VITE_PAGE_SIZE) || 100);

// Loads every page of a list. The first page tells us how many pages there are;
// the rest are fetched at the same time, a few at once.
async function fetchAll(path, query, listKey) {
  let size = PAGE_SIZE;
  let first;
  try {
    first = await request(path, { query: { ...query, per_page: size, page: 1 } });
  } catch (err) {
    if (size <= 100 || err.code === 401 || err.code === 0) throw err;
    size = 100;
    first = await request(path, { query: { ...query, per_page: size, page: 1 } });
  }
  const items = [...(first[listKey] || [])];
  const pages = Math.min(Number(first.total_pages || 1), 200);
  const rest = [];
  for (let page = 2; page <= pages; page += 1) rest.push(page);
  const results = new Array(rest.length);
  let next = 0;
  async function worker() {
    while (next < rest.length) {
      const i = next;
      next += 1;
      const data = await request(path, { query: { ...query, per_page: size, page: rest[i] } });
      results[i] = data[listKey] || [];
    }
  }
  await Promise.all(Array.from({ length: Math.min(6, rest.length) }, worker));
  results.forEach((list) => items.push(...list));
  return items;
}

export function listEvents({ search, withRegistrations } = {}) {
  return fetchAll(
    '/events',
    { search, registrations: withRegistrations ? true : undefined, status: search || withRegistrations ? undefined : 'publish' },
    'events'
  );
}

export function listAttendees(eventId) {
  return fetchAll(`/events/${eventId}/attendees`, {}, 'event_attendees');
}

export function getAttendee(eventId, attendeeId) {
  return request(`/events/${eventId}/attendees/${attendeeId}`);
}

// checkedIn = true checks the attendee in, false undoes it.
export function setCheckin(eventId, attendeeId, checkedIn) {
  return request(`/events/${eventId}/attendees/${attendeeId}/checkin`, {
    method: 'POST',
    query: { force: checkedIn ? 'true' : 'false', checkin_source: 'app', checkin_device_id: deviceId() },
  });
}

// Check in from a stock ticket QR code ("event-order-attendee").
export function checkinByTicketCode(eventId, attendeeId, code) {
  return request(`/events/${eventId}/attendees/${attendeeId}/qrcode/${encodeURIComponent(code)}`, {
    method: 'POST',
    form: { code, checkin_source: 'app', checkin_device_id: deviceId(), checkin_device_name: 'expoapp' },
  });
}

// Helpers for reading an attendee record.
export const meta = (attendee, key) => attendee?.meta_data?.[key] ?? '';
export const fullName = (a) => [meta(a, '_attendee_name') || a?.name, meta(a, '_attendee_last_name')].filter(Boolean).join(' ');
export const isCheckedIn = (a) => String(meta(a, '_check_in')) === '1';
export const uniqueId = (a) => String(meta(a, '_attendee_unique_id') || '').toUpperCase();
export const ticketCode = (eventId, a) => `${eventId}-${meta(a, '_order_id')}-${a.id}`;

// What gets encoded on the badge: the random badge code when the site has issued one,
// otherwise the stock ticket code.
export const badgeCode = (eventId, a) => uniqueId(a) || ticketCode(eventId, a);

// A copy of an attendee with its check-in state changed, for updating the
// screen at once without waiting to re-read the record.
export function withCheckin(attendee, checkedIn) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return {
    ...attendee,
    meta_data: {
      ...attendee.meta_data,
      _check_in: checkedIn ? '1' : '0',
      _checkin_time: checkedIn ? stamp : attendee.meta_data?._checkin_time,
    },
  };
}
