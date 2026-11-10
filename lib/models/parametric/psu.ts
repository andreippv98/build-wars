import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
} from "three";
import type { SlotPart } from "@/lib/build";
import { DIMENSIONS, NODES } from "@/lib/models/standard";
import { box, group, labelTexture, material, node } from "./shared";

/**
 * Parametric power supply. Origin = rear bottom corner on the tray side; spans +X (length),
 * +Y (height), +Z (width). The body is exact; only cable stubs and connector sockets stand out
 * past x = length, and nothing goes beyond the body in Y, Z or toward -X.
 */

const FAN_DIAMETER = 120;
const FAN_BLADES = 8;
const SOCKET_DEPTH = 3;
const CABLE_LENGTH = 50;
const CABLE_RADIUS = 4;

/** Flat decals sit exactly on a face: win the depth test instead of protruding. */
function flatMaterial(color: number, options: { metalness?: number; roughness?: number } = {}) {
  const mat = material(color, options);
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -1;
  mat.polygonOffsetUnits = -1;
  return mat;
}

function socket(name: string, y: number, z: number, mat: MeshStandardMaterial): Mesh {
  const { length } = DIMENSIONS.psu;
  return box(name, { x: length, y: y - 5, z: z - 7 }, { x: SOCKET_DEPTH, y: 10, z: 14 }, mat);
}

function cable(name: string, y: number, z: number, mat: MeshStandardMaterial): Mesh {
  const { length } = DIMENSIONS.psu;
  const mesh = new Mesh(new CylinderGeometry(CABLE_RADIUS, CABLE_RADIUS, CABLE_LENGTH, 12), mat);
  mesh.name = name;
  mesh.rotation.z = Math.PI / 2; // cylinder axis Y -> X
  mesh.position.set(length + CABLE_LENGTH / 2, y, z);
  return mesh;
}

export function buildPsuModel(psu: SlotPart["psu"]): Group {
  const { length, height, width } = DIMENSIONS.psu;
  const root = group("psu");

  const bodyMat = material(0x1b1e24, { metalness: 0.5, roughness: 0.5 });
  const detailMat = flatMaterial(0x0c0d10, { metalness: 0.4, roughness: 0.7 });
  const plasticMat = material(0x111215, { metalness: 0.1, roughness: 0.8 });

  root.add(box("body", { x: 0, y: 0, z: 0 }, { x: length, y: height, z: width }, bodyMat));

  // Fan on the bottom face (-Y). Grille is a sibling of fan_1, not a child.
  const fanX = length / 2;
  const fanZ = width / 2;
  const radius = FAN_DIAMETER / 2;
  const grille = group("fan_grille");
  grille.position.set(fanX, 0, fanZ);
  grille.rotation.x = Math.PI / 2; // face normal +Z -> -Y
  const recess = new Mesh(new CircleGeometry(radius, 48), detailMat);
  recess.name = "fan_recess";
  grille.add(recess);
  for (const [inner, outer] of [
    [radius - 3, radius],
    [radius * 0.72, radius * 0.72 + 1.5],
    [radius * 0.46, radius * 0.46 + 1.5],
  ]) {
    const ring = new Mesh(new RingGeometry(inner, outer, 48), flatMaterial(0x2a2e36));
    ring.name = "fan_grille_ring";
    ring.position.z = 0;
    grille.add(ring);
  }
  root.add(grille);

  const fan = node(NODES.fan(1), fanX, 0, fanZ);
  fan.rotation.x = Math.PI / 2; // local +Z -> model -Y
  const bladeMat = flatMaterial(0x3a3f49, { metalness: 0.2, roughness: 0.5 });
  const hub = new Mesh(new CylinderGeometry(14, 14, 1, 24), bladeMat);
  hub.name = "fan_hub";
  hub.rotation.x = Math.PI / 2; // cylinder axis -> local Z
  hub.position.z = -0.5; // inside the body, cap flush with the face
  fan.add(hub);
  const bladeLength = radius - 20;
  for (let i = 0; i < FAN_BLADES; i++) {
    const angle = (i / FAN_BLADES) * Math.PI * 2;
    const blade = new Mesh(new BoxGeometry(bladeLength, 18, 0.5), bladeMat);
    blade.name = `fan_blade_${i + 1}`;
    const r = 14 + bladeLength / 2;
    blade.position.set(Math.cos(angle) * r, Math.sin(angle) * r, -0.25);
    blade.rotation.z = angle;
    fan.add(blade);
  }
  root.add(fan);

  // Label on +Z face.
  const labelArea = node(NODES.labelArea, length / 2, height / 2, width);
  const labelWidth = 120;
  const labelHeight = 56;
  const texture = labelTexture([`${psu.watts} W`, `${psu.maker} ${psu.model}`], {
    width: 512,
    height: 240,
    background: "#14161b",
  });
  const labelMat = new MeshStandardMaterial({
    color: texture ? 0xffffff : 0x14161b,
    metalness: 0.1,
    roughness: 0.7,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  if (texture) labelMat.map = texture;
  const label = new Mesh(new PlaneGeometry(labelWidth, labelHeight), labelMat);
  label.name = "label";
  labelArea.add(label);
  root.add(labelArea);

  // Rear grille hint on -X: flush slots.
  for (let i = 0; i < 7; i++) {
    const slot = new Mesh(new PlaneGeometry(110, 4), detailMat);
    slot.name = `rear_grille_${i + 1}`;
    slot.rotation.y = -Math.PI / 2; // normal +Z -> -X
    slot.position.set(0, 14 + i * 9.5, width / 2);
    root.add(slot);
  }

  // Cables / sockets on +X, driven by modular.
  const socketMat = plasticMat;
  const cableMat = material(0x08090b, { metalness: 0.1, roughness: 0.9 });
  const rowY = height / 2;
  if (psu.modular === "full") {
    for (let i = 0; i < 7; i++) {
      root.add(socket(`socket_${i + 1}`, rowY, width / 2 + (i - 3) * 18, socketMat));
    }
  } else if (psu.modular === "none") {
    root.add(box("grommet", { x: length, y: 28, z: 45 }, { x: 2, y: 30, z: 60 }, socketMat));
    const spots = [
      [rowY + 7, 63],
      [rowY + 7, 87],
      [rowY - 7, 63],
      [rowY - 7, 87],
    ];
    spots.forEach(([y, z], i) => root.add(cable(`cable_${i + 1}`, y, z, cableMat)));
  } else {
    root.add(box("grommet", { x: length, y: 28, z: 15 }, { x: 2, y: 30, z: 40 }, socketMat));
    root.add(cable("cable_1", rowY + 7, 35, cableMat));
    root.add(cable("cable_2", rowY - 7, 35, cableMat));
    for (let i = 0; i < 3; i++) {
      root.add(socket(`socket_${i + 1}`, rowY, 80 + i * 22, socketMat));
    }
  }

  return root;
}
