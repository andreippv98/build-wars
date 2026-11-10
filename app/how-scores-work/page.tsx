import type { Metadata } from "next";
import Link from "next/link";
import { AdSlot } from "@/components/ad-slot";
import { Formula, Section } from "@/components/methodology/section";
import { JsonLd } from "@/components/part/json-ld";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { buildHref } from "@/lib/build";
import { ENGINE_CONFIG } from "@/lib/engine";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { pageMetadata } from "@/lib/seo/metadata";

const PATH = "/how-scores-work";

export function generateMetadata(): Metadata {
  return pageMetadata({
    title: "How the Build Score works",
    description:
      "How Build Wars turns a CPU, graphics card and RAM into one relative gaming score, how the power estimate is made, and what the numbers do not tell you.",
    path: PATH,
  });
}

const REFERENCE_HREF = buildHref({
  cpu: "ryzen-7-9800x3d",
  gpu: "nvidia-rtx-5090-founders-edition",
  ram: "ddr5-32gb-2x16-6000-cl30",
  motherboard: "asus-rog-strix-x870-a-gaming-wifi",
  psu: "asus-rog-thor-1200p2",
});

const { score, power } = ENGINE_CONFIG;
const pct = (factor: number) => Math.round(Math.abs(factor - 1) * 100);

/** The page's worked example, computed from the engine's weights so it cannot go stale. */
function workedExample() {
  const gpu = 100;
  const cpu = 40;
  const ram = 1;
  const geometric = gpu ** score.gpuWeight * cpu ** score.cpuWeight * ram;
  const average = score.gpuWeight * gpu + score.cpuWeight * cpu;
  return { gpu, cpu, ram, geometric: Math.round(geometric), average: Math.round(average) };
}

/** Label of a RAM capacity tier, ascending order: "Under 16 GB", "16 GB", "32 GB or more". */
function capacityLabel(index: number): string {
  const tiers = [...score.ramCapacity].reverse();
  if (index === tiers.length - 1) return `${tiers[index].minGb} GB or more`;
  if (index === 0) return `Under ${tiers[1].minGb} GB`;
  return `${tiers[index].minGb} GB`;
}

function bandRange(index: number): string {
  const bands = score.bands;
  const band = bands[index];
  if (index === 0) return `${band.min}+`;
  if (index === bands.length - 1) return `Under ${bands[index - 1].min}`;
  return `${band.min} to ${bands[index - 1].min - 1}`;
}

