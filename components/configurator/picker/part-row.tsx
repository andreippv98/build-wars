"use client";

import { memo } from "react";
import { partName, partSummary, type SlotPart } from "@/lib/build";
import type { BuildSlot } from "@/lib/schemas";
import { cn } from "cn";

const ESTIMATE_TITLE = "Estimate: not yet based on review data";

function perfOf(slot: BuildSlot, part: SlotPart[BuildSlot]) {
  if (slot === "cpu") {
    const cpu = part as SlotPart["cpu"];
    return { value: cpu.perf_index, verified: cpu.perf_index_verified };
  }
  if (slot === "gpu") {
    const { chip } = part as SlotPart["gpu"];
    return { value: chip.perf_index, verified: chip.perf_index_verified };
  }
  return null;
}

export type PartRowProps = {
  slot: BuildSlot;
  id: string;
  part: SlotPart[BuildSlot];
  selected: boolean;
  /** Why this part cannot be picked; null = it can. */
  reason: string | null;
  onPick: (id: string) => void;
  onPreview: (id: string | null) => void;
};

export const PartRow = memo(function PartRow({
  slot,
  id,
  part,
  selected,
  reason,
  onPick,
  onPreview,
}: PartRowProps) {
  // The chosen part is shown as chosen even when it has issues; the reason stays visible.
  const blocked = reason !== null && !selected;
  const perf = perfOf(slot, part);
  return (
    <button
      type="button"
      data-testid={`picker-row-${id}`}
      data-blocked={blocked ? "true" : "false"}
      data-selected={selected ? "true" : "false"}
      aria-pressed={selected}
      aria-disabled={blocked}
      onClick={() => {
        if (!blocked) onPick(id);
      }}
      onPointerEnter={() => {
        if (!blocked) onPreview(id);
      }}
      onPointerLeave={() => onPreview(null)}
      onFocus={() => {
        if (!blocked) onPreview(id);
      }}
      onBlur={() => onPreview(null)}
      className={cn(
        "focus-visible:ring-ring/60 flex min-h-11 w-full items-start gap-2 rounded-md border px-2.5 py-2 text-left outline-none focus-visible:ring-2",
        selected ? "border-primary bg-primary/10" : "hover:bg-accent/50 border-transparent",
        blocked && "cursor-not-allowed opacity-55 hover:bg-transparent",
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug font-medium break-words">
          {partName(slot, part as never)}
        </span>
        <span className="text-muted-foreground block text-xs leading-snug">
          {partSummary(slot, part as never)}
        </span>
        {reason ? (
          <span className="text-destructive mt-0.5 block text-xs leading-snug">{reason}</span>
        ) : null}
      </span>
      {perf ? (
        <span className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular-nums">{perf.value}</span>
          {perf.verified ? null : (
            <span
              title={ESTIMATE_TITLE}
              aria-label={ESTIMATE_TITLE}
              className="text-muted-foreground border-border rounded border px-1 text-[10px] leading-4"
            >
              est.
            </span>
          )}
        </span>
      ) : null}
    </button>
  );
});
