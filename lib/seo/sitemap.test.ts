import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalog } from "@/lib/catalog/load";
import type { Catalog } from "@/lib/schemas";
import { sitemapEntries } from "./sitemap";

let catalog: Catalog;

beforeAll(async () => {
  const { catalog: loaded } = await loadCatalog(path.join(process.cwd(), "data"));
  if (!loaded) throw new Error("catalog failed to load");
  catalog = loaded;
});

const paths = () => sitemapEntries(catalog).map((entry) => entry.path);

describe("sitemapEntries: coverage", () => {
  it("lists the static pages and the four section indexes", () => {
    for (const p of ["/", "/build", "/how-scores-work", "/cpu", "/gpu", "/motherboard", "/psu"]) {
      expect(paths()).toContain(p);
    }
  });

  it("has one URL per part of each kind", () => {
    const all = paths();
    expect(all.filter((p) => /^\/cpu\/[^/]+$/.test(p))).toHaveLength(catalog.cpus.length);
    expect(all.filter((p) => /^\/gpu\/[^/]+$/.test(p))).toHaveLength(catalog.gpu_chips.length);
    expect(all.filter((p) => /^\/gpu\/[^/]+\/[^/]+$/.test(p))).toHaveLength(
      catalog.gpu_boards.length,
    );
    expect(all.filter((p) => /^\/motherboard\/[^/]+$/.test(p))).toHaveLength(
      catalog.motherboards.length,
    );
    expect(all.filter((p) => /^\/psu\/[^/]+$/.test(p))).toHaveLength(catalog.psus.length);
  });

  it("contains a known URL of each kind", () => {
    const all = paths();
    expect(all).toContain("/cpu/ryzen-7-9800x3d");
    expect(all).toContain("/gpu/rtx-3080-10gb");
    expect(all).toContain("/gpu/rtx-3080-10gb/asus-tuf-gaming-oc");
    expect(all).toContain(`/motherboard/${catalog.motherboards[0].slug}`);
    expect(all).toContain(`/psu/${catalog.psus[0].slug}`);
  });
});

describe("sitemapEntries: exclusions and hygiene", () => {
  it("has no duplicates", () => {
    const all = paths();
    expect(new Set(all).size).toBe(all.length);
  });

  it("never lists /dev, a query string, or API and account paths", () => {
    for (const p of paths()) {
      expect(p.startsWith("/dev")).toBe(false);
      expect(p.startsWith("/api")).toBe(false);
      expect(p.startsWith("/me")).toBe(false);
      expect(p).not.toContain("?");
    }
  });

  it("lists no RAM kit", () => {
    const all = paths().join("\n");
    for (const kit of catalog.ram_kits) {
      expect(all).not.toContain(kit.id);
    }
    expect(all).not.toContain("/ram");
  });

  it("is stable between calls", () => {
    expect(paths()).toEqual(paths());
  });
});

describe("sitemapEntries: priorities", () => {
  it("uses the planned priority per kind", () => {
    const byPath = new Map(sitemapEntries(catalog).map((e) => [e.path, e.priority]));
    expect(byPath.get("/")).toBe(1.0);
    expect(byPath.get("/build")).toBe(0.9);
    expect(byPath.get("/cpu")).toBe(0.8);
    expect(byPath.get("/cpu/ryzen-7-9800x3d")).toBe(0.7);
    expect(byPath.get("/how-scores-work")).toBe(0.6);
  });
});

describe("sitemapEntries: public builds", () => {
  it("appends the given public build paths after everything else", () => {
    const entries = sitemapEntries(catalog, { publicBuildPaths: ["/b/abc", "/b/def"] });
    expect(entries.slice(-2).map((e) => e.path)).toEqual(["/b/abc", "/b/def"]);
    expect(entries.at(-1)?.priority).toBe(0.5);
  });

  it("adds nothing without publicBuildPaths", () => {
    expect(sitemapEntries(catalog).length).toBe(sitemapEntries(catalog, {}).length);
    expect(paths().some((p) => p.startsWith("/b/"))).toBe(false);
  });
});
