import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  PlaneGeometry,
} from "three";
import { RingGeometry } from "three";
import type { SlotPart } from "@/lib/build";
import { DIMENSIONS, NODES } from "@/lib/models/standard";
import { box, group, labelTexture, makerColor, material, node } from "./shared";

/** Layout constants of the parametric card (mm). */
const BACKPLATE = 2.5;
const SHROUD_RISE = 3; // the shroud's underside sits this far above the card's bottom face
const SHROUD_TOP = -5; // the shroud's top face; the gap up to the backplate shows the fins
const EDGE_TAB = { length: 89, drop: 8 };
const BRACKET = { plate: 2, ports: 10, bottom: -8, top: 90 };
const FAN_BLADES = 8;
const FAN_MARGIN = 8;
const MAX_FANS = 3;

const CONNECTORS = {
  conn_8pin: { name: "power_8pin", x: 22, y: 12, z: 10 },
  conn_6pin: { name: "power_6pin", x: 17, y: 12, z: 10 },
  conn_12v2x6: { name: "power_12v2x6", x: 12, y: 8, z: 8 },
} as const;

/** Dark, desaturated version of the maker's colour family. */
function shroudColor(maker: string): Color {
  return new Color(makerColor(maker)).lerp(new Color(0x15171a), 0.4);
}

function buildFan(index: number, radius: number, x: number, bottomY: number, z: number): Group {
  const fan = new Group();
  fan.name = NODES.fan(index);
  fan.position.set(x, bottomY + SHROUD_RISE / 2, z);
  // The scene spins fans around their local Z; point it along the card's -Y.
  fan.rotation.x = Math.PI / 2;

  const bladeMaterial = material(0x2b2f36, { metalness: 0.2, roughness: 0.5 });
  const hubRadius = radius * 0.22;
  const hub = new Mesh(new CylinderGeometry(hubRadius, hubRadius, 2.4, 24), bladeMaterial);
  hub.name = `${fan.name}_hub`;
  hub.rotation.x = Math.PI / 2; // cylinder axis Y -> fan-local Z
  fan.add(hub);

  const bladeLength = radius - hubRadius * 0.8;
  const bladeWidth = radius * 0.3;
  for (let b = 0; b < FAN_BLADES; b++) {
    const pivot = group(`${fan.name}_blade_${b + 1}`);
    pivot.rotation.z = (b / FAN_BLADES) * Math.PI * 2;
    const blade = new Mesh(new BoxGeometry(bladeLength, bladeWidth, 0.8), bladeMaterial);
    blade.name = `${fan.name}_blade_mesh_${b + 1}`;
    blade.position.x = hubRadius * 0.8 + bladeLength / 2;
    pivot.add(blade);
    fan.add(pivot);
  }
  return fan;
}

