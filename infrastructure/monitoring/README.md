# Monitoring

## Current Production Monitoring

Current runtime is Vercel + Firebase. Monitoring is handled by:

- Sentry for runtime exceptions.
- Product analytics for funnel and operational events.
- Microsoft Clarity for UX/session insight.
- Vercel runtime logs.
- Firebase console usage/security monitoring.
- `/api/system/status` for runtime dependency visibility.
- `/api/ops/readiness` for operational go-live status.

## Current Alert Priorities

Configure alerts in Sentry/Vercel/Firebase for:

- API 5xx spike.
- Payment checkout or confirmation errors.
- Razorpay webhook failures.
- Firebase Admin initialization failure.
- Firebase rules/security warnings.
- Booking creation failures.
- Caretaker assignment failures.
- GPS update failures.
- Ops readiness blockers.
- Unhandled frontend errors on `/`, `/partner`, and `/ops`.

## Future Container Monitoring

Prometheus/Grafana becomes relevant when long-running services are deployed:

- `api-gateway`
- `payment-service`
- `realtime-service`
- Postgres
- Redis

Until those services are live, Prometheus config is a future infrastructure artifact and should not be treated as active production monitoring.
