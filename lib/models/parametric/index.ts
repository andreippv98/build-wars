import type { Object3D } from "three";
import type { SlotPart } from "@/lib/build";
import type { BuildSlot } from "@/lib/schemas";
import { buildCpuCoolerModel } from "./cpu-cooler";
import { buildGpuModel } from "./gpu";
import { buildMotherboardModel } from "./motherboard";
import { buildPsuModel } from "./psu";
import { buildRamStickModel } from "./ram";

export { buildCaseModel } from "./case";
export {
  buildCpuCoolerModel,
  buildGpuModel,
  buildMotherboardModel,
  buildPsuModel,
  buildRamStickModel,
};

/**
 * The parametric model of a part: the last step of the lookup order, and the placeholder shown
 * while a real model loads. For RAM this is ONE stick; the scene places it once per stick.
 */
export function buildParametricModel<S extends BuildSlot>(slot: S, part: SlotPart[S]): Object3D {
  switch (slot) {
    case "cpu":
      return buildCpuCoolerModel(part as SlotPart["cpu"]);
    case "gpu":
      return buildGpuModel(part as SlotPart["gpu"]);
    case "ram":
      return buildRamStickModel(part as SlotPart["ram"]);
    case "motherboard":
      return buildMotherboardModel(part as SlotPart["motherboard"]);
    default:
      return buildPsuModel(part as SlotPart["psu"]);
  }
}
