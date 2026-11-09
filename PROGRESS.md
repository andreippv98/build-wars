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

### Milestone 2 (catalog)

- **Ids:** every part has a stable text `id` (also the database primary key). `slug` is the URL
  segment; it equals the id except for GPU boards, whose slug is unique only within their chip
  (`/gpu/<chip>/<board>`). RAM kits and chipsets have no slug (no page).
- **File layout:** `data/cpus.json`, `chipsets.json`, `motherboards.json`, `ram-kits.json`,
  `psus.json` (arrays); `data/gpus/<series>.json` holds `{ chips, boards }`;
  `data/models/manifest.json` (array, empty for now).
- **Closed vocabularies:** sockets and CPU generation keys are enums in `lib/schemas/parts.ts`.
  Adding one is a schema edit, which keeps typos out of hand-entered data.
- **CPU support lists:** a chipset carries the default list (by generation or by CPU id, each
  with `needs_bios_update`); a motherboard may carry its own list, which replaces the chipset's.
  `resolveMotherboard()` produces the effective list. A CPU matched by no entry is unsupported.
- **Fields added beyond the plan's tables:** CPU `generation`, `base_ghz`, `cache_mb`; CPU
  `max_mem_speed` is per memory type (`{ "DDR4": 3200, "DDR5": 5600 }`) because 12th to 14th gen
  Intel differ by type; GPU chip `vram_type` and `high_power_spikes` (drives the 1.4 PSU
  multiplier, so the list of spiky cards is data, not code); GPU board optional `series` (partner
  product line, used by 3D model family rules); motherboard `socket` (denormalised, checked
  against the chipset); RAM `voltage`; `source_notes` + `verified` on every table.
- **`eps_required`** is the number of 8-pin EPS connectors on the board (1 or 2). PSU `modular`
  is `full` / `semi` / `none`; `efficiency` is the 80 Plus tier in lowercase.
- **Import never deletes parts** (saved builds will reference them); it warns about database rows
  missing from the JSON. `board_cpu_support` is rebuilt on every import. All in one transaction.
- **Model manifest:** `license`, `author`, `source` are optional until `verified: true`, then
  required.
- **Sample data:** 11 CPUs, 11 GPU chips / 22 boards, 8 chipsets, 11 motherboards, 10 RAM kits,
  10 PSUs. Real product names with specs from memory, all `verified: false`. `perf_index` values
  are fake multiples of 5; only the two anchors (9800X3D, RTX 5090 = 100) are meaningful.
- **Subagent definitions** load at session start. In the session that created them, delegate to
  `general-purpose` with the model set and the definition file named in the brief.

## Open questions for the owner

- One `verified` flag per record covers both specs and `perf_index`, as in the plan's tables. If
  you want specs verified separately from the index (likely during milestone 9), say so and I
  will split it into two flags.
- The plan counts only 8-pin and 12V-2x6 GPU connectors. Cards with 6-pin connectors have nowhere
  to record them; fine for now, worth deciding before real data entry.

- No git remote yet. CI only runs once the repo is pushed to GitHub; say when and where.
- Needed later, not now: Google OAuth client and an email provider for magic links (milestone 7),
  object storage keys for `models:import` uploads (milestone 5; will be built to run without
  upload until keys exist), hosted Postgres and Vercel (launch).
