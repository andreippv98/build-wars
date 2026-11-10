import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "./config";
import { scoreBuild } from "./score";
import { makeBuild, makeCpu, makeGpu, makePsu, makeRam, makeMotherboard } from "./test-fixtures";
import type { Build } from "./types";

const CFG = ENGINE_CONFIG.score;

/** A build whose GPU and CPU both have index `x`, with R = 1: the score then equals `x`. */
function evenBuild(x: number): Build {
  return makeBuild({ cpu: makeCpu({ perf_index: x }), gpu: makeGpu({}, { perf_index: x }) });
}

describe("reference build", () => {
  it("scores exactly 100 and is Enthusiast", () => {
    const r = scoreBuild(makeBuild());
    expect(r.score).toBe(100);
    expect(r.displayScore).toBe(100);
    expect(r.band?.label).toBe("Enthusiast");
    expect(r.gpuIndex).toBe(100);
    expect(r.cpuIndex).toBe(100);
    expect(r.ramFactor).toBe(1);
    expect(r.missing).toEqual([]);
  });
});

describe("weighted geometric mean", () => {
  it("scores 76.0 for G = 100, C = 40, R = 1", () => {
    // 100^0.7 = 25.119, 40^0.3 = 3.0237, product = 75.95... -> 76.0 (plan: about 76)
    const r = scoreBuild(makeBuild({ cpu: makeCpu({ perf_index: 40 }) }));
    expect(r.score).toBe(76.0);
    expect(r.displayScore).toBe(76);
  });

  it("matches the formula built from config weights", () => {
    const r = scoreBuild(
      makeBuild({ cpu: makeCpu({ perf_index: 55 }), gpu: makeGpu({}, { perf_index: 70 }) }),
    );
    const raw = 70 ** CFG.gpuWeight * 55 ** CFG.cpuWeight;
    expect(r.score).toBe(Math.round(raw * 10) / 10);
  });

  it("allows a score above 100", () => {
    const r = scoreBuild(makeBuild({ gpu: makeGpu({}, { perf_index: 120 }) }));
    expect(r.score).toBeGreaterThan(100);
    expect(r.score).toBe(Math.round(120 ** CFG.gpuWeight * 100 ** CFG.cpuWeight * 10) / 10);
    expect(r.band?.label).toBe("Enthusiast");
  });
});

describe("GPU board factor", () => {
  const { sensitivity, min, max } = CFG.boardFactor;
  const gpuIndexFor = (boost: number) =>
    scoreBuild(makeBuild({ gpu: makeGpu({ boost_mhz: boost }, { ref_boost_mhz: 2000 }) })).gpuIndex;

  it("is 1 at the reference clock", () => {
    expect(gpuIndexFor(2000)).toBe(100);
  });

  it("is 1.02 at +4% clock", () => {
    expect(gpuIndexFor(2080)).toBeCloseTo(100 * (1 + sensitivity * 0.04), 10);
    expect(gpuIndexFor(2080)).toBeCloseTo(102, 10);
  });

  it("clamps at the maximum", () => {
    expect(gpuIndexFor(2400)).toBeCloseTo(100 * max, 10);
  });

  it("clamps at the minimum", () => {
    expect(gpuIndexFor(1800)).toBeCloseTo(100 * min, 10);
  });

  it("does not round gpuIndex", () => {
    const g = scoreBuild(
      makeBuild({ gpu: makeGpu({ boost_mhz: 2033 }, { perf_index: 87.3 }) }),
    ).gpuIndex;
    expect(g).toBeCloseTo(87.3 * (1 + sensitivity * (2033 / 2000 - 1)), 10);
    expect(Number.isInteger((g ?? 0) * 10)).toBe(false);
  });
});

describe("RAM capacity factor", () => {
  const factorFor = (gb: number) =>
    scoreBuild(makeBuild({ ram: makeRam({ capacity_gb: gb }) })).ramFactor;

  it("8 GB uses the lowest tier", () => expect(factorFor(8)).toBe(0.85));
  it("16 GB uses the 16 tier", () => expect(factorFor(16)).toBe(0.96));
  it("24 GB falls in the 16 tier", () => expect(factorFor(24)).toBe(0.96));
  it("32 GB is 1", () => expect(factorFor(32)).toBe(1));
  it("64 GB is 1", () => expect(factorFor(64)).toBe(1));
  it("matches config tiers", () => {
    expect(factorFor(8)).toBe(CFG.ramCapacity[2].factor);
    expect(factorFor(16)).toBe(CFG.ramCapacity[1].factor);
  });
});

