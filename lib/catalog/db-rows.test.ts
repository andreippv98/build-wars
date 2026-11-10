import { describe, expect, it } from "vitest";
import {
  chipsetRow,
  cpuRow,
  cpuSupportRows,
  gpuBoardRow,
  gpuChipRow,
  motherboardRow,
  psuRow,
  ramKitRow,
} from "@/lib/catalog/db-rows";
import type { Catalog } from "@/lib/schemas";

const provenance = { source_notes: "fake test data", verified: false };

const cpu: Catalog["cpus"][number] = {
  id: "fake-cpu",
  slug: "fake-cpu-slug",
  vendor: "amd",
  name: "Fake CPU",
  socket: "AM5",
  generation: "ryzen-7000",
  year: 2023,
  cores: 8,
  threads: 16,
  base_ghz: 4,
  boost_ghz: 5,
  cache_mb: 32,
  tdp_w: 100,
  ppt_w: 140,
  igpu: false,
  mem_types: ["DDR5"],
  max_mem_speed: { DDR5: 5200 },
  pcie_gen: 5,
  perf_index: 11,
  perf_index_verified: false,
  ...provenance,
};

describe("row mappers", () => {
  it("maps a cpu", () => {
    expect(cpuRow(cpu)).toEqual({
      id: "fake-cpu",
      slug: "fake-cpu-slug",
      vendor: "amd",
      name: "Fake CPU",
      socket: "AM5",
      generation: "ryzen-7000",
      year: 2023,
      cores: 8,
      threads: 16,
      baseGhz: 4,
      boostGhz: 5,
      cacheMb: 32,
      tdpW: 100,
      pptW: 140,
      igpu: false,
      memTypes: ["DDR5"],
      maxMemSpeed: { DDR5: 5200 },
      pcieGen: 5,
      perfIndex: 11,
      perfIndexVerified: false,
      sourceNotes: "fake test data",
      verified: false,
    });
  });

  it("maps a gpu chip", () => {
    const row = gpuChipRow({
      id: "c",
      slug: "c-slug",
      vendor: "nvidia",
      name: "Fake Chip",
      series: "Fake",
      year: 2024,
      vram_gb: 8,
      vram_type: "GDDR6",
      ref_boost_mhz: 2000,
      ref_power_w: 150,
      pcie_gen: 4,
      pcie_lanes: 8,
      high_power_spikes: true,
      perf_index: 33,
      perf_index_verified: false,
      ...provenance,
    });
    expect(row).toMatchObject({
      vramGb: 8,
      vramType: "GDDR6",
      refBoostMhz: 2000,
      refPowerW: 150,
      pcieGen: 4,
      pcieLanes: 8,
      highPowerSpikes: true,
      perfIndex: 33,
      perfIndexVerified: false,
      sourceNotes: "fake test data",
    });
  });

  it("maps a gpu board, with a missing series as null", () => {
    const base = {
      id: "b",
      slug: "b-slug",
      chip_id: "c",
      maker: "FakeMaker",
      model: "Fake Board",
      boost_mhz: 2000,
      power_w: 150,
      conn_6pin: 0,
      conn_8pin: 1,
      conn_12v2x6: 2,
      length_mm: 250,
      slots: 2.5,
      fan_count: 3,
      rec_psu_w: 550,
      ...provenance,
    };
    expect(gpuBoardRow(base)).toMatchObject({
      chipId: "c",
      series: null,
      conn6pin: 0,
      conn8pin: 1,
      conn12v2x6: 2,
      lengthMm: 250,
      slots: 2.5,
      fanCount: 3,
      recPsuW: 550,
      powerW: 150,
      boostMhz: 2000,
    });
    expect(gpuBoardRow({ ...base, series: "Line" }).series).toBe("Line");
  });

  it("maps a chipset", () => {
    expect(
      chipsetRow({
        id: "cs",
        vendor: "amd",
        name: "Fake Chipset",
        socket: "AM5",
        cpu_support: [{ cpu_generation: "ryzen-7000", needs_bios_update: false }],
        ...provenance,
      }),
    ).toEqual({
      id: "cs",
      vendor: "amd",
      name: "Fake Chipset",
      socket: "AM5",
      sourceNotes: "fake test data",
      verified: false,
    });
  });

  it("maps a motherboard without its cpu_support", () => {
    const row = motherboardRow({
      id: "mb",
      slug: "mb-slug",
      maker: "FakeMaker",
      model: "Fake Board",
      chipset_id: "cs",
      socket: "AM5",
      form_factor: "mATX",
      mem_type: "DDR5",
      ram_slots: 4,
      max_mem_gb: 128,
      max_mem_speed: 6000,
      pcie_gen: 5,
      eps_required: 2,
      cpu_support: [{ cpu_id: "x", needs_bios_update: true }],
      ...provenance,
    });
    expect(row).toMatchObject({
      chipsetId: "cs",
      formFactor: "mATX",
      memType: "DDR5",
      ramSlots: 4,
      maxMemGb: 128,
      maxMemSpeed: 6000,
      pcieGen: 5,
      epsRequired: 2,
    });
    expect(row).not.toHaveProperty("cpuSupport");
  });

  it("maps a ram kit, with missing brand and model as null", () => {
    expect(
      ramKitRow({
        id: "ram",
        type: "DDR5",
        capacity_gb: 32,
        sticks: 2,
        speed_mts: 6000,
        cas: 30,
        voltage: 1.35,
        ...provenance,
      }),
    ).toMatchObject({ capacityGb: 32, speedMts: 6000, brand: null, model: null, voltage: 1.35 });
  });

  it("maps a psu", () => {
    expect(
      psuRow({
        id: "psu",
        slug: "psu-slug",
        maker: "FakeMaker",
        model: "Fake PSU",
        watts: 750,
        efficiency: "gold",
        atx3: true,
        eps_count: 2,
        pcie_6pin_count: 0,
        pcie_8pin_count: 4,
        conn_12v2x6_count: 1,
        modular: "semi",
        ...provenance,
      }),
    ).toMatchObject({
      watts: 750,
      atx3: true,
      epsCount: 2,
      pcie6pinCount: 0,
      pcie8pinCount: 4,
      conn12v2x6Count: 1,
      modular: "semi",
    });
  });
});

