import { describe, expect, it } from "vitest";
import { Box3, Mesh, MeshStandardMaterial, Object3D, Vector3 } from "three";
import { makeGpu } from "@/lib/engine/test-fixtures";
import { DIMENSIONS } from "@/lib/models/standard";
import { findNode, modelBounds } from "@/lib/models/snap";
import { buildGpuModel } from "./gpu";

const build = (board = {}) => buildGpuModel(makeGpu(board));

function fanNodes(model: Object3D): Object3D[] {
  const found: Object3D[] = [];
  model.traverse((o) => {
    if (/^fan_\d$/.test(o.name)) found.push(o);
  });
  return found;
}

function triangles(model: Object3D): number {
  let total = 0;
  model.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry;
    total += (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  });
  return total;
}

function shroudColor(maker: string): number {
  const shroud = build({ maker }).getObjectByName("shroud") as Mesh;
  return (shroud.material as MeshStandardMaterial).color.getHex();
}

describe("gpu model: attachment", () => {
  it("has mount_pcie at the origin with identity rotation", () => {
    const model = build();
    const mount = findNode(model, "mount_pcie")!;
    expect(mount).not.toBeNull();
    expect(mount.position.toArray()).toEqual([0, 0, 0]);
    expect(mount.quaternion.toArray()).toEqual([0, 0, 0, 1]);
  });

  it("is a group named gpu", () => {
    expect(build().name).toBe("gpu");
  });
});

describe("gpu model: size", () => {
  it.each([200, 304, 358])("body ends at length_mm for %i mm", (length) => {
    const bounds = modelBounds(build({ length_mm: length }));
    expect(bounds.max.x).toBeGreaterThanOrEqual(length - 0.5);
    expect(bounds.max.x).toBeLessThanOrEqual(length + 0.5);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-15);
    expect(bounds.min.x).toBeLessThan(0);
  });

  it("grows thicker with slot count and matches slots x pitch", () => {
    const thin = modelBounds(build({ slots: 2 }));
    const thick = modelBounds(build({ slots: 3.5 }));
    const pitch = DIMENSIONS.slotPitch;
    const thinY = thin.max.y - thin.min.y;
    const thickY = thick.max.y - thick.min.y;
    expect(thickY).toBeGreaterThan(thinY + pitch);
    expect(Math.abs(thin.min.y + 2 * pitch)).toBeLessThanOrEqual(2);
    expect(Math.abs(thick.min.y + 3.5 * pitch)).toBeLessThanOrEqual(2);
    expect(thin.max.y).toBeGreaterThanOrEqual(0);
    expect(thin.max.y).toBeLessThanOrEqual(3);
  });

  it("stands about gpuHeight tall and the edge connector drops below the board", () => {
    const bounds = modelBounds(build());
    expect(bounds.max.z).toBeGreaterThanOrEqual(DIMENSIONS.gpuHeight - 1);
    expect(bounds.max.z).toBeLessThanOrEqual(DIMENSIONS.gpuHeight + 12);
    expect(bounds.min.z).toBeLessThanOrEqual(-7);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-9);
  });

  it("stays under the triangle budget", () => {
    expect(
      triangles(build({ fan_count: 3, conn_8pin: 3, conn_6pin: 1, conn_12v2x6: 1 })),
    ).toBeLessThan(5000);
  });
});

