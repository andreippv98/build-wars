import { describe, expect, it } from "vitest";
import { validateCatalog } from "@/lib/catalog/validate";
import type { Catalog } from "@/lib/schemas";

const provenance = { source_notes: "fake test data", verified: false };

function makeCatalog(): Catalog {
  return {
    cpus: [
      {
        id: "fake-cpu-a",
        slug: "fake-cpu-a",
        vendor: "amd",
        name: "Fake CPU A",
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
      },
      {
        id: "fake-cpu-b",
        slug: "fake-cpu-b",
        vendor: "intel",
        name: "Fake CPU B",
        socket: "LGA1700",
        generation: "intel-12",
        year: 2022,
        cores: 6,
        threads: 12,
        base_ghz: 3,
        boost_ghz: 4,
        cache_mb: 18,
        tdp_w: 65,
        ppt_w: 120,
        igpu: true,
        mem_types: ["DDR4", "DDR5"],
        max_mem_speed: { DDR4: 3200, DDR5: 4800 },
        pcie_gen: 5,
        perf_index: 22,
        perf_index_verified: false,
        ...provenance,
      },
    ],
    gpu_chips: [
      {
        id: "fake-chip-1",
        slug: "fake-chip-1",
        vendor: "nvidia",
        name: "Fake Chip 1",
        series: "Fake 1",
        year: 2024,
        vram_gb: 8,
        vram_type: "GDDR6",
        ref_boost_mhz: 2000,
        ref_power_w: 150,
        pcie_gen: 4,
        pcie_lanes: 16,
        high_power_spikes: false,
        perf_index: 33,
        perf_index_verified: false,
        ...provenance,
      },
      {
        id: "fake-chip-2",
        slug: "fake-chip-2",
        vendor: "amd",
        name: "Fake Chip 2",
        series: "Fake 1",
        year: 2024,
        vram_gb: 12,
        vram_type: "GDDR6",
        ref_boost_mhz: 2100,
        ref_power_w: 200,
        pcie_gen: 4,
        pcie_lanes: 16,
        high_power_spikes: false,
        perf_index: 44,
        perf_index_verified: false,
        ...provenance,
      },
    ],
    gpu_boards: [
      {
        id: "fake-maker-board-1",
        slug: "fake-board",
        chip_id: "fake-chip-1",
        maker: "FakeMaker",
        series: "Fake Line",
        model: "Fake Board 1",
        boost_mhz: 2050,
        power_w: 160,
        conn_6pin: 0,
        conn_8pin: 1,
        conn_12v2x6: 0,
        length_mm: 250,
        slots: 2,
        fan_count: 2,
        rec_psu_w: 550,
        ...provenance,
      },
      {
        id: "fake-maker-board-2",
        slug: "fake-board",
        chip_id: "fake-chip-2",
        maker: "FakeMaker",
        model: "Fake Board 2",
        boost_mhz: 2150,
        power_w: 210,
        conn_6pin: 0,
        conn_8pin: 2,
        conn_12v2x6: 0,
        length_mm: 300,
        slots: 2.5,
        fan_count: 3,
        rec_psu_w: 650,
        ...provenance,
      },
    ],
    chipsets: [
      {
        id: "fake-chipset-am5",
        vendor: "amd",
        name: "Fake AM5 Chipset",
        socket: "AM5",
        cpu_support: [{ cpu_generation: "ryzen-7000", needs_bios_update: false }],
        ...provenance,
      },
      {
        id: "fake-chipset-1700",
        vendor: "intel",
        name: "Fake 1700 Chipset",
        socket: "LGA1700",
        cpu_support: [{ cpu_id: "fake-cpu-b", needs_bios_update: true }],
        ...provenance,
      },
    ],
    motherboards: [
      {
        id: "fake-board-am5",
        slug: "fake-board-am5",
        maker: "FakeMaker",
        model: "Fake AM5 Board",
        chipset_id: "fake-chipset-am5",
        socket: "AM5",
        form_factor: "ATX",
        mem_type: "DDR5",
        ram_slots: 4,
        max_mem_gb: 128,
        max_mem_speed: 6000,
        pcie_gen: 5,
        eps_required: 1,
        cpu_support: [{ cpu_id: "fake-cpu-a", needs_bios_update: true }],
        ...provenance,
      },
      {
        id: "fake-board-1700",
        slug: "fake-board-1700",
        maker: "FakeMaker",
        model: "Fake 1700 Board",
        chipset_id: "fake-chipset-1700",
        socket: "LGA1700",
        form_factor: "mATX",
        mem_type: "DDR4",
        ram_slots: 2,
        max_mem_gb: 64,
        max_mem_speed: 3200,
        pcie_gen: 4,
        eps_required: 1,
        ...provenance,
      },
    ],
    ram_kits: [
      {
        id: "fake-ram-1",
        type: "DDR5",
        capacity_gb: 32,
        sticks: 2,
        speed_mts: 6000,
        cas: 30,
        voltage: 1.35,
        ...provenance,
      },
    ],
    psus: [
      {
        id: "fake-psu-1",
        slug: "fake-psu-1",
        maker: "FakeMaker",
        model: "Fake PSU 1",
        watts: 750,
        efficiency: "gold",
        atx3: true,
        eps_count: 2,
        pcie_6pin_count: 0,
        pcie_8pin_count: 4,
        conn_12v2x6_count: 1,
        modular: "full",
        ...provenance,
      },
    ],
    models: [
      {
        id: "fake-model-gpu",
        applies_to: { part_ids: ["fake-maker-board-1"] },
        category: "gpu",
        file: "fake.glb",
        scale_to_data: false,
        verified: false,
      },
    ],
  };
}

