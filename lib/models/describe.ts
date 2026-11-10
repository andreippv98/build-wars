import { Vector3, type Mesh, type Object3D } from "three";
import type { ModelCategory } from "@/lib/schemas";
import type { DimensionMismatch } from "./scale";
import { modelBounds, nodeMatrix } from "./snap";
import { ATTACHMENT, MODEL_BUDGET, NODES, REQUIRED_NODES } from "./standard";

/** How far (mm) the mount node may sit from the model's origin. */
const MOUNT_TOLERANCE_MM = 1;

export type ModelCheck = {
  id: "required-nodes" | "mount-origin" | "size" | "triangles" | "fan-numbering";
  ok: boolean;
  message: string;
};

export type ModelNode = {
  name: string;
  /** Position relative to the model root, mm. */
  position: { x: number; y: number; z: number };
  isMesh: boolean;
};

export type ModelDescription = {
  /** Size of the geometry per axis, mm (zeros for a model with no geometry). */
  size: { x: number; y: number; z: number };
  triangles: number;
  nodes: ModelNode[];
  checks: ModelCheck[];
};

/** Triangles in all meshes of a model. */
function countTriangles(model: Object3D): number {
  let total = 0;
  model.traverse((object) => {
    const mesh = object as Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const { index, attributes } = mesh.geometry;
    const count = index ? index.count : (attributes.position?.count ?? 0);
    total += Math.floor(count / 3);
  });
  return total;
}

/** Plain-language description and standard checks of a model, for the `/dev/models` page. */
export function describeModel(model: Object3D, category: ModelCategory): ModelDescription {
  const bounds = modelBounds(model);
  const sizeVector = bounds.isEmpty() ? new Vector3() : bounds.getSize(new Vector3());
  const size = { x: sizeVector.x, y: sizeVector.y, z: sizeVector.z };
  const triangles = countTriangles(model);

  const nodes: ModelNode[] = [];
  model.traverse((object) => {
    if (object === model || !object.name) return;
    const position = new Vector3().setFromMatrixPosition(nodeMatrix(model, object));
    nodes.push({
      name: object.name,
      position: { x: position.x, y: position.y, z: position.z },
      isMesh: (object as Mesh).isMesh === true,
    });
  });

  const names = new Set(nodes.map((node) => node.name));
  const checks: ModelCheck[] = [];

  const missing = REQUIRED_NODES[category].filter((name) => !names.has(name));
  checks.push({
    id: "required-nodes",
    ok: missing.length === 0,
    message:
      missing.length === 0
        ? REQUIRED_NODES[category].length === 0
          ? "No attachment nodes are required for this category."
          : "All required attachment nodes are present."
        : `Missing required node${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
  });

  const mountName = category === "case" || category === "fan" ? null : ATTACHMENT[category].mount;
  if (mountName) {
    const mount = nodes.find((node) => node.name === mountName);
    if (!mount) {
      checks.push({
        id: "mount-origin",
        ok: false,
        message: `There is no ${mountName} node, so the mount point cannot be checked.`,
      });
    } else {
      const { x, y, z } = mount.position;
      const distance = Math.hypot(x, y, z);
      const ok = distance <= MOUNT_TOLERANCE_MM;
      checks.push({
        id: "mount-origin",
        ok,
        message: ok
          ? `${mountName} is at the model's origin.`
          : `${mountName} is ${distance.toFixed(1)} mm from the model's origin; it should be within ${MOUNT_TOLERANCE_MM} mm.`,
      });
    }
  }

  const longest = Math.max(size.x, size.y, size.z);
  const { min, max } = MODEL_BUDGET.plausibleSizeMm;
  const sizeOk = longest >= min && longest <= max;
  checks.push({
    id: "size",
    ok: sizeOk,
    message: sizeOk
      ? `The longest side is ${longest.toFixed(1)} mm, which is plausible for millimetres.`
      : `The longest side is ${longest.toFixed(2)} mm; it should be between ${min} and ${max} mm. Is the model in millimetres?`,
  });

  const trianglesOk = triangles <= MODEL_BUDGET.maxTriangles;
  checks.push({
    id: "triangles",
    ok: trianglesOk,
    message: trianglesOk
      ? `${triangles} triangles (limit ${MODEL_BUDGET.maxTriangles}).`
      : `${triangles} triangles; the limit is ${MODEL_BUDGET.maxTriangles}.`,
  });

  const fanNumbers = nodes
    .map((node) => /^fan_(\d+)$/.exec(node.name))
    .flatMap((match) => (match ? [Number(match[1])] : []))
    .sort((a, b) => a - b);
  const gaps =
    fanNumbers.some((n, i) => n !== i + 1) || new Set(fanNumbers).size !== fanNumbers.length;
  checks.push({
    id: "fan-numbering",
    ok: !gaps,
    message: gaps
      ? `Fan nodes must be numbered from 1 without gaps (found ${fanNumbers.map((n) => NODES.fan(n)).join(", ")}).`
      : fanNumbers.length === 0
        ? "No fan nodes."
        : `${fanNumbers.length} fan node${fanNumbers.length > 1 ? "s" : ""}, numbered correctly.`,
  });

  return { size, triangles, nodes, checks };
}

const AXIS_WORDS: Record<ModelCategory, Record<"x" | "y" | "z", string>> = {
  gpu: { x: "long", y: "thick", z: "high off the board" },
  motherboard: { x: "wide", y: "tall", z: "high off the board" },
  ram: { x: "wide", y: "tall", z: "high off the board" },
  cpu_cooler: { x: "wide", y: "tall", z: "high off the board" },
  psu: { x: "long", y: "high", z: "wide" },
  case: { x: "deep", y: "tall", z: "wide" },
  fan: { x: "wide", y: "tall", z: "deep" },
};

/** A size mismatch against the catalog in plain language, worded per category and axis. */
export function mismatchMessage(category: ModelCategory, mismatch: DimensionMismatch): string {
  return `Model is ${mismatch.modelMm} mm ${AXIS_WORDS[category][mismatch.axis]}; the catalog says ${mismatch.dataMm} mm.`;
}
