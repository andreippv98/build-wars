import type { Document, vec3, vec4 } from "@gltf-transform/core";
import { getBounds } from "@gltf-transform/functions";
import { Euler, MathUtils, Quaternion } from "three";

/**
 * Brings a foreign glTF document into the model standard's frame without touching its geometry:
 * everything in the scene goes under one new node that rotates, scales and moves it, and the
 * attachment nodes asked for are added at the scene root. Used by `pnpm models:align`.
 */

export type Anchor = { mode: "min" | "max" | "center"; offset: number };

export type AlignOptions = {
  rotateDeg: vec3;
  lengthMm: number;
  anchor: [Anchor, Anchor, Anchor];
  addNodes: { name: string; position: vec3 }[];
};

export function parseAnchor(text: string): Anchor {
  const match = /^(min|max|center)([+-]\d+(\.\d+)?)?$/.exec(text.trim());
  if (!match) throw new Error(`Bad anchor "${text}". Use min, max or center, e.g. "min+12".`);
  return { mode: match[1] as Anchor["mode"], offset: match[2] ? Number(match[2]) : 0 };
}

/** Wraps the scene's content in an aligning node and adds the attachment nodes. */
export function alignDocument(document: Document, options: AlignOptions): { sizeMm: vec3 } {
  const scene = document.getRoot().listScenes()[0];
  if (!scene) throw new Error("The file has no scene.");

  const wrapper = document.createNode("aligned_model");
  for (const child of scene.listChildren()) wrapper.addChild(child);
  scene.addChild(wrapper);

  const [rx, ry, rz] = options.rotateDeg.map((d) => MathUtils.degToRad(d));
  // Intrinsic ZYX equals rotating about the fixed X axis first, then Y, then Z.
  const q = new Quaternion().setFromEuler(new Euler(rx, ry, rz, "ZYX"));
  wrapper.setRotation([q.x, q.y, q.z, q.w] as vec4);

  const rotated = getBounds(scene);
  const length = rotated.max[0] - rotated.min[0];
  if (!(length > 0)) throw new Error("The model has no extent along X after rotation.");
  const scale = options.lengthMm / length;
  wrapper.setScale([scale, scale, scale]);

  const scaled = getBounds(scene);
  const origin = [0, 1, 2].map((axis) => {
    const { mode, offset } = options.anchor[axis];
    const min = scaled.min[axis];
    const max = scaled.max[axis];
    const base = mode === "min" ? min : mode === "max" ? max : (min + max) / 2;
    return base + offset;
  }) as vec3;
  wrapper.setTranslation([-origin[0], -origin[1], -origin[2]]);

  for (const { name, position } of options.addNodes) {
    scene.addChild(document.createNode(name).setTranslation(position));
  }

  const final = getBounds(scene);
  return { sizeMm: [0, 1, 2].map((a) => final.max[a] - final.min[a]) as vec3 };
}
