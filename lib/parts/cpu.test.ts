import { describe, expect, it } from "vitest";
import { makeCpu } from "@/lib/engine/test-fixtures";
import { metaDescription } from "@/lib/seo/metadata";
import { cpuDescription, cpuLead, cpuSpecs, cpuTitle, cpusBySocket, otherCpus } from "./cpu";

const labels = (cpu = makeCpu()) => cpuSpecs(cpu).flatMap((g) => g.rows.map((r) => r.label));
const value = (label: string, cpu = makeCpu()) =>
  cpuSpecs(cpu)
    .flatMap((g) => g.rows)
    .find((r) => r.label === label)?.value;

describe("cpuSpecs", () => {
  it("shows every catalog field", () => {
    expect(labels()).toEqual([
      "Model",
      "Vendor",
      "Socket",
      "Generation",
      "Release year",
      "Cores / threads",
      "Base clock",
      "Boost clock",
      "L3 cache",
      "CPU index",
      "TDP",
      "Package power limit (PPT)",
      "Integrated graphics",
      "Memory types",
      "Max official memory speed",
      "PCIe generation",
    ]);
    expect(cpuSpecs(makeCpu()).map((g) => g.title)).toEqual([
      "Overview",
      "Performance and clocks",
      "Power",
      "Memory and platform",
    ]);
  });

  it("formats values with units", () => {
    expect(value("Cores / threads")).toBe("8 cores / 16 threads");
    expect(value("Base clock")).toBe("4 GHz");
    expect(value("L3 cache")).toBe("96 MB");
    expect(value("TDP")).toBe("120 W");
    expect(value("Vendor")).toBe("AMD");
    expect(value("Max official memory speed")).toBe("DDR5-6000");
  });

  it("labels the power limit PPT for AMD and PL2 for Intel", () => {
    expect(labels(makeCpu({ vendor: "amd" }))).toContain("Package power limit (PPT)");
    expect(labels(makeCpu({ vendor: "intel" }))).toContain("Package power limit (PL2)");
    expect(labels(makeCpu({ vendor: "intel" }))).not.toContain("Package power limit (PPT)");
  });

  it("words integrated graphics", () => {
    expect(value("Integrated graphics", makeCpu({ igpu: true }))).toBe("Yes");
    expect(value("Integrated graphics", makeCpu({ igpu: false }))).toBe(
      "No (needs a graphics card)",
    );
  });

  it("shows both speeds of a dual memory type CPU", () => {
    const cpu = makeCpu({
      mem_types: ["DDR4", "DDR5"],
      max_mem_speed: { DDR4: 3200, DDR5: 4800 },
    });
    expect(value("Memory types", cpu)).toBe("DDR4, DDR5");
    expect(value("Max official memory speed", cpu)).toBe("DDR4-3200, DDR5-4800");
  });

  it("flags a placeholder index", () => {
    const note = (verified: boolean) =>
      cpuSpecs(makeCpu({ perf_index_verified: verified }))
        .flatMap((g) => g.rows)
        .find((r) => r.label === "CPU index")?.note;
    expect(note(false)).toContain("Placeholder");
    expect(note(true)).not.toContain("Placeholder");
  });
});

describe("cpuTitle, cpuLead and cpuDescription", () => {
  const a = makeCpu({ name: "AMD Test One", perf_index: 90 });
  const b = makeCpu({ name: "Intel Test Two", vendor: "intel", socket: "LGA1700" });

  it("are unique per CPU and name it", () => {
    for (const fn of [cpuTitle, cpuLead, cpuDescription]) {
      expect(fn(a)).toContain(a.name);
      expect(fn(b)).toContain(b.name);
      expect(fn(a)).not.toBe(fn(b));
    }
  });

  it("keeps the description within 160 characters", () => {
    const long = makeCpu({
      name: "Intel Core Ultra 9 285K Extreme Edition Special",
      mem_types: ["DDR4", "DDR5"],
      max_mem_speed: { DDR4: 3200, DDR5: 4800 },
    });
    expect(metaDescription(cpuDescription(long)).length).toBeLessThanOrEqual(160);
    expect(cpuDescription(a).length).toBeLessThanOrEqual(160);
  });

  it("states the index and flags estimates", () => {
    expect(cpuDescription(a)).toContain("CPU index 90 (estimate)");
    expect(cpuDescription(makeCpu({ perf_index_verified: true }))).not.toContain("estimate");
  });
});

describe("otherCpus", () => {
  const base = makeCpu({ id: "base", name: "Base", perf_index: 50 });
  const near = makeCpu({ id: "near", name: "Near", perf_index: 52 });
  const far = makeCpu({ id: "far", name: "Far", perf_index: 90 });
  const otherSocket = makeCpu({ id: "x", name: "X", socket: "AM4", perf_index: 50 });

  it("keeps the same socket, drops the CPU itself, nearest index first", () => {
    expect(otherCpus([far, base, otherSocket, near], base).map((c) => c.id)).toEqual([
      "near",
      "far",
    ]);
  });

  it("prefers the higher index on a tie and caps the list", () => {
    const up = makeCpu({ id: "up", name: "Up", perf_index: 55 });
    const down = makeCpu({ id: "down", name: "Down", perf_index: 45 });
    expect(otherCpus([down, up, base], base).map((c) => c.id)).toEqual(["up", "down"]);
    const many = Array.from({ length: 10 }, (_, i) =>
      makeCpu({ id: `c${i}`, name: `C${i}`, perf_index: 10 + i }),
    );
    expect(otherCpus(many, base)).toHaveLength(6);
    expect(otherCpus(many, base, 3)).toHaveLength(3);
  });
});

describe("cpusBySocket", () => {
  it("puts the socket with the newest CPU first and the strongest CPU first inside", () => {
    const groups = cpusBySocket([
      makeCpu({ id: "a", name: "A", socket: "AM4", year: 2020, perf_index: 30 }),
      makeCpu({ id: "b", name: "B", socket: "AM5", year: 2024, perf_index: 60 }),
      makeCpu({ id: "c", name: "C", socket: "AM4", year: 2019, perf_index: 40 }),
    ]);
    expect(groups.map((g) => g.socket)).toEqual(["AM5", "AM4"]);
    expect(groups[1].cpus.map((c) => c.id)).toEqual(["c", "a"]);
  });
});
