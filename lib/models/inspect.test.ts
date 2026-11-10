import { Document, type Node } from "@gltf-transform/core";
import { KHRMaterialsPBRSpecularGlossiness, KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { describe, expect, it } from "vitest";
import type { ModelCategory } from "@/lib/schemas";
import { inspectModel } from "./inspect";
import { MODEL_BUDGET } from "./standard";

type Built = { document: Document; scene: ReturnType<Document["createScene"]> };

function newDoc(): Built {
  const document = new Document();
  document.createBuffer();
  const scene = document.createScene("scene");
  return { document, scene };
}

/** A box from (0,0,0) to (x, y, z) as a mesh, optionally with extra repeated triangles. */
function addBox(
  { document, scene }: Built,
  [x, y, z]: [number, number, number],
  options: { name?: string; extraTriangles?: number } = {},
): Node {
  const buffer = document.getRoot().listBuffers()[0];
  const positions = new Float32Array([
    0,
    0,
    0,
    x,
    0,
    0,
    x,
    y,
    0,
    0,
    y,
    0,
    0,
    0,
    z,
    x,
    0,
    z,
    x,
    y,
    z,
    0,
    y,
    z,
  ]);
  const base = [
    0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 6, 2, 3, 7, 6, 0, 4, 7, 0, 7, 3, 1, 2,
    6, 1, 6, 5,
  ];
  const extra = options.extraTriangles ?? 0;
  const indices = new Uint32Array(base.length + extra * 3);
  indices.set(base);
  for (let i = 0; i < extra; i++) indices.set([0, 2, 1], base.length + i * 3);
  const prim = document
    .createPrimitive()
    .setAttribute(
      "POSITION",
      document.createAccessor().setType("VEC3").setArray(positions).setBuffer(buffer),
    )
    .setIndices(document.createAccessor().setType("SCALAR").setArray(indices).setBuffer(buffer))
    .setMaterial(document.createMaterial("mat"));
  const node = document
    .createNode(options.name ?? "body")
    .setMesh(document.createMesh("mesh").addPrimitive(prim));
  scene.addChild(node);
  return node;
}

function addEmpty(
  { document, scene }: Built,
  name: string,
  translation?: [number, number, number],
) {
  const node = document.createNode(name);
  if (translation) node.setTranslation(translation);
  scene.addChild(node);
  return node;
}

function validGpu(): Built {
  const built = newDoc();
  addBox(built, [285, 40, 120]);
  addEmpty(built, "mount_pcie");
  return built;
}

function check(report: ReturnType<typeof inspectModel>, id: string) {
  const found = report.checks.find((c) => c.id === id);
  if (!found) throw new Error(`no check ${id}`);
  return found;
}

function pngWithSize(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // IHDR
  view.setUint32(16, width);
  view.setUint32(20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

function withTexture(built: Built, width: number, height: number) {
  const { document } = built;
  const texture = document
    .createTexture("tex")
    .setImage(pngWithSize(width, height))
    .setMimeType("image/png");
  document.getRoot().listMaterials()[0].setBaseColorTexture(texture);
}

describe("a valid GPU", () => {
  it("passes every check and reports geometry", () => {
    const report = inspectModel(validGpu().document, "gpu");
    expect(report.ok).toBe(true);
    expect(report.checks.every((c) => c.ok)).toBe(true);
    expect(report.triangles).toBe(12);
    expect(report.size).toEqual([285, 40, 120]);
    expect(report.bounds.min).toEqual([0, 0, 0]);
    expect(report.nodes).toContain("mount_pcie");
    expect(report.maxTextureSize).toBe(0);
  });
});

describe("single_scene", () => {
  it("fails with two scenes", () => {
    const built = validGpu();
    built.document.createScene("second");
    expect(check(inspectModel(built.document, "gpu"), "single_scene").ok).toBe(false);
  });

  it("fails with no scene", () => {
    const document = new Document();
    expect(check(inspectModel(document, "ram"), "single_scene").ok).toBe(false);
  });
});

describe("triangles", () => {
  it("passes exactly at the budget", () => {
    const built = newDoc();
    addBox(built, [100, 10, 10], { extraTriangles: MODEL_BUDGET.maxTriangles - 12 });
    addEmpty(built, "mount_pcie");
    const report = inspectModel(built.document, "gpu");
    expect(report.triangles).toBe(MODEL_BUDGET.maxTriangles);
    expect(check(report, "triangles").ok).toBe(true);
  });

  it("fails one triangle over the budget", () => {
    const built = newDoc();
    addBox(built, [100, 10, 10], { extraTriangles: MODEL_BUDGET.maxTriangles - 11 });
    addEmpty(built, "mount_pcie");
    const check_ = check(inspectModel(built.document, "gpu"), "triangles");
    expect(check_.ok).toBe(false);
    expect(check_.message).toContain(String(MODEL_BUDGET.maxTriangles));
  });
});

describe("textures", () => {
  it("passes at the size limit", () => {
    const built = validGpu();
    withTexture(built, MODEL_BUDGET.maxTextureSize, 512);
    const report = inspectModel(built.document, "gpu");
    expect(report.maxTextureSize).toBe(MODEL_BUDGET.maxTextureSize);
    expect(check(report, "textures").ok).toBe(true);
  });

  it("fails when a side is over the limit", () => {
    const built = validGpu();
    withTexture(built, 512, MODEL_BUDGET.maxTextureSize + 1);
    const result = check(inspectModel(built.document, "gpu"), "textures");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Resize");
  });
});

describe("units", () => {
  it("fails with a metres-scale model and says so", () => {
    const built = newDoc();
    addBox(built, [0.285, 0.04, 0.12]);
    addEmpty(built, "mount_pcie");
    const result = check(inspectModel(built.document, "gpu"), "units");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("metres");
  });

  it("passes at the lower boundary and fails just below it", () => {
    const { min, max } = MODEL_BUDGET.plausibleSizeMm;
    const at = newDoc();
    addBox(at, [min, 1, 1]);
    expect(check(inspectModel(at.document, "ram"), "units").ok).toBe(true);
    const below = newDoc();
    addBox(below, [min - 0.01, 1, 1]);
    expect(check(inspectModel(below.document, "ram"), "units").ok).toBe(false);
    const top = newDoc();
    addBox(top, [max, 1, 1]);
    expect(check(inspectModel(top.document, "ram"), "units").ok).toBe(true);
    const above = newDoc();
    addBox(above, [max + 1, 1, 1]);
    const result = check(inspectModel(above.document, "ram"), "units");
    expect(result.ok).toBe(false);
    expect(result.message).not.toContain("looks like metres");
  });
});

describe("required_nodes", () => {
  it("fails when mount_pcie is missing", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    const report = inspectModel(built.document, "gpu");
    const result = check(report, "required_nodes");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("mount_pcie");
    expect(report.ok).toBe(false);
  });

  it("passes a motherboard with all four RAM nodes", () => {
    const built = newDoc();
    addBox(built, [244, 305, 2]);
    for (const name of [
      "socket_cpu",
      "slot_pcie_1",
      "slot_ram_1",
      "slot_ram_2",
      "slot_ram_3",
      "slot_ram_4",
    ]) {
      addEmpty(built, name, [10, -10, 2]);
    }
    const report = inspectModel(built.document, "motherboard");
    expect(report.ok).toBe(true);
    // A motherboard's origin is not a mount node, so there is no mount check.
    expect(report.checks.some((c) => c.id === "mount_at_origin")).toBe(false);
  });

  it("fails a motherboard missing slot_ram_2", () => {
    const built = newDoc();
    addBox(built, [244, 305, 2]);
    for (const name of ["socket_cpu", "slot_pcie_1", "slot_ram_1"]) addEmpty(built, name);
    const result = check(inspectModel(built.document, "motherboard"), "required_nodes");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("slot_ram_2");
  });

  it("passes a case with both mounts and skips the mount check", () => {
    const built = newDoc();
    addBox(built, [450, 480, 220]);
    addEmpty(built, "mount_motherboard", [20, 400, 10]);
    addEmpty(built, "mount_psu", [20, 0, 10]);
    const report = inspectModel(built.document, "case");
    expect(report.ok).toBe(true);
    expect(report.checks.some((c) => c.id === "mount_at_origin")).toBe(false);
  });

  it("fails a case without mount_psu", () => {
    const built = newDoc();
    addBox(built, [450, 480, 220]);
    addEmpty(built, "mount_motherboard");
    expect(check(inspectModel(built.document, "case"), "required_nodes").ok).toBe(false);
  });
});

describe("mount_at_origin", () => {
  it("passes within 1 mm of the origin", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    addEmpty(built, "mount_pcie", [1, 0, 0]);
    expect(check(inspectModel(built.document, "gpu"), "mount_at_origin").ok).toBe(true);
  });

  it("fails when more than 1 mm off the origin", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    addEmpty(built, "mount_pcie", [1.01, 0, 0]);
    expect(check(inspectModel(built.document, "gpu"), "mount_at_origin").ok).toBe(false);
  });

  it("fails when the mount is far off the origin", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    addEmpty(built, "mount_pcie", [50, -20, 3]);
    const result = check(inspectModel(built.document, "gpu"), "mount_at_origin");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("origin");
  });

  it("fails when the mount is rotated", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    const mount = addEmpty(built, "mount_pcie");
    const half = Math.SQRT1_2;
    mount.setRotation([0, half, 0, half]); // 90 degrees around Y
    const result = check(inspectModel(built.document, "gpu"), "mount_at_origin");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("rotated");
  });

  it("counts a rotation inherited from a parent", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    const parent = addEmpty(built, "rig");
    parent.setRotation([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
    const mount = built.document.createNode("mount_pcie");
    parent.addChild(mount);
    expect(check(inspectModel(built.document, "gpu"), "mount_at_origin").ok).toBe(false);
  });

  it("accepts the negated identity quaternion", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120]);
    addEmpty(built, "mount_pcie").setRotation([0, 0, 0, -1]);
    expect(check(inspectModel(built.document, "gpu"), "mount_at_origin").ok).toBe(true);
  });
});

