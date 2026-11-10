"use client";

import { useEffect, useMemo } from "react";
import { Matrix4, Vector3, type Object3D } from "three";
import { labelTexture } from "@/lib/models/parametric/shared";
import { findNode, modelBounds, nodeMatrix } from "@/lib/models/snap";
import { NODES } from "@/lib/models/standard";

/** How far above its anchor the label floats, and its size, in mm. */
const LIFT = 22;
const HEIGHT = 20;
const TEXTURE = { width: 512, height: 96 };

/**
 * The part's name on a small floating label, anchored at `label_area` or the top of the model.
 * Drawn as a sprite inside the scene (always facing the camera, never hidden behind parts).
 */
export function FloatingLabel({ object, text }: { object: Object3D; text: string }) {
  const position = useMemo<[number, number, number]>(() => {
    const node = findNode(object, NODES.labelArea);
    if (node) {
      const p = new Vector3().setFromMatrixPosition(new Matrix4().copy(nodeMatrix(object, node)));
      return [p.x, p.y, p.z + LIFT];
    }
    const bounds = modelBounds(object);
    if (bounds.isEmpty()) return [0, 0, LIFT];
    const centre = bounds.getCenter(new Vector3());
    return [centre.x, centre.y, bounds.max.z + LIFT];
  }, [object]);

  const texture = useMemo(
    () => labelTexture([text], { ...TEXTURE, color: "#f4f4f5", background: "rgba(9,9,11,0.72)" }),
    [text],
  );
  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;

  return (
    <sprite
      position={position}
      scale={[(HEIGHT * TEXTURE.width) / TEXTURE.height, HEIGHT, 1]}
      renderOrder={10}
      raycast={() => null}
    >
      <spriteMaterial map={texture} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}