describe("gpu model: fans", () => {
  it.each([1, 2, 3])("has fan_1..fan_%i", (count) => {
    const model = build({ fan_count: count });
    const names = fanNodes(model).map((f) => f.name);
    expect(names.sort()).toEqual(Array.from({ length: count }, (_, i) => `fan_${i + 1}`));
  });

  it("has no fans for 0 and draws 4 as 3", () => {
    expect(fanNodes(build({ fan_count: 0 }))).toHaveLength(0);
    expect(fanNodes(build({ fan_count: 4 }))).toHaveLength(3);
  });

  it("points each fan's local Z along the card's -Y", () => {
    const model = build({ fan_count: 3 });
    model.updateMatrixWorld(true);
    for (const fan of fanNodes(model)) {
      const direction = fan.getWorldDirection(new Vector3());
      expect(direction.x).toBeCloseTo(0);
      expect(direction.y).toBeCloseTo(-1);
      expect(direction.z).toBeCloseTo(0);
    }
  });

  it("holds the hub and 7 to 9 blades as descendants, and the recess outside the fan", () => {
    const model = build({ fan_count: 2 });
    for (const fan of fanNodes(model)) {
      let blades = 0;
      fan.traverse((o) => {
        if ((o as Mesh).isMesh && o.name.includes("blade")) blades++;
      });
      expect(blades).toBeGreaterThanOrEqual(7);
      expect(blades).toBeLessThanOrEqual(9);
      expect(fan.getObjectByName(`${fan.name}_hub`)).toBeTruthy();
      const n = fan.name.split("_")[1];
      const recess = model.getObjectByName(`fan_recess_${n}`)!;
      expect(recess).toBeTruthy();
      expect(recess.parent).toBe(model);
    }
  });

  it.each([200, 240, 304, 358])("keeps fans inside the length of a %i mm card", (length) => {
    const model = build({ length_mm: length, fan_count: 3 });
    model.updateMatrixWorld(true);
    for (const fan of fanNodes(model)) {
      const bounds = new Box3().setFromObject(fan);
      expect(bounds.min.x).toBeGreaterThanOrEqual(0);
      expect(bounds.max.x).toBeLessThanOrEqual(length);
      expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(DIMENSIONS.gpuHeight);
    }
  });
});

describe("gpu model: label and accents", () => {
  it("has label_area at the centre of the +Z face and a label mesh without a DOM", () => {
    const model = build({ length_mm: 300, slots: 2 });
    expect(typeof document).toBe("undefined");
    const area = findNode(model, "label_area")!;
    expect(area.position.x).toBeCloseTo(150);
    expect(area.position.y).toBeCloseTo(-DIMENSIONS.slotPitch);
    expect(area.position.z).toBeCloseTo(DIMENSIONS.gpuHeight);
    const label = model.getObjectByName("label") as Mesh;
    expect(label).toBeTruthy();
    expect((label.material as MeshStandardMaterial).transparent).toBe(true);
  });

  it("has an rgb_strip with a faint emissive colour", () => {
    const strip = build().getObjectByName("rgb_strip") as Mesh;
    expect(strip).toBeTruthy();
    const emissive = (strip.material as MeshStandardMaterial).emissive;
    expect(emissive.getHex()).not.toBe(0);
    expect(Math.max(emissive.r, emissive.g, emissive.b)).toBeLessThan(0.1);
  });
});

describe("gpu model: power connectors", () => {
  it.each([
    [0, 0, 1],
    [1, 2, 0],
    [0, 3, 0],
    [1, 1, 1],
    [0, 0, 0],
  ])("draws one block per connector (6pin %i, 8pin %i, 12v2x6 %i)", (six, eight, twelve) => {
    const model = build({ conn_6pin: six, conn_8pin: eight, conn_12v2x6: twelve });
    let count = 0;
    model.traverse((o) => {
      if (o.name.startsWith("power_")) count++;
    });
    expect(count).toBe(six + eight + twelve);
  });

  it("keeps every connector inside the card's length", () => {
    const model = build({ length_mm: 200, conn_8pin: 3, conn_6pin: 1 });
    const bounds = modelBounds(model);
    expect(bounds.max.x).toBeLessThanOrEqual(200.5);
    model.traverse((o) => {
      if (o.name.startsWith("power_")) {
        expect(new Box3().setFromObject(o).min.x).toBeGreaterThanOrEqual(0);
      }
    });
  });
});

describe("gpu model: maker colour", () => {
  it("is stable per maker and differs between at least one pair of makers", () => {
    expect(shroudColor("Asus")).toBe(shroudColor("Asus"));
    const colors = new Set(
      ["Asus", "MSI", "Gigabyte", "Zotac", "Sapphire", "PowerColor"].map(shroudColor),
    );
    expect(colors.size).toBeGreaterThan(1);
  });
});
