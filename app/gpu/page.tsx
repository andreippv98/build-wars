import type { Metadata } from "next";
import { JsonLd } from "@/components/part/json-ld";
import { PartIndex } from "@/components/part/part-index";
import { getCatalog } from "@/lib/catalog/server";
import { chipsBySeries } from "@/lib/parts/gpu";
import { boardsOfChip } from "@/lib/parts/related";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Graphics cards: specs, GPU index and card models compared";

export async function generateMetadata(): Promise<Metadata> {
  const { gpu_chips, gpu_boards } = await getCatalog();
  const series = [...new Set(gpu_chips.map((c) => c.series))];
  return pageMetadata({
    title: TITLE,
    description: metaDescription(
      `${gpu_chips.length} NVIDIA and AMD graphics chips (${series.join(", ")}) and ${gpu_boards.length} card models: clocks, power, length, connectors and GPU index.`,
    ),
    path: PART_SECTIONS.gpu.path,
  });
}

export default async function GpuIndexPage() {
  const catalog = await getCatalog();
  const section = PART_SECTIONS.gpu;
  const groups = chipsBySeries(catalog.gpu_chips);
  return (
    <>
      <JsonLd
        data={[
          itemListJsonLd({
            name: section.title,
            items: groups.flatMap((g) =>
              g.chips.map((chip) => ({ name: chip.name, path: partPath.gpuChip(chip) })),
            ),
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: section.title, path: section.path },
          ]),
        ]}
      />
      <PartIndex
        trail={[{ name: "Home", href: "/" }, { name: section.title }]}
        title="Graphics cards"
        intro="Every graphics chip in the catalog, grouped by series with the newest first. Open one to compare all its card models side by side: clocks, power, length and connectors."
        groups={groups.map((group) => ({
          heading: group.series,
          items: group.chips.map((chip) => ({
            href: partPath.gpuChip(chip),
            name: chip.name,
            detail: `${chip.vram_gb} GB, ${chip.year}, ${boardsOfChip(catalog, chip).length} card models`,
            value: `Index ${chip.perf_index}`,
          })),
        }))}
      />
    </>
  );
}
