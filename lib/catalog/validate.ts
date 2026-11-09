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
  void catalog;
  throw new Error("not implemented");
}
