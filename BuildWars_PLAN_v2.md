# Build Wars — Product & Build Plan

## Overview

Build Wars is a free, public website where anyone can assemble a desktop PC from real parts (2018 onward), check that the parts work together, and get one simple relative score that says how strong the build is. Built for people buying used parts who want to know "will this combo run my games well?" before they pay.

**Goals for v1**

- Pick a CPU, GPU, RAM kit, motherboard and PSU from a real catalog, including specific partner editions (Founders Edition, ASUS, MSI, Gigabyte and others).
- Get a **Build Score** that lets two builds be compared at a glance.
- See estimated **power draw** and whether the PSU is enough.
- Get clear errors and warnings when parts are incompatible.
- Save builds to an account and share them by link.
- Grow organic search traffic so the site can later carry ads.

**Goal for v1.5 (after launch):** give people a reason to come back and share, through weekly build challenges, build battles and public profiles. See Challenges, battles and profiles.

**Non-goals for v1:** prices, value-for-money, bottleneck detection, per-game FPS estimates, laptops, mobile apps.

**Not planned at all:** full game mechanics (in-game money, timed missions, upgrades, teams). The site stays a tool; the competition layer only compares real builds.

## Scope by release

| Release | Adds | Notes |
| --- | --- | --- |
| v1 | CPU, GPU, RAM, motherboard, PSU; compatibility checks; Build Score; power draw; accounts + saved builds; shareable build pages; SEO part pages; 3D configurator scene with model loader | Desktop only, website only, no prices |
| v1.5 | Weekly challenges with leaderboards; build battles (two builds side by side); public profiles with badges and rankings | Ships after launch, once there is some traffic; reuses the v1 engine and public builds, no new part data |
| v2 | Cases, CPU coolers, case fans, storage | Adds fit checks: GPU length, cooler height, motherboard form factor, radiator support |
| v3 | Airflow / thermal estimate | Depends on case + fan data from v2 |
| Later | Bottleneck detection, per-game FPS estimates, part-vs-part comparison pages (e.g. RTX 3080 vs RX 6800 XT), used-part age and condition | Reuses the CPU and GPU indices from v1 |

**Out of scope everywhere (for now):** Intel Arc GPUs, laptops, prices, native mobile apps.

## Parts catalog

The catalog covers desktop parts released from 2018 onward. GPUs are stored in two levels: the **chip** (e.g. RTX 3080 10 GB) and the **board model** built on it (e.g. ASUS TUF Gaming RTX 3080 OC). Performance comes mostly from the chip; the board model adds clocks, power limit, size and connectors.

### Coverage in v1

| Part | Included | Approx. size |
| --- | --- | --- |
| GPU chips | NVIDIA RTX 20, 30, 40, 50 series (incl. Super / Ti variants and VRAM variants); AMD RX 5000, 6000, 7000, 9000 series; anything newer | ~100 chips |
| GPU board models | Founders Edition / AMD reference + partner models from ASUS, MSI, Gigabyte, Zotac, Palit/Gainward, PNY, Sapphire, PowerColor, XFX, ASRock, Inno3D | Start with the 5–10 most common per chip; grows over time |
| CPUs | Intel Core 9th gen onward (incl. Core Ultra); AMD Ryzen 2000 onward (AM4 + AM5), desktop SKUs incl. F/K/X/X3D/G variants | ~250 |
| Motherboards | Chipsets for those sockets (Intel 300 series onward, AMD 400 series onward) + popular board models per chipset | Start ~150 boards, grow over time |
| RAM | DDR4 and DDR5 kits, chosen by spec (capacity, sticks, speed, CL), optional brand kit names | Spec-based, small |
| PSUs | Wattage, efficiency tier, connectors; popular models from Corsair, Seasonic, be quiet!, MSI, ASUS, Cooler Master, etc. | Start ~100 |

### Key fields per part

