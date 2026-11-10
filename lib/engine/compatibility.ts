import type { Build, Issue, PowerEstimate, Severity } from "./types";
import { ENGINE_CONFIG } from "./config";
import { estimatePower } from "./power";

type Rule = (build: Build, power: PowerEstimate) => Issue[];

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

function boardName(m: { maker: string; model: string }): string {
  return `${m.maker} ${m.model}`;
}

function describeRam(ram: NonNullable<Build["ram"]>): string {
  const sticks = ram.sticks === 1 ? "stick" : "sticks";
  return `${ram.capacity_gb} GB ${ram.type}-${ram.speed_mts} (${ram.sticks} ${sticks})`;
}

const cpuSocket: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard || cpu.socket === motherboard.socket) return [];
  return [
    {
      rule: "cpu_socket",
      severity: "error",
      message: `The ${cpu.name} uses socket ${cpu.socket}, but the ${boardName(motherboard)} has socket ${motherboard.socket}. They don't fit together.`,
      slots: ["cpu", "motherboard"],
    },
  ];
};

const cpuGeneration: Rule = ({ cpu, motherboard }) => {
  if (!cpu || !motherboard || cpu.socket !== motherboard.socket) return [];
  const support =
    motherboard.cpu_support.find((s) => s.cpu_id === cpu.id) ??
    motherboard.cpu_support.find((s) => s.cpu_generation === cpu.generation);
  if (!support) {
    return [
      {
        rule: "cpu_generation",
        severity: "error",
        message: `The ${boardName(motherboard)} doesn't support the ${cpu.name}. Choose a different CPU or board.`,
        slots: ["cpu", "motherboard"],
      },
    ];
  }
  if (support.needs_bios_update) {
    return [
      {
        rule: "cpu_generation",
        severity: "warning",
        message: `The ${cpu.name} needs a BIOS update on the ${boardName(motherboard)} before it will start.`,
        slots: ["cpu", "motherboard"],
      },
    ];
  }
  return [];
};

const ramType: Rule = ({ cpu, ram, motherboard }) => {
  const issues: Issue[] = [];
  if (ram && motherboard && ram.type !== motherboard.mem_type) {
    issues.push({
      rule: "ram_type",
      severity: "error",
      message: `The ${describeRam(ram)} kit doesn't fit the ${boardName(motherboard)}, which takes ${motherboard.mem_type}. Choose ${motherboard.mem_type} memory.`,
      slots: ["ram", "motherboard"],
    });
  }
  if (ram && cpu && !cpu.mem_types.includes(ram.type)) {
    issues.push({
      rule: "ram_type",
      severity: "error",
      message: `The ${cpu.name} doesn't support ${ram.type} memory. It supports ${cpu.mem_types.join(" and ")}.`,
      slots: ["cpu", "ram"],
    });
  }
  return issues;
};

const ramSticks: Rule = ({ ram, motherboard }) => {
  if (!ram || !motherboard || ram.sticks <= motherboard.ram_slots) return [];
  return [
    {
      rule: "ram_sticks",
      severity: "error",
      message: `The ${describeRam(ram)} kit has ${ram.sticks} sticks, but the ${boardName(motherboard)} has only ${motherboard.ram_slots} memory slots.`,
      slots: ["ram", "motherboard"],
    },
  ];
};

const ramCapacity: Rule = ({ ram, motherboard }) => {
  if (!ram || !motherboard || ram.capacity_gb <= motherboard.max_mem_gb) return [];
  return [
    {
      rule: "ram_capacity",
      severity: "error",
      message: `The ${describeRam(ram)} kit is too large. The ${boardName(motherboard)} supports at most ${motherboard.max_mem_gb} GB.`,
      slots: ["ram", "motherboard"],
    },
  ];
};

const ramSpeed: Rule = ({ cpu, ram, motherboard }) => {
  if (!ram) return [];
  if (motherboard && ram.speed_mts > motherboard.max_mem_speed) {
    return [
      {
        rule: "ram_speed",
        severity: "warning",
        message: `This kit is ${ram.type}-${ram.speed_mts}, but the ${boardName(motherboard)} supports up to ${motherboard.max_mem_speed} MT/s. It will run at ${motherboard.max_mem_speed}.`,
        slots: ["ram", "motherboard"],
      },
    ];
  }
  const cpuLimit = cpu?.max_mem_speed[ram.type];
  if (cpu && cpuLimit !== undefined && ram.speed_mts > cpuLimit) {
    return [
      {
        rule: "ram_speed",
        severity: "info",
        message: `This kit is ${ram.type}-${ram.speed_mts}, above the ${cpu.name}'s official ${cpuLimit} MT/s. Turn on EXPO or XMP in the BIOS to run it at full speed.`,
        slots: ["ram", "cpu"],
      },
    ];
  }
  return [];
};
const displayOutput: Rule = ({ cpu, gpu }) => {
  if (!cpu || gpu || cpu.igpu) return [];
  return [
    {
      rule: "display_output",
      severity: "error",
      message: `The ${cpu.name} has no integrated graphics, so this build needs a graphics card to show a picture.`,
      slots: ["cpu", "gpu"],
    },
  ];
};

