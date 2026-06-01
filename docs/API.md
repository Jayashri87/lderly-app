# LDERLY API

Current APIs are implemented as Next.js route handlers under `app/api`.

Primary domains:

- Auth: `app/api/auth/*`
- Bookings: `app/api/bookings/*`
- Payments: `app/api/payments/*`
- Care quality: `app/api/care-quality/*`
- Ops: `app/api/ops/*`
- Notifications: `app/api/notifications/*`
- Reports: `app/api/reports/*`

Detailed OpenAPI generation is a future step after schemas are centralized in `packages/validation-schemas`.
