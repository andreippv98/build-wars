import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatalog } from "./load";

describe("the real catalog in data/", () => {
  it("passes every schema and cross-reference check", async () => {
    const { catalog, issues } = await loadCatalog(path.join(process.cwd(), "data"));
    expect(issues).toEqual([]);
    expect(catalog).toBeDefined();
  });

  it("contains the score anchors at index 100", async () => {
    const { catalog } = await loadCatalog(path.join(process.cwd(), "data"));
    expect(catalog?.cpus.find((c) => c.id === "ryzen-7-9800x3d")?.perf_index).toBe(100);
    expect(catalog?.gpu_chips.find((c) => c.id === "rtx-5090")?.perf_index).toBe(100);
  });
});
