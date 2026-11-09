# Build Wars

PC-build configurator: pick real parts, check compatibility, get a Build Score and power estimate.
Product plan: `BuildWars_PLAN_v2.md`. Conventions: `CLAUDE.md`. Status: `PROGRESS.md`.

## Local setup

```bash
corepack enable
pnpm install
cp .env.example .env.local
pnpm db:up
pnpm dev
```

`pnpm check` runs lint, typecheck and unit tests.
