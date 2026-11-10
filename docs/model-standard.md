# Model file standard

This page is for whoever makes the 3D models of PC parts. Follow it and your file drops into the
configurator scene with no code changes: the scene never knows a product's shape, it only reads
the named empty nodes in your file and lines them up.

The authoritative numbers and node names live in `lib/models/standard.ts`. The import script
checks everything below and refuses a file that does not follow it.

## 1. Format

- glTF binary (`.glb`), one scene only.
- PBR metallic-roughness materials only (no specular-glossiness, no unlit materials).
- Textures at most 2048 px on the longer side. The import does not resize textures; resize them
  yourself before exporting.
- You may export uncompressed. The import compresses the file (Meshopt) and makes a low-detail
  copy for phones.

## 2. Units

Millimetres. A 304 mm long graphics card is 304 units long in the file. A model whose longest
side is under 5 units is assumed to be in metres and is rejected; the longest side must be
between 5 and 800 mm.

In Blender: set Scene > Units to Metric with Unit Scale 0.001 and Length "Millimeters" (or scale
the model by 1000), apply scale before exporting, and export glTF with Y up.

## 3. Axes

The frame is three.js: right-handed, Y up. Picture a tower case seen from its open side (the
side panel removed), the motherboard lying flat against the back of the case, the front of the
case on the right:

```
                 +Y (up)
                  ^
      rear        |            front
   +--------------+---------------+
   |  top rear    |               |
   |  corner of   |               |
   |  motherboard +-----> +X       |   (toward the front of the case)
   |  = origin    |               |
   |              |               |
   +--------------+---------------+
      +Z points out of the page, toward you (out of the motherboard)
```

- `+X` is toward the front of the case.
- `+Y` is up.
- `+Z` is out of the motherboard, toward the viewer.

Every model is authored in this frame, already in its mounted orientation. Never rely on a
rotation applied by the scene.

## 4. Categories

Attachment nodes are **empty nodes** (no mesh). Their position and rotation matter: a part is
placed so its own mount node lands on the slot node of its parent.

| Category      | Origin                                                                                     | Extent and orientation                                                              | Required nodes                                          |
| ------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `gpu`         | `mount_pcie`: rear end of the PCIe edge connector, on the motherboard surface.             | Length runs +X, slot thickness runs -Y (fans face down), the card stands toward +Z. | `mount_pcie` (at the origin, no rotation)               |
| `motherboard` | Top rear corner of the board, on the component side.                                       | Spans +X (width) and -Y (height); components rise toward +Z.                        | `socket_cpu`, `slot_pcie_1`, `slot_ram_1`, `slot_ram_2` |
| `case`        | Chosen freely; the interior of a mid-tower in the same axes.                               | Whole case interior.                                                                | `mount_motherboard`, `mount_psu`                        |
| `ram`         | Centre of the stick's edge connector, on the motherboard surface. ONE stick per file.      | Long edge runs along Y, the stick stands toward +Z.                                 | none                                                    |
| `cpu_cooler`  | Centre of the CPU socket on the motherboard surface. Model the CPU in its socket + cooler. | Everything rises toward +Z.                                                         | none                                                    |
| `psu`         | Rear bottom corner on the motherboard-tray side.                                           | Spans +X (length), +Y (height), +Z (width).                                         | none                                                    |
| `fan`         | Own origin.                                                                                | Own axes.                                                                           | none                                                    |

Notes:

- GPU: `mount_pcie` must sit within 1 mm of the origin with no rotation (the origin IS the
  mount), and must be an empty node.
- Motherboard: RAM slots are `slot_ram_1` to `slot_ram_4`; slots 1 and 2 are required, add 3 and
  4 when the board has four. Slots are placed once per stick.
- Case: `mount_motherboard` is where the motherboard's origin goes, `mount_psu` where the PSU's
  origin goes.
- Optional categories (`ram`, `cpu_cooler`, `psu`, `fan`) have no required nodes but are placed
  by their origin as described.

## 5. Optional effect nodes

