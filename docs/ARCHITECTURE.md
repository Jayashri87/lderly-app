# LDERLY Architecture

LDERLY is an elder care operating system for Indian families. The production goal is realtime family reassurance, caregiver coordination, emergency readiness, and operational control.

## Current Runtime

- Root Next.js app on Vercel.
- Customer app at `/`.
- Caretaker app at `/partner`.
- Ops/admin app at `/ops`.
- Superadmin app at `/superadmin`.
- Next.js API routes under `/api/*`.
- Firebase Admin SDK for trusted backend writes.
- Firebase Realtime Database for bookings, dispatch, tracking, care updates, reports, audit logs, and analytics.
- Razorpay integration for checkout, confirmation, webhook verification, and refund workflow stubs.
- Google Maps/Routes integration for geocoding, ETA, and live map presentation.
- Sentry, product analytics, Microsoft Clarity, and ops readiness APIs for observability.

## Current Backend Boundaries

The current production backend is intentionally not split into independently deployed microservices yet. Domain code is grouped as server/provider modules and service packages:

- `server/trustedBooking.ts`: trusted booking lifecycle, dispatch, OTP start, completion verification, GPS updates.
- `server/paymentProvider.ts`: Razorpay order creation, signature verification, payment fetch validation.
- `server/locationProvider.ts`: geocoding, route ETA, location enrichment.
- `server/observability.ts`: ops KPIs, funnel analytics, SLA signals.
- `server/realtimeAccess.ts`: realtime tracking access policy.
- `services/*`: client-side domain services.
- `packages/*`: shared contracts and utilities.

## Monorepo Structure

- `apps/web`: target customer web app boundary.
- `apps/admin`: target operations dashboard boundary.
- `apps/api-gateway`: future API gateway boundary.
- `apps/mobile`: future mobile app boundary.
- `packages/shared-types`: shared TypeScript types.
- `packages/validation-schemas`: Zod schemas and app-state reducer.
- `packages/analytics`: event helpers.
- `packages/payment`: payment validation helpers.
- `services/*`: target domain service packages.
- `infrastructure/*`: deployment, migration, and monitoring artifacts.

The current root app remains the production runtime. Migration into `apps/*` is phased to avoid breaking Vercel routing and Firebase-backed flows.

## Realtime Architecture

Current production realtime path:

1. Caretaker device posts GPS to `/api/caretaker/location`.
2. API verifies signed session and booking access.
3. Trusted backend updates Firebase booking tracking state.
4. Customer and ops UI receive Firebase/SSE-driven route updates.
5. `/api/locations/route-stream` streams ETA updates to authorized booking participants.

Future scale path:

- Dedicated realtime service using WebSocket/Socket.IO.
- Redis adapter for multi-instance fan-out.
- JWT or signed-session bridge for socket auth.
- Separate metrics endpoint for connected clients, rooms, lag, and message rate.
- Hosted on an always-on runtime such as AWS ECS/Fargate, EC2, Fly.io, or Render.

## Payment Architecture

Current payment path:

1. Customer confirms care.
2. API creates a Razorpay order server-side from booking data.
3. Customer completes Razorpay checkout.
4. API verifies signature.
5. API fetches Razorpay payment server-side.
6. API validates order ID, currency, amount, and payment status.
7. Booking payment state is updated only after validation.
8. Razorpay webhook verifies provider signature before applying payment completion events.

Future scale path:

- Dedicated payment service.
- Durable reconciliation job.
- Redis-backed idempotency/rate limiting.
- Postgres payment session table.
- Payout ledger and refund reconciliation tables.

## Data Architecture

Current source of truth:

- Firebase Realtime Database.

Future reporting/scale target:

- Postgres/Supabase schema under `infrastructure/postgres/migrations`.
- First use should be analytics/reporting replication.
- Core booking writes should migrate only after dual-write validation and rollback planning.

## Security Model

- Signed role sessions for customer, caretaker, admin, and superadmin.
- API route authorization through `requireApiSession`.
- Firebase Admin writes for trusted mutations.
- App Check support prepared for production enforcement.
- Payment signature and webhook verification.
- Realtime booking tracking access checks for customer/caretaker/admin isolation.
- Secret exposure audit in CI.

## Deployment Model

Current:

- Vercel production deployment.
- GitHub main branch.
- pnpm workspace tooling.
- CI validation script: `pnpm run ci:validate`.

Future:

- Root web app remains on Vercel.
- Long-running realtime/payment workers move to container runtime if needed.
- Monitoring stack can be Prometheus/Grafana for containerized services.
