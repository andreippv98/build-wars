import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { JsonLd } from "@/components/part/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { buildHref } from "@/lib/build";
import { getCatalog } from "@/lib/catalog/server";
import { PART_SECTIONS } from "@/lib/parts/routes";
import { websiteJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "PC build configurator for used parts",
    description:
      "Check that a used CPU, graphics card, motherboard, RAM and power supply work together, and see one Build Score and a power estimate. Free, no account needed.",
    path: "/",
  });
}

const REFERENCE_HREF = buildHref({
  cpu: "ryzen-7-9800x3d",
  gpu: "nvidia-rtx-5090-founders-edition",
  ram: "ddr5-32gb-2x16-6000-cl30",
  motherboard: "asus-rog-strix-x870-a-gaming-wifi",
  psu: "asus-rog-thor-1200p2",
});

const FEATURES = [
  {
    title: "Compatibility checks",
    text: "Socket, memory type, BIOS support, card length and power connectors are checked as you pick, in plain language.",
  },
  {
    title: "One Build Score",
    text: "A single relative gaming number, measured against a fixed reference build, with the method written down.",
  },
  {
    title: "Power and PSU",
    text: "An estimated peak draw and a recommended power supply size, with a clear headroom bar.",
  },
  {
    title: "Share by link",
    text: "The whole build lives in the address, so you can send it to a friend. No account is needed to try it.",
  },
];

export default async function Home() {
  const catalog = await getCatalog();
  const sections = [
    { section: PART_SECTIONS.cpu, count: catalog.cpus.length },
    { section: PART_SECTIONS.gpu, count: catalog.gpu_boards.length },
    { section: PART_SECTIONS.motherboard, count: catalog.motherboards.length },
    { section: PART_SECTIONS.psu, count: catalog.psus.length },
  ];

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-14 px-4 py-12 md:py-20">
      <JsonLd data={websiteJsonLd()} />

      <header className="flex max-w-2xl flex-col gap-5">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
          Will these used parts work together, and how strong is the build?
        </h1>
        <p className="text-muted-foreground text-lg">
          Build Wars is a free PC build configurator for people buying used parts. Pick a processor,
          graphics card, memory, motherboard and power supply from 2018 onward, and see right away
          whether the combination works and how it scores.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/build" className={buttonVariants({ size: "lg" })}>
            Start a build
          </Link>
          <Link
            href={REFERENCE_HREF}
            className={buttonVariants({ size: "lg", variant: "outline" })}
          >
            See the reference build
          </Link>
        </div>
      </header>

      <section aria-labelledby="features" className="flex flex-col gap-5">
        <h2 id="features" className="text-xl font-semibold tracking-tight">
          What you get
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <li key={feature.title} className="border-border bg-card rounded-lg border p-4">
              <h3 className="font-medium">{feature.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{feature.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="parts" className="flex flex-col gap-5">
        <h2 id="parts" className="text-xl font-semibold tracking-tight">
          Browse the parts
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {sections.map(({ section, count }) => (
            <li key={section.path}>
              <Link
                href={section.path}
                className="border-border hover:bg-muted flex items-baseline justify-between gap-3 rounded-lg border px-4 py-3 transition-colors"
              >
                <span className="font-medium">{section.title}</span>
                <span className="text-muted-foreground text-sm tabular-nums">{count} listed</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="method" className="flex max-w-2xl flex-col gap-3">
        <h2 id="method" className="text-xl font-semibold tracking-tight">
          Numbers you can check
        </h2>
        <p className="text-muted-foreground">
          The score is an estimate, and the page that explains it says so plainly: what goes in,
          where the numbers come from and what the score ignores.
        </p>
        <p>
          <Link href="/how-scores-work" className="underline underline-offset-4">
            How scores work
          </Link>
        </p>
      </section>

      <AdSlot id="home-end" size="banner" />
    </main>
  );
}
