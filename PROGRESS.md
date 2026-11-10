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

### Milestone 3 (engine)

- **Shape:** `lib/engine` exports `estimatePower`, `scoreBuild`, `checkCompatibility` and
  `evaluateBuild` (all three at once). Input is a `Build` of resolved part records; the engine
  never looks ids up. The exact rules are the doc comments on each function.
- **Score rounding:** `score` is rounded to one decimal (canonical, for storing and ranking);
  `displayScore` is the whole number the UI shows, and the band comes from it, so the number and
  the label can never disagree.
- **Score needs CPU + GPU + RAM.** Until then `score` is null and `missing` says what to add.
  The RAM factor uses the kit's own speed, not the speed the board or CPU limits it to, so the
  reference build scores exactly 100.
- **RAM speed factor:** `clamp(1 + 0.15 x (speed / typical - 1), 0.97, 1.03)`. The plan only said
  "plus or minus 0 to 3%"; 0.15 makes DDR5-7200 and DDR5-4800 hit the two ends.
- **RAM capacity:** steps at 16 and 32 GB; anything under 16 GB gets the 8 GB factor.
- **CPU gaming power cap:** 200 W (the plan says "a sensible gaming value"). My guess; tune it.
- **Baseline power:** motherboard watts only when a board is selected; storage and fans as soon
  as any part is selected.
- **12V-2x6 adapters:** an adapter needs `ceil(board power / 150)` PCIe 8-pin plugs, between 2
  and 4. Too few on the PSU is an error; enough is the "adapter needed" warning.
- **Extra checks beyond the plan's table:** RAM type is also checked against the CPU (a DDR5 kit
  with an AM4 CPU is an error even before a board is chosen); the PCIe rule uses the lower of the
  board's and the CPU's generation; the CPU generation rule is skipped when the socket is already
  wrong, to avoid two errors for one mistake.
- **Issue order:** errors, warnings, info; within a severity, rule order.

### Milestone 4 (configurator)

- **URL state:** `/build?cpu=<id>&gpu=<gpu board id>&ram=<id>&mb=<id>&psu=<id>`, fixed order.
  The URL is the single source of truth for an unsaved build (`history.replaceState` on every
  change); unknown or malformed ids are ignored. Other query parameters are preserved, so a
  later `?challenge=` fits in.
- **The site serves the catalog from the JSON files, not from the database.** `getCatalog()`
  (`lib/catalog/server.ts`) reads `data/` on the server under `"use cache"`, so `/build` is
  static and needs no database at build time or in CI. The database copy from `data:import`
  exists so saved builds can reference parts (milestone 7). The whole catalog (minus the model
  manifest) is sent to the browser so search, filters and the engine run locally.
- **Shared state:** `useConfigurator()` (`components/configurator/configurator-provider.tsx`) is
  the one contract between picker, summary, scene and layout: selection, build, evaluation,
  select / remove / clear, `activeSlot`, `preview` (hovered part, for the ghost) and
  `blockersFor`.
- **Greyed-out parts:** a part is blocked when adding it would cause an error involving its own
  slot. "No graphics output" is not a blocker (it only means a GPU is still missing).
- **Breakpoint:** three columns from 1024 px; below that the phone layout (scene 45dvh, slot
  list, parts sheet, sticky score bar that opens the summary sheet). The panels are mounted once,
  chosen in JS, and nothing renders until the width is known.
- **Picker:** filters and sort are native selects (better on phones); 60 rows at a time with
  "Show more"; the whole picker scrolls as one list.
- **Scene placeholder** is a data-driven 2D SVG side view. It becomes the WebGL fallback in
  milestone 5.
- **Save button** is present but disabled until accounts exist (milestone 7). Share copies the
  build URL.
- **No ad slot on `/build`.** The plan forbids ads in the picker, over the scene and between
  score and warnings, which leaves no room on this page; slots get reserved on part pages
  (milestone 6).
- **Playwright:** 12 tests, `desktop` and `phone` projects, served from a production build on
  port 3100. Playwright's bundled Chromium does not support this Mac's macOS 13, so local runs
  use installed Chrome (`PW_CHANNEL=chrome pnpm test:e2e`); CI uses the bundled browser.

### Milestone 5 (3D scene)

- **Model standard** is `lib/models/standard.ts` (and `docs/model-standard.md` for artists):
  millimetres; +X toward the case front, +Y up, +Z out of the motherboard toward the viewer;
  every model is authored in its mounted orientation with its origin on its mount. Attachment
  nodes: `mount_motherboard`, `mount_psu` (case); `socket_cpu`, `slot_ram_1..4`, `slot_pcie_1`
  (motherboard); `mount_pcie` (GPU). Effect nodes: `fan_1..3` spin around local Z, `rgb_*`,
  `label_area`.
