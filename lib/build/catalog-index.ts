import { resolveMotherboard } from "@/lib/catalog/resolve";
import type { Build } from "@/lib/engine";
import {
  BUILD_SLOTS,
  type BuildSlot,
  type Catalog,
  type Cpu,
  type GpuBoard,
  type GpuChip,
  type Psu,
  type RamKit,
  type ResolvedMotherboard,
} from "@/lib/schemas";
import type { BuildSelection } from "./selection";

/** The catalog as sent to the browser: every part collection, no 3D model manifest. */
export type ClientCatalog = Omit<Catalog, "models">;

/** What sits in each slot of a build once ids are resolved to records. */
export type SlotPart = {
  cpu: Cpu;
  gpu: { chip: GpuChip; board: GpuBoard };
  ram: RamKit;
  motherboard: ResolvedMotherboard;
  psu: Psu;
};

/**
 * Lookup tables over the catalog. `parts[slot]` lists everything selectable for a slot, already
 * in engine shape: GPUs as board + chip pairs, motherboards with their CPU support resolved.
 * A part's id for selection purposes is `partId(slot, part)`.
 */
export type CatalogIndex = {
  parts: { [S in BuildSlot]: SlotPart[S][] };
  byId: { [S in BuildSlot]: Map<string, SlotPart[S]> };
  chips: Map<string, GpuChip>;
};

export function partId<S extends BuildSlot>(slot: S, part: SlotPart[S]): string {
  return slot === "gpu" ? (part as SlotPart["gpu"]).board.id : (part as { id: string }).id;
}

/** Builds the index. Assumes a catalog that passed `validateCatalog`. */
export function indexCatalog(catalog: ClientCatalog): CatalogIndex {
  const chips = new Map(catalog.gpu_chips.map((chip) => [chip.id, chip]));
  const chipsets = new Map(catalog.chipsets.map((chipset) => [chipset.id, chipset]));
  const parts: CatalogIndex["parts"] = {
    cpu: catalog.cpus,
    gpu: catalog.gpu_boards.flatMap((board) => {
      const chip = chips.get(board.chip_id);
      return chip ? [{ chip, board }] : [];
    }),
    ram: catalog.ram_kits,
    motherboard: catalog.motherboards.flatMap((board) => {
      const chipset = chipsets.get(board.chipset_id);
      return chipset ? [resolveMotherboard(board, chipset)] : [];
    }),
    psu: catalog.psus,
  };
  const mapOf = <S extends BuildSlot>(slot: S) =>
    new Map(parts[slot].map((part) => [partId(slot, part), part]));
  return {
    parts,
    byId: {
      cpu: mapOf("cpu"),
      gpu: mapOf("gpu"),
      ram: mapOf("ram"),
      motherboard: mapOf("motherboard"),
      psu: mapOf("psu"),
    },
    chips,
  };
}

/**
 * Turns a selection of ids into an engine `Build`. Ids that are not in the catalog are left out
 * of the build and reported in `unknown`.
 */
export function resolveBuild(
  selection: BuildSelection,
  index: CatalogIndex,
): { build: Build; unknown: BuildSlot[] } {
  const build: Build = {};
  const unknown: BuildSlot[] = [];
  const assign = <S extends BuildSlot>(slot: S) => {
    const id = selection[slot];
    if (!id) return;
    const part = index.byId[slot].get(id);
    if (part) (build as SlotPart)[slot] = part;
    else unknown.push(slot);
  };
  for (const slot of BUILD_SLOTS) assign(slot);
  return { build, unknown };
}
