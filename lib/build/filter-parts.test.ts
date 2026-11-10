import { describe, expect, it } from "vitest";
import { makeCpu, makeGpu, makeMotherboard, makePsu, makeRam } from "@/lib/engine/test-fixtures";
import {
  defaultSort,
  filterAndSort,
  filterDefs,
  matchesSearch,
  SORT_OPTIONS,
} from "./filter-parts";

const names = <T extends { name?: string; id?: string }>(list: T[]) =>
  list.map((p) => p.name ?? p.id);

describe("matchesSearch", () => {
  const gpu = makeGpu(
    { id: "b1", maker: "Fakeco", model: "TUF Gaming RTX 3080 OC" },
    { name: "Fake RTX 3080" },
  );
  it("is case-insensitive and needs every word", () => {
    expect(matchesSearch("gpu", gpu, "3080 tuf")).toBe(true);
    expect(matchesSearch("gpu", gpu, "FAKECO   gaming")).toBe(true);
    expect(matchesSearch("gpu", gpu, "3080 strix")).toBe(false);
  });
  it("matches the chip name for GPUs", () => {
    const g = makeGpu({ model: "Plain Card" }, { name: "Fake Chip 9000" });
    expect(matchesSearch("gpu", g, "chip 9000")).toBe(true);
  });
  it("matches everything when the query is blank", () => {
    expect(matchesSearch("cpu", makeCpu(), "   ")).toBe(true);
  });
});

describe("filterDefs", () => {
  it("only offers filters with at least two options, and sorts them", () => {
    const cpus = [
      makeCpu({ id: "a", vendor: "amd", socket: "AM5", year: 2022 }),
      makeCpu({ id: "b", vendor: "intel", socket: "AM5", year: 2024 }),
    ];
    const defs = filterDefs("cpu", cpus);
    expect(defs.map((d) => d.key)).toEqual(["brand", "year"]);
    expect(defs[0].options).toEqual([
      { value: "amd", label: "AMD" },
      { value: "intel", label: "Intel" },
    ]);
    expect(defs[1].options.map((o) => o.value)).toEqual(["2024", "2022"]);
  });
  it("derives GPU filters from chip and board", () => {
    const gpus = [
      makeGpu({ id: "a", maker: "MakerA" }, { vendor: "nvidia", series: "S1" }),
      makeGpu({ id: "b", maker: "MakerB" }, { vendor: "amd", series: "S1" }),
    ];
    expect(filterDefs("gpu", gpus).map((d) => d.key)).toEqual(["brand", "maker"]);
  });
  it("labels RAM capacity and offers motherboard form factors", () => {
    const ram = [makeRam({ id: "a", capacity_gb: 16 }), makeRam({ id: "b", capacity_gb: 32 })];
    expect(filterDefs("ram", ram).find((d) => d.key === "capacity")?.options[0].label).toBe(
      "16 GB",
    );
    const boards = [
      makeMotherboard({ id: "a", form_factor: "ATX" }),
      makeMotherboard({ id: "b", form_factor: "ITX" }),
    ];
    expect(filterDefs("motherboard", boards).map((d) => d.key)).toEqual(["form"]);
  });
  it("offers only wattage thresholds that keep a part, at the boundary", () => {
    const psus = [makePsu({ id: "a", watts: 650 }), makePsu({ id: "b", watts: 849 })];
    const def = filterDefs("psu", psus).find((d) => d.key === "minWatts");
    expect(def?.options.map((o) => o.value)).toEqual(["550", "650", "750"]);
    const exact = [makePsu({ id: "a", watts: 550 }), makePsu({ id: "b", watts: 650 })];
    expect(
      filterDefs("psu", exact)
        .find((d) => d.key === "minWatts")
        ?.options.map((o) => o.value),
    ).toEqual(["550", "650"]);
    expect(filterDefs("psu", [makePsu({ id: "a", watts: 560 })])).toEqual([]);
  });
});

describe("filtering", () => {
  const cpus = [
    makeCpu({ id: "a", name: "A", vendor: "amd", year: 2022 }),
    makeCpu({ id: "b", name: "B", vendor: "intel", year: 2024 }),
  ];
  it("applies filters and treats empty as All", () => {
    expect(names(filterAndSort("cpu", cpus, { filters: { brand: "intel" } }))).toEqual(["B"]);
    expect(filterAndSort("cpu", cpus, { filters: { brand: "" } })).toHaveLength(2);
  });
  it("combines search and filters", () => {
    expect(filterAndSort("cpu", cpus, { query: "a", filters: { year: "2024" } })).toHaveLength(0);
  });
  it("keeps PSUs at exactly the minimum wattage", () => {
    const psus = [makePsu({ id: "a", watts: 749 }), makePsu({ id: "b", watts: 750 })];
    expect(names(filterAndSort("psu", psus, { filters: { minWatts: "750" } }))).toEqual(["b"]);
  });
  it("does not change its input", () => {
    const copy = [...cpus];
    filterAndSort("cpu", cpus, { sort: "name" });
    expect(cpus).toEqual(copy);
  });
});

