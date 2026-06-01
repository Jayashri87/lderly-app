# LDERLY Apps

This folder is the target runtime boundary for separately deployable frontends and gateways.

Current production still runs from the repository root Next.js app to avoid a routing/deployment break.

Planned migration:

- `apps/web` - customer-facing Next.js app.
- `apps/admin` - operations dashboard extracted from `app/ops`.
- `apps/api-gateway` - API gateway if/when Next.js API routes need a separate runtime.
- `apps/mobile` - React Native/Expo mobile workspace. Current caregiver app remains in `mobile/caregiver-android`.