describe("RAM speed factor", () => {
  const { sensitivity, min, max } = CFG.ramSpeed;
  const factorFor = (type: "DDR4" | "DDR5", speed: number) =>
    scoreBuild(makeBuild({ ram: makeRam({ type, speed_mts: speed }) })).ramFactor;

  it("is 1 at the typical speed for DDR4 and DDR5", () => {
    expect(factorFor("DDR4", 3200)).toBe(1);
    expect(factorFor("DDR5", 6000)).toBe(1);
  });

  it("is above 1 when faster, inside the clamp", () => {
    expect(factorFor("DDR5", 6400)).toBeCloseTo(1 + sensitivity * (6400 / 6000 - 1), 10);
    expect(factorFor("DDR5", 6400)).toBeGreaterThan(1);
  });

  it("is below 1 when slower, inside the clamp", () => {
    expect(factorFor("DDR4", 3000)).toBeCloseTo(1 + sensitivity * (3000 / 3200 - 1), 10);
    expect(factorFor("DDR4", 3000)).toBeLessThan(1);
  });

  it("clamps at the maximum", () => expect(factorFor("DDR5", 12000)).toBeCloseTo(max, 10));
  it("clamps at the minimum", () => expect(factorFor("DDR5", 3000)).toBeCloseTo(min, 10));

  it("uses the kit's own speed even when the board and CPU max are lower", () => {
    const r = scoreBuild(
      makeBuild({
        ram: makeRam({ speed_mts: 6400 }),
        cpu: makeCpu({ max_mem_speed: { DDR5: 5200 } }),
        motherboard: makeMotherboard({ max_mem_speed: 5600 }),
      }),
    );
    expect(r.ramFactor).toBeCloseTo(1 + sensitivity * (6400 / 6000 - 1), 10);
  });

  it("multiplies with the capacity factor", () => {
    const r = scoreBuild(makeBuild({ ram: makeRam({ capacity_gb: 16, speed_mts: 6400 }) }));
    expect(r.ramFactor).toBeCloseTo(0.96 * (1 + sensitivity * (6400 / 6000 - 1)), 10);
  });
});

describe("motherboard and PSU", () => {
  it("do not change the score", () => {
    const base = scoreBuild(makeBuild({ motherboard: undefined, psu: undefined }));
    const full = scoreBuild(makeBuild());
    const other = scoreBuild(
      makeBuild({
        motherboard: makeMotherboard({ max_mem_gb: 64, form_factor: "mATX" }),
        psu: makePsu({ watts: 450 }),
      }),
    );
    expect(full).toEqual(base);
    expect(other).toEqual(base);
  });
});

describe("missing parts", () => {
  it("no cpu", () => {
    const r = scoreBuild(makeBuild({ cpu: undefined }));
    expect(r.score).toBeNull();
    expect(r.displayScore).toBeNull();
    expect(r.band).toBeNull();
    expect(r.missing).toEqual(["cpu"]);
    expect(r.cpuIndex).toBeNull();
    expect(r.gpuIndex).toBe(100);
    expect(r.ramFactor).toBe(1);
  });

  it("no gpu", () => {
    const r = scoreBuild(makeBuild({ gpu: undefined }));
    expect(r.score).toBeNull();
    expect(r.displayScore).toBeNull();
    expect(r.band).toBeNull();
    expect(r.missing).toEqual(["gpu"]);
    expect(r.gpuIndex).toBeNull();
    expect(r.cpuIndex).toBe(100);
    expect(r.ramFactor).toBe(1);
  });

  it("no ram", () => {
    const r = scoreBuild(makeBuild({ ram: undefined }));
    expect(r.score).toBeNull();
    expect(r.displayScore).toBeNull();
    expect(r.band).toBeNull();
    expect(r.missing).toEqual(["ram"]);
    expect(r.ramFactor).toBeNull();
    expect(r.gpuIndex).toBe(100);
    expect(r.cpuIndex).toBe(100);
  });

  it("lists several missing parts in the order cpu, gpu, ram", () => {
    expect(scoreBuild(makeBuild({ cpu: undefined, ram: undefined })).missing).toEqual([
      "cpu",
      "ram",
    ]);
    expect(scoreBuild(makeBuild({ gpu: undefined, ram: undefined })).missing).toEqual([
      "gpu",
      "ram",
    ]);
  });

  it("handles an empty build", () => {
    const r = scoreBuild({});
    expect(r).toEqual({
      score: null,
      displayScore: null,
      band: null,
      gpuIndex: null,
      cpuIndex: null,
      ramFactor: null,
      isEstimate: false,
      missing: ["cpu", "gpu", "ram"],
    });
  });
});

