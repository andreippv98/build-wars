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
import { watts } from "@/lib/parts/format";
import {
  efficiencyLabel,
  otherPsus,
  psuDescription,
  psuLead,
  psuName,
  psuSpecs,
  psuTitle,
} from "@/lib/parts/psu";
import { gpusForPsu } from "@/lib/parts/related";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { specPairs } from "@/lib/parts/specs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

// Part pages are complete HTML for search engines, prerendered per slug below: no streamed
// placeholder, so the route is allowed to block instead of offering an instant shell.
export const instant = false;

export async function generateStaticParams() {
  const { psus } = await getCatalog();
  return psus.map((psu) => ({ slug: psu.slug }));
}

export async function generateMetadata({ params }: PageProps<"/psu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { psus } = await getCatalog();
  const psu = psus.find((p) => p.slug === slug);
  if (!psu) notFound();
  return pageMetadata({
    title: psuTitle(psu),
    description: metaDescription(psuDescription(psu)),
    path: partPath.psu(psu),
  });
}

export default async function PsuPage({ params }: PageProps<"/psu/[slug]">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const psu = catalog.psus.find((p) => p.slug === slug);
  if (!psu) notFound();

  const section = PART_SECTIONS.psu;
  const groups = psuSpecs(psu);
  const path = partPath.psu(psu);
  const name = psuName(psu);
  const gpus = gpusForPsu(catalog, psu).sort(
    (a, b) =>
      b.chip.perf_index - a.chip.perf_index ||
      `${a.board.maker} ${a.board.model}`.localeCompare(`${b.board.maker} ${b.board.model}`),
  );

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name,
            brand: psu.maker,
            category: section.singular,
            description: metaDescription(psuDescription(psu)),
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
        lead={psuLead(psu)}
        actions={
          <BuildWithThis href={buildHref({ psu: psu.id })} label="Build with this power supply" />
        }
        side={
          <>
            <PartList
              title="Other power supplies"
              headingLevel={2}
              empty="No other power supplies yet."
              items={otherPsus(catalog.psus, psu).map((other) => ({
                href: partPath.psu(other),
                name: psuName(other),
                detail: `${watts(other.watts)}, ${efficiencyLabel(other.efficiency)}`,
              }))}
            />
            <AdSlot id="part-side" size="rectangle" />
          </>
        }
      >
        <SpecTable groups={groups} />
        <AdSlot id="part-below-specs" size="banner" />
        <div className="flex flex-col gap-3">
          <PartList
            title="Graphics cards it can connect"
            empty="No graphics cards in the catalog match this power supply's connectors yet."
            items={gpus.map(({ board, chip, fit }) => ({
              href: partPath.gpuBoard(chip, board),
              name: `${board.maker} ${board.model}`,
              detail: `${board.power_w} W, recommended PSU ${board.rec_psu_w} W`,
              badge: fit === "adapter" ? "Needs adapter" : undefined,
            }))}
          />
          <p className="text-muted-foreground text-sm">
            This list checks connectors only. Whether the wattage is enough depends on the whole
            build: add the parts in the configurator to see the estimated draw and headroom.
          </p>
        </div>
        <DataStatus verified={psu.verified} sourceNotes={psu.source_notes} />
      </PartPage>
    </>
  );
}
