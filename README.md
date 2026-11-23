# expoapp

Web app for the NC EMS Expo. It talks to the WP Event Manager REST API on the Expo WordPress site.

## Status

First working piece, for registration staff:

1. Sign in with a WordPress staff account
2. Choose an event
3. Scan a badge or ticket QR code, or find an attendee by name, email or badge code
4. Check in, or undo a check-in
5. Print a badge on a Brother QL-820NWB (62mm continuous roll) through the browser print dialog

Registration computers can also run the desktop app in `desktop/`, which shows this same app in its own window and prints badges straight to the printer with no dialog.

Not built yet: attendee sign-in and schedule, session scanning for CE credit, payments, offline queue, leadership dashboard.

## Run it

```
npm install
npm run dev      # local development at http://localhost:5173
npm run build    # production build into dist/
```

Hosting settings: build command `npm run build`, output directory `dist`.

## Configuration

The API address defaults to the staging site. To point somewhere else, set `VITE_API_BASE` (see `.env.example`).

No keys, passwords or tokens belong in this repository.

## WordPress side

`wordpress/` holds the snippets the site needs. They are kept here for version history and are added to the site through Code Snippets.

| File | Purpose |
|---|---|
| `oems-expo-cors.php` | Lets the app's address call the site's API. Required, or the browser blocks every list request. Add the app's address inside it. |
| `oems-badge-code.php` | Gives each registration a random 16-character badge code in `_attendee_unique_id`. |

## Notes

- The sign-in token issued by the plugin contains the account password and never expires. The app keeps it for the current browser tab only. Use a dedicated staff account for testing, not an administrator.
- The API reports some failures inside the response body while answering HTTP 200. `src/api.js` reads the body code.
- A badge QR holds the random badge code when one exists, otherwise the stock ticket code (`event-order-attendee`).
