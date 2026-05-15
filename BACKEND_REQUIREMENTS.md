# LDERLY Backend Requirements

This plan keeps the existing Firebase backend and adds production fields/workflows incrementally.

## Implemented Now

Booking requests now store structured funnel metadata in `bookings/byId/{bookingId}.requestDetails`:

- care recipient relationship and display name
- care need category
- exact service
- duration and price
- requested schedule
- care location
- pricing breakdown
- trust badges shown at review

The existing booking fields remain intact:

- `serviceType`
- `status`
- `customerId`
- `customerName`
- `caretakerId`
- `caretakerName`
- `scheduledFor`
- `notes`
- `timeline`

Care recipient onboarding now persists through the existing profile document:

- `profiles/{uid}.careRecipients.Mother`
- `profiles/{uid}.careRecipients.Father`
- `profiles/{uid}.careRecipients["Self / Others"]`
- legacy profile fields stay synced for current compatibility

Booking records now include production-facing metadata:

- `lifecycle`
  - current step
  - next step
  - allowed next statuses
  - last actor
- `matching`
  - required skills
  - preferred languages
  - city/zone
  - priority
  - preferred caretaker
  - assignment capacity
- `scheduleIndex`
  - date key
  - hour key
  - status key
  - city/zone
- `payment`
  - estimate
  - coordination fee
  - method
  - payment status
  - invoice id
- `familyUpdates`
  - in-app
  - WhatsApp
  - SMS
  - voice note
- `serviceReport`
  - report type
  - required sections
  - upload slots

Firebase-compatible operations indexes were added:

- `operations/bookingsByStatus`
- `operations/bookingsByDate`
- `operations/bookingsByZone`
- `operations/bookingsByCustomer`
- `operations/bookingsByCaretaker`

Notifications now include delivery metadata:

- `channel`
- `deliveryStatus`
- user/role indexes for scoped reads

Reports now generate service-specific summaries for:

- doctor visits
- lab support
- hospital attender support
- medicine help
- companionship
- daily support
- immediate assistance
- user indexes for scoped reads

Caretaker seed profiles now support matching-ready operations data:

- skills
- languages
- zones
- availability/status
- ratings
- punctuality score
- repeat visits
- assignment capacity

Trusted API scaffolding is now available for critical booking actions:

- `POST /api/bookings`
- `POST /api/bookings/{bookingId}/assign`
- `POST /api/bookings/{bookingId}/status`
- Firebase Admin support is environment-driven and falls back to client writes when Admin credentials are not configured.

Firebase auth role sync is now server-routable:

- `POST /api/auth/firebase-role`
- verifies Firebase ID tokens when Admin credentials are configured
- writes `users/{uid}` from trusted server code
- sets Firebase custom claims with `{ role }`
- returns client fallback mode locally until Admin credentials are added

Admin Ops login is now checked server-side:

- `POST /api/auth/admin`
- credentials are loaded from server-only environment variables

Caretaker Partner login is now checked server-side:

- `POST /api/auth/caretaker`
- credentials are loaded from server-only environment variables

Customer test login is now checked server-side:

- `POST /api/auth/customer`
- credentials are loaded from server-only environment variables

Role sessions now use a signed HTTP-only cookie:

- login routes issue `lderly_session`
- `POST /api/auth/logout` clears `lderly_session`
- `POST /api/bookings` requires customer/admin session
- `POST /api/bookings/{bookingId}/assign` requires admin session
- `POST /api/bookings/{bookingId}/status` requires caretaker/admin session
- unsigned direct calls are rejected before hitting booking logic

Production status checks are now available:

- `GET /api/system/status`
- Ops displays trusted-write mode, login readiness, and pending production items
- `npm run deploy:rules` deploys Realtime Database rules with Firebase Admin credentials
- stricter Firebase rules have been deployed and tracked by `.firebase-rules-deployed.json`
- `npm run smoke:production` validates the protected production flow end to end

Central API security scaffolding is now available:

- shared protected-route helper in `server/apiSecurity.ts`
- signed-session role checks reused across critical APIs
- device session registry under `deviceSessions`
- active-session verification for protected APIs
- logout-current-session and logout-all-devices routes
- same-origin CSRF-origin checks for browser mutations
- per-session/per-route in-memory rate limiting
- structured JSON request parsing and validation helpers
- trusted audit logs under `auditLogs/{id}`
- audit log reads are admin-only in Realtime Database rules
- Next.js proxy security headers
- app-level and global error boundaries

Caretaker KYC scaffolding is now available:

- `POST /api/caretaker/kyc/upload-url`
- supports Aadhaar, PAN, and face-verification placeholder uploads
- creates Firebase Storage signed upload URLs
- stores metadata under `caretakerKyc/byCaretaker/{caretakerId}`
- caretaker/admin access is protected by custom-claim database rules

Payment checkout scaffolding is now available:

