import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ad-slot";
import { BoardComparison } from "@/components/part/board-comparison";
import { DataStatus } from "@/components/part/data-status";
import { IndexBadge } from "@/components/part/index-badge";
import { JsonLd } from "@/components/part/json-ld";
import { PartList } from "@/components/part/part-list";
import { PartPage } from "@/components/part/part-page";
import { SpecTable } from "@/components/part/spec-table";
import { getCatalog } from "@/lib/catalog/server";
import { vendorName } from "@/lib/parts/format";
import {
  GPU_INDEX_REFERENCE,
  boardName,
  chipDescription,
  chipLead,
  chipSpecs,
  chipTitle,
  comparisonRows,
} from "@/lib/parts/gpu";
import { boardsOfChip, chipsInSeries } from "@/lib/parts/related";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { specPairs } from "@/lib/parts/specs";
import { breadcrumbJsonLd, itemListJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

// Part pages are complete HTML for search engines, prerendered per slug below: no streamed
// placeholder, so the route is allowed to block instead of offering an instant shell.
export const instant = false;

export async function generateStaticParams() {
  const { gpu_chips } = await getCatalog();
  return gpu_chips.map((chip) => ({ chip: chip.slug }));
}

export async function generateMetadata({ params }: PageProps<"/gpu/[chip]">): Promise<Metadata> {
  const { chip: chipSlug } = await params;
  const catalog = await getCatalog();
  const chip = catalog.gpu_chips.find((c) => c.slug === chipSlug);
  if (!chip) notFound();
  const count = boardsOfChip(catalog, chip).length;
  return pageMetadata({
    title: chipTitle(chip, count),
    description: metaDescription(chipDescription(chip, count)),
    path: partPath.gpuChip(chip),
  });
}

export default async function GpuChipPage({ params }: PageProps<"/gpu/[chip]">) {
  const { chip: chipSlug } = await params;
  const catalog = await getCatalog();
  const chip = catalog.gpu_chips.find((c) => c.slug === chipSlug);
  if (!chip) notFound();

  const section = PART_SECTIONS.gpu;
  const groups = chipSpecs(chip);
  const path = partPath.gpuChip(chip);
  const boards = boardsOfChip(catalog, chip);
  const table = comparisonRows(chip, boards);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name: chip.name,
            brand: vendorName(chip.vendor),
            category: section.singular,
            description: metaDescription(chipDescription(chip, boards.length)),
            path,
            specs: specPairs(groups),
          }),
          itemListJsonLd({
            name: `${chip.name} card models`,
            items: boards.map((board) => ({
              name: boardName(board),
              path: partPath.gpuBoard(chip, board),
            })),
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: section.title, path: section.path },
            { name: chip.name, path },
          ]),
        ]}
      />
      <PartPage
        trail={[
          { name: "Home", href: "/" },
          { name: section.title, href: section.path },
          { name: chip.name },
        ]}
        title={chip.name}
        lead={chipLead(chip, boards.length)}
        aside={
          <IndexBadge
            label="GPU index"
            value={chip.perf_index}
            verified={chip.perf_index_verified}
            reference={GPU_INDEX_REFERENCE}
          />
        }
        actions={
          <p className="text-muted-foreground text-base">
            Pick a card model below to build with it.
          </p>
        }
        side={
          <>
            <PartList
              title={`Other ${chip.series} chips`}
              headingLevel={2}
              empty="No other chips in this series yet."
              items={chipsInSeries(catalog, chip).map((other) => ({
                href: partPath.gpuChip(other),
                name: other.name,
                detail: `${other.vram_gb} GB, GPU index ${other.perf_index}`,
              }))}
            />
            <AdSlot id="part-side" size="rectangle" />
          </>
        }
      >
        <SpecTable groups={groups} />
        <AdSlot id="part-below-specs" size="banner" />
        <BoardComparison chip={chip} rows={table} />
        <DataStatus verified={chip.verified} sourceNotes={chip.source_notes} />
      </PartPage>
    </>
  );
}
