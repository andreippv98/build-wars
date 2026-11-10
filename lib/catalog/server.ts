import path from "node:path";
import type { ClientCatalog } from "@/lib/build";
import type { Catalog } from "@/lib/schemas";
import { loadCatalog } from "./load";

/**
 * The catalog for server rendering, read from the JSON files under `data/` and cached.
 * The site serves the catalog from these files (they ship with every deploy); the database copy
 * made by `pnpm data:import` exists so builds can reference parts.
 */
export async function getCatalog(): Promise<Catalog> {
  "use cache";
  const { catalog, issues } = await loadCatalog(path.join(process.cwd(), "data"));
  if (!catalog || issues.length > 0) {
    throw new Error(
      `The catalog in data/ is invalid (${issues.length} issues). Run pnpm data:validate.`,
    );
  }
  return catalog;
}

/** The part of the catalog the configurator needs in the browser. */
export async function getClientCatalog(): Promise<ClientCatalog> {
  const { cpus, gpu_chips, gpu_boards, chipsets, motherboards, ram_kits, psus } =
    await getCatalog();
  return { cpus, gpu_chips, gpu_boards, chipsets, motherboards, ram_kits, psus };
}
