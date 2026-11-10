import { describe, expect, it } from "vitest";
import type { Build, RuleId } from "./types";
import { RULE_IDS } from "./types";
import { checkCompatibility } from "./compatibility";
import {
  makeBuild,
  makeCpu,
  makeGpu,
  makeMotherboard,
  makePower,
  makePsu,
  makeRam,
} from "./test-fixtures";
import type { PowerEstimate } from "./types";

/** Issues of one rule for a build; the power estimate is always explicit. */
function run(rule: RuleId, build: Build, power: PowerEstimate = makePower()) {
  return checkCompatibility(build, power).filter((i) => i.rule === rule);
}

describe("default build", () => {
  it("has no issues", () => {
    expect(checkCompatibility(makeBuild(), makePower())).toEqual([]);
  });

  it("has no issues for an empty build", () => {
    expect(checkCompatibility({}, makePower())).toEqual([]);
  });
});

describe("cpu_socket", () => {
  it("errors on a different socket", () => {
    const issues = run(
      "cpu_socket",
      makeBuild({ motherboard: makeMotherboard({ socket: "AM4" }) }),
    );
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["cpu", "motherboard"] });
    expect(issues[0].message).toContain("Test CPU");
    expect(issues[0].message).toContain("AM5");
    expect(issues[0].message).toContain("AM4");
  });

  it("is silent on the same socket", () => {
    expect(run("cpu_socket", makeBuild())).toEqual([]);
  });

  it("is silent without a cpu or a board", () => {
    const board = makeMotherboard({ socket: "AM4" });
    expect(run("cpu_socket", makeBuild({ cpu: undefined, motherboard: board }))).toEqual([]);
    expect(run("cpu_socket", makeBuild({ motherboard: undefined }))).toEqual([]);
  });
});

describe("cpu_generation", () => {
  const gen = "ryzen-9000" as const;

  it("warns when the generation needs a BIOS update", () => {
    const board = makeMotherboard({
      cpu_support: [{ cpu_generation: gen, needs_bios_update: true }],
    });
    const issues = run("cpu_generation", makeBuild({ motherboard: board }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["cpu", "motherboard"] });
    expect(issues[0].message).toContain("BIOS update");
  });

  it("errors when no entry matches", () => {
    const board = makeMotherboard({
      cpu_support: [{ cpu_generation: "ryzen-7000", needs_bios_update: false }],
    });
    const issues = run("cpu_generation", makeBuild({ motherboard: board }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["cpu", "motherboard"] });
  });

  it("lets a cpu_id entry override a generation entry that is fine (-> warning)", () => {
    const board = makeMotherboard({
      cpu_support: [
        { cpu_generation: gen, needs_bios_update: false },
        { cpu_id: "test-cpu", needs_bios_update: true },
      ],
    });
    const issues = run("cpu_generation", makeBuild({ motherboard: board }));
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("lets a cpu_id entry override a generation entry that needs an update (-> silent)", () => {
    const board = makeMotherboard({
      cpu_support: [
        { cpu_id: "test-cpu", needs_bios_update: false },
        { cpu_generation: gen, needs_bios_update: true },
      ],
    });
    expect(run("cpu_generation", makeBuild({ motherboard: board }))).toEqual([]);
  });

  it("is silent when the generation is supported without an update", () => {
    expect(run("cpu_generation", makeBuild())).toEqual([]);
  });

  it("is skipped when sockets differ", () => {
    const board = makeMotherboard({ socket: "AM4", cpu_support: [] });
    const all = checkCompatibility(makeBuild({ motherboard: board }), makePower());
    expect(all.filter((i) => i.rule === "cpu_generation")).toEqual([]);
    expect(all.filter((i) => i.rule === "cpu_socket")).toHaveLength(1);
  });

  it("is silent when a part is missing", () => {
    const board = makeMotherboard({ cpu_support: [] });
    expect(run("cpu_generation", makeBuild({ cpu: undefined, motherboard: board }))).toEqual([]);
    expect(run("cpu_generation", makeBuild({ motherboard: undefined }))).toEqual([]);
  });
});

describe("ram_type", () => {
  it("errors on a board mismatch only", () => {
    const build = makeBuild({
      cpu: makeCpu({ mem_types: ["DDR4", "DDR5"] }),
      ram: makeRam({ type: "DDR4" }),
    });
    const issues = run("ram_type", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["ram", "motherboard"] });
    expect(issues[0].message).toContain("DDR4");
  });

  it("errors on a CPU mismatch only (no board selected)", () => {
    const build = makeBuild({ motherboard: undefined, ram: makeRam({ type: "DDR4" }) });
    const issues = run("ram_type", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["cpu", "ram"] });
    expect(issues[0].message).toContain("Test CPU");
  });

  it("fires both when both mismatch", () => {
    const issues = run("ram_type", makeBuild({ ram: makeRam({ type: "DDR4" }) }));
    expect(issues.map((i) => i.slots)).toEqual([
      ["ram", "motherboard"],
      ["cpu", "ram"],
    ]);
  });

  it("is silent when types match, or the other part is missing", () => {
    expect(run("ram_type", makeBuild())).toEqual([]);
    expect(run("ram_type", makeBuild({ cpu: undefined, motherboard: undefined }))).toEqual([]);
    expect(run("ram_type", makeBuild({ ram: undefined }))).toEqual([]);
  });
});

