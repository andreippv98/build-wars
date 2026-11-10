import type { BuildSlot } from "@/lib/schemas";
import type { SlotPart } from "./catalog-index";

export const SLOT_LABELS: Record<BuildSlot, { name: string; short: string; add: string }> = {
  cpu: { name: "Processor", short: "CPU", add: "Choose a processor" },
  gpu: { name: "Graphics card", short: "GPU", add: "Choose a graphics card" },
  ram: { name: "Memory", short: "RAM", add: "Choose memory" },
  motherboard: { name: "Motherboard", short: "Mobo", add: "Choose a motherboard" },
  psu: { name: "Power supply", short: "PSU", add: "Choose a power supply" },
};

/** Display name of a part, e.g. "ASUS TUF Gaming RTX 3080 OC" or "32 GB DDR5-6000 CL30". */
export function partName<S extends BuildSlot>(slot: S, part: SlotPart[S]): string {
  switch (slot) {
    case "cpu":
      return (part as SlotPart["cpu"]).name;
    case "gpu": {
      const { board } = part as SlotPart["gpu"];
      return `${board.maker} ${board.model}`;
    }
    case "ram": {
      const kit = part as SlotPart["ram"];
      const spec = `${kit.capacity_gb} GB ${kit.type}-${kit.speed_mts} CL${kit.cas}`;
      return kit.brand ? `${kit.brand} ${kit.model ?? ""} ${spec}`.replace(/\s+/g, " ") : spec;
    }
    case "motherboard":
    case "psu": {
      const p = part as SlotPart["motherboard"] | SlotPart["psu"];
      return `${p.maker} ${p.model}`;
    }
    default:
      return "";
  }
}

/** One line of key specs under the name, e.g. "8 cores · AM5 · 2024". */
export function partSummary<S extends BuildSlot>(slot: S, part: SlotPart[S]): string {
  switch (slot) {
    case "cpu": {
      const cpu = part as SlotPart["cpu"];
      return [`${cpu.cores} cores`, cpu.socket, cpu.igpu ? null : "no graphics", cpu.year]
        .filter(Boolean)
        .join(" · ");
    }
    case "gpu": {
      const { chip, board } = part as SlotPart["gpu"];
      return [`${chip.vram_gb} GB`, `${board.power_w} W`, `${board.length_mm} mm`, chip.year].join(
        " · ",
      );
    }
    case "ram": {
      const kit = part as SlotPart["ram"];
      const each = kit.capacity_gb / kit.sticks;
      return `${kit.sticks} × ${each} GB · ${kit.voltage} V`;
    }
    case "motherboard": {
      const board = part as SlotPart["motherboard"];
      return [board.socket, board.form_factor, board.mem_type, `${board.ram_slots} slots`].join(
        " · ",
      );
    }
    case "psu": {
      const psu = part as SlotPart["psu"];
      const tier = psu.efficiency[0].toUpperCase() + psu.efficiency.slice(1);
      return [`${psu.watts} W`, `80+ ${tier}`, psu.atx3 ? "ATX 3" : null]
        .filter(Boolean)
        .join(" · ");
    }
    default:
      return "";
  }
}
