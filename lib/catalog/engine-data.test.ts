import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { evaluateBuild, type Build } from "@/lib/engine";
import type { Catalog } from "@/lib/schemas";
import { loadCatalog } from "./load";
import { resolveMotherboard } from "./resolve";

/** The engine run end to end on the sample catalog in `data/`. */

let catalog: Catalog;

beforeAll(async () => {
  const result = await loadCatalog(path.join(process.cwd(), "data"));
  if (!result.catalog) throw new Error("catalog failed to load");
  catalog = result.catalog;
});

function pick<T extends { id: string }>(list: T[], id: string): T {
  const found = list.find((item) => item.id === id);
  if (!found) throw new Error(`sample catalog has no ${id}`);
  return found;
}

function build(ids: {
  cpu?: string;
  gpuBoard?: string;
  ram?: string;
  motherboard?: string;
  psu?: string;
}): Build {
  const board = ids.gpuBoard ? pick(catalog.gpu_boards, ids.gpuBoard) : undefined;
  const mobo = ids.motherboard ? pick(catalog.motherboards, ids.motherboard) : undefined;
  return {
    cpu: ids.cpu ? pick(catalog.cpus, ids.cpu) : undefined,
    gpu: board ? { board, chip: pick(catalog.gpu_chips, board.chip_id) } : undefined,
    ram: ids.ram ? pick(catalog.ram_kits, ids.ram) : undefined,
    motherboard: mobo
      ? resolveMotherboard(mobo, pick(catalog.chipsets, mobo.chipset_id))
      : undefined,
    psu: ids.psu ? pick(catalog.psus, ids.psu) : undefined,
  };
}

describe("engine on the sample catalog", () => {
  it("scores the reference build exactly 100 with no errors", () => {
    const result = evaluateBuild(
      build({
        cpu: "ryzen-7-9800x3d",
        gpuBoard: "nvidia-rtx-5090-founders-edition",
        ram: "ddr5-32gb-2x16-6000-cl30",
        motherboard: "asus-rog-strix-x870-a-gaming-wifi",
        psu: "asus-rog-thor-1200p2",
      }),
    );
    expect(result.score.score).toBe(100);
    expect(result.score.band?.label).toBe("Enthusiast");
    expect(result.hasErrors).toBe(false);
    expect(result.issues.filter((i) => i.severity !== "info")).toEqual([]);
    expect(result.power.headroom?.status).toBe("green");
  });

  it("warns about a BIOS update for a Ryzen 5000 CPU on the B450 board", () => {
    const { issues } = evaluateBuild(
      build({ cpu: "ryzen-5-5600", motherboard: "msi-b450-tomahawk-max" }),
    );
    expect(issues.find((i) => i.rule === "cpu_generation")?.severity).toBe("warning");
  });

  it("uses the chipset's support list when the board has none of its own", () => {
    const { issues } = evaluateBuild(
      build({ cpu: "ryzen-5-2600", motherboard: "msi-b550-tomahawk" }),
    );
    expect(issues.find((i) => i.rule === "cpu_generation")?.severity).toBe("error");
  });

  it("flags an F-series CPU without a graphics card and a mismatched socket", () => {
    const { issues, hasErrors } = evaluateBuild(
      build({ cpu: "core-i5-12400f", motherboard: "msi-b550-tomahawk" }),
    );
    expect(hasErrors).toBe(true);
    expect(issues.map((i) => i.rule)).toEqual(
      expect.arrayContaining(["cpu_socket", "display_output"]),
    );
  });

  it("evaluates every CPU with every GPU board without throwing", () => {
    for (const cpu of catalog.cpus) {
      for (const board of catalog.gpu_boards) {
        const result = evaluateBuild(build({ cpu: cpu.id, gpuBoard: board.id }));
        expect(result.power.peakW).toBeGreaterThan(0);
        expect(result.score.score).toBeNull();
        expect(result.score.missing).toEqual(["ram"]);
      }
    }
  });
});
