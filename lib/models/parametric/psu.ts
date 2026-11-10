import { Group } from "three";
import type { SlotPart } from "@/lib/build";

/** Parametric power supply. (Stub.) */
export function buildPsuModel(psu: SlotPart["psu"]): Group {
  return new Group();
}
