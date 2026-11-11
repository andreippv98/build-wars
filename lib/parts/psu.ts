import type { Psu } from "@/lib/schemas";
import { plural, watts, yesNo } from "./format";
import type { SpecGroup } from "./specs";

type PsuEfficiency = Psu["efficiency"];

/** Length of the "Other power supplies" list. */
export const OTHER_PSU_LIMIT = 6;

const EFFICIENCY_LABELS: Record<PsuEfficiency, string> = {
  white: "80 Plus White",
  bronze: "80 Plus Bronze",
  silver: "80 Plus Silver",
  gold: "80 Plus Gold",
  platinum: "80 Plus Platinum",
  titanium: "80 Plus Titanium",
};

const MODULAR_LABELS: Record<Psu["modular"], string> = {
  full: "Fully modular",
  semi: "Semi-modular",
  none: "Non-modular (fixed cables)",
};

const MODULAR_PHRASES: Record<Psu["modular"], string> = {
  full: "fully modular",
  semi: "semi-modular",
  none: "non-modular",
};

export function psuName(psu: Psu): string {
  return `${psu.maker} ${psu.model}`;
}

export function efficiencyLabel(efficiency: PsuEfficiency): string {
  return EFFICIENCY_LABELS[efficiency];
}

export function modularLabel(modular: Psu["modular"]): string {
  return MODULAR_LABELS[modular];
}

/** "an" before 8xx, 11xx and 18xx wattages (eight, eleven, eighteen), "a" otherwise. */
function wattageWithArticle(value: number): string {
  const article = /^(8|11\d{2}|18\d{2})/.test(String(value)) ? "an" : "a";
  return `${article} ${value} W`;
}

/** Spec table rows. Every catalog field except ids and provenance appears. */
export function psuSpecs(psu: Psu): SpecGroup[] {
  return [
    {
      title: "Overview",
      rows: [
        { label: "Model", value: psuName(psu) },
        { label: "Maker", value: psu.maker },
        { label: "Wattage", value: watts(psu.watts) },
        { label: "Efficiency", value: efficiencyLabel(psu.efficiency) },
        { label: "ATX 3.x", value: yesNo(psu.atx3) },
        { label: "Cables", value: modularLabel(psu.modular) },
      ],
    },
    {
      title: "Connectors",
      rows: [
        { label: "CPU power (8-pin EPS)", value: String(psu.eps_count) },
        { label: "PCIe 8-pin (6+2)", value: String(psu.pcie_8pin_count) },
        { label: "PCIe 6-pin", value: String(psu.pcie_6pin_count) },
        {
          label: "12V-2x6 / 12VHPWR",
          value: String(psu.conn_12v2x6_count),
          note:
            psu.conn_12v2x6_count === 0 ? "Cards with this connector need an adapter" : undefined,
        },
      ],
    },
  ];
}

export function psuTitle(psu: Psu): string {
  return `${psuName(psu)}: specs, connectors and compatible graphics cards`;
}

/** One sentence under the page heading. */
export function psuLead(psu: Psu): string {
  const connector = psu.conn_12v2x6_count > 0 ? " with a native 12V-2x6 connector" : "";
  return `${psuName(psu)} is ${wattageWithArticle(psu.watts)}, ${efficiencyLabel(psu.efficiency)}, ${MODULAR_PHRASES[psu.modular]} power supply${connector}.`;
}

/** Plain text for the meta description (the page passes it through `metaDescription`). */
export function psuDescription(psu: Psu): string {
  return `${psuName(psu)}: ${watts(psu.watts)}, ${efficiencyLabel(psu.efficiency)}, ${MODULAR_PHRASES[psu.modular]}, ${psu.atx3 ? "ATX 3.x" : "not ATX 3.x"}. ${plural(psu.eps_count, "CPU 8-pin EPS connector")}, ${plural(psu.pcie_8pin_count, "PCIe 8-pin connector")}, ${plural(psu.pcie_6pin_count, "PCIe 6-pin connector")}, ${plural(psu.conn_12v2x6_count, "12V-2x6 connector")}.`;
}

/** Other PSUs closest in wattage, nearest first (ties: by name). */
export function otherPsus(psus: Psu[], psu: Psu, limit = OTHER_PSU_LIMIT): Psu[] {
  return psus
    .filter((other) => other.id !== psu.id)
    .sort(
      (a, b) =>
        Math.abs(a.watts - psu.watts) - Math.abs(b.watts - psu.watts) ||
        psuName(a).localeCompare(psuName(b)),
    )
    .slice(0, limit);
}

const WATTAGE_GROUPS: { heading: string; min: number; max: number }[] = [
  { heading: "1000 W and above", min: 1000, max: Infinity },
  { heading: "750 to 999 W", min: 750, max: 999 },
  { heading: "550 to 749 W", min: 550, max: 749 },
  { heading: "Under 550 W", min: 0, max: 549 },
];

/** PSUs grouped by wattage, highest group first; within one, highest wattage first, then name. */
export function psusByWattage(psus: Psu[]): { heading: string; psus: Psu[] }[] {
  return WATTAGE_GROUPS.map((group) => ({
    heading: group.heading,
    psus: psus
      .filter((psu) => psu.watts >= group.min && psu.watts <= group.max)
      .sort((a, b) => b.watts - a.watts || psuName(a).localeCompare(psuName(b))),
  })).filter((group) => group.psus.length > 0);
}