describe("ram_sticks", () => {
  it("errors above the slot count", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({ ram_slots: 2 }),
      ram: makeRam({ sticks: 4 }),
    });
    const issues = run("ram_sticks", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["ram", "motherboard"] });
  });

  it("is silent at exactly the slot count", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({ ram_slots: 2 }),
      ram: makeRam({ sticks: 2 }),
    });
    expect(run("ram_sticks", build)).toEqual([]);
  });

  it("is silent without ram or board", () => {
    expect(run("ram_sticks", makeBuild({ ram: undefined }))).toEqual([]);
    expect(run("ram_sticks", makeBuild({ motherboard: undefined }))).toEqual([]);
  });
});

describe("ram_capacity", () => {
  it("errors above the board maximum", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({ max_mem_gb: 64 }),
      ram: makeRam({ capacity_gb: 96 }),
    });
    const issues = run("ram_capacity", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["ram", "motherboard"] });
    expect(issues[0].message).toContain("64 GB");
  });

  it("is silent at exactly the maximum", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({ max_mem_gb: 64 }),
      ram: makeRam({ capacity_gb: 64 }),
    });
    expect(run("ram_capacity", build)).toEqual([]);
  });

  it("is silent without ram or board", () => {
    expect(run("ram_capacity", makeBuild({ ram: undefined }))).toEqual([]);
    expect(run("ram_capacity", makeBuild({ motherboard: undefined }))).toEqual([]);
  });
});

describe("ram_speed", () => {
  const ram7200 = makeRam({ speed_mts: 7200 });

  it("warns when over the board limit", () => {
    const build = makeBuild({
      ram: ram7200,
      cpu: makeCpu({ max_mem_speed: { DDR5: 8000 } }),
      motherboard: makeMotherboard({ max_mem_speed: 6400 }),
    });
    const issues = run("ram_speed", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["ram", "motherboard"] });
    expect(issues[0].message).toContain("6400");
  });

  it("gives an info note when only over the CPU's official speed", () => {
    const build = makeBuild({
      ram: ram7200,
      cpu: makeCpu({ max_mem_speed: { DDR5: 5600 } }),
      motherboard: makeMotherboard({ max_mem_speed: 8000 }),
    });
    const issues = run("ram_speed", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "info", slots: ["ram", "cpu"] });
    expect(issues[0].message).toContain("5600");
    expect(issues[0].message).toContain("Test CPU");
  });

  it("gives the CPU info note without a motherboard", () => {
    const build = makeBuild({
      ram: ram7200,
      cpu: makeCpu({ max_mem_speed: { DDR5: 5600 } }),
      motherboard: undefined,
    });
    expect(run("ram_speed", build)[0]).toMatchObject({ severity: "info", slots: ["ram", "cpu"] });
  });

  it("gives only the board warning when over both", () => {
    const build = makeBuild({
      ram: ram7200,
      cpu: makeCpu({ max_mem_speed: { DDR5: 5600 } }),
      motherboard: makeMotherboard({ max_mem_speed: 6400 }),
    });
    const issues = run("ram_speed", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["ram", "motherboard"] });
    expect(issues[0].message).toContain("6400");
  });

  it("ignores a CPU with no entry for the RAM type", () => {
    const build = makeBuild({
      ram: ram7200,
      cpu: makeCpu({ max_mem_speed: {} }),
      motherboard: makeMotherboard({ max_mem_speed: 8000 }),
    });
    expect(run("ram_speed", build)).toEqual([]);
  });

  it("is silent exactly at both limits", () => {
    const build = makeBuild({
      ram: makeRam({ speed_mts: 6000 }),
      cpu: makeCpu({ max_mem_speed: { DDR5: 6000 } }),
      motherboard: makeMotherboard({ max_mem_speed: 6000 }),
    });
    expect(run("ram_speed", build)).toEqual([]);
  });

  it("is silent without RAM, and with RAM alone", () => {
    expect(run("ram_speed", makeBuild({ ram: undefined }))).toEqual([]);
    expect(run("ram_speed", { ram: ram7200 })).toEqual([]);
  });
});

