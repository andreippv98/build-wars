import { Matrix4, type Object3D } from "three";
import type { ModelCategory } from "@/lib/schemas";
import { findNode, snapToSlot } from "./snap";
import { ATTACHMENT, MAX_RAM_SLOTS, NODES } from "./standard";

/**
 * Works out where each model goes inside the case, purely from attachment nodes.
 * All results are transforms in the CASE model's space.
 */

type Placeable = Exclude<ModelCategory, "case" | "fan">;

/**
 * Transform of `child` (a model of `category`) in case space, or null when the slot node it
 * needs does not exist (then it must not be drawn). `slotName` overrides the category's default
 * slot; RAM sticks pass `slot_ram_<n>`.
 */
export function placeInCase(
  caseModel: Object3D,
  boardModel: Object3D,
  category: Placeable,
  child: Object3D,
  slotName?: string,
): Matrix4 | null {
  const { parent, slot, mount } = ATTACHMENT[category];
  if (parent === "case") return snapToSlot(caseModel, slotName ?? slot, child, mount);

  const boardInCase = snapToSlot(
    caseModel,
    ATTACHMENT.motherboard.slot,
    boardModel,
    ATTACHMENT.motherboard.mount,
  );
  const onBoard = snapToSlot(boardModel, slotName ?? slot, child, mount);
  if (!boardInCase || !onBoard) return null;
  return new Matrix4().multiplyMatrices(boardInCase, onBoard);
}

/** How many `slot_ram_<n>` nodes a motherboard model has (counted from 1, stopping at a gap). */
export function ramSlotCount(boardModel: Object3D): number {
  let count = 0;
  while (count < MAX_RAM_SLOTS && findNode(boardModel, NODES.slotRam(count + 1))) count += 1;
  return count;
}

/**
 * Which RAM slots (1-based) the sticks of a kit go into. Follows the usual practice on a
 * four-slot board: one stick in slot 2, two sticks in slots 2 and 4. Sticks beyond the number of
 * slots are not drawn (the compatibility check reports that case).
 */
export function ramSlotNumbers(sticks: number, slots: number): number[] {
  const count = Math.max(0, Math.min(sticks, slots));
  if (slots >= 4 && count === 1) return [2];
  if (slots >= 4 && count === 2) return [2, 4];
  return Array.from({ length: count }, (_, i) => i + 1);
}