- **GPU chip:** name, vendor, series, release year, VRAM (GB, type), reference boost clock, reference board power (W), PCIe gen and lanes, **perf_index**.
- **GPU board model:** manufacturer, model name, chip, boost clock, board power / power limit, power connectors (count of 8-pin, 12VHPWR / 12V-2x6), length (mm), slot width, recommended PSU (W), fan count.
- **CPU:** name, vendor, socket, release year, cores/threads, base/boost clock, cache, TDP / PPT (W), integrated graphics (yes/no), supported memory type(s) and max official speed, PCIe gen, **perf_index**.
- **Motherboard:** manufacturer, model, chipset, socket, form factor, memory type, RAM slots, max memory, max supported RAM speed, PCIe gen of the main slot, CPU power connectors (EPS 4+4 / 8+8), list of CPU generations supported out of the box vs. with a BIOS update.
- **RAM kit:** type (DDR4/DDR5), total capacity, stick count, speed (MT/s), CAS latency, voltage.
- **PSU:** manufacturer, model, wattage, efficiency (80 Plus tier), ATX 3.x yes/no, connectors (EPS count, PCIe 8-pin count, 12VHPWR / 12V-2x6 count), modularity.

Every record also stores `source_notes` (where the specs came from) and `verified` (yes/no), so unchecked data can be flagged in the UI.

## Compatibility rules

