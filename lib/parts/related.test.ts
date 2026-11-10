import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/catalog/load";
import type { Catalog } from "@/lib/schemas";
import {
  boardsForCpu,
  boardsOfChip,
  chipsInSeries,
  cpusForBoard,
  gpusForPsu,
  psusForGpu,
} from "./related";
import { partPath } from "./routes";

let catalog: Catalog;
const pick = <T extends { id: string }>(list: T[], id: string): T => {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`no ${id}`);
  return found;
};

beforeAll(async () => {
  const result = await loadCatalog(path.join(process.cwd(), "data"));
  if (!result.catalog) throw new Error("catalog failed to load");
  catalog = result.catalog;
});

describe("CPU and motherboard matches", () => {
  it("lists only boards with the CPU's socket and support, BIOS-update boards last", () => {
    const matches = boardsForCpu(catalog, pick(catalog.cpus, "ryzen-5-5600"));
    const ids = matches.map((m) => m.board.id);
    expect(ids).toContain("msi-b550-tomahawk");
    expect(ids).toContain("msi-b450-tomahawk-max");
    expect(ids).not.toContain("asus-rog-strix-x870-a-gaming-wifi");
    expect(matches.find((m) => m.board.id === "msi-b450-tomahawk-max")?.needsBiosUpdate).toBe(true);
    expect(matches.find((m) => m.board.id === "msi-b550-tomahawk")?.needsBiosUpdate).toBe(false);
    const flags = matches.map((m) => m.needsBiosUpdate);
    expect(flags).toEqual([...flags].sort((a, b) => Number(a) - Number(b)));
  });

  it("leaves out a CPU generation the board does not support at all", () => {
    const cpus = cpusForBoard(catalog, pick(catalog.motherboards, "msi-b550-tomahawk"));
    expect(cpus.map((m) => m.cpu.id)).not.toContain("ryzen-5-2600");
    expect(cpus.map((m) => m.cpu.id)).toContain("ryzen-7-5800x3d");
  });

  it("is symmetric", () => {
    for (const cpu of catalog.cpus) {
      for (const match of boardsForCpu(catalog, cpu)) {
        const back = cpusForBoard(catalog, match.board).find((m) => m.cpu.id === cpu.id);
        expect(back?.needsBiosUpdate).toBe(match.needsBiosUpdate);
      }
    }
  });
});

describe("GPU lists", () => {
  it("lists a chip's boards, fastest clock first", () => {
    const boards = boardsOfChip(catalog, pick(catalog.gpu_chips, "rtx-5070"));
    expect(boards.length).toBeGreaterThanOrEqual(2);
    expect(boards.every((b) => b.chip_id === "rtx-5070")).toBe(true);
    const clocks = boards.map((b) => b.boost_mhz);
    expect(clocks).toEqual([...clocks].sort((a, b) => b - a));
  });

  it("lists the other chips of a series", () => {
    const others = chipsInSeries(catalog, pick(catalog.gpu_chips, "rtx-4090"));
    expect(others.map((c) => c.id)).toEqual(expect.arrayContaining(["rtx-4070-super", "rtx-4060"]));
    expect(others.map((c) => c.id)).not.toContain("rtx-4090");
  });
});

describe("PSU and GPU matches", () => {
  it("marks a 12V-2x6 card as needing an adapter on a PSU without that connector", () => {
    const fits = gpusForPsu(catalog, pick(catalog.psus, "corsair-rm850x-2018"));
    expect(fits.find((f) => f.board.id === "nvidia-rtx-4070-super-founders-edition")?.fit).toBe(
      "adapter",
    );
    expect(fits.find((f) => f.board.id === "amd-rx-7800-xt-reference")?.fit).toBe("native");
  });

  it("leaves out cards a small PSU cannot plug in", () => {
    const fits = gpusForPsu(catalog, pick(catalog.psus, "corsair-cx450"));
    expect(fits.map((f) => f.board.id)).not.toContain("nvidia-rtx-5090-founders-edition");
  });

  it("lists PSUs at or above the card's recommended wattage, smallest first", () => {
    const board = pick(catalog.gpu_boards, "nvidia-rtx-5090-founders-edition");
    const gpu = { board, chip: pick(catalog.gpu_chips, board.chip_id) };
    const psus = psusForGpu(catalog, gpu);
    expect(psus.length).toBeGreaterThan(0);
    expect(psus.every((p) => p.psu.watts >= board.rec_psu_w)).toBe(true);
    const watts = psus.map((p) => p.psu.watts);
    expect(watts).toEqual([...watts].sort((a, b) => a - b));
  });
});

describe("partPath", () => {
  it("builds the plan's URLs", () => {
    expect(partPath.cpu({ slug: "ryzen-7-9800x3d" })).toBe("/cpu/ryzen-7-9800x3d");
    expect(partPath.gpuChip({ slug: "rtx-3080-10gb" })).toBe("/gpu/rtx-3080-10gb");
    expect(partPath.gpuBoard({ slug: "rtx-3080-10gb" }, { slug: "asus-tuf-gaming-oc" })).toBe(
      "/gpu/rtx-3080-10gb/asus-tuf-gaming-oc",
    );
    expect(partPath.motherboard({ slug: "msi-b550-tomahawk" })).toBe(
      "/motherboard/msi-b550-tomahawk",
    );
    expect(partPath.psu({ slug: "corsair-cx450" })).toBe("/psu/corsair-cx450");
  });
});
