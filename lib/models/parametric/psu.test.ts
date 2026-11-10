import { describe, expect, it } from "vitest";
import { Box3, Mesh, Vector3, type BufferGeometry, type Object3D } from "three";
import { makePsu } from "@/lib/engine/test-fixtures";
import { findNode, modelBounds } from "@/lib/models/snap";
import { DIMENSIONS } from "@/lib/models/standard";
import { buildPsuModel } from "./psu";

const EPS = 1e-6;

function named(root: Object3D, prefix: string): Object3D[] {
  const found: Object3D[] = [];
  root.traverse((o) => {
    if (o.name.startsWith(prefix)) found.push(o);
  });
  return found;
}

function triangles(root: Object3D): number {
  let count = 0;
  root.traverse((o) => {
    const geometry = (o as Mesh).geometry as BufferGeometry | undefined;
    if (!(o as Mesh).isMesh || !geometry) return;
    count += geometry.index
      ? geometry.index.count / 3
      : (geometry.attributes.position?.count ?? 0) / 3;
  });
  return count;
}

describe("psu model body", () => {
  it("is a group named psu with a body of exactly the PSU dimensions", () => {
    const psu = buildPsuModel(makePsu());
    expect(psu.name).toBe("psu");
    psu.updateMatrixWorld(true);
    const body = psu.getObjectByName("body") as Mesh;
    const bounds = new Box3().setFromObject(body);
    const { length, height, width } = DIMENSIONS.psu;
    expect(bounds.min.toArray()).toEqual([0, 0, 0].map((v) => expect.closeTo(v, 6)));
    expect(bounds.max.x).toBeCloseTo(length, 6);
    expect(bounds.max.y).toBeCloseTo(height, 6);
    expect(bounds.max.z).toBeCloseTo(width, 6);
  });
});

describe("psu model overall bounds", () => {
  it.each(["full", "semi", "none"] as const)(
    "%s: nothing leaves the body but +X cables",
    (modular) => {
      const bounds = modelBounds(buildPsuModel(makePsu({ modular })));
      const { length, height, width } = DIMENSIONS.psu;
      expect(bounds.min.x).toBeGreaterThanOrEqual(-EPS);
      expect(bounds.min.y).toBeGreaterThanOrEqual(-EPS);
      expect(bounds.min.z).toBeGreaterThanOrEqual(-EPS);
      expect(bounds.max.y).toBeLessThanOrEqual(height + EPS);
      expect(bounds.max.z).toBeLessThanOrEqual(width + EPS);
      expect(bounds.max.x).toBeLessThanOrEqual(220);
      expect(bounds.max.x).toBeGreaterThanOrEqual(length - EPS);
    },
  );

  it("full: x max is 160 plus at most 3 mm", () => {
    const bounds = modelBounds(buildPsuModel(makePsu({ modular: "full" })));
    expect(bounds.max.x).toBeLessThanOrEqual(DIMENSIONS.psu.length + 3 + EPS);
  });
});

describe("psu fan", () => {
  const psu = buildPsuModel(makePsu());
  psu.updateMatrixWorld(true);

  it("fan_1 has its local +Z along the model -Y", () => {
    const fan = findNode(psu, "fan_1")!;
    expect(fan).not.toBeNull();
    const direction = new Vector3(0, 0, 1).transformDirection(fan.matrixWorld);
    expect(direction.x).toBeCloseTo(0, 6);
    expect(direction.y).toBeCloseTo(-1, 6);
    expect(direction.z).toBeCloseTo(0, 6);
  });

  it("fan_1 sits at the bottom face and holds a hub and 7 to 9 blades", () => {
    const fan = findNode(psu, "fan_1")!;
    expect(fan.position.y).toBe(0);
    const blades = named(fan, "fan_blade_");
    expect(blades.length).toBeGreaterThanOrEqual(7);
    expect(blades.length).toBeLessThanOrEqual(9);
    for (const blade of blades) expect(blade.parent).toBe(fan);
    expect(named(fan, "fan_hub")).toHaveLength(1);
  });

  it("the grille is not a child of fan_1", () => {
    const fan = findNode(psu, "fan_1")!;
    expect(named(fan, "fan_grille")).toHaveLength(0);
    expect(named(psu, "fan_grille").length).toBeGreaterThan(0);
  });
});

describe("psu label", () => {
  it("has label_area at the +Z face centre and a label plane", () => {
    const psu = buildPsuModel(makePsu());
    const area = findNode(psu, "label_area")!;
    expect(area.position.toArray()).toEqual([80, 43, 150]);
    const label = findNode(psu, "label") as Mesh;
    expect(label.isMesh).toBe(true);
    expect(label.parent).toBe(area);
  });
});

describe("psu cables by modular", () => {
  it("full: 6 to 8 sockets and no cables", () => {
    const psu = buildPsuModel(makePsu({ modular: "full" }));
    const sockets = named(psu, "socket_").length;
    expect(sockets).toBeGreaterThanOrEqual(6);
    expect(sockets).toBeLessThanOrEqual(8);
    expect(named(psu, "cable_")).toHaveLength(0);
  });

  it("none: 3 to 4 cables of 40 to 60 mm and no sockets", () => {
    const psu = buildPsuModel(makePsu({ modular: "none" }));
    const cables = named(psu, "cable_");
    expect(cables.length).toBeGreaterThanOrEqual(3);
    expect(cables.length).toBeLessThanOrEqual(4);
    expect(named(psu, "socket_")).toHaveLength(0);
    for (const cable of cables) {
      const size = new Box3().setFromObject(cable).getSize(new Vector3());
      expect(size.x).toBeGreaterThanOrEqual(40);
      expect(size.x).toBeLessThanOrEqual(60);
    }
  });

  it("semi: a pair of cables and 3 to 4 sockets", () => {
    const psu = buildPsuModel(makePsu({ modular: "semi" }));
    expect(named(psu, "cable_")).toHaveLength(2);
    const sockets = named(psu, "socket_").length;
    expect(sockets).toBeGreaterThanOrEqual(3);
    expect(sockets).toBeLessThanOrEqual(4);
  });
});

describe("psu model construction", () => {
  it("builds without a DOM", () => {
    expect(typeof document).toBe("undefined");
    expect(() => buildPsuModel(makePsu())).not.toThrow();
  });

  it.each(["full", "semi", "none"] as const)("%s: stays under 2000 triangles", (modular) => {
    expect(triangles(buildPsuModel(makePsu({ modular })))).toBeLessThan(2000);
  });
});
