import type { Document, Node } from "@gltf-transform/core";
import { getBounds } from "@gltf-transform/functions";
import type { ModelCategory } from "@/lib/schemas";
import { ATTACHMENT, MODEL_BUDGET, NODES, REQUIRED_NODES } from "./standard";

/**
 * Pure inspection of a glTF document against the model standard (see `standard.ts`). No file
 * I/O, so it can be tested with documents built in memory. Used by `pnpm models:import`.
 */

export type ModelCheck = { id: string; ok: boolean; message: string };

export type ModelReport = {
  triangles: number;
  /** Bounding box of all mesh geometry in the scene's root space, in file units. */
  bounds: { min: [number, number, number]; max: [number, number, number] };
  size: [number, number, number];
  /** Names of all nodes. */
  nodes: string[];
  /** 0 when there are no textures. */
  maxTextureSize: number;
  /** Every check, passed or failed. */
  checks: ModelCheck[];
  /** All checks passed. */
  ok: boolean;
};

/** The mount node must sit within this distance (file units, mm) of the origin. */
const MOUNT_POSITION_TOLERANCE_MM = 1;
/** Largest allowed x, y or z of the mount's rotation quaternion (identity has all three at 0). */
const MOUNT_ROTATION_TOLERANCE = 1e-3;
/** Below this longest side the file is almost certainly in metres. */
const METRES_HINT_BELOW = 5;
const MAX_FANS = 3;

const TRIANGLES = 4;
const TRIANGLE_STRIP = 5;
const TRIANGLE_FAN = 6;

function countTriangles(document: Document): number {
  let total = 0;
  for (const scene of document.getRoot().listScenes()) {
    scene.traverse((node) => {
      const mesh = node.getMesh();
      if (!mesh) return;
      for (const prim of mesh.listPrimitives()) {
        const count =
          prim.getIndices()?.getCount() ?? prim.getAttribute("POSITION")?.getCount() ?? 0;
        const mode = prim.getMode();
        if (mode === TRIANGLES) total += Math.floor(count / 3);
        else if (mode === TRIANGLE_STRIP || mode === TRIANGLE_FAN) total += Math.max(0, count - 2);
      }
    });
  }
  return total;
}

function sceneBounds(document: Document): ModelReport["bounds"] {
  const scenes = document.getRoot().listScenes();
  const empty = { min: [0, 0, 0], max: [0, 0, 0] } as ModelReport["bounds"];
  if (scenes.length === 0) return empty;
  const { min, max } = getBounds(scenes[0]);
  if (![...min, ...max].every(Number.isFinite)) return empty;
  return { min: [min[0], min[1], min[2]], max: [max[0], max[1], max[2]] };
}

function textureSize(document: Document): number {
  let largest = 0;
  for (const texture of document.getRoot().listTextures()) {
    const size = texture.getSize();
    if (size) largest = Math.max(largest, size[0], size[1]);
  }
  return largest;
}

function fmt(n: number): string {
  return String(Math.round(n * 100) / 100);
}

function checkUnits(longest: number): ModelCheck {
  const { min, max } = MODEL_BUDGET.plausibleSizeMm;
  if (longest >= min && longest <= max) {
    return { id: "units", ok: true, message: `Longest side is ${fmt(longest)} mm.` };
  }
  if (longest < METRES_HINT_BELOW) {
    return {
      id: "units",
      ok: false,
      message: `The longest side is only ${fmt(longest)} units. This looks like metres; export in millimetres or scale by 1000.`,
    };
  }
  return {
    id: "units",
    ok: false,
    message: `The longest side is ${fmt(longest)} units, outside ${min} to ${max} mm. Check that the model is in millimetres and has the real size of the part.`,
  };
}

function checkMount(nodes: Node[], mountName: string): ModelCheck {
  const mount = nodes.find((n) => n.getName() === mountName);
  if (!mount) {
    // Reported by the required_nodes check; nothing more to say here.
    return { id: "mount_at_origin", ok: true, message: `${mountName} not found (see above).` };
  }
  const [x, y, z] = mount.getWorldTranslation();
  const distance = Math.hypot(x, y, z);
  if (distance > MOUNT_POSITION_TOLERANCE_MM) {
    return {
      id: "mount_at_origin",
      ok: false,
      message: `${mountName} is ${fmt(distance)} mm from the origin (at ${fmt(x)}, ${fmt(y)}, ${fmt(z)}). Move the model so ${mountName} sits exactly at the origin.`,
    };
  }
  const [qx, qy, qz] = mount.getWorldRotation();
  if (Math.max(Math.abs(qx), Math.abs(qy), Math.abs(qz)) > MOUNT_ROTATION_TOLERANCE) {
    return {
      id: "mount_at_origin",
      ok: false,
      message: `${mountName} is rotated. Reset its rotation (and the rotation of its parents) so it matches the world axes.`,
    };
  }
  return {
    id: "mount_at_origin",
    ok: true,
    message: `${mountName} sits at the origin, unrotated.`,
  };
}

