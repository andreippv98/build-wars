import type { MemType } from "@/lib/schemas";
import type { ScoreBand } from "./types";

/**
 * Every tunable number of the engine. Nothing in `lib/engine` may hard-code one of these.
 * The values are the plan's first guesses; tune them once real index data is in.
 */
export const ENGINE_CONFIG = {
  score: {
    /** Build Score = G^gpuWeight x C^cpuWeight x R. */
    gpuWeight: 0.7,
    cpuWeight: 0.3,
    /** G = perf_index x clamp(1 + sensitivity x (boost_board / boost_ref - 1), min, max). */
    boardFactor: { sensitivity: 0.5, min: 0.97, max: 1.06 },
    /** Capacity factor: the first entry whose minGb <= total capacity. Ordered high to low. */
    ramCapacity: [
      { minGb: 32, factor: 1.0 },
      { minGb: 16, factor: 0.96 },
      { minGb: 0, factor: 0.85 },
    ],
    /** Speed factor = clamp(1 + sensitivity x (speed / typical - 1), min, max). */
    ramSpeed: {
      typical: { DDR4: 3200, DDR5: 6000 } satisfies Record<MemType, number>,
      sensitivity: 0.15,
      min: 0.97,
      max: 1.03,
    },
    /** Ordered high to low; a display score belongs to the first band whose min it reaches. */
    bands: [
      {
        min: 85,
        label: "Enthusiast",
        meaning: "Handles demanding games at 4K or high refresh rates",
      },
      { min: 65, label: "High-end", meaning: "Comfortable at 1440p, high settings" },
      { min: 45, label: "Mid-range", meaning: "Solid 1080p, some 1440p with tuning" },
      { min: 25, label: "Entry", meaning: "1080p with lowered settings in newer games" },
      { min: 0, label: "Basic", meaning: "Esports and older titles" },
    ] satisfies ScoreBand[],
  },
  power: {
    /** CPU package power (ppt_w) is capped at this while gaming. */
    cpuGamingCapW: 200,
    motherboardW: 40,
    perRamStickW: 5,
    /** Storage and fans allowance until v2 adds those parts. */
    storageAndFansW: 25,
    psuMultiplier: 1.3,
    /** For GPUs with `high_power_spikes`, unless the PSU is ATX 3.x. */
    psuMultiplierSpiky: 1.4,
    /** Recommended PSU is rounded up to a multiple of this. */
    psuRoundToW: 50,
  },
  connectors: {
    /** A 12VHPWR / 12V-2x6 adapter needs ceil(board power / this) PCIe 8-pin plugs... */
    wattsPer8pin: 150,
    /** ...but never fewer or more than these. */
    adapterMin8pin: 2,
    adapterMax8pin: 4,
  },
  pcie: {
    /** A card with at most this many lanes on a slot of at most this generation gets a warning. */
    laneLimitedMaxLanes: 8,
    laneLimitedSlotGen: 3,
  },
} as const;
