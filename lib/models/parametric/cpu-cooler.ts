import { CylinderGeometry, Mesh, type Group, type Material } from "three";
import type { SlotPart } from "@/lib/build";
import { NODES } from "@/lib/models/standard";
import { box, group, material, node } from "./shared";

/** Fin stack height (mm) by CPU power: the one data-driven detail of the generic cooler. */
export const COOLER_FIN_HEIGHT = { standardMm: 110, highMm: 125, highAboveTdpW: 95 } as const;

const L = {
  frame: { size: 54, height: 4, opening: 40 },
  ihs: { size: 38, height: 7 },
  frameColor: { intel: 0xb4b8bf, amd: 0x8c8378 },
  baseColor: 0x1f2937,
  ihsColor: 0xc9ccd1,
  basePlate: { size: 40, thickness: 6 },
  pipe: { radius: 3, offsetX: 2, ys: [-18, -6, 6, 18], segments: 10, color: 0xb87333 },
  fins: { x0: -20, width: 50, length: 120, z0: 39, count: 14, thickness: 0.6, color: 0x9ca3af },
  fan: {
    size: 120,
    depth: 25,
    gap: 2,
    border: 6,
    x0: -45,
    blades: 9,
    hubRadius: 16,
    hubDepth: 12,
    bladeLength: 40,
    bladeWidth: 14,
    bladeThickness: 1.5,
    bladePitch: 0.35,
    frameColor: 0x111827,
    bladeColor: 0x374151,
  },
} as const;

/** Fin stack height in mm for a CPU's power. */
export function coolerFinHeight(tdpW: number): number {
  return tdpW > COOLER_FIN_HEIGHT.highAboveTdpW
    ? COOLER_FIN_HEIGHT.highMm
    : COOLER_FIN_HEIGHT.standardMm;
}

