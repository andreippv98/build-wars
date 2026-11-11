import { describe, expect, it } from "vitest";
import { scoreBuild } from "@/lib/engine";
import { makeGpu, makeGpuBoard, makeGpuChip } from "@/lib/engine/test-fixtures";
import { metaDescription } from "@/lib/seo/metadata";
import {
  boardDescription,
  boardIndex,
  boardLead,
  boardName,
  boardSpecs,
  boardTitle,
  chipDescription,
  chipLead,
  chipSpecs,
  chipTitle,
  chipsBySeries,
  comparisonRows,
  connectorText,
  slotText,
} from "./gpu";

const rows = (groups: { rows: { label: string; value: string; note?: string }[] }[]) =>
  groups.flatMap((g) => g.rows);
const chipRow = (label: string, chip = makeGpuChip()) =>
  rows(chipSpecs(chip)).find((r) => r.label === label);
const boardRow = (label: string, board = makeGpuBoard(), chip = makeGpuChip()) =>
  rows(boardSpecs(chip, board)).find((r) => r.label === label);

describe("boardName", () => {
  it("joins maker and model", () => {
    expect(boardName(makeGpuBoard({ maker: "ASUS", model: "TUF Gaming RTX 3080 OC" }))).toBe(
      "ASUS TUF Gaming RTX 3080 OC",
    );
  });
});

describe("connectorText", () => {
  const text = (conn_6pin: number, conn_8pin: number, conn_12v2x6: number) =>
    connectorText({ conn_6pin, conn_8pin, conn_12v2x6 });
  it("says slot powered when there are none", () => {
    expect(text(0, 0, 0)).toBe("None (slot powered)");
  });
  it("names a single connector kind", () => {
    expect(text(0, 0, 1)).toBe("1 x 12V-2x6");
    expect(text(0, 2, 0)).toBe("2 x 8-pin");
    expect(text(1, 0, 0)).toBe("1 x 6-pin");
  });
  it("combines kinds with a plus", () => {
    expect(text(1, 1, 0)).toBe("1 x 8-pin + 1 x 6-pin");
    expect(text(0, 1, 1)).toBe("1 x 12V-2x6 + 1 x 8-pin");
    expect(text(1, 2, 1)).toBe("1 x 12V-2x6 + 2 x 8-pin + 1 x 6-pin");
  });
});

describe("slotText", () => {
  it("formats whole and half slots", () => {
    expect(slotText(2)).toBe("2 slots");
    expect(slotText(2.5)).toBe("2.5 slots");
    expect(slotText(1)).toBe("1 slot");
  });
});

describe("boardIndex", () => {
  it("equals the engine value rounded to one decimal", () => {
    const gpu = makeGpu({ boost_mhz: 2105 }, { perf_index: 87 });
    const engine = scoreBuild({ gpu }).gpuIndex as number;
    expect(boardIndex(gpu.chip, gpu.board)).toBe(Math.round(engine * 10) / 10);
  });
  it("is clamped for an extreme clock", () => {
    const high = makeGpu({ boost_mhz: 9000 });
    const low = makeGpu({ boost_mhz: 100 });
    expect(boardIndex(high.chip, high.board)).toBe(106);
    expect(boardIndex(low.chip, low.board)).toBe(97);
  });
  it("equals the chip index at the reference clock", () => {
    const gpu = makeGpu({ boost_mhz: 2000 }, { perf_index: 73 });
    expect(boardIndex(gpu.chip, gpu.board)).toBe(73);
  });
});

describe("chipSpecs", () => {
  it("shows every chip field", () => {
    expect(chipSpecs(makeGpuChip()).map((g) => g.title)).toEqual([
      "Overview",
      "Memory",
      "Reference design",
      "Interface",
      "Performance",
    ]);
    expect(rows(chipSpecs(makeGpuChip())).map((r) => r.label)).toEqual([
      "Model",
      "Vendor",
      "Series",
      "Release year",
      "VRAM",
      "Reference boost clock",
      "Reference board power",
      "PCIe",
      "GPU index",
    ]);
  });
  it("formats values", () => {
    expect(chipRow("VRAM")?.value).toBe("16 GB GDDR7");
    expect(chipRow("Vendor")?.value).toBe("NVIDIA");
    expect(chipRow("Reference boost clock")?.value).toBe("2000 MHz");
    expect(chipRow("Reference board power")?.value).toBe("300 W");
    expect(chipRow("Reference board power")?.note).toBe(
      "Partner cards differ: see the comparison below",
    );
    expect(chipRow("PCIe")?.value).toBe("PCIe 5.0 x16");
  });
  it("notes the estimate or the reference like the CPU index", () => {
    expect(chipRow("GPU index", makeGpuChip({ perf_index_verified: false }))?.note).toBe(
      "Placeholder value, not yet based on review data",
    );
    expect(chipRow("GPU index", makeGpuChip({ perf_index_verified: true }))?.note).toBe(
      "Relative to the RTX 5090 at reference clock = 100",
    );
  });
  it("shows the power spikes row only for spiky chips", () => {
    expect(chipRow("Power spikes", makeGpuChip({ high_power_spikes: false }))).toBeUndefined();
    const row = chipRow("Power spikes", makeGpuChip({ high_power_spikes: true }));
    expect(row?.value).toBe("Known for large spikes");
    expect(row?.note).toContain("unless the PSU is ATX 3.x");
  });
  it("notes narrow cards at 8 lanes or fewer only", () => {
    expect(chipRow("PCIe", makeGpuChip({ pcie_lanes: 16 }))?.note).toBeUndefined();
    expect(chipRow("PCIe", makeGpuChip({ pcie_gen: 4, pcie_lanes: 8 }))?.note).toContain(
      "Uses 8 lanes",
    );
    expect(chipRow("PCIe", makeGpuChip({ pcie_gen: 4, pcie_lanes: 4 }))?.note).toContain(
      "Uses 4 lanes",
    );
  });
});

