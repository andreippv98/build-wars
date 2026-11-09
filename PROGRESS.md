# Progress

Resume from this file plus `git log`. Scope of the current effort: milestones 1 to 8 of the plan's
build order (v1 code). Milestone 9 (real catalog data) is done by the owner by hand; 10+ are later.

## Milestones

| #   | Milestone                 | Status                                           |
| --- | ------------------------- | ------------------------------------------------ |
| 1   | Project setup             | Done (2026-11-09), awaiting owner go-ahead for 2 |
| 2   | Schemas and sample data   | Not started                                      |
| 3   | Engine                    | Not started                                      |
| 4   | Configurator layout       | Not started                                      |
| 5   | 3D scene                  | Not started                                      |
| 6   | Part pages                | Not started                                      |
| 7   | Accounts and saved builds | Not started                                      |
| 8   | Legal and consent         | Not started                                      |

## Decisions the plan left open

- **Package manager:** pnpm 12 through corepack (`packageManager` field pins it).
- **Next.js pinned to 16.4.5.** 16.4.6 was hours old at setup and pnpm's `minimumReleaseAge`
  safeguard rejects it. Bump once it has aged; do not relax the safeguard.
- **No `src/` directory;** `@/` alias is the repo root. Folder layout is in `CLAUDE.md`.
- **Postgres driver:** `postgres` (postgres.js) with Drizzle; works locally and with Neon/Supabase.
  `getDb()` is a lazy singleton so builds never open a connection.
- **Local database:** Docker Compose, Postgres 17, container `buildwars-db`, port 55433 (another
  project's database already uses 55432 on this machine).
- **shadcn/ui:** default `base-nova` preset (Base UI primitives), neutral base colour, site is
  always dark (`class="dark"` on `<html>`) to match the plan's studio look.
- **Engine purity is lint-enforced:** `no-restricted-imports` on `lib/engine/**`.
- **Tunables file:** `lib/engine/config.ts` (created in milestone 3).
- **Tests:** colocated `*.test.ts`; Playwright in `e2e/` from milestone 4.
- **CI:** GitHub Actions: format check, lint, typecheck, unit tests, build. `data:validate` joins
  in milestone 2. `data:import` on merge needs a production database, so it waits for launch.
- **Subagents:** `.claude/agents/implementer.md` (Sonnet), `.claude/agents/mechanic.md` (Haiku).

## Open questions for the owner

- No git remote yet. CI only runs once the repo is pushed to GitHub; say when and where.
- Needed later, not now: Google OAuth client and an email provider for magic links (milestone 7),
  object storage keys for `models:import` uploads (milestone 5; will be built to run without
  upload until keys exist), hosted Postgres and Vercel (launch).
