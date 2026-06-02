# Deployment

Current production:

- Vercel project: `lderly-app`
- Production URL: `https://lderly-app.vercel.app`
- Package manager: pnpm
- CI: GitHub Actions production validation

Local validation:

```powershell
pnpm install --frozen-lockfile
pnpm run ci:validate
```

Production deploy:

```powershell
npx vercel --prod --yes
```

## Pre-Deploy Checklist

- `pnpm run audit:deps`
- `pnpm run audit:secrets`
- `pnpm run audit:performance`
- `pnpm run format:check`
- `pnpm run lint`
- `pnpm run typecheck:packages`
- `pnpm run build`
- `pnpm run ci:smoke`

## Post-Deploy Checklist

- Confirm production URL: `https://lderly-app.vercel.app`.
- Check Sentry for new errors.
- Check `/api/system/status`.
- Check `/api/ops/readiness` from an authorized ops session.
- Validate customer lead capture.
- Validate customer login and booking funnel.
- Validate payment terms modal and Razorpay checkout creation.
- Validate caretaker `/partner` actions.
- Validate ops `/ops` visibility.

## Rollback

Use Vercel deployment history to promote the last known-good deployment.

Rollback is preferred over hot-fixing when:

- login fails
- booking creation fails
- payment confirmation fails
- caretaker actions fail
- ops dashboard cannot load
- Sentry shows a broad production spike after deploy

## Runtime Boundaries

The production app currently deploys as a single Vercel Next.js runtime. The `apps/*`, `services/*`, and `infrastructure/*` folders are phased architecture boundaries, not separate production deployments yet.
