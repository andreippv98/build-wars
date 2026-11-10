import type { BuildSlot } from "@/lib/schemas";
import { ENGINE_CONFIG } from "./config";
import type { Build, ScoreBand, ScoreResult } from "./types";

const CONFIG = ENGINE_CONFIG.score;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function bandFor(displayScore: number): ScoreBand {
  const bands: readonly ScoreBand[] = CONFIG.bands;
  return bands.find((band) => band.min <= displayScore) ?? bands[bands.length - 1];
}

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
  const { cpu, gpu, ram } = build;

  const cpuIndex = cpu ? cpu.perf_index : null;

  let gpuIndex: number | null = null;
  if (gpu) {
    const { sensitivity, min, max } = CONFIG.boardFactor;
    const boardFactor = clamp(
      1 + sensitivity * (gpu.board.boost_mhz / gpu.chip.ref_boost_mhz - 1),
      min,
      max,
    );
    gpuIndex = gpu.chip.perf_index * boardFactor;
  }

  let ramFactor: number | null = null;
  if (ram) {
    const tier = CONFIG.ramCapacity.find((entry) => entry.minGb <= ram.capacity_gb);
    const capacityFactor = tier
      ? tier.factor
      : CONFIG.ramCapacity[CONFIG.ramCapacity.length - 1].factor;
    const { typical, sensitivity, min, max } = CONFIG.ramSpeed;
    const speedFactor = clamp(1 + sensitivity * (ram.speed_mts / typical[ram.type] - 1), min, max);
    ramFactor = capacityFactor * speedFactor;
  }

  const missing: BuildSlot[] = [];
  if (!cpu) missing.push("cpu");
  if (!gpu) missing.push("gpu");
  if (!ram) missing.push("ram");

  const isEstimate =
    (cpu !== undefined && !cpu.verified) || (gpu !== undefined && !gpu.chip.verified);

  if (cpuIndex === null || gpuIndex === null || ramFactor === null) {
    return {
      score: null,
      displayScore: null,
      band: null,
      gpuIndex,
      cpuIndex,
      ramFactor,
      isEstimate,
      missing,
    };
  }

  const raw = gpuIndex ** CONFIG.gpuWeight * cpuIndex ** CONFIG.cpuWeight * ramFactor;
  const score = Math.round(raw * 10) / 10;
  const displayScore = Math.round(score);
  return {
    score,
    displayScore,
    band: bandFor(displayScore),
    gpuIndex,
    cpuIndex,
    ramFactor,
    isEstimate,
    missing,
  };
}
