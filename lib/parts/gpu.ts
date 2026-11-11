import { scoreBuild } from "@/lib/engine";
import type { GpuBoard, GpuChip } from "@/lib/schemas";
import { plural, vendorName, watts } from "./format";
import type { SpecGroup, SpecRow } from "./specs";

/** What 100 means on the GPU index (plan: relative to the RTX 5090 at its reference clock). */
export const GPU_INDEX_REFERENCE = "RTX 5090 at reference clock = 100";

/** Chips with this many PCIe lanes or fewer get the "uses fewer lanes" note. */
const NARROW_LANES = 8;

export function boardName(board: Pick<GpuBoard, "maker" | "model">): string {
  return `${board.maker} ${board.model}`;
}

/** "1 x 12V-2x6", "2 x 8-pin", "1 x 8-pin + 1 x 6-pin", "None (slot powered)". */
export function connectorText(
  board: Pick<GpuBoard, "conn_6pin" | "conn_8pin" | "conn_12v2x6">,
): string {
  const parts = [
    board.conn_12v2x6 > 0 ? `${board.conn_12v2x6} x 12V-2x6` : null,
    board.conn_8pin > 0 ? `${board.conn_8pin} x 8-pin` : null,
    board.conn_6pin > 0 ? `${board.conn_6pin} x 6-pin` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(" + ") : "None (slot powered)";
}

/** `2` -> "2 slots", `2.5` -> "2.5 slots". */
export function slotText(slots: number): string {
  return `${slots} ${slots === 1 ? "slot" : "slots"}`;
}

/** The GPU index of a card: the chip's index times the board factor, to one decimal. */
export function boardIndex(chip: GpuChip, board: GpuBoard): number {
  const index = scoreBuild({ gpu: { chip, board } }).gpuIndex ?? chip.perf_index;
  return Math.round(index * 10) / 10;
}

/** "+105 MHz over the reference design", "Same as ...", "−40 MHz under ...". */
export function boostDeltaText(delta: number): string {
  if (delta > 0) return `+${delta} MHz over the reference design`;
  if (delta < 0) return `−${Math.abs(delta)} MHz under the reference design`;
  return "Same as the reference design";
}

function vramText(chip: GpuChip): string {
  return `${chip.vram_gb} GB ${chip.vram_type}`;
}

function pcieRow(chip: GpuChip): SpecRow {
  return {
    label: "PCIe",
    value: `PCIe ${chip.pcie_gen}.0 x${chip.pcie_lanes}`,
    note:
      chip.pcie_lanes <= NARROW_LANES
        ? `Uses ${chip.pcie_lanes} lanes: on a PCIe 3.0 motherboard this costs more performance than on wider cards`
        : undefined,
  };
}

function indexNote(chip: GpuChip): string {
  return chip.perf_index_verified
    ? `Relative to the ${GPU_INDEX_REFERENCE}`
    : "Placeholder value, not yet based on review data";
}

function spikeRows(chip: GpuChip): SpecRow[] {
  return chip.high_power_spikes
    ? [
        {
          label: "Power spikes",
          value: "Known for large spikes",
          note: "Build Wars recommends a larger power supply for this card unless the PSU is ATX 3.x",
        },
      ]
    : [];
}

export function chipSpecs(chip: GpuChip): SpecGroup[] {
  return [
    {
      title: "Overview",
      rows: [
        { label: "Model", value: chip.name },
        { label: "Vendor", value: vendorName(chip.vendor) },
        { label: "Series", value: chip.series },
        { label: "Release year", value: String(chip.year) },
      ],
    },
    { title: "Memory", rows: [{ label: "VRAM", value: vramText(chip) }] },
    {
      title: "Reference design",
      rows: [
        { label: "Reference boost clock", value: `${chip.ref_boost_mhz} MHz` },
        {
          label: "Reference board power",
          value: watts(chip.ref_power_w),
          note: "Partner cards differ: see the comparison below",
        },
      ],
    },
    { title: "Interface", rows: [pcieRow(chip), ...spikeRows(chip)] },
    {
      title: "Performance",
      rows: [{ label: "GPU index", value: String(chip.perf_index), note: indexNote(chip) }],
    },
  ];
}

export function boardSpecs(chip: GpuChip, board: GpuBoard): SpecGroup[] {
  return [
    {
      title: "Overview",
      rows: [
        { label: "Model", value: board.model },
        { label: "Maker", value: board.maker },
        ...(board.series ? [{ label: "Product line", value: board.series }] : []),
        { label: "Chip", value: chip.name },
        { label: "Release year", value: String(chip.year) },
      ],
    },
    {
      title: "Clocks and performance",
      rows: [
        {
          label: "Boost clock",
          value: `${board.boost_mhz} MHz`,
          note: boostDeltaText(board.boost_mhz - chip.ref_boost_mhz),
        },
        { label: "GPU index", value: String(boardIndex(chip, board)), note: indexNote(chip) },
      ],
    },
    {
      title: "Power",
      rows: [
        { label: "Board power", value: watts(board.power_w) },
        { label: "Power connectors", value: connectorText(board) },
        { label: "Recommended PSU by the maker", value: watts(board.rec_psu_w) },
      ],
    },
    {
      title: "Size and cooling",
      rows: [
        { label: "Length", value: `${board.length_mm} mm` },
        { label: "Thickness", value: slotText(board.slots) },
        { label: "Fans", value: plural(board.fan_count, "fan") },
      ],
    },
    {
      title: "Chip",
      rows: [{ label: "VRAM", value: vramText(chip) }, pcieRow(chip)],
    },
  ];
}

export function chipTitle(chip: GpuChip, boardCount: number): string {
  return `${chip.name}: specs, GPU index and all ${boardCount} card models compared`;
}

export function chipLead(chip: GpuChip, boardCount: number): string {
  return `${chip.name} is an ${vendorName(chip.vendor)} graphics chip from ${chip.year} with ${chip.vram_gb} GB of ${chip.vram_type} memory and a reference board power of ${watts(chip.ref_power_w)}. ${plural(boardCount, "card model")} in the catalog, compared side by side below.`;
}

export function chipDescription(chip: GpuChip, boardCount: number): string {
  return `${chip.name}: ${chip.vram_gb} GB ${chip.vram_type}, ${chip.year}, ${watts(chip.ref_power_w)} reference power. GPU index ${chip.perf_index}${chip.perf_index_verified ? "" : " (estimate)"}. Compare ${plural(boardCount, "card model")} by clocks, power, length and size.`;
}

export function boardTitle(chip: GpuChip, board: GpuBoard): string {
  return `${boardName(board)}: specs, size, power connectors and GPU index`;
}

export function boardLead(chip: GpuChip, board: GpuBoard): string {
  return `${boardName(board)} is a ${chip.name} graphics card with ${chip.vram_gb} GB of ${chip.vram_type} memory. It is ${board.length_mm} mm long and ${slotText(board.slots)} thick, has ${plural(board.fan_count, "fan")}, takes ${connectorText(board)} power and the maker recommends a ${watts(board.rec_psu_w)} power supply.`;
}

export function boardDescription(chip: GpuChip, board: GpuBoard): string {
  return `${boardName(board)}: ${chip.vram_gb} GB ${chip.vram_type}, ${board.length_mm} mm, ${slotText(board.slots)}, ${plural(board.fan_count, "fan")}, ${connectorText(board)}, ${watts(board.rec_psu_w)} PSU recommended. GPU index ${boardIndex(chip, board)}${chip.perf_index_verified ? "" : " (estimate)"}.`;
}

/**
 * Chips grouped by series, series with the newest chip first (so NVIDIA and AMD interleave),
 * ties by name; strongest chip first inside a series.
 */
export function chipsBySeries(
  chips: GpuChip[],
): { series: string; vendor: GpuChip["vendor"]; chips: GpuChip[] }[] {
  const groups = new Map<string, GpuChip[]>();
  for (const chip of chips) groups.set(chip.series, [...(groups.get(chip.series) ?? []), chip]);
  const newest = (list: GpuChip[]) => Math.max(...list.map((c) => c.year));
  return [...groups.entries()]
    .map(([series, list]) => ({
      series,
      vendor: list[0].vendor,
      chips: [...list].sort((a, b) => b.perf_index - a.perf_index || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => newest(b.chips) - newest(a.chips) || a.series.localeCompare(b.series));
}

export const COMPARISON_COLUMNS = [
  "boost_mhz",
  "power_w",
  "length_mm",
  "slots",
  "fan_count",
  "rec_psu_w",
] as const;
export type ComparisonColumn = (typeof COMPARISON_COLUMNS)[number];

export type ComparisonRow = {
  board: GpuBoard;
  /** GPU index of this card. */
  index: number;
  /** Boost clock minus the chip's reference clock, in MHz. */
  boostDelta: number;
  connectors: string;
  thickness: string;
};

export type ComparisonTable = {
  rows: ComparisonRow[];
  /** Lowest and highest value of each numeric column across the boards. */
  ranges: Record<ComparisonColumn, { min: number; max: number }>;
};

export function comparisonRows(chip: GpuChip, boards: GpuBoard[]): ComparisonTable {
  const ranges = Object.fromEntries(
    COMPARISON_COLUMNS.map((column) => {
      const values = boards.map((board) => board[column]);
      return [column, { min: Math.min(...values), max: Math.max(...values) }];
    }),
  ) as ComparisonTable["ranges"];
  return {
    rows: boards.map((board) => {
      const boostDelta = board.boost_mhz - chip.ref_boost_mhz;
      return {
        board,
        index: boardIndex(chip, board),
        boostDelta,
        connectors: connectorText(board),
        thickness: slotText(board.slots),
      };
    }),
    ranges,
  };
}
