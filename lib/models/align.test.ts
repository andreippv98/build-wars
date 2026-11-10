import { Document } from "@gltf-transform/core";
import { getBounds } from "@gltf-transform/functions";
import { describe, expect, it } from "vitest";
import { alignDocument, parseAnchor } from "./align";

/** A box of the given size with its minimum corner at the origin, in arbitrary units. */
function boxDocument(size: [number, number, number]): Document {
  const document = new Document();
  const buffer = document.createBuffer();
  const [x, y, z] = size;
  const corners = [0, 0, 0, x, 0, 0, 0, y, 0, x, y, 0, 0, 0, z, x, 0, z, 0, y, z, x, y, z];
  const position = document
    .createAccessor()
    .setType("VEC3")
    .setArray(new Float32Array(corners))
    .setBuffer(buffer);
  const indices = document
    .createAccessor()
    .setType("SCALAR")
    .setArray(new Uint16Array([0, 1, 2, 1, 3, 2, 4, 6, 5, 5, 6, 7]))
    .setBuffer(buffer);
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", position)
    .setIndices(indices);
  const node = document.createNode("body").setMesh(document.createMesh().addPrimitive(primitive));
  document.createScene().addChild(node);
  return document;
}

const anchors = (text: string) => text.split(",").map(parseAnchor) as never;
const rounded = (values: number[]) => values.map((n) => Math.round(n * 10) / 10 + 0);

describe("alignDocument", () => {
  it("scales the model so its X extent is the requested length", () => {
    const document = boxDocument([0.3, 0.04, 0.12]);
    const { sizeMm } = alignDocument(document, {
      rotateDeg: [0, 0, 0],
      lengthMm: 300,
      anchor: anchors("min,max,min"),
      addNodes: [],
    });
    expect(rounded(sizeMm)).toEqual([300, 40, 120]);
  });

  it("moves the chosen anchor to the origin, with offsets in mm", () => {
    const document = boxDocument([0.3, 0.04, 0.12]);
    alignDocument(document, {
      rotateDeg: [0, 0, 0],
      lengthMm: 300,
      anchor: anchors("min+12,max,min+8"),
      addNodes: [],
    });
    const bounds = getBounds(document.getRoot().listScenes()[0]);
    expect(rounded(bounds.min)).toEqual([-12, -40, -8]);
    expect(rounded(bounds.max)).toEqual([288, 0, 112]);
  });

  it("rotates about X, then Y, then Z before measuring", () => {
    // Raw: thickness on X, height on Y, length on Z (the layout of a typical downloaded card).
    const document = boxDocument([0.04, 0.12, 0.3]);
    const { sizeMm } = alignDocument(document, {
      rotateDeg: [90, 0, -90],
      lengthMm: 300,
      anchor: anchors("min,max,min"),
      addNodes: [],
    });
    // Raw Z (length) lands on X, raw X (thickness) on Y, raw Y (height) on Z.
    expect(rounded(sizeMm)).toEqual([300, 40, 120]);
  });

  it("adds attachment nodes at the scene root, outside the aligning node", () => {
    const document = boxDocument([1, 1, 1]);
    alignDocument(document, {
      rotateDeg: [0, 0, 0],
      lengthMm: 100,
      anchor: anchors("center,center,center"),
      addNodes: [
        { name: "mount_pcie", position: [0, 0, 0] },
        { name: "fan_1", position: [50, -20, 60] },
      ],
    });
    const children = document.getRoot().listScenes()[0].listChildren();
    expect(children.map((node) => node.getName())).toEqual([
      "aligned_model",
      "mount_pcie",
      "fan_1",
    ]);
    expect(children[1].getWorldTranslation()).toEqual([0, 0, 0]);
    expect(children[2].getWorldTranslation()).toEqual([50, -20, 60]);
  });
});

describe("parseAnchor", () => {
  it("reads a mode with an optional offset", () => {
    expect(parseAnchor("min")).toEqual({ mode: "min", offset: 0 });
    expect(parseAnchor("max-8")).toEqual({ mode: "max", offset: -8 });
    expect(parseAnchor("center+1.5")).toEqual({ mode: "center", offset: 1.5 });
  });

  it("rejects anything else", () => {
    expect(() => parseAnchor("left")).toThrow();
    expect(() => parseAnchor("min+")).toThrow();
  });
});