describe("boardSpecs", () => {
  it("shows every board field", () => {
    expect(boardSpecs(makeGpuChip(), makeGpuBoard()).map((g) => g.title)).toEqual([
      "Overview",
      "Clocks and performance",
      "Power",
      "Size and cooling",
      "Chip",
    ]);
    expect(rows(boardSpecs(makeGpuChip(), makeGpuBoard())).map((r) => r.label)).toEqual([
      "Model",
      "Maker",
      "Product line",
      "Chip",
      "Release year",
      "Boost clock",
      "GPU index",
      "Board power",
      "Power connectors",
      "Recommended PSU by the maker",
      "Length",
      "Thickness",
      "Fans",
      "VRAM",
      "PCIe",
    ]);
  });
  it("omits the product line when there is none", () => {
    expect(boardRow("Product line", makeGpuBoard({ series: undefined }))).toBeUndefined();
    expect(boardRow("Product line")?.value).toBe("Reference");
  });
  it("formats values", () => {
    expect(boardRow("Chip")?.value).toBe("Test Chip");
    expect(boardRow("Board power")?.value).toBe("300 W");
    expect(boardRow("Power connectors")?.value).toBe("1 x 12V-2x6");
    expect(boardRow("Recommended PSU by the maker")?.value).toBe("750 W");
    expect(boardRow("Length")?.value).toBe("300 mm");
    expect(boardRow("Thickness")?.value).toBe("2 slots");
    expect(boardRow("Fans")?.value).toBe("2 fans");
    expect(boardRow("Fans", makeGpuBoard({ fan_count: 1 }))?.value).toBe("1 fan");
  });
  it("compares the boost clock with the reference", () => {
    expect(boardRow("Boost clock", makeGpuBoard({ boost_mhz: 2105 }))?.note).toBe(
      "+105 MHz over the reference design",
    );
    expect(boardRow("Boost clock", makeGpuBoard({ boost_mhz: 2000 }))?.note).toBe(
      "Same as the reference design",
    );
    expect(boardRow("Boost clock", makeGpuBoard({ boost_mhz: 1960 }))?.note).toBe(
      "−40 MHz under the reference design",
    );
  });
  it("shows the card's index with the estimate note", () => {
    const board = makeGpuBoard({ boost_mhz: 2100 });
    const chip = makeGpuChip({ perf_index: 80 });
    expect(boardRow("GPU index", board, chip)?.value).toBe(String(boardIndex(chip, board)));
    expect(boardRow("GPU index", board, chip)?.note).toContain("Placeholder");
  });
  it("shows the chip's power spikes row never, but its narrow-lane note", () => {
    expect(boardRow("Power spikes")).toBeUndefined();
    expect(boardRow("PCIe", makeGpuBoard(), makeGpuChip({ pcie_lanes: 8 }))?.note).toContain(
      "Uses 8 lanes",
    );
  });
});

