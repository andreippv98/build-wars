import type { Chipset, Motherboard } from "@/lib/schemas";
import { memSpeed, plural } from "./format";
import type { SpecGroup } from "./specs";

/** Length of the "Other motherboards" list. */
export const OTHER_MOTHERBOARD_LIMIT = 6;

/** Order of the socket groups on the motherboard index: newest platform first. */
const SOCKET_ORDER: Motherboard["socket"][] = [
  "AM5",
  "LGA1851",
  "LGA1700",
  "AM4",
  "LGA1200",
  "LGA1151",
];

export function motherboardName(board: Motherboard): string {
  return `${board.maker} ${board.model}`;
}

/** Spec table rows. Every catalog field except ids, provenance and CPU support appears. */
export function motherboardSpecs(board: Motherboard, chipset: Chipset): SpecGroup[] {
  return [
    {
      title: "Overview",
      rows: [
        { label: "Model", value: motherboardName(board) },
        { label: "Maker", value: board.maker },
        { label: "Chipset", value: chipset.name },
        { label: "Socket", value: board.socket },
        { label: "Form factor", value: board.form_factor },
      ],
    },
    {
      title: "Memory",
      rows: [
        { label: "Memory type", value: board.mem_type },
        { label: "Memory slots", value: plural(board.ram_slots, "slot") },
        { label: "Max memory", value: `${board.max_mem_gb} GB` },
        {
          label: "Max memory speed",
          value: memSpeed(board.mem_type, board.max_mem_speed),
        },
      ],
    },
    {
      title: "Expansion and power",
      rows: [
        { label: "Main graphics slot", value: `PCIe ${board.pcie_gen}` },
        { label: "CPU power connectors", value: `${board.eps_required} x 8-pin EPS` },
      ],
    },
  ];
}

export function motherboardTitle(board: Motherboard): string {
  return `${motherboardName(board)}: specs and compatible processors`;
}

/** Indefinite article for a form factor: "an ATX", "a mATX". */
function article(formFactor: string): string {
  return /^[aeiou]/i.test(formFactor) ? "an" : "a";
}

/** One sentence under the page heading. */
export function motherboardLead(board: Motherboard, chipset: Chipset): string {
  return `${motherboardName(board)} is ${article(board.form_factor)} ${board.form_factor} motherboard with the ${chipset.name} chipset for the ${board.socket} socket, with ${plural(board.ram_slots, board.mem_type + " memory slot", board.mem_type + " memory slots")}.`;
}

/** Plain text for the meta description (the page passes it through `metaDescription`). */
export function motherboardDescription(board: Motherboard, chipset: Chipset): string {
  return `${motherboardName(board)}: ${board.form_factor}, ${chipset.name} chipset, ${board.socket}, ${plural(board.ram_slots, board.mem_type + " slot", board.mem_type + " slots")}, up to ${board.max_mem_gb} GB, PCIe ${board.pcie_gen} main slot. Compatible processors.`;
}

/** Same-socket boards, same chipset first, then by name. */
export function otherMotherboards(
  boards: Motherboard[],
  board: Motherboard,
  limit = OTHER_MOTHERBOARD_LIMIT,
): Motherboard[] {
  return boards
    .filter((other) => other.socket === board.socket && other.id !== board.id)
    .sort(
      (a, b) =>
        Number(b.chipset_id === board.chipset_id) - Number(a.chipset_id === board.chipset_id) ||
        motherboardName(a).localeCompare(motherboardName(b)),
    )
    .slice(0, limit);
}

/** Motherboards grouped by socket in `SOCKET_ORDER`; boards sorted by name inside a group. */
export function motherboardsBySocket(
  boards: Motherboard[],
): { socket: Motherboard["socket"]; boards: Motherboard[] }[] {
  const groups = new Map<Motherboard["socket"], Motherboard[]>();
  for (const board of boards)
    groups.set(board.socket, [...(groups.get(board.socket) ?? []), board]);
  const rank = (socket: Motherboard["socket"]) => {
    const index = SOCKET_ORDER.indexOf(socket);
    return index === -1 ? SOCKET_ORDER.length : index;
  };
  return [...groups.entries()]
    .map(([socket, list]) => ({
      socket,
      boards: [...list].sort((a, b) => motherboardName(a).localeCompare(motherboardName(b))),
    }))
    .sort((a, b) => rank(a.socket) - rank(b.socket));
}
