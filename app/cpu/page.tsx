import type { Metadata } from "next";
import { JsonLd } from "@/components/part/json-ld";
import { PartIndex } from "@/components/part/part-index";
import { getCatalog } from "@/lib/catalog/server";
import { cpusBySocket } from "@/lib/parts/cpu";
import { PART_SECTIONS, partPath } from "@/lib/parts/routes";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo/json-ld";
import { metaDescription, pageMetadata } from "@/lib/seo/metadata";

const TITLE = "Desktop processors: specs and CPU index";

export async function generateMetadata(): Promise<Metadata> {
  const { cpus } = await getCatalog();
  const sockets = [...new Set(cpus.map((c) => c.socket))];
  return pageMetadata({
    title: TITLE,
    description: metaDescription(
      `${cpus.length} desktop processors from AMD and Intel on ${sockets.join(", ")}: cores, clocks, memory support, CPU index and the motherboards each one fits.`,
    ),
    path: PART_SECTIONS.cpu.path,
  });
}

export default async function CpuIndexPage() {
  const { cpus } = await getCatalog();
  const section = PART_SECTIONS.cpu;
  const groups = cpusBySocket(cpus);
  return (
    <>
      <JsonLd
        data={[
          itemListJsonLd({
            name: section.title,
            items: groups.flatMap((g) =>
              g.cpus.map((cpu) => ({ name: cpu.name, path: partPath.cpu(cpu) })),
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
        title="Desktop processors"
        intro="Every processor in the catalog, grouped by socket with the newest first. Open one for its specs, its CPU index and the motherboards it works on."
        groups={groups.map((group) => ({
          heading: `${group.socket} socket`,
          items: group.cpus.map((cpu) => ({
            href: partPath.cpu(cpu),
            name: cpu.name,
            detail: `${cpu.cores} cores / ${cpu.threads} threads, ${cpu.year}, ${cpu.mem_types.join(" / ")}`,
            value: `Index ${cpu.perf_index}`,
          })),
        }))}
      />
    </>
  );
}
