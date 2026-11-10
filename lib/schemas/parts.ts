import { z } from "zod";

/**
 * Zod schemas for every part type in the catalog. These are the single definition of a part:
 * catalog JSON, the database import and the engine all use the types inferred here.
 * Field names are snake_case and match the plan's tables and the JSON files under `data/`.
 */

// --- Shared vocabulary -------------------------------------------------------------------------

export const SOCKETS = ["LGA1151", "LGA1200", "LGA1700", "LGA1851", "AM4", "AM5"] as const;
export const SocketSchema = z.enum(SOCKETS);
export type Socket = z.infer<typeof SocketSchema>;

/**
 * CPU generation keys. Boards and chipsets list supported CPUs by these keys, so they are a closed
 * set: adding a generation is a schema change, which keeps typos out of the catalog.
 */
export const CPU_GENERATIONS = [
  "intel-9",
  "intel-10",
  "intel-11",
  "intel-12",
  "intel-13",
  "intel-14",
  "intel-core-ultra-200",
  "ryzen-2000",
  "ryzen-3000",
  "ryzen-4000",
  "ryzen-5000",
  "ryzen-7000",
  "ryzen-8000",
  "ryzen-9000",
] as const;
export const CpuGenerationSchema = z.enum(CPU_GENERATIONS);
export type CpuGeneration = z.infer<typeof CpuGenerationSchema>;

export const MEM_TYPES = ["DDR4", "DDR5"] as const;
export const MemTypeSchema = z.enum(MEM_TYPES);
export type MemType = z.infer<typeof MemTypeSchema>;

/** Stable lowercase id / URL segment, e.g. `ryzen-7-9800x3d`. Never renamed or reused. */
export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be lowercase letters, digits and single hyphens");

const posInt = z.number().int().positive();
const nonNegInt = z.number().int().nonnegative();
const pcieGen = z.number().int().min(1).max(7);
/** Catalog cutoff: parts released from 2018 onward. */
const year = z.number().int().min(2018).max(2100);

/** Relative performance index. Anchors: Ryzen 7 9800X3D = 100 (CPU), RTX 5090 = 100 (GPU chip). */
const perfIndex = z.number().positive().max(400);

/**
 * On CPUs and GPU chips: `perf_index` was entered from real review averages (sources in
 * `source_notes`). False = placeholder or estimate; the UI shows an "estimate" badge.
 */
const perfIndexVerified = z.boolean();

/** Fields every catalog record carries. */
const provenance = {
  /** Where the specs (and index, if any) came from. */
  source_notes: z.string().min(1),
  /** Specs checked against the manufacturer's page. Says nothing about `perf_index`. */
  verified: z.boolean(),
};

// --- CPU ---------------------------------------------------------------------------------------

export const CpuSchema = z.strictObject({
  id: SlugSchema,
  /** URL segment for `/cpu/<slug>`. */
  slug: SlugSchema,
  vendor: z.enum(["intel", "amd"]),
  name: z.string().min(1),
  socket: SocketSchema,
  generation: CpuGenerationSchema,
  year,
  cores: posInt,
  threads: posInt,
  base_ghz: z.number().positive(),
  boost_ghz: z.number().positive(),
  /** L3 cache in MB. */
  cache_mb: z.number().positive(),
  tdp_w: posInt,
  /** Package power limit: PPT for AMD, PL2 for Intel. */
  ppt_w: posInt,
  /** Has integrated graphics. */
  igpu: z.boolean(),
  mem_types: z.array(MemTypeSchema).min(1),
  /** Max official memory speed (MT/s) per supported memory type. Keys must equal `mem_types`. */
  max_mem_speed: z.partialRecord(MemTypeSchema, posInt),
  pcie_gen: pcieGen,
  perf_index: perfIndex,
  perf_index_verified: perfIndexVerified,
  ...provenance,
});
export type Cpu = z.infer<typeof CpuSchema>;

// --- GPU: chip and board model -----------------------------------------------------------------

export const GpuChipSchema = z.strictObject({
  id: SlugSchema,
  /** URL segment for `/gpu/<chip-slug>`. */
  slug: SlugSchema,
  vendor: z.enum(["nvidia", "amd"]),
  name: z.string().min(1),
  /** Chip series, e.g. "RTX 40", "RX 7000". */
  series: z.string().min(1),
  year,
  vram_gb: posInt,
  /** e.g. "GDDR6", "GDDR6X", "GDDR7". */
  vram_type: z.string().min(1),
  ref_boost_mhz: posInt,
  ref_power_w: posInt,
  pcie_gen: pcieGen,
  pcie_lanes: z.union([z.literal(4), z.literal(8), z.literal(16)]),
  /** Known for big transient power spikes (e.g. RTX 3080/3090): raises the PSU multiplier. */
  high_power_spikes: z.boolean(),
  perf_index: perfIndex,
  perf_index_verified: perfIndexVerified,
  ...provenance,
});
export type GpuChip = z.infer<typeof GpuChipSchema>;

export const GpuBoardSchema = z.strictObject({
  /** Globally unique, e.g. `asus-tuf-gaming-rtx-3080-oc`. */
  id: SlugSchema,
  /** URL segment for `/gpu/<chip-slug>/<slug>`; unique within its chip. */
  slug: SlugSchema,
  chip_id: SlugSchema,
  maker: z.string().min(1),
  /** Partner product line, e.g. "TUF Gaming", "Founders Edition". Used by 3D model family rules. */
  series: z.string().min(1).optional(),
  /** Full model name without the maker, e.g. "TUF Gaming RTX 3080 OC". */
  model: z.string().min(1),
  boost_mhz: posInt,
  /** Board power / power limit in watts (this board, not the reference). */
  power_w: posInt,
  /** PCIe 6-pin power connectors on the card. */
  conn_6pin: nonNegInt,
  /** PCIe 8-pin power connectors on the card. */
  conn_8pin: nonNegInt,
  /** 12VHPWR or 12V-2x6 connectors. */
  conn_12v2x6: nonNegInt,
  length_mm: posInt,
  /** Slot width, e.g. 2, 2.5, 3.5. */
  slots: z.number().min(1).max(5).multipleOf(0.5),
  fan_count: z.number().int().min(0).max(4),
  rec_psu_w: posInt,
  ...provenance,
});
export type GpuBoard = z.infer<typeof GpuBoardSchema>;

