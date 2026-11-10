import { Box3, Matrix4, Vector3, type Object3D } from "three";

/**
 * Attachment-point snapping. Works on any Object3D, parametric or loaded from a `.glb`.
 * Nothing here knows about part categories or products.
 */

/** The named attachment node inside a model, or null. */
export function findNode(model: Object3D, name: string): Object3D | null {
  return model.getObjectByName(name) ?? null;
}

/** A node's transform relative to the root of its model (the root's own transform excluded). */
export function nodeMatrix(model: Object3D, node: Object3D): Matrix4 {
  const matrix = new Matrix4();
  let current: Object3D | null = node;
  while (current && current !== model) {
    current.updateMatrix();
    matrix.premultiply(current.matrix);
    current = current.parent;
  }
  if (current !== model) throw new Error(`"${node.name}" is not inside the model`);
  return matrix;
}

/**
 * The transform to give a child model, in its parent model's space, so that the child's mount
 * coincides with the parent's slot: `slot x inverse(mount)`.
 * Both arguments are relative to their own model's root (see `nodeMatrix`).
 */
export function snapMatrix(parentSlot: Matrix4, childMount: Matrix4): Matrix4 {
  return new Matrix4().multiplyMatrices(parentSlot, new Matrix4().copy(childMount).invert());
}

/**
 * Transform that places `child` on `parent`'s slot node, in the parent model's space.
 * `mountName` null (or a mount node the child lacks) means the child's origin is its mount.
 * Returns null when the parent has no such slot: the caller must not draw the child there.
 */
export function snapToSlot(
  parent: Object3D,
  slotName: string,
  child: Object3D,
  mountName: string | null,
): Matrix4 | null {
  const slot = findNode(parent, slotName);
  if (!slot) return null;
  const mount = mountName ? findNode(child, mountName) : null;
  return snapMatrix(nodeMatrix(parent, slot), mount ? nodeMatrix(child, mount) : new Matrix4());
}

/** Size of a model's geometry in its own space (its root transform excluded), in mm. */
export function modelSize(model: Object3D): Vector3 {
  return modelBounds(model).getSize(new Vector3());
}

/** Bounding box of a model's geometry in its own space (its root transform excluded). */
export function modelBounds(model: Object3D): Box3 {
  const box = new Box3();
  const saved = model.matrix.clone();
  const savedAuto = model.matrixAutoUpdate;
  // Measure as if the root were untransformed.
  model.matrixAutoUpdate = false;
  model.matrix.identity();
  model.updateMatrixWorld(true);
  const inverseParent = model.parent
    ? new Matrix4().copy(model.parent.matrixWorld).invert()
    : new Matrix4();
  model.traverse((object) => {
    const mesh = object as {
      isMesh?: boolean;
      geometry?: { boundingBox: Box3 | null; computeBoundingBox(): void };
    };
    if (!mesh.isMesh || !mesh.geometry) return;
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const local = mesh.geometry.boundingBox;
    if (!local) return;
    const toModel = new Matrix4().multiplyMatrices(inverseParent, object.matrixWorld);
    box.union(local.clone().applyMatrix4(toModel));
  });
  model.matrix.copy(saved);
  model.matrixAutoUpdate = savedAuto;
  model.updateMatrixWorld(true);
  return box;
}
