import type { Catalog, CatalogIssue } from "@/lib/schemas";

/**
 * Cross-reference checks on a catalog that already passed its Zod schemas. Pure: no I/O.
 * Returns every issue found (empty array = valid).
 *
 * Checks:
 *  1. Ids are unique within each collection (cpus, gpu_chips, gpu_boards, chipsets, motherboards,
 *     ram_kits, psus, models).
 *  2. Slugs are unique within cpus, gpu_chips, motherboards and psus; a gpu_board slug is unique
 *     among boards of the same chip.
 *  3. gpu_board.chip_id points to an existing gpu chip.
 *  4. motherboard.chipset_id points to an existing chipset, and motherboard.socket equals that
 *     chipset's socket.
 *  5. Every cpu_support entry (on chipsets and motherboards) with a cpu_id points to an existing
 *     CPU, and that CPU's socket equals the chipset's / motherboard's socket.
 *  6. cpu.max_mem_speed has exactly the keys listed in cpu.mem_types; mem_types has no duplicates.
 *  7. cpu.threads >= cpu.cores; cpu.boost_ghz >= cpu.base_ghz; ram_kit.capacity_gb is divisible
 *     by ram_kit.sticks.
 *  8. Model manifest: every `part_ids` entry exists in the collection matching the model's
 *     category (gpu -> gpu_boards, motherboard -> motherboards, ram -> ram_kits, psu -> psus;
 *     cpu_cooler, case and fan have no catalog collection in v1 and are not checked); every family
 *     `chip_ids` entry is an existing gpu chip, and family rules are only allowed on category gpu.
 */
