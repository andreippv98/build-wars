"use client";

import { ChevronDownIcon } from "lucide-react";
import { useConfigurator } from "@/components/configurator/configurator-provider";
import { partName, SLOT_LABELS, type SlotPart } from "@/lib/build";
import { BUILD_SLOTS } from "@/lib/schemas";
import { cn } from "cn";
import { CategoryPanel } from "./picker/category-panel";

/** Left panel: component categories, each a searchable, filterable list. */
export function PartPicker() {
  const { index, selection, activeSlot, setActiveSlot, setPreview } = useConfigurator();

  return (
    <div
      data-testid="part-picker"
      className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
    >
      {BUILD_SLOTS.map((slot) => {
        const open = activeSlot === slot;
        const id = selection[slot];
        const chosen = id
          ? (index.byId[slot].get(id) as SlotPart[typeof slot] | undefined)
          : undefined;
        return (
          <section key={slot} className="border-border flex shrink-0 flex-col border-b">
            <h2 className="m-0">
              <button
                type="button"
                data-testid={`picker-category-${slot}`}
                aria-expanded={open}
                aria-controls={`picker-panel-${slot}`}
                onClick={() => {
                  setPreview(null);
                  setActiveSlot(open ? null : slot);
                }}
                className="hover:bg-accent/40 focus-visible:ring-ring/60 flex min-h-14 w-full items-center gap-2 px-3 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">{SLOT_LABELS[slot].name}</span>
                  <span
                    className={cn(
                      "block truncate text-xs",
                      chosen ? "text-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {chosen ? partName(slot, chosen as never) : SLOT_LABELS[slot].add}
                  </span>
                </span>
                <ChevronDownIcon
                  aria-hidden
                  className={cn("text-muted-foreground size-4 shrink-0", open && "rotate-180")}
                />
              </button>
            </h2>
            {open ? (
              <div id={`picker-panel-${slot}`} className="flex flex-col">
                <CategoryPanel key={slot} slot={slot} />
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
