import type { Object3D } from "three";
import type { SlotPart } from "@/lib/build";
import type { BuildSlot } from "@/lib/schemas";
import { modelBounds } from "./snap";
import { DIMENSIONS } from "./standard";

/**
 * The real dimensions the catalog knows for a part, per axis of the model standard (mm).
 * Only axes the data actually covers are present.
 */
export function dataDimensions<S extends BuildSlot>(
  slot: S,
  part: SlotPart[S],
): { x?: number; y?: number; z?: number } {
  if (slot === "gpu") {
    const { board } = part as SlotPart["gpu"];
    return { x: board.length_mm, y: board.slots * DIMENSIONS.slotPitch };
  }
  if (slot === "motherboard") {
    const size = DIMENSIONS.motherboard[(part as SlotPart["motherboard"]).form_factor];
    return { x: size.width, y: size.height };
  }
  return {};
}

/**
 * `scale_to_data`: stretches a model so its length (X) matches the part's real length. Used for
 * family models, which are drawn for one size of a product line. Scaling is about the model's
 * origin (its mount), so the mount stays put. Thickness and height are left as modelled.
 * Returns the factor applied (1 when the data has no length or the model is empty).
 */
export function scaleToData<S extends BuildSlot>(
  model: Object3D,
  slot: S,
  part: SlotPart[S],
): number {
  const target = dataDimensions(slot, part).x;
  if (!target) return 1;
  const bounds = modelBounds(model);
  // Length is measured from the mount (origin) forward, like `length_mm` on a card.
  const length = bounds.max.x - Math.min(0, bounds.min.x);
  if (!(length > 0)) return 1;
  const factor = target / length;
  model.scale.x *= factor;
  return factor;
}

export type DimensionMismatch = { axis: "x" | "y" | "z"; modelMm: number; dataMm: number };

/**
 * Compares a model's size with the catalog's data, for the `/dev/models` page
 * ("model 285 mm long, catalog says 304 mm"). Differences within `tolerance` (a fraction) pass.
 */
export function dimensionMismatches<S extends BuildSlot>(
  model: Object3D,
  slot: S,
  part: SlotPart[S],
  tolerance = 0.03,
): DimensionMismatch[] {
  const data = dataDimensions(slot, part);
  const bounds = modelBounds(model);
  const size = {
    x: bounds.max.x - bounds.min.x,
    y: bounds.max.y - bounds.min.y,
    z: bounds.max.z - bounds.min.z,
  };
  const out: DimensionMismatch[] = [];
  for (const axis of ["x", "y", "z"] as const) {
    const dataMm = data[axis];
    if (dataMm === undefined) continue;
    if (Math.abs(size[axis] - dataMm) > dataMm * tolerance) {
      out.push({ axis, modelMm: Math.round(size[axis]), dataMm: Math.round(dataMm) });
    }
  }
  return out;
}
