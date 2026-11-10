import {
  BoxGeometry,
  Euler,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from "three";
import { describe, expect, it } from "vitest";
import { makeGpu, makeMotherboard, makePsu } from "@/lib/engine/test-fixtures";
import type { ModelEntry } from "@/lib/schemas";
import { findModel, modelUrl } from "./lookup";
import { dataDimensions, dimensionMismatches, scaleToData } from "./scale";
import { findNode, modelBounds, modelSize, nodeMatrix, snapMatrix, snapToSlot } from "./snap";

function entry(overrides: Partial<ModelEntry>): ModelEntry {
  return {
    id: "m",
    applies_to: { part_ids: ["x"] },
    category: "gpu",
    file: "m.glb",
    scale_to_data: false,
    license: "test",
    author: "test",
    source: "test",
    verified: true,
    ...overrides,
  };
}

function named(name: string, x = 0, y = 0, z = 0): Object3D {
  const o = new Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

function boxAt(min: [number, number, number], size: [number, number, number]): Mesh {
  const mesh = new Mesh(new BoxGeometry(...size), new MeshBasicMaterial());
  mesh.position.set(min[0] + size[0] / 2, min[1] + size[1] / 2, min[2] + size[2] / 2);
  return mesh;
}

describe("findModel: lookup order", () => {
  const gpu = makeGpu({
    id: "brand-line-chip-oc",
    maker: "Brand",
    series: "Line",
    chip_id: "chip-a",
  });
  const exact = entry({ id: "exact", applies_to: { part_ids: ["brand-line-chip-oc"] } });
  const family = entry({
    id: "family",
    applies_to: { family: { maker: "brand", series: "LINE", chip_ids: ["chip-a", "chip-b"] } },
    scale_to_data: true,
  });

  it("prefers the exact product over its family, whatever the manifest order", () => {
    expect(findModel([family, exact], "gpu", gpu)).toEqual({ entry: exact, kind: "exact" });
  });

  it("falls back to the family model, matching maker and series case-insensitively", () => {
    expect(findModel([family], "gpu", gpu)).toEqual({ entry: family, kind: "family" });
  });

  it("does not match a family on another chip, maker or series, or a board without a series", () => {
    expect(
      findModel([family], "gpu", makeGpu({ maker: "Brand", series: "Line", chip_id: "chip-z" })),
    ).toBeNull();
    expect(
      findModel([family], "gpu", makeGpu({ maker: "Other", series: "Line", chip_id: "chip-a" })),
    ).toBeNull();
    expect(
      findModel([family], "gpu", makeGpu({ maker: "Brand", series: "Else", chip_id: "chip-a" })),
    ).toBeNull();
    expect(
      findModel([family], "gpu", makeGpu({ maker: "Brand", series: undefined, chip_id: "chip-a" })),
    ).toBeNull();
  });

  it("returns null when nothing matches: the parametric model is used", () => {
    expect(findModel([], "gpu", gpu)).toBeNull();
  });

  it("only considers models of the slot's category", () => {
    const psu = makePsu({ id: "brand-line-chip-oc" });
    expect(findModel([exact], "psu", psu)).toBeNull();
    const psuModel = entry({ id: "p", category: "psu", applies_to: { part_ids: [psu.id] } });
    expect(findModel([psuModel], "psu", psu)?.entry.id).toBe("p");
  });

  it("skips unverified models unless asked", () => {
    const draft = entry({ id: "draft", applies_to: { part_ids: [gpu.board.id] }, verified: false });
    expect(findModel([draft], "gpu", gpu)).toBeNull();
    expect(findModel([draft], "gpu", gpu, { includeUnverified: true })?.entry.id).toBe("draft");
    expect(findModel([draft, family], "gpu", gpu)?.kind).toBe("family");
  });
});

describe("modelUrl", () => {
  it("resolves relative files against the base and passes absolute ones through", () => {
    expect(modelUrl("gpu/a.glb", "https://cdn.example/models/")).toBe(
      "https://cdn.example/models/gpu/a.glb",
    );
    expect(modelUrl("gpu/a.glb", "/models")).toBe("/models/gpu/a.glb");
    expect(modelUrl("https://x.example/a.glb", "/models")).toBe("https://x.example/a.glb");
    expect(modelUrl("/static/a.glb", "/models")).toBe("/static/a.glb");
  });
});

describe("snapping", () => {
  it("puts the child's origin on the parent's slot when the child has no mount node", () => {
    const parent = new Group();
    parent.add(named("slot", 10, -20, 5));
    const child = new Group();
    const matrix = snapToSlot(parent, "slot", child, null)!;
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([10, -20, 5]);
  });

  it("makes the child's mount node coincide with the slot", () => {
    const parent = new Group();
    parent.add(named("slot", 100, 50, 0));
    const child = new Group();
    child.add(named("mount", 7, 3, -2));
    const matrix = snapToSlot(parent, "slot", child, "mount")!;
    const mountInParent = new Vector3(7, 3, -2).applyMatrix4(matrix);
    expect(mountInParent.x).toBeCloseTo(100);
    expect(mountInParent.y).toBeCloseTo(50);
    expect(mountInParent.z).toBeCloseTo(0);
  });

  it("honours rotation on both nodes and nesting inside the model", () => {
    const parent = new Group();
    const arm = new Group();
    arm.position.set(0, 100, 0);
    arm.rotation.set(0, 0, Math.PI / 2);
    const slot = named("slot", 10, 0, 0);
    slot.rotation.set(0, Math.PI / 2, 0);
    arm.add(slot);
    parent.add(arm);
    const child = new Group();
    const mount = named("mount", 5, 0, 0);
    mount.rotation.set(Math.PI / 2, 0, 0);
    child.add(mount);

    const matrix = snapToSlot(parent, "slot", child, "mount")!;
    const mountInParent = new Matrix4().multiplyMatrices(matrix, nodeMatrix(child, mount));
    const slotInParent = nodeMatrix(parent, slot);
    mountInParent.elements.forEach((value, i) =>
      expect(value).toBeCloseTo(slotInParent.elements[i]),
    );
  });

  it("ignores the parent model's own placement: the result is in the parent's space", () => {
    const parent = new Group();
    parent.position.set(999, 999, 999);
    parent.add(named("slot", 1, 2, 3));
    const matrix = snapToSlot(parent, "slot", new Group(), null)!;
    expect(new Vector3().setFromMatrixPosition(matrix).toArray()).toEqual([1, 2, 3]);
  });

  it("returns null when the parent lacks the slot, and treats a missing mount as the origin", () => {
    expect(snapToSlot(new Group(), "slot", new Group(), null)).toBeNull();
    const parent = new Group();
    parent.add(named("slot", 4, 0, 0));
    const matrix = snapToSlot(parent, "slot", new Group(), "no_such_mount")!;
    expect(new Vector3().setFromMatrixPosition(matrix).x).toBe(4);
  });

  it("snapMatrix is slot x inverse(mount)", () => {
    const slot = new Matrix4().makeRotationFromEuler(new Euler(0.3, 0.2, 0.1)).setPosition(1, 2, 3);
    const mount = new Matrix4().makeTranslation(4, 5, 6);
    const result = new Matrix4().multiplyMatrices(snapMatrix(slot, mount), mount);
    result.elements.forEach((value, i) => expect(value).toBeCloseTo(slot.elements[i]));
  });

  it("findNode finds nested nodes by name", () => {
    const model = new Group();
    const inner = new Group();
    inner.add(named("deep"));
    model.add(inner);
    expect(findNode(model, "deep")?.name).toBe("deep");
    expect(findNode(model, "nope")).toBeNull();
  });
});

describe("model size and scale_to_data", () => {
  it("measures geometry in the model's own space, ignoring its placement", () => {
    const model = new Group();
    model.add(boxAt([0, -40, 0], [285, 40, 120]));
    model.position.set(500, 500, 500);
    model.rotation.set(0, 1, 0);
    const size = modelSize(model);
    expect(size.x).toBeCloseTo(285);
    expect(size.y).toBeCloseTo(40);
    expect(size.z).toBeCloseTo(120);
    expect(model.position.x).toBe(500);
    expect(modelBounds(model).min.y).toBeCloseTo(-40);
  });

  it("knows the data dimensions of GPUs and motherboards only", () => {
    expect(dataDimensions("gpu", makeGpu({ length_mm: 304, slots: 2 }))).toEqual({
      x: 304,
      y: 40.64,
    });
    expect(dataDimensions("motherboard", makeMotherboard({ form_factor: "ITX" }))).toEqual({
      x: 170,
      y: 170,
    });
    expect(dataDimensions("psu", makePsu())).toEqual({});
  });

  it("stretches a family model to the part's length, keeping the mount at the origin", () => {
    const model = new Group();
    model.add(boxAt([0, -40, 0], [285, 40, 120]));
    const factor = scaleToData(model, "gpu", makeGpu({ length_mm: 304 }));
    expect(factor).toBeCloseTo(304 / 285);
    expect(modelBounds(model).max.x).toBeCloseTo(285);
    expect(model.scale.x).toBeCloseTo(304 / 285);
    expect(model.scale.y).toBe(1);
  });

  it("does not scale parts without a known length", () => {
    const model = new Group();
    model.add(boxAt([0, 0, 0], [160, 86, 150]));
    expect(scaleToData(model, "psu", makePsu())).toBe(1);
    expect(model.scale.x).toBe(1);
  });

  it("reports mismatches between a model and the catalog beyond the tolerance", () => {
    const model = new Group();
    model.add(boxAt([0, -40.64, 0], [285, 40.64, 120]));
    expect(dimensionMismatches(model, "gpu", makeGpu({ length_mm: 304, slots: 2 }))).toEqual([
      { axis: "x", modelMm: 285, dataMm: 304 },
    ]);
    expect(dimensionMismatches(model, "gpu", makeGpu({ length_mm: 287, slots: 2 }))).toEqual([]);
  });
});