const psuWattage: Rule = ({ cpu, gpu, psu }, power) => {
  if (!psu || (!cpu && !gpu)) return [];
  const name = boardName(psu);
  if (psu.watts < power.peakW) {
    return [
      {
        rule: "psu_wattage",
        severity: "error",
        message: `The ${name} delivers ${psu.watts} W, below this build's estimated peak of ${power.peakW} W. Choose at least ${power.recommendedPsuW} W.`,
        slots: ["psu"],
      },
    ];
  }
  if (psu.watts < power.recommendedPsuW) {
    return [
      {
        rule: "psu_wattage",
        severity: "warning",
        message: `The ${name} delivers ${psu.watts} W. It can cover this build's estimated peak of ${power.peakW} W, but ${power.recommendedPsuW} W is recommended for headroom.`,
        slots: ["psu"],
      },
    ];
  }
  return [];
};

const gpuPowerConnectors: Rule = ({ gpu, psu }) => {
  if (!gpu || !psu) return [];
  const { board } = gpu;
  const { wattsPer8pin, adapterMin8pin, adapterMax8pin } = ENGINE_CONFIG.connectors;
  const adapters = Math.max(0, board.conn_12v2x6 - psu.conn_12v2x6_count);
  const perAdapter = Math.min(
    adapterMax8pin,
    Math.max(adapterMin8pin, Math.ceil(board.power_w / wattsPer8pin)),
  );
  const sixFrom8 = Math.max(0, board.conn_6pin - psu.pcie_6pin_count);
  const needed8pin = board.conn_8pin + adapters * perAdapter + sixFrom8;
  const gpuName = boardName(board);
  const psuName = boardName(psu);
  if (psu.pcie_8pin_count < needed8pin) {
    const via = adapters > 0 ? " (including the adapter for its 12V-2x6 connector)" : "";
    return [
      {
        rule: "gpu_power_connectors",
        severity: "error",
        message: `The ${gpuName} needs ${needed8pin} of the PSU's PCIe 8-pin (6+2) plugs${via}, but the ${psuName} has only ${psu.pcie_8pin_count}. Choose a PSU with more PCIe connectors.`,
        slots: ["gpu", "psu"],
      },
    ];
  }
  if (adapters > 0) {
    return [
      {
        rule: "gpu_power_connectors",
        severity: "warning",
        message: `The ${gpuName} uses a 12V-2x6 connector that the ${psuName} lacks. It will work with an adapter that uses ${perAdapter} of the PSU's PCIe 8-pin plugs.`,
        slots: ["gpu", "psu"],
      },
    ];
  }
  return [];
};

const cpuPowerConnectors: Rule = ({ motherboard, psu }) => {
  if (!motherboard || !psu || psu.eps_count >= motherboard.eps_required) return [];
  return [
    {
      rule: "cpu_power_connectors",
      severity: "warning",
      message: `The ${boardName(motherboard)} needs ${motherboard.eps_required} CPU power (EPS) connectors, but the ${boardName(psu)} has ${psu.eps_count}. Check that the board will run on fewer, or choose a PSU with more.`,
      slots: ["motherboard", "psu"],
    },
  ];
};

const pcieGeneration: Rule = ({ cpu, gpu, motherboard }) => {
  if (!gpu || !motherboard) return [];
  const slotGen = cpu ? Math.min(motherboard.pcie_gen, cpu.pcie_gen) : motherboard.pcie_gen;
  const { chip, board } = gpu;
  if (chip.pcie_gen <= slotGen) return [];
  const { laneLimitedMaxLanes, laneLimitedSlotGen } = ENGINE_CONFIG.pcie;
  const limited = chip.pcie_lanes <= laneLimitedMaxLanes && slotGen <= laneLimitedSlotGen;
  const gpuName = boardName(board);
  const base = `The ${gpuName} is a PCIe ${chip.pcie_gen}.0 card, but this build's graphics slot is PCIe ${slotGen}.0.`;
  return [
    {
      rule: "pcie_generation",
      severity: limited ? "warning" : "info",
      message: limited
        ? `${base} The card only uses ${chip.pcie_lanes} lanes, so you may lose noticeable performance.`
        : `${base} It will work, with a small performance difference.`,
      slots: ["gpu", "motherboard"],
    },
  ];
};