- **Placement is only ever `slot x inverse(mount)`** (`lib/models/snap.ts`, `assemble.ts`). The
  scene has no coordinates of its own. RAM is one stick model placed per stick (2 sticks on a
  4-slot board go in slots 2 and 4).
- **Parametric models are three.js objects built in code**, the same kind of object a `.glb`
  gives, so one loader path serves both: the parametric model shows at once, a real model is
  fetched lazily and swapped in, and a failed load leaves the parametric one.
- **No motherboard chosen:** a translucent neutral ATX placeholder board provides the slots.
- **Showcase case is procedural** (`buildCaseModel()`), built to the standard with the two
  mount nodes. It is not a `.glb` file; nobody has modelled one.
- **Compression is Meshopt, not Draco.** The decoder ships with three.js, so no decoder files
  have to be hosted. `models:import` produces Meshopt files and a half-detail `lod1` file.
- **Model files** resolve against `NEXT_PUBLIC_MODELS_BASE_URL` (the CDN later), default
  `/models` = `public/models/` locally, which is git-ignored.
- **Upload is not implemented.** `models:import` validates (official glTF validator + the
  standard's checks), compresses, writes to `public/models/` and prints the manifest entry.
  The storage provider (Cloudflare R2 or Vercel Blob) is the owner's choice; the write step is
  one function (`storeModelFiles`) to swap.
- **Only `verified` manifest entries are used on the public site.** `/dev/models` also shows
  unverified ones.
- **`/dev/models` is 404 on the public site** (`proxy.ts`), reachable under `pnpm dev` or with
  `ENABLE_DEV_PAGES=1`.
- **Phones (`lowDetail`):** no shadows, pixel ratio capped at 1.5, `lod` model files, shorter
  camera moves. Reduced-motion users get no slides, camera travel or fan spin.
- **Scene state for tests** is on `[data-testid=scene]`: `data-parts` (model source per slot),
  `data-empty`, `data-active-slot`, `data-ghost`, `data-problems`.
- **Verified with a real file:** a generated sample `.glb` was matched by a family rule,
  stretched from 285 to 304 mm and snapped onto the PCIe slot in the live scene, then the test
  manifest entry was removed. The manifest is empty: every part is parametric today.
- **Static image of a build for share pages** (plan, milestone 7) is not built yet.

### Trying a real model locally (2026-11-10)

- **Drop folder:** raw model files go in `models-src/` (git-ignored).
- **`pnpm models:align`** (`lib/models/align.ts`) fits a foreign `.glb` to the standard without
  editing geometry: rotate, scale to a length, move an anchor to the origin, add nodes.
- **Local-only manifest:** `data/models/manifest.local.json` (git-ignored, same format). Its
  entries are used by the `/build` scene under `pnpm dev` only and listed on `/dev/models`; a
  production build ignores the file, so try-out models cannot ship by accident.
- **First try-out:** an MSI RTX 5070 Ventus 3X OC model (Sketchfab, author darky.vip21,
  CC-BY-4.0 per the file's own metadata) aligned with
  `--rotate 90,0,-90 --length-mm 303 --anchor min+12,max,min+8 --add-node mount_pcie`, imported
  as `gpu/msi-rtx-5070-ventus-3x-oc.glb`, shown for the new sample catalog part
  `msi-ventus-3x-rtx-5070-oc`. Owner: testing only, not to be published. It carries MSI logos in
  its textures, which the plan rules out for the public site.

### Owner decisions (2026-11-10)

- **Two verification flags.** `verified` = specs checked against the manufacturer's page (every
  record). `perf_index_verified` = index entered from real review averages (CPUs and GPU chips).
  The score's "estimate" badge follows `perf_index_verified` only.
- **6-pin connectors.** GPU boards have `conn_6pin`, PSUs have `pcie_6pin_count` (6-pin-only
  plugs). A PSU 8-pin (6+2) plug can feed a 6-pin socket; a 6-pin-only plug cannot feed an 8-pin
  socket. All sample records have 0.
- **RAM speed.** Over the motherboard's limit is a warning ("will run at X"). Over only the
  CPU's official speed is an info note ("turn on EXPO or XMP"). The board warning wins if both.
- **Remote:** `git@github.com:andreippv98/build-wars.git`; push `main` after each milestone commit.

## Open questions for the owner

- **Model storage:** Cloudflare R2 or Vercel Blob for `.glb` files, and its keys, when the first
  real model is ready. Nothing needs it until then.
- **Real models:** none exist. The plan treats them as post-launch; say if you want any before.
