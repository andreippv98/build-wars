import { resolveMotherboard } from "@/lib/catalog/resolve";
import { checkCompatibility, estimatePower } from "@/lib/engine";
import type { Catalog, Cpu, GpuBoard, GpuChip, Motherboard, Psu } from "@/lib/schemas";

/**
 * Which parts go with which, for the "compatible with" lists on part pages. Everything is
 * decided by the engine's rules, so a page can never disagree with the configurator.
 */

type PartsCatalog = Pick<
  Catalog,
  "cpus" | "gpu_chips" | "gpu_boards" | "chipsets" | "motherboards" | "psus"
>;

export type CpuBoardMatch = {
  cpu: Cpu;
  board: Motherboard;
  /** Works only after a BIOS update. */
  needsBiosUpdate: boolean;
};

function matchCpuBoard(catalog: PartsCatalog, cpu: Cpu, board: Motherboard): CpuBoardMatch | null {
  const chipset = catalog.chipsets.find((c) => c.id === board.chipset_id);
  if (!chipset) return null;
  const build = { cpu, motherboard: resolveMotherboard(board, chipset) };
  const issues = checkCompatibility(build, estimatePower(build)).filter(
    (issue) => issue.rule === "cpu_socket" || issue.rule === "cpu_generation",
  );
  if (issues.some((issue) => issue.severity === "error")) return null;
  return { cpu, board, needsBiosUpdate: issues.some((issue) => issue.severity === "warning") };
}

/** Motherboards a CPU works on, boards that need no BIOS update first, then by name. */
export function boardsForCpu(catalog: PartsCatalog, cpu: Cpu): CpuBoardMatch[] {
  return catalog.motherboards
    .flatMap((board) => matchCpuBoard(catalog, cpu, board) ?? [])
    .sort(
      (a, b) =>
        Number(a.needsBiosUpdate) - Number(b.needsBiosUpdate) ||
        `${a.board.maker} ${a.board.model}`.localeCompare(`${b.board.maker} ${b.board.model}`),
    );
}

/** CPUs a motherboard takes, no-BIOS-update ones first, then strongest first. */
export function cpusForBoard(catalog: PartsCatalog, board: Motherboard): CpuBoardMatch[] {
  return catalog.cpus
    .flatMap((cpu) => matchCpuBoard(catalog, cpu, board) ?? [])
    .sort(
      (a, b) =>
        Number(a.needsBiosUpdate) - Number(b.needsBiosUpdate) ||
        b.cpu.perf_index - a.cpu.perf_index,
    );
}

/** Board models built on a chip, fastest clock first, then by name. */
export function boardsOfChip(catalog: PartsCatalog, chip: GpuChip): GpuBoard[] {
  return catalog.gpu_boards
    .filter((board) => board.chip_id === chip.id)
    .sort(
      (a, b) =>
        b.boost_mhz - a.boost_mhz || `${a.maker} ${a.model}`.localeCompare(`${b.maker} ${b.model}`),
    );
}

/** Chips of the same series, strongest first (for "other cards in this series"). */
export function chipsInSeries(catalog: PartsCatalog, chip: GpuChip): GpuChip[] {
  return catalog.gpu_chips
    .filter((other) => other.series === chip.series && other.id !== chip.id)
    .sort((a, b) => b.perf_index - a.perf_index);
}

export type PsuFit = "native" | "adapter";

/**
 * Graphics cards a PSU can power on connectors alone (wattage depends on the whole build and is
 * not judged here): "native" needs no adapter, "adapter" works with a 12V-2x6 adapter.
 */
export function gpusForPsu(
  catalog: PartsCatalog,
  psu: Psu,
): { board: GpuBoard; chip: GpuChip; fit: PsuFit }[] {
  const chips = new Map(catalog.gpu_chips.map((chip) => [chip.id, chip]));
  return catalog.gpu_boards.flatMap((board) => {
    const chip = chips.get(board.chip_id);
    if (!chip) return [];
    const build = { gpu: { chip, board }, psu };
    const issue = checkCompatibility(build, estimatePower(build)).find(
      (i) => i.rule === "gpu_power_connectors",
    );
    if (issue?.severity === "error") return [];
    return [{ board, chip, fit: issue ? ("adapter" as const) : ("native" as const) }];
  });
}

/** PSUs with the connectors for a graphics card and at least its maker's recommended wattage. */
export function psusForGpu(
  catalog: PartsCatalog,
  gpu: { chip: GpuChip; board: GpuBoard },
): { psu: Psu; fit: PsuFit }[] {
  return catalog.psus
    .flatMap((psu) => {
      if (psu.watts < gpu.board.rec_psu_w) return [];
      const build = { gpu, psu };
      const issue = checkCompatibility(build, estimatePower(build)).find(
        (i) => i.rule === "gpu_power_connectors",
      );
      if (issue?.severity === "error") return [];
      return [{ psu, fit: issue ? ("adapter" as const) : ("native" as const) }];
    })
    .sort((a, b) => a.psu.watts - b.psu.watts);
}
