# Build Wars

A free public website for assembling a desktop PC from real parts (2018 onward), checking
compatibility, and getting one relative Build Score plus a power estimate. The full product plan is
`BuildWars_PLAN_v2.md`; it is the source of truth for what to build. `PROGRESS.md` records milestone
status, decisions and open questions; read it when resuming.

@AGENTS.md

## Binding rules

1. **Never invent benchmark numbers.** Seed data uses clearly fake placeholder `perf_index` values
   with `verified: false`. Real values are entered by the site owner by hand, with sources.
2. Specs written from memory are also `verified: false` until checked against the manufacturer's
   page. Every catalog record carries `source_notes` and `verified` (specs). CPUs and GPU chips
   also carry `perf_index_verified` (the index); the two flags are independent.
3. `lib/engine` is pure: no database, network, Next.js, React or Three.js imports. ESLint enforces
   this. It must run unchanged in the browser and on the server.
4. Every compatibility rule and every score or power formula change needs a unit test.
5. Tunable numbers (score weights, bands, RAM factors, PSU multipliers, baseline watts) live only in
   `lib/engine/config.ts`. No magic numbers elsewhere.
6. Mobile layout is a first-class target, not an afterthought.
7. The 3D scene never hard-codes a specific product's geometry or position. Everything goes through
   the model loader and named attachment points, so new `.glb` models are added as files only.
8. A private build must never be readable by anyone but its owner and must never appear in the
   sitemap. All build reads go through the access functions in `lib/builds` (added in milestone 7).
9. No manufacturer logos, product photos or 3D files. Brand names only identify parts.
10. Never commit secrets. Keep `.env.example` current when adding an environment variable.

## Stack

Next.js 16 (App Router, Turbopack) + TypeScript strict, Tailwind CSS 4 + shadcn/ui (base-nova
style, components in `components/ui`), Drizzle ORM on PostgreSQL via `postgres`, Zod 4, Vitest,
Playwright (from milestone 4), Three.js via React Three Fiber + drei (milestone 5), Auth.js
(milestone 7). Package manager: pnpm (through corepack).

Next.js 16 differs from older versions: check `node_modules/next/dist/docs/` before using an API you
are not sure about. `cacheComponents` is on in `next.config.ts`.

## Layout

| Path                          | Contents                                                                                                                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                        | Routes only. Pages are server components unless they need interactivity.                                                                                                          |
| `components/ui/`              | shadcn/ui primitives (generated; do not hand-edit without reason)                                                                                                                 |
| `components/<area>/`          | Feature components, e.g. `configurator/`, `scene/`                                                                                                                                |
| `lib/schemas/`                | Zod schemas and the types inferred from them. The single definition of every part type and the model manifest.                                                                    |
| `lib/engine/`                 | Pure functions: `checkCompatibility`, `estimatePower`, `scoreBuild`; `config.ts` for tunables                                                                                     |
| `lib/build/`                  | Build state shared by UI and server: selection and URL encoding, catalog index, candidate checks, labels, picker filters                                                          |
| `lib/models/`                 | 3D model system, no React: `standard.ts` (units, axes, attachment node names), manifest lookup, snapping, scaling, assembly, `.glb` loader, `parametric/` builders, import checks |
| `components/scene/`           | The R3F scene: `use-part-model.ts` (lookup order as a hook), placement, `effects/` (animation, camera, ghost, outlines, glow)                                                     |
| `components/dev/`, `app/dev/` | Developer pages (`/dev/models`); 404 on the public site via `proxy.ts` unless `ENABLE_DEV_PAGES=1`                                                                                |
| `docs/`                       | `model-standard.md` for whoever makes `.glb` models                                                                                                                               |
| `lib/` (other)                | Server and shared helpers                                                                                                                                                         |
| `db/`                         | `schema.ts` (Drizzle), `index.ts` (`getDb()`), `migrations/`                                                                                                                      |
| `data/`                       | Catalog JSON (one file per part type, per series for GPUs), `data/models/` manifest                                                                                               |
| `scripts/`                    | CLI scripts run with `tsx` (`data:validate`, `data:import`, `models:import`)                                                                                                      |
| `e2e/`                        | Playwright tests                                                                                                                                                                  |

## Conventions

- Import with the `@/` alias (repo root). No `src/` directory.
- Types come from Zod schemas with `z.infer`; do not write a parallel hand-written type.
- Catalog JSON and database columns use `snake_case` field names exactly as in the plan's tables;
  TypeScript identifiers are `camelCase`, types `PascalCase`, files `kebab-case`.
- Part ids are stable lowercase slugs (e.g. `ryzen-7-9800x3d`); never reuse or rename one.
- Unit tests sit next to the code as `*.test.ts`. One `describe` per rule or formula.
- User-facing messages are plain language ("This CPU needs a BIOS update on this board"), never
  codes.
- Named exports; no default exports except where Next.js requires them.
- Format with Prettier (100 columns). Do not disable lint rules without a comment saying why.

## Commands

| Command                                             | Purpose                                                                                     |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm dev`                                          | Dev server                                                                                  |
| `pnpm check`                                        | Lint + typecheck + unit tests. Must pass before every commit.                               |
| `pnpm lint` / `pnpm typecheck` / `pnpm test`        | Individually                                                                                |
| `pnpm format`                                       | Prettier write                                                                              |
| `pnpm build`                                        | Production build                                                                            |
| `pnpm test:e2e`                                     | Playwright (builds and serves on port 3100). On this Mac: `PW_CHANNEL=chrome pnpm test:e2e` |
| `pnpm models:import <file.glb> --category … --id …` | Validate, compress and store a 3D model; prints its manifest entry                          |
| `pnpm models:sample`                                | Write a small standards-compliant sample GPU model for testing                              |
| `pnpm db:up` / `pnpm db:down`                       | Local Postgres in Docker (port 55433)                                                       |
| `pnpm db:generate` / `pnpm db:migrate`              | Drizzle migrations                                                                          |

## How work is organised

The lead session designs contracts (schemas, types, signatures), delegates implementation to the
subagents in `.claude/agents/` (`implementer` on Sonnet, `mechanic` on Haiku), then verifies with
`pnpm check` and a diff review. Commit after each completed task. Each milestone ends with
everything running and tested, an updated `PROGRESS.md`, and a stop for the owner's go-ahead.