describe("attachment_nodes_empty", () => {
  it("fails when the mount carries a mesh", () => {
    const built = newDoc();
    addBox(built, [285, 40, 120], { name: "mount_pcie" });
    const result = check(inspectModel(built.document, "gpu"), "attachment_nodes_empty");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("mount_pcie");
  });

  it("passes when attachment nodes are empty", () => {
    expect(check(inspectModel(validGpu().document, "gpu"), "attachment_nodes_empty").ok).toBe(true);
  });
});

describe("materials", () => {
  it("passes ordinary PBR materials", () => {
    expect(check(inspectModel(validGpu().document, "gpu"), "materials").ok).toBe(true);
  });

  it("fails an unlit material", () => {
    const built = validGpu();
    const unlit = built.document.createExtension(KHRMaterialsUnlit);
    built.document
      .getRoot()
      .listMaterials()[0]
      .setExtension("KHR_materials_unlit", unlit.createUnlit());
    const result = check(inspectModel(built.document, "gpu"), "materials");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("unlit");
  });
});

describe("materials (specular-glossiness)", () => {
  it("fails a specular-glossiness material", () => {
    const built = validGpu();
    const ext = built.document.createExtension(KHRMaterialsPBRSpecularGlossiness);
    built.document
      .getRoot()
      .listMaterials()[0]
      .setExtension("KHR_materials_pbrSpecularGlossiness", ext.createPBRSpecularGlossiness());
    const result = check(inspectModel(built.document, "gpu"), "materials");
    expect(result.ok).toBe(false);
    expect(result.message).toContain("specular-glossiness");
  });
});

