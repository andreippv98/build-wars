import type { ModelCategory } from "@/lib/schemas";
import { DIMENSIONS } from "./standard";

/** The categories that sit in a slot of the case (everything except the case and loose fans). */
export type SlotCategory = Exclude<ModelCategory, "case" | "fan">;

/** An axis-aligned box in a category's own model frame, in mm. */
export type Envelope = { min: [number, number, number]; max: [number, number, number] };

/**
 * Typical sizes where `DIMENSIONS` has no number: a graphics card's length, a tower cooler's
 * footprint and height, and how far components rise above a motherboard.
 */
const TYPICAL = {
  gpuLength: 300,
  cooler: { width: 90, depth: 130, height: 160 },
  boardComponentHeight: 40,
} as const;

/**
 * The space a part of each category typically fills, in the same frame as the models of that
 * category (see `standard.ts`), so placing it with the category's mount convention puts it
 * where the real part would go. The scene draws it as the outline of an empty slot and frames
 * the camera on it. Add a category here and the scene handles it with no other change.
 */
export function slotEnvelope(category: SlotCategory): Envelope {
  switch (category) {
    case "gpu":
      // Rear end of the PCIe connector at the origin; two slots thick, fans toward -Y.
      return {
        min: [0, -2 * DIMENSIONS.slotPitch, 0],
        max: [TYPICAL.gpuLength, 0, DIMENSIONS.gpuHeight],
      };
    case "ram": {
      const { length, thickness, bareHeight } = DIMENSIONS.ramStick;
      return {
        min: [-thickness / 2, -length / 2, 0],
        max: [thickness / 2, length / 2, bareHeight],
      };
    }
    case "cpu_cooler": {
      const { width, depth, height } = TYPICAL.cooler;
      return { min: [-width / 2, -depth / 2, 0], max: [width / 2, depth / 2, height] };
    }
    case "psu": {
      const { length, height, width } = DIMENSIONS.psu;
      return { min: [0, 0, 0], max: [length, height, width] };
    }
    case "motherboard": {
      const { width, height } = DIMENSIONS.motherboard.ATX;
      return { min: [0, -height, 0], max: [width, 0, TYPICAL.boardComponentHeight] };
    }
  }
}
