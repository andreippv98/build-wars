import { Box3, Object3D, Vector3, type Matrix4 } from "three";
import { placeInCase, ramSlotCount, ramSlotNumbers } from "@/lib/models/assemble";
import { slotEnvelope, type SlotCategory } from "@/lib/models/envelope";
import { NODES, SLOT_CATEGORY } from "@/lib/models/standard";
import type { BuildSlot } from "@/lib/schemas";

/** One model at its place in the case. `key` is stable while the same part stays in the slot. */
export type Placement = { key: string; object: Object3D; matrix: Matrix4 };

/** Where the model of a chosen part goes. RAM gives one placement per stick. */
export function computePlacements(
  slot: BuildSlot,
  id: string,
  sticks: number,
  object: Object3D,
  caseModel: Object3D,
  boardModel: Object3D,
): Placement[] {
  const category = SLOT_CATEGORY[slot];
  if (category === "case" || category === "fan") return [];
  if (slot === "ram") {
    return ramSlotNumbers(sticks, ramSlotCount(boardModel)).flatMap((n) => {
      const matrix = placeInCase(caseModel, boardModel, "ram", object, NODES.slotRam(n));
      return matrix ? [{ key: `ram:${id}:${n}`, object, matrix }] : [];
    });
  }
  const matrix = placeInCase(caseModel, boardModel, category, object);
  return matrix ? [{ key: `${slot}:${id}`, object, matrix }] : [];
}

export type SlotFrame = { key: string; matrix: Matrix4; category: SlotCategory };

/**
 * Where a slot is, whatever sits in it: the placement of an empty node. `which` "fill" gives the
 * RAM slots a two-stick kit fills; "all" gives every RAM slot of the board.
 */
export function slotFrames(
  caseModel: Object3D,
  boardModel: Object3D,
  slot: BuildSlot,
  which: "fill" | "all",
): SlotFrame[] {
  const category = SLOT_CATEGORY[slot];
  if (category === "case" || category === "fan") return [];
  const probe = new Object3D();
  if (slot === "ram") {
    const count = ramSlotCount(boardModel);
    const numbers =
      which === "fill" ? ramSlotNumbers(2, count) : Array.from({ length: count }, (_, i) => i + 1);
    return numbers.flatMap((n) => {
      const matrix = placeInCase(caseModel, boardModel, "ram", probe, NODES.slotRam(n));
      return matrix ? [{ key: `ram-${n}`, matrix, category }] : [];
    });
  }
  const matrix = placeInCase(caseModel, boardModel, category, probe);
  return matrix ? [{ key: slot, matrix, category }] : [];
}

/** The box a slot's envelope covers in case space, over all the frames given (null if none). */
export function frameBox(frames: SlotFrame[]): Box3 | null {
  if (frames.length === 0) return null;
  const box = new Box3();
  for (const frame of frames) {
    const { min, max } = slotEnvelope(frame.category);
    box.union(new Box3().set(vec(min), vec(max)).applyMatrix4(frame.matrix));
  }
  return box;
}

function vec([x, y, z]: readonly [number, number, number]) {
  return new Vector3(x, y, z);
}
