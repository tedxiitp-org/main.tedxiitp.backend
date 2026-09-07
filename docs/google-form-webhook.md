# Instant sync when someone submits the Google Form

The admin portal refreshes itself every 20 seconds while it is open. This webhook covers the
rest of the time: it tells the backend to pull the sheet the moment a form response lands, so
registrations appear even when nobody has the portal open.

## One-time setup

1. Open the Google **Sheet** that collects the form responses.
2. Go to **Extensions -> Apps Script**.
3. Replace the contents of `Code.gs` with the script below.
4. Set `BACKEND_URL` to your deployed backend and `SECRET` to the value of
   `SHEET_WEBHOOK_SECRET` from the backend `.env`.
5. Click the clock icon (**Triggers**) -> **Add Trigger**:
   - Function: `notifyBackend`
   - Event source: **From spreadsheet**
   - Event type: **On form submit**
6. Save and approve the permissions prompt.

```javascript
const BACKEND_URL = 'https://main-tedxiitp-backend-eight.vercel.app';
const SECRET = 'paste SHEET_WEBHOOK_SECRET here';

function notifyBackend() {
  try {
    UrlFetchApp.fetch(BACKEND_URL + '/api/registrations/hook', {
      method: 'post',
      headers: { 'x-sheet-secret': SECRET },
      muteHttpExceptions: true,
    });
  } catch (error) {
    console.error('Sync notification failed: ' + error);
  }
}
```

## Checking it works

Submit a test response to the form, then open the admin portal. The line under the heading
should read `Last updated <time> (form submit)`.

You can also call it directly:

```
curl -X POST https://<backend>/api/registrations/hook -H "x-sheet-secret: <secret>"
```

- `{"success":true,"data":{"ran":true,...}}` - synced
- `{"success":true,"data":{"ran":false,...}}` - a sync ran within the last 5 seconds, skipped
- `{"error":"Invalid webhook secret"}` - the secret does not match
- `{"error":"Webhook is not enabled..."}` - `SHEET_WEBHOOK_SECRET` is missing, or the backend
  was started before it was added. Restart the backend after editing `.env`.

## How the three layers fit together

| Layer | Covers | Delay |
| --- | --- | --- |
| Form submit webhook | New responses at any time | Immediate |
| Admin portal auto-refresh | While an admin has the page open | Up to 20 seconds |
| Sync now button | Anything the other two missed | Manual |

Repeated triggers are collapsed server-side: the webhook syncs at most once every 5 seconds
and the portal at most once every 20 seconds, so a burst of form submissions results in one
read of the sheet rather than many.
