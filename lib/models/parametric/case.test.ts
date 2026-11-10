import { describe, expect, it } from "vitest";
import { Box3, Mesh, MeshStandardMaterial, Quaternion, Vector3, type Object3D } from "three";
import { findNode } from "@/lib/models/snap";
import { DIMENSIONS } from "@/lib/models/standard";
import { buildCaseModel } from "./case";

const INTERIOR = new Box3(new Vector3(0, 0, 0), new Vector3(440, 470, 215));
const MOTHERBOARD_AREA = new Box3(new Vector3(18, 150, 10), new Vector3(348, 455, 190));
const PSU_VOLUME = new Box3(new Vector3(4, 4, 32), new Vector3(224, 90, 182));
const SHROUD_TOP = 100;

const model = buildCaseModel();
model.updateMatrixWorld(true);

function meshes(): Mesh[] {
  const found: Mesh[] = [];
  model.traverse((o: Object3D) => {
    if ((o as Mesh).isMesh) found.push(o as Mesh);
  });
  return found;
}

/** Penetration depth of two boxes along each axis (negative = apart). */
function overlap(a: Box3, b: Box3): number {
  return Math.min(
    Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x),
    Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y),
    Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z),
  );
}

describe("case attachment nodes", () => {
  it("mount_motherboard is at (18, 455, 12) with identity rotation", () => {
    const n = findNode(model, "mount_motherboard")!;
    expect(n.position.toArray()).toEqual([18, 455, 12]);
    expect(n.quaternion.equals(new Quaternion())).toBe(true);
  });

  it("mount_psu is at (4, 4, 32) with identity rotation", () => {
    const n = findNode(model, "mount_psu")!;
    expect(n.position.toArray()).toEqual([4, 4, 32]);
    expect(n.quaternion.equals(new Quaternion())).toBe(true);
  });

  it("the model is a group named case", () => {
    expect(model.name).toBe("case");
  });
});

describe("case interior limits", () => {
  it("panel meshes lie outside the interior (0.5 mm tolerance), except the allowed parts", () => {
    const allowed = /^(standoff_|shroud_|grommet_|glass)/;
    for (const mesh of meshes()) {
      if (allowed.test(mesh.name)) continue;
      const bounds = new Box3().setFromObject(mesh);
      expect(overlap(bounds, INTERIOR), mesh.name).toBeLessThanOrEqual(0.5);
    }
  });

  it("has the named panels, seven slot covers and 6 to 9 standoffs", () => {
    for (const name of ["tray", "top", "bottom", "rear_panel", "front_panel", "glass"]) {
      expect(model.getObjectByName(name), name).toBeDefined();
    }
    expect(meshes().filter((m) => m.name.startsWith("slot_cover_"))).toHaveLength(7);
    const standoffs = meshes().filter((m) => m.name.startsWith("standoff_")).length;
    expect(standoffs).toBeGreaterThanOrEqual(6);
    expect(standoffs).toBeLessThanOrEqual(9);
  });
});

describe("case reserved volumes", () => {
  it("contain no mesh geometry in the motherboard area", () => {
    for (const mesh of meshes()) {
      if (mesh.name === "glass") continue;
      const bounds = new Box3().setFromObject(mesh);
      expect(overlap(bounds, MOTHERBOARD_AREA) <= 1e-6, mesh.name).toBe(true);
    }
  });

  it("contain no mesh geometry in the PSU volume", () => {
    for (const mesh of meshes()) {
      if (mesh.name === "glass") continue;
      const bounds = new Box3().setFromObject(mesh);
      expect(overlap(bounds, PSU_VOLUME) <= 1e-6, mesh.name).toBe(true);
    }
  });

  it("standoffs end below the board's back and sit inside the ATX area", () => {
    const atx = DIMENSIONS.motherboard.ATX;
    for (const mesh of meshes().filter((m) => m.name.startsWith("standoff_"))) {
      const b = new Box3().setFromObject(mesh);
      expect(b.max.z).toBeLessThanOrEqual(12 - DIMENSIONS.pcbThickness);
      expect(b.min.x).toBeGreaterThanOrEqual(18);
      expect(b.max.x).toBeLessThanOrEqual(18 + atx.width);
      expect(b.max.y).toBeLessThanOrEqual(455);
      expect(b.min.y).toBeGreaterThanOrEqual(455 - atx.height);
    }
  });
});

describe("case fit of parts", () => {
  it("an E-ATX board at mount_motherboard is inside the interior and above the shroud", () => {
    const origin = findNode(model, "mount_motherboard")!.position;
    const { width, height } = DIMENSIONS.motherboard["E-ATX"];
    const board = new Box3(
      new Vector3(origin.x, origin.y - height, origin.z - DIMENSIONS.pcbThickness),
      new Vector3(origin.x + width, origin.y, origin.z + 165),
    );
    expect(INTERIOR.containsBox(board)).toBe(true);
    expect(board.min.y).toBeGreaterThan(SHROUD_TOP);
  });

  it("a PSU body at mount_psu lies inside the shroud compartment", () => {
    const origin = findNode(model, "mount_psu")!.position;
    const { length, height, width } = DIMENSIONS.psu;
    const psu = new Box3(origin.clone(), origin.clone().add(new Vector3(length, height, width)));
    const compartment = new Box3(new Vector3(0, 0, 0), new Vector3(440, SHROUD_TOP, 215));
    expect(compartment.containsBox(psu)).toBe(true);
  });
});

describe("case glass", () => {
  it("is almost invisible and does not write depth", () => {
    const glass = model.getObjectByName("glass") as Mesh;
    const mat = glass.material as MeshStandardMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.opacity).toBeLessThan(0.15);
    expect(mat.depthWrite).toBe(false);
  });
});

describe("case construction", () => {
  it("builds without a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(() => buildCaseModel()).not.toThrow();
  });

  it("stays under 3000 triangles", () => {
    let count = 0;
    for (const mesh of meshes()) {
      const g = mesh.geometry;
      count += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    }
    expect(count).toBeLessThan(3000);
  });
});
