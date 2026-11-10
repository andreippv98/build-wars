/** A group of rows in a part page's spec table. */
export type SpecRow = {
  label: string;
  /** Already formatted for display, units included: "8 cores / 16 threads", "304 mm". */
  value: string;
  /** Optional short explanation shown under the value. */
  note?: string;
};
export type SpecGroup = { title: string; rows: SpecRow[] };

/** Flattens groups into name / value pairs for structured data. */
export function specPairs(groups: SpecGroup[]): { name: string; value: string }[] {
  return groups.flatMap((group) =>
    group.rows.map((row) => ({ name: row.label, value: row.value })),
  );
}
