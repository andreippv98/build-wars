import fs from "node:fs";
import path from "node:path";
import { Document, NodeIO, type Buffer as GltfBuffer } from "@gltf-transform/core";

/**
 * `pnpm models:sample [out.glb]` writes a deliberately simple GPU that follows the model standard
 * (see docs/model-standard.md), for trying `models:import` and the scene without real artwork.
 * Millimetres; body spans +X, -Y, +Z from the origin; `mount_pcie` sits at the origin.
 */

const DEFAULT_OUT = "public/models/_sample/sample-gpu.glb";
const BODY = { length: 285, thickness: 40, height: 120 };
const FAN = { radius: 45, segments: 32, xs: [75, 210], z: 60 };
const TEAL: [number, number, number, number] = [0.0, 0.55, 0.55, 1];

type Geometry = { positions: number[]; normals: number[]; indices: number[] };

/** A box from the origin spanning +X, -Y, +Z, with a normal per face. */
export function boxGeometry(length: number, thickness: number, height: number): Geometry {
  const x0 = 0;
  const x1 = length;
  const y0 = -thickness;
  const y1 = 0;
  const z0 = 0;
  const z1 = height;
  // Each face: normal and four corners counter-clockwise seen from outside.
  const faces: { n: number[]; v: number[][] }[] = [
    {
      n: [1, 0, 0],
      v: [
        [x1, y0, z0],
        [x1, y1, z0],
        [x1, y1, z1],
        [x1, y0, z1],
      ],
    },
    {
      n: [-1, 0, 0],
      v: [
        [x0, y0, z1],
        [x0, y1, z1],
        [x0, y1, z0],
        [x0, y0, z0],
      ],
    },
    {
      n: [0, 1, 0],
      v: [
        [x0, y1, z0],
        [x0, y1, z1],
        [x1, y1, z1],
        [x1, y1, z0],
      ],
    },
    {
      n: [0, -1, 0],
      v: [
        [x0, y0, z1],
        [x0, y0, z0],
        [x1, y0, z0],
        [x1, y0, z1],
      ],
    },
    {
      n: [0, 0, 1],
      v: [
        [x0, y0, z1],
        [x1, y0, z1],
        [x1, y1, z1],
        [x0, y1, z1],
      ],
    },
    {
      n: [0, 0, -1],
      v: [
        [x1, y0, z0],
        [x0, y0, z0],
        [x0, y1, z0],
        [x1, y1, z0],
      ],
    },
  ];
  const geometry: Geometry = { positions: [], normals: [], indices: [] };
  faces.forEach((face, i) => {
    for (const vertex of face.v) {
      geometry.positions.push(...vertex);
      geometry.normals.push(...face.n);
    }
    const b = i * 4;
    geometry.indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
  });
  return geometry;
}

/** A flat disc in the XY plane facing +Z (a fan blade stand-in; the fan node spins around Z). */
export function discGeometry(radius: number, segments: number): Geometry {
  const geometry: Geometry = { positions: [0, 0, 0], normals: [0, 0, 1], indices: [] };
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    geometry.positions.push(Math.cos(angle) * radius, Math.sin(angle) * radius, 0);
    geometry.normals.push(0, 0, 1);
    geometry.indices.push(0, 1 + i, 1 + ((i + 1) % segments));
  }
  return geometry;
}

function toMesh(
  document: Document,
  buffer: GltfBuffer,
  name: string,
  geometry: Geometry,
  material: ReturnType<Document["createMaterial"]>,
) {
  const accessor = (
    type: "VEC3" | "SCALAR",
    array: Float32Array<ArrayBuffer> | Uint16Array<ArrayBuffer>,
  ) => document.createAccessor().setType(type).setArray(array).setBuffer(buffer);
  const primitive = document
    .createPrimitive()
    .setAttribute("POSITION", accessor("VEC3", new Float32Array(geometry.positions)))
    .setAttribute("NORMAL", accessor("VEC3", new Float32Array(geometry.normals)))
    .setIndices(accessor("SCALAR", new Uint16Array(geometry.indices)))
    .setMaterial(material);
  return document.createMesh(name).addPrimitive(primitive);
}

export function buildSampleGpu(): Document {
  const document = new Document();
  const buffer = document.createBuffer();
  const material = document
    .createMaterial("teal")
    .setBaseColorFactor(TEAL)
    .setMetallicFactor(0.6)
    .setRoughnessFactor(0.4);
  const scene = document.createScene("sample-gpu");

  scene.addChild(
    document
      .createNode("body")
      .setMesh(
        toMesh(
          document,
          buffer,
          "body",
          boxGeometry(BODY.length, BODY.thickness, BODY.height),
          material,
        ),
      ),
  );
  scene.addChild(document.createNode("mount_pcie"));

  // The fans face down (-Y): turn each fan node so its local Z axis points along -Y.
  const quarterTurn = Math.SQRT1_2;
  const disc = toMesh(
    document,
    buffer,
    "fan-disc",
    discGeometry(FAN.radius, FAN.segments),
    material,
  );
  FAN.xs.forEach((x, i) => {
    const fan = document
      .createNode(`fan_${i + 1}`)
      .setTranslation([x, -BODY.thickness, FAN.z])
      .setRotation([quarterTurn, 0, 0, quarterTurn]);
    fan.addChild(document.createNode(`fan_${i + 1}_blades`).setMesh(disc));
    scene.addChild(fan);
  });

  scene.addChild(
    document
      .createNode("label_area")
      .setTranslation([BODY.length / 2, -BODY.thickness / 2, BODY.height]),
  );
  return document;
}

async function main(): Promise<void> {
  const out = process.argv[2] ?? DEFAULT_OUT;
  const bytes = await new NodeIO().writeBinary(buildSampleGpu());
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bytes);
  console.log(`Wrote sample GPU (${bytes.length} bytes) to ${out}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
