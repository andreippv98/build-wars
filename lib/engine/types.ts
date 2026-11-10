import type {
  BuildSlot,
  Cpu,
  GpuBoard,
  GpuChip,
  Psu,
  RamKit,
  ResolvedMotherboard,
} from "@/lib/schemas";

/**
 * A build as the engine sees it: fully resolved part records, any slot may be empty.
 * The engine never looks parts up; callers resolve ids to records first.
 */
export type Build = {
  cpu?: Cpu;
  /** A GPU is always a board model together with its chip. */
  gpu?: { chip: GpuChip; board: GpuBoard };
  ram?: RamKit;
  /** Use `resolveMotherboard()` from `lib/catalog/resolve` so `cpu_support` is filled in. */
  motherboard?: ResolvedMotherboard;
  psu?: Psu;
};

// --- Compatibility -----------------------------------------------------------------------------

/** error: the build can't work. warning: works with a caveat. info: a note, small effect. */
export type Severity = "error" | "warning" | "info";

export const RULE_IDS = [
  "cpu_socket",
  "cpu_generation",
  "ram_type",
  "ram_sticks",
  "ram_capacity",
  "ram_speed",
  "display_output",
  "psu_wattage",
  "gpu_power_connectors",
  "cpu_power_connectors",
  "pcie_generation",
] as const;
export type RuleId = (typeof RULE_IDS)[number];

export type Issue = {
  rule: RuleId;
  severity: Severity;
  /** Plain language, names the parts involved, says what to do when that is obvious. No codes. */
  message: string;
  /** Slots involved, for highlighting in the scene and the picker. Never empty. */
  slots: BuildSlot[];
};

// --- Power -------------------------------------------------------------------------------------

/** green: PSU >= recommended. amber: peak <= PSU < recommended. red: PSU < peak. */
export type HeadroomStatus = "green" | "amber" | "red";

export type PowerEstimate = {
  /** GPU board power (the board model's, not the reference). 0 without a GPU. */
  gpuW: number;
  /** CPU package power, capped at the gaming cap. 0 without a CPU. */
  cpuW: number;
  /** Motherboard + RAM sticks + storage and fans allowance. */
  baselineW: number;
  /** Estimated peak draw = gpuW + cpuW + baselineW. 0 for an empty build. */
  peakW: number;
  /** PSU multiplier used (normal, or the higher one for spiky GPUs without an ATX 3.x PSU). */
  multiplier: number;
  /** peakW x multiplier, rounded up to the next step (50 W). 0 for an empty build. */
  recommendedPsuW: number;
  /** Null when no PSU is selected or the build has no other parts. */
  headroom: {
    status: HeadroomStatus;
    psuW: number;
    /** psuW - peakW; negative when the PSU is below the estimated peak. */
    spareW: number;
  } | null;
};

// --- Score -------------------------------------------------------------------------------------

export type ScoreBand = {
  /** Lowest display score in the band. */
  min: number;
  label: string;
  meaning: string;
};

export type ScoreResult = {
  /**
   * Build Score rounded to one decimal: the canonical value for storing and ranking.
   * Null until CPU, GPU and RAM are all selected.
   */
  score: number | null;
  /** `score` rounded to a whole number: what the UI shows. The band is taken from this. */
  displayScore: number | null;
  band: ScoreBand | null;
  /** G: chip perf_index x board-model factor. Null without a GPU. Not rounded. */
  gpuIndex: number | null;
  /** C: CPU perf_index. Null without a CPU. */
  cpuIndex: number | null;
  /** R: capacity factor x speed factor. Null without RAM. Not rounded. */
  ramFactor: number | null;
  /** True when the CPU or the GPU chip feeding the score has `perf_index_verified: false`. */
  isEstimate: boolean;
  /** Which of cpu / gpu / ram are still missing for a score, in that order. */
  missing: BuildSlot[];
};

// --- Combined ----------------------------------------------------------------------------------

export type BuildEvaluation = {
  issues: Issue[];
  power: PowerEstimate;
  score: ScoreResult;
  /** True when any issue is an error: the UI must not present the score as final. */
  hasErrors: boolean;
};
