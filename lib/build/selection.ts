import { BUILD_SLOTS, SlugSchema, type BuildSlot } from "@/lib/schemas";

/**
 * The parts a user has chosen, by id. `gpu` holds a GPU *board* id (the chip follows from it).
 * This is the whole state of an unsaved build; it lives in the URL so it survives a refresh and
 * can be shared without an account.
 */
export type BuildSelection = Partial<Record<BuildSlot, string>>;

/** Query parameter of each slot: `/build?cpu=...&gpu=...&ram=...&mb=...&psu=...`. */
export const SLOT_PARAMS: Record<BuildSlot, string> = {
  cpu: "cpu",
  gpu: "gpu",
  ram: "ram",
  motherboard: "mb",
  psu: "psu",
};

/** Reads a selection from query parameters. Values that are not valid ids are ignored. */
export function parseSelection(params: { get(name: string): string | null }): BuildSelection {
  const selection: BuildSelection = {};
  for (const slot of BUILD_SLOTS) {
    const value = params.get(SLOT_PARAMS[slot]);
    if (value && SlugSchema.safeParse(value).success) selection[slot] = value;
  }
  return selection;
}

/** Query string without the leading "?", slots in a fixed order; "" for an empty selection. */
export function selectionToQuery(selection: BuildSelection): string {
  const params = new URLSearchParams();
  for (const slot of BUILD_SLOTS) {
    const id = selection[slot];
    if (id) params.set(SLOT_PARAMS[slot], id);
  }
  return params.toString();
}

/** Path of the configurator with this selection loaded, e.g. for "build with this" links. */
export function buildHref(selection: BuildSelection): string {
  const query = selectionToQuery(selection);
  return query ? `/build?${query}` : "/build";
}
