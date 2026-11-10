import {
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from "three";
import { NODES } from "@/lib/models/standard";
import { box, group, material, node } from "./shared";

/**
 * The neutral showcase case: a mid-tower with a dark interior and an open +Z side (a thin frame
 * and an almost invisible glass pane). Frame: origin = rear bottom corner of the interior on the
 * tray side; the interior spans x [0, 440], y [0, 470], z [0, 215] and every panel lies outside it.
 * The motherboard and PSU volumes are kept free of geometry (see case.test.ts).
 */

const INTERIOR = { x: 440, y: 470, z: 215 } as const;
const T = 2; // panel thickness
const SHROUD_TOP = 100;
const STANDOFF_HEIGHT = 10; // tray to z = 12 - 1.6 (PCB back) minus a 0.4 mm gap, so no overlap
const MOTHERBOARD_NODE = { x: 18, y: 455, z: 12 } as const;

/** Standoff positions relative to the board origin (x right, y down), inside the ATX area. */
const STANDOFFS: [number, number][] = [
  [10, -12],
  [10, -168],
  [10, -290],
  [130, -12],
  [130, -168],
  [130, -290],
  [230, -12],
  [230, -168],
  [230, -290],
];

export function buildCaseModel(): Group {
  const root = group("case");
  const panelMat = material(0x16181d, { metalness: 0.2, roughness: 0.9 });
  const trayMat = material(0x1b1e24, { metalness: 0.2, roughness: 0.9 });
  const insetMat = material(0x0b0c0f, { metalness: 0.1, roughness: 1 });
  const frameMat = material(0x22252c, { metalness: 0.4, roughness: 0.6 });
  const outerX = INTERIOR.x + 2 * T;
  const outerY = INTERIOR.y + 2 * T;

  // Panels, all outside the interior.
  root.add(
    box("tray", { x: -T, y: -T, z: -T }, { x: outerX, y: outerY, z: T }, trayMat),
    box("bottom", { x: -T, y: -T, z: -T }, { x: outerX, y: T, z: INTERIOR.z + T }, panelMat),
    box("top", { x: -T, y: INTERIOR.y, z: -T }, { x: outerX, y: T, z: INTERIOR.z + T }, panelMat),
    box("rear_panel", { x: -T, y: 0, z: 0 }, { x: T, y: INTERIOR.y, z: INTERIOR.z }, panelMat),
    box(
      "front_panel",
      { x: INTERIOR.x, y: 0, z: 0 },
      { x: T, y: INTERIOR.y, z: INTERIOR.z },
      panelMat,
    ),
  );

  // Open +Z side: a thin frame and a nearly invisible pane.
  const frameZ = INTERIOR.z;
  const bar = 8;
  const frameDepth = 3;
  root.add(
    box(
      "frame_bottom",
      { x: -T, y: -T, z: frameZ },
      { x: outerX, y: bar, z: frameDepth },
      frameMat,
    ),
    box(
      "frame_top",
      { x: -T, y: INTERIOR.y + T - bar, z: frameZ },
      { x: outerX, y: bar, z: frameDepth },
      frameMat,
    ),
    box("frame_rear", { x: -T, y: -T, z: frameZ }, { x: bar, y: outerY, z: frameDepth }, frameMat),
    box(
      "frame_front",
      { x: INTERIOR.x + T - bar, y: -T, z: frameZ },
      { x: bar, y: outerY, z: frameDepth },
      frameMat,
    ),
  );
  const glassMat = new MeshStandardMaterial({
    color: 0xbfd6e6,
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.06,
    depthWrite: false,
    side: DoubleSide,
  });
  const glass = new Mesh(new PlaneGeometry(INTERIOR.x, INTERIOR.y), glassMat);
  glass.name = "glass";
  glass.position.set(INTERIOR.x / 2, INTERIOR.y / 2, frameZ + frameDepth / 2);
  root.add(glass);

  // PSU shroud: solid top plate, a lip along its open edge, open +Z side otherwise.
  root.add(
    box(
      "shroud_top",
      { x: 0, y: SHROUD_TOP - T, z: 0 },
      { x: INTERIOR.x, y: T, z: INTERIOR.z },
      panelMat,
    ),
    box(
      "shroud_lip",
      { x: 0, y: SHROUD_TOP - 6, z: INTERIOR.z - T },
      { x: INTERIOR.x, y: 6, z: T },
      frameMat,
    ),
  );

  // Feet.
  const footMat = material(0x0a0a0c, { metalness: 0.1, roughness: 0.9 });
  for (const [i, [x, z]] of (
    [
      [30, 30],
      [INTERIOR.x - 30, 30],
      [30, INTERIOR.z - 30],
      [INTERIOR.x - 30, INTERIOR.z - 30],
    ] as const
  ).entries()) {
    const foot = new Mesh(new CylinderGeometry(10, 12, 10, 16), footMat);
    foot.name = `foot_${i + 1}`;
    foot.position.set(x, -T - 5, z);
    root.add(foot);
  }

  // Rear panel details, on its outer face (x < -T): I/O cut-out hint and 7 expansion slot covers.
  root.add(box("io_hint", { x: -T - 0.4, y: 410, z: 12 }, { x: 0.4, y: 45, z: 150 }, insetMat));
  for (let i = 0; i < 7; i++) {
    root.add(
      box(
        `slot_cover_${i + 1}`,
        { x: -T - 0.6, y: 293 - i * 20.32 - 17, z: 20 },
        { x: 0.6, y: 17, z: 110 },
        insetMat,
      ),
    );
  }

  // Front panel mesh hint, on its outer face.
  root.add(
    box("front_mesh", { x: INTERIOR.x + T, y: 110, z: 30 }, { x: 0.6, y: 350, z: 155 }, insetMat),
  );

  // Cable grommet hints on the tray, right of the board area (x > 348).
  const grommetMat = material(0x0a0a0c, { metalness: 0, roughness: 1 });
  root.add(
    box("grommet_1", { x: 375, y: 300, z: 0 }, { x: 40, y: 12, z: 1 }, grommetMat),
    box("grommet_2", { x: 375, y: 190, z: 0 }, { x: 40, y: 12, z: 1 }, grommetMat),
  );

  // Standoffs between the tray and the board's back.
  const standoffMat = material(0xb08d57, { metalness: 0.8, roughness: 0.4 });
  STANDOFFS.forEach(([dx, dy], i) => {
    const standoff = new Mesh(new CylinderGeometry(3.5, 3.5, STANDOFF_HEIGHT, 12), standoffMat);
    standoff.name = `standoff_${i + 1}`;
    standoff.rotation.x = Math.PI / 2; // axis Y -> Z
    standoff.position.set(MOTHERBOARD_NODE.x + dx, MOTHERBOARD_NODE.y + dy, STANDOFF_HEIGHT / 2);
    root.add(standoff);
  });

  root.add(
    node(NODES.mountMotherboard, MOTHERBOARD_NODE.x, MOTHERBOARD_NODE.y, MOTHERBOARD_NODE.z),
    node(NODES.mountPsu, 4, 4, 32),
  );
  return root;
}