export function validateCatalog(catalog: Catalog): CatalogIssue[] {
  const issues: CatalogIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  // 1. Unique ids per collection.
  const collections = [
    "cpus",
    "gpu_chips",
    "gpu_boards",
    "chipsets",
    "motherboards",
    "ram_kits",
    "psus",
    "models",
  ] as const;
  for (const name of collections) {
    const seen = new Set<string>();
    catalog[name].forEach((record, i) => {
      if (seen.has(record.id)) {
        add(`${name}[${i}].id`, `Duplicate id "${record.id}" in ${name}.`);
      }
      seen.add(record.id);
    });
  }

  // 2. Unique slugs.
  for (const name of ["cpus", "gpu_chips", "motherboards", "psus"] as const) {
    const seen = new Set<string>();
    catalog[name].forEach((record, i) => {
      if (seen.has(record.slug)) {
        add(
          `${name}[${i}].slug`,
          `Duplicate slug "${record.slug}" in ${name} (id "${record.id}").`,
        );
      }
      seen.add(record.slug);
    });
  }
  const boardSlugs = new Set<string>();
  catalog.gpu_boards.forEach((board, i) => {
    const key = `${board.chip_id}\u0000${board.slug}`;
    if (boardSlugs.has(key)) {
      add(
        `gpu_boards[${i}].slug`,
        `Duplicate slug "${board.slug}" among boards of chip "${board.chip_id}" (board "${board.id}").`,
      );
    }
    boardSlugs.add(key);
  });

  // 3. Board -> chip.
  const chipIds = new Set(catalog.gpu_chips.map((c) => c.id));
  catalog.gpu_boards.forEach((board, i) => {
    if (!chipIds.has(board.chip_id)) {
      add(
        `gpu_boards[${i}].chip_id`,
        `GPU board "${board.id}" points to chip "${board.chip_id}", which does not exist.`,
      );
    }
  });

  // 4. Motherboard -> chipset, socket match.
  const chipsetsById = new Map(catalog.chipsets.map((c) => [c.id, c]));
  catalog.motherboards.forEach((board, i) => {
    const chipset = chipsetsById.get(board.chipset_id);
    if (!chipset) {
      add(
        `motherboards[${i}].chipset_id`,
        `Motherboard "${board.id}" points to chipset "${board.chipset_id}", which does not exist.`,
      );
    } else if (chipset.socket !== board.socket) {
      add(
        `motherboards[${i}].socket`,
        `Motherboard "${board.id}" has socket ${board.socket} but its chipset "${chipset.id}" has socket ${chipset.socket}.`,
      );
    }
  });

  // 5. cpu_support cpu_id entries.
  const cpusById = new Map(catalog.cpus.map((c) => [c.id, c]));
  const checkSupport = (
    path: string,
    ownerKind: string,
    ownerId: string,
    ownerSocket: string,
    support: Catalog["chipsets"][number]["cpu_support"] | undefined,
  ) => {
    support?.forEach((entry, j) => {
      if (entry.cpu_id === undefined) return;
      const cpu = cpusById.get(entry.cpu_id);
      if (!cpu) {
        add(
          `${path}[${j}].cpu_id`,
          `CPU support of ${ownerKind} "${ownerId}" lists CPU "${entry.cpu_id}", which does not exist.`,
        );
      } else if (cpu.socket !== ownerSocket) {
        add(
          `${path}[${j}].cpu_id`,
          `CPU support of ${ownerKind} "${ownerId}" lists CPU "${cpu.id}" (socket ${cpu.socket}), but the ${ownerKind} has socket ${ownerSocket}.`,
        );
      }
    });
  };
  catalog.chipsets.forEach((chipset, i) =>
    checkSupport(
      `chipsets[${i}].cpu_support`,
      "chipset",
      chipset.id,
      chipset.socket,
      chipset.cpu_support,
    ),
  );
  catalog.motherboards.forEach((board, i) =>
    checkSupport(
      `motherboards[${i}].cpu_support`,
      "motherboard",
      board.id,
      board.socket,
      board.cpu_support,
    ),
  );

  // 6 and 7. CPU and RAM sanity.
  catalog.cpus.forEach((cpu, i) => {
    if (new Set(cpu.mem_types).size !== cpu.mem_types.length) {
      add(`cpus[${i}].mem_types`, `CPU "${cpu.id}" lists the same memory type more than once.`);
    }
    const wanted = [...new Set(cpu.mem_types)].sort();
    const actual = Object.keys(cpu.max_mem_speed).sort();
    if (wanted.join(",") !== actual.join(",")) {
      add(
        `cpus[${i}].max_mem_speed`,
        `CPU "${cpu.id}" has max_mem_speed for [${actual.join(", ")}] but mem_types is [${wanted.join(", ")}]; they must match.`,
      );
    }
    if (cpu.threads < cpu.cores) {
      add(
        `cpus[${i}].threads`,
        `CPU "${cpu.id}" has ${cpu.threads} threads but ${cpu.cores} cores; threads cannot be fewer than cores.`,
      );
    }
    if (cpu.boost_ghz < cpu.base_ghz) {
      add(
        `cpus[${i}].boost_ghz`,
        `CPU "${cpu.id}" has boost clock ${cpu.boost_ghz} GHz below base clock ${cpu.base_ghz} GHz.`,
      );
    }
  });
  catalog.ram_kits.forEach((kit, i) => {
    if (kit.capacity_gb % kit.sticks !== 0) {
      add(
        `ram_kits[${i}].capacity_gb`,
        `RAM kit "${kit.id}" has ${kit.capacity_gb} GB that cannot be split evenly across ${kit.sticks} sticks.`,
      );
    }
  });

  // 8. Model manifest references.
  const byCategory = {
    gpu: new Set(catalog.gpu_boards.map((b) => b.id)),
    motherboard: new Set(catalog.motherboards.map((b) => b.id)),
    ram: new Set(catalog.ram_kits.map((k) => k.id)),
    psu: new Set(catalog.psus.map((p) => p.id)),
  } as const;
  const collectionName = {
    gpu: "gpu_boards",
    motherboard: "motherboards",
    ram: "ram_kits",
    psu: "psus",
  } as const;
  catalog.models.forEach((model, i) => {
    if ("part_ids" in model.applies_to) {
      const category = model.category;
      if (category in byCategory) {
        const known = byCategory[category as keyof typeof byCategory];
        model.applies_to.part_ids.forEach((partId, j) => {
          if (!known.has(partId)) {
            add(
              `models[${i}].applies_to.part_ids[${j}]`,
              `Model "${model.id}" (${category}) lists part "${partId}", which is not in ${collectionName[category as keyof typeof collectionName]}.`,
            );
          }
        });
      }
    } else {
      const { family } = model.applies_to;
      if (model.category !== "gpu") {
        add(
          `models[${i}].applies_to.family`,
          `Model "${model.id}" has category ${model.category} but uses a family rule; family rules are only allowed on gpu models.`,
        );
      }
      family.chip_ids.forEach((chipId, j) => {
        if (!chipIds.has(chipId)) {
          add(
            `models[${i}].applies_to.family.chip_ids[${j}]`,
            `Model "${model.id}" family rule lists chip "${chipId}", which does not exist.`,
          );
        }
      });
    }
  });

  return issues;
}
