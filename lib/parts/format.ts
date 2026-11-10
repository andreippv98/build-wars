import type { MemType } from "@/lib/schemas";

/** Small display formatters shared by every part type's spec builder. */

const VENDOR_NAMES: Record<string, string> = {
  amd: "AMD",
  intel: "Intel",
  nvidia: "NVIDIA",
};

/** `"amd"` -> `"AMD"`. Unknown vendors are capitalised. */
export function vendorName(vendor: string): string {
  return VENDOR_NAMES[vendor] ?? vendor.charAt(0).toUpperCase() + vendor.slice(1);
}

export function watts(value: number): string {
  return `${value} W`;
}

/** Clock in GHz, without trailing zeros noise: 4 -> "4 GHz", 5.25 -> "5.25 GHz". */
export function ghz(value: number): string {
  return `${value} GHz`;
}

export function mb(value: number): string {
  return `${value} MB`;
}

export function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}

/** `memSpeed("DDR5", 5600)` -> `"DDR5-5600"`. */
export function memSpeed(type: MemType, speed: number): string {
  return `${type}-${speed}`;
}

/** Joins items as "a, b and c" for sentences. */
export function listWords(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "1 core", "8 cores". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}
