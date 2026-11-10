import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/catalog/load";
import { knownPartPaths } from "./known-paths";
import { partPath } from "./routes";

describe("knownPartPaths", () => {
  it("matches the catalog on disk exactly (register new data/gpus files in known-paths.ts)", async () => {
    const { catalog } = await loadCatalog(path.join(process.cwd(), "data"));
    if (!catalog) throw new Error("catalog failed to load");
    const chips = new Map(catalog.gpu_chips.map((chip) => [chip.id, chip]));
    const expected = [
      ...catalog.cpus.map((cpu) => partPath.cpu(cpu)),
      ...catalog.motherboards.map((board) => partPath.motherboard(board)),
      ...catalog.psus.map((psu) => partPath.psu(psu)),
      ...catalog.gpu_chips.map((chip) => partPath.gpuChip(chip)),
      ...catalog.gpu_boards.map((board) => partPath.gpuBoard(chips.get(board.chip_id)!, board)),
    ].sort();
    expect([...knownPartPaths()].sort()).toEqual(expected);
  });

  it("does not know made-up or developer paths", () => {
    const known = knownPartPaths();
    expect(known.has("/cpu/does-not-exist")).toBe(false);
    expect(known.has("/gpu/rtx-5090/does-not-exist")).toBe(false);
    expect(known.has("/dev/models")).toBe(false);
  });
});