function paths(catalog: Catalog): string[] {
  return validateCatalog(catalog).map((i) => i.path);
}

describe("validateCatalog", () => {
  it("accepts a valid catalog", () => {
    expect(validateCatalog(makeCatalog())).toEqual([]);
  });

  it("reports every issue, not just the first", () => {
    const c = makeCatalog();
    c.cpus[0].threads = 1;
    c.cpus[1].boost_ghz = 1;
    expect(paths(c)).toEqual(["cpus[0].threads", "cpus[1].boost_ghz"]);
  });
});

describe("check 1: unique ids", () => {
  it("flags a duplicate id in cpus", () => {
    const c = makeCatalog();
    c.cpus[1].id = c.cpus[0].id;
    // The renamed cpu is also no longer found by the chipset / board lists that named it.
    expect(paths(c)).toContain("cpus[1].id");
  });

  it("flags a duplicate id in models", () => {
    const c = makeCatalog();
    c.models.push({ ...c.models[0] });
    expect(paths(c)).toEqual(["models[1].id"]);
  });

  it("flags a duplicate id in ram_kits and psus", () => {
    const c = makeCatalog();
    c.ram_kits.push({ ...c.ram_kits[0] });
    c.psus.push({ ...c.psus[0], slug: "other-psu" });
    expect(paths(c)).toEqual(["ram_kits[1].id", "psus[1].id"]);
  });
});

describe("check 2: unique slugs", () => {
  it("flags a duplicate cpu slug", () => {
    const c = makeCatalog();
    c.cpus[1].slug = c.cpus[0].slug;
    expect(paths(c)).toEqual(["cpus[1].slug"]);
  });

  it("flags a duplicate board slug under the same chip", () => {
    const c = makeCatalog();
    c.gpu_boards[1].chip_id = "fake-chip-1";
    expect(paths(c)).toEqual(["gpu_boards[1].slug"]);
  });

  it("allows the same board slug under different chips", () => {
    const c = makeCatalog();
    expect(c.gpu_boards[0].slug).toBe(c.gpu_boards[1].slug);
    expect(paths(c)).toEqual([]);
  });

  it("flags a duplicate psu slug", () => {
    const c = makeCatalog();
    c.psus.push({ ...c.psus[0], id: "fake-psu-2" });
    expect(paths(c)).toEqual(["psus[1].slug"]);
  });
});

describe("check 3: board points to chip", () => {
  it("flags an unknown chip_id", () => {
    const c = makeCatalog();
    c.gpu_boards[0].chip_id = "nope";
    expect(paths(c)).toEqual(["gpu_boards[0].chip_id"]);
  });
});

describe("check 4: motherboard points to chipset", () => {
  it("flags an unknown chipset_id", () => {
    const c = makeCatalog();
    c.motherboards[0].chipset_id = "nope";
    expect(paths(c)).toEqual(["motherboards[0].chipset_id"]);
  });

  it("flags a socket different from the chipset's", () => {
    const c = makeCatalog();
    c.motherboards[1].socket = "AM5";
    const issues = validateCatalog(c);
    expect(issues.map((i) => i.path)).toContain("motherboards[1].socket");
  });
});

