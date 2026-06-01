# LDERLY Architecture

LDERLY is currently deployed as a Next.js application with Firebase-backed server APIs.

## Current Runtime

- Root Next.js app: customer, partner, ops, superadmin, and API routes.
- Firebase Admin: trusted backend writes.
- Firebase Realtime Database: booking, tracking, ops, reports, and analytics state.
- Vercel: production hosting.

## Target Monorepo

- `apps/web`: customer app.
- `apps/admin`: operations dashboard.
- `apps/api-gateway`: optional gateway for service APIs.
- `apps/mobile`: mobile apps.
- `packages/*`: reusable shared contracts and utilities.
- `services/*`: domain service packages.
- `infrastructure/*`: deployment and monitoring infrastructure.

Migration is intentionally phased to avoid breaking current production routing.