describe("display_output", () => {
  const noIgpu = makeCpu({ igpu: false });

  it("errors with no GPU and no integrated graphics", () => {
    const issues = run("display_output", makeBuild({ cpu: noIgpu, gpu: undefined }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["cpu", "gpu"] });
    expect(issues[0].message).toContain("Test CPU");
  });

  it("is silent with no GPU but integrated graphics", () => {
    expect(run("display_output", makeBuild({ gpu: undefined }))).toEqual([]);
  });

  it("is silent when a GPU is present", () => {
    expect(run("display_output", makeBuild({ cpu: noIgpu }))).toEqual([]);
  });

  it("is silent with no CPU", () => {
    expect(run("display_output", makeBuild({ cpu: undefined, gpu: undefined }))).toEqual([]);
  });
});

describe("psu_wattage", () => {
  const power = makePower({ peakW: 535, recommendedPsuW: 700 });

  it("errors below the estimated peak", () => {
    const issues = run("psu_wattage", makeBuild({ psu: makePsu({ watts: 534 }) }), power);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["psu"] });
    expect(issues[0].message).toContain("534");
    expect(issues[0].message).toContain("535");
    expect(issues[0].message).toContain("700");
  });

  it("warns when equal to the peak but below recommended", () => {
    const issues = run("psu_wattage", makeBuild({ psu: makePsu({ watts: 535 }) }), power);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["psu"] });
  });

  it("warns just below recommended", () => {
    const issues = run("psu_wattage", makeBuild({ psu: makePsu({ watts: 699 }) }), power);
    expect(issues[0].severity).toBe("warning");
  });

  it("is silent when equal to recommended", () => {
    expect(run("psu_wattage", makeBuild({ psu: makePsu({ watts: 700 }) }), power)).toEqual([]);
  });

  it("is silent without a psu", () => {
    expect(run("psu_wattage", makeBuild({ psu: undefined }), power)).toEqual([]);
  });

  it("is silent when the PSU has neither a CPU nor a GPU", () => {
    const build: Build = { psu: makePsu({ watts: 100 }) };
    expect(run("psu_wattage", build, power)).toEqual([]);
  });

  it("runs with only a CPU, or only a GPU", () => {
    const psu = makePsu({ watts: 100 });
    expect(run("psu_wattage", { psu, cpu: makeCpu() }, power)).toHaveLength(1);
    expect(run("psu_wattage", { psu, gpu: makeGpu() }, power)).toHaveLength(1);
  });
});

describe("gpu_power_connectors", () => {
  it("is silent for a native 12V-2x6 connection", () => {
    expect(run("gpu_power_connectors", makeBuild())).toEqual([]);
  });

  it("warns when an adapter is needed and the PSU has enough 8-pin plugs", () => {
    const build = makeBuild({
      gpu: makeGpu({ conn_12v2x6: 1, power_w: 300 }),
      psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 2 }),
    });
    const issues = run("gpu_power_connectors", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["gpu", "psu"] });
    expect(issues[0].message).toContain("adapter");
  });

  it("errors when an adapter is needed and the PSU has too few 8-pin plugs", () => {
    const build = makeBuild({
      gpu: makeGpu({ conn_12v2x6: 1, power_w: 300 }),
      psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 1 }),
    });
    const issues = run("gpu_power_connectors", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["gpu", "psu"] });
  });

  it("clamps the adapter plugs up to the minimum (100 W board needs 2)", () => {
    const gpu = makeGpu({ conn_12v2x6: 1, power_w: 100 });
    const ok = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 2 }) });
    const bad = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 1 }) });
    expect(run("gpu_power_connectors", ok)[0].severity).toBe("warning");
    expect(run("gpu_power_connectors", bad)[0].severity).toBe("error");
  });

  it("clamps the adapter plugs down to the maximum (600 W board needs 4)", () => {
    const gpu = makeGpu({ conn_12v2x6: 1, power_w: 600 });
    const ok = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 4 }) });
    const bad = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 3 }) });
    expect(run("gpu_power_connectors", ok)[0].severity).toBe("warning");
    expect(run("gpu_power_connectors", bad)[0].severity).toBe("error");
  });

  it("scales between the clamps (450 W board needs 3)", () => {
    const gpu = makeGpu({ conn_12v2x6: 1, power_w: 450 });
    const ok = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 3 }) });
    const bad = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 2 }) });
    expect(run("gpu_power_connectors", ok)[0].severity).toBe("warning");
    expect(run("gpu_power_connectors", bad)[0].severity).toBe("error");
  });

  it("accepts a plain 8-pin card with enough PSU plugs", () => {
    const build = makeBuild({
      gpu: makeGpu({ conn_8pin: 2, conn_12v2x6: 0 }),
      psu: makePsu({ pcie_8pin_count: 2 }),
    });
    expect(run("gpu_power_connectors", build)).toEqual([]);
  });

  it("errors for a plain 8-pin card with too few PSU plugs", () => {
    const build = makeBuild({
      gpu: makeGpu({ conn_8pin: 3, conn_12v2x6: 0 }),
      psu: makePsu({ pcie_8pin_count: 2 }),
    });
    const issues = run("gpu_power_connectors", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["gpu", "psu"] });
    expect(issues[0].message).toContain("3");
  });

  it("adds adapter plugs to the card's own 8-pin count", () => {
    const gpu = makeGpu({ conn_8pin: 1, conn_12v2x6: 1, power_w: 300 });
    const ok = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 3 }) });
    const bad = makeBuild({ gpu, psu: makePsu({ conn_12v2x6_count: 0, pcie_8pin_count: 2 }) });
    expect(run("gpu_power_connectors", ok)[0].severity).toBe("warning");
    expect(run("gpu_power_connectors", bad)[0].severity).toBe("error");
  });

  it("is silent without a gpu or a psu", () => {
    expect(run("gpu_power_connectors", makeBuild({ gpu: undefined }))).toEqual([]);
    expect(run("gpu_power_connectors", makeBuild({ psu: undefined }))).toEqual([]);
  });
});

