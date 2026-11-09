import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/catalog/load";

const provenance = { source_notes: "fake test data", verified: false };

const chip = (id: string) => ({
  id,
  slug: id,
  vendor: "nvidia",
  name: id,
  series: "Fake",
  year: 2024,
  vram_gb: 8,
  vram_type: "GDDR6",
  ref_boost_mhz: 2000,
  ref_power_w: 150,
  pcie_gen: 4,
  pcie_lanes: 16,
  high_power_spikes: false,
  perf_index: 10,
  ...provenance,
});

const board = (id: string, chipId: string) => ({
  id,
  slug: id,
  chip_id: chipId,
  maker: "FakeMaker",
  model: id,
  boost_mhz: 2000,
  power_w: 150,
  conn_8pin: 1,
  conn_12v2x6: 0,
  length_mm: 250,
  slots: 2,
  fan_count: 2,
  rec_psu_w: 550,
  ...provenance,
});

const psu = {
  id: "fake-psu",
  slug: "fake-psu",
  maker: "FakeMaker",
  model: "Fake PSU",
  watts: 750,
  efficiency: "gold",
  atx3: true,
  eps_count: 2,
  pcie_8pin_count: 4,
  conn_12v2x6_count: 1,
  modular: "full",
  ...provenance,
};

let dir: string;

async function write(file: string, data: unknown) {
  const full = path.join(dir, file);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, typeof data === "string" ? data : JSON.stringify(data));
}

beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "buildwars-load-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("loadCatalog", () => {
  it("loads a valid directory", async () => {
    await write("psus.json", [psu]);
    await write("gpus/fake.json", { chips: [chip("c1")], boards: [board("b1", "c1")] });
    await write("models/manifest.json", []);
    const result = await loadCatalog(dir);
    expect(result.issues).toEqual([]);
    expect(result.catalog?.psus).toHaveLength(1);
    expect(result.catalog?.gpu_boards[0].id).toBe("b1");
  });

  it("treats missing files and a missing gpus folder as empty", async () => {
    const result = await loadCatalog(dir);
    expect(result.issues).toEqual([]);
    expect(result.catalog).toEqual({
      cpus: [],
      gpu_chips: [],
      gpu_boards: [],
      chipsets: [],
      motherboards: [],
      ram_kits: [],
      psus: [],
      models: [],
    });
  });

  it("reports malformed JSON with the file name", async () => {
    await write("cpus.json", "{ not json");
    const result = await loadCatalog(dir);
    expect(result.catalog).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].file).toBe("cpus.json");
  });

  it("reports a non-array file", async () => {
    await write("psus.json", {});
    const result = await loadCatalog(dir);
    expect(result.issues[0]).toMatchObject({ file: "psus.json", path: "psus" });
  });

  it("reports a schema failure with file and path, and returns no catalog", async () => {
    await write("psus.json", [psu, { ...psu, id: "second-psu", watts: -5 }]);
    const result = await loadCatalog(dir);
    expect(result.catalog).toBeUndefined();
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toMatchObject({ file: "psus.json", path: "psus[1].watts" });
    expect(result.issues[0].message).toContain("second-psu");
  });

  it("reports gpu file schema failures with chips[i] / boards[i] paths", async () => {
    const bad = { ...chip("c2"), vram_gb: 0 };
    await write("gpus/fake.json", {
      chips: [chip("c1"), bad],
      boards: [{ ...board("b1", "c1"), chip_id: 5 }],
    });
    const result = await loadCatalog(dir);
    expect(result.catalog).toBeUndefined();
    const found = result.issues.map((i) => [i.file, i.path]);
    expect(found).toContainEqual(["gpus/fake.json", "chips[1].vram_gb"]);
    expect(found).toContainEqual(["gpus/fake.json", "boards[0].chip_id"]);
    expect(result.issues.find((i) => i.path === "chips[1].vram_gb")?.message).toContain("c2");
  });

  it("concatenates gpu files in alphabetical order", async () => {
    await write("gpus/b-series.json", { chips: [chip("chip-b")], boards: [] });
    await write("gpus/a-series.json", { chips: [chip("chip-a")], boards: [] });
    const result = await loadCatalog(dir);
    expect(result.catalog?.gpu_chips.map((c) => c.id)).toEqual(["chip-a", "chip-b"]);
  });

  it("returns the catalog together with cross-reference issues", async () => {
    await write("gpus/fake.json", { chips: [], boards: [board("b1", "missing-chip")] });
    const result = await loadCatalog(dir);
    expect(result.catalog).toBeDefined();
    expect(result.issues.map((i) => i.path)).toEqual(["gpu_boards[0].chip_id"]);
  });
});
