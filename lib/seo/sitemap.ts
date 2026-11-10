import type { Catalog } from "@/lib/schemas";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";

export type SitemapEntry = {
  /** Path starting with "/", no query string. */
  path: string;
  priority: number;
  changeFrequency: "daily" | "weekly" | "monthly";
};

/** Priorities by kind of page. */
const PRIORITY = {
  home: 1.0,
  build: 0.9,
  sectionIndex: 0.8,
  part: 0.7,
  methodology: 0.6,
  publicBuild: 0.5,
} as const;

/**
 * Every public URL of the site, in a stable order. Pure.
 *
 * `publicBuildPaths` is the one place saved builds can enter the sitemap. It takes paths only, so
 * a private build can appear only if the caller passes it: the caller must pass PUBLIC builds
 * only (obtained through the access functions in `lib/builds`). Nothing else in this module
 * knows about builds.
 *
 * Never listed: `/dev/*`, `/build` with a query string, RAM kits (they have no page), `/api`,
 * `/me`.
 */
export function sitemapEntries(
  catalog: Pick<Catalog, "cpus" | "gpu_chips" | "gpu_boards" | "motherboards" | "psus">,
  options: { publicBuildPaths?: readonly string[] } = {},
): SitemapEntry[] {
  const { publicBuildPaths = [] } = options;
  const entries: SitemapEntry[] = [
    { path: "/", priority: PRIORITY.home, changeFrequency: "weekly" },
    { path: "/build", priority: PRIORITY.build, changeFrequency: "monthly" },
    { path: "/how-scores-work", priority: PRIORITY.methodology, changeFrequency: "monthly" },
    ...Object.values(PART_SECTIONS).map((section): SitemapEntry => ({
      path: section.path,
      priority: PRIORITY.sectionIndex,
      changeFrequency: "weekly",
    })),
  ];

  const part = (path: string): SitemapEntry => ({
    path,
    priority: PRIORITY.part,
    changeFrequency: "monthly",
  });
  const chipsById = new Map(catalog.gpu_chips.map((chip) => [chip.id, chip]));

  for (const cpu of catalog.cpus) entries.push(part(partPath.cpu(cpu)));
  for (const chip of catalog.gpu_chips) entries.push(part(partPath.gpuChip(chip)));
  for (const board of catalog.gpu_boards) {
    const chip = chipsById.get(board.chip_id);
    if (chip) entries.push(part(partPath.gpuBoard(chip, board)));
  }
  for (const board of catalog.motherboards) entries.push(part(partPath.motherboard(board)));
  for (const psu of catalog.psus) entries.push(part(partPath.psu(psu)));

  for (const path of publicBuildPaths) {
    entries.push({ path, priority: PRIORITY.publicBuild, changeFrequency: "weekly" });
  }

  const seen = new Set<string>();
  return entries.filter((entry) => {
    if (seen.has(entry.path)) return false;
    seen.add(entry.path);
    return true;
  });
}
