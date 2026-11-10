import { describe, expect, it } from "vitest";
import { ENGINE_CONFIG } from "./config";
import { estimatePower } from "./power";
import { makeBuild, makeCpu, makeGpu, makePsu, makeRam, makeMotherboard } from "./test-fixtures";

const cfg = ENGINE_CONFIG.power;

/** A build with only a GPU whose board draws `boardW`: peak = boardW + storageAndFansW. */
function gpuOnly(boardW: number, chip: Parameters<typeof makeGpu>[1] = {}) {
  return { gpu: makeGpu({ power_w: boardW }, chip) };
}

describe("empty build", () => {
  it("returns zeros, the normal multiplier and no headroom", () => {
    expect(estimatePower({})).toEqual({
      gpuW: 0,
      cpuW: 0,
      baselineW: 0,
      peakW: 0,
      multiplier: cfg.psuMultiplier,
      recommendedPsuW: 0,
      headroom: null,
    });
  });
});

describe("worked example with the default config values", () => {
  it("matches the hand-computed numbers", () => {
    // GPU 300 + CPU 160 (below the 200 cap) = 460
    // baseline = 40 (board) + 2 sticks x 5 + 25 (storage and fans) = 75
    // peak = 460 + 75 = 535; ATX 3.x PSU, non-spiky GPU -> x 1.3 = 695.5 -> up to 700
    // PSU 1000 W >= 700 -> green, spare = 1000 - 535 = 465
    expect(estimatePower(makeBuild())).toEqual({
      gpuW: 300,
      cpuW: 160,
      baselineW: 75,
      peakW: 535,
      multiplier: 1.3,
      recommendedPsuW: 700,
      headroom: { status: "green", psuW: 1000, spareW: 465 },
    });
  });
});

describe("gpuW", () => {
  it("uses the board model's power_w, not the chip's reference power", () => {
    const gpu = makeGpu({ power_w: 345 }, { ref_power_w: 250 });
    expect(estimatePower({ gpu }).gpuW).toBe(345);
  });
});

describe("cpuW", () => {
  it("is ppt_w below the gaming cap", () => {
    const cpu = makeCpu({ ppt_w: cfg.cpuGamingCapW - 1 });
    expect(estimatePower({ cpu }).cpuW).toBe(cfg.cpuGamingCapW - 1);
  });

  it("equals the cap when ppt_w is exactly the cap", () => {
    const cpu = makeCpu({ ppt_w: cfg.cpuGamingCapW });
    expect(estimatePower({ cpu }).cpuW).toBe(cfg.cpuGamingCapW);
  });

  it("is capped when ppt_w exceeds the cap", () => {
    const cpu = makeCpu({ ppt_w: cfg.cpuGamingCapW + 100 });
    expect(estimatePower({ cpu }).cpuW).toBe(cfg.cpuGamingCapW);
  });
});

describe("baselineW", () => {
  it("adds the motherboard allowance only when a motherboard is selected", () => {
    const base = estimatePower({ cpu: makeCpu() }).baselineW;
    const withBoard = estimatePower({ cpu: makeCpu(), motherboard: makeMotherboard() }).baselineW;
    expect(base).toBe(cfg.storageAndFansW);
    expect(withBoard).toBe(cfg.storageAndFansW + cfg.motherboardW);
  });

  it.each([1, 2, 4])("adds the per-stick allowance for %i RAM stick(s)", (sticks) => {
    const { baselineW } = estimatePower({ ram: makeRam({ sticks }) });
    expect(baselineW).toBe(cfg.storageAndFansW + cfg.perRamStickW * sticks);
  });

  it.each([
    ["cpu", { cpu: makeCpu() }],
    ["gpu", { gpu: makeGpu() }],
    ["ram", { ram: makeRam() }],
    ["motherboard", { motherboard: makeMotherboard() }],
    ["psu", { psu: makePsu() }],
  ])("counts storage and fans when only the %s is selected", (_name, build) => {
    expect(estimatePower(build).baselineW).toBeGreaterThanOrEqual(cfg.storageAndFansW);
  });

  it("is exactly the storage and fans allowance for a PSU-only build", () => {
    const estimate = estimatePower({ psu: makePsu() });
    expect(estimate.baselineW).toBe(cfg.storageAndFansW);
    expect(estimate.peakW).toBe(cfg.storageAndFansW);
  });

  it("sums all three allowances for a full build", () => {
    const { baselineW } = estimatePower(makeBuild({ ram: makeRam({ sticks: 4 }) }));
    expect(baselineW).toBe(cfg.motherboardW + 4 * cfg.perRamStickW + cfg.storageAndFansW);
  });
});

describe("peakW", () => {
  it("is gpuW + cpuW + baselineW", () => {
    const e = estimatePower(makeBuild());
    expect(e.peakW).toBe(e.gpuW + e.cpuW + e.baselineW);
  });
});