/** Every rule, in `RULE_IDS` order. A new rule is one function above plus one entry here. */
const RULES: Rule[] = [
  cpuSocket,
  cpuGeneration,
  ramType,
  ramSticks,
  ramCapacity,
  ramSpeed,
  displayOutput,
  psuWattage,
  gpuPowerConnectors,
  cpuPowerConnectors,
  pcieGeneration,
];

/**
 * Runs every compatibility rule on a build. Pure. A rule only runs when all the parts it needs
 * are selected, so a partial build never produces noise.
 *
 * `power` is the estimate for this build; pass it when you already have it (and in tests),
 * otherwise it is computed here.
 *
 * Returned issues are ordered: errors, then warnings, then info; within a severity, in the order
 * of `RULE_IDS`.
 *
 * Rules (ids from `RULE_IDS`; "board" = motherboard):
 *
 *  cpu_socket (cpu + board): cpu.socket != board.socket -> error.
 *
 *  cpu_generation (cpu + board; skipped when cpu_socket fails): find the board's cpu_support
 *    entry for this CPU: an entry with cpu_id == cpu.id wins, else one with
 *    cpu_generation == cpu.generation. None -> error. needs_bios_update -> warning.
 *
 *  ram_type: (ram + board) ram.type != board.mem_type -> error [ram, motherboard].
 *    (ram + cpu) ram.type not in cpu.mem_types -> error [cpu, ram]. Both can fire.
 *
 *  ram_sticks (ram + board): ram.sticks > board.ram_slots -> error.
 *
 *  ram_capacity (ram + board): ram.capacity_gb > board.max_mem_gb -> error.
 *
 *  ram_speed (ram + board and/or cpu):
 *    ram.speed_mts > board.max_mem_speed -> warning: the kit will run at the board's maximum.
 *    Slots: [ram, motherboard].
 *    Otherwise, ram.speed_mts > cpu.max_mem_speed[ram.type] (ignored when the CPU has no entry
 *    for that type) -> info: above the CPU's official speed, needs EXPO / XMP enabled.
 *    Slots: [ram, cpu]. Never both: the board warning wins.
 *
 *  display_output (cpu, no gpu): cpu.igpu false -> error [cpu, gpu].
 *
 *  psu_wattage (psu + at least a cpu or a gpu): psu.watts < power.peakW -> error;
 *    else psu.watts < power.recommendedPsuW -> warning. Slots: [psu].
 *
 *  gpu_power_connectors (gpu + psu), numbers from ENGINE_CONFIG.connectors:
 *    adapters = max(0, board.conn_12v2x6 - psu.conn_12v2x6_count)
 *    perAdapter = clamp(ceil(board.power_w / wattsPer8pin), adapterMin8pin, adapterMax8pin)
 *    A PSU 8-pin (6+2) plug can feed a 6-pin socket; a 6-pin-only plug cannot feed an 8-pin one:
 *    sixFrom8 = max(0, board.conn_6pin - psu.pcie_6pin_count)
 *    needed8pin = board.conn_8pin + adapters x perAdapter + sixFrom8
 *    psu.pcie_8pin_count < needed8pin -> error (the PSU can't power this card);
 *    else adapters > 0 -> warning (works with an adapter). Slots: [gpu, psu].
 *
 *  cpu_power_connectors (board + psu): psu.eps_count < board.eps_required -> warning.
 *
 *  pcie_generation (gpu + board): slotGen = min(board.pcie_gen, cpu.pcie_gen if a cpu is
 *    selected). chip.pcie_gen > slotGen: warning when chip.pcie_lanes <= laneLimitedMaxLanes and
 *    slotGen <= laneLimitedSlotGen (ENGINE_CONFIG.pcie); otherwise info. Slots: [gpu, motherboard].
 */
export function checkCompatibility(
  build: Build,
  power: PowerEstimate = estimatePower(build),
): Issue[] {
  const issues = RULES.flatMap((rule) => rule(build, power));
  return issues.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
