import { Color, type Material, type Mesh, type Object3D } from "three";
import { NODES } from "@/lib/models/standard";

/** What one material looked like before any effect touched it. */
type Base = {
  material: Material & { emissive?: Color; color?: Color };
  opacity: number;
  transparent: boolean;
  depthWrite: boolean;
  emissive: Color | null;
};

/**
 * One drawn copy of a model with materials of its own, so opacity, glow and ghost tints never
 * touch the model the loader returned or any other copy. `dispose` frees the cloned materials
 * (geometry and textures are shared and left alone).
 */
export type Instance = {
  root: Object3D;
  bases: Base[];
  /** Nodes `fan_1..3`, collected once. */
  fans: Object3D[];
  dispose: () => void;
};

const MAX_FANS = 3;

export function cloneInstance(object: Object3D): Instance {
  const root = object.clone(true);
  const bases: Base[] = [];
  const own = (source: Material): Material => {
    const material = source.clone() as Base["material"];
    bases.push({
      material,
      opacity: material.opacity,
      transparent: material.transparent,
      depthWrite: material.depthWrite,
      emissive: material.emissive ? material.emissive.clone() : null,
    });
    return material;
  };
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh) return;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(own) : own(mesh.material);
  });
  const fans: Object3D[] = [];
  for (let n = 1; n <= MAX_FANS; n++) {
    const fan = root.getObjectByName(NODES.fan(n));
    if (fan) fans.push(fan);
  }
  return { root, bases, fans, dispose: () => bases.forEach((base) => base.material.dispose()) };
}

/**
 * Shows the instance at `opacity` (0..1) with its emissive colour pulled `glow` of the way toward
 * `glowColor`. Materials without an emissive colour only get the opacity.
 */
export function applyLook(
  instance: Instance,
  opacity: number,
  glowColor: Color | null,
  glow: number,
): void {
  const see = opacity < 0.999;
  for (const base of instance.bases) {
    const { material } = base;
    material.opacity = base.opacity * opacity;
    const transparent = base.transparent || see;
    if (material.transparent !== transparent) {
      material.transparent = transparent;
      material.needsUpdate = true;
    }
    material.depthWrite = see ? false : base.depthWrite;
    if (base.emissive && material.emissive) {
      material.emissive.copy(base.emissive);
      if (glowColor && glow > 0) material.emissive.lerp(glowColor, glow);
    }
  }
}

const GHOST_TINT = new Color("#8ec5ff");

/** Turns a fresh instance into a translucent, cool-tinted preview and stops it taking clicks. */
export function ghostify(instance: Instance): void {
  for (const base of instance.bases) {
    const { material } = base;
    if (material.color) material.color.lerp(GHOST_TINT, 0.45);
    if (base.emissive) base.emissive.copy(GHOST_TINT).multiplyScalar(0.25);
    base.transparent = true;
    base.depthWrite = false;
  }
  instance.root.traverse((child) => {
    child.raycast = () => {};
    child.castShadow = false;
    child.receiveShadow = false;
  });
}

/** Turns the instance's fans by `radians` around their own Z axis. */
export function spinFans(instance: Instance, radians: number): void {
  for (const fan of instance.fans) fan.rotation.z += radians;
}