describe("cpu_power_connectors", () => {
  it("warns with fewer EPS connectors than required", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({ eps_required: 2 }),
      psu: makePsu({ eps_count: 1 }),
    });
    const issues = run("cpu_power_connectors", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["motherboard", "psu"] });
  });

  it("is silent when equal", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({ eps_required: 2 }),
      psu: makePsu({ eps_count: 2 }),
    });
    expect(run("cpu_power_connectors", build)).toEqual([]);
  });

  it("is silent without a board or a psu", () => {
    const low = {
      motherboard: makeMotherboard({ eps_required: 2 }),
      psu: makePsu({ eps_count: 0 }),
    };
    expect(run("cpu_power_connectors", makeBuild({ ...low, motherboard: undefined }))).toEqual([]);
    expect(run("cpu_power_connectors", makeBuild({ ...low, psu: undefined }))).toEqual([]);
  });
});

describe("pcie_generation", () => {
  it("warns for a gen-4 x8 chip on a gen-3 board", () => {
    const build = makeBuild({
      gpu: makeGpu({}, { pcie_gen: 4, pcie_lanes: 8 }),
      motherboard: makeMotherboard({ pcie_gen: 3 }),
    });
    const issues = run("pcie_generation", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "warning", slots: ["gpu", "motherboard"] });
  });

  it("is info for a gen-4 x16 chip on a gen-3 board", () => {
    const build = makeBuild({
      gpu: makeGpu({}, { pcie_gen: 4, pcie_lanes: 16 }),
      motherboard: makeMotherboard({ pcie_gen: 3 }),
    });
    const issues = run("pcie_generation", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "info", slots: ["gpu", "motherboard"] });
  });

  it("is info for a gen-5 x8 chip on a gen-4 board", () => {
    const build = makeBuild({
      gpu: makeGpu({}, { pcie_gen: 5, pcie_lanes: 8 }),
      motherboard: makeMotherboard({ pcie_gen: 4 }),
    });
    expect(run("pcie_generation", build)[0].severity).toBe("info");
  });

  it("is silent when generations are equal", () => {
    const build = makeBuild({
      gpu: makeGpu({}, { pcie_gen: 4, pcie_lanes: 8 }),
      motherboard: makeMotherboard({ pcie_gen: 4 }),
    });
    expect(run("pcie_generation", build)).toEqual([]);
  });

  it("is silent when the card is older than the slot", () => {
    const build = makeBuild({ gpu: makeGpu({}, { pcie_gen: 3, pcie_lanes: 8 }) });
    expect(run("pcie_generation", build)).toEqual([]);
  });

  it("lets a CPU with a lower pcie_gen lower the slot generation", () => {
    const build = makeBuild({
      cpu: makeCpu({ pcie_gen: 3 }),
      gpu: makeGpu({}, { pcie_gen: 4, pcie_lanes: 8 }),
      motherboard: makeMotherboard({ pcie_gen: 5 }),
    });
    expect(run("pcie_generation", build)[0].severity).toBe("warning");
  });

  it("uses the board alone without a CPU", () => {
    const build = makeBuild({
      cpu: undefined,
      gpu: makeGpu({}, { pcie_gen: 4, pcie_lanes: 8 }),
      motherboard: makeMotherboard({ pcie_gen: 3 }),
    });
    expect(run("pcie_generation", build)[0].severity).toBe("warning");
  });

  it("is silent without a gpu or a board", () => {
    expect(run("pcie_generation", makeBuild({ gpu: undefined }))).toEqual([]);
    expect(run("pcie_generation", makeBuild({ motherboard: undefined }))).toEqual([]);
  });
});

