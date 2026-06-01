# Deployment

Current production:

- Vercel project: `lderly-app`
- Production URL: `https://lderly-app.vercel.app`
- Package manager: pnpm
- CI: GitHub Actions production validation

Local validation:

```powershell
pnpm install --frozen-lockfile
pnpm run audit:deps
pnpm run audit:secrets
pnpm run lint
pnpm run build
```

Production deploy:

```powershell
npx vercel --prod --yes
```
