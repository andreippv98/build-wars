import { Group } from "three";
import type { SlotPart } from "@/lib/build";

/** Parametric motherboard; null gives the neutral placeholder board shown before one is chosen. (Stub.) */
export function buildMotherboardModel(board: SlotPart["motherboard"] | null): Group {
  return new Group();
}
