import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  serial,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Cpu } from "@/lib/schemas";

// Catalog tables. Columns mirror the Zod schemas in `lib/schemas/parts.ts` one to one; the JSON
// files under `data/` are the source of truth and `pnpm data:import` upserts them here.
// Primary keys are the catalog's stable text ids.
//
// Added in M7: Auth.js tables (users incl. nullable `handle`, accounts, sessions) and builds.

const provenance = {
  sourceNotes: text("source_notes").notNull(),
  verified: boolean("verified").notNull().default(false),
};

export const cpus = pgTable("cpus", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  vendor: text("vendor").notNull(),
  name: text("name").notNull(),
  socket: text("socket").notNull(),
  generation: text("generation").notNull(),
  year: integer("year").notNull(),
  cores: integer("cores").notNull(),
  threads: integer("threads").notNull(),
  baseGhz: real("base_ghz").notNull(),
  boostGhz: real("boost_ghz").notNull(),
  cacheMb: real("cache_mb").notNull(),
  tdpW: integer("tdp_w").notNull(),
  pptW: integer("ppt_w").notNull(),
  igpu: boolean("igpu").notNull(),
  memTypes: text("mem_types").array().notNull(),
  maxMemSpeed: jsonb("max_mem_speed").$type<Cpu["max_mem_speed"]>().notNull(),
  pcieGen: integer("pcie_gen").notNull(),
  perfIndex: real("perf_index").notNull(),
  perfIndexVerified: boolean("perf_index_verified").notNull().default(false),
  ...provenance,
});

export const gpuChips = pgTable("gpu_chips", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  vendor: text("vendor").notNull(),
  name: text("name").notNull(),
  series: text("series").notNull(),
  year: integer("year").notNull(),
  vramGb: integer("vram_gb").notNull(),
  vramType: text("vram_type").notNull(),
  refBoostMhz: integer("ref_boost_mhz").notNull(),
  refPowerW: integer("ref_power_w").notNull(),
  pcieGen: integer("pcie_gen").notNull(),
  pcieLanes: integer("pcie_lanes").notNull(),
  highPowerSpikes: boolean("high_power_spikes").notNull(),
  perfIndex: real("perf_index").notNull(),
  perfIndexVerified: boolean("perf_index_verified").notNull().default(false),
  ...provenance,
});

export const gpuBoards = pgTable(
  "gpu_boards",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    chipId: text("chip_id")
      .notNull()
      .references(() => gpuChips.id),
    maker: text("maker").notNull(),
    series: text("series"),
    model: text("model").notNull(),
    boostMhz: integer("boost_mhz").notNull(),
    powerW: integer("power_w").notNull(),
    conn6pin: integer("conn_6pin").notNull().default(0),
    conn8pin: integer("conn_8pin").notNull(),
    conn12v2x6: integer("conn_12v2x6").notNull(),
    lengthMm: integer("length_mm").notNull(),
    slots: real("slots").notNull(),
    fanCount: integer("fan_count").notNull(),
    recPsuW: integer("rec_psu_w").notNull(),
    ...provenance,
  },
  (t) => [uniqueIndex("gpu_boards_chip_slug_uq").on(t.chipId, t.slug)],
);

export const chipsets = pgTable("chipsets", {
  id: text("id").primaryKey(),
  vendor: text("vendor").notNull(),
  name: text("name").notNull(),
  socket: text("socket").notNull(),
  ...provenance,
});

export const motherboards = pgTable("motherboards", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  maker: text("maker").notNull(),
  model: text("model").notNull(),
  chipsetId: text("chipset_id")
    .notNull()
    .references(() => chipsets.id),
  socket: text("socket").notNull(),
  formFactor: text("form_factor").notNull(),
  memType: text("mem_type").notNull(),
  ramSlots: integer("ram_slots").notNull(),
  maxMemGb: integer("max_mem_gb").notNull(),
  maxMemSpeed: integer("max_mem_speed").notNull(),
  pcieGen: integer("pcie_gen").notNull(),
  epsRequired: integer("eps_required").notNull(),
  ...provenance,
});

/**
 * CPU support lines. Each row belongs to exactly one chipset (the default for its boards) or one
 * motherboard (an override that replaces the chipset's list), and names exactly one CPU
 * generation or one CPU. The import replaces all rows of an owner in one transaction.
 */
export const boardCpuSupport = pgTable(
  "board_cpu_support",
  {
    id: serial("id").primaryKey(),
    motherboardId: text("motherboard_id").references(() => motherboards.id, {
      onDelete: "cascade",
    }),
    chipsetId: text("chipset_id").references(() => chipsets.id, { onDelete: "cascade" }),
    cpuId: text("cpu_id").references(() => cpus.id, { onDelete: "cascade" }),
    cpuGeneration: text("cpu_generation"),
    needsBiosUpdate: boolean("needs_bios_update").notNull(),
  },
  (t) => [
    check("board_cpu_support_one_owner", sql`num_nonnulls(${t.motherboardId}, ${t.chipsetId}) = 1`),
    check("board_cpu_support_one_target", sql`num_nonnulls(${t.cpuId}, ${t.cpuGeneration}) = 1`),
    index("board_cpu_support_motherboard_idx").on(t.motherboardId),
    index("board_cpu_support_chipset_idx").on(t.chipsetId),
  ],
);

export const ramKits = pgTable("ram_kits", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  capacityGb: integer("capacity_gb").notNull(),
  sticks: integer("sticks").notNull(),
  speedMts: integer("speed_mts").notNull(),
  cas: integer("cas").notNull(),
  voltage: real("voltage").notNull(),
  brand: text("brand"),
  model: text("model"),
  ...provenance,
});

export const psus = pgTable("psus", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  maker: text("maker").notNull(),
  model: text("model").notNull(),
  watts: integer("watts").notNull(),
  efficiency: text("efficiency").notNull(),
  atx3: boolean("atx3").notNull(),
  epsCount: integer("eps_count").notNull(),
  pcie6pinCount: integer("pcie_6pin_count").notNull().default(0),
  pcie8pinCount: integer("pcie_8pin_count").notNull(),
  conn12v2x6Count: integer("conn_12v2x6_count").notNull(),
  modular: text("modular").notNull(),
  ...provenance,
});
