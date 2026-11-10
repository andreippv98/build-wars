import type { Cpu, GpuBoard, GpuChip, Psu, RamKit, ResolvedMotherboard } from "@/lib/schemas";
import type { Build, PowerEstimate } from "./types";

/**
 * Obviously fake parts for engine tests. Together they form a compatible AM5 build whose CPU and
 * GPU chip both have index 100 with 32 GB DDR5-6000, i.e. the shape of the reference build.
 * Override only the fields a test is about: `makeCpu({ socket: "AM4" })`.
 * The numbers are test values, not real specs or benchmarks.
 */

const provenance = { source_notes: "test fixture", verified: false };

export function makeCpu(overrides: Partial<Cpu> = {}): Cpu {
  return {
    id: "test-cpu",
    slug: "test-cpu",
    vendor: "amd",
    name: "Test CPU",
    socket: "AM5",
    generation: "ryzen-9000",
    year: 2024,
    cores: 8,
    threads: 16,
    base_ghz: 4,
    boost_ghz: 5,
    cache_mb: 96,
    tdp_w: 120,
    ppt_w: 160,
    igpu: true,
    mem_types: ["DDR5"],
    max_mem_speed: { DDR5: 6000 },
    pcie_gen: 5,
    perf_index: 100,
    perf_index_verified: false,
    ...provenance,
    ...overrides,
  };
}

export function makeGpuChip(overrides: Partial<GpuChip> = {}): GpuChip {
  return {
    id: "test-chip",
    slug: "test-chip",
    vendor: "nvidia",
    name: "Test Chip",
    series: "Test 10",
    year: 2025,
    vram_gb: 16,
    vram_type: "GDDR7",
    ref_boost_mhz: 2000,
    ref_power_w: 300,
    pcie_gen: 5,
    pcie_lanes: 16,
    high_power_spikes: false,
    perf_index: 100,
    perf_index_verified: false,
    ...provenance,
    ...overrides,
  };
}

export function makeGpuBoard(overrides: Partial<GpuBoard> = {}): GpuBoard {
  return {
    id: "test-board",
    slug: "test-board",
    chip_id: "test-chip",
    maker: "Testmaker",
    series: "Reference",
    model: "Test Chip Reference",
    boost_mhz: 2000,
    power_w: 300,
    conn_6pin: 0,
    conn_8pin: 0,
    conn_12v2x6: 1,
    length_mm: 300,
    slots: 2,
    fan_count: 2,
    rec_psu_w: 750,
    ...provenance,
    ...overrides,
  };
}

export function makeGpu(
  board: Partial<GpuBoard> = {},
  chip: Partial<GpuChip> = {},
): NonNullable<Build["gpu"]> {
  return { chip: makeGpuChip(chip), board: makeGpuBoard(board) };
}

export function makeMotherboard(overrides: Partial<ResolvedMotherboard> = {}): ResolvedMotherboard {
  return {
    id: "test-motherboard",
    slug: "test-motherboard",
    maker: "Testmaker",
    model: "Test Board X",
    chipset_id: "test-chipset",
    socket: "AM5",
    form_factor: "ATX",
    mem_type: "DDR5",
    ram_slots: 4,
    max_mem_gb: 192,
    max_mem_speed: 8000,
    pcie_gen: 5,
    eps_required: 1,
    cpu_support: [{ cpu_generation: "ryzen-9000", needs_bios_update: false }],
    ...provenance,
    ...overrides,
  };
}

export function makeRam(overrides: Partial<RamKit> = {}): RamKit {
  return {
    id: "test-ram",
    type: "DDR5",
    capacity_gb: 32,
    sticks: 2,
    speed_mts: 6000,
    cas: 30,
    voltage: 1.35,
    ...provenance,
    ...overrides,
  };
}

export function makePsu(overrides: Partial<Psu> = {}): Psu {
  return {
    id: "test-psu",
    slug: "test-psu",
    maker: "Testmaker",
    model: "Test 1000",
    watts: 1000,
    efficiency: "gold",
    atx3: true,
    eps_count: 2,
    pcie_6pin_count: 0,
    pcie_8pin_count: 4,
    conn_12v2x6_count: 1,
    modular: "full",
    ...provenance,
    ...overrides,
  };
}

/** A complete build with no issues. Pass `undefined` for a slot to leave it empty. */
export function makeBuild(overrides: Partial<Build> = {}): Build {
  return {
    cpu: makeCpu(),
    gpu: makeGpu(),
    ram: makeRam(),
    motherboard: makeMotherboard(),
    psu: makePsu(),
    ...overrides,
  };
}

/** A power estimate to hand to `checkCompatibility` so its tests do not depend on `estimatePower`. */
export function makePower(overrides: Partial<PowerEstimate> = {}): PowerEstimate {
  return {
    gpuW: 300,
    cpuW: 160,
    baselineW: 75,
    peakW: 535,
    multiplier: 1.3,
    recommendedPsuW: 700,
    headroom: { status: "green", psuW: 1000, spareW: 465 },
    ...overrides,
  };
}
