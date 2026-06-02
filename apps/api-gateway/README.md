# apps/api-gateway

Staged Express API gateway for future service separation.

Current production API source of truth remains the Next.js `app/api` layer and server providers under `server/`. This gateway is intentionally staged so traffic can be migrated gradually without breaking the existing Vercel deployment.

## Current Capabilities

- `/health` service health check.
- `/metrics` lightweight operational counters.
- `/status` migration status.
- `/api/*` guarded proxy to the existing Next.js API.
- Optional Redis connectivity check through `REDIS_URL`.
- Optional Sentry error capture through `SENTRY_DSN`.
- Optional JWT enforcement for unsafe methods through `JWT_SECRET`.

## Runtime

```bash
pnpm --filter @lderly/api-gateway dev
pnpm --filter @lderly/api-gateway build
```

Required only when deploying the gateway separately:

- `API_GATEWAY_PORT`
- `NEXT_API_ORIGIN`
- `FRONTEND_ORIGIN`
- `JWT_SECRET`
- `REDIS_URL`
- `SENTRY_DSN`
