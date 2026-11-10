import type { BuildSlot } from "@/lib/schemas";
import type { SlotPart } from "./catalog-index";
import { partName } from "./labels";

/** Pure search, filter and sort logic for the part picker. No React. */

export type FilterOption = { value: string; label: string };
export type FilterDef = { key: string; label: string; options: FilterOption[] };
/** Chosen value per filter key; a missing key or "" means "All". */
export type FilterValues = Partial<Record<string, string>>;
export type SortOption = { key: string; label: string };

/** Minimum-wattage choices offered for power supplies (only those keeping a part are shown). */
const PSU_WATT_STEPS = [550, 650, 750, 850, 1000];

export const SORT_OPTIONS: Record<BuildSlot, SortOption[]> = {
  cpu: [
    { key: "performance", label: "Performance" },
    { key: "name", label: "Name" },
    { key: "newest", label: "Newest" },
  ],
  gpu: [
    { key: "performance", label: "Performance" },
    { key: "name", label: "Name" },
    { key: "newest", label: "Newest" },
    { key: "shortest", label: "Shortest" },
  ],
  motherboard: [
    { key: "name", label: "Name" },
    { key: "socket", label: "Socket" },
  ],
  ram: [
    { key: "capacity", label: "Capacity" },
    { key: "speed", label: "Speed" },
  ],
  psu: [
    { key: "wattage", label: "Wattage" },
    { key: "name", label: "Name" },
  ],
};

export function defaultSort(slot: BuildSlot): string {
  return SORT_OPTIONS[slot][0].key;
}

const VENDOR_LABELS: Record<string, string> = {
  amd: "AMD",
  intel: "Intel",
  nvidia: "NVIDIA",
};

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

// --- Search ------------------------------------------------------------------------------------

/** Lower-cased text that search matches against: the part name, plus the chip name for GPUs. */
export function searchText<S extends BuildSlot>(slot: S, part: SlotPart[S]): string {
  const name = partName(slot, part);
  if (slot === "gpu") return `${name} ${(part as SlotPart["gpu"]).chip.name}`.toLowerCase();
  return name.toLowerCase();
}

/** Case-insensitive; every whitespace-separated word must appear. An empty query matches all. */
export function matchesSearch<S extends BuildSlot>(
  slot: S,
  part: SlotPart[S],
  query: string,
): boolean {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = searchText(slot, part);
  return words.every((word) => text.includes(word));
}

// --- Filters -----------------------------------------------------------------------------------

type Spec<S extends BuildSlot> = {
  key: string;
  label: string;
  /** The value of this part for the filter (the option `value`). */
  value: (part: SlotPart[S]) => string;
  optionLabel?: (value: string) => string;
  /** Orders option values; default is alphabetical. */
  order?: (a: string, b: string) => number;
};

const vendorLabel = (value: string) => VENDOR_LABELS[value] ?? value;
const numberAsc = (a: string, b: string) => Number(a) - Number(b);
const numberDesc = (a: string, b: string) => Number(b) - Number(a);

const FILTER_SPECS: { [S in BuildSlot]: Spec<S>[] } = {
  cpu: [
    { key: "brand", label: "Brand", value: (p) => p.vendor, optionLabel: vendorLabel },
    { key: "socket", label: "Socket", value: (p) => p.socket },
    { key: "year", label: "Year", value: (p) => String(p.year), order: numberDesc },
  ],
  gpu: [
    { key: "brand", label: "Chip brand", value: (p) => p.chip.vendor, optionLabel: vendorLabel },
    { key: "series", label: "Series", value: (p) => p.chip.series },
    { key: "maker", label: "Card maker", value: (p) => p.board.maker },
    { key: "year", label: "Year", value: (p) => String(p.chip.year), order: numberDesc },
  ],
  motherboard: [
    { key: "maker", label: "Maker", value: (p) => p.maker },
    { key: "socket", label: "Socket", value: (p) => p.socket },
    { key: "form", label: "Form factor", value: (p) => p.form_factor },
  ],
  ram: [
    { key: "type", label: "Type", value: (p) => p.type },
    {
      key: "capacity",
      label: "Capacity",
      value: (p) => String(p.capacity_gb),
      optionLabel: (v) => `${v} GB`,
      order: numberAsc,
    },
  ],
  psu: [{ key: "maker", label: "Maker", value: (p) => p.maker }],
};

