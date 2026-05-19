# LDERLY E2E QA Runbook

## Goal

Use this runbook before production launch and before major releases to verify the real customer, caretaker, and ops experience across desktop and mobile browsers.

## Automated Route Checks

Install Playwright browsers once:

```bash
npx playwright install
```

Run against local dev:

```bash
npm run e2e
```

Run against production:

```bash
npm run e2e:prod
```

Optional custom URL:

```bash
$env:E2E_BASE_URL="https://your-preview-url.vercel.app"; npx playwright test
```

The automated suite checks:

- public lead funnel readability
- mobile horizontal overflow
- customer app authenticated shell
- caretaker portal authenticated shell
- ops portal authenticated shell
- system status API
- go-live readiness API

Required env values:

- `LDERLY_ADMIN_USERNAME`
- `LDERLY_ADMIN_PASSWORD`
- `LDERLY_CARETAKER_USERNAME`
- `LDERLY_CARETAKER_PASSWORD`
- `LDERLY_CUSTOMER_USERNAME`
- `LDERLY_CUSTOMER_PASSWORD`

## LambdaTest Manual Real-Device QA

Use LambdaTest Real Device Cloud for the final pre-launch pass.

Recommended devices:

- iPhone SE / Safari
- iPhone 15 / Safari
- Samsung Galaxy S23 / Chrome
- Pixel 7 / Chrome
- iPad / Safari

Test URL:

```text
https://lderly-app.vercel.app
```

Manual checks:

- lead form submits with name, phone, email
- call button opens dialer
- customer flow reaches booking confirmation/order creation
- caregiver `/partner` actions are tappable
- ops `/ops` actions are tappable
- maps load and resize
- no text overlap on small screens
- no broken scrolling
- session survives refresh

## Critical Failure Scenarios

Run these before paid launch:

- expired caregiver offer
- double tap accept/cancel/status
- wrong customer OTP
- caregiver cancels after accepting
- stale GPS warning
- failed notification retry
- expired lock cleanup
- revoked caretaker session blocked

## Pass Criteria

Launch only when:

- `npm run lint` passes
- `npm run build` passes
- `npm run ci:smoke` passes
- `npm run e2e:prod` passes on desktop and mobile emulation
- LambdaTest manual real-device pass has no blocker bugs
- `/api/ops/readiness` has zero blockers

## Bug Severity

- Blocker: booking, OTP, payment/order, caregiver action, ops recovery, or login cannot complete.
- High: mobile page is unusable, map fails, critical CTA hidden, session breaks.
- Medium: copy/layout issue that does not block the flow.
- Low: cosmetic polish.
