import type {
  boardCpuSupport,
  chipsets,
  cpus,
  gpuBoards,
  gpuChips,
  motherboards,
  psus,
  ramKits,
} from "@/db/schema";
import type {
  Catalog,
  Chipset,
  Cpu,
  CpuSupport,
  GpuBoard,
  GpuChip,
  Motherboard,
  Psu,
  RamKit,
} from "@/lib/schemas";

/** Pure mappers from catalog records (snake_case) to Drizzle insert rows (camelCase). */

export function cpuRow(cpu: Cpu): typeof cpus.$inferInsert {
  return {
    id: cpu.id,
    slug: cpu.slug,
    vendor: cpu.vendor,
    name: cpu.name,
    socket: cpu.socket,
    generation: cpu.generation,
    year: cpu.year,
    cores: cpu.cores,
    threads: cpu.threads,
    baseGhz: cpu.base_ghz,
    boostGhz: cpu.boost_ghz,
    cacheMb: cpu.cache_mb,
    tdpW: cpu.tdp_w,
    pptW: cpu.ppt_w,
    igpu: cpu.igpu,
    memTypes: cpu.mem_types,
    maxMemSpeed: cpu.max_mem_speed,
    pcieGen: cpu.pcie_gen,
    perfIndex: cpu.perf_index,
    perfIndexVerified: cpu.perf_index_verified,
    sourceNotes: cpu.source_notes,
    verified: cpu.verified,
  };
}

export function gpuChipRow(chip: GpuChip): typeof gpuChips.$inferInsert {
  return {
    id: chip.id,
    slug: chip.slug,
    vendor: chip.vendor,
    name: chip.name,
    series: chip.series,
    year: chip.year,
    vramGb: chip.vram_gb,
    vramType: chip.vram_type,
    refBoostMhz: chip.ref_boost_mhz,
    refPowerW: chip.ref_power_w,
    pcieGen: chip.pcie_gen,
    pcieLanes: chip.pcie_lanes,
    highPowerSpikes: chip.high_power_spikes,
    perfIndex: chip.perf_index,
    perfIndexVerified: chip.perf_index_verified,
    sourceNotes: chip.source_notes,
    verified: chip.verified,
  };
}

export function gpuBoardRow(board: GpuBoard): typeof gpuBoards.$inferInsert {
  return {
    id: board.id,
    slug: board.slug,
    chipId: board.chip_id,
    maker: board.maker,
    // Explicit null (not undefined) so an upsert clears a series that was removed from the JSON.
    series: board.series ?? null,
    model: board.model,
    boostMhz: board.boost_mhz,
    powerW: board.power_w,
    conn6pin: board.conn_6pin,
    conn8pin: board.conn_8pin,
    conn12v2x6: board.conn_12v2x6,
    lengthMm: board.length_mm,
    slots: board.slots,
    fanCount: board.fan_count,
    recPsuW: board.rec_psu_w,
    sourceNotes: board.source_notes,
    verified: board.verified,
  };
}

export function chipsetRow(chipset: Chipset): typeof chipsets.$inferInsert {
  return {
    id: chipset.id,
    vendor: chipset.vendor,
    name: chipset.name,
    socket: chipset.socket,
    sourceNotes: chipset.source_notes,
    verified: chipset.verified,
  };
}

export function motherboardRow(board: Motherboard): typeof motherboards.$inferInsert {
  return {
    id: board.id,
    slug: board.slug,
    maker: board.maker,
    model: board.model,
    chipsetId: board.chipset_id,
    socket: board.socket,
    formFactor: board.form_factor,
    memType: board.mem_type,
    ramSlots: board.ram_slots,
    maxMemGb: board.max_mem_gb,
    maxMemSpeed: board.max_mem_speed,
    pcieGen: board.pcie_gen,
    epsRequired: board.eps_required,
    sourceNotes: board.source_notes,
    verified: board.verified,
  };
}

export function ramKitRow(kit: RamKit): typeof ramKits.$inferInsert {
  return {
    id: kit.id,
    type: kit.type,
    capacityGb: kit.capacity_gb,
    sticks: kit.sticks,
    speedMts: kit.speed_mts,
    cas: kit.cas,
    voltage: kit.voltage,
    brand: kit.brand ?? null,
    model: kit.model ?? null,
    sourceNotes: kit.source_notes,
    verified: kit.verified,
  };
}

export function psuRow(psu: Psu): typeof psus.$inferInsert {
  return {
    id: psu.id,
    slug: psu.slug,
    maker: psu.maker,
    model: psu.model,
    watts: psu.watts,
    efficiency: psu.efficiency,
    atx3: psu.atx3,
    epsCount: psu.eps_count,
    pcie6pinCount: psu.pcie_6pin_count,
    pcie8pinCount: psu.pcie_8pin_count,
    conn12v2x6Count: psu.conn_12v2x6_count,
    modular: psu.modular,
    sourceNotes: psu.source_notes,
    verified: psu.verified,
  };
}

function supportRow(
  owner: { chipsetId: string } | { motherboardId: string },
  entry: CpuSupport,
): typeof boardCpuSupport.$inferInsert {
  return {
    ...("chipsetId" in owner
      ? { chipsetId: owner.chipsetId, motherboardId: null }
      : { motherboardId: owner.motherboardId, chipsetId: null }),
    cpuId: entry.cpu_id ?? null,
    cpuGeneration: entry.cpu_generation ?? null,
    needsBiosUpdate: entry.needs_bios_update,
  };
}

/**
 * `board_cpu_support` rows: one per chipset `cpu_support` entry (chipsetId set) and one per
 * motherboard override entry (motherboardId set). Boards without an override get no rows.
 */
export function cpuSupportRows(catalog: Catalog): (typeof boardCpuSupport.$inferInsert)[] {
  return [
    ...catalog.chipsets.flatMap((c) =>
      c.cpu_support.map((entry) => supportRow({ chipsetId: c.id }, entry)),
    ),
    ...catalog.motherboards.flatMap((m) =>
      (m.cpu_support ?? []).map((entry) => supportRow({ motherboardId: m.id }, entry)),
    ),
  ];
}
