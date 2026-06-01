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
pnpm run e2e
```

Run against production:

```bash
pnpm run e2e:prod
```

Run lightweight production route/cache health:

```bash
pnpm run health:routes
```

Optional custom URL:

```bash
$env:E2E_BASE_URL="https://your-preview-url.vercel.app"; pnpm exec playwright test
$env:ROUTE_HEALTH_BASE_URL="https://your-preview-url.vercel.app"; pnpm run health:routes
```

The automated suite checks:

- protected APIs reject unsigned callers
- legal/payment policy pages are reachable
- public lead funnel readability
- mobile horizontal overflow
- customer app authenticated shell
- caretaker portal authenticated shell
- ops portal authenticated shell
- system status API
- go-live readiness API

The route health check verifies:

- public app routes return 2xx
- API status route returns production readiness JSON
- runtime routes use `no-store`
- `X-LDERLY-Build` is present and consistent across checked routes
- HTML responses include the LDERLY app marker

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

## Accessibility QA

Keyboard checks:

- `Tab` reaches every visible button, link, input, dialog close action, and bottom navigation item.
- `Shift + Tab` moves backward without trapping focus outside active modals.
- `Enter` or `Space` activates focused buttons.
- Focus is visibly outlined on dark and light surfaces.
- Bottom navigation targets are at least 44 x 44 CSS pixels.

Screen reader checks:

- Customer bottom navigation announces as "Main navigation".
- Active bottom tab announces the current page.
- Icon-only controls announce a clear action such as "Show password", "Call caregiver", or "Message caregiver".
- Payment terms modal announces heading and action buttons in order.
- Form inputs announce their visible labels and validation messages.

Contrast checks:

- Inactive navigation text remains readable on the dark glass background.
- Secondary helper text is not used for critical instructions.
- Disabled states are visibly disabled but still legible enough to explain why the action is unavailable.

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

- `pnpm run lint` passes
- `pnpm run build` passes
- `pnpm run audit:secrets` passes
- `pnpm run health:routes` passes
- `pnpm run ci:smoke` passes
- `pnpm run e2e:prod` passes on desktop and mobile emulation
- LambdaTest manual real-device pass has no blocker bugs
- `/api/ops/readiness` has zero blockers

## Bug Severity

- Blocker: booking, OTP, payment/order, caregiver action, ops recovery, or login cannot complete.
- High: mobile page is unusable, map fails, critical CTA hidden, session breaks.
- Medium: copy/layout issue that does not block the flow.
- Low: cosmetic polish.