| Node             | What the scene does with it                                                                                                                                          |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fan_1`..`fan_3` | Parent of the fan blades. The scene spins it around its own local Z axis, so orient the node so its Z axis is the fan's axle. Number from 1 without gaps, at most 3. |
| `rgb_*`          | Meshes with names starting `rgb_` may glow (the scene can drive their emissive colour).                                                                              |
| `label_area`     | Empty node marking where the product name is printed.                                                                                                                |

Effect nodes survive optimisation; the import fails if one would be lost.

## 6. Budgets

| Limit                       | Value                      |
| --------------------------- | -------------------------- |
| Triangles                   | 50,000 per part            |
| File size after compression | 2 MB (2,097,152 bytes)     |
| Texture size                | 2048 px on the longer side |
| Longest side of the model   | 5 to 800 mm                |

## 7. Licensing

Models are made in-house (for example in Blender) or bought with a commercial licence.
Manufacturer 3D files, logos and product renders are NOT used without written permission. Record
the licence, author and source of every model: they are required before it can be marked
verified.

## 8. Importing a model

```
pnpm models:import <file.glb> --category <category> --id <model-id> \
  [--part-ids a,b,c | --family "<maker>|<series>|<chip-id>,<chip-id>"] \
  [--scale-to-data] [--license "..."] [--author "..."] [--source "..."] \
  [--out public/models] [--dry-run]
```

- `--category`: gpu, cpu_cooler, motherboard, ram, psu, case or fan.
- `--id`: a lowercase slug for the model, such as `asus-tuf-rtx-5090`.
- `--part-ids`: the exact part ids this model is for (a GPU's id is its board id).
- `--family`: GPUs only; matches by board maker, series and chip ids instead of exact ids.
- `--dry-run`: run every step but write nothing.

Try the pipeline with the generated sample: `pnpm models:sample` writes a simple standards-
compliant GPU to `public/models/_sample/sample-gpu.glb`.

The import runs these steps and prints a tick or a cross for each. The first failure stops it,
exits with code 1 and writes nothing:

1. Arguments are valid.
2. The official glTF validator finds no errors (warnings are printed, not fatal).
3. The standard checks pass: one scene, triangles, textures, units, required nodes, mount at the
   origin, attachment nodes empty, materials, fan numbering. Each failing check says how to fix it.
4. The file is optimised (duplicates and unused data removed, vertices welded) and compressed
   with Meshopt; attachment and effect nodes must survive.
5. A low-detail version with about half the triangles is made.
6. The compressed file is within the size budget.
7. The files are written to `public/models/<category>/<id>.glb` and `<id>.lod1.glb`
   (git-ignored; served at `/models/...` in local development). Uploading to object storage is not
   set up yet.
8. A summary (triangles, bytes, size in mm) and a manifest entry are printed.

Paste the manifest entry into `data/models/manifest.json`. It has `verified: false`. Fill in
`license`, `author` and `source` (all three are required before `verified` can be `true`), look at
the model on the `/dev/models` page, then set `verified` to `true`.

## 9. The manifest and how a model is found

Each manifest entry has `id`, `applies_to`, `category`, `file`, `lod`, `scale_to_data`, `license`,
`author`, `source` and `verified`. Only verified entries are used on the public site; the
`/dev/models` page also shows unverified ones.

For each part in a build the scene looks for a model in this order:

1. **Exact**: an entry whose `part_ids` contains the part's id (for a GPU, the board's id).
2. **Family** (GPUs only): an entry whose family `maker` and `series` match the board
   (case-insensitive) and whose `chip_ids` contain the board's chip.
3. **Parametric**: no file matched, so the scene builds a simple model of the category from the
   part's dimensions.

### `scale_to_data`

A family model is drawn for one product of a line, but the line has several sizes. With
`scale_to_data: true` the scene stretches the model along its length (X) to the part's real length
from the catalog (a GPU's `length_mm`, a motherboard's form-factor width). Scaling is about the
origin, so the mount stays in place; thickness and height are not changed. Use it on family
models; leave it `false` on exact models drawn at the real size.