- `POST /api/payments/checkout`
- creates a Razorpay order when `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are configured
- safely creates a mock authorization locally when Razorpay keys are absent
- `POST /api/payments/confirm` verifies Razorpay Checkout payment signatures before marking a booking paid
- `POST /api/webhooks/razorpay` verifies Razorpay webhook signatures when `RAZORPAY_WEBHOOK_SECRET` is configured
- booking payment state is updated through trusted server writes

WhatsApp/SMS dispatch scaffolding is now available:

- `POST /api/notifications/{notificationId}/dispatch`
- sends WhatsApp/SMS through Twilio when provider env vars are configured
- queues mock delivery locally when provider env vars are absent
- updates notification delivery metadata through trusted server writes

Geocoding and dispatch-zone scaffolding is now available:

- `POST /api/locations/geocode`
- resolves care addresses through Google Geocoding when the Maps API key is available
- falls back to Bengaluru zone heuristics locally
- trusted booking creation enriches `matching.city` and `matching.zone` before writing Firebase indexes

Voice-note upload scaffolding is now available:

- `POST /api/voice-notes/upload-url`
- creates Firebase Storage signed upload URLs for caretaker/admin voice notes
- records metadata under `voiceNotes/byId`, `voiceNotes/byBooking`, and `voiceNotes/byUser`
- falls back to a mock upload URL if storage is not configured

India-first operations scaffolding is now available:

- `POST /api/ops/alerts`
- routes SLA, emergency, incident, late check-in, and AI-risk alerts into internal ops queues
- supports Slack webhook delivery when configured, with Firebase queue fallback
- exposes WhatsApp Business, manual WhatsApp, MSG91, Exotel, Firebase push, and Twilio fallback readiness

Caretaker attendance scaffolding is now available:

- `POST /api/caretaker/attendance`
- records check-in, break start, break end, and check-out
- writes active shifts and shift history under `caretakerAttendance`
- keeps caretaker availability/status aligned with shift state

Push notification token registration is now available:

- `POST /api/notifications/push-token`
- stores web, Android, and iOS push tokens under `pushTokens`
- indexes tokens by user, role, and token for future Firebase Cloud Messaging delivery
- `POST /api/notifications/push-dispatch`
- sends Firebase Cloud Messaging pushes when Admin messaging is available
- queues delivery records under `pushDispatches` when tokens or messaging are not ready

Family-scoped report access is now available:

- `POST /api/reports/family-access`
- creates report grants for family members
- indexes grants under `reportAccess` and `reports/familyVisible`
- keeps existing report records unchanged

AI-ready report summaries are now available:

- `POST /api/reports/ai-summary`
- creates deterministic AI-placeholder family summaries from visit reports
- stores risk level, family headline, next best action, and caregiver quality signal
- writes under `aiSummaries` and mirrors the summary onto report records

Ops analytics now include:

- active shifts
- shift check-ins today
- completed shifts today
- average shift duration
- SLA healthy rate, breach rate, and at-risk booking count

Emergency escalation orchestration is now available:

- `POST /api/emergency/escalate`
- creates and advances escalation flows across customer, family, ops, ambulance, and hospital stages
- writes `emergencyEscalations` plus ops emergency queues
- dispatches internal ops alerts and customer push updates

Partner marketplace scaffolding is now available:

- `POST /api/partners`
- seeds hospital, ambulance, diagnostic lab, pharmacy, and physiotherapy partner records
- `POST /api/partners/dispatch`
- selects available partners by type, zone, SLA, and rating
- writes partner dispatch records and ops partner queues

Monthly / NRI report generation is now available:

- `POST /api/reports/monthly`
- summarizes completed visit reports by month
- stores visit counts, service breakdown, wellness signal, highlights, and PDF placeholder status
- designed for future PDF rendering and WhatsApp/email delivery

Finance operations scaffolding is now available:

- `POST /api/finance/invoice`
- generates GST-style invoice records with taxable amount, GST amount, line items, and PDF placeholder status
- `POST /api/finance/payout`
- creates caregiver payout and incentive records for ops reconciliation
- writes payout queues for manual bank-transfer processing

Recurring care subscriptions are now available:

- `POST /api/subscriptions`
- creates weekly/monthly subscription plan records
- links subscriptions to profiles and ops subscription queues

Care quality and safety operations are now available:

- `POST /api/care-quality/medication`
- creates medication schedules for saved care recipients
- records medication adherence as completed, due, missed, or skipped
- keeps the realtime health status aligned with medicine adherence
- escalates missed medicine events through ops alerts and push dispatch
- `POST /api/care-quality/incident`
- lets caretaker/admin users report safety, medical, service, fall-risk, or other incidents
- writes incident records plus admin incident queues for operational follow-up
- `POST /api/caretaker/training`
- lets admin users award caregiver training badges and verification credentials
- mirrors active badges onto caretaker profiles for future trust UI and assignment logic

Caregiver intelligence is now available:

- `GET /api/ops/caregiver-intelligence`
- calculates caregiver reliability scores from rating, punctuality, repeat visits, verification, training, assignment load, and availability
- returns recommended caregiver, watch counts, online count, and trust signals for ops dispatch
- designed as the first step toward automated caregiver matching and SLA-aware reassignment

Ops lifecycle and emergency command-center depth is now available:

- `POST /api/support/complaints/{complaintId}/status`
- lets admin users move complaints through open, ops review, action taken, and resolved states
- writes complaint action history and notifies the customer
- `POST /api/payments/refund/{refundId}/status`
- lets admin users move refund requests through requested, processing, processed, or failed states
- writes refund action history and customer updates
- `GET /api/ops/emergency-command`
- summarizes SOS queues, incidents, partner dispatches, critical bookings, internal alerts, escalation order, and next ops action

Startup-friendly platform optimization is now available:

- source-owned shadcn-style primitives for buttons, cards, badges, and skeleton states
- TanStack Query provider for future cache, dedupe, optimistic UI, and background refresh
- PostHog and Microsoft Clarity client adapters that remain dormant until keys are configured
- Sentry Next.js SDK instrumentation is prepared for client, server, edge, and error boundary capture
- Lottie runtime dependency is ready for premium, calm micro-interactions
- `POST /api/ai/reassurance`
- creates deterministic free AI-style reassurance messages for family wellbeing, service context, and next best action
- `STARTUP_ARCHITECTURE.md`
- documents the free-tier/current stack and AWS Activate future path

## Remaining Production Hardening

1. Complete Firebase Admin production setup
   - Trusted API routes exist.
   - Add Firebase Admin service-account environment variables before disabling direct client writes.

2. Harden roles
   - Trusted role sync route is implemented.
   - Add Firebase Admin credentials, then verify `/api/auth/firebase-role` returns `trusted-role-sync`.
   - Stricter `firebase.rules.json` is prepared to use `auth.token.role` custom claims.
   - Deploy the stricter database rules after validating Firebase login flows.

3. Connect real payment provider
   - Razorpay order creation and webhook routes are implemented.
   - Customer booking flow opens Razorpay Checkout when live keys are present.
   - Add Razorpay live/test keys and configure the webhook endpoint.

4. Connect WhatsApp/SMS/voice delivery
   - WhatsApp/SMS dispatch route is implemented.
   - Add Twilio credentials and sender numbers.
   - Voice-note signed upload route is implemented.
   - Voice-note playback UI still needs to be added to the live care feed.

5. Add real geocoding and zones
   - Geocoding route and trusted booking zone enrichment are implemented.
   - Production should validate Maps API restrictions and add a production Map ID.

6. Harden caretaker and family-member report access
   - Report and notification reads are now scoped by owner/role/admin indexes.
   - Before launch, add explicit family membership and assigned-caretaker report access.

7. Add production Google Maps Map ID
   - `LiveMap` now uses `google.maps.marker.AdvancedMarkerElement`.
   - Add `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` before production so markers run on a production vector map configuration instead of the demo map ID.
   - This is not currently blocking local usage, but should be handled before production polish.

## Pending Backend Dependencies

These are the external backend/provider dependencies that still need production setup, validation, or operational ownership. The application code has scaffolding for most of these, but the real provider configuration is what makes the flows truly production-grade.

1. Firebase production identity and security
   - Firebase Admin service account in Vercel env vars.
   - Firebase custom claims validation for customer, caretaker, admin, and future dispatcher/coordinator roles.
   - Firebase App Check production enforcement for web clients.
   - Realtime Database backup/export schedule.
   - Production audit-log retention policy.

2. Firebase Cloud Messaging
   - Web push/VAPID setup for customer and ops browser notifications.
   - Android FCM sender setup for future customer and caretaker apps.
   - Notification delivery monitoring and retry queue policy.

3. Razorpay production finance
   - Razorpay webhook secret.
   - Webhook URL configured in Razorpay dashboard.
   - Payment reconciliation job.
   - Refund reconciliation workflow.
   - Caregiver payout bank-transfer or payout-provider integration.
   - GST invoice PDF generation/storage.

4. India communication providers
   - WhatsApp Business provider setup.
   - MSG91 SMS/OTP fallback setup.
   - Exotel emergency calling setup.
   - Template approval for WhatsApp messages.
   - Delivery status webhook ingestion.

5. Maps and location
   - Production-restricted Google Maps API key.
   - Production Google Maps Map ID.
   - Places/autocomplete decision for address capture.
   - ETA/route provider decision for production route accuracy.

6. File and media storage
   - Firebase Storage production bucket confirmation.
   - Signed upload URL validation for Aadhaar, PAN, face placeholder, reports, and voice notes.
   - Storage rules hardening.
   - Virus/malware scanning provider or process for uploaded files.
   - Voice-note playback and retention policy.

7. Observability and product intelligence
   - Sentry production DSN and alert routing.
   - PostHog production project key.
   - Microsoft Clarity production project ID.
   - Error alert ownership and SLA.
   - Uptime monitoring for customer, partner, ops, and critical APIs.

8. Internal ops integrations
   - Slack ops webhook for emergency, incident, late-check-in, and SLA breach channels.
   - Support/ticketing provider decision for production customer support.
   - Admin audit-review operating process.

9. Deployment and environment operations
   - Vercel production environment variables reviewed and rotated.
   - Staging project/environment.
   - GitHub CI branch protection.
   - Rollback runbook.
   - Domain/DNS split for `app.lderly.in`, `partner.lderly.in`, and `ops.lderly.in`.
