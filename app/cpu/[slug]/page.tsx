import type { Metadata } from "next";
import { notFound } from "next/navigation";
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
  CPU_INDEX_REFERENCE,
  cpuDescription,
  cpuLead,
  cpuSpecs,
  cpuTitle,
  otherCpus,
} from "@/lib/parts/cpu";
import { vendorName } from "@/lib/parts/format";
import { boardsForCpu } from "@/lib/parts/related";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { specPairs } from "@/lib/parts/specs";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

// Part pages are complete HTML for search engines, prerendered per slug below: no streamed
// placeholder, so the route is allowed to block instead of offering an instant shell.
export const instant = false;

export async function generateStaticParams() {
  const { cpus } = await getCatalog();
  return cpus.map((cpu) => ({ slug: cpu.slug }));
}

export async function generateMetadata({ params }: PageProps<"/cpu/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const { cpus } = await getCatalog();
  const cpu = cpus.find((c) => c.slug === slug);
  if (!cpu) notFound();
  return pageMetadata({
    title: cpuTitle(cpu),
    description: metaDescription(cpuDescription(cpu)),
    path: partPath.cpu(cpu),
  });
}

export default async function CpuPage({ params }: PageProps<"/cpu/[slug]">) {
  const { slug } = await params;
  const catalog = await getCatalog();
  const cpu = catalog.cpus.find((c) => c.slug === slug);
  if (!cpu) notFound();

  const section = PART_SECTIONS.cpu;
  const groups = cpuSpecs(cpu);
  const path = partPath.cpu(cpu);
  const boards = boardsForCpu(catalog, cpu);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd({
            name: cpu.name,
            brand: vendorName(cpu.vendor),
            category: section.singular,
            description: metaDescription(cpuDescription(cpu)),
            path,
            specs: specPairs(groups),
          }),
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: section.title, path: section.path },
            { name: cpu.name, path },
          ]),
        ]}
      />
      <PartPage
        trail={[
          { name: "Home", href: "/" },
          { name: section.title, href: section.path },
          { name: cpu.name },
        ]}
        title={cpu.name}
        lead={cpuLead(cpu)}
        aside={
          <IndexBadge
            label="CPU index"
            value={cpu.perf_index}
            verified={cpu.perf_index_verified}
            reference={CPU_INDEX_REFERENCE}
          />
        }
        actions={
          <BuildWithThis href={buildHref({ cpu: cpu.id })} label="Build with this processor" />
        }
        side={
          <>
            <PartList
              title="Other processors"
              headingLevel={2}
              empty="No other processors for this socket yet."
              items={otherCpus(catalog.cpus, cpu).map((other) => ({
                href: partPath.cpu(other),
                name: other.name,
                detail: `${other.cores} cores, CPU index ${other.perf_index}`,
              }))}
            />
            <AdSlot id="part-side" size="rectangle" />
          </>
        }
      >
        <SpecTable groups={groups} />
        <AdSlot id="part-below-specs" size="banner" />
        <PartList
          title="Compatible motherboards"
          empty="No motherboards in the catalog take this processor yet."
          items={boards.map(({ board, needsBiosUpdate }) => ({
            href: partPath.motherboard(board),
            name: `${board.maker} ${board.model}`,
            detail: `${board.socket}, ${board.form_factor}, ${board.mem_type}`,
            badge: needsBiosUpdate ? "Needs BIOS update" : undefined,
          }))}
        />
        <DataStatus verified={cpu.verified} sourceNotes={cpu.source_notes} />
      </PartPage>
    </>
  );
}