function checkFans(names: string[]): ModelCheck {
  const numbers = names
    .map((n) => /^fan_(\d+)$/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  if (numbers.length === 0) {
    return { id: "fan_nodes", ok: true, message: "No fan nodes (optional)." };
  }
  const gapless = numbers.every((n, i) => n === i + 1);
  if (!gapless) {
    return {
      id: "fan_nodes",
      ok: false,
      message: `Fan nodes must be numbered from 1 without gaps (found ${numbers.map((n) => NODES.fan(n)).join(", ")}).`,
    };
  }
  if (numbers.length > MAX_FANS) {
    return {
      id: "fan_nodes",
      ok: false,
      message: `At most ${MAX_FANS} fan nodes are supported (found ${numbers.length}).`,
    };
  }
  return {
    id: "fan_nodes",
    ok: true,
    message: `${numbers.length} fan node(s), numbered correctly.`,
  };
}

export function inspectModel(document: Document, category: ModelCategory): ModelReport {
  const root = document.getRoot();
  const nodes = root.listNodes();
  const nodeNames = nodes.map((n) => n.getName());
  const triangles = countTriangles(document);
  const bounds = sceneBounds(document);
  const size: ModelReport["size"] = [
    bounds.max[0] - bounds.min[0],
    bounds.max[1] - bounds.min[1],
    bounds.max[2] - bounds.min[2],
  ];
  const longest = Math.max(...size);
  const maxTexture = textureSize(document);
  const checks: ModelCheck[] = [];

  const sceneCount = root.listScenes().length;
  checks.push({
    id: "single_scene",
    ok: sceneCount === 1,
    message:
      sceneCount === 1
        ? "The file has one scene."
        : `The file has ${sceneCount} scenes; it must have exactly one. Remove the extra scenes in the exporter.`,
  });

  checks.push({
    id: "triangles",
    ok: triangles <= MODEL_BUDGET.maxTriangles,
    message:
      triangles <= MODEL_BUDGET.maxTriangles
        ? `${triangles} triangles (limit ${MODEL_BUDGET.maxTriangles}).`
        : `${triangles} triangles is over the limit of ${MODEL_BUDGET.maxTriangles}. Reduce the geometry (decimate or remodel hidden parts).`,
  });

  checks.push({
    id: "textures",
    ok: maxTexture <= MODEL_BUDGET.maxTextureSize,
    message:
      maxTexture <= MODEL_BUDGET.maxTextureSize
        ? `Largest texture side is ${maxTexture} px (limit ${MODEL_BUDGET.maxTextureSize}).`
        : `A texture is ${maxTexture} px on its longer side; the limit is ${MODEL_BUDGET.maxTextureSize}. Resize the textures and export again.`,
  });

  checks.push(checkUnits(longest));

  const missing = REQUIRED_NODES[category].filter((name) => !nodeNames.includes(name));
  checks.push({
    id: "required_nodes",
    ok: missing.length === 0,
    message:
      missing.length === 0
        ? REQUIRED_NODES[category].length === 0
          ? "No attachment nodes are required for this category."
          : "All required attachment nodes are present."
        : `Missing attachment node${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Add them as empty nodes with exactly these names.`,
  });

  const attachment = category === "case" || category === "fan" ? undefined : ATTACHMENT[category];
  const mountName = attachment?.mount ?? null;
  if (mountName) checks.push(checkMount(nodes, mountName));

  const attachmentNames = new Set<string>(REQUIRED_NODES[category]);
  if (mountName) attachmentNames.add(mountName);
  const withMesh = nodes
    .filter((n) => attachmentNames.has(n.getName()) && n.getMesh())
    .map((n) => n.getName());
  checks.push({
    id: "attachment_nodes_empty",
    ok: withMesh.length === 0,
    message:
      withMesh.length === 0
        ? "Attachment nodes carry no geometry."
        : `Attachment node${withMesh.length > 1 ? "s" : ""} ${withMesh.join(", ")} must be empty (no mesh). Make them empty nodes and put geometry on separate nodes.`,
  });

  const badMaterials: string[] = [];
  for (const material of root.listMaterials()) {
    const names = material.listExtensions();
    const used = names.map((e) => e.extensionName);
    if (used.includes("KHR_materials_pbrSpecularGlossiness")) {
      badMaterials.push(`${material.getName() || "(unnamed)"} uses specular-glossiness`);
    }
    if (used.includes("KHR_materials_unlit")) {
      badMaterials.push(`${material.getName() || "(unnamed)"} is unlit`);
    }
  }
  for (const ext of root.listExtensionsUsed()) {
    if (ext.extensionName === "KHR_materials_pbrSpecularGlossiness" && badMaterials.length === 0) {
      badMaterials.push("the file uses specular-glossiness materials");
    }
  }
  checks.push({
    id: "materials",
    ok: badMaterials.length === 0,
    message:
      badMaterials.length === 0
        ? "All materials are PBR metallic-roughness."
        : `Materials must be PBR metallic-roughness: ${badMaterials.join("; ")}. Rebuild them with a Principled BSDF and export again.`,
  });

  checks.push(checkFans(nodeNames));

  return {
    triangles,
    bounds,
    size,
    nodes: nodeNames,
    maxTextureSize: maxTexture,
    checks,
    ok: checks.every((c) => c.ok),
  };
}
