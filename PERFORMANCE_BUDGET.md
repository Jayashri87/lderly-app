# LDERLY Performance Budget

This budget defines the minimum launch bar for the customer, partner, and ops web apps.

## Core Targets

| Metric | Current Estimate | Launch Target | Why It Matters |
| --- | ---: | ---: | --- |
| First Contentful Paint | ~3.5s | <2.0s | User perception and trust |
| Time to Interactive | ~5.2s | <3.0s | Booking conversion |
| Largest Contentful Paint | ~4.1s | <2.5s | Core Web Vital |
| Cumulative Layout Shift | Unknown | <0.1 | Visual stability |
| API request rate per user | 4-6/min | <1/min idle, <2/min active tracking | Server load |
| Initial JS bundle | ~450KB | <300KB | Low-end Android performance |

## Current Optimizations Applied

- Google Maps is lazy-loaded behind `components/LiveMap.tsx` so map libraries do not block the initial route bundle.
- Route ETA polling is reduced from 15s/45s to 30s active tracking and 60s non-critical tracking.
- Live route updates use `/api/locations/route-stream` SSE when a booking ID exists, with polling kept only as fallback.
- ETA polling is disabled for states where routing is not useful.
- Google encoded polylines are decoded on the server; clients receive coordinate arrays to avoid map-thread CPU spikes.
- Decoded route responses use Redis REST cache when configured, with safe in-memory fallback.
- Caregiver marker animation skips tiny GPS movements under 10 meters.
- Route origin/destination objects are memoized to avoid unnecessary effect restarts.
- React Query defaults now favor less aggressive refetching for stable operational data.
- Lenis smooth scrolling is disabled for coarse pointer, reduced motion, and low-power devices.
- Next.js image optimization is configured for AVIF/WebP.

## Next Required Measurements

Run these before every launch candidate:

```bash
npm run build
npm run health:routes
npx playwright test tests/e2e/lderly.production.spec.ts --project=desktop-chromium
```

For Lighthouse/Web Vitals, run against production after deploy:

```bash
npx lighthouse https://lderly-app.vercel.app --view
```

Track:

- `/signin` registration funnel
- `/login` customer login
- `/` customer app
- `/partner` caregiver portal
- `/ops` ops dashboard
- `/superadmin` owner login

## Guardrails

- Heavy visual modules must be dynamically imported.
- Realtime polling must be justified by user-visible value.
- Idle screens should not poll faster than once per minute.
- Active tracking screens should prefer provider push/realtime subscriptions or SSE over polling where available.
- Any new map, animation, or AI widget must include a loading state and reduced-motion fallback.
