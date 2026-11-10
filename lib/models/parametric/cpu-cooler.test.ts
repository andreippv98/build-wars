import { describe, expect, it } from "vitest";
import { Vector3, type Mesh, type Object3D } from "three";
import { makeCpu } from "@/lib/engine/test-fixtures";
import { findNode, modelBounds } from "@/lib/models/snap";
import { buildCpuCoolerModel, COOLER_FIN_HEIGHT, coolerFinHeight } from "./cpu-cooler";

function triangles(model: Object3D): number {
  let count = 0;
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    count += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return count;
}

function frameColour(vendor: "intel" | "amd"): number {
  const model = buildCpuCoolerModel(makeCpu({ vendor }));
  const mesh = model.getObjectByName("socket_frame_front") as Mesh;
  return (mesh.material as unknown as { color: { getHex(): number } }).color.getHex();
}

describe("CPU cooler bounds", () => {
  it("stays in the footprint and starts at the board", () => {
    for (const tdp of [65, 95, 125, 250]) {
      const model = buildCpuCoolerModel(makeCpu({ tdp_w: tdp }));
      expect(model.name).toBe("cpu_cooler");
      const b = modelBounds(model);
      expect(b.min.x).toBeGreaterThanOrEqual(-45);
      expect(b.max.x).toBeLessThanOrEqual(45);
      expect(b.min.y).toBeGreaterThanOrEqual(-65);
      expect(b.max.y).toBeLessThanOrEqual(65);
      expect(b.min.z).toBeCloseTo(0, 5);
      expect(b.max.z).toBeLessThanOrEqual(165);
    }
  });
  it("is taller for a 125 W CPU than a 65 W one", () => {
    const low = modelBounds(buildCpuCoolerModel(makeCpu({ tdp_w: 65 })));
    const high = modelBounds(buildCpuCoolerModel(makeCpu({ tdp_w: 125 })));
    expect(high.max.z).toBeGreaterThan(low.max.z);
  });
});

describe("cooler fin height", () => {
  it("is 110 mm up to 95 W and 125 mm above", () => {
    expect(coolerFinHeight(65)).toBe(COOLER_FIN_HEIGHT.standardMm);
    expect(coolerFinHeight(95)).toBe(110);
    expect(coolerFinHeight(96)).toBe(125);
  });
  it("draws separate thin fins", () => {
    const model = buildCpuCoolerModel(makeCpu());
    const fins = model.getObjectByName("fin_stack")!;
    expect(fins.children.length).toBeGreaterThanOrEqual(12);
    expect(fins.children.length).toBeLessThanOrEqual(16);
  });
});

describe("CPU cooler nodes", () => {
  const model = buildCpuCoolerModel(makeCpu());
  it("has cpu_ihs, fan_1 and label_area", () => {
    expect(findNode(model, "cpu_ihs")).not.toBeNull();
    expect(findNode(model, "fan_1")).not.toBeNull();
    expect(findNode(model, "label_area")).not.toBeNull();
  });
  it("points fan_1's local Z along -X", () => {
    const fan = findNode(model, "fan_1")!;
    fan.updateMatrixWorld(true);
    const dir = new Vector3(0, 0, 1).transformDirection(fan.matrix);
    expect(dir.x).toBeCloseTo(-1, 5);
    expect(dir.y).toBeCloseTo(0, 5);
    expect(dir.z).toBeCloseTo(0, 5);
  });
  it("holds the hub and 7 to 9 blades inside fan_1 but not the frame", () => {
    const fan = findNode(model, "fan_1")!;
    const inside = (o: Object3D | null) => {
      for (let p = o; p; p = p.parent) if (p === fan) return true;
      return false;
    };
    const blades: Object3D[] = [];
    model.traverse((o) => {
      if (o.name.startsWith("fan_blade_") && !o.name.includes("pivot")) blades.push(o);
    });
    expect(blades.length).toBeGreaterThanOrEqual(7);
    expect(blades.length).toBeLessThanOrEqual(9);
    expect(blades.every(inside)).toBe(true);
    expect(inside(model.getObjectByName("fan_hub") ?? null)).toBe(true);
    const frames = model.children.filter((c) => c.name.startsWith("fan_frame"));
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.some(inside)).toBe(false);
  });
});

describe("CPU frame colour", () => {
  it("differs between intel and amd", () => {
    expect(frameColour("intel")).not.toBe(frameColour("amd"));
  });
});

describe("CPU cooler build", () => {
  it("builds without a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(() => buildCpuCoolerModel(makeCpu())).not.toThrow();
  });
  it("stays under 3000 triangles", () => {
    expect(triangles(buildCpuCoolerModel(makeCpu({ tdp_w: 250 })))).toBeLessThan(3000);
  });
});
