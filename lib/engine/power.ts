import { ENGINE_CONFIG } from "./config";
import type { Build, HeadroomStatus, PowerEstimate } from "./types";

/** Decimal precision (6 places) used to strip floating-point noise; not a tunable. */
const PRECISION = 1e6;

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
  const cfg = ENGINE_CONFIG.power;
  const { cpu, gpu, ram, motherboard, psu } = build;

  const gpuW = gpu ? gpu.board.power_w : 0;
  const cpuW = cpu ? Math.min(cpu.ppt_w, cfg.cpuGamingCapW) : 0;

  const anyPart = Boolean(cpu || gpu || ram || motherboard || psu);
  const baselineW =
    (motherboard ? cfg.motherboardW : 0) +
    (ram ? cfg.perRamStickW * ram.sticks : 0) +
    (anyPart ? cfg.storageAndFansW : 0);

  const peakW = gpuW + cpuW + baselineW;

  const spiky = Boolean(gpu?.chip.high_power_spikes) && !psu?.atx3;
  const multiplier = spiky ? cfg.psuMultiplierSpiky : cfg.psuMultiplier;

  // Round away floating-point noise (500 x 1.3 = 650.0000000000001) before rounding up.
  const scaled = Math.round(peakW * multiplier * PRECISION) / PRECISION;
  const recommendedPsuW = Math.ceil(scaled / cfg.psuRoundToW) * cfg.psuRoundToW;

  let headroom: PowerEstimate["headroom"] = null;
  if (psu && (cpu || gpu || ram || motherboard)) {
    const status: HeadroomStatus =
      psu.watts >= recommendedPsuW ? "green" : psu.watts >= peakW ? "amber" : "red";
    headroom = { status, psuW: psu.watts, spareW: psu.watts - peakW };
  }

  return { gpuW, cpuW, baselineW, peakW, multiplier, recommendedPsuW, headroom };
}