describe("fan_nodes", () => {
  it("passes fan_1 and fan_2", () => {
    const built = validGpu();
    addEmpty(built, "fan_1");
    addEmpty(built, "fan_2");
    expect(check(inspectModel(built.document, "gpu"), "fan_nodes").ok).toBe(true);
  });

  it("fails when numbering has a gap", () => {
    const built = validGpu();
    addEmpty(built, "fan_1");
    addEmpty(built, "fan_3");
    expect(check(inspectModel(built.document, "gpu"), "fan_nodes").ok).toBe(false);
  });

  it("fails when numbering does not start at 1", () => {
    const built = validGpu();
    addEmpty(built, "fan_2");
    expect(check(inspectModel(built.document, "gpu"), "fan_nodes").ok).toBe(false);
  });

  it("fails with more than three fans", () => {
    const built = validGpu();
    for (const n of [1, 2, 3, 4]) addEmpty(built, `fan_${n}`);
    expect(check(inspectModel(built.document, "gpu"), "fan_nodes").ok).toBe(false);
  });

  it("passes with three fans", () => {
    const built = validGpu();
    for (const n of [1, 2, 3]) addEmpty(built, `fan_${n}`);
    expect(check(inspectModel(built.document, "gpu"), "fan_nodes").ok).toBe(true);
  });
});

describe("categories without required nodes", () => {
  it.each<ModelCategory>(["ram", "psu", "cpu_cooler", "fan"])(
    "%s passes a plain box",
    (category) => {
      const built = newDoc();
      addBox(built, [100, 50, 20]);
      expect(inspectModel(built.document, category).ok).toBe(true);
    },
  );
});
