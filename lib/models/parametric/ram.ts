import type { Group } from "three";
import type { SlotPart } from "@/lib/build";
import { DIMENSIONS, NODES } from "@/lib/models/standard";
import { box, group, makerColor, material, node } from "./shared";

/** Heatsink height by speed, per memory type (mm). The steps rise above `baseMts`. */
export const RAM_HEIGHT = {
  DDR4: { baseHeight: 34, baseMts: 3200, stepMts: 400, stepMm: 2 },
  DDR5: { baseHeight: 36, baseMts: 4800, stepMts: 800, stepMm: 2 },
  maxHeight: 44,
} as const;

/** From these speeds up a kit gets an RGB bar. */
export const RAM_RGB_MIN_MTS = { DDR4: 3600, DDR5: 6000 } as const;

const RAM_LOOK = {
  pcbThickness: 1.4,
  pcbColor: 0x0b1a12,
  connectorDepth: 3,
  spreaderStartZ: 6,
  /** Space left of the stick's full length at each end of the spreader. */
  spreaderInset: 2,
  /** How far the stepped top edge is cut back per tier, at each end. */
  tierInsets: [0, 10, 30],
  tierHeights: [6, 3],
  rgbBarHeight: 1.5,
  rgbBarWidth: 3,
  rgbBarLength: 70,
  rgbColor: 0xe5e7eb,
  rgbEmissive: 0x331a4d,
  neutralDdr4: 0x374151,
  neutralDdr5: 0x4b5563,
} as const;

/** Heatsink height in mm for a kit's type and speed. */
export function ramHeatsinkHeight(type: "DDR4" | "DDR5", speedMts: number): number {
  const row = RAM_HEIGHT[type];
  const steps = Math.max(0, Math.ceil((speedMts - row.baseMts) / row.stepMts));
  return Math.min(RAM_HEIGHT.maxHeight, row.baseHeight + steps * row.stepMm);
}

export function ramHasRgb(type: "DDR4" | "DDR5", speedMts: number): boolean {
  return speedMts >= RAM_RGB_MIN_MTS[type];
}

/** One parametric RAM stick: origin = centre of the edge connector on the board surface. */
export function buildRamStickModel(kit: SlotPart["ram"]): Group {
  const { length, thickness, bareHeight } = DIMENSIONS.ramStick;
  const height = ramHeatsinkHeight(kit.type, kit.speed_mts);
  const rgb = ramHasRgb(kit.type, kit.speed_mts);
  const L = RAM_LOOK;

  const pcb = box(
    "ram_pcb",
    { x: -L.pcbThickness / 2, y: -length / 2, z: -L.connectorDepth },
    { x: L.pcbThickness, y: length, z: bareHeight + L.connectorDepth },
    material(L.pcbColor, { metalness: 0.1, roughness: 0.7 }),
  );

  const color = kit.brand
    ? makerColor(kit.brand)
    : kit.type === "DDR5"
      ? L.neutralDdr5
      : L.neutralDdr4;
  const metal = material(color, { metalness: 0.6, roughness: 0.4 });

  // Heat spreader: a plate on each side of the PCB, in three stepped tiers.
  const plate = (thickness - L.pcbThickness) / 2;
  const topEnd = rgb ? height - L.rgbBarHeight : height;
  const t1 = height - L.tierHeights[0] - L.tierHeights[1] - (rgb ? L.rgbBarHeight : 0);
  const t2 = height - L.tierHeights[1] - (rgb ? L.rgbBarHeight : 0);
  const tiers = [
    { from: L.spreaderStartZ, to: t1, inset: L.tierInsets[0] },
    { from: t1, to: t2, inset: L.tierInsets[1] },
    { from: t2, to: topEnd, inset: L.tierInsets[2] },
  ];
  const spreader = group("ram_heatsink");
  for (const [i, tier] of tiers.entries()) {
    const y0 = -length / 2 + L.spreaderInset + tier.inset;
    const size = {
      x: plate,
      y: length - 2 * (L.spreaderInset + tier.inset),
      z: tier.to - tier.from,
    };
    spreader.add(
      box(`heatsink_${i}_pos`, { x: L.pcbThickness / 2, y: y0, z: tier.from }, size, metal),
      box(
        `heatsink_${i}_neg`,
        { x: -L.pcbThickness / 2 - plate, y: y0, z: tier.from },
        size,
        metal,
      ),
    );
  }

  const model = group("ram_stick", pcb, spreader);

  if (rgb) {
    const inset = (length - L.rgbBarLength) / 2;
    model.add(
      box(
        "rgb_bar",
        { x: -L.rgbBarWidth / 2, y: -length / 2 + inset, z: height - L.rgbBarHeight },
        { x: L.rgbBarWidth, y: L.rgbBarLength, z: L.rgbBarHeight },
        material(L.rgbColor, { emissive: L.rgbEmissive }),
      ),
    );
  }

  model.add(node(NODES.labelArea, thickness / 2, 0, (L.spreaderStartZ + height) / 2));
  return model;
}
