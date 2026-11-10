import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from "three";
import type { SlotPart } from "@/lib/build";
import { DIMENSIONS, MAX_RAM_SLOTS, NODES } from "@/lib/models/standard";
import { box, group, labelTexture, makerColor, material, node } from "./shared";

/** Sizes of the decorative features, in mm. They are all low so parts on the nodes never collide. */
const FEATURE = {
  socketFrame: { size: 54, height: 4 },
  ramSlot: { width: 6, height: 5 },
  pcieSlot: { length: 89, width: 7, height: 8 },
  expansionSlot: { length: 50 },
  vrmLeft: { width: 11, height: 9, gapFromSocket: 2 },
  vrmTop: { width: 60, depth: 20, height: 9, gapFromSocket: 4 },
  rearIo: { width: 25, top: -8, bottom: -150, height: 35 },
  chipset: { x: 108, width: 40, depth: 18, height: 8, bottom: 2 },
  powerHeader: { length: 52, maxWidth: 12, height: 9, edgeGap: 1, ramGap: 2, centreY: -74 },
  label: { x: 36, width: 90, height: 30, centreY: -128 },
  placeholder: { opacity: 0.3 },
  pcbTint: 0.15,
} as const;

const PCB_BASE = 0x0a0a0c;
const PLACEHOLDER_GREY = 0x8a8f98;

