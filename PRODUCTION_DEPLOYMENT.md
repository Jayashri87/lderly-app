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
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID`
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_CLARITY_ID`
- `NEXT_PUBLIC_MIXPANEL_TOKEN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `NEXT_PUBLIC_VERCEL_ENV`

Do not set `NEXT_PUBLIC_FIREBASE_APP_CHECK_DEBUG_TOKEN` in production. It is only for local App Check debugging.

Server-only app credentials:

- `LDERLY_ADMIN_USERNAME`
- `LDERLY_ADMIN_PASSWORD`
- `LDERLY_CARETAKER_USERNAME`
- `LDERLY_CARETAKER_PASSWORD`
- `LDERLY_CUSTOMER_USERNAME`
- `LDERLY_CUSTOMER_PASSWORD`
- `LDERLY_AUTH_SECRET`
- `CRON_SECRET`

Firebase Admin service account:

- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

Google Workspace automation:

- `GOOGLE_WORKSPACE_PROJECT_ID`
- `GOOGLE_WORKSPACE_CLIENT_EMAIL`
- `GOOGLE_WORKSPACE_PRIVATE_KEY`
- `GOOGLE_SHEETS_LEADS_SPREADSHEET_ID`
- `GOOGLE_CALENDAR_OPS_CALENDAR_ID`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`
- `GOOGLE_DOCS_MONTHLY_REPORT_TEMPLATE_ID`

Google Workspace is optional and fails closed. When configured, customer registration leads sync to Google Sheets, care bookings create Google Calendar events, and monthly family reports copy a Google Docs template into Drive.

Google setup requirements:

1. Enable Google Sheets API, Google Calendar API, Google Drive API, and Google Docs API in Google Cloud.
2. Create a service account and store its JSON values in Vercel env vars.
3. Share the lead Sheet, ops Calendar, Drive folder, and Docs template with the service account email.
4. Use these report template tokens in the Docs template: `{{MONTH}}`, `{{USER_ID}}`, `{{TOTAL_VISITS}}`, `{{WELLNESS_SIGNAL}}`, `{{FAMILY_HEADLINE}}`, `{{AI_NARRATIVE}}`, `{{TOP_NEXT_ACTIONS}}`, `{{HIGHLIGHTS}}`.

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

## Secrets And Environment Security

Pre-launch rotation required:

- Rotate the Vercel access token previously used during setup.
- Rotate Razorpay key secret and webhook secret before taking real payments.
- Rotate Firebase Admin service-account private key and delete the old service-account key.
- Rotate role login passwords and `LDERLY_AUTH_SECRET`.
- Rotate analytics/provider keys that were shared outside provider dashboards.
- Restrict Google Maps API key by HTTP referrer and enabled APIs.

Environment scoping:

- Server-only secrets must exist only as Vercel encrypted environment variables.
- Production secrets should be scoped to Production only unless a separate staging provider/resource is configured.
- Preview and Development should use separate Firebase/Razorpay/Maps/test credentials.
- Never create `NEXT_PUBLIC_*` variables for passwords, secrets, private keys, auth tokens, webhook secrets, or service-account material.

Automated checks:

```bash
npm run audit:secrets
npm run verify:env
```

`npm run audit:secrets` blocks committed secret patterns and unapproved browser-exposed env vars. `npm run verify:env` blocks production App Check debug tokens and secret-like `NEXT_PUBLIC_*` names.

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
- ops maintenance cleanup removes expired locks, old replay records, and old recovery signals
- backup manifest generation records critical RTDB export counts
- notification retry policy updates queued/failed delivery attempts

## Automated Maintenance

`vercel.json` schedules `/api/ops/maintenance` daily at 20:15 UTC, which is 01:45 India time.

The endpoint performs production hygiene:

- removes expired booking mutation locks
- removes expired idempotency/replay records
- removes old recovery queue signals
- writes a maintenance run into the ops audit ledger

Before enabling the cron in production, set `CRON_SECRET` in Vercel. Vercel Cron sends it as:

```text
Authorization: Bearer <CRON_SECRET>
```

Ops admins can also run the cleanup manually with a signed admin session:

```bash
POST /api/ops/maintenance
```

## Backup Readiness

LDERLY now exposes an admin-only backup manifest route:

```bash
POST /api/ops/backups
GET /api/ops/backups
```

The manifest does not replace a real Firebase export. It records the critical RTDB paths and record counts that must be included in the external backup process:

