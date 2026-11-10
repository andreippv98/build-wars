import {
  BoxGeometry,
  CanvasTexture,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SRGBColorSpace,
  type ColorRepresentation,
} from "three";

/** Helpers shared by the parametric models. All sizes in mm. */

/** An empty attachment / effect node. */
export function node(name: string, x = 0, y = 0, z = 0): Object3D {
  const object = new Object3D();
  object.name = name;
  object.position.set(x, y, z);
  return object;
}

export function material(
  color: ColorRepresentation,
  options: { metalness?: number; roughness?: number; emissive?: ColorRepresentation } = {},
): MeshStandardMaterial {
  return new MeshStandardMaterial({
    color,
    metalness: options.metalness ?? 0.3,
    roughness: options.roughness ?? 0.6,
    emissive: options.emissive ?? 0x000000,
  });
}

/**
 * A box given by its minimum corner and its size (not its centre), which is how the model
 * standard describes parts: "spans +X by its length".
 */
export function box(
  name: string,
  min: { x: number; y: number; z: number },
  size: { x: number; y: number; z: number },
  mat: MeshStandardMaterial,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(size.x, size.y, size.z), mat);
  mesh.name = name;
  mesh.position.set(min.x + size.x / 2, min.y + size.y / 2, min.z + size.z / 2);
  return mesh;
}

export function group(name: string, ...children: Object3D[]): Group {
  const g = new Group();
  g.name = name;
  if (children.length > 0) g.add(...children);
  return g;
}

/**
 * A texture with the given lines of text, for name labels. Returns null where there is no DOM
 * (unit tests, server): callers then simply leave the label off.
 */
export function labelTexture(
  lines: string[],
  options: { width?: number; height?: number; color?: string; background?: string } = {},
): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const width = options.width ?? 512;
  const height = options.height ?? 128;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  if (options.background) {
    context.fillStyle = options.background;
    context.fillRect(0, 0, width, height);
  }
  context.fillStyle = options.color ?? "#e5e7eb";
  context.textBaseline = "middle";
  const lineHeight = height / (lines.length + 0.5);
  lines.forEach((line, i) => {
    let size = Math.floor(lineHeight * (i === 0 ? 0.8 : 0.6));
    context.font = `600 ${size}px system-ui, sans-serif`;
    while (size > 10 && context.measureText(line).width > width - 24) {
      size -= 2;
      context.font = `600 ${size}px system-ui, sans-serif`;
    }
    context.fillText(line, 12, lineHeight * (i + 0.75));
  });
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Stable colour family for a maker name, so the same brand always gets the same accent. */
export function makerColor(maker: string): number {
  const palette = [0x4b5563, 0x1f2937, 0x7f1d1d, 0x14532d, 0x1e3a8a, 0x713f12, 0x581c87, 0x0f766e];
  let hash = 0;
  for (const char of maker.toLowerCase()) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length];
}