describe("multiplier", () => {
  const spiky = { high_power_spikes: true };

  it("is the spiky multiplier for a spiky GPU with no PSU", () => {
    expect(estimatePower(gpuOnly(300, spiky)).multiplier).toBe(cfg.psuMultiplierSpiky);
  });

  it("is the spiky multiplier for a spiky GPU with a non-ATX 3.x PSU", () => {
    const build = { ...gpuOnly(300, spiky), psu: makePsu({ atx3: false }) };
    expect(estimatePower(build).multiplier).toBe(cfg.psuMultiplierSpiky);
  });

  it("is the normal multiplier for a spiky GPU with an ATX 3.x PSU", () => {
    const build = { ...gpuOnly(300, spiky), psu: makePsu({ atx3: true }) };
    expect(estimatePower(build).multiplier).toBe(cfg.psuMultiplier);
  });

  it("is the normal multiplier for a non-spiky GPU, with or without an ATX 3.x PSU", () => {
    const plain = { high_power_spikes: false };
    expect(estimatePower(gpuOnly(300, plain)).multiplier).toBe(cfg.psuMultiplier);
    const withOld = { ...gpuOnly(300, plain), psu: makePsu({ atx3: false }) };
    expect(estimatePower(withOld).multiplier).toBe(cfg.psuMultiplier);
  });

  it("applies the spiky multiplier to the recommended wattage", () => {
    const e = estimatePower(gpuOnly(300, spiky));
    const expected = Math.ceil((e.peakW * cfg.psuMultiplierSpiky) / cfg.psuRoundToW - 1e-9);
    expect(e.recommendedPsuW).toBe(expected * cfg.psuRoundToW);
  });
});

describe("recommendedPsuW rounding", () => {
  // Board power chosen so that peak = 500 (GPU only: boardW + storageAndFansW).
  const boardForPeak = (peak: number) => peak - cfg.storageAndFansW;

  it("does not bump an exact multiple up a step (peak 500 x 1.3 = 650)", () => {
    const e = estimatePower(gpuOnly(boardForPeak(500)));
    expect(e.peakW).toBe(500);
    // Literal check with today's config: 500 x 1.3 = 650.
    if (cfg.psuMultiplier === 1.3 && cfg.psuRoundToW === 50) {
      expect(e.recommendedPsuW).toBe(650);
    }
    expect(e.recommendedPsuW).toBe(
      Math.ceil(Math.round(500 * cfg.psuMultiplier * 1e6) / 1e6 / cfg.psuRoundToW) *
        cfg.psuRoundToW,
    );
  });

  it("goes up a step when one watt over an exact multiple", () => {
    const e = estimatePower(gpuOnly(boardForPeak(501)));
    expect(e.peakW).toBe(501);
    // 501 x 1.3 = 651.3 -> 700 (today's config)
    expect(e.recommendedPsuW).toBe(
      Math.ceil((501 * cfg.psuMultiplier) / cfg.psuRoundToW) * cfg.psuRoundToW,
    );
    expect(e.recommendedPsuW).toBeGreaterThan(
      estimatePower(gpuOnly(boardForPeak(500))).recommendedPsuW,
    );
  });

  it("is always a multiple of the rounding step", () => {
    const e = estimatePower(makeBuild());
    expect(e.recommendedPsuW % cfg.psuRoundToW).toBe(0);
  });
});

describe("headroom", () => {
  // GPU only, peak 500, recommended 650 with today's config; the PSU is added per test.
  const boardW = 500 - cfg.storageAndFansW;
  const base = estimatePower(gpuOnly(boardW));
  const withPsu = (watts: number) =>
    estimatePower({ ...gpuOnly(boardW), psu: makePsu({ watts, atx3: true }) });

  it("is green at exactly the recommended wattage", () => {
    const e = withPsu(base.recommendedPsuW);
    expect(e.headroom?.status).toBe("green");
  });

  it("is amber just below the recommended wattage", () => {
    expect(withPsu(base.recommendedPsuW - 1).headroom?.status).toBe("amber");
  });

  it("is amber at exactly the peak", () => {
    const e = withPsu(base.peakW);
    expect(e.headroom?.status).toBe("amber");
    expect(e.headroom?.spareW).toBe(0);
  });

  it("is red just below the peak with a negative spare", () => {
    const e = withPsu(base.peakW - 1);
    expect(e.headroom?.status).toBe("red");
    expect(e.headroom?.spareW).toBe(-1);
  });

  it("reports psuW and a positive spare when the PSU is above the peak", () => {
    const e = withPsu(base.peakW + 150);
    expect(e.headroom?.psuW).toBe(base.peakW + 150);
    expect(e.headroom?.spareW).toBe(150);
  });

  it("is null without a PSU", () => {
    expect(estimatePower(makeBuild({ psu: undefined })).headroom).toBeNull();
  });

  it("is null when the PSU is the only part", () => {
    expect(estimatePower({ psu: makePsu() }).headroom).toBeNull();
  });
});
