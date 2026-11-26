import { useEffect, useState } from 'react';
import { balanceDue, getOrder, hasTicket, meta } from '../api.js';
import { readCache, writeCache } from '../cache.js';

// Looks up the order behind a registration so the tag can tell paid from unpaid.
// The answer is cached for this visit. If the lookup is refused, the tag falls
// back to the registration status alone.
export function useOrder(eventId, attendee) {
  const orderId = attendee && hasTicket(attendee) ? meta(attendee, '_order_id') : '';
  const key = `order:${orderId}`;
  const [order, setOrder] = useState(() => (orderId ? readCache(key) : null));

  useEffect(() => {
    if (!orderId) return setOrder(null);
    const cached = readCache(key);
    setOrder(cached);
    let live = true;
    getOrder(eventId, orderId)
      .then((o) => {
        if (!live) return;
        writeCache(key, o);
        setOrder(o);
      })
      .catch(() => {});
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, orderId]);

  return order;
}

// Green: confirmed and paid. Amber: has a ticket but still owes for it
// (pay at registration or by check). Red: registered with no ticket at all.
export default function StatusTag({ attendee, order }) {
  const status = String(attendee.status || '').toLowerCase();
  if (!hasTicket(attendee)) {
    return status === 'confirmed' || status === 'new'
      ? <span className="status bad">Needs to purchase ticket</span>
      : <span className="status">{attendee.status || 'Unknown'}</span>;
  }
  if (balanceDue(order)) return <span className="status due">Outstanding balance</span>;
  if (status === 'confirmed') return <span className="status good">Confirmed</span>;
  return <span className="status">{attendee.status || 'Unknown'}</span>;
}
