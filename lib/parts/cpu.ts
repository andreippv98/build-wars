import type { Cpu, CpuGeneration, MemType } from "@/lib/schemas";
import { ghz, mb, memSpeed, plural, vendorName, watts } from "./format";
import type { SpecGroup } from "./specs";

/** What 100 means on the CPU index (plan: gaming performance relative to this CPU). */
export const CPU_INDEX_REFERENCE = "Ryzen 7 9800X3D = 100";
/** Length of the "Other processors" list. */
export const OTHER_CPU_LIMIT = 6;

const GENERATION_LABELS: Record<CpuGeneration, string> = {
  "intel-9": "Intel Core 9th generation",
  "intel-10": "Intel Core 10th generation",
  "intel-11": "Intel Core 11th generation",
  "intel-12": "Intel Core 12th generation",
  "intel-13": "Intel Core 13th generation",
  "intel-14": "Intel Core 14th generation",
  "intel-core-ultra-200": "Intel Core Ultra 200 series",
  "ryzen-2000": "AMD Ryzen 2000 series",
  "ryzen-3000": "AMD Ryzen 3000 series",
  "ryzen-4000": "AMD Ryzen 4000 series",
  "ryzen-5000": "AMD Ryzen 5000 series",
  "ryzen-7000": "AMD Ryzen 7000 series",
  "ryzen-8000": "AMD Ryzen 8000 series",
  "ryzen-9000": "AMD Ryzen 9000 series",
};

function memSpeeds(cpu: Cpu): string {
  return cpu.mem_types
    .flatMap((type: MemType) => {
      const speed = cpu.max_mem_speed[type];
      return speed ? [memSpeed(type, speed)] : [];
    })
    .join(", ");
}

/** Spec table rows. Every catalog field except ids and provenance appears. */
export function cpuSpecs(cpu: Cpu): SpecGroup[] {
  return [
    {
      title: "Overview",
      rows: [
        { label: "Model", value: cpu.name },
        { label: "Vendor", value: vendorName(cpu.vendor) },
        { label: "Socket", value: cpu.socket },
        { label: "Generation", value: GENERATION_LABELS[cpu.generation] },
        { label: "Release year", value: String(cpu.year) },
        { label: "Cores / threads", value: `${cpu.cores} cores / ${cpu.threads} threads` },
      ],
    },
    {
      title: "Performance and clocks",
      rows: [
        { label: "Base clock", value: ghz(cpu.base_ghz) },
        { label: "Boost clock", value: ghz(cpu.boost_ghz) },
        { label: "L3 cache", value: mb(cpu.cache_mb) },
        {
          label: "CPU index",
          value: String(cpu.perf_index),
          note: cpu.perf_index_verified
            ? `Relative to the ${CPU_INDEX_REFERENCE}`
            : "Placeholder value, not yet based on review data",
        },
      ],
    },
    {
      title: "Power",
      rows: [
        { label: "TDP", value: watts(cpu.tdp_w) },
        {
          label: cpu.vendor === "amd" ? "Package power limit (PPT)" : "Package power limit (PL2)",
          value: watts(cpu.ppt_w),
          note:
            cpu.vendor === "amd"
              ? "The most power the processor may draw under load (AMD calls it PPT)"
              : "The most power the processor may draw for short bursts (Intel calls it PL2)",
        },
      ],
    },
    {
      title: "Memory and platform",
      rows: [
        {
          label: "Integrated graphics",
          value: cpu.igpu ? "Yes" : "No (needs a graphics card)",
        },
        {
          label: "Memory types",
          value: cpu.mem_types.join(", "),
          note:
            cpu.mem_types.length > 1
              ? "The motherboard decides which type is used; boards take one type only"
              : undefined,
        },
        { label: "Max official memory speed", value: memSpeeds(cpu) },
        { label: "PCIe generation", value: `PCIe ${cpu.pcie_gen}` },
      ],
    },
  ];
}

export function cpuTitle(cpu: Cpu): string {
  return `${cpu.name}: specs, CPU index and compatible motherboards`;
}

/** One sentence under the page heading. */
export function cpuLead(cpu: Cpu): string {
  const igpu = cpu.igpu ? "with integrated graphics" : "without integrated graphics";
  return `${cpu.name} is an ${vendorName(cpu.vendor)} desktop processor with ${plural(cpu.cores, "core")} and ${plural(cpu.threads, "thread")} for the ${cpu.socket} socket, released in ${cpu.year}, ${igpu}.`;
}

/** Plain text for the meta description (the page passes it through `metaDescription`). */
export function cpuDescription(cpu: Cpu): string {
  return `${cpu.name}: ${cpu.cores} cores / ${cpu.threads} threads, ${cpu.socket}, ${cpu.year}, up to ${ghz(cpu.boost_ghz)}, ${memSpeeds(cpu)}. CPU index ${cpu.perf_index}${cpu.perf_index_verified ? "" : " (estimate)"}. Compatible motherboards.`;
}

/** Same-socket CPUs closest in index, nearest first (ties: higher index, then name). */
export function otherCpus(cpus: Cpu[], cpu: Cpu, limit = OTHER_CPU_LIMIT): Cpu[] {
  return cpus
    .filter((other) => other.socket === cpu.socket && other.id !== cpu.id)
    .sort(
      (a, b) =>
        Math.abs(a.perf_index - cpu.perf_index) - Math.abs(b.perf_index - cpu.perf_index) ||
        b.perf_index - a.perf_index ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit);
}

/** CPUs grouped by socket, sockets with the newest processor first; within one, strongest first. */
export function cpusBySocket(cpus: Cpu[]): { socket: Cpu["socket"]; cpus: Cpu[] }[] {
  const groups = new Map<Cpu["socket"], Cpu[]>();
  for (const cpu of cpus) groups.set(cpu.socket, [...(groups.get(cpu.socket) ?? []), cpu]);
  const newest = (list: Cpu[]) => Math.max(...list.map((c) => c.year));
  return [...groups.entries()]
    .map(([socket, list]) => ({
      socket,
      cpus: [...list].sort((a, b) => b.perf_index - a.perf_index || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => newest(b.cpus) - newest(a.cpus) || a.socket.localeCompare(b.socket));
}
