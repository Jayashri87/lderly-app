# LDERLY Production Deployment Checklist

## Current Status

- Customer, caretaker, and admin login routes exist.
- Signed HTTP-only role sessions are active.
- Trusted booking API routes exist.
- Firebase client fallback remains enabled until Firebase Admin credentials are configured.

## Required Environment Variables

Public client variables:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`

Server-only app credentials:

- `LDERLY_ADMIN_USERNAME`
- `LDERLY_ADMIN_PASSWORD`
- `LDERLY_CARETAKER_USERNAME`
- `LDERLY_CARETAKER_PASSWORD`
- `LDERLY_CUSTOMER_USERNAME`
- `LDERLY_CUSTOMER_PASSWORD`
- `LDERLY_AUTH_SECRET`

Firebase Admin service account:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Payment provider:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

WhatsApp/SMS provider:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM`
- `TWILIO_WHATSAPP_FROM`

For `FIREBASE_ADMIN_PRIVATE_KEY`, keep newline escapes as `\n` when storing in an env dashboard.

## Verification

Run:

```bash
npm run verify:env
npm run lint
npm run build
npm run smoke:production
```

Then check:

```bash
GET /api/system/status
```

Expected production result:

- `firebaseAdmin.configured: true`
- `firebaseAdmin.mode: trusted-writes-active`
- signed sessions ready
- all role credentials ready
- `productionReadiness.serverRoleSyncRoute: true`
- `productionReadiness.paymentCheckoutRoute: true`
- `productionReadiness.paymentConfirmRoute: true`
- `productionReadiness.notificationDispatchRoute: true`
- `productionReadiness.geocodingRoute: true`
- `productionReadiness.voiceNoteUploadRoute: true`
- `productionReadiness.stricterRulesDeployed: true`

The smoke test validates:

- unsigned callers are rejected
- customer, admin, and caretaker sessions are issued
- customer booking creation works through trusted routes
- dispatch-zone enrichment persists
- admin assignment works
- caretaker status transitions work
- Razorpay order creation returns a checkout payload
- voice-note upload URL generation works
- signed geocoding works

After Firebase Admin is configured, sign in with a Firebase customer account once and confirm `/api/auth/firebase-role` returns `trusted-role-sync`. This activates server-owned `users/{uid}` role writes and Firebase custom claims.

## Firebase Rules

Deploy `firebase.rules.json` after reviewing the project target.

Before public launch:

- verify role ownership through Firebase custom claims or server-owned writes
- validate the deployed `firebase.rules.json` against customer, caretaker, and admin login flows
- disable broad direct client writes for booking assignment/status
- keep customer booking creation routed through trusted API
- keep report and notification reads scoped by owner/role/admin

## Pending Integrations

- Razorpay keys and webhook secret
- Twilio WhatsApp/SMS provider credentials deferred
- Voice-note playback UI in live care feed
- Validate Google Geocoding API restrictions and zone mapping
- Production Google Maps Map ID for vector-map advanced markers
