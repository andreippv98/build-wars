import type { BuildSlot, ModelCategory } from "@/lib/schemas";

/**
 * The model file standard. Every model, a `.glb` file or a parametric one built in code, follows
 * it, so any model drops into the scene. The scene places parts ONLY by the named attachment
 * nodes below; it never knows a product's geometry.
 *
 * Units: millimetres (a 304 mm GPU is 304 units long).
 *
 * Axes (three.js, right-handed, Y up), described for a tower case seen from its open side:
 *   +X = toward the front of the case     +Y = up     +Z = out of the motherboard, toward the viewer
 *
 * Every model is authored in that same frame, in its mounted orientation, with its origin on the
 * node listed as `mount` (when `mount` is null the model's own origin is the mounting point):
 *
 *   case         interior of a mid-tower. Carries `mount_motherboard` and `mount_psu`.
 *   motherboard  origin = top rear corner of the board on its component-side surface. The board
 *                spans +X (width) and -Y (height); components rise toward +Z. Carries
 *                `socket_cpu`, `slot_ram_1..4`, `slot_pcie_1`.
 *   gpu          origin = `mount_pcie`: the rear end of the card's PCIe edge connector, on the
 *                motherboard surface. Length runs +X, slot thickness runs -Y (fans face down),
 *                the card stands out of the board toward +Z.
 *   ram          ONE stick. Origin = centre of its edge connector on the motherboard surface.
 *                The stick's long edge runs along Y, it stands toward +Z.
 *   cpu_cooler   CPU in its socket under a cooler. Origin = centre of the socket on the
 *                motherboard surface; everything rises toward +Z.
 *   psu          origin = rear bottom corner on the motherboard-tray side. Spans +X (length),
 *                +Y (height), +Z (width).
 *
 * Attachment nodes are empty nodes (no mesh). Their position AND rotation matter: a child is
 * placed so its mount node coincides with the parent's slot node.
 */

/** Node names. */
export const NODES = {
  mountMotherboard: "mount_motherboard",
  mountPsu: "mount_psu",
  socketCpu: "socket_cpu",
  slotPcie1: "slot_pcie_1",
  slotRam: (n: number) => `slot_ram_${n}`,
  mountPcie: "mount_pcie",
  /** Optional effect nodes. */
  fan: (n: number) => `fan_${n}`,
  labelArea: "label_area",
  rgbPrefix: "rgb_",
} as const;

export const MAX_RAM_SLOTS = 4;

/** The 3D model category of each build slot. */
export const SLOT_CATEGORY: Record<BuildSlot, ModelCategory> = {
  cpu: "cpu_cooler",
  gpu: "gpu",
  ram: "ram",
  motherboard: "motherboard",
  psu: "psu",
};

/**
 * Where each category attaches: the parent's category, the slot node on the parent, and the
 * mount node on the child (null = the child's origin). RAM is placed once per stick, on
 * `slot_ram_1..n`; `slot` here names the first.
 */
export const ATTACHMENT: Record<
  Exclude<ModelCategory, "case" | "fan">,
  { parent: "case" | "motherboard"; slot: string; mount: string | null }
> = {
  motherboard: { parent: "case", slot: NODES.mountMotherboard, mount: null },
  psu: { parent: "case", slot: NODES.mountPsu, mount: null },
  gpu: { parent: "motherboard", slot: NODES.slotPcie1, mount: NODES.mountPcie },
  ram: { parent: "motherboard", slot: NODES.slotRam(1), mount: null },
  cpu_cooler: { parent: "motherboard", slot: NODES.socketCpu, mount: null },
};

/** Attachment nodes a model of each category must carry. `models:import` checks these. */
export const REQUIRED_NODES: Record<ModelCategory, string[]> = {
  case: [NODES.mountMotherboard, NODES.mountPsu],
  motherboard: [NODES.socketCpu, NODES.slotPcie1, NODES.slotRam(1), NODES.slotRam(2)],
  gpu: [NODES.mountPcie],
  ram: [],
  cpu_cooler: [],
  psu: [],
  fan: [],
};

/** Physical reference dimensions (mm) shared by the parametric models. */
export const DIMENSIONS = {
  /** Motherboard outline per form factor: width along X, height along Y. */
  motherboard: {
    "E-ATX": { width: 330, height: 305 },
    ATX: { width: 244, height: 305 },
    mATX: { width: 244, height: 244 },
    ITX: { width: 170, height: 170 },
  },
  pcbThickness: 1.6,
  /**
   * Slot positions on a motherboard, from its origin (x, y). The same on every form factor so
   * they fit the smallest board; real board models may place their nodes anywhere.
   */
  boardLayout: {
    socketCpu: { x: 78, y: -72 },
    /** Centre of RAM slot 1; further slots step along +X. */
    ramSlot1: { x: 138, y: -80 },
    ramSlotPitch: 8,
    slotPcie1: { x: 12, y: -158 },
  },
  ramStick: { length: 133, thickness: 7, bareHeight: 31 },
  /** One expansion slot of thickness. */
  slotPitch: 20.32,
  /** Typical height of a GPU's PCB above the motherboard. */
  gpuHeight: 120,
  psu: { length: 160, height: 86, width: 150 },
} as const;

/** Limits a `.glb` file must respect (checked by `models:import`). */
export const MODEL_BUDGET = {
  maxTriangles: 50_000,
  maxBytes: 2 * 1024 * 1024,
  maxTextureSize: 2048,
  /** Longest side a model may have, as a sanity check that its units are millimetres. */
  plausibleSizeMm: { min: 5, max: 800 },
} as const;
