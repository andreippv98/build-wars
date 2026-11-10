"use client";

import { Billboard } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  EdgesGeometry,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
} from "three";

const DASH = 6;
const GAP = 5;
const OUTLINE_RENDER_ORDER = 10;

function tint(material: LineBasicMaterial, color: string, opacity: number) {
  material.color.set(color);
  material.opacity = opacity;
}

/**
 * The twelve edges of a box, in the frame of the group it sits in. Dashed for the outline of an
 * empty slot, solid for the outline around a part. Drawn over the scene (no depth test) so it
 * stays readable inside the case.
 */
export function BoxOutline({
  min,
  max,
  color,
  opacity = 1,
  dashed = false,
}: {
  min: readonly [number, number, number];
  max: readonly [number, number, number];
  color: string;
  opacity?: number;
  dashed?: boolean;
}) {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const lines = useMemo(() => {
    const box = new BoxGeometry(x1 - x0, y1 - y0, z1 - z0);
    const edges = new EdgesGeometry(box);
    box.dispose();
    edges.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    const material = dashed
      ? new LineDashedMaterial({ dashSize: DASH, gapSize: GAP })
      : new LineBasicMaterial();
    material.transparent = true;
    material.depthTest = false;
    const segments = new LineSegments(edges, material);
    segments.renderOrder = OUTLINE_RENDER_ORDER;
    if (dashed) segments.computeLineDistances();
    // Outlines are decoration: they never take a click.
    segments.raycast = () => {};
    return segments;
  }, [x0, y0, z0, x1, y1, z1, dashed]);

  useEffect(() => {
    tint(lines.material as LineBasicMaterial, color, opacity);
  }, [lines, color, opacity]);

  useEffect(
    () => () => {
      lines.geometry.dispose();
      (lines.material as LineBasicMaterial).dispose();
    },
    [lines],
  );

  return <primitive object={lines} />;
}

/** Thickness of the "+" strokes relative to their length. */
const PLUS_STROKE = 0.28;

/** A "+" that always faces the camera, `arm` mm long on each side. */
export function PlusMarker({
  position,
  arm,
  color,
  opacity = 1,
}: {
  position: readonly [number, number, number];
  arm: number;
  color: string;
  opacity?: number;
}) {
  const stroke = arm * PLUS_STROKE;
  return (
    <Billboard position={[position[0], position[1], position[2]]}>
      {[
        [2 * arm, stroke],
        [stroke, 2 * arm],
      ].map(([width, height]) => (
        <mesh key={width} renderOrder={OUTLINE_RENDER_ORDER} raycast={() => {}}>
          <planeGeometry args={[width, height]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={opacity}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </Billboard>
  );
}