function cylinderAlongZ(
  name: string,
  radius: number,
  length: number,
  segments: number,
  mat: Material,
) {
  const mesh = new Mesh(new CylinderGeometry(radius, radius, length, segments), mat);
  mesh.name = name;
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

/** CPU in its socket under a generic single-tower cooler. Origin = socket centre on the board. */
export function buildCpuCoolerModel(cpu: SlotPart["cpu"]): Group {
  const model = group("cpu_cooler");

  // Socket retention frame (four bars around an opening) and the CPU's heat spreader.
  const { size, height, opening } = L.frame;
  const frameMat = material(L.frameColor[cpu.vendor], { metalness: 0.7, roughness: 0.35 });
  const border = (size - opening) / 2;
  const h = size / 2;
  model.add(
    box("socket_seat", { x: -h, y: -h, z: 0 }, { x: size, y: size, z: 1 }, material(L.baseColor)),
    box(
      "socket_frame_front",
      { x: h - border, y: -h, z: 0 },
      { x: border, y: size, z: height },
      frameMat,
    ),
    box("socket_frame_rear", { x: -h, y: -h, z: 0 }, { x: border, y: size, z: height }, frameMat),
    box(
      "socket_frame_top",
      { x: -h + border, y: h - border, z: 0 },
      { x: opening, y: border, z: height },
      frameMat,
    ),
    box(
      "socket_frame_bottom",
      { x: -h + border, y: -h, z: 0 },
      { x: opening, y: border, z: height },
      frameMat,
    ),
  );
  const ihsHalf = L.ihs.size / 2;
  const ihs = box(
    "cpu_ihs",
    { x: -ihsHalf, y: -ihsHalf, z: 0 },
    { x: L.ihs.size, y: L.ihs.size, z: L.ihs.height },
    material(L.ihsColor, { metalness: 0.85, roughness: 0.3 }),
  );
  model.add(ihs);

  // Cooler: base plate, heat pipes, fin stack.
  const finHeight = coolerFinHeight(cpu.tdp_w);
  const finTop = L.fins.z0 + finHeight;
  const bp = L.basePlate;
  model.add(
    box(
      "cooler_base",
      { x: -bp.size / 2, y: -bp.size / 2, z: L.ihs.height },
      { x: bp.size, y: bp.size, z: bp.thickness },
      material(L.pipe.color, { metalness: 0.8, roughness: 0.4 }),
    ),
  );
  const pipeMat = material(L.pipe.color, { metalness: 0.8, roughness: 0.35 });
  const pipeZ0 = L.ihs.height + bp.thickness;
  const pipeZ1 = finTop - 10;
  for (const [i, y] of L.pipe.ys.entries()) {
    const pipe = cylinderAlongZ(
      `heat_pipe_${i + 1}`,
      L.pipe.radius,
      pipeZ1 - pipeZ0,
      L.pipe.segments,
      pipeMat,
    );
    pipe.position.set(L.pipe.offsetX, y, (pipeZ0 + pipeZ1) / 2);
    model.add(pipe);
  }
  const finMat = material(L.fins.color, { metalness: 0.8, roughness: 0.4 });
  const pitch = (finHeight - L.fins.thickness) / (L.fins.count - 1);
  const fins = group("fin_stack");
  for (let i = 0; i < L.fins.count; i++) {
    fins.add(
      box(
        `fin_${i + 1}`,
        { x: L.fins.x0, y: -L.fins.length / 2, z: L.fins.z0 + i * pitch },
        { x: L.fins.width, y: L.fins.length, z: L.fins.thickness },
        finMat,
      ),
    );
  }
  model.add(fins);

  // Fan on the -X side: static frame, and a spinning `fan_1` node (local +Z = model -X).
  const f = L.fan;
  const fanZ = L.fins.z0 + finHeight / 2;
  const fanHalf = f.size / 2;
  const fanMat = material(f.frameColor, { metalness: 0.2, roughness: 0.7 });
  const inner = f.size - 2 * f.border;
  model.add(
    box(
      "fan_frame_top",
      { x: f.x0, y: -fanHalf, z: fanZ + fanHalf - f.border },
      { x: f.depth, y: f.size, z: f.border },
      fanMat,
    ),
    box(
      "fan_frame_bottom",
      { x: f.x0, y: -fanHalf, z: fanZ - fanHalf },
      { x: f.depth, y: f.size, z: f.border },
      fanMat,
    ),
    box(
      "fan_frame_front",
      { x: f.x0, y: fanHalf - f.border, z: fanZ - inner / 2 },
      { x: f.depth, y: f.border, z: inner },
      fanMat,
    ),
    box(
      "fan_frame_rear",
      { x: f.x0, y: -fanHalf, z: fanZ - inner / 2 },
      { x: f.depth, y: f.border, z: inner },
      fanMat,
    ),
  );
  const fan = node(NODES.fan(1), f.x0 + f.depth / 2, 0, fanZ);
  fan.rotation.y = -Math.PI / 2;
  const hub = cylinderAlongZ("fan_hub", f.hubRadius, f.hubDepth, 16, material(f.bladeColor));
  fan.add(hub);
  const bladeMat = material(f.bladeColor, { metalness: 0.1, roughness: 0.8 });
  const bladeCentre = f.hubRadius + f.bladeLength / 2 - 2;
  for (let i = 0; i < f.blades; i++) {
    const angle = (i / f.blades) * Math.PI * 2;
    const blade = box(
      `fan_blade_${i + 1}`,
      { x: -f.bladeLength / 2, y: -f.bladeWidth / 2, z: -f.bladeThickness / 2 },
      { x: f.bladeLength, y: f.bladeWidth, z: f.bladeThickness },
      bladeMat,
    );
    // Pivot so the blade's long axis points outward at `angle`, pitched around that axis.
    const pivot = group(`fan_blade_pivot_${i + 1}`, blade);
    pivot.rotation.order = "ZYX";
    pivot.rotation.set(f.bladePitch, 0, angle);
    pivot.position.set(Math.cos(angle) * bladeCentre, Math.sin(angle) * bladeCentre, 0);
    fan.add(pivot);
  }
  model.add(fan);

  model.add(node(NODES.labelArea, L.fins.x0 + L.fins.width / 2, 0, finTop));
  return model;
}
