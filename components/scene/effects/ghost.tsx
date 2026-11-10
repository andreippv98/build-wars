"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import type { Matrix4, Object3D } from "three";
import type { SlotPart } from "@/lib/build";
import { buildParametricModel } from "@/lib/models/parametric";
import type { BuildSlot } from "@/lib/schemas";
import { useConfigurator } from "../../configurator/configurator-provider";
import { applyLook, cloneInstance, ghostify } from "./instance";
import { GHOST_FADE_SECONDS, GHOST_OPACITY } from "./motion";
import { computePlacements } from "./placements";

function GhostCopy({ object, matrix }: { object: Object3D; matrix: Matrix4 }) {
  const instance = useMemo(() => {
    const copy = cloneInstance(object);
    ghostify(copy);
    return copy;
  }, [object]);
  useEffect(() => () => instance.dispose(), [instance]);

  const fade = useRef(0);
  useFrame((_, delta) => {
    if (fade.current >= 1) return;
    fade.current = Math.min(1, fade.current + delta / GHOST_FADE_SECONDS);
    applyLook(instance, GHOST_OPACITY * fade.current, null, 0);
  });

  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <primitive object={instance.root} />
    </group>
  );
}

/**
 * The translucent preview of the part hovered in the list, in its slot. Always the parametric
 * model: it is instant and shows the size, which is what the preview is for.
 */
export function Ghost({
  slot,
  id,
  caseModel,
  boardModel,
}: {
  slot: BuildSlot;
  id: string;
  caseModel: Object3D;
  boardModel: Object3D;
}) {
  const { index } = useConfigurator();
  const part = (index.byId[slot] as Map<string, SlotPart[BuildSlot]>).get(id);
  const object = useMemo(() => (part ? buildParametricModel(slot, part) : null), [slot, part]);
  const placements = useMemo(
    () =>
      object
        ? computePlacements(
            slot,
            id,
            slot === "ram" ? (part as SlotPart["ram"]).sticks : 1,
            object,
            caseModel,
            boardModel,
          )
        : [],
    [slot, id, part, object, caseModel, boardModel],
  );
  return (
    <>
      {placements.map((placement) => (
        <GhostCopy key={placement.key} object={placement.object} matrix={placement.matrix} />
      ))}
    </>
  );
}