describe("ordering", () => {
  it("returns errors, then warnings, then info", () => {
    const build = makeBuild({
      // info: gen-4 x16 chip on a gen-3 board (rule 11)
      gpu: makeGpu({}, { pcie_gen: 4, pcie_lanes: 16 }),
      // warning: EPS (rule 10); error: sticks (rule 4)
      motherboard: makeMotherboard({ pcie_gen: 3, eps_required: 2, ram_slots: 1 }),
      psu: makePsu({ eps_count: 1 }),
    });
    const issues = checkCompatibility(build, makePower());
    expect(issues.map((i) => [i.rule, i.severity])).toEqual([
      ["ram_sticks", "error"],
      ["cpu_power_connectors", "warning"],
      ["pcie_generation", "info"],
    ]);
  });

  it("puts a later-rule error before an earlier-rule warning", () => {
    const build = makeBuild({
      motherboard: makeMotherboard({
        cpu_support: [{ cpu_generation: "ryzen-9000", needs_bios_update: true }],
      }),
      psu: makePsu({ watts: 100 }),
    });
    const issues = checkCompatibility(build, makePower());
    expect(issues.map((i) => [i.rule, i.severity])).toEqual([
      ["psu_wattage", "error"],
      ["cpu_generation", "warning"],
    ]);
  });

  it("keeps RULE_IDS order within a severity", () => {
    const build = makeBuild({
      cpu: makeCpu({ igpu: false }),
      gpu: undefined,
      motherboard: makeMotherboard({ ram_slots: 1, max_mem_gb: 16 }),
      psu: makePsu({ watts: 100 }),
    });
    const errors = checkCompatibility(build, makePower()).filter((i) => i.severity === "error");
    const rules = errors.map((i) => i.rule);
    expect(rules).toEqual(["ram_sticks", "ram_capacity", "display_output", "psu_wattage"]);
    const positions = rules.map((r) => RULE_IDS.indexOf(r));
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe("gpu_power_connectors: 6-pin", () => {
  const card = (conn_6pin: number, conn_8pin: number) =>
    makeGpu({ conn_6pin, conn_8pin, conn_12v2x6: 0 });

  it("feeds a 6-pin socket from a 6-pin-only plug", () => {
    const build = makeBuild({
      gpu: card(1, 0),
      psu: makePsu({ pcie_6pin_count: 1, pcie_8pin_count: 0 }),
    });
    expect(run("gpu_power_connectors", build)).toEqual([]);
  });

  it("feeds a 6-pin socket from a spare 8-pin (6+2) plug", () => {
    const build = makeBuild({
      gpu: card(1, 1),
      psu: makePsu({ pcie_6pin_count: 0, pcie_8pin_count: 2 }),
    });
    expect(run("gpu_power_connectors", build)).toEqual([]);
  });

  it("errors when 6-pin and 8-pin sockets together need more plugs than the PSU has", () => {
    const build = makeBuild({
      gpu: card(1, 2),
      psu: makePsu({ pcie_6pin_count: 0, pcie_8pin_count: 2 }),
    });
    const issues = run("gpu_power_connectors", build);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", slots: ["gpu", "psu"] });
  });

  it("does not let a 6-pin-only plug feed an 8-pin socket", () => {
    const build = makeBuild({
      gpu: card(0, 1),
      psu: makePsu({ pcie_6pin_count: 2, pcie_8pin_count: 0 }),
    });
    expect(run("gpu_power_connectors", build)[0]?.severity).toBe("error");
  });

  it("uses 6-pin-only plugs first and 8-pin plugs for the rest", () => {
    const build = makeBuild({
      gpu: card(2, 0),
      psu: makePsu({ pcie_6pin_count: 1, pcie_8pin_count: 1 }),
    });
    expect(run("gpu_power_connectors", build)).toEqual([]);
  });
});
