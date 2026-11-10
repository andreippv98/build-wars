"use client";

import { ArrowLeftRight, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConfigurator } from "@/components/configurator/configurator-provider";
import { partName, partSummary, SLOT_LABELS } from "@/lib/build";
import { BUILD_SLOTS, type BuildSlot } from "@/lib/schemas";

export function PartsList() {
  const { build, evaluation, remove, clear, setActiveSlot } = useConfigurator();

  const marker = (slot: BuildSlot): "error" | "warning" | null => {
    const hits = evaluation.issues.filter((i) => i.slots.includes(slot));
    if (hits.some((i) => i.severity === "error")) return "error";
    if (hits.some((i) => i.severity === "warning")) return "warning";
    return null;
  };
  const anyChosen = BUILD_SLOTS.some((slot) => build[slot]);

  return (
    <section aria-labelledby="summary-parts-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="summary-parts-heading" className="text-sm font-semibold">
          Your build
        </h2>
        {anyChosen && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground min-h-11"
            onClick={clear}
            data-testid="clear-build"
          >
            Clear build
          </Button>
        )}
      </div>
      <ul className="divide-border flex flex-col divide-y">
        {BUILD_SLOTS.map((slot) => {
          const label = SLOT_LABELS[slot];
          const m = marker(slot);
          const part = build[slot];
          const markerEl = m && (
            <span
              aria-label={m === "error" ? "Has an error" : "Has a warning"}
              role="img"
              className={`size-2 shrink-0 rounded-full ${m === "error" ? "bg-red-500" : "bg-amber-400"}`}
            />
          );
          return (
            <li
              key={slot}
              data-testid={`summary-slot-${slot}`}
              data-filled={part ? "true" : "false"}
              className="py-2"
            >
              {part ? (
                <div className="flex items-center gap-1">
                  <div className="min-w-0 flex-1">
                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                      {markerEl}
                      {label.name}
                    </div>
                    <div className="text-sm font-medium break-words">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- slot-generic call */}
                      {partName(slot, part as any)}
                    </div>
                    <div className="text-muted-foreground text-xs break-words">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- slot-generic call */}
                      {partSummary(slot, part as any)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Change ${label.name.toLowerCase()}`}
                    data-testid={`change-${slot}`}
                    onClick={() => setActiveSlot(slot)}
                  >
                    <ArrowLeftRight />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-11"
                    aria-label={`Remove ${label.name.toLowerCase()}`}
                    data-testid={`remove-${slot}`}
                    onClick={() => remove(slot)}
                  >
                    <X />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    {markerEl}
                    {label.name}
                  </div>
                  <Button
                    variant="outline"
                    className="min-h-11 justify-start"
                    onClick={() => setActiveSlot(slot)}
                  >
                    <Plus />
                    {label.add}
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