Each rule returns **error** (the build can't work), **warning** (works with a caveat) or nothing. Errors block the score from showing as final; warnings are listed under it. The picker also filters lists so incompatible parts are hidden or greyed out once one part is chosen.

| Rule | Check | Result |
| --- | --- | --- |
| CPU socket | CPU socket = motherboard socket | Error |
| CPU generation | CPU is in the board's supported list | Error if unsupported; warning if it needs a BIOS update (e.g. Ryzen 5000 on many B450 boards) |
| RAM type | RAM type (DDR4/DDR5) = board memory type | Error |
| RAM sticks | Stick count ≤ board RAM slots | Error |
| RAM capacity | Total capacity ≤ board max memory | Error |
| RAM speed | Kit speed > board or CPU max | Warning: will run at the lower speed |
| Display output | No GPU selected and CPU has no integrated graphics (F models, most Ryzen pre-7000 non-G) | Error |
| PSU wattage | PSU ≥ recommended wattage (see Power draw) | Error if below estimated peak; warning if below recommended |
| GPU power connectors | PSU has the GPU's connectors (8-pin count, 12VHPWR / 12V-2x6) | Warning if an adapter is needed; error if the PSU can't supply enough 8-pin |
| CPU power connectors | PSU EPS count ≥ board EPS requirement | Warning |
| PCIe generation | GPU PCIe gen > board slot gen | Info note only (small effect), except cards with x8 lanes on PCIe 3.0 boards (e.g. RX 6600, RTX 4060) → warning |

Rules live in one module with a unit test per rule, so new rules (case fit, cooler height) slot in for v2.

## Build Score

The Build Score is one relative number for gaming performance, where a fixed reference build (RTX 5090 + Ryzen 7 9800X3D + 32 GB DDR5-6000) scores **100**. The anchor never moves, so a saved build keeps its score over time and future flagships can score above 100.

### Inputs

- **CPU index (C):** gaming performance relative to the Ryzen 7 9800X3D = 100, measured in CPU-bound tests (1080p with a top GPU).
- **GPU index (G):** chip `perf_index` relative to the RTX 5090 = 100 (1440p gaming average), times a small board-model factor:

  `G = perf_index_chip × clamp(1 + 0.5 × (boost_board / boost_ref − 1), 0.97, 1.06)`

- **RAM factor (R):** a multiplier for capacity and speed. Capacity: 8 GB = 0.85, 16 GB = 0.96, 32 GB or more = 1.00. Speed: ±0–3% versus the platform's typical speed (DDR4-3200, DDR5-6000).
- **Motherboard and PSU** don't change the score; they only feed compatibility and power checks.

### Formula

A weighted geometric mean, so a very weak part pulls the score down more than a simple average would. This gives a basic sense of balance without full bottleneck detection.

`Build Score = G^0.7 × C^0.3 × R`

Example: G = 100 with C = 40 gives about 76, while an average would give 82.

### Score bands shown to users

| Score | Label | Plain-language meaning |
| --- | --- | --- |
| 85+ | Enthusiast | Handles demanding games at 4K or high refresh rates |
| 65–84 | High-end | Comfortable at 1440p, high settings |
| 45–64 | Mid-range | Solid 1080p, some 1440p with tuning |
| 25–44 | Entry | 1080p with lowered settings in newer games |
| Under 25 | Basic | Esports and older titles |

The band cut-offs and the 0.7 / 0.3 weights are first guesses: tune them once real index data is in.

### Where the indices come from

The `perf_index` values are the hardest and most important data in the project. They are entered by hand from averages across several published reviews, with the sources stored in `source_notes`. Benchmark tables from review sites are not scraped or copied wholesale. Every index carries a `verified` flag; unverified values show a small "estimate" badge.

## Power draw

The site shows two numbers: **estimated gaming draw** and **recommended PSU**, plus a bar showing how much headroom the chosen PSU leaves.

- **Estimated peak draw** = GPU board power (from the board model, not the reference) + CPU package power (PPT for AMD, PL2 for Intel, capped at a sensible gaming value) + platform baseline (motherboard ~40 W, ~5 W per RAM stick, ~25 W for storage and fans until v2 adds them).
- **Recommended PSU** = peak × 1.3, rounded up to the next 50 W. Use 1.4 for GPUs known for big power spikes (e.g. RTX 3080/3090, RX 6800 XT/6900 XT) unless the PSU is ATX 3.x.
- **Headroom bar:** green when the PSU ≥ recommended, amber between peak and recommended, red below peak.

All baseline numbers live in one config file so they can be tuned without code changes.

## Accounts and saved builds

Anyone can configure a build without signing in; an account is only needed to save it.

- **Sign-in:** email magic link + Google sign-in. No passwords to store.
- **Unsaved builds:** the current build is encoded in the URL (part IDs), so it survives a refresh and can be shared even without an account.
- **Saved builds:** name, optional notes, parts, cached score and power numbers, created/updated dates. No limit per user in v1.
- **Visibility:** private (default) or public. A public build gets a stable share link (`/b/<short-id>`) with its own page.
- **Data changes:** if a part's index is corrected later, saved builds recompute their score on load; the stored score is only a cache.
- **Account deletion:** a user can delete their account and all builds (required under GDPR).

## Challenges, battles and profiles (v1.5)

A light competition layer on top of the configurator. It reuses the catalog, the engine and public builds, and adds no new part data. It ships after launch, because leaderboards with three entries look worse than no leaderboards.

### Weekly challenges

Each week has one challenge: a set of constraints and a leaderboard of the highest-scoring builds that meet them.

- **Constraints are data, not code.** A challenge is a JSON record with a list of rules from a fixed set:

| Rule type | Example |
| --- | --- |
| Max estimated peak power | "Under 450 W" |
| Part release years | "Only parts from 2018–2020" |
| Vendor | "All-AMD build" |
| Socket / platform | "AM4 only" |
| Memory | "DDR4, 16 GB max" |
| Max index of one part | "GPU index 40 or lower" |
| Verified data only | Only parts with `verified: true` indices |

- **Ranking:** highest Build Score wins. Ties are broken by earliest submission.
- **Entering:** the user submits one of their saved public builds. It must pass the challenge rules and have no compatibility errors. One entry per user per challenge, replaceable until the challenge closes.
- **Schedule:** opens Monday 00:00 UTC, closes Sunday 23:59 UTC. Challenges are written ahead of time as JSON in `data/challenges/` and go live by date, so no admin UI is needed.
- **Fair scores:** the server recomputes the score from part IDs at submission; a score sent by the browser is never trusted. When a challenge closes, entries are frozen with their final score, so later index corrections don't rewrite old results.
- **In the configurator:** opening `/build?challenge=<slug>` shows the rules as a checklist in the right panel (green tick or red cross per rule) and a "submit entry" button once all pass.
- **Archive:** closed challenges stay online with their winning builds. Each one is a lasting page such as "Best gaming build under 450 W".

**Known weakness:** with a fixed catalog and a deterministic score, many people will find the same best build. The earliest-submission tie-break rewards speed, and the leaderboard shows "N builders found this build". Challenges with real trade-offs (power caps, mixed-year limits) spread results better than simple ones; tune this from the first few weeks.

### Build battles

A battle page puts two builds side by side and declares a winner.

- **Creating one:** a "battle this build" button on any public build page; the user picks the opponent from their own builds, public builds, or a pasted build link.
- **What it shows:** both Build Scores with the winner highlighted, then a row-by-row comparison: GPU index, CPU index, RAM, estimated power draw, recommended PSU, part release years.
- **Community vote:** signed-in users can vote "which would you build?", one vote per user per battle. The vote is shown next to the score result, not instead of it.
- **URL:** `/battle/<id-a>-vs-<id-b>`, with the two ids always in the same order so a pair has one page, not two.

### Profiles, badges and rankings

- **Handle:** a user picks a public handle the first time they publish a build or enter a challenge. Until then the account has no public presence.
- **Profile page** (`/u/<handle>`): public builds, challenge results, badges.
- **Badges** are awarded automatically from existing data. Start with a small fixed set:

| Badge | Earned by |
| --- | --- |
| First Build | Publishing a first public build |
| Challenger | Entering a challenge |
| Podium | Finishing in a challenge top 3 |
| Champion | Winning a challenge |
| Regular | Entering 5 challenges |
| Crowd Favourite | Winning the vote in 10 battles |

- **All-time ranking:** challenge points per result (win 10, second 6, third 4, any valid entry 1), summed into one leaderboard at `/leaderboard`. Point values live in the config file.

### Abuse and moderation

- Handles and build names pass a blocklist; every public profile, build and battle has a report link that emails the site owner.
- Voting and challenge entry require sign-in and are rate-limited.
- The owner can hide a build, handle or entry with a flag in the database.

## Pages and UX

| Page | URL | What it does |
| --- | --- | --- |
| Configurator | `/build` | Three areas: parts list on the left, 3D open-case scene in the centre (~70%), selected parts and performance numbers on the right; see Visual design below |
| Part picker | inside the left panel of `/build` | Search, filters (brand, series, socket, year), sort by index; incompatible parts greyed out with the reason |
| Part detail | `/cpu/<slug>`, `/gpu/<slug>`, `/gpu/<chip>/<board>`, etc. | Specs, index, compatible boards / chips, "build with this" button. Main SEO entry point |
| GPU chip page | `/gpu/<chip-slug>` | Lists all board models of that chip with clocks, power, length, so editions can be compared side by side |
| Shared build | `/b/<short-id>` | Read-only build with score; "copy and edit" button |
| My builds | `/me/builds` | List of saved builds, rename, delete, toggle public |
| Home | `/` | Short pitch, "start a build", popular public builds; from v1.5 also this week's challenge |
| Challenges (v1.5) | `/challenges`, `/challenges/<slug>` | Current challenge with rules and live leaderboard; archive of past challenges and winning builds |
| Battle (v1.5) | `/battle/<id-a>-vs-<id-b>` | Two builds side by side, score winner, community vote |
| Profile (v1.5) | `/u/<handle>` | Public builds, challenge results, badges |
| Leaderboard (v1.5) | `/leaderboard` | All-time ranking by challenge points |
| Methodology | `/how-scores-work` | Explains the score, the anchor build, and that numbers are estimates. Builds trust and helps SEO |
| Legal | `/privacy`, `/terms`, `/cookies` | Required before ads and accounts go live |

**UX principles:** works well on a phone (most used-market browsing happens there), fast part search, plain-language warnings ("This CPU needs a BIOS update on this board") instead of codes.

## Visual design: the configurator scene

The configurator works like a car configurator: an open PC case sits in the centre of the screen and fills up as parts are chosen, with the parts list on the left and the build summary on the right.

### Layout

```
+--------------+------------------------------------------+--------------+
| COMPONENTS   |           3D SCENE: OPEN CASE            | YOUR BUILD   |
|              |                                          |              |
| [ CPU      ] |        +-------------------------+       | Selected     |
| [ GPU    > ] |        |  [CPU]        ||||  RAM |       | parts        |
| [ RAM      ] |        |                         |       |              |
| [ Mobo     ] |        |  [====== GPU ======]    |       | BUILD SCORE  |
| [ PSU      ] |        |       motherboard       |       |              |
|              |        |-------------------------|       | Power + PSU  |
| (list of     |        |  [ PSU ]                |       | Warnings     |
|  parts for   |        +-------------------------+       | Save / Share |
|  selected    |                                          |              |
|  category)   |        rotate and zoom                   |              |
|   ~15%       |                ~70%                      |    ~15%      |
+--------------+------------------------------------------+--------------+
```

Choosing a part on the left places it in the case in the centre and updates the score on the right.

| Area | Width | Contents |
| --- | --- | --- |
| Left panel | ~15% (min 260 px) | Component categories (CPU, GPU, RAM, motherboard, PSU), each expanding into a searchable, filterable list; incompatible parts greyed out with the reason |
| Centre scene | ~70% | 3D view of an open case (side panel off or glass); chosen parts appear inside it; the user can rotate and zoom |
| Right panel | ~15% (min 300 px) | Selected parts with remove/swap buttons, Build Score with band label, power draw and PSU headroom bar, warnings and errors, save/share buttons |

On screens narrower than ~1200 px the side panels keep their minimum width and the scene shrinks. On phones the scene sits on top (about 45% of the height), the parts list opens as a bottom sheet, and the summary collapses to a sticky bar showing the score that expands on tap.

### How the scene behaves

- **Adding a part:** it animates into its slot (GPU slides into the PCIe slot, RAM sticks click into their slots, PSU drops into the shroud) and the camera eases toward it, then back.
- **Hovering a part in the list:** a translucent "ghost" preview appears in place before it is chosen.
- **Swapping:** the old part fades out while the new one slides in, so size differences (e.g. a 2-slot vs. a 3.5-slot GPU) are obvious.
- **Selecting a category on the left:** the camera focuses on that area of the case and the slot is outlined.
- **Problems:** a part with an error glows red in the scene; a warning glows amber. Clicking it jumps to the matching message on the right.
- **Empty slots** show a dashed outline with a "+" to open the list for that category.

### What changes visually per part

Until real models exist, the scene uses **parametric models**: one base model per category, shaped and labelled from the part's data.

| Part | Driven by data | Fixed |
| --- | --- | --- |
| GPU | Length (mm), slot width, fan count (1/2/3), shroud colour family per maker, brand and model name on the side | Basic card shape |
| Motherboard | Form factor (ATX / mATX / ITX) size, RAM slot count, board colour | Layout of sockets and slots |
| RAM | Number of sticks, heatsink height and colour | Stick shape |
| CPU | Socket shown under a generic cooler (real coolers arrive in v2); name on a floating label | Cooler |
| PSU | Wattage and name label on the side, modular / non-modular cable stubs | Box shape |

Unique, highly detailed models for popular parts (e.g. specific Founders Edition or ASUS ROG cards) can be added later through the model loading system below; the parametric model stays the fallback for everything else.

### 3D model loading system

The scene is built around a model loader from v1, so real-looking models of specific products can be added later as files without changing code. The parametric models are just the last fallback in that loader.

**Lookup order** when a part is placed in the scene:

1. A model for that exact product (e.g. ASUS ROG Strix RTX 4080 Super OC).
2. A model for its product family (e.g. any ASUS ROG Strix RTX 40-series card), scaled to the product's length.
3. The parametric model for its category, shaped from the part's data.

**Model manifest.** Each model is registered in a JSON manifest in `data/models/`, validated by Zod like the rest of the catalog:

| Field | Meaning |
| --- | --- |
| `id` | Unique model id |
| `applies_to` | Exact part ids, or a family rule (maker + series + chip list) |
| `category` | gpu, cpu_cooler, motherboard, ram, psu, case (v2), fan (v2) |
| `file` | Path or URL of the `.glb` file |
| `lod` | Optional lower-detail versions for phones |
| `scale_to_data` | Whether to stretch the model to the part's real dimensions |
| `license`, `author`, `source` | Who made it and under what licence; required before publishing |
| `verified` | Checked in the test scene and approved |

**Model file standard** that every model must follow, so any model drops into place:

- Format: glTF binary (`.glb`), PBR materials, textures at most 2048 px.
- Units: millimetres, so a 304 mm GPU is 304 units long.
- Orientation and origin: one fixed convention per category (e.g. GPU origin at the PCIe connector, facing the same way as the motherboard slot).
- **Attachment points:** named empty nodes inside the file tell the scene where things connect: `mount_pcie` on GPUs, `slot_pcie_1`, `socket_cpu`, `slot_ram_1…4` on motherboards, `mount_psu` and `mount_motherboard` in cases. The scene snaps parts together by these names, not by hard-coded coordinates.
- Optional named parts for effects: `fan_1…3` (spin), `rgb_*` (glow), `label_area` (where the name is printed).
- Size budget: about 50k triangles and 2 MB per part after compression.

**Import pipeline:** `pnpm models:import <file>` validates the file (official glTF validator), checks units, origin and attachment points, compresses it (gltf-transform with Draco/Meshopt), generates the low-detail version, and uploads it to object storage behind a CDN (e.g. Cloudflare R2 or Vercel Blob). A failed check stops the import with a clear message.

**Model test page:** a dev-only page (`/dev/models`) loads any model alone or inside the showcase case next to its parametric version, shows its attachment points and dimensions, and flags mismatches with the part's data (e.g. model 285 mm long, catalog says 304 mm).

**Loading in the browser:** models load lazily as parts are chosen, show the parametric model as a placeholder until the real one arrives, are cached by the browser and CDN, and fall back to the parametric model if a file fails to load.

### The case in v1

Cases aren't selectable until v2, so v1 uses one neutral showcase case (mid-tower, glass side, dark interior), built to the same model file standard. In v2 the user's chosen case replaces it, and the same scene then shows fit problems directly: a GPU too long for the case clips through the front, a cooler too tall pokes through the glass.

### Technical approach

- **3D engine:** Three.js through React Three Fiber and drei, inside the Next.js app.
- **Models:** low-poly glTF/GLB, compressed (Draco or Meshopt), total scene under ~5 MB, loaded only on `/build`.
- **Model sources:** made in-house in Blender or bought with a commercial licence. Manufacturer 3D files and product renders are not used without permission.
- **Performance target:** 60 fps on a mid-range laptop; reduced detail and no shadows on phones.
- **Fallback:** if WebGL is unavailable, a 2D illustrated side view of the case shows the same slots.
- **Part pages and shared build pages** stay server-rendered for SEO; shared builds can show a static rendered image of the build, with a button to open it in the 3D configurator.

### Visual style

Dark, studio-like look, like a car configurator showroom: dark background, soft spotlight on the case, subtle RGB accent lighting. Side panels are clean and flat so attention stays on the scene. Part names and numbers use a clear sans-serif; the Build Score is the largest number on the screen.

## Tech stack and data model

One Next.js app with server-rendered part pages for SEO, a Postgres database, and the parts catalog kept as versioned JSON files in the repo that a script imports into the database.

| Layer | Choice | Why |
| --- | --- | --- |
| Framework | Next.js (App Router) + TypeScript | Server-rendered pages rank in search; one codebase for UI and API |
| Styling | Tailwind CSS + shadcn/ui | Fast to build, good on mobile |
| 3D | Three.js via React Three Fiber + drei | Standard React-friendly 3D stack, loads glTF natively |
| Database | PostgreSQL (Neon or Supabase) | Relational data with lots of joins (part ↔ socket ↔ chipset) |
| ORM | Drizzle | Typed schema, simple migrations |
| Auth | Auth.js (email magic link + Google) | No password storage |
| Validation | Zod | One schema validates catalog JSON, model manifest, API input and forms |
| Model storage | Cloudflare R2 or Vercel Blob + CDN | Large binary files kept out of the repo |
| Hosting | Vercel (EU region) | Simple deploys; data stays in the EU |
| Tests | Vitest for rules and scoring; Playwright for the main build flow | Rules and score must not regress silently |

### Core logic as pure functions

Compatibility, scoring and power live in a `lib/engine` package with no database or UI code: `checkCompatibility(build)`, `scoreBuild(build)`, `estimatePower(build)`. They run in the browser for live updates and on the server for share pages, and are fully unit-tested.

v1.5 adds two more pure functions to the same package: `checkChallenge(build, rules)`, which returns pass/fail per rule, and `compareBuilds(a, b)`, which returns the row-by-row battle comparison.

### Catalog data flow

1. Parts are edited as JSON files under `data/` (one file per part type, or per series for GPUs).
2. `pnpm data:validate` checks every file against Zod schemas and cross-references (a board model must point to an existing chip, etc.).
3. `pnpm data:import` upserts into Postgres. Runs in CI on merge.

The catalog is maintained by the site owner. No admin UI in v1; Git history is the audit trail.

### Database tables

| Table | Main columns |
| --- | --- |
| `cpus` | id, slug, vendor, name, socket, year, cores, threads, boost_ghz, tdp_w, ppt_w, igpu, mem_types, max_mem_speed, perf_index, verified, source_notes |
| `gpu_chips` | id, slug, vendor, name, series, year, vram_gb, ref_boost_mhz, ref_power_w, pcie_gen, pcie_lanes, perf_index, verified, source_notes |
| `gpu_boards` | id, slug, chip_id, maker, model, boost_mhz, power_w, conn_8pin, conn_12v2x6, length_mm, slots, fan_count, rec_psu_w |
| `chipsets` | id, vendor, name, socket |
| `motherboards` | id, slug, maker, model, chipset_id, form_factor, mem_type, ram_slots, max_mem_gb, max_mem_speed, pcie_gen, eps_required |
| `board_cpu_support` | motherboard_id (or chipset_id), cpu_id or cpu_generation, needs_bios_update |
| `ram_kits` | id, type, capacity_gb, sticks, speed_mts, cas, brand, model |
| `psus` | id, slug, maker, model, watts, efficiency, atx3, eps_count, pcie_8pin_count, conn_12v2x6_count, modular |
| `users` / `accounts` / `sessions` | Auth.js standard tables |
| `builds` | id, short_id, user_id, name, notes, is_public, cpu_id, gpu_board_id, ram_kit_id, motherboard_id, psu_id, cached_score, cached_power_w, created_at, updated_at |

The 3D model manifest stays as JSON in `data/models/` and is bundled at build time; it does not need a database table in v1.

**Added in v1.5**

| Table | Main columns |
| --- | --- |
| `users` (extended) | handle (unique, nullable), handle_set_at, is_hidden |
| `challenges` | id, slug, title, description, rules (JSON), starts_at, ends_at; imported from `data/challenges/` |
| `challenge_entries` | id, challenge_id, user_id, build_id, score, power_w, submitted_at, final_rank; unique on (challenge_id, user_id) |
| `battles` | id, build_a_id, build_b_id, created_by, created_at; unique on the ordered pair |
| `battle_votes` | battle_id, user_id, choice; unique on (battle_id, user_id) |
| `user_badges` | user_id, badge, earned_at |

Add the nullable `handle` column in v1 so v1.5 needs no change to existing accounts.

## SEO, ads and legal

Traffic will come mostly from search, so part pages and public build pages are the growth engine; ads come only after traffic exists.

**SEO**

- Every part and GPU board model gets a server-rendered page with a clean URL, unique title and description, and structured data (schema.org `Product`).
- Sitemap generated from the database; public builds included, private ones never.
- Fast pages (good Core Web Vitals) and a methodology page that explains the score.
- From v1.5: challenge archive pages are indexed (each is a "best build under X" page). Battle pages are indexed only when both builds are saved public builds; profile pages are indexed only once they have at least one public build.
- English only; no translations planned.

**Ads (later, once traffic is meaningful)**

- Google AdSense to start; reserve ad slots in the layout from day one so adding ads doesn't shift the page.
- Never put ads inside the part picker, over the 3D scene, or between the score and its warnings.

**Legal (EU / GDPR — the site is run from Romania)**

- Privacy policy, terms and cookie policy before launch.
- A cookie consent banner certified for Google ads (a Google-certified CMP) is required before serving personalised ads to EU visitors.
- Store only email and builds; let users export and delete their data.
- From v1.5 the handle, challenge entries and votes are also personal data: list them in the privacy policy, include them in the export, and remove them on account deletion (the user's leaderboard entries are deleted, not kept under the old handle).
- Brand names are used only to identify parts; no manufacturer logos, product photos or 3D files copied from their sites.
- Specs are facts, but review sites' benchmark charts are not copied; see Build Score.

## Build order for Claude Code

Build in this order; each milestone ends with something runnable and tested before the next starts.

1. **Project setup:** Next.js + TypeScript + Tailwind + Drizzle + Vitest, lint and CI, `CLAUDE.md` with these conventions.
2. **Schemas and sample data:** Zod schemas for every part type and the model manifest, `data:validate` and `data:import` scripts, a small sample catalog (~10 parts per type) marked `verified: false`.
3. **Engine:** `checkCompatibility`, `estimatePower`, `scoreBuild` as pure functions with a unit test for every rule and formula.
4. **Configurator layout:** three-area layout (parts list, centre scene placeholder, summary panel), part picker with search and filters, live score / power / issues, build state in the URL, mobile layout.
5. **3D scene:** model loader with manifest, lookup order and attachment-point snapping; `models:import` pipeline and `/dev/models` test page; showcase case model built to the file standard; parametric fallback models for GPU, motherboard, RAM, CPU + cooler and PSU; add / swap / hover animations, camera focus per category, red / amber highlights for problems, 2D fallback.
6. **Part pages:** CPU, GPU chip, GPU board, motherboard, PSU pages with SEO metadata and sitemap.
7. **Accounts and saved builds:** Auth.js, save / rename / delete, public share pages at `/b/<short-id>` with a static image of the build.
8. **Legal and consent:** privacy, terms, cookie pages, consent banner, account deletion.
9. **Real catalog data:** fill in the full catalog and `perf_index` values (largely manual work, see Build Score).
10. **Launch:** deploy to Vercel EU, set up privacy-friendly analytics, submit sitemap to Google Search Console.
11. **Competition layer (v1.5), in three parts, each shippable alone:**
    1. Handles and profile pages; build battles with `compareBuilds` and voting.
    2. Weekly challenges: rule schema and `checkChallenge`, `data/challenges/` import, challenge mode in the configurator, entry submission with server-side scoring, live leaderboard, closing job that freezes ranks, archive pages.
    3. Badges and the all-time leaderboard.
12. **Ads:** add AdSense to reserved slots once traffic justifies it.

Start step 11 only after launch shows steady visitors. Battles come first because they work with a single visitor; challenges need a crowd.

## Notes for Claude Code

- **Never invent benchmark numbers.** Seed data uses clearly fake placeholder indices with `verified: false`; real values are added by hand with sources.
- Specs written from memory must also be `verified: false` until checked against the manufacturer's page.
- Keep `lib/engine` free of database, network and UI imports.
- Every compatibility rule and score formula change needs a test.
- Tunable numbers (weights, bands, PSU multipliers, baseline watts) live in one config file, not scattered in code.
- Mobile layout is a first-class target, not an afterthought.
- The scene never hard-codes a specific product's geometry or position: everything goes through the model loader and attachment points, so new GLB models can be added as files only.

- Challenge rules are data: a new challenge is a new JSON file using existing rule types, never new code. Adding a rule type needs a schema change and a test.
- Scores on leaderboards are always computed on the server from part IDs.

## Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| `perf_index` data | Every score, challenge and battle depends on it; it is slow manual work | Fill the most-searched parts first (recent GPUs and CPUs), show the "estimate" badge on the rest, launch with partial coverage |
| 3D scene scope | Step 5 is the largest single piece of work and could delay launch | The step 4 layout with the 2D fallback is already usable; launch with parametric models only and treat real models as post-launch |
| Empty leaderboards | A competition with no competitors puts visitors off | Competition layer waits for traffic; battles ship before challenges |
| Identical winning builds | Deterministic score means many ties | Earliest-submission tie-break, trade-off-heavy challenge rules, tune after the first weeks |
| Moderation load | Public handles, names and votes invite abuse | Blocklist, report link, sign-in for all public actions, owner hide flag |

## Decisions

- **Site, not game:** a full game (missions, money, upgrades, teams) was considered and dropped. The site stays a tool with a competition layer: challenges, battles, profiles.
- **Name:** Build Wars.
- **Catalog cutoff:** 2018 onward for all parts: RTX 20-series and newer GPUs, Intel 9th gen and Ryzen 2000 onward CPUs.
- **Used-part age and condition:** not in v1; planned for a later release.
- **Catalog maintenance:** done by the site owner; no community submissions for now.
- **Language:** English only.
