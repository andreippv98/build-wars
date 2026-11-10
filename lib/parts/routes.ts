import type { Cpu, GpuBoard, GpuChip, Motherboard, Psu } from "@/lib/schemas";

/**
 * URLs of the part pages. The only place that knows them: pages, links and the sitemap all go
 * through here. RAM kits have no page (they are chosen by spec).
 */
export const PART_SECTIONS = {
  cpu: { path: "/cpu", title: "Processors", singular: "Processor" },
  gpu: { path: "/gpu", title: "Graphics cards", singular: "Graphics card" },
  motherboard: { path: "/motherboard", title: "Motherboards", singular: "Motherboard" },
  psu: { path: "/psu", title: "Power supplies", singular: "Power supply" },
} as const;
export type PartSection = keyof typeof PART_SECTIONS;

export const partPath = {
  cpu: (cpu: Pick<Cpu, "slug">) => `/cpu/${cpu.slug}`,
  /** Chip page: lists every board model of the chip. */
  gpuChip: (chip: Pick<GpuChip, "slug">) => `/gpu/${chip.slug}`,
  gpuBoard: (chip: Pick<GpuChip, "slug">, board: Pick<GpuBoard, "slug">) =>
    `/gpu/${chip.slug}/${board.slug}`,
  motherboard: (board: Pick<Motherboard, "slug">) => `/motherboard/${board.slug}`,
  psu: (psu: Pick<Psu, "slug">) => `/psu/${psu.slug}`,
};