- `bookings/byId`
- `caretakers`
- `users`
- `reports/byId`
- `notifications/byId`
- `auditLogs`
- support, refund, and incident queues

Production still needs an external export destination, such as scheduled Firebase export to Google Cloud Storage or a managed backup process.

## Go-Live Readiness Gate

Ops can verify launch readiness with:

```bash
GET /api/ops/readiness
```

The snapshot checks:

- Firebase Admin trusted backend
- strict Firebase rules marker
- signed session secret
- latest ops maintenance run
- latest backup manifest
- cron secret
- Google Maps production config
- Sentry/PostHog observability

`goLiveReady` becomes true only when blocker checks are clear. Warning checks should still be resolved before paid launch.

## Audit Retention

Ops can run and inspect audit retention with:

```bash
POST /api/ops/audit-retention
GET /api/ops/audit-retention
```

Retention policy:

- default operational/API logs: 90 days
- booking/auth/session/recovery/backup logs: 180 days
- failure, emergency, payment, refund, KYC, and incident logs: 365 days

Expired logs are moved into `operations/auditRetention/archive/{runId}` with a retention manifest.

## Incident And Rollback Runbook

Ops can read a launch/incident runbook snapshot with:

```bash
GET /api/ops/runbook
```

The runbook summarizes:

- launch state: `ready`, `watch`, or `blocked`
- go-live blockers and warnings
- critical recovery queue count
- latest backup, maintenance, and audit-retention manifests
- rollback steps for Vercel and Firebase rules
- customer communication guidance

## App Check And Upload Safety

App Check readiness is exposed through `/api/system/status` and `/api/monitoring/snapshot`.

The web app initializes Firebase App Check with reCAPTCHA Enterprise and automatically attaches `X-Firebase-AppCheck` to same-origin `/api/*` requests. Protected API middleware verifies that token when `LDERLY_ENFORCE_APP_CHECK=true`.

Staged enforcement:

1. Configure `NEXT_PUBLIC_FIREBASE_APP_CHECK_SITE_KEY`.
2. Confirm App Check request metrics in Firebase for Realtime Database, Storage, and custom API traffic.
3. Validate customer, ops, and partner web E2E flows with valid App Check tokens.
4. Add native App Check token forwarding for the Android caretaker app before enforcing APIs used by the APK.
5. Set `LDERLY_ENFORCE_APP_CHECK=true` only after production clients are sending valid tokens.
6. Enable Firebase Console enforcement for Realtime Database and Storage after metrics show legitimate traffic is verified.

Upload safety:

- KYC uploads and voice-note uploads now include malware-scan metadata.
- KYC approval is blocked until the KYC document scan status is `clean`.
- Voice notes are not trusted for playback until scan status is `clean`.
- Ops can update scan status with `POST /api/ops/upload-safety`.

## Health Monitoring

Admins can read:

```bash
GET /api/monitoring/snapshot
```

The health snapshot includes:

- Firebase Admin status
- App Check readiness
- active bookings
- critical recovery signals
- queued/failed notifications
- stale GPS bookings
- pending upload scans
- latest backup, maintenance, and audit retention manifests

## E2E QA Gate

Before launch, run:

```bash
npm run e2e:prod
```

Then complete the LambdaTest real-device checklist in `E2E_QA_RUNBOOK.md`.

The automated E2E suite verifies public lead capture, customer shell, caretaker portal, ops portal, mobile overflow, system status, and go-live readiness.

## Notification Retry Policy

Notification dispatch now records:

- delivery attempts
- provider reference
- last attempt timestamp
- retry due timestamp
- delivery target when provided

Ops can process due retries with:

```bash
POST /api/notifications/retry
```

Retries stop after three attempts and are visible through audit/operations records.

After Firebase Admin is configured, sign in with a Firebase customer account once and confirm `/api/auth/firebase-role` returns `trusted-role-sync`. This activates server-owned `users/{uid}` role writes and Firebase custom claims.

## Customer Interest Capture

The public customer entry page currently works as a premium lead-capture funnel, not an instant self-service login.

Required fields:

- Name
- Phone number
- Email ID

The form posts to `/api/leads/customer` and stores the inquiry under `customerLeads/{leadId}` when Firebase Admin is configured. The intended operating flow is: capture contact details, LDERLY team calls the family, verifies the care need, then creates the customer ID and password for the next step.

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
