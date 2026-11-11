import type { Metadata } from "next";
import { JsonLd } from "@/components/part/json-ld";
import { PartIndex } from "@/components/part/part-index";
import { getCatalog } from "@/lib/catalog/server";
import { watts } from "@/lib/parts/format";
import { efficiencyLabel, modularLabel, psusByWattage } from "@/lib/parts/psu";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Power supplies: wattage, connectors and compatible graphics cards";

export async function generateMetadata(): Promise<Metadata> {
  const { psus } = await getCatalog();
  const wattages = psus.map((p) => p.watts);
  const range =
    psus.length > 0
      ? `from ${watts(Math.min(...wattages))} to ${watts(Math.max(...wattages))}`
      : "";
  return pageMetadata({
    title: TITLE,
    description: metaDescription(
      `${psus.length} power supplies ${range}: efficiency rating, modularity, ATX 3.x and the connectors for graphics cards.`,
    ),
    path: PART_SECTIONS.psu.path,
  });
}

export default async function PsuIndexPage() {
  const { psus } = await getCatalog();
  const section = PART_SECTIONS.psu;
  const groups = psusByWattage(psus);
  return (
    <>
      <JsonLd
        data={[
          itemListJsonLd({
            name: section.title,
            items: groups.flatMap((g) =>
              g.psus.map((psu) => ({
                name: `${psu.maker} ${psu.model}`,
                path: partPath.psu(psu),
              })),
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
        title="Power supplies"
        intro="Every power supply in the catalog, grouped by wattage with the highest first. Open one for its specs, its connectors and the graphics cards it can power."
        groups={groups.map((group) => ({
          heading: group.heading,
          items: group.psus.map((psu) => ({
            href: partPath.psu(psu),
            name: `${psu.maker} ${psu.model}`,
            detail: `${efficiencyLabel(psu.efficiency)}, ${modularLabel(psu.modular)}${psu.atx3 ? ", ATX 3.x" : ""}`,
            value: watts(psu.watts),
          })),
        }))}
      />
    </>
  );
}
