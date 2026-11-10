"use client";

import type { ReactNode } from "react";
import type { Matrix4, Object3D } from "three";
import type { BuildSlot } from "@/lib/schemas";

/**
 * One model at its snapped place in the case. The outer group carries the placement (from the
 * attachment nodes) and is never animated; `children` wraps or accompanies the model so effects
 * (enter animation, highlight, ghost) can be layered on without touching placement.
 */
export function PlacedPart({
  slot,
  object,
  matrix,
  children,
}: {
  slot: BuildSlot;
  object: Object3D;
  matrix: Matrix4;
  /** Rendered inside the placement group, next to the model. */
  children?: ReactNode;
}) {
  return (
    <group matrix={matrix} matrixAutoUpdate={false} userData={{ slot }}>
      <primitive object={object} />
      {children}
    </group>
  );
}
