import { SLOT_LABELS } from "@/lib/build";
import type { Issue } from "@/lib/engine";
import type { BuildSlot } from "@/lib/schemas";

/** "a", "a and b", "a, b and c". */
export function joinNatural(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** "Add a graphics card and memory to see your Build Score". */
export function missingMessage(missing: BuildSlot[]): string {
  const names = missing.map((slot) => SLOT_LABELS[slot].name.toLowerCase());
  return `Add ${names.length ? `a ${joinNatural(names)}` : "more parts"} to see your Build Score`
    .replace("Add a memory", "Add memory")
    .replace(/ and a /g, " and ");
}

/** Anchor ids for issues: `issue-<rule>`, with `-2`, `-3`... for repeats of the same rule. */
export function issueIds(issues: Issue[]): string[] {
  const seen = new Map<string, number>();
  return issues.map((issue) => {
    const n = (seen.get(issue.rule) ?? 0) + 1;
    seen.set(issue.rule, n);
    return n === 1 ? `issue-${issue.rule}` : `issue-${issue.rule}-${n}`;
  });
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