describe("sorting", () => {
  it("defaults to the first option of each slot", () => {
    expect(defaultSort("cpu")).toBe("performance");
    expect(defaultSort("motherboard")).toBe("name");
    expect(defaultSort("ram")).toBe("capacity");
    expect(defaultSort("psu")).toBe("wattage");
    expect(SORT_OPTIONS.gpu.map((s) => s.key)).toEqual([
      "performance",
      "name",
      "newest",
      "shortest",
    ]);
  });
  it("sorts CPUs by performance, name and newest", () => {
    const cpus = [
      makeCpu({ id: "a", name: "Bravo", perf_index: 50, year: 2020 }),
      makeCpu({ id: "b", name: "Alpha", perf_index: 80, year: 2019 }),
      makeCpu({ id: "c", name: "Charlie", perf_index: 80, year: 2024 }),
    ];
    expect(names(filterAndSort("cpu", cpus, {}))).toEqual(["Alpha", "Charlie", "Bravo"]);
    expect(names(filterAndSort("cpu", cpus, { sort: "name" }))).toEqual([
      "Alpha",
      "Bravo",
      "Charlie",
    ]);
    expect(names(filterAndSort("cpu", cpus, { sort: "newest" }))).toEqual([
      "Charlie",
      "Bravo",
      "Alpha",
    ]);
  });
  it("sorts GPUs by chip performance then boost, and by length", () => {
    const gpus = [
      makeGpu({ id: "slow-hi", boost_mhz: 2500, length_mm: 250 }, { id: "c1", perf_index: 40 }),
      makeGpu({ id: "fast-lo", boost_mhz: 1800, length_mm: 330 }, { id: "c2", perf_index: 90 }),
      makeGpu({ id: "fast-hi", boost_mhz: 2100, length_mm: 280 }, { id: "c2", perf_index: 90 }),
    ];
    expect(names(filterAndSort("gpu", gpus, {}).map((g) => g.board))).toEqual([
      "fast-hi",
      "fast-lo",
      "slow-hi",
    ]);
    expect(filterAndSort("gpu", gpus, { sort: "shortest" }).map((g) => g.board.id)).toEqual([
      "slow-hi",
      "fast-hi",
      "fast-lo",
    ]);
  });
  it("sorts motherboards by name and socket", () => {
    const boards = [
      makeMotherboard({ id: "a", maker: "M", model: "B", socket: "AM5" }),
      makeMotherboard({ id: "b", maker: "M", model: "A", socket: "LGA1700" }),
      makeMotherboard({ id: "c", maker: "M", model: "C", socket: "AM4" }),
    ];
    expect(filterAndSort("motherboard", boards, {}).map((b) => b.id)).toEqual(["b", "a", "c"]);
    expect(filterAndSort("motherboard", boards, { sort: "socket" }).map((b) => b.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("sorts RAM by capacity then speed, or speed first", () => {
    const kits = [
      makeRam({ id: "a", capacity_gb: 16, speed_mts: 6400 }),
      makeRam({ id: "b", capacity_gb: 32, speed_mts: 5200 }),
      makeRam({ id: "c", capacity_gb: 32, speed_mts: 6000 }),
    ];
    expect(filterAndSort("ram", kits, {}).map((k) => k.id)).toEqual(["c", "b", "a"]);
    expect(filterAndSort("ram", kits, { sort: "speed" }).map((k) => k.id)).toEqual(["a", "c", "b"]);
  });
  it("sorts PSUs by wattage ascending or name", () => {
    const psus = [
      makePsu({ id: "a", maker: "Z", model: "1", watts: 850 }),
      makePsu({ id: "b", maker: "Y", model: "1", watts: 550 }),
    ];
    expect(filterAndSort("psu", psus, {}).map((p) => p.id)).toEqual(["b", "a"]);
    expect(filterAndSort("psu", psus, { sort: "name" }).map((p) => p.id)).toEqual(["b", "a"]);
  });
});
