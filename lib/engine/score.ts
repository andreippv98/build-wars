import type { Build, ScoreResult } from "./types";

/**
 * Computes the Build Score. Pure. All numbers come from `ENGINE_CONFIG.score`.
 *
 *   Build Score = G^gpuWeight x C^cpuWeight x R
 *
 * - G (gpuIndex) = chip.perf_index
 *     x clamp(1 + sensitivity x (board.boost_mhz / chip.ref_boost_mhz - 1), min, max)
 * - C (cpuIndex) = cpu.perf_index
 * - R (ramFactor) = capacity factor x speed factor
 *     capacity factor: first `ramCapacity` entry whose minGb <= ram.capacity_gb
 *     speed factor: clamp(1 + sensitivity x (ram.speed_mts / typical[ram.type] - 1), min, max)
 *     The kit's own speed is used, not what the board or CPU limit it to.
 * - Motherboard and PSU never change the score.
 * - score is null until cpu, gpu and ram are all present; `missing` lists the absent ones in the
 *   order cpu, gpu, ram. gpuIndex / cpuIndex / ramFactor are still filled in for the parts present.
 * - score = raw value rounded to 1 decimal; displayScore = Math.round(score); band = first band
 *   whose min <= displayScore.
 * - isEstimate = cpu or gpu chip present with verified false.
 *
 * The reference build (RTX 5090 at reference clock + Ryzen 7 9800X3D, both index 100, with 32 GB
 * DDR5-6000) must score exactly 100.
 */
export function scoreBuild(build: Build): ScoreResult {
  void build;
  throw new Error("not implemented");
}
