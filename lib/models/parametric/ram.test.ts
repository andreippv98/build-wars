import { describe, expect, it } from "vitest";
import type { Mesh } from "three";
import { makeRam } from "@/lib/engine/test-fixtures";
import { DIMENSIONS } from "@/lib/models/standard";
import { findNode, modelBounds } from "@/lib/models/snap";
import { makerColor } from "./shared";
import { buildRamStickModel, ramHeatsinkHeight, RAM_HEIGHT } from "./ram";

function triangles(model: ReturnType<typeof buildRamStickModel>): number {
  let count = 0;
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    count += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return count;
}

function colourOf(model: ReturnType<typeof buildRamStickModel>, name: string): number {
  const mesh = model.getObjectByName(name) as Mesh;
  return (mesh.material as unknown as { color: { getHex(): number } }).color.getHex();
}

describe("RAM stick bounds", () => {
  const { length, thickness } = DIMENSIONS.ramStick;
  for (const kit of [
    makeRam({ type: "DDR4", speed_mts: 3200 }),
    makeRam({ type: "DDR4", speed_mts: 4000 }),
    makeRam({ type: "DDR5", speed_mts: 6000 }),
    makeRam({ type: "DDR5", speed_mts: 8000 }),
  ]) {
    it(`fits the mount convention for ${kit.type}-${kit.speed_mts}`, () => {
      const model = buildRamStickModel(kit);
      expect(model.name).toBe("ram_stick");
      const b = modelBounds(model);
      expect(b.min.y).toBeCloseTo(-length / 2, 5);
      expect(b.max.y).toBeCloseTo(length / 2, 5);
      expect(b.max.x).toBeLessThanOrEqual(thickness / 2 + 1e-6);
      expect(b.min.x).toBeGreaterThanOrEqual(-thickness / 2 - 1e-6);
      expect(b.min.z).toBeCloseTo(-3, 5);
      expect(b.max.z).toBeCloseTo(ramHeatsinkHeight(kit.type, kit.speed_mts), 5);
    });
  }
});

describe("RAM heatsink height", () => {
  it("is 34 mm for DDR4 up to 3200", () => {
    expect(ramHeatsinkHeight("DDR4", 2666)).toBe(34);
    expect(ramHeatsinkHeight("DDR4", 3200)).toBe(34);
  });
  it("rises with speed and never passes the maximum", () => {
    expect(ramHeatsinkHeight("DDR4", 3600)).toBeGreaterThan(ramHeatsinkHeight("DDR4", 3200));
    expect(ramHeatsinkHeight("DDR4", 3600)).toBeLessThanOrEqual(RAM_HEIGHT.maxHeight);
    expect(ramHeatsinkHeight("DDR4", 9999)).toBe(RAM_HEIGHT.maxHeight);
    expect(ramHeatsinkHeight("DDR5", 9999)).toBe(RAM_HEIGHT.maxHeight);
  });
  it("is taller for DDR5 than DDR4 at the same relative step", () => {
    expect(ramHeatsinkHeight("DDR5", 4800)).toBeGreaterThan(ramHeatsinkHeight("DDR4", 3200));
    expect(ramHeatsinkHeight("DDR5", 5600)).toBeGreaterThan(ramHeatsinkHeight("DDR4", 3600));
  });
});

describe("RAM colour", () => {
  it("uses a stable maker colour when a brand is set", () => {
    const a = buildRamStickModel(makeRam({ brand: "Corsair" }));
    const b = buildRamStickModel(makeRam({ brand: "Corsair" }));
    expect(colourOf(a, "heatsink_0_pos")).toBe(makerColor("Corsair"));
    expect(colourOf(a, "heatsink_0_pos")).toBe(colourOf(b, "heatsink_0_pos"));
  });
  it("differs from the unbranded colour", () => {
    const branded = buildRamStickModel(makeRam({ brand: "Corsair" }));
    const plain = buildRamStickModel(makeRam({ brand: undefined }));
    expect(colourOf(branded, "heatsink_0_pos")).not.toBe(colourOf(plain, "heatsink_0_pos"));
  });
  it("uses a lighter neutral for DDR5 than DDR4", () => {
    const d4 = buildRamStickModel(makeRam({ type: "DDR4", brand: undefined }));
    const d5 = buildRamStickModel(makeRam({ type: "DDR5", brand: undefined }));
    expect(colourOf(d5, "heatsink_0_pos")).toBeGreaterThan(colourOf(d4, "heatsink_0_pos"));
  });
});

describe("RAM rgb bar", () => {
  const has = (type: "DDR4" | "DDR5", speed: number) =>
    findNode(buildRamStickModel(makeRam({ type, speed_mts: speed })), "rgb_bar") !== null;
  it("appears from DDR4-3600", () => {
    expect(has("DDR4", 3200)).toBe(false);
    expect(has("DDR4", 3599)).toBe(false);
    expect(has("DDR4", 3600)).toBe(true);
  });
  it("appears from DDR5-6000", () => {
    expect(has("DDR5", 5600)).toBe(false);
    expect(has("DDR5", 5999)).toBe(false);
    expect(has("DDR5", 6000)).toBe(true);
  });
});

describe("RAM label and budget", () => {
  it("has a label_area node on the +X face", () => {
    const node = findNode(buildRamStickModel(makeRam()), "label_area");
    expect(node).not.toBeNull();
    expect(node!.position.x).toBeCloseTo(DIMENSIONS.ramStick.thickness / 2, 5);
    expect(node!.position.y).toBe(0);
  });
  it("builds without a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(() => buildRamStickModel(makeRam())).not.toThrow();
  });
  it("stays under 500 triangles", () => {
    expect(triangles(buildRamStickModel(makeRam({ speed_mts: 8000 })))).toBeLessThan(500);
  });
});
