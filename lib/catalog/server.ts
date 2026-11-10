import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ClientCatalog } from "@/lib/build";
import { ModelManifestSchema, type Catalog, type ModelEntry } from "@/lib/schemas";
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

/**
 * Models for trying out on this machine only: `data/models/manifest.local.json`, same format as
 * the manifest, git-ignored, with files under `public/models/`. Missing file = none.
 */
export async function getLocalModels(): Promise<ModelEntry[]> {
  "use cache";
  let text: string;
  try {
    text = await readFile(path.join(process.cwd(), "data/models/manifest.local.json"), "utf8");
  } catch {
    return [];
  }
  const parsed = ModelManifestSchema.safeParse(JSON.parse(text));
  if (!parsed.success) {
    throw new Error(`data/models/manifest.local.json is invalid: ${parsed.error.message}`);
  }
  return parsed.data;
}

/**
 * 3D models the configurator scene may use: the manifest's entries approved on the model test
 * page, plus, under `pnpm dev` only, the local try-out models (which never ship: a production
 * build ignores them).
 */
export async function getPublicModels(): Promise<ModelEntry[]> {
  const published = (await getCatalog()).models.filter((model) => model.verified);
  if (process.env.NODE_ENV !== "development") return published;
  const local = (await getLocalModels()).map((model) => ({ ...model, verified: true }));
  return [...local, ...published];
}