describe("rounding and bands", () => {
  it("rounds score to one decimal", () => {
    const r = scoreBuild(makeBuild({ cpu: makeCpu({ perf_index: 37 }) }));
    const raw = 100 ** CFG.gpuWeight * 37 ** CFG.cpuWeight;
    expect(r.score).toBe(Math.round(raw * 10) / 10);
    expect(Number.isInteger((r.score ?? 0) * 10)).toBe(true);
  });

  it("displays 84.5 as 85 in the Enthusiast band", () => {
    // Pick C so that 100^0.7 x C^0.3 = 84.5.
    const c = (84.5 / 100 ** CFG.gpuWeight) ** (1 / CFG.cpuWeight);
    const r = scoreBuild(makeBuild({ cpu: makeCpu({ perf_index: c }) }));
    expect(r.score).toBe(84.5);
    expect(r.displayScore).toBe(85);
    expect(r.band?.label).toBe("Enthusiast");
  });

  it("displays 84.4 as 84 in the High-end band", () => {
    const c = (84.4 / 100 ** CFG.gpuWeight) ** (1 / CFG.cpuWeight);
    const r = scoreBuild(makeBuild({ cpu: makeCpu({ perf_index: c }) }));
    expect(r.score).toBe(84.4);
    expect(r.displayScore).toBe(84);
    expect(r.band?.label).toBe("High-end");
  });

  it.each([
    [85, "Enthusiast"],
    [84.4, "High-end"],
    [65, "High-end"],
    [64.4, "Mid-range"],
    [45, "Mid-range"],
    [44.4, "Entry"],
    [25, "Entry"],
    [24.4, "Basic"],
    [10, "Basic"],
  ])("score %s is in band %s", (x, label) => {
    const r = scoreBuild(evenBuild(x));
    expect(r.score).toBe(x);
    expect(r.band?.label).toBe(label);
  });

  it("uses band minimums from config", () => {
    expect(CFG.bands.map((b) => b.min)).toEqual([85, 65, 45, 25, 0]);
  });
});

describe("isEstimate", () => {
  const verifiedCpu = makeCpu({ perf_index_verified: true });
  const verifiedGpu = makeGpu({}, { perf_index_verified: true });

  it("is true when the cpu is unverified", () => {
    expect(
      scoreBuild(makeBuild({ cpu: makeCpu({ perf_index_verified: false }), gpu: verifiedGpu }))
        .isEstimate,
    ).toBe(true);
  });

  it("is true when the gpu chip is unverified", () => {
    expect(
      scoreBuild(makeBuild({ cpu: verifiedCpu, gpu: makeGpu({}, { perf_index_verified: false }) }))
        .isEstimate,
    ).toBe(true);
  });

  it("is true when specs are verified but the index is not", () => {
    const cpu = makeCpu({ verified: true, perf_index_verified: false });
    expect(scoreBuild(makeBuild({ cpu, gpu: verifiedGpu })).isEstimate).toBe(true);
  });

  it("is false when both are verified", () => {
    expect(scoreBuild(makeBuild({ cpu: verifiedCpu, gpu: verifiedGpu })).isEstimate).toBe(false);
  });

  it("ignores RAM and board verification", () => {
    const r = scoreBuild(
      makeBuild({
        cpu: verifiedCpu,
        gpu: makeGpu({ verified: false }, { perf_index_verified: true, verified: false }),
        ram: makeRam({ verified: false }),
      }),
    );
    expect(r.isEstimate).toBe(false);
  });

  it("applies to a partial build", () => {
    expect(scoreBuild({ cpu: makeCpu({ perf_index_verified: false }) }).isEstimate).toBe(true);
  });
});
