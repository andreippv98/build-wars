"use client";

import { Fragment, useCallback, useMemo, useState } from "react";
import { useConfigurator } from "@/components/configurator/configurator-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { partId, type SlotPart } from "@/lib/build";
import {
  defaultSort,
  filterAndSort,
  filterDefs,
  SORT_OPTIONS,
  type FilterValues,
} from "@/lib/build/filter-parts";
import type { BuildSlot } from "@/lib/schemas";
import { FilterBar } from "./filter-bar";
import { PartRow } from "./part-row";

const PAGE_SIZE = 60;

/** The open category: search, filters, sort and the list of parts. */
export function CategoryPanel({ slot }: { slot: BuildSlot }) {
  const { index, selection, select, setPreview, blockersFor } = useConfigurator();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValues>({});
  const [sort, setSort] = useState(defaultSort(slot));
  const [hideBlocked, setHideBlocked] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);

  const all = index.parts[slot] as SlotPart[BuildSlot][];
  const defs = useMemo(() => filterDefs(slot, all as never[]), [slot, all]);
  const matches = useMemo(
    () => filterAndSort(slot, all as never[], { query, filters, sort }) as SlotPart[BuildSlot][],
    [slot, all, query, filters, sort],
  );
  const selectedId = selection[slot];

  const reasonOf = useCallback(
    (part: SlotPart[BuildSlot]): string | null =>
      blockersFor(slot, part as never)[0]?.message ?? null,
    [blockersFor, slot],
  );

  // Blockers are computed for every match only when incompatible parts are hidden.
  const visible = useMemo(() => {
    const items: { id: string; part: SlotPart[BuildSlot]; reason: string | null }[] = [];
    const wanted = hideBlocked ? Infinity : limit;
    const shown = hideBlocked ? matches : matches.slice(0, limit);
    for (const part of shown) {
      const id = partId(slot, part as never);
      const reason = reasonOf(part);
      if (hideBlocked && reason && id !== selectedId) continue;
      items.push({ id, part, reason });
      if (items.length >= wanted) break;
    }
    return items;
  }, [matches, hideBlocked, limit, slot, reasonOf, selectedId]);

  const total = hideBlocked ? visible.length : matches.length;
  const rows = hideBlocked ? visible.slice(0, limit) : visible;
  const grouped = slot === "gpu" && (sort === "performance" || sort === "newest");

  const onPick = useCallback((id: string) => select(slot, id), [select, slot]);
  const onPreview = useCallback(
    (id: string | null) => setPreview(id ? { slot, id } : null),
    [setPreview, slot],
  );
  const resetPage = () => setLimit(PAGE_SIZE);

  let lastChip: string | null = null;
  return (
    <div className="flex flex-col">
      <div className="bg-background z-10 flex flex-col gap-2 px-2 pt-2 pb-2 lg:sticky lg:top-0">
        <label htmlFor={`picker-search-${slot}`} className="sr-only">
          Search {slot === "gpu" ? "graphics cards" : "parts"}
        </label>
        <Input
          id={`picker-search-${slot}`}
          data-testid="picker-search"
          type="search"
          placeholder="Search by name"
          autoComplete="off"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            resetPage();
          }}
          className="h-11 md:h-9"
        />
        <FilterBar
          defs={defs}
          values={filters}
          onFilter={(key, value) => {
            setFilters((f) => ({ ...f, [key]: value }));
            resetPage();
          }}
          sorts={SORT_OPTIONS[slot]}
          sort={sort}
          onSort={(next) => {
            setSort(next);
            resetPage();
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm md:min-h-8">
            <input
              type="checkbox"
              className="accent-primary size-4"
              checked={hideBlocked}
              onChange={(e) => {
                setHideBlocked(e.target.checked);
                resetPage();
              }}
            />
            Hide incompatible
          </label>
          <span
            data-testid="picker-count"
            aria-live="polite"
            className="text-muted-foreground text-xs"
          >
            {total} {total === 1 ? "part" : "parts"}
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-1 px-2 pb-3">
        {rows.length === 0 ? (
          <p className="text-muted-foreground px-1 py-4 text-sm">
            Nothing matches. Try a different search or clear a filter.
          </p>
        ) : null}
        {rows.map(({ id, part, reason }) => {
          const chip = grouped ? (part as SlotPart["gpu"]).chip : null;
          const header = chip && chip.id !== lastChip ? chip.name : null;
          if (chip) lastChip = chip.id;
          return (
            <Fragment key={id}>
              {header ? (
                <h3 className="text-muted-foreground px-1 pt-2 text-xs font-medium">{header}</h3>
              ) : null}
              <PartRow
                slot={slot}
                id={id}
                part={part}
                selected={id === selectedId}
                reason={reason}
                onPick={onPick}
                onPreview={onPreview}
              />
            </Fragment>
          );
        })}
        {rows.length < total ? (
          <Button
            type="button"
            variant="outline"
            className="mt-1 h-11"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
          >
            Show more
          </Button>
        ) : null}
      </div>
    </div>
  );
}
