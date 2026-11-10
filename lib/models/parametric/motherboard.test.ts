import { Box3, Mesh, Vector3, type Material, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { makeMotherboard } from "@/lib/engine/test-fixtures";
import { findNode, modelBounds } from "@/lib/models/snap";
import { DIMENSIONS, MAX_RAM_SLOTS, NODES } from "@/lib/models/standard";
import { buildMotherboardModel } from "./motherboard";

const FORM_FACTORS = ["E-ATX", "ATX", "mATX", "ITX"] as const;
const TOL = 0.5;

function meshes(model: Object3D): Mesh[] {
  const out: Mesh[] = [];
  model.traverse((o) => {
    if ((o as Mesh).isMesh) out.push(o as Mesh);
  });
  return out;
}

function meshBox(mesh: Mesh): Box3 {
  mesh.updateWorldMatrix(true, false);
  mesh.geometry.computeBoundingBox();
  return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
}

function triangles(model: Object3D): number {
  return meshes(model).reduce((sum, m) => {
    const index = m.geometry.index;
    return sum + (index ? index.count : m.geometry.attributes.position.count) / 3;
  }, 0);
}

function nodePos(model: Object3D, name: string): Vector3 {
  const n = findNode(model, name);
  if (!n) throw new Error(`missing node ${name}`);
  return n.position;
}

const DECORATIVE_ALLOWED_TALL = (name: string) =>
  name === "pcb" || name === "socket_frame" || name.startsWith("ram_strip_") || name === "rear_io";

describe("board outline", () => {
  for (const ff of FORM_FACTORS) {
    it(`${ff}: PCB and whole model fit the outline`, () => {
      const model = buildMotherboardModel(makeMotherboard({ form_factor: ff }));
      const { width, height } = DIMENSIONS.motherboard[ff];
      const pcb = meshBox(meshes(model).find((m) => m.name === "pcb")!);
      expect(pcb.min.x).toBeCloseTo(0);
      expect(pcb.max.x).toBeCloseTo(width);
      expect(pcb.min.y).toBeCloseTo(-height);
      expect(pcb.max.y).toBeCloseTo(0);
      const b = modelBounds(model);
      expect(b.min.x).toBeGreaterThanOrEqual(-TOL);
      expect(b.max.x).toBeLessThanOrEqual(width + TOL);
      expect(b.min.y).toBeGreaterThanOrEqual(-height - TOL);
      expect(b.max.y).toBeLessThanOrEqual(TOL);
      expect(b.min.z).toBeCloseTo(-DIMENSIONS.pcbThickness);
    });
  }
});

describe("attachment nodes", () => {
  it("sit at the layout positions, z = 0, identity rotation", () => {
    const model = buildMotherboardModel(makeMotherboard());
    const l = DIMENSIONS.boardLayout;
    expect(nodePos(model, NODES.socketCpu).toArray()).toEqual([l.socketCpu.x, l.socketCpu.y, 0]);
    expect(nodePos(model, NODES.slotPcie1).toArray()).toEqual([l.slotPcie1.x, l.slotPcie1.y, 0]);
    for (let i = 1; i <= 4; i++) {
      expect(nodePos(model, NODES.slotRam(i)).toArray()).toEqual([
        l.ramSlot1.x + (i - 1) * l.ramSlotPitch,
        l.ramSlot1.y,
        0,
      ]);
    }
    for (const name of [
      NODES.socketCpu,
      NODES.slotPcie1,
      NODES.labelArea,
      ...[1, 2, 3, 4].map((i) => NODES.slotRam(i)),
    ]) {
      const n = findNode(model, name)!;
      expect(n.position.z).toBe(0);
      expect(n.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    }
  });

  it("creates slot_ram_1..n for 2 and 4 slots and none beyond", () => {
    for (const n of [2, 4]) {
      const model = buildMotherboardModel(makeMotherboard({ ram_slots: n }));
      for (let i = 1; i <= n; i++) expect(findNode(model, NODES.slotRam(i))).not.toBeNull();
      expect(findNode(model, NODES.slotRam(n + 1))).toBeNull();
    }
  });

  it("caps 8 RAM slots at MAX_RAM_SLOTS", () => {
    const model = buildMotherboardModel(makeMotherboard({ ram_slots: 8 }));
    expect(findNode(model, NODES.slotRam(MAX_RAM_SLOTS))).not.toBeNull();
    expect(findNode(model, NODES.slotRam(MAX_RAM_SLOTS + 1))).toBeNull();
  });

  it("lie inside every form factor outline, ITX included", () => {
    for (const ff of FORM_FACTORS) {
      const { width, height } = DIMENSIONS.motherboard[ff];
      const model = buildMotherboardModel(makeMotherboard({ form_factor: ff }));
      for (const name of [NODES.socketCpu, NODES.slotPcie1, NODES.slotRam(4)]) {
        const p = nodePos(model, name);
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(width);
        expect(p.y).toBeLessThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(-height);
      }
    }
  });
});

describe("decorative features stay low and clear", () => {
  for (const ff of FORM_FACTORS) {
    it(`${ff}: heights`, () => {
      const model = buildMotherboardModel(makeMotherboard({ form_factor: ff }));
      for (const m of meshes(model)) {
        const top = meshBox(m).max.z;
        if (!DECORATIVE_ALLOWED_TALL(m.name)) expect(top, m.name).toBeLessThanOrEqual(12);
        expect(top, m.name).toBeLessThanOrEqual(40);
      }
    });

    it(`${ff}: keeps the graphics card and cooler volumes free`, () => {
      const model = buildMotherboardModel(makeMotherboard({ form_factor: ff }));
      const pcie = DIMENSIONS.boardLayout.slotPcie1;
      const socket = DIMENSIONS.boardLayout.socketCpu;
      const gpuZone = new Box3(
        new Vector3(pcie.x, pcie.y - DIMENSIONS.slotPitch, 10.001),
        new Vector3(pcie.x + 300, pcie.y, 500),
      );
      const coolerZone = new Box3(
        new Vector3(socket.x - 50, socket.y - 50, 10.001),
        new Vector3(socket.x + 50, socket.y + 50, 500),
      );
      for (const m of meshes(model)) {
        const b = meshBox(m);
        expect(b.intersectsBox(gpuZone), `${m.name} in GPU zone`).toBe(false);
        expect(b.intersectsBox(coolerZone), `${m.name} in cooler zone`).toBe(false);
      }
    });
  }

  it("has no expansion strips below the PCIe slot on ITX", () => {
    const names = meshes(buildMotherboardModel(makeMotherboard({ form_factor: "ITX" }))).map(
      (m) => m.name,
    );
    expect(names).toContain("pcie_strip_1");
    expect(names).not.toContain("pcie_strip_2");
  });

  it("adds further expansion strips on ATX", () => {
    const names = meshes(buildMotherboardModel(makeMotherboard({ form_factor: "ATX" }))).map(
      (m) => m.name,
    );
    expect(names).toContain("pcie_strip_2");
  });
});

describe("label", () => {
  it("is a flat mesh on the PCB inside the board when a board is given", () => {
    for (const ff of FORM_FACTORS) {
      const model = buildMotherboardModel(makeMotherboard({ form_factor: ff }));
      const label = meshes(model).find((m) => m.name === "label")!;
      expect(label).toBeDefined();
      const b = meshBox(label);
      const { width, height } = DIMENSIONS.motherboard[ff];
      expect(b.min.x).toBeGreaterThanOrEqual(0);
      expect(b.max.x).toBeLessThanOrEqual(width);
      expect(b.min.y).toBeGreaterThanOrEqual(-height);
      expect(b.max.z).toBeLessThan(1);
    }
  });
});

describe("placeholder board (null)", () => {
  const model = buildMotherboardModel(null);

  it("is ATX size with 4 RAM nodes and all nodes", () => {
    const pcb = meshBox(meshes(model).find((m) => m.name === "pcb")!);
    expect(pcb.max.x).toBeCloseTo(DIMENSIONS.motherboard.ATX.width);
    expect(pcb.min.y).toBeCloseTo(-DIMENSIONS.motherboard.ATX.height);
    for (const name of [
      NODES.socketCpu,
      NODES.slotPcie1,
      NODES.labelArea,
      ...[1, 2, 3, 4].map((i) => NODES.slotRam(i)),
    ]) {
      expect(findNode(model, name), name).not.toBeNull();
    }
  });

  it("has only translucent materials and no label", () => {
    for (const m of meshes(model)) {
      const mat = m.material as Material;
      expect(mat.transparent).toBe(true);
      expect(mat.opacity).toBeLessThan(0.5);
    }
    expect(meshes(model).some((m) => m.name === "label")).toBe(false);
  });
});

describe("budget", () => {
  it("builds without a DOM and stays under 5000 triangles", () => {
    expect(typeof document).toBe("undefined");
    for (const ff of FORM_FACTORS) {
      const model = buildMotherboardModel(makeMotherboard({ form_factor: ff }));
      expect(model.name).toBe("motherboard");
      expect(triangles(model)).toBeLessThan(5000);
    }
  });
});
