#!/usr/bin/env sh
set -eu

pnpm run audit:deps
pnpm run audit:secrets
pnpm run lint
pnpm run typecheck:packages
pnpm run build
npx vercel --prod --yes
