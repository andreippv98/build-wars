import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { BuildWithThis } from "@/components/part/build-with-this";
import { DataStatus } from "@/components/part/data-status";
import { IndexBadge } from "@/components/part/index-badge";
import { JsonLd } from "@/components/part/json-ld";
import { PartList } from "@/components/part/part-list";
import { PartPage } from "@/components/part/part-page";
import { SpecTable } from "@/components/part/spec-table";
import { buildHref } from "@/lib/build";
import { getCatalog } from "@/lib/catalog/server";
import {
  GPU_INDEX_REFERENCE,
  boardDescription,
  boardIndex,
  boardLead,
  boardName,
  boardSpecs,
  boardTitle,
  slotText,
} from "@/lib/parts/gpu";
import { watts } from "@/lib/parts/format";
import { boardsOfChip, psusForGpu } from "@/lib/parts/related";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { specPairs } from "@/lib/parts/specs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

// Part pages are complete HTML for search engines, prerendered per slug below: no streamed
// placeholder, so the route is allowed to block instead of offering an instant shell.
export const instant = false;

const EFFICIENCY_WORDS: Record<string, string> = {
  white: "80 Plus White",
  bronze: "80 Plus Bronze",
  silver: "80 Plus Silver",
  gold: "80 Plus Gold",
  platinum: "80 Plus Platinum",
  titanium: "80 Plus Titanium",
};

export async function generateStaticParams() {
  const { gpu_chips, gpu_boards } = await getCatalog();
  return gpu_boards.flatMap((board) => {
    const chip = gpu_chips.find((c) => c.id === board.chip_id);
    return chip ? [{ chip: chip.slug, board: board.slug }] : [];
  });
}

async function findCard(chipSlug: string, boardSlug: string) {
  const catalog = await getCatalog();
  const chip = catalog.gpu_chips.find((c) => c.slug === chipSlug);
  const board = chip
    ? catalog.gpu_boards.find((b) => b.chip_id === chip.id && b.slug === boardSlug)
    : undefined;
  if (!chip || !board) notFound();
  return { catalog, chip, board };
}

export async function generateMetadata({
  params,
}: PageProps<"/gpu/[chip]/[board]">): Promise<Metadata> {
  const { chip: chipSlug, board: boardSlug } = await params;
  const { chip, board } = await findCard(chipSlug, boardSlug);
  return pageMetadata({
    title: boardTitle(chip, board),
    description: metaDescription(boardDescription(chip, board)),
    path: partPath.gpuBoard(chip, board),
  });
}

export default async function GpuBoardPage({ params }: PageProps<"/gpu/[chip]/[board]">) {
  const { chip: chipSlug, board: boardSlug } = await params;
  const { catalog, chip, board } = await findCard(chipSlug, boardSlug);

  const section = PART_SECTIONS.gpu;
  const groups = boardSpecs(chip, board);
  const path = partPath.gpuBoard(chip, board);
  const chipPath = partPath.gpuChip(chip);
  const name = boardName(board);
  const allBoards = boardsOfChip(catalog, chip);
  const others = allBoards.filter((b) => b.id !== board.id);
  const psus = psusForGpu(catalog, { chip, board });

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name,
            brand: board.maker,
            category: section.singular,
            description: metaDescription(boardDescription(chip, board)),
            path,
            specs: specPairs(groups),
            variantOfPath: chipPath,
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: section.title, path: section.path },
            { name: chip.name, path: chipPath },
            { name, path },
          ]),
        ]}
      />
      <PartPage
        trail={[
          { name: "Home", href: "/" },
          { name: section.title, href: section.path },
          { name: chip.name, href: chipPath },
          { name },
        ]}
        title={name}
        lead={boardLead(chip, board)}
        aside={
          <IndexBadge
            label="GPU index"
            value={boardIndex(chip, board)}
            verified={chip.perf_index_verified}
            reference={GPU_INDEX_REFERENCE}
          />
        }
        actions={
          <BuildWithThis
            href={buildHref({ gpu: board.id })}
            label="Build with this graphics card"
          />
        }
        side={
          <>
            <section className="flex flex-col gap-3">
              <h2 className="text-xl font-semibold tracking-tight">About the chip</h2>
              <p className="text-muted-foreground text-sm leading-relaxed">
                This card is built on the {chip.name}, which carries the performance index.
              </p>
              <Link
                href={chipPath}
                className="text-primary w-fit text-sm underline underline-offset-4 hover:no-underline"
              >
                {chip.name} specs and all card models
              </Link>
            </section>
            <AdSlot id="part-side" size="rectangle" />
          </>
        }
      >
        <SpecTable groups={groups} />
        <AdSlot id="part-below-specs" size="banner" />
        <div className="flex flex-col gap-3">
          <PartList
            title="Power supplies that fit"
            empty="No power supplies in the catalog have the connectors and wattage this card needs yet."
            items={psus.map(({ psu, fit }) => ({
              href: partPath.psu(psu),
              name: `${psu.maker} ${psu.model}`,
              detail: `${watts(psu.watts)}, ${EFFICIENCY_WORDS[psu.efficiency] ?? psu.efficiency}`,
              badge: fit === "adapter" ? "Needs adapter" : undefined,
            }))}
          />
          <p className="text-muted-foreground text-sm">
            Listed power supplies have the connectors and at least the wattage this card&apos;s
            maker recommends. Your whole build may need more: check the estimate in the
            configurator.
          </p>
        </div>
        <PartList
          title={`Other ${chip.name} cards`}
          empty="This is the only card model of this chip in the catalog."
          items={[
            {
              href: chipPath,
              name: `Compare all ${allBoards.length} models`,
              detail: `Side by side on the ${chip.name} page`,
            },
            ...others.map((other) => ({
              href: partPath.gpuBoard(chip, other),
              name: boardName(other),
              detail: `${other.length_mm} mm, ${slotText(other.slots)}, ${other.boost_mhz} MHz`,
            })),
          ]}
        />
        <DataStatus verified={board.verified} sourceNotes={board.source_notes} />
      </PartPage>
    </>
  );
}
