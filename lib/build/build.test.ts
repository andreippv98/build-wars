import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/catalog/load";
import {
  buildHref,
  candidateBlockers,
  indexCatalog,
  parseSelection,
  partId,
  partName,
  resolveBuild,
  selectionToQuery,
  type CatalogIndex,
} from "./index";

let index: CatalogIndex;

beforeAll(async () => {
  const { catalog } = await loadCatalog(path.join(process.cwd(), "data"));
  if (!catalog) throw new Error("catalog failed to load");
  index = indexCatalog(catalog);
});

describe("selection <-> URL", () => {
  it("round-trips a full selection in a fixed order", () => {
    const selection = { psu: "p-1", cpu: "c-1", motherboard: "m-1", gpu: "g-1", ram: "r-1" };
    const query = selectionToQuery(selection);
    expect(query).toBe("cpu=c-1&gpu=g-1&ram=r-1&mb=m-1&psu=p-1");
    expect(parseSelection(new URLSearchParams(query))).toEqual(selection);
  });

  it("gives an empty query and /build for an empty selection", () => {
    expect(selectionToQuery({})).toBe("");
    expect(buildHref({})).toBe("/build");
    expect(buildHref({ cpu: "c-1" })).toBe("/build?cpu=c-1");
  });

  it("ignores values that are not valid ids and unrelated parameters", () => {
    const params = new URLSearchParams("cpu=Not%20An%20Id&gpu=<script>&ram=ok-1&challenge=x");
    expect(parseSelection(params)).toEqual({ ram: "ok-1" });
  });
});

describe("indexCatalog and resolveBuild", () => {
  it("pairs GPU boards with their chip and resolves motherboard CPU support", () => {
    const gpu = index.byId.gpu.get("nvidia-rtx-5090-founders-edition");
    expect(gpu?.chip.id).toBe("rtx-5090");
    expect(partId("gpu", gpu!)).toBe("nvidia-rtx-5090-founders-edition");
    const board = index.byId.motherboard.get("msi-b550-tomahawk");
    expect(board?.cpu_support.length).toBeGreaterThan(0);
  });

  it("resolves known ids and reports unknown ones", () => {
    const { build, unknown } = resolveBuild(
      { cpu: "ryzen-7-9800x3d", gpu: "no-such-board", ram: "ddr5-32gb-2x16-6000-cl30" },
      index,
    );
    expect(build.cpu?.id).toBe("ryzen-7-9800x3d");
    expect(build.ram?.id).toBe("ddr5-32gb-2x16-6000-cl30");
    expect(build.gpu).toBeUndefined();
    expect(unknown).toEqual(["gpu"]);
  });

  it("names parts for display", () => {
    expect(partName("gpu", index.byId.gpu.get("nvidia-rtx-5090-founders-edition")!)).toContain(
      "Founders Edition",
    );
    expect(partName("ram", index.byId.ram.get("ddr5-32gb-2x16-6000-cl30")!)).toBe(
      "32 GB DDR5-6000 CL30",
    );
  });
});

describe("candidateBlockers", () => {
  it("blocks a motherboard with the wrong socket for the chosen CPU", () => {
    const { build } = resolveBuild({ cpu: "ryzen-7-9800x3d" }, index);
    const am4 = index.byId.motherboard.get("msi-b550-tomahawk")!;
    const am5 = index.byId.motherboard.get("asus-rog-strix-x870-a-gaming-wifi")!;
    expect(candidateBlockers(build, "motherboard", am4)[0]?.rule).toBe("cpu_socket");
    expect(candidateBlockers(build, "motherboard", am5)).toEqual([]);
  });

  it("does not block a CPU without graphics just because no GPU is chosen yet", () => {
    const cpu = index.byId.cpu.get("core-i5-12400f")!;
    expect(candidateBlockers({}, "cpu", cpu)).toEqual([]);
  });

  it("does not block on warnings", () => {
    const { build } = resolveBuild({ motherboard: "msi-b450-tomahawk-max" }, index);
    const cpu = index.byId.cpu.get("ryzen-5-5600")!;
    expect(candidateBlockers(build, "cpu", cpu)).toEqual([]);
  });

  it("blocks a PSU below the estimated peak", () => {
    const { build } = resolveBuild(
      { cpu: "ryzen-7-9800x3d", gpu: "nvidia-rtx-5090-founders-edition" },
      index,
    );
    const small = index.byId.psu.get("corsair-cx450")!;
    expect(candidateBlockers(build, "psu", small).map((i) => i.rule)).toContain("psu_wattage");
  });
});