/** One file under `data/gpus/` holds the chips of a series and their board models. */
export const GpuFileSchema = z.strictObject({
  chips: z.array(GpuChipSchema),
  boards: z.array(GpuBoardSchema),
});
export type GpuFile = z.infer<typeof GpuFileSchema>;

// --- Chipset and motherboard -------------------------------------------------------------------

/**
 * One line of a CPU support list. Exactly one of `cpu_generation` / `cpu_id` is set.
 * A `cpu_id` entry takes precedence over a generation entry for that CPU.
 * A CPU matched by no entry is unsupported.
 */
export const CpuSupportSchema = z
  .strictObject({
    cpu_generation: CpuGenerationSchema.optional(),
    cpu_id: SlugSchema.optional(),
    /** True: works only after a BIOS update. False: works out of the box. */
    needs_bios_update: z.boolean(),
  })
  .refine((s) => (s.cpu_generation === undefined) !== (s.cpu_id === undefined), {
    message: "set exactly one of cpu_generation or cpu_id",
  });
export type CpuSupport = z.infer<typeof CpuSupportSchema>;

export const ChipsetSchema = z.strictObject({
  id: SlugSchema,
  vendor: z.enum(["intel", "amd"]),
  name: z.string().min(1),
  socket: SocketSchema,
  /** Default CPU support for every board on this chipset; a board may override it. */
  cpu_support: z.array(CpuSupportSchema).min(1),
  ...provenance,
});
export type Chipset = z.infer<typeof ChipsetSchema>;

export const FORM_FACTORS = ["E-ATX", "ATX", "mATX", "ITX"] as const;

export const MotherboardSchema = z.strictObject({
  id: SlugSchema,
  /** URL segment for `/motherboard/<slug>`. */
  slug: SlugSchema,
  maker: z.string().min(1),
  model: z.string().min(1),
  chipset_id: SlugSchema,
  /** Must equal the chipset's socket (checked by `data:validate`). */
  socket: SocketSchema,
  form_factor: z.enum(FORM_FACTORS),
  mem_type: MemTypeSchema,
  ram_slots: posInt,
  max_mem_gb: posInt,
  /** Max supported RAM speed in MT/s. */
  max_mem_speed: posInt,
  /** PCIe generation of the main (GPU) slot. */
  pcie_gen: pcieGen,
  /** Number of 8-pin EPS CPU power connectors the board has (1 = 4+4, 2 = 8+8). */
  eps_required: z.number().int().min(1).max(2),
  /** If present, replaces the chipset's `cpu_support` for this board. */
  cpu_support: z.array(CpuSupportSchema).min(1).optional(),
  ...provenance,
});
export type Motherboard = z.infer<typeof MotherboardSchema>;

/** A motherboard with its effective CPU support list filled in (own list, else the chipset's). */
export type ResolvedMotherboard = Omit<Motherboard, "cpu_support"> & { cpu_support: CpuSupport[] };

// --- RAM ---------------------------------------------------------------------------------------

export const RamKitSchema = z.strictObject({
  /** e.g. `ddr5-32gb-2x16-6000-cl30`, with a brand suffix for named kits. */
  id: SlugSchema,
  type: MemTypeSchema,
  /** Total capacity of the kit in GB. */
  capacity_gb: posInt,
  sticks: posInt,
  speed_mts: posInt,
  cas: posInt,
  voltage: z.number().positive(),
  brand: z.string().min(1).optional(),
  model: z.string().min(1).optional(),
  ...provenance,
});
export type RamKit = z.infer<typeof RamKitSchema>;

// --- PSU ---------------------------------------------------------------------------------------

export const PSU_EFFICIENCY = [
  "white",
  "bronze",
  "silver",
  "gold",
  "platinum",
  "titanium",
] as const;

export const PsuSchema = z.strictObject({
  id: SlugSchema,
  /** URL segment for `/psu/<slug>`. */
  slug: SlugSchema,
  maker: z.string().min(1),
  model: z.string().min(1),
  watts: posInt,
  /** 80 Plus tier. */
  efficiency: z.enum(PSU_EFFICIENCY),
  /** ATX 3.x compliant. */
  atx3: z.boolean(),
  /** 8-pin EPS CPU power connectors. */
  eps_count: nonNegInt,
  /** 6-pin-only PCIe plugs. */
  pcie_6pin_count: nonNegInt,
  /** 8-pin (6+2) PCIe plugs; each can also feed a 6-pin socket. */
  pcie_8pin_count: nonNegInt,
  /** Native 12VHPWR / 12V-2x6 connectors. */
  conn_12v2x6_count: nonNegInt,
  modular: z.enum(["full", "semi", "none"]),
  ...provenance,
});
export type Psu = z.infer<typeof PsuSchema>;

// --- Part type registry ------------------------------------------------------------------------

/** The five slots of a v1 build. */
export const BUILD_SLOTS = ["cpu", "gpu", "ram", "motherboard", "psu"] as const;
export type BuildSlot = (typeof BUILD_SLOTS)[number];
