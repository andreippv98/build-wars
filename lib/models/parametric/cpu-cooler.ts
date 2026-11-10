import { Group } from "three";
import type { SlotPart } from "@/lib/build";

/** CPU in its socket under a generic cooler. (Stub.) */
export function buildCpuCoolerModel(cpu: SlotPart["cpu"]): Group {
  return new Group();
}
