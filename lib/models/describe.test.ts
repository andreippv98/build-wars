import { BoxGeometry, Group, Mesh, Object3D } from "three";
import { describe, expect, it } from "vitest";
import { describeModel, mismatchMessage } from "./describe";
import { MODEL_BUDGET } from "./standard";

function node(name: string, x = 0, y = 0, z = 0): Object3D {
  const n = new Object3D();
  n.name = name;
  n.position.set(x, y, z);
  return n;
}

function gpu(
  options: { mount?: boolean; mountAt?: [number, number, number]; scale?: number } = {},
) {
  const s = options.scale ?? 1;
  const group = new Group();
  const body = new Mesh(new BoxGeometry(300 * s, 40 * s, 110 * s));
  body.name = "body";
  body.position.set(150 * s, -20 * s, 55 * s);
  group.add(body);
  if (options.mount !== false) group.add(node("mount_pcie", ...(options.mountAt ?? [0, 0, 0])));
  return group;
}

const check = (group: Object3D, id: string, category = "gpu" as const) =>
  describeModel(group, category).checks.find((c) => c.id === id);

describe("describeModel: a good GPU", () => {
  const description = describeModel(gpu(), "gpu");
  it("measures the size and counts triangles", () => {
    expect(description.size.x).toBeCloseTo(300);
    expect(description.size.y).toBeCloseTo(40);
    expect(description.size.z).toBeCloseTo(110);
    expect(description.triangles).toBe(12);
  });
  it("passes every check", () => {
    expect(description.checks.map((c) => c.id)).toEqual([
      "required-nodes",
      "mount-origin",
      "size",
      "triangles",
      "fan-numbering",
    ]);
    expect(description.checks.every((c) => c.ok)).toBe(true);
  });
  it("lists named nodes with positions relative to the root", () => {
    expect(description.nodes.map((n) => n.name)).toEqual(["body", "mount_pcie"]);
    expect(description.nodes[0]).toMatchObject({
      position: { x: 150, y: -20, z: 55 },
      isMesh: true,
    });
  });
});

describe("describeModel: required nodes", () => {
  it("fails and names the missing mount_pcie", () => {
    const c = check(gpu({ mount: false }), "required-nodes");
    expect(c?.ok).toBe(false);
    expect(c?.message).toContain("mount_pcie");
  });
  it("also fails the mount check when the node is missing", () => {
    expect(check(gpu({ mount: false }), "mount-origin")?.ok).toBe(false);
  });
  it("has no mount check for categories without a mount node", () => {
    const ram = new Group();
    ram.add(new Mesh(new BoxGeometry(7, 31, 133)));
    const checks = describeModel(ram, "ram").checks;
    expect(checks.find((c) => c.id === "mount-origin")).toBeUndefined();
    expect(checks.find((c) => c.id === "required-nodes")?.ok).toBe(true);
  });
  it("checks the motherboard's four nodes", () => {
    const board = new Group();
    board.add(new Mesh(new BoxGeometry(244, 305, 2)), node("socket_cpu"), node("slot_pcie_1"));
    const c = check(board, "required-nodes", "motherboard" as never);
    expect(c?.ok).toBe(false);
    expect(c?.message).toContain("slot_ram_1");
    expect(c?.message).toContain("slot_ram_2");
  });
});

describe("describeModel: mount at the origin", () => {
  it("passes within 1 mm", () => {
    expect(check(gpu({ mountAt: [0.9, 0, 0] }), "mount-origin")?.ok).toBe(true);
  });
  it("fails just beyond 1 mm", () => {
    expect(check(gpu({ mountAt: [1.1, 0, 0] }), "mount-origin")?.ok).toBe(false);
  });
  it("fails when far off", () => {
    const c = check(gpu({ mountAt: [0, 0, 50] }), "mount-origin");
    expect(c?.ok).toBe(false);
    expect(c?.message).toContain("50.0 mm");
  });
  it("uses the position relative to the root through parents", () => {
    const group = gpu({ mount: false });
    const parent = node("holder", 10, 0, 0);
    parent.add(node("mount_pcie", -10, 0, 0));
    group.add(parent);
    expect(check(group, "mount-origin")?.ok).toBe(true);
  });
});

describe("describeModel: plausible size", () => {
  it("fails for a model in metres", () => {
    const c = check(gpu({ scale: 0.001 }), "size");
    expect(c?.ok).toBe(false);
    expect(c?.message).toContain("millimetres");
  });
  it("passes at the limits and fails just outside", () => {
    const { min, max } = MODEL_BUDGET.plausibleSizeMm;
    const long = (mm: number) => {
      const g = new Group();
      g.add(new Mesh(new BoxGeometry(mm, 1, 1)));
      return g;
    };
    expect(check(long(min), "size")?.ok).toBe(true);
    expect(check(long(max), "size")?.ok).toBe(true);
    expect(check(long(min - 0.5), "size")?.ok).toBe(false);
    expect(check(long(max + 1), "size")?.ok).toBe(false);
  });
  it("fails for an empty model", () => {
    const d = describeModel(new Group(), "ram");
    expect(d.size).toEqual({ x: 0, y: 0, z: 0 });
    expect(d.checks.find((c) => c.id === "size")?.ok).toBe(false);
  });
});

describe("describeModel: triangle budget", () => {
  const withTriangles = (count: number) => {
    const g = new Group();
    const geo = new BoxGeometry(10, 10, 10);
    // 12 triangles per box; repeat the mesh to reach the count.
    for (let i = 0; i < count / 12; i += 1) g.add(new Mesh(geo));
    return g;
  };
  it("passes at the limit", () => {
    const limit = MODEL_BUDGET.maxTriangles - (MODEL_BUDGET.maxTriangles % 12);
    const c = check(withTriangles(limit), "triangles");
    expect(c?.ok).toBe(true);
  });
  it("fails above the limit", () => {
    const over = MODEL_BUDGET.maxTriangles - (MODEL_BUDGET.maxTriangles % 12) + 12;
    expect(check(withTriangles(over), "triangles")?.ok).toBe(false);
  });
});

describe("describeModel: fan numbering", () => {
  it("passes for fan_1..fan_3", () => {
    const g = gpu();
    g.add(node("fan_1"), node("fan_2"), node("fan_3"));
    expect(check(g, "fan-numbering")?.ok).toBe(true);
  });
  it("fails for fan_1 + fan_3", () => {
    const g = gpu();
    g.add(node("fan_1"), node("fan_3"));
    expect(check(g, "fan-numbering")?.ok).toBe(false);
  });
  it("fails when numbering does not start at 1", () => {
    const g = gpu();
    g.add(node("fan_2"));
    expect(check(g, "fan-numbering")?.ok).toBe(false);
  });
});

describe("mismatchMessage", () => {
  it("words a GPU length mismatch", () => {
    expect(mismatchMessage("gpu", { axis: "x", modelMm: 285, dataMm: 304 })).toBe(
      "Model is 285 mm long; the catalog says 304 mm.",
    );
  });
  it("words thickness and board dimensions per category", () => {
    expect(mismatchMessage("gpu", { axis: "y", modelMm: 40, dataMm: 61 })).toContain("thick");
    expect(mismatchMessage("motherboard", { axis: "x", modelMm: 200, dataMm: 244 })).toContain(
      "wide",
    );
    expect(mismatchMessage("motherboard", { axis: "y", modelMm: 200, dataMm: 305 })).toContain(
      "tall",
    );
  });
});