/** The filters worth showing for these parts: each has at least two options. */
export function filterDefs<S extends BuildSlot>(slot: S, parts: SlotPart[S][]): FilterDef[] {
  const specs = FILTER_SPECS[slot] as Spec<S>[];
  const defs: FilterDef[] = [];
  for (const spec of specs) {
    const values = [...new Set(parts.map(spec.value))].sort(spec.order ?? collator.compare);
    if (values.length < 2) continue;
    defs.push({
      key: spec.key,
      label: spec.label,
      options: values.map((value) => ({ value, label: spec.optionLabel?.(value) ?? value })),
    });
  }
  if (slot === "psu") {
    const psus = parts as SlotPart["psu"][];
    const steps = PSU_WATT_STEPS.filter((min) => psus.some((p) => p.watts >= min));
    if (steps.length >= 2) {
      defs.push({
        key: "minWatts",
        label: "Minimum wattage",
        options: steps.map((min) => ({ value: String(min), label: `${min}+ W` })),
      });
    }
  }
  return defs;
}

function matchesFilters<S extends BuildSlot>(
  slot: S,
  part: SlotPart[S],
  filters: FilterValues,
): boolean {
  for (const spec of FILTER_SPECS[slot] as Spec<S>[]) {
    const wanted = filters[spec.key];
    if (wanted && spec.value(part) !== wanted) return false;
  }
  if (slot === "psu") {
    const min = Number(filters.minWatts);
    if (min && (part as SlotPart["psu"]).watts < min) return false;
  }
  return true;
}

// --- Sorting -----------------------------------------------------------------------------------

type Compare<S extends BuildSlot> = (a: SlotPart[S], b: SlotPart[S]) => number;

const byName =
  <S extends BuildSlot>(slot: S): Compare<S> =>
  (a, b) =>
    collator.compare(partName(slot, a), partName(slot, b));

const then =
  <T>(...compares: ((a: T, b: T) => number)[]) =>
  (a: T, b: T) => {
    for (const compare of compares) {
      const result = compare(a, b);
      if (result !== 0) return result;
    }
    return 0;
  };

function comparator<S extends BuildSlot>(slot: S, sort: string): Compare<S> {
  type Any = SlotPart[BuildSlot];
  const name = byName(slot) as (a: Any, b: Any) => number;
  const make = (c: unknown) => c as Compare<S>;
  switch (slot) {
    case "cpu": {
      const cpu = (fn: (a: SlotPart["cpu"], b: SlotPart["cpu"]) => number) => fn;
      if (sort === "name") return make(name);
      if (sort === "newest")
        return make(
          then(
            cpu((a, b) => b.year - a.year),
            name,
          ),
        );
      return make(
        then(
          cpu((a, b) => b.perf_index - a.perf_index),
          name,
        ),
      );
    }
    case "gpu": {
      type G = SlotPart["gpu"];
      const perf = (a: G, b: G) =>
        b.chip.perf_index - a.chip.perf_index || collator.compare(a.chip.id, b.chip.id);
      const boost = (a: G, b: G) => b.board.boost_mhz - a.board.boost_mhz;
      if (sort === "name") return make(name);
      if (sort === "newest")
        return make(then<G>((a, b) => b.chip.year - a.chip.year, perf, boost, name));
      if (sort === "shortest")
        return make(then<G>((a, b) => a.board.length_mm - b.board.length_mm, name));
      return make(then<G>(perf, boost, name));
    }
    case "motherboard": {
      type M = SlotPart["motherboard"];
      if (sort === "socket")
        return make(then<M>((a, b) => collator.compare(a.socket, b.socket), name));
      return make(name);
    }
    case "ram": {
      type R = SlotPart["ram"];
      const capacity = (a: R, b: R) => b.capacity_gb - a.capacity_gb;
      const speed = (a: R, b: R) => b.speed_mts - a.speed_mts;
      return make(
        sort === "speed" ? then<R>(speed, capacity, name) : then<R>(capacity, speed, name),
      );
    }
    case "psu": {
      type P = SlotPart["psu"];
      if (sort === "name") return make(name);
      return make(then<P>((a, b) => a.watts - b.watts, name));
    }
    default:
      return () => 0;
  }
}

export function sortParts<S extends BuildSlot>(
  slot: S,
  parts: SlotPart[S][],
  sort: string,
): SlotPart[S][] {
  return [...parts].sort(comparator(slot, sort));
}

/** Search, filter, then sort. Does not change the input array. */
export function filterAndSort<S extends BuildSlot>(
  slot: S,
  parts: SlotPart[S][],
  options: { query?: string; filters?: FilterValues; sort?: string },
): SlotPart[S][] {
  const { query = "", filters = {}, sort = defaultSort(slot) } = options;
  const matches = parts.filter(
    (part) => matchesSearch(slot, part, query) && matchesFilters(slot, part, filters),
  );
  return sortParts(slot, matches, sort);
}