describe("check 5: cpu_support cpu_id", () => {
  it("flags an unknown cpu on a chipset", () => {
    const c = makeCatalog();
    c.chipsets[1].cpu_support[0] = { cpu_id: "nope", needs_bios_update: false };
    expect(paths(c)).toEqual(["chipsets[1].cpu_support[0].cpu_id"]);
  });

  it("flags a cpu on the wrong socket in a chipset list", () => {
    const c = makeCatalog();
    c.chipsets[1].cpu_support[0] = { cpu_id: "fake-cpu-a", needs_bios_update: false };
    expect(paths(c)).toEqual(["chipsets[1].cpu_support[0].cpu_id"]);
  });

  it("flags a cpu on the wrong socket in a motherboard override", () => {
    const c = makeCatalog();
    c.motherboards[0].cpu_support = [{ cpu_id: "fake-cpu-b", needs_bios_update: false }];
    expect(paths(c)).toEqual(["motherboards[0].cpu_support[0].cpu_id"]);
  });

  it("ignores generation entries", () => {
    const c = makeCatalog();
    c.motherboards[0].cpu_support = [{ cpu_generation: "intel-12", needs_bios_update: false }];
    expect(paths(c)).toEqual([]);
  });
});

describe("check 6: cpu memory types", () => {
  it("flags max_mem_speed keys that differ from mem_types", () => {
    const c = makeCatalog();
    c.cpus[1].max_mem_speed = { DDR5: 4800 };
    expect(paths(c)).toEqual(["cpus[1].max_mem_speed"]);
  });

  it("flags duplicate mem_types", () => {
    const c = makeCatalog();
    c.cpus[0].mem_types = ["DDR5", "DDR5"];
    expect(paths(c)).toEqual(["cpus[0].mem_types"]);
  });
});

describe("check 7: sanity", () => {
  it("flags threads below cores", () => {
    const c = makeCatalog();
    c.cpus[0].threads = 4;
    expect(paths(c)).toEqual(["cpus[0].threads"]);
  });

  it("allows threads equal to cores and boost equal to base", () => {
    const c = makeCatalog();
    c.cpus[0].threads = c.cpus[0].cores;
    c.cpus[0].boost_ghz = c.cpus[0].base_ghz;
    expect(paths(c)).toEqual([]);
  });

  it("flags boost below base", () => {
    const c = makeCatalog();
    c.cpus[0].boost_ghz = 3;
    expect(paths(c)).toEqual(["cpus[0].boost_ghz"]);
  });

  it("flags a kit whose capacity is not divisible by sticks", () => {
    const c = makeCatalog();
    c.ram_kits[0].capacity_gb = 33;
    expect(paths(c)).toEqual(["ram_kits[0].capacity_gb"]);
  });
});

describe("check 8: model manifest", () => {
  it("flags a part id missing from the matching collection", () => {
    const c = makeCatalog();
    c.models[0].applies_to = { part_ids: ["fake-maker-board-1", "nope"] };
    expect(paths(c)).toEqual(["models[0].applies_to.part_ids[1]"]);
  });

  it("looks psu part ids up in psus", () => {
    const c = makeCatalog();
    c.models[0] = { ...c.models[0], category: "psu", applies_to: { part_ids: ["fake-psu-1"] } };
    expect(paths(c)).toEqual([]);
    c.models[0].applies_to = { part_ids: ["fake-maker-board-1"] };
    expect(paths(c)).toEqual(["models[0].applies_to.part_ids[0]"]);
  });

  it("does not check categories without a collection", () => {
    const c = makeCatalog();
    c.models[0] = { ...c.models[0], category: "case", applies_to: { part_ids: ["anything"] } };
    expect(paths(c)).toEqual([]);
  });

  it("flags an unknown chip in a family rule", () => {
    const c = makeCatalog();
    c.models[0].applies_to = {
      family: { maker: "FakeMaker", series: "Fake Line", chip_ids: ["fake-chip-1", "nope"] },
    };
    expect(paths(c)).toEqual(["models[0].applies_to.family.chip_ids[1]"]);
  });

  it("flags a family rule on a non-gpu model", () => {
    const c = makeCatalog();
    c.models[0] = {
      ...c.models[0],
      category: "psu",
      applies_to: { family: { maker: "FakeMaker", series: "x", chip_ids: ["fake-chip-1"] } },
    };
    expect(paths(c)).toEqual(["models[0].applies_to.family"]);
  });
});