/** Parametric motherboard; null gives the neutral placeholder board shown before one is chosen. */
export function buildMotherboardModel(board: SlotPart["motherboard"] | null): Group {
  const placeholder = board === null;
  const formFactor = board?.form_factor ?? "ATX";
  const { width, height } = DIMENSIONS.motherboard[formFactor];
  const ramCount = Math.min(board?.ram_slots ?? MAX_RAM_SLOTS, MAX_RAM_SLOTS);
  const layout = DIMENSIONS.boardLayout;
  const thickness = DIMENSIONS.pcbThickness;

  const mat = (
    color: number,
    options: { metalness?: number; roughness?: number } = {},
  ): MeshStandardMaterial => {
    if (!placeholder) return material(color, options);
    const grey = new Color(color).getHSL({ h: 0, s: 0, l: 0 }).l;
    const m = material(new Color().setHSL(0, 0, 0.35 + grey * 0.4), options);
    m.transparent = true;
    m.opacity = FEATURE.placeholder.opacity;
    return m;
  };

  const model = group("motherboard");

  // PCB: very dark with a slight tint from the maker colour.
  const pcbColor = placeholder
    ? PLACEHOLDER_GREY
    : new Color(PCB_BASE).lerp(new Color(makerColor(board.maker)), FEATURE.pcbTint).getHex();
  const pcbMaterial = placeholder
    ? mat(PLACEHOLDER_GREY, { metalness: 0.1, roughness: 0.8 })
    : material(pcbColor, { metalness: 0.1, roughness: 0.8 });
  model.add(
    box(
      "pcb",
      { x: 0, y: -height, z: -thickness },
      { x: width, y: height, z: thickness },
      pcbMaterial,
    ),
  );

  // Attachment nodes.
  const socket = layout.socketCpu;
  model.add(node(NODES.socketCpu, socket.x, socket.y, 0));
  for (let i = 1; i <= ramCount; i++) {
    model.add(
      node(
        NODES.slotRam(i),
        layout.ramSlot1.x + (i - 1) * layout.ramSlotPitch,
        layout.ramSlot1.y,
        0,
      ),
    );
  }
  model.add(node(NODES.slotPcie1, layout.slotPcie1.x, layout.slotPcie1.y, 0));

  const metal = mat(0x9ca3af, { metalness: 0.8, roughness: 0.35 });
  const plastic = mat(0x1f2937, { metalness: 0.1, roughness: 0.7 });
  const sink = mat(0x374151, { metalness: 0.6, roughness: 0.45 });

  // CPU socket frame.
  const half = FEATURE.socketFrame.size / 2;
  model.add(
    box(
      "socket_frame",
      { x: socket.x - half, y: socket.y - half, z: 0 },
      { x: FEATURE.socketFrame.size, y: FEATURE.socketFrame.size, z: FEATURE.socketFrame.height },
      metal,
    ),
  );

  // RAM slot strips.
  const stickLength = DIMENSIONS.ramStick.length;
  for (let i = 1; i <= ramCount; i++) {
    const x = layout.ramSlot1.x + (i - 1) * layout.ramSlotPitch;
    model.add(
      box(
        `ram_strip_${i}`,
        { x: x - FEATURE.ramSlot.width / 2, y: layout.ramSlot1.y - stickLength / 2, z: 0 },
        { x: FEATURE.ramSlot.width, y: stickLength, z: FEATURE.ramSlot.height },
        plastic,
      ),
    );
  }

  // PCIe x16 slot, then shorter expansion slots below it while they fit on the board.
  const pcie = layout.slotPcie1;
  model.add(
    box(
      "pcie_strip_1",
      { x: pcie.x, y: pcie.y - FEATURE.pcieSlot.width / 2, z: 0 },
      { x: FEATURE.pcieSlot.length, y: FEATURE.pcieSlot.width, z: FEATURE.pcieSlot.height },
      plastic,
    ),
  );
  for (let k = 1; ; k++) {
    const y = pcie.y - 2 * DIMENSIONS.slotPitch * k;
    if (y - FEATURE.pcieSlot.width / 2 < -height) break;
    model.add(
      box(
        `pcie_strip_${k + 1}`,
        { x: pcie.x, y: y - FEATURE.pcieSlot.width / 2, z: 0 },
        { x: FEATURE.expansionSlot.length, y: FEATURE.pcieSlot.width, z: FEATURE.pcieSlot.height },
        plastic,
      ),
    );
  }

  // VRM heatsinks: left of and above the socket frame.
  const vrmL = FEATURE.vrmLeft;
  model.add(
    box(
      "vrm_left",
      { x: socket.x - half - vrmL.gapFromSocket - vrmL.width, y: socket.y - half, z: 0 },
      { x: vrmL.width, y: FEATURE.socketFrame.size, z: vrmL.height },
      sink,
    ),
  );
  const vrmT = FEATURE.vrmTop;
  model.add(
    box(
      "vrm_top",
      { x: socket.x - vrmT.width / 2, y: socket.y + half + vrmT.gapFromSocket, z: 0 },
      { x: vrmT.width, y: vrmT.depth, z: vrmT.height },
      sink,
    ),
  );

  // Rear I/O block, above the PCIe slot row.
  const io = FEATURE.rearIo;
  model.add(
    box(
      "rear_io",
      { x: 0, y: io.bottom, z: 0 },
      { x: io.width, y: io.top - io.bottom, z: io.height },
      mat(0x6b7280, { metalness: 0.7, roughness: 0.4 }),
    ),
  );

  // Chipset heatsink in the lower front area, right of the PCIe strip.
  const cs = FEATURE.chipset;
  model.add(
    box(
      "chipset",
      { x: cs.x, y: -height + cs.bottom, z: 0 },
      { x: cs.width, y: cs.depth, z: cs.height },
      sink,
    ),
  );

  // 24-pin power header, near the front edge beside the last RAM slot.
  const ph = FEATURE.powerHeader;
  const ramRight =
    layout.ramSlot1.x + (ramCount - 1) * layout.ramSlotPitch + FEATURE.ramSlot.width / 2;
  const headerRight = width - ph.edgeGap;
  const headerLeft = Math.max(ramRight + ph.ramGap, headerRight - ph.maxWidth);
  model.add(
    box(
      "power_header",
      { x: headerLeft, y: ph.centreY - ph.length / 2, z: 0 },
      { x: headerRight - headerLeft, y: ph.length, z: ph.height },
      plastic,
    ),
  );

  // Label.
  const lb = FEATURE.label;
  const labelX = lb.x + lb.width / 2;
  model.add(node(NODES.labelArea, labelX, lb.centreY, 0));
  if (!placeholder) {
    const texture = labelTexture([board.maker, board.model], {
      width: 512,
      height: Math.round((512 * lb.height) / lb.width),
    });
    const labelMaterial = mat(0x111114, { metalness: 0, roughness: 0.9 });
    if (texture) {
      labelMaterial.map = texture;
      labelMaterial.transparent = true;
    }
    const label = new Mesh(new PlaneGeometry(lb.width, lb.height), labelMaterial);
    label.name = "label";
    label.position.set(labelX, lb.centreY, 0.05);
    model.add(label);
  }

  return model;
}