describe("cpuSupportRows", () => {
  const catalog = {
    cpus: [],
    gpu_chips: [],
    gpu_boards: [],
    ram_kits: [],
    psus: [],
    models: [],
    chipsets: [
      {
        id: "cs",
        vendor: "amd",
        name: "Fake Chipset",
        socket: "AM5",
        cpu_support: [
          { cpu_generation: "ryzen-7000", needs_bios_update: false },
          { cpu_id: "fake-cpu", needs_bios_update: true },
        ],
        ...provenance,
      },
    ],
    motherboards: [
      {
        id: "mb-override",
        slug: "a",
        maker: "M",
        model: "A",
        chipset_id: "cs",
        socket: "AM5",
        form_factor: "ATX",
        mem_type: "DDR5",
        ram_slots: 4,
        max_mem_gb: 128,
        max_mem_speed: 6000,
        pcie_gen: 5,
        eps_required: 1,
        cpu_support: [{ cpu_generation: "ryzen-9000", needs_bios_update: true }],
        ...provenance,
      },
      {
        id: "mb-plain",
        slug: "b",
        maker: "M",
        model: "B",
        chipset_id: "cs",
        socket: "AM5",
        form_factor: "ATX",
        mem_type: "DDR5",
        ram_slots: 4,
        max_mem_gb: 128,
        max_mem_speed: 6000,
        pcie_gen: 5,
        eps_required: 1,
        ...provenance,
      },
    ],
  } satisfies Catalog;

  it("emits chipset rows with chipsetId and motherboard rows with motherboardId", () => {
    expect(cpuSupportRows(catalog)).toEqual([
      {
        chipsetId: "cs",
        motherboardId: null,
        cpuId: null,
        cpuGeneration: "ryzen-7000",
        needsBiosUpdate: false,
      },
      {
        chipsetId: "cs",
        motherboardId: null,
        cpuId: "fake-cpu",
        cpuGeneration: null,
        needsBiosUpdate: true,
      },
      {
        chipsetId: null,
        motherboardId: "mb-override",
        cpuId: null,
        cpuGeneration: "ryzen-9000",
        needsBiosUpdate: true,
      },
    ]);
  });

  it("gives every row exactly one owner and one target", () => {
    for (const row of cpuSupportRows(catalog)) {
      expect([row.chipsetId, row.motherboardId].filter((v) => v != null)).toHaveLength(1);
      expect([row.cpuId, row.cpuGeneration].filter((v) => v != null)).toHaveLength(1);
    }
  });
});
