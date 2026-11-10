"use client";

import { useCursor } from "@react-three/drei";
import { useState } from "react";
import type { Matrix4 } from "three";
import { DIMENSIONS } from "@/lib/models/standard";
import { slotEnvelope, type SlotCategory } from "@/lib/models/envelope";
import { BoxOutline, PlusMarker } from "./outline";

const IDLE = { color: "#9aa6c8", opacity: 0.85 };
const HOVER = { color: "#e0e7ff", opacity: 1 };
const ACTIVE = { color: "#ffffff", opacity: 1 };

/** Markers grow with the slot but stay within a readable range (mm). */
const PLUS_ARM = { ratio: 0.08, min: 6, max: 24 };

/**
 * Categories whose click target is only a thin slab at the envelope's floor, so it cannot shadow
 * the slots that sit on top of it (a board's slot boxes rise out of the board).
 */
const FLAT_HIT: Partial<Record<SlotCategory, number>> = { motherboard: DIMENSIONS.pcbThickness };

/**
 * An empty slot: a dashed box the size of a typical part, with a "+", that opens the part list
 * for the slot when clicked. Positioned by `matrix` (the slot's frame from the attachment nodes).
 */
export function EmptySlot({
  category,
  matrix,
  active,
  onActivate,
}: {
  category: SlotCategory;
  matrix: Matrix4;
  active: boolean;
  onActivate: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const { min, max } = slotEnvelope(category);
  const look = hovered ? HOVER : active ? ACTIVE : IDLE;
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]] as const;
  const longest = Math.max(...size);
  const arm = Math.min(PLUS_ARM.max, Math.max(PLUS_ARM.min, longest * PLUS_ARM.ratio));
  const hitDepth = FLAT_HIT[category] ?? size[2];

  return (
    <group matrix={matrix} matrixAutoUpdate={false}>
      <BoxOutline min={min} max={max} color={look.color} opacity={look.opacity} dashed />
      <PlusMarker
        position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}
        arm={arm}
        color={look.color}
        opacity={look.opacity}
      />
      <mesh
        position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, min[2] + hitDepth / 2]}
        onClick={(event) => {
          event.stopPropagation();
          onActivate();
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[size[0], size[1], hitDepth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
      </mesh>
    </group>
  );
}
