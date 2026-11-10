"use client";

import { useId } from "react";
import type { FilterDef, FilterValues, SortOption } from "@/lib/build/filter-parts";

const CONTROL =
  "border-input focus-visible:border-ring focus-visible:ring-ring/50 bg-background text-foreground h-11 w-full min-w-0 rounded-lg border px-2 text-sm outline-none focus-visible:ring-3 md:h-9";

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="text-muted-foreground mb-0.5 block text-xs">
        {label}
      </label>
      <select id={id} className={CONTROL} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
    </div>
  );
}

export function FilterBar({
  defs,
  values,
  onFilter,
  sorts,
  sort,
  onSort,
}: {
  defs: FilterDef[];
  values: FilterValues;
  onFilter: (key: string, value: string) => void;
  sorts: SortOption[];
  sort: string;
  onSort: (sort: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {defs.map((def) => (
        <SelectField
          key={def.key}
          label={def.label}
          value={values[def.key] ?? ""}
          onChange={(value) => onFilter(def.key, value)}
        >
          <option value="">All</option>
          {def.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
      ))}
      <SelectField label="Sort by" value={sort} onChange={onSort}>
        {sorts.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}
