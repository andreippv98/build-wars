import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdSlot } from "@/components/ad-slot";
import { BuildWithThis } from "@/components/part/build-with-this";
import { DataStatus } from "@/components/part/data-status";
import { JsonLd } from "@/components/part/json-ld";
import { PartList } from "@/components/part/part-list";
import { PartPage } from "@/components/part/part-page";
import { SpecTable } from "@/components/part/spec-table";
import { buildHref } from "@/lib/build";
import { getCatalog } from "@/lib/catalog/server";
import {
  motherboardDescription,
  motherboardLead,
  motherboardName,
  motherboardSpecs,
  motherboardTitle,
  otherMotherboards,
} from "@/lib/parts/motherboard";
import { cpusForBoard } from "@/lib/parts/related";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { specPairs } from "@/lib/parts/specs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

// Part pages are complete HTML for search engines, prerendered per slug below: no streamed
// placeholder, so the route is allowed to block instead of offering an instant shell.
export const instant = false;

export async function generateStaticParams() {
  const { motherboards } = await getCatalog();
  return motherboards.map((board) => ({ slug: board.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/motherboard/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { motherboards, chipsets } = await getCatalog();
  const board = motherboards.find((b) => b.slug === slug);
  if (!board) notFound();
  const chipset = chipsets.find((c) => c.id === board.chipset_id);
  if (!chipset) notFound();
  return pageMetadata({
    title: motherboardTitle(board),
    description: metaDescription(motherboardDescription(board, chipset)),
    path: partPath.motherboard(board),
  });
}

export default async function MotherboardPage({ params }: PageProps<"/motherboard/[slug]">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const board = catalog.motherboards.find((b) => b.slug === slug);
  if (!board) notFound();
  const chipset = catalog.chipsets.find((c) => c.id === board.chipset_id);
  if (!chipset) notFound();

  const section = PART_SECTIONS.motherboard;
  const name = motherboardName(board);
  const groups = motherboardSpecs(board, chipset);
  const path = partPath.motherboard(board);
  const cpus = cpusForBoard(catalog, board);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name,
            brand: board.maker,
            category: section.singular,
            description: metaDescription(motherboardDescription(board, chipset)),
            path,
            specs: specPairs(groups),
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: section.title, path: section.path },
            { name, path },
          ]),
        ]}
      />
      <PartPage
        trail={[{ name: "Home", href: "/" }, { name: section.title, href: section.path }, { name }]}
        title={name}
        lead={motherboardLead(board, chipset)}
        actions={
          <BuildWithThis
            href={buildHref({ motherboard: board.id })}
            label="Build with this motherboard"
          />
        }
        side={
          <>
            <PartList
              title="Other motherboards"
              headingLevel={2}
              empty="No other motherboards for this socket yet."
              items={otherMotherboards(catalog.motherboards, board).map((other) => ({
                href: partPath.motherboard(other),
                name: motherboardName(other),
                detail: `${other.form_factor}, ${other.mem_type}`,
              }))}
            />
            <AdSlot id="part-side" size="rectangle" />
          </>
        }
      >
        <SpecTable groups={groups} />
        <AdSlot id="part-below-specs" size="banner" />
        <PartList
          title="Compatible processors"
          empty="No processors in the catalog fit this motherboard yet."
          items={cpus.map(({ cpu, needsBiosUpdate }) => ({
            href: partPath.cpu(cpu),
            name: cpu.name,
            detail: `${cpu.cores} cores, CPU index ${cpu.perf_index}`,
            badge: needsBiosUpdate ? "Needs BIOS update" : undefined,
          }))}
        />
        <DataStatus verified={board.verified} sourceNotes={board.source_notes} />
      </PartPage>
    </>
  );
}
