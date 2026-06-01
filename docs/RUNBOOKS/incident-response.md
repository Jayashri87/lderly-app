# Incident Response Runbook

1. Check Sentry for current error spikes.
2. Check Vercel deployment status and runtime logs.
3. Check Firebase availability and rules status.
4. Use `/api/monitoring/snapshot` for app health.
5. Use `/api/ops/runbook` for current operational readiness.
6. If production is degraded after a deploy, roll back from Vercel deployment history.
