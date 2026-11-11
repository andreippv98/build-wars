import type { Metadata } from "next";
import { JsonLd } from "@/components/part/json-ld";
import { PartIndex } from "@/components/part/part-index";
import { getCatalog } from "@/lib/catalog/server";
import { motherboardName, motherboardsBySocket } from "@/lib/parts/motherboard";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Motherboards: specs and compatible processors";

export async function generateMetadata(): Promise<Metadata> {
  const { motherboards } = await getCatalog();
  const sockets = [...new Set(motherboards.map((b) => b.socket))];
  return pageMetadata({
    title: TITLE,
    description: metaDescription(
      `${motherboards.length} motherboards on ${sockets.join(", ")}: chipset, form factor, memory support, expansion slots and the processors each one takes.`,
    ),
    path: PART_SECTIONS.motherboard.path,
  });
}

export default async function MotherboardIndexPage() {
  const { motherboards } = await getCatalog();
  const section = PART_SECTIONS.motherboard;
  const groups = motherboardsBySocket(motherboards);
  return (
    <>
      <JsonLd
        data={[
          itemListJsonLd({
            name: section.title,
            items: groups.flatMap((g) =>
              g.boards.map((board) => ({
                name: motherboardName(board),
                path: partPath.motherboard(board),
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
        title="Motherboards"
        intro="Every motherboard in the catalog, grouped by socket. Open one for its chipset, memory support and the processors it takes."
        groups={groups.map((group) => ({
          heading: `${group.socket} socket`,
          items: group.boards.map((board) => ({
            href: partPath.motherboard(board),
            name: motherboardName(board),
            detail: `${board.form_factor}, ${board.mem_type}, ${board.ram_slots} memory slots`,
          })),
        }))}
      />
    </>
  );
}
