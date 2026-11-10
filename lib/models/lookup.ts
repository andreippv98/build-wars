import type { SlotPart } from "@/lib/build";
import type { BuildSlot, ModelEntry } from "@/lib/schemas";
import { SLOT_CATEGORY } from "./standard";

export type ModelMatch = {
  entry: ModelEntry;
  /** exact = a model of this very product; family = of its product family, to be scaled. */
  kind: "exact" | "family";
};

/**
 * Finds the 3D model for a part, in the plan's lookup order:
 *   1. a model whose `part_ids` contains the part's id (for a GPU: the board's id);
 *   2. for GPUs, a family model whose maker, series and chip list match the board;
 *   3. null: the caller uses the parametric model of the category.
 * Only entries of the slot's category are considered. Unverified entries are skipped unless
 * `includeUnverified` (the dev test page) is set. Among several matches the first in manifest
 * order wins. Maker and series compare case-insensitively.
 */
export function findModel<S extends BuildSlot>(
  manifest: readonly ModelEntry[],
  slot: S,
  part: SlotPart[S],
  options: { includeUnverified?: boolean } = {},
): ModelMatch | null {
  const category = SLOT_CATEGORY[slot];
  const candidates = manifest.filter(
    (entry) => entry.category === category && (entry.verified || options.includeUnverified),
  );
  const id = slot === "gpu" ? (part as SlotPart["gpu"]).board.id : (part as { id: string }).id;

  for (const entry of candidates) {
    if ("part_ids" in entry.applies_to && entry.applies_to.part_ids.includes(id)) {
      return { entry, kind: "exact" };
    }
  }
  if (slot === "gpu") {
    const { board } = part as SlotPart["gpu"];
    const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
    for (const entry of candidates) {
      if (!("family" in entry.applies_to)) continue;
      const { family } = entry.applies_to;
      if (
        board.series !== undefined &&
        same(family.maker, board.maker) &&
        same(family.series, board.series) &&
        family.chip_ids.includes(board.chip_id)
      ) {
        return { entry, kind: "family" };
      }
    }
  }
  return null;
}

/**
 * URL of a model file. Absolute URLs pass through; other paths are resolved against the models
 * base URL (the CDN in production, `/models` in local development).
 */
export function modelUrl(file: string, baseUrl: string): string {
  if (/^(https?:)?\/\//.test(file) || file.startsWith("/")) return file;
  return `${baseUrl.replace(/\/+$/, "")}/${file}`;
}