export default function HowScoresWorkPage() {
  const example = workedExample();
  const capacity = [...score.ramCapacity].reverse();
  const speedPct = pct(score.ramSpeed.max);
  const baseline = power.motherboardW;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-10 md:py-14">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "How scores work", path: PATH },
        ])}
      />

      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          How the Build Score works
        </h1>
        <p className="text-muted-foreground text-lg">
          The Build Score is one number that says how strong a PC is for gaming, compared with a
          fixed reference build. This page explains exactly how it is calculated, where the inputs
          come from and what it cannot tell you.
        </p>
      </header>

      <Section id="what-it-is" title="What the Build Score is, and is not">
        <p>
          It is a <strong>relative gaming number</strong>. A build that scores 50 is about half as
          strong for gaming as the reference build below, and a build that scores 100 is as strong
          as it.
        </p>
        <p>It is not:</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>a frames-per-second prediction for any game,</li>
          <li>a price or value-for-money rating,</li>
          <li>a bottleneck detector that tells you which part is holding another back.</li>
        </ul>
        <p>
          Use it to compare builds with each other, not to promise a result in a particular game.
        </p>
      </Section>

      <Section id="reference-build" title="The reference build that scores 100">
        <p>
          Every score is measured against one fixed build: a GeForce RTX 5090, a Ryzen 7 9800X3D and
          32 GB of DDR5-6000 memory. It scores <strong data-testid="reference-score">100</strong> by
          definition.
        </p>
        <p>
          The anchor never moves. A saved build keeps its score over time, and a future flagship can
          score above 100 instead of the scale being reset.
        </p>
        <div>
          <Link href={REFERENCE_HREF} className={buttonVariants({ variant: "outline" })}>
            Open the reference build
          </Link>
        </div>
      </Section>

      <Section id="inputs" title="The three inputs">
        <h3 className="mt-2 font-medium">CPU index (C)</h3>
        <p className="text-muted-foreground">
          Gaming performance relative to the Ryzen 7 9800X3D, which is 100. It comes from CPU-bound
          tests: 1080p with a top graphics card, so the processor is what limits the result.
        </p>
        <h3 className="mt-2 font-medium">GPU index (G)</h3>
        <p className="text-muted-foreground">
          The graphics chip&apos;s index relative to the RTX 5090, which is 100, based on a 1440p
          gaming average. It is then adjusted for the specific card model, because
          factory-overclocked cards run a little faster than the reference clock:
        </p>
        <Formula>
          G = chip index × clamp(1 + {score.boardFactor.sensitivity} × (card boost clock ÷ reference
          boost clock − 1), {score.boardFactor.min}, {score.boardFactor.max})
        </Formula>
        <p className="text-muted-foreground">
          The adjustment can lower a chip&apos;s index by at most {pct(score.boardFactor.min)}% and
          raise it by at most {pct(score.boardFactor.max)}%.
        </p>
        <h3 className="mt-2 font-medium">RAM factor (R)</h3>
        <p className="text-muted-foreground">
          A multiplier for capacity and speed. Capacity sets the base:{" "}
          {capacity.map((tier, i) => `${capacityLabel(i)} = ${tier.factor.toFixed(2)}`).join("; ")}.
          Speed then adjusts it by up to ±{speedPct}% against the platform&apos;s typical speed
          (DDR4-{score.ramSpeed.typical.DDR4}, DDR5-{score.ramSpeed.typical.DDR5}).
        </p>
        <p className="text-muted-foreground">
          The motherboard and the power supply do not change the score. They only feed the
          compatibility and power checks.
        </p>
      </Section>

      <Section id="formula" title="The formula">
        <p>
          The score is a weighted geometric mean, so a very weak part pulls the result down more
          than a simple average would:
        </p>
        <Formula testId="formula">
          Build Score = G^{score.gpuWeight} × C^{score.cpuWeight} × R
        </Formula>
        <p>
          Example: a top graphics card (G = {example.gpu}) with a weak processor (C = {example.cpu})
          and R = {example.ram}.
        </p>
        <Formula testId="worked-example">
          {example.gpu}^{score.gpuWeight} × {example.cpu}^{score.cpuWeight} × {example.ram} ≈{" "}
          <strong data-testid="worked-geometric">{example.geometric}</strong>
        </Formula>
        <p className="text-muted-foreground">
          A plain weighted average of the same numbers would give{" "}
          <span data-testid="worked-average">{example.average}</span>. The geometric result is lower
          because the weak processor drags the whole build down.
        </p>
      </Section>

      <Section id="bands" title="Score bands">
        <p>The score also maps to a band, as a quick description of what to expect.</p>
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-card text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-medium">
                  Score
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  Band
                </th>
                <th scope="col" className="px-4 py-2 font-medium">
                  What it means
                </th>
              </tr>
            </thead>
            <tbody>
              {score.bands.map((band, index) => (
                <tr key={band.label} className="border-border border-t align-top">
                  <td className="px-4 py-2 whitespace-nowrap tabular-nums">{bandRange(index)}</td>
                  <th scope="row" className="px-4 py-2 font-medium whitespace-nowrap">
                    {band.label}
                  </th>
                  <td className="text-muted-foreground px-4 py-2">{band.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="sources" title="Where the numbers come from">
        <p>
          The CPU and GPU indexes are entered by hand from averages across several published
          reviews, and the sources are stored with them. Benchmark tables from review sites are not
          copied or scraped.
        </p>
        <p>
          Every index carries a verified flag. When a build uses an unverified value, its score is
          shown with an <Badge variant="outline">Estimate</Badge> badge.
        </p>
        <p className="border-border bg-card rounded-lg border px-4 py-3">
          <strong>Right now every index in the catalog is a placeholder.</strong> None has been
          verified yet, so every score you see is marked as an estimate. Real values are added by
          hand from published reviews, and this page will say so when that changes.
        </p>
      </Section>

      <Section id="power" title="Power estimate and recommended power supply">
        <p>The estimated peak draw while gaming is the sum of:</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>the graphics card&apos;s board power,</li>
          <li>
            the processor&apos;s package power, capped at {power.cpuGamingCapW} W because games
            rarely push a CPU to its maximum,
          </li>
          <li>
            a platform allowance: about {baseline} W for the motherboard, {power.perRamStickW} W per
            memory stick, and {power.storageAndFansW} W for storage and fans.
          </li>
        </ul>
        <p>
          The recommended power supply is the peak × {power.psuMultiplier}, rounded up to the next{" "}
          {power.psuRoundToW} W. For graphics cards known for large power spikes it uses ×{" "}
          {power.psuMultiplierSpiky} instead, unless the power supply is ATX 3.x, which is built to
          handle them.
        </p>
        <p>The headroom bar compares your power supply with those two numbers:</p>
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>
            <strong className="text-emerald-400">Green</strong>: at least the recommended wattage.
          </li>
          <li>
            <strong className="text-amber-400">Amber</strong>: above the estimated peak but under
            the recommendation. It should run, with little margin.
          </li>
          <li>
            <strong className="text-red-400">Red</strong>: below the estimated peak. Choose a larger
            power supply.
          </li>
        </ul>
      </Section>

      <Section id="compatibility" title="What the compatibility checks do">
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>
            <strong className="text-foreground">Errors</strong> mean the parts cannot work together
            as chosen, for example a CPU that does not fit the motherboard&apos;s socket. A build
            with an error gets no final score.
          </li>
          <li>
            <strong className="text-foreground">Warnings</strong> are caveats: it can work, but you
            should know something, such as a BIOS update being needed. The score is still shown.
          </li>
        </ul>
      </Section>

      <Section id="limits" title="Limits: what the score ignores">
        <ul className="text-muted-foreground list-disc space-y-1 pl-5">
          <li>
            The motherboard and the power supply do not change the score, beyond making a build work
            or not.
          </li>
          <li>Cooling, storage and the case are not modelled.</li>
          <li>
            It is one number for gaming. It says nothing about video editing, rendering or other
            work.
          </li>
          <li>
            All of it is an estimate. Real results vary with the game, settings, drivers and the
            individual parts.
          </li>
        </ul>
      </Section>

      <div className="border-border flex flex-col items-start gap-3 border-t pt-8">
        <h2 className="text-xl font-semibold tracking-tight">Try it on your own parts</h2>
        <p className="text-muted-foreground">
          Pick parts, see whether they work together and what the score is. No account needed.
        </p>
        <Link href="/build" className={buttonVariants({ size: "lg" })}>
          Start a build
        </Link>
      </div>

      <AdSlot id="methodology-end" size="banner" />
    </main>
  );
}