describe("titles and descriptions", () => {
  const chipA = makeGpuChip({ name: "RTX 9090", vram_gb: 24 });
  const chipB = makeGpuChip({ name: "RX 9000 XT", vendor: "amd", vram_gb: 16 });
  const boardA = makeGpuBoard({ maker: "ASUS", model: "TUF Gaming RTX 9090 OC" });
  const boardB = makeGpuBoard({ maker: "MSI", model: "Ventus 3X", rec_psu_w: 850 });

  it("builds chip text from the data", () => {
    expect(chipTitle(chipA, 3)).toBe("RTX 9090: specs, GPU index and all 3 card models compared");
    expect(chipLead(chipA, 3)).toContain("RTX 9090");
    expect(chipLead(chipA, 3)).toContain("24 GB");
    expect(chipDescription(chipA, 3)).toContain("RTX 9090");
    expect(chipDescription(chipA, 3)).toContain("(estimate)");
    expect(chipDescription(makeGpuChip({ perf_index_verified: true }), 1)).not.toContain(
      "(estimate)",
    );
  });
  it("builds board text from the data", () => {
    expect(boardTitle(chipA, boardA)).toBe(
      "ASUS TUF Gaming RTX 9090 OC: specs, size, power connectors and GPU index",
    );
    const lead = boardLead(chipA, boardA);
    for (const part of ["ASUS TUF Gaming RTX 9090 OC", "300 mm", "2 slots", "2 fans", "750 W"]) {
      expect(lead).toContain(part);
    }
    expect(boardDescription(chipA, boardA)).toContain("1 x 12V-2x6");
  });
  it("differs between parts", () => {
    expect(chipTitle(chipA, 2)).not.toBe(chipTitle(chipB, 2));
    expect(chipDescription(chipA, 2)).not.toBe(chipDescription(chipB, 2));
    expect(boardTitle(chipA, boardA)).not.toBe(boardTitle(chipA, boardB));
    expect(boardDescription(chipA, boardA)).not.toBe(boardDescription(chipA, boardB));
  });
  it("keeps descriptions within 160 characters", () => {
    const long = makeGpuBoard({
      maker: "A very long maker name",
      model: "Extremely Verbose Gaming Edition Ultra Overclocked White RTX 9090",
      conn_6pin: 1,
      conn_8pin: 2,
      conn_12v2x6: 1,
    });
    expect(metaDescription(boardDescription(chipA, long)).length).toBeLessThanOrEqual(160);
    expect(metaDescription(chipDescription(chipA, 12)).length).toBeLessThanOrEqual(160);
  });
});

describe("chipsBySeries", () => {
  const chips = [
    makeGpuChip({ id: "a1", name: "RTX 40 A", series: "RTX 40", year: 2022, perf_index: 50 }),
    makeGpuChip({ id: "a2", name: "RTX 40 B", series: "RTX 40", year: 2023, perf_index: 70 }),
    makeGpuChip({ id: "b1", name: "RX 7000 A", vendor: "amd", series: "RX 7000", year: 2023 }),
    makeGpuChip({ id: "c1", name: "RTX 50 A", series: "RTX 50", year: 2025, perf_index: 90 }),
    makeGpuChip({ id: "d1", name: "RX 6000 A", vendor: "amd", series: "RX 6000", year: 2020 }),
    makeGpuChip({ id: "b2", name: "RX 7000 B", vendor: "amd", series: "RX 7000", year: 2023 }),
  ];
  it("orders series by newest chip, then name, vendors interleaved", () => {
    const groups = chipsBySeries(chips);
    expect(groups.map((g) => g.series)).toEqual(["RTX 50", "RTX 40", "RX 7000", "RX 6000"]);
    expect(groups.map((g) => g.vendor)).toEqual(["nvidia", "nvidia", "amd", "amd"]);
  });
  it("orders chips inside a series by index, strongest first", () => {
    const groups = chipsBySeries(chips);
    expect(groups[1].chips.map((c) => c.id)).toEqual(["a2", "a1"]);
    expect(groups[2].chips.map((c) => c.id)).toEqual(["b1", "b2"]);
  });
});

describe("comparisonRows", () => {
  const chip = makeGpuChip();
  const boards = [
    makeGpuBoard({
      id: "x",
      boost_mhz: 2100,
      power_w: 320,
      length_mm: 340,
      slots: 3,
      fan_count: 3,
      rec_psu_w: 850,
    }),
    makeGpuBoard({
      id: "y",
      boost_mhz: 1960,
      power_w: 300,
      length_mm: 270,
      slots: 2,
      fan_count: 2,
      rec_psu_w: 750,
    }),
  ];
  it("gives each board its index and clock delta", () => {
    const { rows: result } = comparisonRows(chip, boards);
    expect(result.map((r) => r.board.id)).toEqual(["x", "y"]);
    expect(result.map((r) => r.boostDelta)).toEqual([100, -40]);
    expect(result[0].index).toBe(boardIndex(chip, boards[0]));
    expect(result[0].connectors).toBe("1 x 12V-2x6");
    expect(result[0].thickness).toBe("3 slots");
  });
  it("finds the min and max of every numeric column", () => {
    const { ranges } = comparisonRows(chip, boards);
    expect(ranges.boost_mhz).toEqual({ min: 1960, max: 2100 });
    expect(ranges.power_w).toEqual({ min: 300, max: 320 });
    expect(ranges.length_mm).toEqual({ min: 270, max: 340 });
    expect(ranges.slots).toEqual({ min: 2, max: 3 });
    expect(ranges.fan_count).toEqual({ min: 2, max: 3 });
    expect(ranges.rec_psu_w).toEqual({ min: 750, max: 850 });
  });
  it("has equal min and max for one board", () => {
    const { ranges } = comparisonRows(chip, [boards[0]]);
    expect(ranges.length_mm).toEqual({ min: 340, max: 340 });
  });
});
