import type { Build, PowerEstimate } from "./types";

/**
 * Estimates power draw and the recommended PSU. Pure. All numbers come from
 * `ENGINE_CONFIG.power`.
 *
 * - gpuW = gpu.board.power_w (0 without a GPU)
 * - cpuW = min(cpu.ppt_w, cpuGamingCapW) (0 without a CPU)
 * - baselineW = motherboardW if a motherboard is selected
 *             + perRamStickW x ram.sticks if RAM is selected
 *             + storageAndFansW if at least one part of any kind is selected (a PSU counts)
 * - peakW = gpuW + cpuW + baselineW
 * - multiplier = psuMultiplierSpiky if gpu.chip.high_power_spikes and the PSU is not ATX 3.x
 *   (no PSU selected counts as not ATX 3.x); otherwise psuMultiplier
 * - recommendedPsuW = peakW x multiplier rounded UP to a multiple of psuRoundToW. Guard against
 *   floating-point noise so an exact multiple is not bumped a step (500 x 1.3 must give 650).
 * - headroom: null without a PSU or when the PSU is the only part; otherwise green when
 *   psu.watts >= recommendedPsuW, amber when peakW <= psu.watts < recommendedPsuW, red below peakW.
 * - An empty build returns all zeros, multiplier = psuMultiplier and headroom null.
 */
export function estimatePower(build: Build): PowerEstimate {
  void build;
  throw new Error("not implemented");
}