/** Parametric graphics card, shaped and labelled from the part's data. */
export function buildGpuModel(gpu: SlotPart["gpu"]): Group {
  const { board } = gpu;
  const length = board.length_mm;
  const height = DIMENSIONS.gpuHeight;
  const thickness = board.slots * DIMENSIONS.slotPitch;
  const bottom = -thickness;

  const root = group("gpu");
  root.add(node(NODES.mountPcie, 0, 0, 0));

  // Backplate / PCB slab along the top, plus the gold edge connector tab.
  const plateMaterial = material(0x1b1d21, { metalness: 0.6, roughness: 0.45 });
  root.add(
    box(
      "backplate",
      { x: 0, y: -BACKPLATE, z: 0 },
      { x: length, y: BACKPLATE, z: height },
      plateMaterial,
    ),
  );
  root.add(
    box(
      "pcie_edge",
      { x: 0, y: -BACKPLATE, z: -EDGE_TAB.drop },
      { x: EDGE_TAB.length, y: BACKPLATE, z: EDGE_TAB.drop },
      material(0xb08d3c, { metalness: 0.8, roughness: 0.35 }),
    ),
  );

  // Heatsink fin hint, inset and darker, visible in the gap under the backplate.
  root.add(
    box(
      "heatsink",
      { x: 8, y: SHROUD_TOP, z: 6 },
      { x: Math.max(length - 16, 1), y: -BACKPLATE - SHROUD_TOP, z: height - 12 },
      material(0x0c0d0f, { metalness: 0.7, roughness: 0.7 }),
    ),
  );

  // Shroud below the fin gap, in the maker's colour family.
  root.add(
    box(
      "shroud",
      { x: 2, y: bottom + SHROUD_RISE, z: 2 },
      { x: length - 2, y: SHROUD_TOP - (bottom + SHROUD_RISE), z: height - 2 },
      material(shroudColor(board.maker), { metalness: 0.35, roughness: 0.55 }),
    ),
  );

  // I/O bracket behind the connector: a plate plus a block hinting at the ports.
  const bracketMaterial = material(0x9aa0a8, { metalness: 0.85, roughness: 0.35 });
  root.add(
    box(
      "io_bracket",
      { x: -BRACKET.plate, y: bottom, z: BRACKET.bottom },
      { x: BRACKET.plate, y: thickness, z: BRACKET.top - BRACKET.bottom },
      bracketMaterial,
    ),
  );
  root.add(
    box(
      "io_ports",
      { x: -BRACKET.plate - BRACKET.ports, y: bottom + 6, z: 10 },
      { x: BRACKET.ports, y: Math.max(thickness - 16, 4), z: 50 },
      material(0x14161a, { metalness: 0.5, roughness: 0.6 }),
    ),
  );

  // Power connectors on the +Z edge, near the front end, packed from the front backwards.
  const connectorMaterial = material(0x101114, { metalness: 0.2, roughness: 0.7 });
  let cursor = length - 10;
  for (const key of ["conn_8pin", "conn_6pin", "conn_12v2x6"] as const) {
    const spec = CONNECTORS[key];
    const count = Math.max(0, Math.floor(board[key]));
    for (let i = 1; i <= count; i++) {
      cursor -= spec.x;
      root.add(
        box(
          `${spec.name}_${i}`,
          { x: cursor, y: bottom / 2 - spec.y / 2, z: height },
          { x: spec.x, y: spec.y, z: spec.z },
          connectorMaterial,
        ),
      );
      cursor -= 3;
    }
  }

  // Fans on the bottom face, evenly spaced; the recess rings do not spin.
  const fanCount = Math.min(MAX_FANS, Math.max(0, Math.floor(board.fan_count)));
  if (fanCount > 0) {
    const share = (length - 2 * FAN_MARGIN) / fanCount;
    const radius = Math.min(height - 12, share - 4) / 2;
    const recessMaterial = material(0x08090a, { roughness: 0.8 });
    recessMaterial.side = DoubleSide;
    for (let i = 1; i <= fanCount; i++) {
      const x = FAN_MARGIN + (i - 0.5) * share;
      const recess = new Mesh(new RingGeometry(radius * 0.1, radius + 2.5, 24), recessMaterial);
      recess.name = `fan_recess_${i}`;
      recess.rotation.x = Math.PI / 2; // ring normal +Z -> -Y
      recess.position.set(x, bottom + SHROUD_RISE - 0.1, height / 2);
      root.add(recess);
      root.add(buildFan(i, radius, x, bottom, height / 2));
    }
  }

  // Name label on the +Z face; reads left to right when viewed from +Z.
  const labelHeight = thickness * 0.4;
  const labelWidth = Math.min(labelHeight * 4, length * 0.5);
  const labelY = bottom / 2;
  root.add(node(NODES.labelArea, length / 2, labelY, height));
  const texture = labelTexture([board.maker, board.model], {
    width: 512,
    height: Math.round((512 * labelHeight) / labelWidth),
  });
  const labelMaterial = material(0xffffff, { metalness: 0, roughness: 0.8 });
  labelMaterial.transparent = true;
  labelMaterial.depthWrite = false;
  if (texture) {
    labelMaterial.map = texture;
  } else {
    labelMaterial.opacity = 0;
  }
  const label = new Mesh(new PlaneGeometry(labelWidth, labelHeight), labelMaterial);
  label.name = "label";
  label.position.set(length / 2, labelY, height + 0.2);
  root.add(label);

  // Faint accent strip along the +Z face edge.
  root.add(
    box(
      "rgb_strip",
      { x: length * 0.08, y: bottom + SHROUD_RISE + 1, z: height - 1 },
      { x: length * 0.84, y: 2, z: 1.6 },
      material(0x1a1a1a, { emissive: 0x082a3f, roughness: 0.5 }),
    ),
  );

  return root;
}
