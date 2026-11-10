import { Group, Object3D, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import { placeInCase, ramSlotCount, ramSlotNumbers } from "./assemble";

function named(name: string, x = 0, y = 0, z = 0): Object3D {
  const o = new Object3D();
  o.name = name;
  o.position.set(x, y, z);
  return o;
}

function fakeCase(): Group {
  const g = new Group();
  g.add(named("mount_motherboard", 18, 455, 12), named("mount_psu", 4, 4, 32));
  return g;
}

function fakeBoard(ramSlots = 4): Group {
  const g = new Group();
  g.add(named("socket_cpu", 78, -72, 0), named("slot_pcie_1", 12, -158, 0));
  for (let i = 1; i <= ramSlots; i += 1) g.add(named(`slot_ram_${i}`, 138 + (i - 1) * 8, -80, 0));
  return g;
}

const position = (m: { elements: number[] } | null) =>
  m ? new Vector3().setFromMatrixPosition(m as never).toArray() : null;

describe("placeInCase", () => {
  it("places the motherboard and PSU on the case's mounts", () => {
    const c = fakeCase();
    expect(position(placeInCase(c, fakeBoard(), "motherboard", fakeBoard()))).toEqual([
      18, 455, 12,
    ]);
    expect(position(placeInCase(c, fakeBoard(), "psu", new Group()))).toEqual([4, 4, 32]);
  });

  it("places board-mounted parts through the board's position in the case", () => {
    const c = fakeCase();
    const board = fakeBoard();
    expect(position(placeInCase(c, board, "cpu_cooler", new Group()))).toEqual([96, 383, 12]);
    expect(position(placeInCase(c, board, "ram", new Group(), "slot_ram_3"))).toEqual([
      172, 375, 12,
    ]);
  });

  it("aligns a GPU's mount_pcie node, not its origin, with the slot", () => {
    const gpu = new Group();
    gpu.add(named("mount_pcie", 5, 0, 0));
    expect(position(placeInCase(fakeCase(), fakeBoard(), "gpu", gpu))).toEqual([25, 297, 12]);
  });

  it("follows wherever a model puts its nodes", () => {
    const c = new Group();
    c.add(named("mount_motherboard", 100, 400, 20), named("mount_psu", 0, 0, 0));
    const board = new Group();
    board.add(named("slot_pcie_1", 30, -200, 0));
    expect(position(placeInCase(c, board, "gpu", new Group()))).toEqual([130, 200, 20]);
  });

  it("returns null when a needed node is missing", () => {
    expect(placeInCase(new Group(), fakeBoard(), "psu", new Group())).toBeNull();
    expect(placeInCase(fakeCase(), new Group(), "gpu", new Group())).toBeNull();
    expect(placeInCase(fakeCase(), fakeBoard(2), "ram", new Group(), "slot_ram_3")).toBeNull();
  });
});

describe("RAM slots", () => {
  it("counts the RAM slot nodes of a board", () => {
    expect(ramSlotCount(fakeBoard(4))).toBe(4);
    expect(ramSlotCount(fakeBoard(2))).toBe(2);
    expect(ramSlotCount(new Group())).toBe(0);
  });

  it("fills slots the usual way", () => {
    expect(ramSlotNumbers(1, 4)).toEqual([2]);
    expect(ramSlotNumbers(2, 4)).toEqual([2, 4]);
    expect(ramSlotNumbers(4, 4)).toEqual([1, 2, 3, 4]);
    expect(ramSlotNumbers(2, 2)).toEqual([1, 2]);
    expect(ramSlotNumbers(1, 2)).toEqual([1]);
    expect(ramSlotNumbers(4, 2)).toEqual([1, 2]);
    expect(ramSlotNumbers(3, 4)).toEqual([1, 2, 3]);
    expect(ramSlotNumbers(2, 0)).toEqual([]);
  });
});
